import { Miniflare } from 'miniflare';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scales = [25, 50, 100];
const timestamp = '2026-10-28T12:00:00.000Z';

function assert(value, message) {
  if (!value) throw new Error(`Capacity-scale proof failed: ${message}`);
}

async function applyMigration(db) {
  const migration = await readFile('cloudflare-proof/migrations/0001_household_first.sql', 'utf8');
  for (const sql of migration.replace(/^--.*$/gm, '').split(';').map((part) => part.trim()).filter(Boolean)) {
    await db.prepare(sql).run();
  }
}

async function insertRanges(db, total, buildSql) {
  for (let start = 1; start <= total; start += 1000) {
    const end = Math.min(total, start + 999);
    await db.prepare(buildSql()).bind(start, end).run();
  }
}

const seq = `WITH RECURSIVE seq(n) AS (SELECT ? UNION ALL SELECT n + 1 FROM seq WHERE n < ?)`;
const familyForLearner = `CAST((n - 1) / 3 AS INTEGER) + 1`;

async function directoryBytes(path) {
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) total += await directoryBytes(full);
    else if (entry.isFile()) total += (await stat(full)).size;
  }
  return total;
}

async function seedScenario(db, families) {
  const learners = families * 3;
  const classes = Math.ceil(families * 0.3);

  await insertRanges(db, families * 2, () => `${seq}
    INSERT INTO adult_accounts (id, created_at)
    SELECT printf('adult-%04d', n), '${timestamp}' FROM seq`);
  await insertRanges(db, families, () => `${seq}
    INSERT INTO households (id, name, created_at)
    SELECT printf('family-%03d', n), printf('Synthetic Family %03d', n), '${timestamp}' FROM seq`);
  await insertRanges(db, families * 2, () => `${seq}
    INSERT INTO household_adults (household_id, adult_id, role, created_at)
    SELECT printf('family-%03d', CAST((n - 1) / 2 AS INTEGER) + 1), printf('adult-%04d', n),
      CASE WHEN ((n - 1) % 2) = 0 THEN 'owner' ELSE 'adult' END, '${timestamp}' FROM seq`);
  await insertRanges(db, learners, () => `${seq}
    INSERT INTO learners (id, household_id, preferred_name, grade_band, status, created_at, updated_at)
    SELECT printf('learner-%04d', n), printf('family-%03d', ${familyForLearner}), printf('Learner %04d', n),
      '4-6', 'active', '${timestamp}', '${timestamp}' FROM seq`);

  await db.prepare("INSERT INTO organizations (id, name, created_at) VALUES ('coop-001', 'Synthetic Community Co-op', ?)").bind(timestamp).run();
  await insertRanges(db, families * 2, () => `${seq}
    INSERT INTO organization_adults (organization_id, adult_id, role, created_at)
    SELECT 'coop-001', printf('adult-%04d', n), CASE WHEN n = 1 THEN 'admin' ELSE 'member' END, '${timestamp}' FROM seq`);
  await insertRanges(db, families, () => `${seq}
    INSERT INTO academic_years (id, household_id, label, starts_on, ends_on, instructional_day_target, record_pack, created_at)
    SELECT printf('year-%03d', n), printf('family-%03d', n), '2026-27', '2026-08-01', '2027-06-30', 180, 'SC-home-study', '${timestamp}' FROM seq`);
  await insertRanges(db, families, () => `${seq}
    INSERT INTO record_pack_profiles (id, household_id, jurisdiction, instructional_day_target, tracks_subject_activities, tracks_portfolio_references, tracks_attendance, tracks_individual_progress, created_at)
    SELECT printf('pack-%03d', n), printf('family-%03d', n), 'SC', 180, 1, 1, 1, 1, '${timestamp}' FROM seq`);

  await insertRanges(db, learners * 6, () => `${seq}
    INSERT INTO courses (id, household_id, academic_year_id, learner_id, name, subject, created_at)
    SELECT printf('course-%06d', n),
      printf('family-%03d', CAST((CAST((n - 1) / 6 AS INTEGER)) / 3 AS INTEGER) + 1),
      printf('year-%03d', CAST((CAST((n - 1) / 6 AS INTEGER)) / 3 AS INTEGER) + 1),
      printf('learner-%04d', CAST((n - 1) / 6 AS INTEGER) + 1),
      printf('Course %d', ((n - 1) % 6) + 1), printf('Subject %d', ((n - 1) % 6) + 1), '${timestamp}' FROM seq`);

  await insertRanges(db, classes, () => `${seq}
    INSERT INTO class_sections (id, organization_id, name, created_at)
    SELECT printf('class-%03d', n), 'coop-001', printf('Synthetic Class %03d', n), '${timestamp}' FROM seq`);

  await insertRanges(db, learners * 2, () => `${seq}
    INSERT INTO class_enrollments (id, class_id, learner_id, household_id, granted_by_adult_id, status, created_at)
    SELECT printf('enroll-%06d', n),
      printf('class-%03d', ((CAST((n - 1) / 2 AS INTEGER) + ((n - 1) % 2)) % ${classes}) + 1),
      printf('learner-%04d', CAST((n - 1) / 2 AS INTEGER) + 1),
      printf('family-%03d', CAST((CAST((n - 1) / 2 AS INTEGER)) / 3 AS INTEGER) + 1),
      printf('adult-%04d', (CAST((CAST((n - 1) / 2 AS INTEGER)) / 3 AS INTEGER) * 2) + 1),
      'active', '${timestamp}' FROM seq`);

  await insertRanges(db, learners * 180, () => `${seq}
    INSERT INTO work_items (id, household_id, learner_id, title, instructions, due_on, status, version, assigned_by_adult_id, created_at, updated_at)
    SELECT printf('work-%07d', n),
      printf('family-%03d', CAST((CAST((n - 1) / 180 AS INTEGER)) / 3 AS INTEGER) + 1),
      printf('learner-%04d', CAST((n - 1) / 180 AS INTEGER) + 1),
      printf('Synthetic Work %07d', n), 'Synthetic scale fixture', printf('2026-%02d-%02d', 8 + (CAST(((n - 1) % 180) / 30 AS INTEGER) % 6), ((n - 1) % 28) + 1),
      'completed', 1,
      printf('adult-%04d', (CAST((CAST((n - 1) / 180 AS INTEGER)) / 3 AS INTEGER) * 2) + 1), '${timestamp}', '${timestamp}' FROM seq`);

  await insertRanges(db, learners * 180, () => `${seq}
    INSERT INTO work_logs (id, household_id, work_item_id, learner_id, status, note, recorded_by_adult_id, occurred_at)
    SELECT printf('log-%07d', n),
      printf('family-%03d', CAST((CAST((n - 1) / 180 AS INTEGER)) / 3 AS INTEGER) + 1),
      printf('work-%07d', n), printf('learner-%04d', CAST((n - 1) / 180 AS INTEGER) + 1),
      'completed', 'Synthetic completion',
      printf('adult-%04d', (CAST((CAST((n - 1) / 180 AS INTEGER)) / 3 AS INTEGER) * 2) + 1), '${timestamp}' FROM seq`);

  await insertRanges(db, learners * 180, () => `${seq}
    INSERT INTO attendance_records (id, household_id, learner_id, attended_on, minutes, note, recorded_by_adult_id, created_at)
    SELECT printf('attendance-%07d', n),
      printf('family-%03d', CAST((CAST((n - 1) / 180 AS INTEGER)) / 3 AS INTEGER) + 1),
      printf('learner-%04d', CAST((n - 1) / 180 AS INTEGER) + 1),
      printf('2026-%02d-%02d', 8 + (CAST(((n - 1) % 180) / 30 AS INTEGER) % 6), ((n - 1) % 28) + 1),
      180, 'Synthetic attendance',
      printf('adult-%04d', (CAST((CAST((n - 1) / 180 AS INTEGER)) / 3 AS INTEGER) * 2) + 1), '${timestamp}' FROM seq`);

  await insertRanges(db, learners * 30, () => `${seq}
    INSERT INTO evidence_metadata (id, household_id, learner_id, work_item_id, evidence_kind, label, reference, submitted_by_adult_id, created_at)
    SELECT printf('evidence-%06d', n),
      printf('family-%03d', CAST((CAST((n - 1) / 30 AS INTEGER)) / 3 AS INTEGER) + 1),
      printf('learner-%04d', CAST((n - 1) / 30 AS INTEGER) + 1),
      printf('work-%07d', (CAST((n - 1) / 30 AS INTEGER) * 180) + ((n - 1) % 30) + 1),
      'text', 'Synthetic portfolio evidence', 'Synthetic evidence reference',
      printf('adult-%04d', (CAST((CAST((n - 1) / 30 AS INTEGER)) / 3 AS INTEGER) * 2) + 1), '${timestamp}' FROM seq`);

  await insertRanges(db, learners * 30, () => `${seq}
    INSERT INTO adult_reviews (id, household_id, evidence_id, reviewer_adult_id, decision, feedback, created_at)
    SELECT printf('review-%06d', n),
      printf('family-%03d', CAST((CAST((n - 1) / 30 AS INTEGER)) / 3 AS INTEGER) + 1),
      printf('evidence-%06d', n),
      printf('adult-%04d', (CAST((CAST((n - 1) / 30 AS INTEGER)) / 3 AS INTEGER) * 2) + 1),
      'accepted', 'Synthetic adult review', '${timestamp}' FROM seq`);

  await insertRanges(db, classes * 12, () => `${seq}
    INSERT INTO class_assignments (id, organization_id, class_id, title, instructions, due_on, assigned_by_adult_id, created_at)
    SELECT printf('assignment-%03d-%02d', CAST((n - 1) / 12 AS INTEGER) + 1, ((n - 1) % 12) + 1),
      'coop-001', printf('class-%03d', CAST((n - 1) / 12 AS INTEGER) + 1),
      printf('Synthetic Assignment %d', ((n - 1) % 12) + 1), 'Synthetic class work',
      printf('2026-%02d-15', 1 + ((n - 1) % 12)), 'adult-0001', '${timestamp}' FROM seq`);

  await insertRanges(db, learners * 24, () => `${seq}
    INSERT INTO class_submissions (id, assignment_id, class_id, learner_id, enrollment_id, result, submitted_at)
    SELECT printf('submission-%07d', n),
      printf('assignment-%03d-%02d',
        ((CAST((n - 1) / 24 AS INTEGER) + CAST(((n - 1) % 24) / 12 AS INTEGER)) % ${classes}) + 1,
        ((n - 1) % 12) + 1),
      printf('class-%03d', ((CAST((n - 1) / 24 AS INTEGER) + CAST(((n - 1) % 24) / 12 AS INTEGER)) % ${classes}) + 1),
      printf('learner-%04d', CAST((n - 1) / 24 AS INTEGER) + 1),
      printf('enroll-%06d', (CAST((n - 1) / 24 AS INTEGER) * 2) + CAST(((n - 1) % 24) / 12 AS INTEGER) + 1),
      'Synthetic class result', '${timestamp}' FROM seq`);

  const receipts = families * 1885 + classes * 13 + 1;
  await insertRanges(db, receipts, () => `${seq}
    INSERT INTO sync_operations (operation_id, fingerprint, claim_token, response_json, created_at)
    SELECT printf('op-%08d', n), printf('fingerprint-%08d', n), printf('claim-%08d', n), '{}', '${timestamp}' FROM seq`);

  return { learners, classes, receipts };
}

async function queryEvidence(db) {
  const today = await db.prepare("SELECT id FROM work_items WHERE household_id = ? AND due_on = ? AND status != 'completed' ORDER BY learner_id, id")
    .bind('family-001', '2026-08-01').all();
  const roster = await db.prepare("SELECT learner_id FROM class_enrollments WHERE class_id = ? AND status = 'active' ORDER BY learner_id")
    .bind('class-001').all();
  const attendance = await db.prepare("SELECT learner_id, attended_on, minutes FROM attendance_records WHERE household_id = ? AND attended_on BETWEEN ? AND ? ORDER BY attended_on, learner_id")
    .bind('family-001', '2026-08-01', '2027-06-30').all();
  const todayPlan = await db.prepare("EXPLAIN QUERY PLAN SELECT id FROM work_items WHERE household_id = 'family-001' AND due_on = '2026-08-01' AND status != 'completed'").all();
  const rosterPlan = await db.prepare("EXPLAIN QUERY PLAN SELECT learner_id FROM class_enrollments WHERE class_id = 'class-001' AND status = 'active'").all();
  const attendancePlan = await db.prepare("EXPLAIN QUERY PLAN SELECT learner_id FROM attendance_records WHERE household_id = 'family-001' AND attended_on BETWEEN '2026-08-01' AND '2027-06-30'").all();
  return {
    rows: {
      todayReturned: today.results.length,
      rosterReturned: roster.results.length,
      annualAttendanceReturned: attendance.results.length
    },
    meta: {
      todayRowsRead: today.meta?.rows_read ?? null,
      rosterRowsRead: roster.meta?.rows_read ?? null,
      annualAttendanceRowsRead: attendance.meta?.rows_read ?? null
    },
    plans: {
      today: todayPlan.results.map((row) => row.detail),
      roster: rosterPlan.results.map((row) => row.detail),
      attendance: attendancePlan.results.map((row) => row.detail)
    }
  };
}

async function runScenario(families) {
  const persist = await mkdtemp(join(tmpdir(), `learning-harbor-scale-${families}-`));
  const miniflare = new Miniflare({
    name: `learning-harbor-scale-${families}`,
    script: 'export default { fetch() { return new Response("scale-proof"); } }',
    modules: true,
    compatibilityDate: '2026-07-29',
    d1Databases: { DB: `learning-harbor-scale-${families}` },
    d1Persist: persist
  });
  try {
    const db = await miniflare.getD1Database('DB');
    await applyMigration(db);
    const shape = await seedScenario(db, families);
    const counts = {};
    for (const table of ['households', 'learners', 'class_enrollments', 'work_items', 'work_logs', 'attendance_records', 'evidence_metadata', 'adult_reviews', 'class_submissions', 'sync_operations']) {
      counts[table] = Number(await db.prepare(`SELECT count(*) AS rows FROM ${table}`).first('rows'));
    }
    const query = await queryEvidence(db);
    const bytes = await directoryBytes(persist);
    assert(counts.households === families, `${families}: household count`);
    assert(counts.learners === families * 3, `${families}: learner count`);
    assert(counts.work_items === families * 3 * 180, `${families}: work item count`);
    assert(counts.sync_operations === shape.receipts, `${families}: receipt count`);
    assert(query.plans.today.some((detail) => String(detail).includes('work_items_by_household_day')), `${families}: Today query uses household/day index`);
    assert(query.plans.roster.some((detail) => String(detail).includes('enrollments_by_class')), `${families}: roster query uses class index`);
    assert(query.plans.attendance.some((detail) => String(detail).includes('attendance_by_household_date')), `${families}: attendance query uses household/date index`);
    return { families, ...shape, counts, persistedBytes: bytes, persistedMiB: Number((bytes / 1024 / 1024).toFixed(2)), query };
  } finally {
    await miniflare.dispose();
    await rm(persist, { recursive: true, force: true });
  }
}

const results = [];
for (const families of scales) {
  results.push(await runScenario(families));
}
console.log(JSON.stringify({ kind: 'learning-harbor-local-d1-scale-proof', results }, null, 2));
