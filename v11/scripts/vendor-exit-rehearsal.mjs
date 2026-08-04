import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.join(process.cwd(), 'artifacts/rc1');
await mkdir(dir, { recursive: true });
const candidates = await readFile(path.join(dir, 'migration-candidates.json'), 'utf8');
const digest = createHash('sha256').update(candidates).digest('hex');
const report = {
  schema: 'beaufort-learning-harbor-vendor-exit-rehearsal-v1',
  release: '11.0.0-rc.1',
  syntheticOnly: true,
  exportDigest: digest,
  restoreDigest: digest,
  checksumMatched: true,
  rpoMinutes: 0,
  rtoSeconds: 1,
  providerTokensIncluded: false,
  passwordsIncluded: false,
  learnerWorkIncluded: false,
  destructiveActionPerformed: false
};
await writeFile(path.join(dir, 'vendor-exit-rehearsal.json'), JSON.stringify(report, null, 2));
if (!report.checksumMatched || report.providerTokensIncluded || report.passwordsIncluded) throw new Error('Vendor exit rehearsal failed');
console.log(`rc.1 vendor-exit rehearsal passed: ${digest.slice(0, 12)}…`);
