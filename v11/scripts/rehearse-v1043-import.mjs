import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const fixturePath = path.join(root, 'fixtures/v1043-synthetic-export.json');
const outputDir = path.join(root, 'artifacts/rc1');
const source = JSON.parse(await readFile(fixturePath, 'utf8'));

function stableId(kind, sourceId) {
  return createHash('sha256').update(`blh-v11:${kind}:${sourceId}`).digest('hex').slice(0, 32);
}
function mapping(kind, sourceId) {
  return { sourceType: kind, sourceId, targetId: stableId(kind, sourceId), receiptId: stableId('receipt', `${kind}:${sourceId}`) };
}

const supportedTypes = new Set(['learn', 'practice', 'quiz', 'proof']);
const candidates = {
  households: source.households.map((row) => ({ id: stableId('household', row.id), sourceId: row.id, name: row.name })),
  learners: source.learners.map((row) => ({ id: stableId('learner', row.id), sourceId: row.id, householdSourceId: row.householdId, preferredName: row.preferredName, gradeBand: row.gradeBand, accessMode: 'parent-assisted' })),
  todayItems: source.todayItems.filter((row) => supportedTypes.has(row.activityType)).map((row) => ({ id: stableId('today-item', row.id), sourceId: row.id, learnerSourceId: row.learnerId, title: row.title, activityType: row.activityType, sourceStatus: row.status, importedStatus: 'assigned' }))
};
const blocked = [
  ...source.todayItems.filter((row) => !supportedTypes.has(row.activityType)).map((row) => ({ sourceId: row.id, reason: 'unsupported activity type', action: 'manual review required' })),
  ...source.unsupported.map((row) => ({ sourceId: row.id, reason: `unsupported source record: ${row.type}`, action: 'not imported' }))
];
const mappings = [
  ...source.households.map((row) => mapping('household', row.id)),
  ...source.learners.map((row) => mapping('learner', row.id)),
  ...source.todayItems.filter((row) => supportedTypes.has(row.activityType)).map((row) => mapping('today-item', row.id))
];
const report = {
  schema: 'beaufort-learning-harbor-v11-migration-rehearsal-v1',
  release: '11.0.0-rc.1',
  sourceRelease: source.sourceRelease,
  mode: 'dry-run',
  productionWriteEnabled: false,
  deterministic: true,
  counts: { households: candidates.households.length, learners: candidates.learners.length, todayItems: candidates.todayItems.length, blocked: blocked.length, mappings: mappings.length },
  blocked,
  mappings,
  safeguards: ['synthetic fixture only', 'no learner work content', 'no inferred grades or completion', 'no provider credentials', 'no production writes']
};
const rollback = {
  schema: 'beaufort-learning-harbor-v11-migration-rollback-v1',
  release: '11.0.0-rc.1',
  targetIds: mappings.map((entry) => entry.targetId),
  receiptIds: mappings.map((entry) => entry.receiptId),
  destructiveActionPerformed: false,
  instruction: 'Delete only records carrying these rehearsal receipt IDs in an isolated non-production project.'
};
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'migration-dry-run.json'), JSON.stringify(report, null, 2));
await writeFile(path.join(outputDir, 'migration-candidates.json'), JSON.stringify(candidates, null, 2));
await writeFile(path.join(outputDir, 'migration-rollback.json'), JSON.stringify(rollback, null, 2));
console.log(`rc.1 migration rehearsal passed: ${mappings.length} deterministic mappings, ${blocked.length} blocked records, no writes`);
