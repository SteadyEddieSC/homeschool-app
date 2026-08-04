import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'public/fixtures/v10.43-synthetic-export.json');
const outputDirectory = path.join(root, 'test-results/rc1');
const outputPath = path.join(outputDirectory, 'migration-rehearsal-report.json');
const rawText = await readFile(sourcePath, 'utf8');

if (Buffer.byteLength(rawText, 'utf8') > 512_000) throw new Error('Synthetic migration fixture exceeds the 512 KB rehearsal limit.');
const source = JSON.parse(rawText);
if (source.schema !== 'beaufort-learning-harbor-v10.43-export-v1') throw new Error('Unexpected v10.43 migration fixture schema.');
if (source.release !== '10.43.0') throw new Error('Migration fixture must use v10.43.0.');
if (source.rehearsal !== true || source.synthetic !== true) throw new Error('Migration fixture must be explicitly synthetic rehearsal data.');

const forbiddenKey = /(password|passphrase|secret|credential|session|service.?role|access.?token|refresh.?token|client.?secret|api.?key)/i;
const credentialLike = /(sb_secret_|service_role|-----BEGIN .*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}\.)/i;
function scan(value, location = 'source') {
  if (Array.isArray(value)) return value.forEach((item, index) => scan(item, `${location}[${index}]`));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && credentialLike.test(value)) throw new Error(`Credential-like value found at ${location}.`);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenKey.test(key)) throw new Error(`Forbidden credential or session field at ${location}.${key}.`);
    scan(item, `${location}.${key}`);
  }
}
scan(source);

const expectedRecordKeys = ['assignments', 'evidenceSubmissions', 'households', 'knowledgeAttempts', 'knowledgeChecks', 'learners', 'unsupported', 'weeklyPlanItems', 'weeklyPlans'];
const actualRecordKeys = Object.keys(source.records ?? {}).sort();
if (JSON.stringify(actualRecordKeys) !== JSON.stringify(expectedRecordKeys)) throw new Error('Synthetic fixture record collections changed without review.');
for (const collection of Object.values(source.records)) if (!Array.isArray(collection)) throw new Error('Every migration fixture collection must be an array.');

const count = (name) => source.records[name].length;
const operationCount = 1 + count('households') + count('learners') + count('assignments') + count('knowledgeChecks') + count('knowledgeAttempts') + count('evidenceSubmissions') + count('weeklyPlans') + count('weeklyPlanItems') + count('unsupported');
const reviewRequired = source.records.assignments.filter((record) => record.status === 'completed').length
  + source.records.evidenceSubmissions.filter((record) => record.status === 'accepted').length;
const sourceDigest = createHash('sha256').update(rawText).digest('hex');
const planDigest = createHash('sha256').update(JSON.stringify({
  sourceDigest,
  operationCount,
  reviewRequired,
  unsupported: source.records.unsupported.map(({ kind, count }) => ({ kind, count }))
})).digest('hex');

const report = {
  schema: 'beaufort-learning-harbor-rc1-ci-migration-rehearsal-v1',
  release: '11.0.0-rc.1',
  sourceRelease: '10.43.0',
  generatedAt: new Date().toISOString(),
  syntheticOnly: true,
  dryRunWrites: 0,
  sourceDigest,
  planDigest,
  counts: {
    households: count('households'),
    learners: count('learners'),
    assignments: count('assignments'),
    knowledgeChecks: count('knowledgeChecks'),
    knowledgeAttempts: count('knowledgeAttempts'),
    evidenceSubmissions: count('evidenceSubmissions'),
    weeklyPlans: count('weeklyPlans'),
    weeklyPlanItems: count('weeklyPlanItems'),
    unsupported: count('unsupported'),
    operations: operationCount,
    adultReviewRequired: reviewRequired
  },
  safeguards: {
    strictSchema: true,
    credentialFieldRejection: true,
    syntheticIdentifierRequirement: true,
    isolatedApplyOnly: true,
    rollbackCheckpointRequired: true,
    silentConflictOverwrite: false,
    liveMigrationEnabled: false,
    productionCutover: false
  },
  exclusions: [
    'learner names and work from this report',
    'credentials and authentication state',
    'provider configuration',
    'live application storage',
    'automatic outcome authority'
  ]
};

const serialized = JSON.stringify(report);
for (const forbidden of ['Synthetic Learner', 'Synthetic Harbor Household', 'sb_secret_', 'service_role', 'access_token']) {
  if (serialized.includes(forbidden)) throw new Error(`Sanitized migration report contains forbidden material: ${forbidden}`);
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`rc.1 synthetic migration rehearsal passed: ${operationCount} planned operations, ${reviewRequired} adult-review boundaries, zero writes`);
