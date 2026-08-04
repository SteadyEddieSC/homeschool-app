import type { SupabaseClient } from '@supabase/supabase-js';
import { isActivityType } from '../domain/learning';
import {
  normalizeEvidenceContent,
  normalizeKnowledgeQuestions,
  normalizeStudioNote,
  normalizeStudioTitle,
  type CreateKnowledgeCheckInput,
  type CreateWeeklyPlanInput,
  type CreateWeeklyPlanItemInput,
  type EvidenceKind,
  type EvidenceStatus,
  type EvidenceSubmission,
  type KnowledgeAttempt,
  type KnowledgeCheck,
  type KnowledgeQuestion,
  type KnowledgeQuestionResult,
  type LearningStudioRepository,
  type ReviewEvidenceInput,
  type SubmitEvidenceInput,
  type SubmitKnowledgeAttemptInput,
  type WeeklyPlan,
  type WeeklyPlanItem
} from '../domain/studio';

interface KnowledgeCheckRow {
  id: string;
  organization_id: string;
  household_id: string;
  learner_id: string;
  today_item_id: string;
  title: string;
  questions: unknown;
  created_by: string;
  created_at: string;
}

interface KnowledgeAttemptRow {
  id: string;
  organization_id: string;
  household_id: string;
  learner_id: string;
  today_item_id: string;
  check_id: string;
  answers: unknown;
  correct_count: number;
  total_questions: number;
  percentage: number;
  results: unknown;
  submitted_at: string;
}

interface EvidenceSubmissionRow {
  id: string;
  organization_id: string;
  household_id: string;
  learner_id: string;
  today_item_id: string;
  title: string;
  evidence_kind: string;
  content: string;
  learner_note: string;
  revision: number;
  previous_submission_id: string | null;
  status: string;
  adult_feedback: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface WeeklyPlanRow {
  id: string;
  organization_id: string;
  household_id: string;
  week_start: string;
  title: string;
  created_by: string;
  created_at: string;
}

interface WeeklyPlanItemRow {
  id: string;
  organization_id: string;
  household_id: string;
  plan_id: string;
  learner_id: string;
  scheduled_date: string;
  title: string;
  activity_type: string;
  today_item_id: string | null;
  created_at: string;
}

const checkColumns = 'id, organization_id, household_id, learner_id, today_item_id, title, questions, created_by, created_at';
const attemptColumns = 'id, organization_id, household_id, learner_id, today_item_id, check_id, answers, correct_count, total_questions, percentage, results, submitted_at';
const evidenceColumns = 'id, organization_id, household_id, learner_id, today_item_id, title, evidence_kind, content, learner_note, revision, previous_submission_id, status, adult_feedback, submitted_at, reviewed_at, reviewed_by';
const planColumns = 'id, organization_id, household_id, week_start, title, created_by, created_at';
const planItemColumns = 'id, organization_id, household_id, plan_id, learner_id, scheduled_date, title, activity_type, today_item_id, created_at';

function questionsFromJson(value: unknown): KnowledgeQuestion[] {
  if (!Array.isArray(value)) throw new Error('Knowledge check contains invalid questions.');
  return value as KnowledgeQuestion[];
}

function resultsFromJson(value: unknown): KnowledgeQuestionResult[] {
  if (!Array.isArray(value)) throw new Error('Knowledge attempt contains invalid results.');
  return value as KnowledgeQuestionResult[];
}

function answersFromJson(value: unknown): number[] {
  if (!Array.isArray(value) || value.some((answer) => !Number.isInteger(answer))) {
    throw new Error('Knowledge attempt contains invalid answers.');
  }
  return value as number[];
}

function evidenceKind(value: string): EvidenceKind {
  if (value !== 'text' && value !== 'link') throw new Error('Evidence contains an unsupported kind.');
  return value;
}

function evidenceStatus(value: string): EvidenceStatus {
  if (!['pending', 'accepted', 'returned'].includes(value)) throw new Error('Evidence contains an unsupported status.');
  return value as EvidenceStatus;
}

function checkFromRow(row: KnowledgeCheckRow): KnowledgeCheck {
  return {
    id: row.id,
    organizationId: row.organization_id,
    householdId: row.household_id,
    learnerId: row.learner_id,
    todayItemId: row.today_item_id,
    title: row.title,
    questions: questionsFromJson(row.questions),
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function attemptFromRow(row: KnowledgeAttemptRow): KnowledgeAttempt {
  return {
    id: row.id,
    organizationId: row.organization_id,
    householdId: row.household_id,
    learnerId: row.learner_id,
    todayItemId: row.today_item_id,
    checkId: row.check_id,
    answers: answersFromJson(row.answers),
    correctCount: row.correct_count,
    totalQuestions: row.total_questions,
    percentage: row.percentage,
    results: resultsFromJson(row.results),
    submittedAt: row.submitted_at
  };
}

function evidenceFromRow(row: EvidenceSubmissionRow): EvidenceSubmission {
  return {
    id: row.id,
    organizationId: row.organization_id,
    householdId: row.household_id,
    learnerId: row.learner_id,
    todayItemId: row.today_item_id,
    title: row.title,
    kind: evidenceKind(row.evidence_kind),
    content: row.content,
    learnerNote: row.learner_note,
    revision: row.revision,
    previousSubmissionId: row.previous_submission_id,
    status: evidenceStatus(row.status),
    adultFeedback: row.adult_feedback,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by
  };
}

function planFromRow(row: WeeklyPlanRow): WeeklyPlan {
  return {
    id: row.id,
    organizationId: row.organization_id,
    householdId: row.household_id,
    weekStart: row.week_start,
    title: row.title,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function planItemFromRow(row: WeeklyPlanItemRow): WeeklyPlanItem {
  if (!isActivityType(row.activity_type)) throw new Error('Plan item contains an unsupported activity type.');
  return {
    id: row.id,
    organizationId: row.organization_id,
    householdId: row.household_id,
    planId: row.plan_id,
    learnerId: row.learner_id,
    scheduledDate: row.scheduled_date,
    title: row.title,
    activityType: row.activity_type,
    todayItemId: row.today_item_id,
    createdAt: row.created_at
  };
}

export class SupabaseLearningStudioRepository implements LearningStudioRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listKnowledgeChecks(organizationId: string, learnerId?: string): Promise<KnowledgeCheck[]> {
    let query = this.client.from('knowledge_checks').select(checkColumns).eq('organization_id', organizationId).order('created_at', { ascending: false });
    if (learnerId) query = query.eq('learner_id', learnerId);
    const result = await query;
    if (result.error) throw result.error;
    return (result.data as unknown as KnowledgeCheckRow[]).map(checkFromRow);
  }

  async createKnowledgeCheck(input: CreateKnowledgeCheckInput): Promise<KnowledgeCheck> {
    const operationId = input.operationId ?? crypto.randomUUID();
    const existing = await this.client
      .from('knowledge_checks')
      .select(checkColumns)
      .eq('client_operation_id', operationId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return checkFromRow(existing.data as unknown as KnowledgeCheckRow);

    const record = {
      id: input.checkId ?? crypto.randomUUID(),
      organization_id: input.organizationId,
      household_id: input.householdId,
      learner_id: input.learnerId,
      today_item_id: input.todayItemId,
      title: normalizeStudioTitle(input.title),
      questions: normalizeKnowledgeQuestions(input.questions),
      created_by: input.createdBy,
      client_operation_id: operationId
    };
    const result = await this.client.from('knowledge_checks').insert(record).select(checkColumns).single();
    if (result.error) throw result.error;
    return checkFromRow(result.data as unknown as KnowledgeCheckRow);
  }

  async listKnowledgeAttempts(organizationId: string, learnerId?: string): Promise<KnowledgeAttempt[]> {
    let query = this.client.from('knowledge_attempts').select(attemptColumns).eq('organization_id', organizationId).order('submitted_at', { ascending: false });
    if (learnerId) query = query.eq('learner_id', learnerId);
    const result = await query;
    if (result.error) throw result.error;
    return (result.data as unknown as KnowledgeAttemptRow[]).map(attemptFromRow);
  }

  async submitKnowledgeAttempt(input: SubmitKnowledgeAttemptInput): Promise<KnowledgeAttempt> {
    const result = await this.client.rpc('submit_knowledge_attempt_v2', {
      target_check: input.checkId,
      submitted_answers: input.answers,
      operation_id: input.operationId ?? crypto.randomUUID(),
      target_attempt: input.attemptId ?? crypto.randomUUID()
    });
    if (result.error) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row) throw new Error('Knowledge attempt did not return a hosted record.');
    return attemptFromRow(row as KnowledgeAttemptRow);
  }

  async listEvidenceSubmissions(organizationId: string, learnerId?: string): Promise<EvidenceSubmission[]> {
    let query = this.client.from('evidence_submissions').select(evidenceColumns).eq('organization_id', organizationId).order('submitted_at', { ascending: false });
    if (learnerId) query = query.eq('learner_id', learnerId);
    const result = await query;
    if (result.error) throw result.error;
    return (result.data as unknown as EvidenceSubmissionRow[]).map(evidenceFromRow);
  }

  async submitEvidence(input: SubmitEvidenceInput): Promise<EvidenceSubmission> {
    const operationId = input.operationId ?? crypto.randomUUID();
    const existing = await this.client
      .from('evidence_submissions')
      .select(evidenceColumns)
      .eq('client_operation_id', operationId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return evidenceFromRow(existing.data as unknown as EvidenceSubmissionRow);

    const latest = await this.client
      .from('evidence_submissions')
      .select(evidenceColumns)
      .eq('today_item_id', input.todayItemId)
      .eq('learner_id', input.learnerId)
      .order('revision', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.error) throw latest.error;
    const prior = latest.data ? evidenceFromRow(latest.data as unknown as EvidenceSubmissionRow) : null;
    if (prior && prior.status !== 'returned') throw new Error('This proof already has a submission waiting for or accepted by an adult.');

    const record = {
      id: input.submissionId ?? crypto.randomUUID(),
      organization_id: input.organizationId,
      household_id: input.householdId,
      learner_id: input.learnerId,
      today_item_id: input.todayItemId,
      title: normalizeStudioTitle(input.title),
      evidence_kind: input.kind,
      content: normalizeEvidenceContent(input.content, input.kind),
      learner_note: normalizeStudioNote(input.learnerNote),
      revision: (prior?.revision ?? 0) + 1,
      previous_submission_id: prior?.id ?? null,
      status: 'pending',
      adult_feedback: '',
      client_operation_id: operationId,
      submitted_by: (await this.client.auth.getUser()).data.user?.id
    };
    if (!record.submitted_by) throw new Error('Authentication is required to submit proof.');
    const result = await this.client.from('evidence_submissions').insert(record).select(evidenceColumns).single();
    if (result.error) throw result.error;
    return evidenceFromRow(result.data as unknown as EvidenceSubmissionRow);
  }

  async reviewEvidence(input: ReviewEvidenceInput): Promise<EvidenceSubmission> {
    const result = await this.client.rpc('review_evidence_submission', {
      target_submission: input.submissionId,
      requested_decision: input.decision,
      submitted_feedback: normalizeStudioNote(input.adultFeedback, input.decision === 'return'),
      operation_id: input.operationId ?? crypto.randomUUID()
    });
    if (result.error) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row) throw new Error('Evidence review did not return the hosted record.');
    return evidenceFromRow(row as EvidenceSubmissionRow);
  }

  async listWeeklyPlans(organizationId: string, householdId?: string): Promise<WeeklyPlan[]> {
    let query = this.client.from('weekly_plans').select(planColumns).eq('organization_id', organizationId).order('week_start', { ascending: false });
    if (householdId) query = query.eq('household_id', householdId);
    const result = await query;
    if (result.error) throw result.error;
    return (result.data as unknown as WeeklyPlanRow[]).map(planFromRow);
  }

  async createWeeklyPlan(input: CreateWeeklyPlanInput): Promise<WeeklyPlan> {
    const operationId = input.operationId ?? crypto.randomUUID();
    const existing = await this.client
      .from('weekly_plans')
      .select(planColumns)
      .eq('client_operation_id', operationId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return planFromRow(existing.data as unknown as WeeklyPlanRow);

    const record = {
      id: input.planId ?? crypto.randomUUID(),
      organization_id: input.organizationId,
      household_id: input.householdId,
      week_start: input.weekStart,
      title: normalizeStudioTitle(input.title),
      created_by: input.createdBy,
      client_operation_id: operationId
    };
    const result = await this.client.from('weekly_plans').insert(record).select(planColumns).single();
    if (result.error) throw result.error;
    return planFromRow(result.data as unknown as WeeklyPlanRow);
  }

  async listWeeklyPlanItems(organizationId: string, learnerId?: string): Promise<WeeklyPlanItem[]> {
    let query = this.client.from('weekly_plan_items').select(planItemColumns).eq('organization_id', organizationId).order('scheduled_date', { ascending: true }).order('created_at', { ascending: true });
    if (learnerId) query = query.eq('learner_id', learnerId);
    const result = await query;
    if (result.error) throw result.error;
    return (result.data as unknown as WeeklyPlanItemRow[]).map(planItemFromRow);
  }

  async createWeeklyPlanItem(input: CreateWeeklyPlanItemInput): Promise<WeeklyPlanItem> {
    const operationId = input.operationId ?? crypto.randomUUID();
    const existing = await this.client
      .from('weekly_plan_items')
      .select(planItemColumns)
      .eq('client_operation_id', operationId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return planItemFromRow(existing.data as unknown as WeeklyPlanItemRow);

    const record = {
      id: input.planItemId ?? crypto.randomUUID(),
      organization_id: input.organizationId,
      household_id: input.householdId,
      plan_id: input.planId,
      learner_id: input.learnerId,
      scheduled_date: input.scheduledDate,
      title: normalizeStudioTitle(input.title),
      activity_type: input.activityType,
      today_item_id: input.todayItemId ?? null,
      client_operation_id: operationId
    };
    const result = await this.client.from('weekly_plan_items').insert(record).select(planItemColumns).single();
    if (result.error) throw result.error;
    return planItemFromRow(result.data as unknown as WeeklyPlanItemRow);
  }
}
