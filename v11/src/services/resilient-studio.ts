import type { StudioConflict, StudioConflictEntityType } from '../domain/pilot';
import type {
  CreateKnowledgeCheckInput,
  CreateWeeklyPlanInput,
  CreateWeeklyPlanItemInput,
  EvidenceSubmission,
  KnowledgeAttempt,
  KnowledgeCheck,
  LearningStudioMirrorRepository,
  LearningStudioRepository,
  LearningStudioSnapshot,
  ReviewEvidenceInput,
  SubmitEvidenceInput,
  SubmitKnowledgeAttemptInput,
  WeeklyPlan,
  WeeklyPlanItem
} from '../domain/studio';
import type { SyncOperation } from '../domain/sync';
import { StudioConflictStore } from './studio-conflicts';
import { SyncQueueManager } from './sync-queue';

interface ResilientLearningStudioRepositoryOptions {
  local: LearningStudioMirrorRepository;
  remote?: LearningStudioRepository | null;
  queue: SyncQueueManager;
  conflicts: StudioConflictStore;
  onlineProvider?: () => boolean;
}

interface ReconciledRecords<T> {
  records: T[];
  conflicts: StudioConflict[];
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)])
    );
  }
  return value;
}

function digest(value: unknown): string {
  const text = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function conflictId(entityType: StudioConflictEntityType, recordId: string, localDigest: string, remoteDigest: string): string {
  return `${entityType}:${recordId}:${localDigest}:${remoteDigest}`;
}

function entitySummary(entityType: StudioConflictEntityType, recordId: string): string {
  const labels: Record<StudioConflictEntityType, string> = {
    'knowledge-check': 'Knowledge check',
    'knowledge-attempt': 'Knowledge attempt',
    'evidence-submission': 'Evidence submission',
    'weekly-plan': 'Weekly plan',
    'weekly-plan-item': 'Weekly plan item'
  };
  return `${labels[entityType]} ${recordId.slice(0, 8)}`;
}

function reconcileRecords<T extends { id: string; organizationId: string }>(
  organizationId: string,
  entityType: StudioConflictEntityType,
  localRecords: T[],
  remoteRecords: T[],
  activeRecordIds: Set<string>,
  semantic: (record: T) => unknown
): ReconciledRecords<T> {
  const localById = new Map(localRecords.map((record) => [record.id, record]));
  const remoteById = new Map(remoteRecords.map((record) => [record.id, record]));
  const recordIds = new Set([...localById.keys(), ...remoteById.keys()]);
  const records: T[] = [];
  const conflicts: StudioConflict[] = [];

  for (const recordId of recordIds) {
    const local = localById.get(recordId);
    const remote = remoteById.get(recordId);
    if (!local && remote) {
      records.push(remote);
      continue;
    }
    if (local && !remote) {
      records.push(local);
      continue;
    }
    if (!local || !remote) continue;

    const localDigest = digest(semantic(local));
    const remoteDigest = digest(semantic(remote));
    if (localDigest === remoteDigest) {
      records.push(remote);
      continue;
    }

    records.push(local);
    if (activeRecordIds.has(recordId)) continue;
    conflicts.push({
      id: conflictId(entityType, recordId, localDigest, remoteDigest),
      organizationId,
      entityType,
      recordId,
      summary: entitySummary(entityType, recordId),
      localDigest,
      remoteDigest,
      detectedAt: new Date().toISOString(),
      status: 'open'
    });
  }

  return { records, conflicts };
}

function activeStudioRecordIds(operations: SyncOperation[]): Set<string> {
  const ids = new Set<string>();
  for (const operation of operations) {
    if (!['pending', 'syncing', 'failed'].includes(operation.status)) continue;
    const payload = operation.payload as unknown as Record<string, unknown>;
    if (operation.kind === 'review-evidence' && typeof payload.submissionId === 'string') {
      ids.add(payload.submissionId);
      continue;
    }
    if ([
      'create-knowledge-check',
      'submit-knowledge-attempt',
      'submit-evidence',
      'create-weekly-plan',
      'create-weekly-plan-item'
    ].includes(operation.kind) && typeof payload.id === 'string') {
      ids.add(payload.id);
    }
  }
  return ids;
}

function checkSemantic(record: KnowledgeCheck): unknown {
  return {
    id: record.id,
    organizationId: record.organizationId,
    householdId: record.householdId,
    learnerId: record.learnerId,
    todayItemId: record.todayItemId,
    title: record.title,
    questions: record.questions,
    createdBy: record.createdBy
  };
}

function attemptSemantic(record: KnowledgeAttempt): unknown {
  return {
    id: record.id,
    organizationId: record.organizationId,
    householdId: record.householdId,
    learnerId: record.learnerId,
    todayItemId: record.todayItemId,
    checkId: record.checkId,
    answers: record.answers,
    correctCount: record.correctCount,
    totalQuestions: record.totalQuestions,
    percentage: record.percentage,
    results: record.results
  };
}

function evidenceSemantic(record: EvidenceSubmission): unknown {
  return {
    id: record.id,
    organizationId: record.organizationId,
    householdId: record.householdId,
    learnerId: record.learnerId,
    todayItemId: record.todayItemId,
    title: record.title,
    kind: record.kind,
    content: record.content,
    learnerNote: record.learnerNote,
    revision: record.revision,
    previousSubmissionId: record.previousSubmissionId,
    status: record.status,
    adultFeedback: record.adultFeedback,
    reviewedBy: record.reviewedBy
  };
}

function planSemantic(record: WeeklyPlan): unknown {
  return {
    id: record.id,
    organizationId: record.organizationId,
    householdId: record.householdId,
    weekStart: record.weekStart,
    title: record.title,
    createdBy: record.createdBy
  };
}

function planItemSemantic(record: WeeklyPlanItem): unknown {
  return {
    id: record.id,
    organizationId: record.organizationId,
    householdId: record.householdId,
    planId: record.planId,
    learnerId: record.learnerId,
    scheduledDate: record.scheduledDate,
    title: record.title,
    activityType: record.activityType,
    todayItemId: record.todayItemId
  };
}

export class ResilientLearningStudioRepository implements LearningStudioRepository {
  private readonly local: LearningStudioMirrorRepository;
  private readonly remote: LearningStudioRepository | null;
  private readonly queue: SyncQueueManager;
  private readonly conflicts: StudioConflictStore;
  private readonly onlineProvider: () => boolean;
  private readonly refreshes = new Map<string, Promise<void>>();

  constructor(options: ResilientLearningStudioRepositoryOptions) {
    this.local = options.local;
    this.remote = options.remote ?? null;
    this.queue = options.queue;
    this.conflicts = options.conflicts;
    this.onlineProvider = options.onlineProvider ?? (() => navigator.onLine);
  }

  async listKnowledgeChecks(organizationId: string, learnerId?: string): Promise<KnowledgeCheck[]> {
    await this.refreshFromRemote(organizationId);
    return this.local.listKnowledgeChecks(organizationId, learnerId);
  }

  createKnowledgeCheck(input: CreateKnowledgeCheckInput): Promise<KnowledgeCheck> {
    return this.local.createKnowledgeCheck(input);
  }

  async listKnowledgeAttempts(organizationId: string, learnerId?: string): Promise<KnowledgeAttempt[]> {
    await this.refreshFromRemote(organizationId);
    return this.local.listKnowledgeAttempts(organizationId, learnerId);
  }

  submitKnowledgeAttempt(input: SubmitKnowledgeAttemptInput): Promise<KnowledgeAttempt> {
    return this.local.submitKnowledgeAttempt(input);
  }

  async listEvidenceSubmissions(organizationId: string, learnerId?: string): Promise<EvidenceSubmission[]> {
    await this.refreshFromRemote(organizationId);
    return this.local.listEvidenceSubmissions(organizationId, learnerId);
  }

  submitEvidence(input: SubmitEvidenceInput): Promise<EvidenceSubmission> {
    return this.local.submitEvidence(input);
  }

  reviewEvidence(input: ReviewEvidenceInput): Promise<EvidenceSubmission> {
    return this.local.reviewEvidence(input);
  }

  async listWeeklyPlans(organizationId: string, householdId?: string): Promise<WeeklyPlan[]> {
    await this.refreshFromRemote(organizationId);
    return this.local.listWeeklyPlans(organizationId, householdId);
  }

  createWeeklyPlan(input: CreateWeeklyPlanInput): Promise<WeeklyPlan> {
    return this.local.createWeeklyPlan(input);
  }

  async listWeeklyPlanItems(organizationId: string, learnerId?: string): Promise<WeeklyPlanItem[]> {
    await this.refreshFromRemote(organizationId);
    return this.local.listWeeklyPlanItems(organizationId, learnerId);
  }

  createWeeklyPlanItem(input: CreateWeeklyPlanItemInput): Promise<WeeklyPlanItem> {
    return this.local.createWeeklyPlanItem(input);
  }

  private async refreshFromRemote(organizationId: string): Promise<void> {
    if (!this.remote || !this.onlineProvider()) return;
    const existing = this.refreshes.get(organizationId);
    if (existing) return existing;

    const refresh = Promise.all([
      this.local.readOrganizationSnapshot(organizationId),
      this.remote.listKnowledgeChecks(organizationId),
      this.remote.listKnowledgeAttempts(organizationId),
      this.remote.listEvidenceSubmissions(organizationId),
      this.remote.listWeeklyPlans(organizationId),
      this.remote.listWeeklyPlanItems(organizationId)
    ]).then(([local, knowledgeChecks, knowledgeAttempts, evidenceSubmissions, weeklyPlans, weeklyPlanItems]) => {
      const activeRecordIds = activeStudioRecordIds(this.queue.getSnapshot().operations);
      const checks = reconcileRecords(organizationId, 'knowledge-check', local.knowledgeChecks, knowledgeChecks, activeRecordIds, checkSemantic);
      const attempts = reconcileRecords(organizationId, 'knowledge-attempt', local.knowledgeAttempts, knowledgeAttempts, activeRecordIds, attemptSemantic);
      const evidence = reconcileRecords(organizationId, 'evidence-submission', local.evidenceSubmissions, evidenceSubmissions, activeRecordIds, evidenceSemantic);
      const plans = reconcileRecords(organizationId, 'weekly-plan', local.weeklyPlans, weeklyPlans, activeRecordIds, planSemantic);
      const planItems = reconcileRecords(organizationId, 'weekly-plan-item', local.weeklyPlanItems, weeklyPlanItems, activeRecordIds, planItemSemantic);
      const snapshot: LearningStudioSnapshot = {
        knowledgeChecks: checks.records,
        knowledgeAttempts: attempts.records,
        evidenceSubmissions: evidence.records,
        weeklyPlans: plans.records,
        weeklyPlanItems: planItems.records
      };
      this.local.replaceOrganizationSnapshot(organizationId, snapshot);
      this.conflicts.replaceOrganizationConflicts(organizationId, [
        ...checks.conflicts,
        ...attempts.conflicts,
        ...evidence.conflicts,
        ...plans.conflicts,
        ...planItems.conflicts
      ]);
      this.conflicts.recordRefreshSuccess(organizationId);
    }).catch((reason: unknown) => {
      this.conflicts.recordRefreshFailure(organizationId, reason);
    }).finally(() => {
      this.refreshes.delete(organizationId);
    });

    this.refreshes.set(organizationId, refresh);
    return refresh;
  }
}
