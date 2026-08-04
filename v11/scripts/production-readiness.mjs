import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputDirectory = path.join(root, 'test-results/rc1');
const migrationPath = path.join(outputDirectory, 'migration-rehearsal-report.json');
const outputPath = path.join(outputDirectory, 'production-readiness-report.json');
const migration = JSON.parse(await readFile(migrationPath, 'utf8'));

if (migration.release !== '11.0.0-rc.1' || migration.syntheticOnly !== true || migration.dryRunWrites !== 0) {
  throw new Error('Production readiness requires the validated synthetic rc.1 migration report.');
}
if (migration.safeguards?.liveMigrationEnabled !== false || migration.safeguards?.productionCutover !== false) {
  throw new Error('The rc.1 rehearsal must keep live migration and production cutover disabled.');
}

const report = {
  schema: 'beaufort-learning-harbor-rc1-production-readiness-report-v1',
  release: '11.0.0-rc.1',
  evaluatedAt: new Date().toISOString(),
  effectiveDecision: 'not-ready',
  productionReady: false,
  localSyntheticPilotReady: true,
  automatedEvidence: [
    { id: 'strict-migration-plan', passed: true, evidence: 'Synthetic v10.43 fixture produced a deterministic zero-write plan.' },
    { id: 'authority-boundaries', passed: migration.counts.adultReviewRequired > 0, evidence: 'Legacy completion and accepted proof are routed to adult re-review.' },
    { id: 'rollback-contract', passed: migration.safeguards.rollbackCheckpointRequired === true, evidence: 'Controlled apply requires an isolated rollback checkpoint.' },
    { id: 'conflict-contract', passed: migration.safeguards.silentConflictOverwrite === false, evidence: 'Conflicts are visible and never silently overwritten.' }
  ],
  blockedProviderChecks: [
    'Non-production Supabase project has not been linked and migration 009 has not been remotely verified.',
    'Protected Cloudflare v11-preview environment has not been owner-authorized and deployed.',
    'Production SMTP, abuse controls, rate limits, monitoring, and alert routing have not been verified.',
    'Hosted backup, restore, outage, and vendor-exit exercises have not been performed against provider resources.'
  ],
  ownerApprovalsRequired: [
    'Privacy policy, terms, parental consent, retention, export, and deletion approval.',
    'Security and authorization approval for a bounded real-family pilot.',
    'Incident owner, support owner, rollback authority, and production hostname approval.',
    'Written production cutover decision after pilot findings and residual defects are closed.'
  ],
  residualRisks: [
    'Synthetic rehearsal evidence does not prove real-family migration compatibility.',
    'Provider quotas, delivery behavior, regional settings, and operational support remain unverified.',
    'v10.43 remains the stable fallback and no automatic cutover is permitted.'
  ],
  evidenceDigests: {
    source: migration.sourceDigest,
    plan: migration.planDigest
  },
  exclusions: [
    'learner names and work',
    'credentials and authentication state',
    'provider configuration values',
    'raw error text and queue payloads'
  ]
};

if (!report.automatedEvidence.every((item) => item.passed)) throw new Error('One or more rc.1 automated readiness gates failed.');
if (report.productionReady !== false || report.effectiveDecision !== 'not-ready') throw new Error('CI must never declare production readiness.');

const serialized = JSON.stringify(report);
for (const forbidden of ['Synthetic Learner', 'Synthetic Harbor Household', 'sb_secret_', 'service_role', 'access_token']) {
  if (serialized.includes(forbidden)) throw new Error(`Readiness report contains forbidden material: ${forbidden}`);
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log('rc.1 readiness report passed: local synthetic evidence complete, production decision remains not-ready');
