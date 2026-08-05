import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.join(root, 'hosted-pilot-core-report.json');
const release = '11.0.0-rc.1';
const syntheticSlugPrefix = 'rc2-pilot-';

function required(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`${name} is required in the protected hosted-pilot environment`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Hosted pilot stopped: ${message}`);
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

function boundedCode(error) {
  const code = String(error?.code ?? error?.status ?? 'provider-error');
  return /^[A-Za-z0-9_-]{1,40}$/.test(code) ? code : 'provider-error';
}

async function expectSuccess(label, operation) {
  const result = await operation;
  if (result.error) throw new Error(`Hosted pilot stopped: ${label} failed (${boundedCode(result.error)})`);
  return result.data;
}

async function expectDenied(label, operation) {
  const result = await operation;
  assert(Boolean(result.error), `${label} was unexpectedly allowed`);
  return true;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function mondayUtc(date = new Date()) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay();
  copy.setUTCDate(copy.getUTCDate() - ((day + 6) % 7));
  return copy;
}

function addUtcDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

async function exactCount(client, table, column, value) {
  const result = await client.from(table).select('*', { count: 'exact', head: true }).eq(column, value);
  if (result.error) throw new Error(`Hosted pilot stopped: ${table} count failed (${boundedCode(result.error)})`);
  return result.count ?? 0;
}

const supabaseUrl = required('VITE_SUPABASE_URL');
const publishableKey = required('VITE_SUPABASE_PUBLISHABLE_KEY');
const pilotEmail = required('PILOT_TEST_EMAIL');
const pilotPassword = required('PILOT_TEST_PASSWORD');
const previewUrl = required('V11_PREVIEW_URL');

assert(supabaseUrl.startsWith('https://') && new URL(supabaseUrl).hostname.endsWith('.supabase.co'), 'Supabase URL is not the protected hosted project');
assert(previewUrl.startsWith('https://') && new URL(previewUrl).hostname.endsWith('.workers.dev'), 'preview URL is not an HTTPS workers.dev origin');
assert(!publishableKey.startsWith('sb_secret_'), 'browser key is privileged');

const client = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
const invalidClient = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

let organizationId = null;
let cleanupComplete = false;
let signOutComplete = false;
let primaryError = null;

const report = {
  schema: 'beaufort-learning-harbor-hosted-pilot-core-v1',
  release,
  checkedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || null,
  state: 'running',
  identity: {},
  provider: {},
  invitations: {},
  today: {},
  objective: {},
  evidence: {},
  planning: {},
  cleanup: {},
  boundaries: {
    syntheticDataOnly: true,
    realFamilyDataAuthorized: false,
    liveMigrationEnabled: false,
    productionDataEnabled: false,
    productionReady: false,
    productionCutoverApproved: false,
    automatedPromotionAllowed: false
  },
  remaining: [
    'multi-account invitation redemption and replay',
    'cross-role and cross-household browser authorization',
    'browser offline queue and visible conflict handling',
    'email confirmation, recovery delivery, and abuse controls',
    'hosted backup, restore, vendor-exit, monitoring, and shutdown rehearsal'
  ]
};

try {
  await expectDenied('invalid password sign-in', invalidClient.auth.signInWithPassword({
    email: pilotEmail,
    password: `${pilotPassword}!invalid`
  }));
  report.identity.invalidPasswordDenied = true;

  const signIn = await client.auth.signInWithPassword({ email: pilotEmail, password: pilotPassword });
  if (signIn.error || !signIn.data.user || !signIn.data.session) {
    throw new Error(`Hosted pilot stopped: protected verifier could not sign in (${boundedCode(signIn.error)})`);
  }
  const userId = signIn.data.user.id;
  report.identity.passwordSignIn = true;

  const refresh = await client.auth.refreshSession();
  if (refresh.error || !refresh.data.session) {
    throw new Error(`Hosted pilot stopped: verifier session could not refresh (${boundedCode(refresh.error)})`);
  }
  report.identity.sessionRefresh = true;

  const healthResponse = await fetch(`${previewUrl.replace(/\/$/, '')}/api/health`, { headers: { accept: 'application/json' } });
  assert(healthResponse.ok, 'preview health endpoint is unavailable');
  const health = await healthResponse.json();
  assert(health.ok === true && health.release === release && health.service === 'beaufort-learning-harbor-v11-preview', 'preview health boundary is unexpected');
  report.provider.health = true;

  const configResponse = await fetch(`${previewUrl.replace(/\/$/, '')}/api/config`, { headers: { accept: 'application/json' } });
  assert(configResponse.ok, 'preview config endpoint is unavailable');
  const config = await configResponse.json();
  assert(config.productionDataEnabled === false, 'preview configuration enables production data');
  assert(config.readiness?.productionReady === false && config.readiness?.productionCutover === false, 'preview configuration enables production readiness or cutover');
  assert(config.learning?.automaticGrades === false && config.learning?.automaticMastery === false && config.learning?.automaticAttendance === false && config.learning?.automaticXp === false, 'preview configuration enables automatic educational outcomes');
  report.provider.configuration = true;

  const existingOrganizations = await expectSuccess(
    'synthetic residue inspection',
    client.from('organizations').select('id, slug')
  );
  for (const organization of existingOrganizations ?? []) {
    assert(String(organization.slug).startsWith(syntheticSlugPrefix), 'verifier belongs to a non-synthetic organization; pilot stopped without modifying it');
    await expectSuccess('stale synthetic organization cleanup', client.from('organizations').delete().eq('id', organization.id));
  }

  const nonce = `${String(process.env.GITHUB_RUN_ID ?? Date.now())}-${randomUUID().slice(0, 8)}`.toLowerCase();
  const slug = `${syntheticSlugPrefix}${nonce}`.replace(/[^a-z0-9-]/g, '-').slice(0, 63);
  const bootstrap = firstRow(await expectSuccess(
    'organization bootstrap',
    client.rpc('bootstrap_organization', {
      requested_name: 'Synthetic RC2 Pilot Organization',
      requested_slug: slug
    })
  ));
  assert(bootstrap?.organization_id, 'organization bootstrap returned no organization');
  organizationId = bootstrap.organization_id;
  report.invitations.organizationBootstrap = true;

  await expectDenied(
    'System Administrator invitation',
    client.rpc('create_organization_invite', {
      target_organization: organizationId,
      target_role: 'system-admin',
      expires_in_hours: 24
    })
  );
  report.invitations.systemAdministratorDenied = true;

  const invitation = firstRow(await expectSuccess(
    'bounded invitation creation',
    client.rpc('create_organization_invite', {
      target_organization: organizationId,
      target_role: 'parent',
      expires_in_hours: 1
    })
  ));
  assert(invitation?.id && invitation?.invite_token, 'bounded invitation did not return its one-time token');
  await expectSuccess(
    'invitation revocation',
    client.rpc('revoke_organization_invite', {
      target_organization: organizationId,
      target_invitation: invitation.id
    })
  );
  await expectDenied(
    'revoked invitation redemption',
    client.rpc('redeem_organization_invite', { invite_token: invitation.invite_token })
  );
  report.invitations.revocation = true;
  report.invitations.revokedRedemptionDenied = true;

  const household = firstRow(await expectSuccess(
    'synthetic household creation',
    client.from('households').insert({
      organization_id: organizationId,
      name: 'Synthetic RC2 Household',
      created_by: userId,
      client_operation_id: randomUUID()
    }).select('id').single()
  ));
  assert(household?.id, 'synthetic household creation returned no record');

  const learner = firstRow(await expectSuccess(
    'synthetic learner creation',
    client.from('learners').insert({
      organization_id: organizationId,
      household_id: household.id,
      preferred_name: 'Synthetic Learner',
      grade_band: '4-6',
      avatar_key: 'heron',
      access_mode: 'parent-assisted',
      client_operation_id: randomUUID()
    }).select('id, access_mode').single()
  ));
  assert(learner?.id && learner.access_mode === 'parent-assisted', 'synthetic learner is not parent-managed');
  report.today.parentManagedLearner = true;

  const dueDate = isoDate(new Date());
  const todayItem = firstRow(await expectSuccess(
    'Today item creation',
    client.from('learner_today_items').insert({
      organization_id: organizationId,
      household_id: household.id,
      learner_id: learner.id,
      assigned_by: userId,
      title: 'Synthetic Core Workflow',
      instructions: 'Synthetic hosted-pilot fixture.',
      activity_type: 'learn',
      due_date: dueDate,
      status: 'assigned',
      client_operation_id: randomUUID()
    }).select('id, status').single()
  ));

  const startOperation = randomUUID();
  const started = firstRow(await expectSuccess('Today start', client.rpc('transition_learner_today_item', {
    target_item: todayItem.id,
    requested_action: 'start',
    submitted_learner_note: '',
    submitted_review_feedback: '',
    operation_id: startOperation
  })));
  const startedRetry = firstRow(await expectSuccess('Today start retry', client.rpc('transition_learner_today_item', {
    target_item: todayItem.id,
    requested_action: 'start',
    submitted_learner_note: '',
    submitted_review_feedback: '',
    operation_id: startOperation
  })));
  assert(started?.status === 'in-progress' && startedRetry?.status === 'in-progress', 'Today start retry was not idempotent');
  assert(await exactCount(client, 'learning_operation_receipts', 'operation_id', startOperation) === 1, 'Today start retry created duplicate receipts');
  report.today.startIdempotent = true;

  const submitOperation = randomUUID();
  const submitted = firstRow(await expectSuccess('Today submit review', client.rpc('transition_learner_today_item', {
    target_item: todayItem.id,
    requested_action: 'submit-review',
    submitted_learner_note: 'Synthetic review note.',
    submitted_review_feedback: '',
    operation_id: submitOperation
  })));
  const submittedRetry = firstRow(await expectSuccess('Today submit review retry', client.rpc('transition_learner_today_item', {
    target_item: todayItem.id,
    requested_action: 'submit-review',
    submitted_learner_note: 'Synthetic review note.',
    submitted_review_feedback: '',
    operation_id: submitOperation
  })));
  assert(submitted?.status === 'ready-for-review' && submittedRetry?.status === 'ready-for-review', 'Today review submission retry was not idempotent');
  assert(await exactCount(client, 'learning_operation_receipts', 'operation_id', submitOperation) === 1, 'Today review retry created duplicate receipts');
  report.today.submitReviewIdempotent = true;

  const returnOperation = randomUUID();
  const returned = firstRow(await expectSuccess('Today return', client.rpc('transition_learner_today_item', {
    target_item: todayItem.id,
    requested_action: 'return',
    submitted_learner_note: '',
    submitted_review_feedback: 'Synthetic revision requested.',
    operation_id: returnOperation
  })));
  const returnedRetry = firstRow(await expectSuccess('Today return retry', client.rpc('transition_learner_today_item', {
    target_item: todayItem.id,
    requested_action: 'return',
    submitted_learner_note: '',
    submitted_review_feedback: 'Synthetic revision requested.',
    operation_id: returnOperation
  })));
  assert(returned?.status === 'returned' && returnedRetry?.status === 'returned', 'Today return retry was not idempotent');
  report.today.returnIdempotent = true;

  await expectSuccess('Today restart', client.rpc('transition_learner_today_item', {
    target_item: todayItem.id,
    requested_action: 'start',
    submitted_learner_note: '',
    submitted_review_feedback: '',
    operation_id: randomUUID()
  }));
  await expectSuccess('Today resubmit', client.rpc('transition_learner_today_item', {
    target_item: todayItem.id,
    requested_action: 'submit-review',
    submitted_learner_note: 'Synthetic revised review note.',
    submitted_review_feedback: '',
    operation_id: randomUUID()
  }));
  const completed = firstRow(await expectSuccess('Today explicit completion', client.rpc('transition_learner_today_item', {
    target_item: todayItem.id,
    requested_action: 'complete',
    submitted_learner_note: '',
    submitted_review_feedback: 'Synthetic adult approval.',
    operation_id: randomUUID()
  })));
  assert(completed?.status === 'completed', 'Today item was not explicitly completed by the adult');
  report.today.explicitAdultCompletion = true;

  const quizItem = firstRow(await expectSuccess(
    'quiz Today item creation',
    client.from('learner_today_items').insert({
      organization_id: organizationId,
      household_id: household.id,
      learner_id: learner.id,
      assigned_by: userId,
      title: 'Synthetic Objective Check',
      instructions: 'Synthetic objective fixture.',
      activity_type: 'quiz',
      due_date: dueDate,
      status: 'in-progress',
      client_operation_id: randomUUID()
    }).select('id, status').single()
  ));
  const check = firstRow(await expectSuccess(
    'knowledge check creation',
    client.from('knowledge_checks').insert({
      organization_id: organizationId,
      household_id: household.id,
      learner_id: learner.id,
      today_item_id: quizItem.id,
      title: 'Synthetic Deterministic Check',
      questions: [{
        id: 'synthetic-q1',
        type: 'true-false',
        prompt: 'This is synthetic pilot data.',
        options: ['True', 'False'],
        correctOption: 0,
        explanation: 'Synthetic fixture.'
      }],
      created_by: userId,
      client_operation_id: randomUUID()
    }).select('id').single()
  ));
  const attemptOperation = randomUUID();
  const targetAttempt = randomUUID();
  const attempt = firstRow(await expectSuccess('objective attempt', client.rpc('submit_knowledge_attempt_v2', {
    target_check: check.id,
    submitted_answers: [0],
    operation_id: attemptOperation,
    target_attempt: targetAttempt
  })));
  const attemptRetry = firstRow(await expectSuccess('objective attempt retry', client.rpc('submit_knowledge_attempt_v2', {
    target_check: check.id,
    submitted_answers: [0],
    operation_id: attemptOperation,
    target_attempt: targetAttempt
  })));
  assert(attempt?.id === targetAttempt && attemptRetry?.id === targetAttempt, 'objective retry did not preserve the client record ID');
  assert(attempt.correct_count === 1 && attempt.percentage === 100, 'objective score was not deterministic');
  assert(await exactCount(client, 'knowledge_attempts', 'client_operation_id', attemptOperation) === 1, 'objective retry created duplicate attempts');
  const quizAfterAttempt = firstRow(await expectSuccess('objective Today status inspection', client.from('learner_today_items').select('status').eq('id', quizItem.id).single()));
  assert(quizAfterAttempt.status === 'in-progress', 'objective score automatically completed the Today item');
  report.objective.clientRecordIdPreserved = true;
  report.objective.retryIdempotent = true;
  report.objective.correctCount = 1;
  report.objective.percentage = 100;
  report.objective.automaticCompletion = false;

  const proofItem = firstRow(await expectSuccess(
    'proof Today item creation',
    client.from('learner_today_items').insert({
      organization_id: organizationId,
      household_id: household.id,
      learner_id: learner.id,
      assigned_by: userId,
      title: 'Synthetic Proof Review',
      instructions: 'Synthetic subjective fixture.',
      activity_type: 'proof',
      due_date: dueDate,
      status: 'ready-for-review',
      client_operation_id: randomUUID()
    }).select('id').single()
  ));
  const proofOne = firstRow(await expectSuccess(
    'proof revision one submission',
    client.from('evidence_submissions').insert({
      organization_id: organizationId,
      household_id: household.id,
      learner_id: learner.id,
      today_item_id: proofItem.id,
      title: 'Synthetic Proof',
      evidence_kind: 'text',
      content: 'Synthetic proof revision one.',
      learner_note: 'Synthetic note.',
      revision: 1,
      status: 'pending',
      client_operation_id: randomUUID(),
      submitted_by: userId
    }).select('id, status').single()
  ));
  const proofReturnOperation = randomUUID();
  const proofReturned = firstRow(await expectSuccess('proof return', client.rpc('review_evidence_submission', {
    target_submission: proofOne.id,
    requested_decision: 'return',
    submitted_feedback: 'Synthetic revision requested.',
    operation_id: proofReturnOperation
  })));
  const proofReturnedRetry = firstRow(await expectSuccess('proof return retry', client.rpc('review_evidence_submission', {
    target_submission: proofOne.id,
    requested_decision: 'return',
    submitted_feedback: 'Synthetic revision requested.',
    operation_id: proofReturnOperation
  })));
  assert(proofReturned?.status === 'returned' && proofReturnedRetry?.status === 'returned', 'proof return retry was not idempotent');

  const proofTwo = firstRow(await expectSuccess(
    'proof revision two submission',
    client.from('evidence_submissions').insert({
      organization_id: organizationId,
      household_id: household.id,
      learner_id: learner.id,
      today_item_id: proofItem.id,
      title: 'Synthetic Proof',
      evidence_kind: 'text',
      content: 'Synthetic proof revision two.',
      learner_note: 'Synthetic revised note.',
      revision: 2,
      previous_submission_id: proofOne.id,
      status: 'pending',
      client_operation_id: randomUUID(),
      submitted_by: userId
    }).select('id, status').single()
  ));
  assert(proofTwo.status === 'pending', 'proof revision was automatically accepted');
  const proofAccepted = firstRow(await expectSuccess('proof explicit acceptance', client.rpc('review_evidence_submission', {
    target_submission: proofTwo.id,
    requested_decision: 'accept',
    submitted_feedback: 'Synthetic adult acceptance.',
    operation_id: randomUUID()
  })));
  assert(proofAccepted?.status === 'accepted', 'proof was not explicitly accepted');
  assert(await exactCount(client, 'evidence_submissions', 'today_item_id', proofItem.id) === 2, 'proof revision history was not preserved');
  report.evidence.returnIdempotent = true;
  report.evidence.revisionHistoryCount = 2;
  report.evidence.automaticAcceptance = false;
  report.evidence.explicitAdultAcceptance = true;

  const weekStart = mondayUtc();
  const plan = firstRow(await expectSuccess(
    'weekly plan creation',
    client.from('weekly_plans').insert({
      organization_id: organizationId,
      household_id: household.id,
      week_start: isoDate(weekStart),
      title: 'Synthetic Seven Day Plan',
      created_by: userId,
      client_operation_id: randomUUID()
    }).select('id').single()
  ));
  for (let day = 0; day < 7; day += 1) {
    await expectSuccess(`weekly plan day ${day + 1}`, client.from('weekly_plan_items').insert({
      organization_id: organizationId,
      household_id: household.id,
      plan_id: plan.id,
      learner_id: learner.id,
      scheduled_date: isoDate(addUtcDays(weekStart, day)),
      title: `Synthetic Plan Day ${day + 1}`,
      activity_type: day % 2 === 0 ? 'learn' : 'practice',
      client_operation_id: randomUUID()
    }));
  }
  assert(await exactCount(client, 'weekly_plan_items', 'plan_id', plan.id) === 7, 'seven-day plan did not retain seven items');
  await expectDenied('eighth-day plan item', client.from('weekly_plan_items').insert({
    organization_id: organizationId,
    household_id: household.id,
    plan_id: plan.id,
    learner_id: learner.id,
    scheduled_date: isoDate(addUtcDays(weekStart, 7)),
    title: 'Synthetic Eighth Day',
    activity_type: 'learn',
    client_operation_id: randomUUID()
  }));
  report.planning.sevenDayItemCount = 7;
  report.planning.eighthDayDenied = true;

  report.state = 'synthetic-core-pilot-complete-additional-gate-c-evidence-required';
} catch (error) {
  primaryError = error;
  report.state = 'stopped';
} finally {
  if (organizationId) {
    try {
      await expectSuccess('synthetic organization cleanup', client.from('organizations').delete().eq('id', organizationId));
      const remaining = await expectSuccess('cleanup verification', client.from('organizations').select('id').eq('id', organizationId));
      assert((remaining ?? []).length === 0, 'synthetic organization remained after cleanup');
      cleanupComplete = true;
    } catch (error) {
      if (!primaryError) primaryError = error;
    }
  } else {
    cleanupComplete = true;
  }

  try {
    const signOut = await client.auth.signOut();
    if (signOut.error) throw new Error(`sign-out failed (${boundedCode(signOut.error)})`);
    const session = await client.auth.getSession();
    signOutComplete = !session.data.session;
    if (!signOutComplete) throw new Error('session remained after sign-out');
  } catch {
    if (!primaryError) primaryError = new Error('Hosted pilot stopped: protected verifier sign-out failed');
  }

  report.identity.signOut = signOutComplete;
  report.cleanup.syntheticOrganizationDeleted = cleanupComplete;
  report.cleanup.verifierSignedOut = signOutComplete;
  report.completedAt = new Date().toISOString();
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

if (primaryError) throw primaryError;
assert(cleanupComplete, 'synthetic organization cleanup did not complete');
assert(signOutComplete, 'protected verifier did not sign out');
console.log(JSON.stringify({
  schema: report.schema,
  release: report.release,
  state: report.state,
  cleanup: report.cleanup,
  boundaries: report.boundaries
}, null, 2));
