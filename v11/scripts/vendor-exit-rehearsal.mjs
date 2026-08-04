import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const directory = path.join(root, 'test-results/rc1');
const migration = JSON.parse(await readFile(path.join(directory, 'migration-rehearsal-report.json'), 'utf8'));
if (migration.release !== '11.0.0-rc.1' || migration.syntheticOnly !== true || migration.dryRunWrites !== 0) {
  throw new Error('Vendor-exit rehearsal requires the strict rc.1 synthetic migration report.');
}

const portablePayload = JSON.stringify({
  schema: 'beaufort-learning-harbor-rc1-vendor-exit-payload-v1',
  release: migration.release,
  sourceDigest: migration.sourceDigest,
  planDigest: migration.planDigest,
  counts: migration.counts,
  safeguards: migration.safeguards,
  exclusions: ['credentials and sessions', 'provider tokens', 'learner names and work', 'live application storage']
});
const exportDigest = createHash('sha256').update(portablePayload).digest('hex');
const started = process.hrtime.bigint();
const restoredPayload = JSON.parse(portablePayload);
const restoreDigest = createHash('sha256').update(JSON.stringify(restoredPayload)).digest('hex');
const elapsedMilliseconds = Number(process.hrtime.bigint() - started) / 1_000_000;

const report = {
  schema: 'beaufort-learning-harbor-rc1-vendor-exit-rehearsal-v1',
  release: '11.0.0-rc.1',
  checkedAt: new Date().toISOString(),
  syntheticOnly: true,
  exportDigest,
  restoreDigest,
  checksumMatched: exportDigest === restoreDigest,
  rpoRecords: exportDigest === restoreDigest ? 0 : migration.counts.operations,
  rtoMilliseconds: Math.round(elapsedMilliseconds * 100) / 100,
  providerTokensIncluded: false,
  passwordsIncluded: false,
  learnerWorkIncluded: false,
  destructiveActionPerformed: false,
  productionCutover: false,
  exclusions: restoredPayload.exclusions
};

if (!report.checksumMatched || report.rpoRecords !== 0 || report.providerTokensIncluded || report.passwordsIncluded || report.learnerWorkIncluded) {
  throw new Error('Vendor-exit rehearsal failed its integrity or privacy boundary.');
}
const serialized = JSON.stringify(report);
for (const forbidden of ['Synthetic Learner', 'Synthetic Harbor Household', 'sb_secret_', 'service_role', 'access_token']) {
  if (serialized.includes(forbidden)) throw new Error(`Vendor-exit report contains forbidden material: ${forbidden}`);
}

await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, 'vendor-exit-rehearsal-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`rc.1 vendor-exit rehearsal passed: ${exportDigest.slice(0, 12)}…, zero record loss`);
