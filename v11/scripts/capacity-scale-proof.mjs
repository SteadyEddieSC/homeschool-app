import { Miniflare } from 'miniflare';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCALES = [25, 50, 100];
const STAMP = '2026-10-28T12:00:00.000Z';
const BASE_DAY = '2026-08-01';

function assert(value, message) {
  if (!value) throw new Error(`Capacity-scale proof failed: ${message}`);
}

const seq = `WITH RECURSIVE seq(n) AS (SELECT ? UNION ALL SELECT n + 1 FROM seq WHERE n < ?)`;

async function applyMigration(db) {
  const migration = await readFile('cloudflare-proof/migrations/0001_household_first.sql', 'utf8');
  for (const sql of migration.replace(/^--.*$/gm, '').split(';').map((part) => part.trim()).filter(Boolean)) {
    await db.prepare(sql).run();
  }
}

async function insertRange(db, total, sql) {
  for (let start = 1; start <= total; start += 1000) {
    const end = Math.min(total, start + 999);
    await db.prepare(`${seq}\n${sql}`).bind(start, end).run();
  }
}

async function directoryBytes(path) {
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) total += await directoryBytes(full);
    else if (entry.isFile()) total += (await stat(full)).size;
  }
  return total;
}

async function seed(db, families) {
  const learners = families * 3;
  const classes = Math.ceil(families * 0.3);
  const familyForLearner = (expr) => `CAST(((${expr}) - 1) / 3 AS INTEGER) + 1`;
  const ownerForFamily = (familyExpr) => `((${familyExpr}) - 1) * 2 + 1`;

  await insertRange(db, families * 2, `INSERT INTO adult_accounts (id, created_at)
    SELECT printf('adult-%04d', n), '${STAMP}' FROM seq`);
  await insertRange(db, families, `INSERT INTO households (id, name, created_at)
    SELECT printf('family-%03d', n), printf('Synthetic Family %03d', n), '${STAMP}' FROM seq`);
  await insertRange(db, families * 2, `INSERT INTO household_adults (household_id, adult_id, role, created_at)
    SELECT printf('family-%03d', CAST((n - 1) / 2 AS INTEGER) + 1), printf('adult-%04d', n),
      CASE WHEN ((n - 1) % 2) = 0 THEN 'owner' ELSE 'adult' END, '${STAMP}' FROM seq`);
  await insertRange(db, learners, `INSERT INTO learners (id, household_id, preferred_name, grade_band, status, created_at, updated_at)
    SELECT printf('learner-%04d', n), printf('family-%03d', ${familyForLearner('n')}), printf('Learner %04d', n),
      '4-6', 'active', '${STAMP}', '${STAMP}' FROM seq`);

  await db.prepare("INSERT INTO organizations (id, name, created_at) VALUES ('coop-001', 'Synthetic Community Co-op', ?)").bind(STAMP).run();
  await insertRange(db, families * 2, `INSERT INTO organization_adults (organization_id, adult_id, role, created_at)
    SELECT 'coop-001', printf('adult-%04d', n), CASE WHEN n = 1 THEN 'admin' ELSE 'member' END, '${STAMP}' FROM seq`);
  await insertRange(db, families, `INSERT INTO academic_years (id, household_id, label, starts_on, ends_on, instructional_day_target, record_pack, created_at)
    SELECT printf('year-%03d', n), printf('family-%03d', n), '2026-27', '2026-08-01', '2027-06-30', 180, 'SC-home-study', '${STAMP}' FROM seq`);
  await insertRange(db, families, `INSERT INTO record_pack_profiles (id, household_id, jurisdiction, instructional_day_target, tracks_subject_activities, tracks_portfolio_references, tracks_attendance, tracks_individual_progress, created_at)
    SELECT printf('pack-%03d', n), printf('family-%03d', n), 'SC', 180, 1, 1, 1, 1, '${STAMP}' FROM seq`);

  await insertRange(db, learners * 6, `INSERT INTO courses (id, household_id, academic_year_id, learner_id, name, subject, created_at)
    SELECT printf('course-%06d', n),
      printf('family-%03d', ${familyForLearner('CAST((n - 1) / 6 AS INTEGER) + 1')}),
      printf('year-%03d', ${familyForLearner('CAST((n - 1) / 6 AS INTEGER) + 1')}),
      printf('learner-%04d', CAST((n - 1) / 6 AS INTEGER) + 1),
      printf('Course %d', ((n - 1) % 6) + 1), printf('Subject %d', ((n - 1) % 6) + 1), '${STAMP}' FROM seq`);

  await insertRange(db, classes, `INSERT INTO class_sections (id, organization_id, name, created_at)
    SELECT printf('class-%03d', n), 'coop-001', printf('Synthetic Class %03d', n), '${STAMP}' FROM seq`);
  await insertRange(db, learners * 2, `INSERT INTO class_enrollments (id, class_id, learner_id, household_id, granted_by_adult_id, status, created_at)
    SELECT printf('enroll-%06d', n),
      printf('class-%03d', ((CAST((n - 1) / 2 AS INTEGER) + ((n - 1) % 2)) % ${classes}) + 1),
      printf('learner-%04d', CAST((n - 1) / 2 AS INTEGER) + 1),
      printf('family-%03d', ${familyForLearner('CAST((n - 1) / 2 AS INTEGER) + 1')}),
      printf('adult-%04d', ${ownerForFamily(familyForLearner('CAST((n - 1) / 2 AS INTEGER) + 1'))}),
      'active', '${STAMP}' FROM seq`);

  await insertRange(db, learners * 180, `INSERT INTO work_items (id, household_id, learner_id, title, instructions, due_on, status, version, assigned_by_adult_id, created_at, updated_at)
    SELECT printf('work-%07d', n),
      printf('family-%03d', ${familyForLearner('CAST((n - 1) / 180 AS INTEGER) + 1')}),
      printf('learner-%04d', CAST((n - 1) / 180 AS INTEGER) + 1),
      printf('Synthetic Work %07d', n), 'Synthetic scale fixture',
      date('${BASE_DAY}', '+' || ((n - 1) % 180) || ' days'),
      CASE WHEN ((n - 1) % 180) < 30 THEN 'assigned' ELSE 'completed' END, 1,
      printf('adult-%04d', ${ownerForFamily(familyForLearner('CAST((n - 1) / 180 AS INTEGER) + 1'))}), '${STAMP}', '${STAMP}' FROM seq`);
  await insertRange(db, learners * 180, `INSERT INTO work_logs (id, household_id, work_item_id, learner_id, status, note, recorded_by_adult_id, occurred_at)
    SELECT printf('log-%07d', n),
      printf('family-%03d', ${familyForLearner('CAST((n - 1) / 180 AS INTEGER) + 1')}),
      printf('work-%07d', n), printf('learner-%04d', CAST((n - 1) / 180 AS INTEGER) + 1),
      'completed', 'Synthetic completion',
      printf('adult-%04d', ${ownerForFamily(familyForLearner('CAST((n - 1) / 180 AS INTEGER) + 1'))}),
      date('${BASE_DAY}', '+' || ((n - 1) % 180) || ' days') || 'T18:00:00.000Z' FROM seq`);
  await insertRange(db, learners * 180, `INSERT INTO attendance_records (id, household_id, learner_id, academic_year_id, attended_on, minutes, note, recorded_by_adult_id, created_at)
    SELECT printf('attendance-%07d', n),
      printf('family-%03d', ${familyForLearner('CAST((n - 1) / 180 AS INTEGER) + 1')}),
      printf('learner-%04d', CAST((n - 1) / 180 AS INTEGER) + 1),
      printf('year-%03d', ${familyForLearner('CAST((n - 1) / 180 AS INTEGER) + 1')}),
      date('${BASE_DAY}', '+' || ((n - 1) % 180) || ' days'), 180, 'Synthetic attendance',
      printf('adult-%04d', ${ownerForFamily(familyForLearner('CAST((n - 1) / 180 AS INTEGER) + 1'))}), '${STAMP}' FROM seq`);

  await insertRange(db, learners * 30, `INSERT INTO evidence_metadata (id, household_id, learner_id, work_item_id, evidence_kind, label, reference, submitted_by_adult_id, created_at)
    SELECT printf('evidence-%06d', n),
      printf('family-%03d', ${familyForLearner('CAST((n - 1) / 30 AS INTEGER) + 1')}),
      printf('learner-%04d', CAST((n - 1) / 30 AS INTEGER) + 1),
      printf('work-%07d', (CAST((n - 1) / 30 AS INTEGER) * 180) + ((n - 1) % 30) + 1),
      'text', 'Synthetic portfolio evidence', 'Synthetic evidence reference',
      printf('adult-%04d', ${ownerForFamily(familyForLearner('CAST((n - 1) / 30 AS INTEGER) + 1'))}), '${STAMP}' FROM seq`);
  await insertRange(db, learners * 30, `INSERT INTO adult_reviews (id, household_id, evidence_id, reviewer_adult_id, decision, feedback, created_at)
    SELECT printf('review-%06d', n),
      printf('family-%03d', ${familyForLearner('CAST((n - 1) / 30 AS INTEGER) + 1')}),
      printf('evidence-%06d', n),
      printf('adult-%04d', ${ownerForFamily(familyForLearner('CAST((n - 1) / 30 AS INTEGER) + 1'))}),
      'accepted', 'Synthetic adult review', '${STAMP}' FROM seq`);

  await insertRange(db, classes * 12, `INSERT INTO class_assignments (id, organization_id, class_id, title, instructions, due_on, assigned_by_adult_id, created_at)
    SELECT printf('assignment-%03d-%02d', CAST((n - 1) / 12 AS INTEGER) + 1, ((n - 1) % 12) + 1),
      'coop-001', printf('class-%03d', CAST((n - 1) / 12 AS INTEGER) + 1),
      printf('Synthetic Assignment %d', ((n - 1) % 12) + 1), 'Synthetic class work',
      date('${BASE_DAY}', '+' || (((n - 1) % 12) * 14) || ' days'), 'adult-0001', '${STAMP}' FROM seq`);
  await insertRange(db, learners * 24, `INSERT INTO class_submissions (id, assignment_id, class_id, learner_id, enrollment_id, result, submitted_at)
    SELECT printf('submission-%07d', n),
      printf('assignment-%03d-%02d',
        ((CAST((n - 1) / 24 AS INTEGER) + CAST(((n - 1) % 24) / 12 AS INTEGER)) % ${classes}) + 1,
        ((n - 1) % 12) + 1),
      printf('class-%03d', ((CAST((n - 1) / 24 AS INTEGER) + CAST(((n - 1) % 24) / 12 AS INTEGER)) % ${classes}) + 1),
      printf('learner-%04d', CAST((n - 1) / 24 AS INTEGER) + 1),
      printf('enroll-%06d', (CAST((n - 1) / 24 AS INTEGER) * 2) + CAST(((n - 1) % 24) / 12 AS INTEGER) + 1),
      'Synthetic class result', '${STAMP}' FROM seq`);

  const receipts = families * 1885 + classes * 13 + 1;
  await insertRange(db, receipts, `INSERT INTO sync_operations (operation_id, fingerprint, claim_token, response_json, created_at)
    SELECT printf('op-%08d', n), printf('fingerprint-%08d', n), printf('claim-%08d', n), '{}', '${STAMP}' FROM seq`);

  return { learners, classes, receipts };
}

async function queryEvidence(db) {
  const today = await db.prepare("SELECT id FROM work_items WHERE household_id = ? AND due_on = ? AND status != 'completed' ORDER BY learner_id, id")
    .bind('family-001', BASE_DAY).all();
  const weekly = await db.prepare("SELECT learner_id, occurred_at FROM work_logs WHERE household_id = ? AND occurred_at >= ? AND occurred_at < ? ORDER BY occurred_at, learner_id")
    .bind('family-001', `${BASE_DAY}T00:00:00.000Z`, '2026-08-08T00:00:00.000Z').all();
  const roster = await db.prepare("SELECT learner_id FROM class_enrollments WHERE class_id = ? AND status = 'active' ORDER BY learner_id")
    .bind('class-001').all();
  const attendance = await db.prepare("SELECT learner_id, attended_on, minutes FROM attendance_records WHERE household_id = ? AND attended_on BETWEEN ? AND ? ORDER BY attended_on, learner_id")
    .bind('family-001', '2026-08-01', '2027-06-30').all();

  const plans = {};
  for (const [name, sql] of Object.entries({
    today: "SELECT id FROM work_items WHERE household_id = 'family-001' AND due_on = '2026-08-01' AND status != 'completed'",
    weekly: "SELECT learner_id FROM work_logs WHERE household_id = 'family-001' AND occurred_at >= '2026-08-01T00:00:00.000Z' AND occurred_at < '2026-08-08T00:00:00.000Z'",
    roster: "SELECT learner_id FROM class_enrollments WHERE class_id = 'class-001' AND status = 'active'",
    attendance: "SELECT learner_id FROM attendance_records WHERE household_id = 'family-001' AND attended_on BETWEEN '2026-08-01' AND '2027-06-30'"
  })) {
    const explained = await db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();
    plans[name] = explained.results.map((row) => row.detail);
  }

  return {
    returned: { today: today.results.length, weekly: weekly.results.length, roster: roster.results.length, annualAttendance: attendance.results.length },
    rowsRead: {
      today: today.meta?.rows_read ?? null,
      weekly: weekly.meta?.rows_read ?? null,
      roster: roster.meta?.rows_read ?? null,
      annualAttendance: attendance.meta?.rows_read ?? null
    },
    plans
  };
}

async function runScenario(families) {
  const persist = await mkdtemp(join(tmpdir(), `learning-harbor-scale-${families}-`));
  const mf = new Miniflare({
    name: `learning-harbor-scale-${families}`,
    script: 'export default { fetch() { return new Response("scale-proof"); } }',
    modules: true,
    compatibilityDate: '2026-07-29',
    d1Databases: { DB: `learning-harbor-scale-${families}` },
    d1Persist: persist
  });
  let disposed = false;
  try {
    const db = await mf.getD1Database('DB');
    await applyMigration(db);
    const shape = await seed(db, families);
    const counts = {};
    for (const table of ['adult_accounts', 'households', 'household_adults', 'learners', 'organization_adults', 'academic_years', 'courses', 'class_sections', 'class_enrollments', 'work_items', 'work_logs', 'attendance_records', 'evidence_metadata', 'adult_reviews', 'class_assignments', 'class_submissions', 'sync_operations', 'record_pack_profiles']) {
      counts[table] = Number(await db.prepare(`SELECT count(*) AS rows FROM ${table}`).first('rows'));
    }
    const queries = await queryEvidence(db);
    const totalRows = Object.values(counts).reduce((sum, value) => sum + value, 0) + 1; // one organization row
    assert(counts.households === families, `${families}: household count`);
    assert(counts.learners === shape.learners, `${families}: learner count`);
    assert(counts.work_items === shape.learners * 180, `${families}: work-item count`);
    assert(counts.attendance_records === shape.learners * 180, `${families}: attendance count`);
    assert(counts.class_enrollments === shape.learners * 2, `${families}: enrollment count`);
    assert(counts.sync_operations === shape.receipts, `${families}: receipt count`);
    assert(queries.returned.today === 3, `${families}: household Today should return three learner items`);
    assert(queries.returned.weekly === 21, `${families}: weekly household review should return 21 work-log rows`);
    assert(queries.returned.annualAttendance === 540, `${families}: annual family attendance should return 540 rows`);
    for (const [name, details] of Object.entries(queries.plans)) {
      assert(details.some((detail) => /USING (?:COVERING )?INDEX/i.test(String(detail))), `${families}: ${name} query should use an index`);
    }

    await mf.dispose();
    disposed = true;
    const persistedBytes = await directoryBytes(persist);
    return { families, learners: shape.learners, classes: shape.classes, totalRows, persistedBytes, counts, queries };
  } finally {
    if (!disposed) await mf.dispose().catch(() => {});
    await rm(persist, { recursive: true, force: true });
  }
}

const scenarios = [];
for (const families of SCALES) scenarios.push(await runScenario(families));

const hundred = scenarios.find((scenario) => scenario.families === 100);
assert(hundred && hundred.persistedBytes < 250 * 1024 * 1024, '100-family local D1 fixture must stay below the 250 MB working target');

console.log(JSON.stringify({
  proof: 'learning-harbor-local-d1-capacity-v1',
  note: 'Local Miniflare/D1 fixture evidence; not production Cloudflare usage or billing telemetry.',
  scenarios
}, null, 2));