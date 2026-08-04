import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const checks = [
  ['privacy-minimization', true], ['family-rls', true], ['audit-events', true],
  ['encrypted-export', true], ['restore-preview', true], ['responsive-browser-suite', true],
  ['accessibility-review', false], ['hosted-rate-limit-observation', false],
  ['provider-backup-restore', false], ['bounded-family-pilot', false], ['owner-cutover-approval', false]
].map(([id, passed]) => ({ id, passed, blocking: !passed }));
const report = {
  schema: 'beaufort-learning-harbor-production-readiness-v1',
  release: '11.0.0-rc.1',
  generatedFor: 'owner review',
  automatedPromotionAllowed: false,
  productionDataEnabled: false,
  decision: 'not-approved',
  ready: checks.every((check) => check.passed),
  checks,
  requiredOwnerAction: 'Record an explicit cutover decision only after a bounded hosted pilot and independent privacy/security review.'
};
await mkdir(path.join(process.cwd(), 'artifacts/rc1'), { recursive: true });
await writeFile(path.join(process.cwd(), 'artifacts/rc1/production-readiness.json'), JSON.stringify(report, null, 2));
if (report.ready || report.decision !== 'not-approved') throw new Error('rc.1 must remain blocked from production promotion');
console.log(`rc.1 readiness remains owner-blocked with ${checks.filter((check) => check.blocking).length} open gates`);
