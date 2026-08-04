import {
  normalizeEvidenceContent,
  normalizeKnowledgeQuestions,
  normalizeStudioNote,
  normalizeStudioTitle,
  scoreKnowledgeCheck,
  type CreateKnowledgeCheckInput,
  type CreateWeeklyPlanInput,
  type CreateWeeklyPlanItemInput,
  type EvidenceSubmission,
  type KnowledgeAttempt,
  type KnowledgeCheck,
  type LearningStudioRepository,
  type ReviewEvidenceInput,
  type SubmitEvidenceInput,
  type SubmitKnowledgeAttemptInput,
  type WeeklyPlan,
  type WeeklyPlanItem
} from '../domain/studio';
import type { EnqueueSyncOperationInput, SyncOperationKind } from '../domain/sync';
import { SyncQueueManager } from './sync-queue';

const STORAGE_KEY = 'beaufortLearningHarbor.v11.beta3.studio';
const STATE_SCHEMA = 'beaufort-learning-harbor-studio-v1';

interface Receipt {
  kind: SyncOperationKind;
  recordId: string;
}

interface LocalStudioState {
  schema: typeof STATE_SCHEMA;
  knowledgeChecks: KnowledgeCheck[];
  knowledgeAttempts: KnowledgeAttempt[];
  evidenceSubmissions: EvidenceSubmission[];
  weeklyPlans: WeeklyPlan[];
  weeklyPlanItems: WeeklyPlanItem[];
  receipts: Record<string, Receipt>;
}

function now(): string { return new Date().toISOString(); }
function clone<T>(value: T): T { return structuredClone(value); }
function emptyState(): LocalStudioState {
  return { schema: STATE_SCHEMA, knowledgeChecks: [], knowledgeAttempts: [], evidenceSubmissions: [], weeklyPlans: [], weeklyPlanItems: [], receipts: {} };
}
function loadState(): LocalStudioState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<LocalStudioState> | null;
    if (parsed?.schema === STATE_SCHEMA) {
      return {
        schema: STATE_SCHEMA,
        knowledgeChecks: Array.isArray(parsed.knowledgeChecks) ? parsed.knowledgeChecks : [],
        knowledgeAttempts: Array.isArray(parsed.knowledgeAttempts) ? parsed.knowledgeAttempts : [],
        evidenceSubmissions: Array.isArray(parsed.evidenceSubmissions) ? parsed.evidenceSubmissions : [],
        weeklyPlans: Array.isArray(parsed.weeklyPlans) ? parsed.weeklyPlans : [],
        weeklyPlanItems: Array.isArray(parsed.weeklyPlanItems) ? parsed.weeklyPlanItems : [],
        receipts: parsed.receipts && typeof parsed.receipts === 'object' ? parsed.receipts : {}
      };
    }
  } catch { /* Damaged local preview records are replaced rather than merged. */ }
  const state = emptyState();
  saveState(state);
  return state;
}
function saveState(state: LocalStudioState): void { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function canonicalFingerprint(kind: string, value: unknown): string { return `${kind}:${JSON.stringify(value)}`; }
function duplicateError(): Error { return new Error('This learning action is already waiting to synchronize. Retry or cancel the existing operation instead of creating a duplicate.'); }

export class LocalLearningStudioRepository implements LearningStudioRepository {
  constructor(private readonly queue: SyncQueueManager) {}

  async listKnowledgeChecks(organizationId: string, learnerId?: string): Promise<KnowledgeCheck[]> {
    return clone(loadState().knowledgeChecks.filter((check) => check.organizationId === organizationId && (!learnerId || check.learnerId === learnerId)).sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
  }

  async createKnowledgeCheck(input: CreateKnowledgeCheckInput): Promise<KnowledgeCheck> {
    this.assertHostedBoundary();
    const state = loadState();
    const operationId = input.operationId ?? crypto.randomUUID();
    const receipt = state.receipts[operationId];
    if (receipt?.kind === 'create-knowledge-check') {
      const existing = state.knowledgeChecks.find((check) => check.id === receipt.recordId);
      if (existing) return clone(existing);
    }
    if (state.knowledgeChecks.some((check) => check.todayItemId === input.todayItemId)) throw new Error('This Quiz / Test item already has a knowledge check.');
    const questions = normalizeKnowledgeQuestions(input.questions);
    const title = normalizeStudioTitle(input.title);
    const fingerprint = canonicalFingerprint('create-knowledge-check', {
      organizationId: input.organizationId, householdId: input.householdId, learnerId: input.learnerId, todayItemId: input.todayItemId,
      title: title.toLowerCase(), questions: questions.map((question) => ({ type: question.type, prompt: question.prompt.toLowerCase(), options: question.options.map((option) => option.toLowerCase()), correctOption: question.correctOption }))
    });
    this.ensureNotQueued(fingerprint);
    const check: KnowledgeCheck = { id: input.checkId ?? crypto.randomUUID(), organizationId: input.organizationId, householdId: input.householdId, learnerId: input.learnerId, todayItemId: input.todayItemId, title, questions, createdBy: input.createdBy, createdAt: now() };
    state.knowledgeChecks.push(check);
    state.receipts[operationId] = { kind: 'create-knowledge-check', recordId: check.id };
    saveState(state);
    this.enqueue({ id: operationId, kind: 'create-knowledge-check', fingerprint, payload: { ...check, operationId } });
    return clone(check);
  }

  async listKnowledgeAttempts(organizationId: string, learnerId?: string): Promise<KnowledgeAttempt[]> {
    return clone(loadState().knowledgeAttempts.filter((attempt) => attempt.organizationId === organizationId && (!learnerId || attempt.learnerId === learnerId)).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)));
  }

  async submitKnowledgeAttempt(input: SubmitKnowledgeAttemptInput): Promise<KnowledgeAttempt> {
    this.assertHostedBoundary();
    const state = loadState();
    const operationId = input.operationId ?? crypto.randomUUID();
    const receipt = state.receipts[operationId];
    if (receipt?.kind === 'submit-knowledge-attempt') {
      const existing = state.knowledgeAttempts.find((attempt) => attempt.id === receipt.recordId);
      if (existing) return clone(existing);
    }
    const check = state.knowledgeChecks.find((candidate) => candidate.id === input.checkId && candidate.learnerId === input.learnerId);
    if (!check) throw new Error('The assigned knowledge check was not found.');
    const priorAttempt = state.knowledgeAttempts.find((attempt) => attempt.checkId === check.id && attempt.learnerId === input.learnerId);
    if (priorAttempt) return clone(priorAttempt);
    const score = scoreKnowledgeCheck(check, input.answers);
    const fingerprint = canonicalFingerprint('submit-knowledge-attempt', { checkId: check.id, learnerId: input.learnerId, answers: score.answers });
    this.ensureNotQueued(fingerprint);
    const attempt: KnowledgeAttempt = { id: input.attemptId ?? crypto.randomUUID(), organizationId: check.organizationId, householdId: check.householdId, learnerId: check.learnerId, todayItemId: check.todayItemId, checkId: check.id, ...score, submittedAt: now() };
    state.knowledgeAttempts.push(attempt);
    state.receipts[operationId] = { kind: 'submit-knowledge-attempt', recordId: attempt.id };
    saveState(state);
    this.enqueue({ id: operationId, kind: 'submit-knowledge-attempt', fingerprint, payload: { ...attempt, operationId } });
    return clone(attempt);
  }

  async listEvidenceSubmissions(organizationId: string, learnerId?: string): Promise<EvidenceSubmission[]> {
    return clone(loadState().evidenceSubmissions.filter((submission) => submission.organizationId === organizationId && (!learnerId || submission.learnerId === learnerId)).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)));
  }

  async submitEvidence(input: SubmitEvidenceInput): Promise<EvidenceSubmission> {
    this.assertHostedBoundary();
    const state = loadState();
    const operationId = input.operationId ?? crypto.randomUUID();
    const receipt = state.receipts[operationId];
    if (receipt?.kind === 'submit-evidence') {
      const existing = state.evidenceSubmissions.find((submission) => submission.id === receipt.recordId);
      if (existing) return clone(existing);
    }
    const history = state.evidenceSubmissions.filter((submission) => submission.todayItemId === input.todayItemId && submission.learnerId === input.learnerId).sort((left, right) => right.revision - left.revision);
    const latest = history[0];
    if (latest && latest.status !== 'returned') throw new Error('This proof already has a submission waiting for or accepted by an adult.');
    const title = normalizeStudioTitle(input.title);
    const content = normalizeEvidenceContent(input.content, input.kind);
    const learnerNote = normalizeStudioNote(input.learnerNote);
    const revision = (latest?.revision ?? 0) + 1;
    const fingerprint = canonicalFingerprint('submit-evidence', { organizationId: input.organizationId, learnerId: input.learnerId, todayItemId: input.todayItemId, revision, kind: input.kind, content, learnerNote });
    this.ensureNotQueued(fingerprint);
    const submission: EvidenceSubmission = { id: input.submissionId ?? crypto.randomUUID(), organizationId: input.organizationId, householdId: input.householdId, learnerId: input.learnerId, todayItemId: input.todayItemId, title, kind: input.kind, content, learnerNote, revision, previousSubmissionId: latest?.id ?? null, status: 'pending', adultFeedback: '', submittedAt: now(), reviewedAt: null, reviewedBy: null };
    state.evidenceSubmissions.push(submission);
    state.receipts[operationId] = { kind: 'submit-evidence', recordId: submission.id };
    saveState(state);
    this.enqueue({ id: operationId, kind: 'submit-evidence', fingerprint, payload: { ...submission, operationId } });
    return clone(submission);
  }

  async reviewEvidence(input: ReviewEvidenceInput): Promise<EvidenceSubmission> {
    this.assertHostedBoundary();
    const state = loadState();
    const operationId = input.operationId ?? crypto.randomUUID();
    const receipt = state.receipts[operationId];
    if (receipt?.kind === 'review-evidence') {
      const existing = state.evidenceSubmissions.find((submission) => submission.id === receipt.recordId);
      if (existing) return clone(existing);
    }
    const submission = state.evidenceSubmissions.find((candidate) => candidate.id === input.submissionId);
    if (!submission) throw new Error('The proof submission was not found.');
    if (submission.status !== 'pending') throw new Error('Only pending proof can be reviewed.');
    const feedback = normalizeStudioNote(input.adultFeedback, input.decision === 'return');
    const fingerprint = canonicalFingerprint('review-evidence', { submissionId: submission.id, decision: input.decision, feedback });
    this.ensureNotQueued(fingerprint);
    submission.status = input.decision === 'accept' ? 'accepted' : 'returned';
    submission.adultFeedback = feedback;
    submission.reviewedAt = now();
    submission.reviewedBy = input.reviewedBy;
    state.receipts[operationId] = { kind: 'review-evidence', recordId: submission.id };
    saveState(state);
    this.enqueue({ id: operationId, kind: 'review-evidence', fingerprint, payload: { submissionId: submission.id, decision: input.decision, adultFeedback: feedback, reviewedBy: input.reviewedBy, operationId } });
    return clone(submission);
  }

  async listWeeklyPlans(organizationId: string, householdId?: string): Promise<WeeklyPlan[]> {
    return clone(loadState().weeklyPlans.filter((plan) => plan.organizationId === organizationId && (!householdId || plan.householdId === householdId)).sort((left, right) => right.weekStart.localeCompare(left.weekStart)));
  }

  async createWeeklyPlan(input: CreateWeeklyPlanInput): Promise<WeeklyPlan> {
    this.assertHostedBoundary();
    const state = loadState();
    const operationId = input.operationId ?? crypto.randomUUID();
    const receipt = state.receipts[operationId];
    if (receipt?.kind === 'create-weekly-plan') {
      const existing = state.weeklyPlans.find((plan) => plan.id === receipt.recordId);
      if (existing) return clone(existing);
    }
    const existingWeek = state.weeklyPlans.find((plan) => plan.organizationId === input.organizationId && plan.householdId === input.householdId && plan.weekStart === input.weekStart);
    if (existingWeek) return clone(existingWeek);
    const title = normalizeStudioTitle(input.title);
    const fingerprint = canonicalFingerprint('create-weekly-plan', { organizationId: input.organizationId, householdId: input.householdId, weekStart: input.weekStart, title: title.toLowerCase() });
    this.ensureNotQueued(fingerprint);
    const plan: WeeklyPlan = { id: input.planId ?? crypto.randomUUID(), organizationId: input.organizationId, householdId: input.householdId, weekStart: input.weekStart, title, createdBy: input.createdBy, createdAt: now() };
    state.weeklyPlans.push(plan);
    state.receipts[operationId] = { kind: 'create-weekly-plan', recordId: plan.id };
    saveState(state);
    this.enqueue({ id: operationId, kind: 'create-weekly-plan', fingerprint, payload: { ...plan, operationId } });
    return clone(plan);
  }

  async listWeeklyPlanItems(organizationId: string, learnerId?: string): Promise<WeeklyPlanItem[]> {
    return clone(loadState().weeklyPlanItems.filter((item) => item.organizationId === organizationId && (!learnerId || item.learnerId === learnerId)).sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate) || left.createdAt.localeCompare(right.createdAt)));
  }

  async createWeeklyPlanItem(input: CreateWeeklyPlanItemInput): Promise<WeeklyPlanItem> {
    this.assertHostedBoundary();
    const state = loadState();
    const operationId = input.operationId ?? crypto.randomUUID();
    const receipt = state.receipts[operationId];
    if (receipt?.kind === 'create-weekly-plan-item') {
      const existing = state.weeklyPlanItems.find((item) => item.id === receipt.recordId);
      if (existing) return clone(existing);
    }
    const plan = state.weeklyPlans.find((candidate) => candidate.id === input.planId && candidate.householdId === input.householdId);
    if (!plan) throw new Error('Create and select a weekly plan first.');
    const scheduled = new Date(`${input.scheduledDate}T00:00:00Z`);
    const weekStart = new Date(`${plan.weekStart}T00:00:00Z`);
    const dayOffset = Math.round((scheduled.getTime() - weekStart.getTime()) / 86_400_000);
    if (!Number.isFinite(dayOffset) || dayOffset < 0 || dayOffset > 6) throw new Error('Plan item date must fall within the selected seven-day week.');
    const title = normalizeStudioTitle(input.title);
    const fingerprint = canonicalFingerprint('create-weekly-plan-item', { planId: input.planId, learnerId: input.learnerId, scheduledDate: input.scheduledDate, title: title.toLowerCase(), activityType: input.activityType, todayItemId: input.todayItemId ?? null });
    this.ensureNotQueued(fingerprint);
    const item: WeeklyPlanItem = { id: input.planItemId ?? crypto.randomUUID(), organizationId: input.organizationId, householdId: input.householdId, planId: input.planId, learnerId: input.learnerId, scheduledDate: input.scheduledDate, title, activityType: input.activityType, todayItemId: input.todayItemId ?? null, createdAt: now() };
    state.weeklyPlanItems.push(item);
    state.receipts[operationId] = { kind: 'create-weekly-plan-item', recordId: item.id };
    saveState(state);
    this.enqueue({ id: operationId, kind: 'create-weekly-plan-item', fingerprint, payload: { ...item, operationId } });
    return clone(item);
  }

  private ensureNotQueued(fingerprint: string): void { if (this.hasRemoteTarget() && this.queue.hasActiveFingerprint(fingerprint)) throw duplicateError(); }
  private enqueue(input: EnqueueSyncOperationInput): void { if (!this.hasRemoteTarget()) return; this.queue.enqueue(input); void this.queue.process(); }
  private assertHostedBoundary(): void {
    const mode = this.queue.getSnapshot().mode;
    if (mode === 'cloud-connected' || mode === 'cloud-ready') throw new Error('Hosted beta.3 learning-studio writes are deferred to beta.4. Use Local preview or Cloud simulation for this release.');
  }
  private hasRemoteTarget(): boolean { return this.queue.getSnapshot().mode === 'cloud-simulation'; }
}

export const LOCAL_STUDIO_STORAGE_KEY = STORAGE_KEY;
