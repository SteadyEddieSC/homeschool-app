import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const inputPath = path.join(root, 'hosted-multi-account-authorization-report.json');
const outputDirectory = path.join(root, 'test-results', 'rc2');
const outputPath = path.join(outputDirectory, 'rc2-hosted-multi-account-authorization-evidence.json');

function fail(message) {
  throw new Error(`Hosted multi-account authorization evidence validation failed: ${message}`);
}

function requireTrue(value, label) {
  if (value !== true) fail(`${label} is not evidenced true`);
}

function requireFalse(value, label) {
  if (value !== false) fail(`${label} is not evidenced false`);
}

const report = JSON.parse(await readFile(inputPath, 'utf8'));
if (report.schema !== 'beaufort-learning-harbor-hosted-multi-account-authorization-v1') fail('unexpected report schema');
if (report.release !== '11.0.0-rc.1') fail('unexpected release');
if (report.commit !== process.env.GITHUB_SHA) fail('report commit does not match exact workflow head');
if (report.workflowRun !== process.env.GITHUB_RUN_ID) fail('report workflow run does not match current run');
if (report.state !== 'passed') fail('protected authorization slice did not pass');

for (const key of [
  'separateDisposableAdultSessions',
  'groupAdministratorBrowserSignIn',
  'allowedInvitationCreation',
  'systemAdministratorExcludedFromInvitationUi',
  'systemAdministratorInvitationDenied',
  'revokedInvitationDenied',
  'parentInvitationRedeemed',
  'invitationReplayDenied',
  'parentMembershipAdministrationDenied',
  'parentHouseholdCreationAllowed',
  'parentLearnerCreationAllowed',
  'parentCrossHouseholdLearnerDenied',
  'directorInvitationRedeemed',
  'directorMembershipAdministrationDenied',
  'directorHouseholdReadDenied',
  'directorLearnerReadDenied',
  'directorHouseholdCreateDenied',
  'crossOrganizationVisibilityDenied',
  'allowedGroupAdministratorFamilyVisibility',
  'browserSessionSeparationPreserved'
]) requireTrue(report.coverage?.[key], `coverage.${key}`);

if (report.counts?.ordinaryInvitationRolesVisible !== 5) fail('ordinary invitation role count is not exactly five');
if (report.counts?.parentVisibleHouseholdsBeforeGroupChange !== 1) fail('Parent household visibility is not exactly bounded to one related household');
if (report.counts?.parentVisibleLearnersBeforeGroupChange !== 1) fail('Parent learner visibility is not exactly bounded to one related learner');
if (report.counts?.directorVisibleHouseholds !== 0) fail('Director received household visibility');
if (report.counts?.directorVisibleLearners !== 0) fail('Director received learner visibility');
if (report.counts?.groupAdministratorVisibleLearnersPrimaryGroup !== 2) fail('Group Administrator did not retain expected primary-group family visibility');
if (report.counts?.parentVisibleLearnersSecondGroup !== 1) fail('Second synthetic group did not expose exactly its own learner');

for (const key of [
  'systemAdministratorInvitation',
  'replay',
  'parentMembershipAdministration',
  'directorMembershipAdministration',
  'directorHouseholdCreate'
]) {
  const code = String(report.denialCodes?.[key] ?? '');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(code)) fail(`denialCodes.${key} is missing or unsafe`);
}
if (report.denialCodes?.revokedInvitation !== 'browser-visible-denial') fail('revoked invitation browser denial is not evidenced');

for (const key of [
  'primaryOrganizationDeleted',
  'secondOrganizationDeleted',
  'groupAdministratorBrowserSignedOut',
  'parentBrowserSignedOut',
  'directorBrowserSignedOut',
  'groupAdministratorClientSignedOut',
  'parentClientSignedOut',
  'directorClientSignedOut'
]) requireTrue(report.cleanup?.[key], `cleanup.${key}`);

requireTrue(report.deferred?.emailConfirmationDelivery, 'deferred.emailConfirmationDelivery');
requireTrue(report.deferred?.passwordRecoveryDelivery, 'deferred.passwordRecoveryDelivery');
if (report.deferred?.reason !== 'separate-provider-mail-slice') fail('mail evidence deferral is not explicit');

requireTrue(report.boundaries?.syntheticDataOnly, 'boundaries.syntheticDataOnly');
requireFalse(report.boundaries?.invitationCodesPersisted, 'boundaries.invitationCodesPersisted');
requireFalse(report.boundaries?.emailAddressesPersisted, 'boundaries.emailAddressesPersisted');
requireFalse(report.boundaries?.rawProviderRowsPersisted, 'boundaries.rawProviderRowsPersisted');
requireFalse(report.boundaries?.realFamilyDataAuthorized, 'boundaries.realFamilyDataAuthorized');
requireFalse(report.boundaries?.liveMigrationEnabled, 'boundaries.liveMigrationEnabled');
requireFalse(report.boundaries?.productionDataEnabled, 'boundaries.productionDataEnabled');
requireFalse(report.boundaries?.productionReady, 'boundaries.productionReady');
requireFalse(report.boundaries?.productionCutoverApproved, 'boundaries.productionCutoverApproved');
requireFalse(report.boundaries?.automatedPromotionAllowed, 'boundaries.automatedPromotionAllowed');
requireFalse(report.boundaries?.fullGateCComplete, 'boundaries.fullGateCComplete');

const serialized = JSON.stringify(report);
if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized)) fail('evidence contains an email address');
if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(serialized)) fail('evidence contains a UUID');
if (/\b[0-9a-f]{64}\b/i.test(serialized)) fail('evidence contains a possible raw invitation token or secret-shaped value');
if (/eyJ[A-Za-z0-9_-]{20,}\./.test(serialized)) fail('evidence contains a JWT-shaped value');
if (/service[_-]?role|supabase_service|cloudflare[_-]api[_-]token/i.test(serialized)) fail('evidence contains a protected credential label or value');

const evidence = {
  schema: 'beaufort-learning-harbor-rc2-hosted-multi-account-authorization-evidence-v1',
  release: report.release,
  commit: report.commit,
  workflowRun: report.workflowRun,
  checkedAt: report.checkedAt,
  completedAt: report.completedAt,
  state: 'multi-account-invitation-and-browser-authorization-complete-full-gate-c-incomplete',
  coverage: report.coverage,
  counts: report.counts,
  denialCodes: report.denialCodes,
  cleanup: report.cleanup,
  deferred: report.deferred,
  boundaries: report.boundaries,
  exclusions: [
    'email addresses and passwords',
    'invitation codes and invitation identifiers',
    'user, organization, household, and learner identifiers',
    'sessions, JWTs, recovery tokens, and provider credentials',
    'raw provider rows and raw provider error bodies'
  ]
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log('Hosted multi-account authorization evidence validated: invitation redemption/replay, revoked denial, membership boundaries, family isolation, cross-organization isolation, session separation, exact synthetic cleanup, and explicit provider-mail deferral are evidenced without persisting sensitive values.');
