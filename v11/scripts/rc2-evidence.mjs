import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const repositoryRoot = path.resolve(root, '..');
const mode = process.argv[2] ?? 'repository';
const currentRelease = '11.0.0-rc.1';
const targetRelease = '11.0.0-rc.2';
const expectedWorker = 'beaufort-learning-harbor-v11-preview';
const expectedMigrationFile = '202608050010_v11_hosted_acl_hardening.sql';
const expectedMigrationMarker = '202608040009';
const expectedAclMarker = '202608050010';
const outputDirectory = path.join(root, 'test-results/rc2');

function assert(condition, message) {
  if (!condition) throw new Error(`RC.2 evidence validation failed: ${message}`);
}

async function readJson(fileName) {
  return JSON.parse(await readFile(path.join(root, fileName), 'utf8'));
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertSanitized(label, value) {
  const text = JSON.stringify(value);
  const forbiddenValuePatterns = [
    { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, label: 'email address' },
    { pattern: /sb_secret_[A-Za-z0-9_-]+/i, label: 'Supabase secret key' },
    { pattern: /\bservice_role\b/i, label: 'service-role credential marker' },
    { pattern: /\b(?:access|refresh|recovery|oauth)[_-]?token\b\s*[:=]\s*["']?[A-Za-z0-9._~-]{12,}/i, label: 'token value' },
    { pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, label: 'JWT-like value' },
    { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: 'private key' }
  ];
  for (const item of forbiddenValuePatterns) {
    assert(!item.pattern.test(text), `${label} contains a forbidden ${item.label}`);
  }

  function walk(node, location = label) {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      const next = `${location}.${key}`;
      if (/(password|secret|token|credential|session|email|account[_-]?id|project[_-]?ref)/i.test(key)) {
        assert(child === null || typeof child === 'boolean', `${next} must contain only a boolean/null presence indicator`);
      }
      walk(child, next);
    }
  }
  walk(value);
}

async function writeReport(fileName, report) {
  assertSanitized(fileName, report);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, fileName), `${JSON.stringify(report, null, 2)}\n`);
}

async function validateRepositoryMode() {
  const pkg = await readJson('package.json');
  assert(pkg.version === currentRelease, 'the package must remain rc.1 until hosted evidence and defect closure exist');
  assert(pkg.scripts?.['rc2:evidence:repository'] === 'node scripts/rc2-evidence.mjs repository', 'repository evidence script is not wired exactly');
  assert(pkg.scripts?.['rc2:evidence:provider'] === 'node scripts/rc2-evidence.mjs provider', 'provider evidence script is not wired exactly');
  assert(String(pkg.scripts?.verify ?? '').includes('npm run rc2:evidence:repository'), 'npm run verify must include the repository RC.2 evidence gate');

  const migrationNames = (await readdir(path.join(root, 'supabase/migrations')))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  assert(migrationNames.at(-1) === expectedMigrationFile, 'migration 010 hosted ACL hardening must be the latest reviewed migration');
  assert(migrationNames.includes('202608040009_v11_migration_rehearsal.sql'), 'migration 009 release-candidate rehearsal must remain present');

  const wrangler = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
  assert(wrangler.includes(`"name": "${expectedWorker}"`), 'Wrangler must target the isolated v11 preview Worker');
  assert(wrangler.includes(`"APP_RELEASE": "${currentRelease}"`), 'Wrangler must remain on rc.1 before the exact RC.2 candidate');
  assert(!wrangler.includes('"name": "beaufort-learning-harbor"'), 'Wrangler must not target the v10 production Worker');

  const deployWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/deploy-v11-preview.yml'), 'utf8');
  assert(deployWorkflow.includes('workflow_dispatch:'), 'preview deployment must remain manual');
  assert(!/\npush:\s*\n/.test(deployWorkflow), 'preview deployment must not run automatically on push');
  assert(deployWorkflow.includes('npm run rc2:evidence:provider'), 'protected deployment must validate and package RC.2 provider evidence');
  assert(deployWorkflow.includes(expectedWorker), 'protected deployment must use the isolated v11 Worker');
  assert(deployWorkflow.includes('migrations 001-010'), 'protected deployment must verify migrations through hosted ACL hardening');

  const plan = await readFile(path.join(repositoryRoot, 'docs/v11/rc2-hosted-pilot-plan.md'), 'utf8');
  for (const marker of ['Gate A — Repository activation readiness', 'Gate B — Owner-created provider activation', 'Gate C — Synthetic hosted pilot and defect closure', 'Gate D — Exact-head RC.2 candidate', '## Stop conditions']) {
    assert(plan.includes(marker), `RC.2 plan is missing ${marker}`);
  }
  const runbook = await readFile(path.join(repositoryRoot, 'docs/v11/hosted-preview-runbook.md'), 'utf8');
  assert(runbook.includes('migrations `001–010`'), 'hosted runbook must cover migrations 001–010');
  assert(runbook.includes(currentRelease), 'hosted runbook must identify the current rc.1 baseline');
  assert(runbook.includes(targetRelease), 'hosted runbook must identify the gated RC.2 target');

  const report = {
    schema: 'beaufort-learning-harbor-rc2-repository-evidence-v1',
    currentRelease,
    targetRelease,
    checkedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || null,
    state: 'repository-structure-ready-provider-blocked',
    gates: {
      A: { structuralReady: true, exactHeadValidationRequired: true },
      B: { complete: false, reason: 'owner-created provider resources and protected evidence are required' },
      C: { complete: false, reason: 'synthetic hosted pilot and defect closure have not been evidenced' },
      D: { complete: false, reason: 'the exact RC.2 candidate cannot be assembled before Gates B and C' }
    },
    evidence: {
      R1: 'current exact-head workflow evidence required',
      R2: 'current exact-head workflow evidence required',
      R3: 'current exact-head workflow evidence required',
      P1: 'blocked-provider',
      P2: 'blocked-provider',
      P3: 'blocked-provider',
      H1: 'blocked-pilot',
      H2: 'blocked-pilot',
      H3: 'blocked-pilot',
      H4: 'blocked-pilot',
      D1: 'blocked-pilot',
      A1: 'owner-status-required',
      G1: 'blocked-until-final-candidate'
    },
    providerActivationObserved: false,
    realFamilyDataAuthorized: false,
    liveMigrationEnabled: false,
    productionDataEnabled: false,
    productionReady: false,
    productionCutoverApproved: false,
    automatedPromotionAllowed: false,
    exclusions: ['private family data', 'credentials and sessions', 'provider account identifiers', 'queue payloads', 'private support content']
  };
  assert(report.gates.B.complete === false && report.gates.C.complete === false && report.gates.D.complete === false, 'repository mode must not claim provider, pilot, or release completion');
  await writeReport('rc2-repository-evidence.json', report);
  console.log('RC.2 repository evidence gate passed: structure is ready, provider and pilot gates remain blocked.');
}

async function validateProviderMode() {
  const doctor = await readJson('pilot-doctor-report.json');
  const remote = await readJson('remote-schema-report.json');
  const health = await readJson('deployment-health.json');
  const config = await readJson('deployment-config.json');
  const receipt = await readJson('deployment-receipt.json');
  for (const [label, value] of Object.entries({ doctor, remote, health, config, receipt })) assertSanitized(label, value);

  assert(doctor.schema === 'beaufort-learning-harbor-hosted-pilot-doctor-v1', 'pilot doctor schema is unexpected');
  assert(doctor.release === currentRelease && doctor.ready === true, 'pilot doctor must be ready for rc.1');
  assert(Array.isArray(doctor.missing) && doctor.missing.length === 0, 'pilot doctor still reports missing provider configuration');
  assert(Array.isArray(doctor.unsafe) && doctor.unsafe.length === 0, 'pilot doctor reports unsafe provider configuration');
  assert(doctor.migrations?.latest === expectedMigrationFile, 'pilot doctor did not verify migration 010');
  assert(doctor.migrations?.releaseCandidate === '202608040009_v11_migration_rehearsal.sql', 'pilot doctor did not preserve migration 009 release-candidate evidence');
  assert(doctor.productionCutoverApproved === false, 'pilot doctor must keep production cutover disabled');
  assert(Object.values(doctor.providerConfiguration ?? {}).every((value) => value === true), 'not every required provider setting is present');
  assert(doctor.hosts?.supabase && doctor.hosts?.preview && doctor.hosts.supabase !== doctor.hosts.preview, 'Supabase and preview hosts must be present and separate');

  assert(remote.schema === 'beaufort-learning-harbor-remote-schema-report-v3', 'remote schema report version is unexpected');
  assert(remote.release === currentRelease && remote.migration === expectedMigrationMarker, 'remote schema is not rc.1 migration 009');
  assert(remote.authenticated === true, 'remote schema verification was not authenticated');
  assert(remote.hostedPilotBaseline?.release === '11.0.0-beta.4' && remote.hostedPilotBaseline?.migration === '202608040008', 'migration 008 hosted baseline is missing');
  assert(remote.hostedPilotBaseline?.productionDataEnabled === false, 'hosted baseline unexpectedly enables production data');
  assert(remote.releaseCandidate?.syntheticMigrationRehearsal === true, 'remote RC.1 rehearsal capability is missing');
  assert(remote.releaseCandidate?.liveMigrationEnabled === false, 'remote schema unexpectedly enables live migration');
  assert(remote.releaseCandidate?.productionDataEnabled === false, 'remote schema unexpectedly enables production data');
  assert(remote.releaseCandidate?.productionCutoverApproved === false, 'remote schema unexpectedly approves cutover');
  assert(remote.releaseCandidate?.ownerApprovalRequired === true, 'remote schema must preserve owner approval');
  assert(remote.aclHardening?.migration === expectedAclMarker, 'remote ACL hardening is not migration 010');
  assert(remote.aclHardening?.anonymousSecurityDefinerExecutable === 0, 'anonymous security-definer RPC execution remains enabled');
  assert(remote.aclHardening?.authenticatedTriggerFunctionsExecutable === 0, 'trigger-only functions remain browser-callable');
  assert(remote.aclHardening?.legacyScoringRpcExecutable === false, 'superseded scoring RPC remains enabled');
  assert(remote.aclHardening?.currentScoringRpcExecutable === true, 'current client-ID-preserving scoring RPC is unavailable');

  assert(health.ok === true && health.release === currentRelease && health.service === expectedWorker, 'deployed health boundary is not the isolated rc.1 preview');
  assert(config.productionDataEnabled === false, 'deployed config unexpectedly enables production data');
  assert(config.learning?.deterministicObjectiveScoring === true && config.learning?.explicitEvidenceReview === true, 'learning authority boundaries are missing');
  assert(config.learning?.automaticGrades === false && config.learning?.automaticMastery === false && config.learning?.automaticAttendance === false && config.learning?.automaticXp === false, 'automatic educational outcomes must remain disabled');
  assert(config.resilience?.orderedMutationQueue === true && config.resilience?.clientRecordIdsPreserved === true && config.resilience?.conflictAwareStudioReconciliation === true && config.resilience?.silentConflictOverwrite === false, 'resilience boundaries are missing');
  assert(config.migration?.syntheticV1043Rehearsal === true && config.migration?.strictParser === true && config.migration?.liveMigrationEnabled === false && config.migration?.productionWriteEnabled === false, 'migration boundaries are missing');
  assert(config.readiness?.decision === 'not-ready' && config.readiness?.productionReady === false && config.readiness?.productionCutover === false && config.readiness?.automatedPromotionAllowed === false, 'readiness must remain owner-blocked');
  assert(config.hostedPilot?.automaticDeployment === false && config.hostedPilot?.providerActivationRequired === true, 'hosted-pilot activation boundary is missing');

  assert(receipt.schema === 'beaufort-learning-harbor-v11-preview-deployment-receipt-v2', 'deployment receipt schema is unexpected');
  assert(receipt.release === currentRelease && receipt.worker === expectedWorker, 'deployment receipt targets the wrong release or Worker');
  assert(receipt.previewHost === doctor.hosts.preview, 'deployment receipt host does not match the pilot doctor');
  assert(receipt.commit && receipt.runId && receipt.runAttempt, 'deployment receipt is missing exact-run identity');
  if (process.env.GITHUB_SHA) assert(receipt.commit === process.env.GITHUB_SHA, 'deployment receipt commit does not match the current workflow head');
  if (process.env.GITHUB_RUN_ID) assert(String(receipt.runId) === String(process.env.GITHUB_RUN_ID), 'deployment receipt run ID does not match the current workflow');

  const report = {
    schema: 'beaufort-learning-harbor-rc2-provider-evidence-v1',
    currentRelease,
    targetRelease,
    checkedAt: new Date().toISOString(),
    commit: receipt.commit,
    workflowRun: { id: String(receipt.runId), attempt: String(receipt.runAttempt) },
    state: 'provider-activation-evidenced-pilot-required',
    hosts: { supabase: doctor.hosts.supabase, preview: doctor.hosts.preview },
    migrations: { hostedBaseline: '202608040008', releaseCandidate: expectedMigrationMarker, aclHardening: expectedAclMarker },
    evidenceDigests: {
      pilotDoctor: digest(doctor),
      remoteSchema: digest(remote),
      health: digest(health),
      configuration: digest(config),
      deploymentReceipt: digest(receipt)
    },
    gates: {
      A: { complete: true },
      B: { complete: true },
      C: { complete: false, reason: 'synthetic hosted workflows, recovery, operations, and defect closure remain required' },
      D: { complete: false, reason: 'the package must remain rc.1 until Gate C is complete' }
    },
    realFamilyDataAuthorized: false,
    liveMigrationEnabled: false,
    productionDataEnabled: false,
    productionReady: false,
    productionCutoverApproved: false,
    automatedPromotionAllowed: false,
    exclusions: ['private family data', 'credentials and sessions', 'provider account identifiers beyond approved hosts', 'queue payloads', 'private support content']
  };
  assert(report.gates.C.complete === false && report.gates.D.complete === false, 'provider mode must not claim hosted-pilot or RC.2 completion');
  await writeReport('rc2-provider-evidence.json', report);
  console.log('RC.2 provider evidence gate passed: isolated provider activation is evidenced; hosted pilot and RC.2 release remain incomplete.');
}

if (mode === 'repository') await validateRepositoryMode();
else if (mode === 'provider') await validateProviderMode();
else throw new Error(`Unsupported RC.2 evidence mode: ${mode}`);
