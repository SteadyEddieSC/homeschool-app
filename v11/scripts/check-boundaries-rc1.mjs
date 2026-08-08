import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const repositoryRoot = path.resolve(root, '..');
const ignoredDirectories = new Set(['node_modules', 'dist', '.wrangler', 'playwright-report', 'test-results', 'artifacts']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.jsonc', '.md', '.sql', '.css', '.html', '.example', '.toml', '.yml', '.yaml']);
function assert(condition, message) { if (!condition) throw new Error(message); }
async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute));
    else if (textExtensions.has(path.extname(entry.name)) || entry.name === '.env.example') files.push(absolute);
  }
  return files;
}

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert(pkg.version === '11.0.0-rc.1', 'package release must be rc.1');
for (const script of ['check:boundaries','migration:rehearse','readiness:report','vendor-exit:verify','pilot:doctor','pilot:verify-schema']) assert(pkg.scripts?.[script], `missing ${script}`);
assert(pkg.scripts['check:boundaries'] === 'node scripts/check-boundaries-rc1.mjs', 'rc.1 must use the consolidated boundary suite');
assert(pkg.scripts['migration:rehearse'] === 'node scripts/migration-rehearsal.mjs', 'rc.1 must use the strict migration rehearsal');
assert(pkg.devDependencies?.supabase === '2.110.0', 'Supabase CLI must remain pinned exactly');
for (const [groupName, dependencies] of Object.entries({ dependencies: pkg.dependencies, devDependencies: pkg.devDependencies })) {
  for (const [name, version] of Object.entries(dependencies ?? {})) assert(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(version)), `${groupName}.${name} must be pinned exactly`);
}

const wrangler = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
assert(wrangler.includes('"name": "beaufort-learning-harbor-v11-preview"'), 'v11 must target the isolated preview Worker');
assert(!wrangler.includes('"name": "beaufort-learning-harbor"'), 'v11 must not target the v10 production Worker');
assert(wrangler.includes('"APP_RELEASE": "11.0.0-rc.1"'), 'Wrangler release must match rc.1');
assert(wrangler.includes('"/api/*"'), 'Worker-first API routing is required');

const migrationNames = (await readdir(path.join(root, 'supabase/migrations'))).filter((name) => name.endsWith('.sql')).sort();
assert(migrationNames.at(-1) === '202608050010_v11_hosted_acl_hardening.sql', 'migration 010 hosted ACL hardening must be latest');
assert(migrationNames.includes('202608040009_v11_migration_rehearsal.sql'), 'migration 009 release-candidate rehearsal must remain present');
const migrationText = (await Promise.all(migrationNames.map((name) => readFile(path.join(root, 'supabase/migrations', name), 'utf8')))).join('\n');
const rlsCount = (migrationText.match(/enable row level security/gi) ?? []).length;
assert(rlsCount >= 20, `Expected at least 20 RLS tables; found ${rlsCount}`);
for (const boundary of ['current_org_role','can_view_family','can_manage_family','organization_invites','learner_today_items','learning_operation_receipts','client_operation_id','transition_learner_today_item','knowledge_checks','knowledge_attempts','evidence_submissions','weekly_plans','weekly_plan_items','learning_studio_operation_receipts','submit_knowledge_attempt_v2','review_evidence_submission','hosted_pilot_schema_status','migration_import_receipts','production_readiness_decisions','release_candidate_readiness_status','hosted_acl_status','rehearsal_only','production_cutover_approved']) assert(migrationText.includes(boundary), `missing database boundary ${boundary}`);
assert(migrationText.includes("source_release = '10.43.0'"), 'migration receipts must be limited to reviewed v10.43 records');
assert(migrationText.includes("source_record_id ~ '^syn-"), 'migration 009 must reject non-synthetic IDs');
assert(migrationText.includes('check (rehearsal_only = true)'), 'migration receipts must remain rehearsal-only');
assert(migrationText.includes('check (production_cutover_approved = false)'), 'rc.1 must make cutover impossible');
assert(migrationText.includes("decision in ('not-ready', 'pilot-only', 'rejected')"), 'rc.1 must not expose an approved state');
assert(migrationText.includes("'live_migration_enabled', false") && migrationText.includes("'production_data_enabled', false"), 'status RPC must keep live migration and production data disabled');
assert(migrationText.includes('revoke update, delete on public.migration_import_receipts from authenticated'), 'clients must not alter receipts');
assert(migrationText.includes('revoke insert, update, delete on public.production_readiness_decisions from authenticated'), 'browser clients must not approve cutover');
assert(migrationText.includes('Target attempt ID is required'), 'hosted scoring must preserve client IDs');
assert(migrationText.includes('Operation ID was already used for a different action'), 'operation IDs must reject cross-action reuse');
assert(migrationText.includes('revoke all on public.knowledge_attempts'), 'attempts must use constrained RPCs');
assert(migrationText.includes('revoke all on function public.review_evidence_submission'), 'proof review must use constrained RPC');
assert(migrationText.includes("execute format('revoke execute on function %s from public'"), 'migration 010 must revoke inherited PUBLIC function execution');
assert(migrationText.includes("execute format('revoke execute on function %s from anon'"), 'migration 010 must revoke direct anonymous function execution');
assert(migrationText.includes('revoke execute on function public.submit_knowledge_attempt(uuid, jsonb, uuid) from authenticated'), 'legacy scoring RPC must be disabled');
assert(migrationText.includes("'anonymous_security_definer_executable', anonymous_security_definer_count"), 'ACL status must report anonymous security-definer execution');
assert(!/target_role\s+in\s*\([^)]*system-admin/i.test(migrationText), 'System Administrator must not be invitable');
assert(migrationText.includes("access_mode text not null default 'parent-assisted'"), 'learner access must remain parent-assisted');
assert(migrationText.includes('revoke update, delete on public.learner_today_items from authenticated'), 'Today transitions must use the constrained RPC');

const syncQueue = await readFile(path.join(root, 'src/services/sync-queue.ts'), 'utf8');
for (const boundary of ['pending','syncing','failed','completed','cancelled','lastSuccessfulSyncAt','setEnabled']) assert(syncQueue.includes(boundary), `sync queue missing ${boundary}`);
assert(syncQueue.includes("['pending', 'syncing', 'failed'].includes(operation.status)"), 'active duplicate operations must be deduplicated');
const resilientLearning = await readFile(path.join(root, 'src/services/resilient-learning.ts'), 'utf8');
for (const boundary of ['studioRemote','create-knowledge-check','submit-knowledge-attempt','submit-evidence','review-evidence','create-weekly-plan-item']) assert(resilientLearning.includes(boundary), `shared queue executor missing ${boundary}`);
assert(resilientLearning.includes('operationId: operation.id'), 'hosted retries must reuse stable operation IDs');
assert(resilientLearning.includes('attemptId: payload.id'), 'hosted attempts must preserve local record IDs');
const localStudio = await readFile(path.join(root, 'src/services/local-studio.ts'), 'utf8');
for (const boundary of ['readOrganizationSnapshot','replaceOrganizationSnapshot','scoreKnowledgeCheck','receipts','cloud-connected','cloud-ready']) assert(localStudio.includes(boundary), `local studio missing ${boundary}`);
const hostedStudio = await readFile(path.join(root, 'src/services/supabase-studio.ts'), 'utf8');
for (const boundary of ['SupabaseLearningStudioRepository','submit_knowledge_attempt_v2','review_evidence_submission','client_operation_id']) assert(hostedStudio.includes(boundary), `hosted studio missing ${boundary}`);
assert(!hostedStudio.includes(".upsert(record, { onConflict: 'client_operation_id' })"), 'hosted retries must not require broad update grants');
const resilientStudio = await readFile(path.join(root, 'src/services/resilient-studio.ts'), 'utf8');
for (const boundary of ['reconcileRecords','activeStudioRecordIds','replaceOrganizationConflicts','localDigest','remoteDigest']) assert(resilientStudio.includes(boundary), `reconciliation missing ${boundary}`);
assert(resilientStudio.includes('records.push(local)'), 'conflicts must preserve local data');
const conflictStore = await readFile(path.join(root, 'src/services/studio-conflicts.ts'), 'utf8');
assert(conflictStore.includes('acknowledge') && conflictStore.includes('lastRemoteRefreshError'), 'conflicts must remain visible and acknowledgeable');
const pilotWorkspace = await readFile(path.join(root, 'src/components/HostedPilotWorkspace.tsx'), 'utf8');
for (const exclusion of ['record content and learner work','queue payloads','raw synchronization error text']) assert(pilotWorkspace.includes(exclusion), `diagnostics must exclude ${exclusion}`);
assert(!pilotWorkspace.includes('operation.payload'), 'diagnostics must not export queue payloads');
const studioDomain = await readFile(path.join(root, 'src/domain/studio.ts'), 'utf8');
assert(studioDomain.includes('scoreKnowledgeCheck'), 'objective scoring must remain deterministic');
assert(studioDomain.includes("EVIDENCE_STATUSES = ['pending', 'accepted', 'returned']"), 'proof must retain adult states');
assert(studioDomain.includes('LearningStudioMirrorRepository'), 'reconciliation requires a local mirror contract');

const runtime = await readFile(path.join(root, 'src/lib/supabase.ts'), 'utf8');
assert(runtime.includes("release: '11.0.0-rc.1'"), 'runtime release must match rc.1');
assert(runtime.includes("publishableKey.startsWith('sb_secret_')") && runtime.includes("decodeJwtRole(publishableKey) === 'service_role'"), 'browser must reject privileged keys');
const backup = await readFile(path.join(root, 'src/services/local-backup-beta3.ts'), 'utf8');
for (const boundary of ['AES-GCM','PBKDF2','SHA-256','120_000','active invitation tokens','hosted reconciliation diagnostics','applyBackupPreview','knowledgeChecks','evidenceSubmissions','weeklyPlans']) assert(backup.includes(boundary), `backup missing ${boundary}`);
assert(backup.includes("'11.0.0-beta.2'") && backup.includes("'11.0.0-beta.3'"), 'controlled legacy backup import must remain');
assert(!backup.includes('service_role'), 'backup must never handle service-role credentials');

const engine = await readFile(path.join(root, 'src/migration/v1043-rehearsal.ts'), 'utf8');
for (const boundary of ['MAX_SOURCE_BYTES = 512_000','MAX_RECORDS = 500','assertExactKeys','FORBIDDEN_KEY_PATTERN','SYNTHETIC_ID_PATTERN','parseLegacyV1043Export','planLegacyMigration','update-review-required','Legacy completion is imported as awaiting adult review','Legacy proof acceptance is not authoritative','applyMigrationPlan','REHEARSAL_STORAGE_KEY','REHEARSAL_ROLLBACK_KEY','rollbackMigrationRehearsal','AES-GCM','PBKDF2','runRecoveryRehearsal',"requestedDecision === 'production-ready'",'productionReady: false']) assert(engine.includes(boundary), `migration engine missing ${boundary}`);
assert(!engine.includes('LOCAL_LEARNING_STORAGE_KEY') && !engine.includes('LOCAL_STUDIO_STORAGE_KEY'), 'migration rehearsal must not write normal stores');
assert(!engine.includes('client.from(') && !engine.includes('supabase.from('), 'browser migration rehearsal must not write Supabase');
const fixture = await readFile(path.join(root, 'public/fixtures/v10.43-synthetic-export.json'), 'utf8');
assert(fixture.includes('"rehearsal": true') && fixture.includes('"synthetic": true') && fixture.includes('syn-learner-001') && fixture.includes('unsupported'), 'fixture must be synthetic and cover unsupported records');
const migrationScript = await readFile(path.join(root, 'scripts/migration-rehearsal.mjs'), 'utf8');
assert(migrationScript.includes('dryRunWrites: 0') && migrationScript.includes('liveMigrationEnabled: false'), 'CI migration evidence must prove zero writes and disabled live migration');
const readinessScript = await readFile(path.join(root, 'scripts/production-readiness.mjs'), 'utf8');
assert(readinessScript.includes("effectiveDecision: 'not-ready'") && readinessScript.includes('productionReady: false'), 'CI readiness must remain not-ready');
const vendorScript = await readFile(path.join(root, 'scripts/vendor-exit-rehearsal.mjs'), 'utf8');
for (const boundary of ['checksumMatched','rpoRecords','providerTokensIncluded: false','passwordsIncluded: false','learnerWorkIncluded: false']) assert(vendorScript.includes(boundary), `vendor exit missing ${boundary}`);
const doctor = await readFile(path.join(root, 'scripts/pilot-doctor.mjs'), 'utf8');
assert(doctor.includes('11.0.0-rc.1') && doctor.includes('202608040009_v11_migration_rehearsal.sql') && doctor.includes('202608050010_v11_hosted_acl_hardening.sql') && doctor.includes('productionCutoverApproved: false'), 'pilot doctor must target rc.1, migrations 009/010, and keep cutover disabled');
assert(!doctor.includes('PILOT_TEST_PASSWORD'), 'pilot doctor must not inspect test credentials');
const verifier = await readFile(path.join(root, 'scripts/verify-remote-schema.mjs'), 'utf8');
assert(verifier.includes('release_candidate_readiness_status'), 'remote verifier must use the rc.1 status RPC');
assert(verifier.includes('hosted_acl_status'), 'remote verifier must validate migration 010 ACL status');
assert(verifier.includes('persistSession: false') && verifier.includes('client.auth.signOut'), 'remote verifier must not persist sessions');

const worker = await readFile(path.join(root, 'worker/index.ts'), 'utf8');
for (const boundary of ["const RELEASE = '11.0.0-rc.1'",'parentManagedLearners: true','deterministicObjectiveScoring: true','explicitEvidenceReview: true','orderedMutationQueue: true','clientRecordIdsPreserved: true','conflictAwareStudioReconciliation: true','silentConflictOverwrite: false','syntheticV1043Rehearsal: true','strictParser: true','liveMigrationEnabled: false','productionWriteEnabled: false',"decision: 'not-ready'",'productionReady: false','automatedPromotionAllowed: false','productionCutover: false']) assert(worker.includes(boundary), `worker config missing ${boundary}`);

const databaseTests = (await Promise.all((await readdir(path.join(root, 'supabase/tests'))).filter((name) => name.endsWith('.sql')).map((name) => readFile(path.join(root, 'supabase/tests', name), 'utf8')))).join('\n');
for (const assertion of ['Director does not automatically see household learners','Transition retry creates one receipt','Knowledge retry creates one attempt','Evidence retry creates one receipt','Hosted attempt preserves the local record ID','Eighth day is rejected by the database','Non-synthetic source IDs are rejected','Live migration receipts are rejected','Status RPC keeps live migration and production cutover disabled','Anonymous security-definer RPC execution is disabled','Trigger-only functions are not browser-callable','Superseded scoring RPC is disabled','Authenticated ACL status reports migration 010']) assert(databaseTests.includes(assertion), `database tests must cover ${assertion}`);
const validateWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/validate-v11.yml'), 'utf8');
for (const boundary of ['v11-rc1-migration-rehearsal','test-results/rc1','chromium-desktop','chromium-tablet','chromium-mobile','beaufort-learning-harbor-v11.0.0-rc.1-preview']) assert(validateWorkflow.includes(boundary), `validation workflow missing ${boundary}`);
const deployWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/deploy-v11-preview.yml'), 'utf8');
assert(deployWorkflow.includes('workflow_dispatch:') && !/\npush:\s*\n/.test(deployWorkflow), 'preview deployment must be manual only');
for (const boundary of ['environment: v11-preview','DEPLOY_V11_PREVIEW','11.0.0-rc.1','pilot:verify-schema','automaticDeployment','migrations 001-010']) assert(deployWorkflow.includes(boundary), `deployment workflow missing ${boundary}`);
const pointer = JSON.parse(await readFile(path.join(root, '../source/current-release.json'), 'utf8'));
assert(String(pointer.manifest).includes('v10.43'), 'v10.43 stable pointer must remain unchanged');

const forbiddenPatterns = [
  { pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/i, label: 'Supabase service-role secret' },
  { pattern: /VITE_[A-Z0-9_]*(?:SERVICE_ROLE|CLIENT_SECRET|ACCESS_TOKEN)\s*[:=]\s*[^$\s][^\s]*/i, label: 'privileged Vite secret' },
  { pattern: /BAND_(?:CLIENT_SECRET|ACCESS_TOKEN)\s*=\s*\S+/i, label: 'BAND secret' },
  { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{20,}/, label: 'private key' },
  { pattern: /eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}/, label: 'JWT-like credential' }
];
for (const file of await collectFiles(root)) {
  const content = await readFile(file, 'utf8');
  for (const forbidden of forbiddenPatterns) assert(!forbidden.pattern.test(content), `${forbidden.label} found in ${path.relative(root, file)}`);
}
console.log(`v11 rc.1 boundary checks passed: ${rlsCount} RLS tables, beta.4 family/sync/privacy gates preserved, strict synthetic migration, hosted ACL hardening, reversible isolated apply, vendor-exit integrity, owner-blocked promotion, protected deployment, exact dependencies, and unchanged v10.43 fallback`);
