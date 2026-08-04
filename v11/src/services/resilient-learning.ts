import {
  type CreateHouseholdOptions,
  type CreateLearnerInput,
  type CreateTodayItemInput,
  type HouseholdSummary,
  type LearnerProfile,
  type LearningMirrorRepository,
  type LearningRepository,
  type LearningSnapshot,
  type TodayItem,
  type TransitionTodayItemInput
} from '../domain/learning';
import type {
  CreateHouseholdOperationPayload,
  CreateLearnerOperationPayload,
  CreateTodayItemOperationPayload,
  SyncOperation,
  TransitionTodayItemOperationPayload
} from '../domain/sync';
import { SyncQueueManager } from './sync-queue';

function canonicalFingerprint(kind: string, payload: Record<string, unknown>): string {
  const ordered = Object.fromEntries(Object.entries(payload).sort(([left], [right]) => left.localeCompare(right)));
  return `${kind}:${JSON.stringify(ordered)}`;
}

function activeDuplicateError(): Error {
  return new Error('This action is already waiting to synchronize. Retry or cancel the existing operation instead of creating a duplicate.');
}

export interface ResilientLearningRepositoryOptions {
  local: LearningMirrorRepository;
  remote?: LearningRepository | null;
  queue: SyncQueueManager;
  simulateRemote?: boolean;
  onlineProvider?: () => boolean;
}

export class ResilientLearningRepository implements LearningRepository {
  private readonly local: LearningMirrorRepository;
  private readonly remote: LearningRepository | null;
  private readonly queue: SyncQueueManager;
  private readonly simulateRemote: boolean;
  private readonly onlineProvider: () => boolean;
  private readonly refreshes = new Map<string, Promise<void>>();

  constructor(options: ResilientLearningRepositoryOptions) {
    this.local = options.local;
    this.remote = options.remote ?? null;
    this.queue = options.queue;
    this.simulateRemote = Boolean(options.simulateRemote);
    this.onlineProvider = options.onlineProvider ?? (() => navigator.onLine);
    this.queue.setExecutor((operation) => this.executeRemote(operation));
  }

  async listHouseholds(organizationId: string): Promise<HouseholdSummary[]> {
    await this.refreshFromRemote(organizationId);
    return this.local.listHouseholds(organizationId);
  }

  async createHousehold(
    organizationId: string,
    actorId: string,
    name: string,
    options: CreateHouseholdOptions = {}
  ): Promise<HouseholdSummary> {
    const fingerprint = canonicalFingerprint('create-household', {
      organizationId,
      name: name.trim().replace(/\s+/g, ' ').toLowerCase()
    });
    if (this.hasRemoteTarget() && this.queue.hasActiveFingerprint(fingerprint)) throw activeDuplicateError();

    const householdId = options.householdId ?? crypto.randomUUID();
    const operationId = options.operationId ?? crypto.randomUUID();
    const result = await this.local.createHousehold(organizationId, actorId, name, { householdId, operationId });
    if (this.hasRemoteTarget()) {
      const payload: CreateHouseholdOperationPayload = { organizationId, actorId, householdId, name: result.name };
      this.queue.enqueue({ id: operationId, kind: 'create-household', fingerprint, payload });
      void this.queue.process();
    }
    return result;
  }

  async listLearners(organizationId: string): Promise<LearnerProfile[]> {
    await this.refreshFromRemote(organizationId);
    return this.local.listLearners(organizationId);
  }

  async createLearner(input: CreateLearnerInput): Promise<LearnerProfile> {
    const fingerprint = canonicalFingerprint('create-learner', {
      organizationId: input.organizationId,
      householdId: input.householdId,
      preferredName: input.preferredName.trim().replace(/\s+/g, ' ').toLowerCase(),
      pronouns: input.pronouns.trim().replace(/\s+/g, ' ').toLowerCase(),
      gradeBand: input.gradeBand,
      avatar: input.avatar
    });
    if (this.hasRemoteTarget() && this.queue.hasActiveFingerprint(fingerprint)) throw activeDuplicateError();

    const learnerId = input.learnerId ?? crypto.randomUUID();
    const operationId = input.operationId ?? crypto.randomUUID();
    const normalizedInput = { ...input, learnerId, operationId };
    const result = await this.local.createLearner(normalizedInput);
    if (this.hasRemoteTarget()) {
      const payload: CreateLearnerOperationPayload = {
        organizationId: result.organizationId,
        householdId: result.householdId,
        preferredName: result.preferredName,
        pronouns: result.pronouns,
        gradeBand: result.gradeBand,
        avatar: result.avatar,
        learnerId
      };
      this.queue.enqueue({ id: operationId, kind: 'create-learner', fingerprint, payload });
      void this.queue.process();
    }
    return result;
  }

  async listTodayItems(organizationId: string, learnerId?: string): Promise<TodayItem[]> {
    await this.refreshFromRemote(organizationId);
    return this.local.listTodayItems(organizationId, learnerId);
  }

  async createTodayItem(input: CreateTodayItemInput): Promise<TodayItem> {
    const fingerprint = canonicalFingerprint('create-today-item', {
      organizationId: input.organizationId,
      householdId: input.householdId,
      learnerId: input.learnerId,
      title: input.title.trim().replace(/\s+/g, ' ').toLowerCase(),
      instructions: input.instructions.trim(),
      activityType: input.activityType,
      dueDate: input.dueDate
    });
    if (this.hasRemoteTarget() && this.queue.hasActiveFingerprint(fingerprint)) throw activeDuplicateError();

    const itemId = input.itemId ?? crypto.randomUUID();
    const operationId = input.operationId ?? crypto.randomUUID();
    const normalizedInput = { ...input, itemId, operationId };
    const result = await this.local.createTodayItem(normalizedInput);
    if (this.hasRemoteTarget()) {
      const payload: CreateTodayItemOperationPayload = {
        organizationId: result.organizationId,
        householdId: result.householdId,
        learnerId: result.learnerId,
        assignedBy: result.assignedBy,
        title: result.title,
        instructions: result.instructions,
        activityType: result.activityType,
        dueDate: result.dueDate,
        itemId
      };
      this.queue.enqueue({ id: operationId, kind: 'create-today-item', fingerprint, payload });
      void this.queue.process();
    }
    return result;
  }

  async transitionTodayItem(input: TransitionTodayItemInput): Promise<TodayItem> {
    const fingerprint = canonicalFingerprint('transition-today-item', {
      itemId: input.itemId,
      action: input.action,
      learnerNote: input.learnerNote?.trim() ?? '',
      reviewFeedback: input.reviewFeedback?.trim() ?? ''
    });
    if (this.hasRemoteTarget() && this.queue.hasActiveFingerprint(fingerprint)) throw activeDuplicateError();

    const operationId = input.operationId ?? crypto.randomUUID();
    const normalizedInput = { ...input, operationId };
    const result = await this.local.transitionTodayItem(normalizedInput);
    if (this.hasRemoteTarget()) {
      const payload: TransitionTodayItemOperationPayload = {
        itemId: input.itemId,
        action: input.action,
        learnerNote: input.learnerNote,
        reviewFeedback: input.reviewFeedback,
        operationId
      };
      this.queue.enqueue({ id: operationId, kind: 'transition-today-item', fingerprint, payload });
      void this.queue.process();
    }
    return result;
  }

  private hasRemoteTarget(): boolean {
    return Boolean(this.remote || this.simulateRemote);
  }

  private async refreshFromRemote(organizationId: string): Promise<void> {
    if (!this.remote || !this.onlineProvider()) return;
    const existing = this.refreshes.get(organizationId);
    if (existing) return existing;

    const refresh = Promise.all([
      this.remote.listHouseholds(organizationId),
      this.remote.listLearners(organizationId),
      this.remote.listTodayItems(organizationId)
    ]).then(([households, learners, todayItems]) => {
      const snapshot: LearningSnapshot = { households, learners, todayItems };
      this.local.replaceOrganizationSnapshot(organizationId, snapshot);
    }).catch(() => {
      // The local mirror remains available. The visible sync state communicates connectivity.
    }).finally(() => {
      this.refreshes.delete(organizationId);
    });
    this.refreshes.set(organizationId, refresh);
    return refresh;
  }

  private async executeRemote(operation: SyncOperation): Promise<void> {
    if (this.simulateRemote && !this.remote) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return;
    }
    if (!this.remote) throw new Error('Cloud synchronization is not configured.');

    if (operation.kind === 'create-household') {
      const payload = operation.payload as CreateHouseholdOperationPayload;
      await this.remote.createHousehold(payload.organizationId, payload.actorId, payload.name, {
        householdId: payload.householdId,
        operationId: operation.id
      });
      return;
    }
    if (operation.kind === 'create-learner') {
      const payload = operation.payload as CreateLearnerOperationPayload;
      await this.remote.createLearner({ ...payload, operationId: operation.id });
      return;
    }
    if (operation.kind === 'create-today-item') {
      const payload = operation.payload as CreateTodayItemOperationPayload;
      await this.remote.createTodayItem({ ...payload, operationId: operation.id });
      return;
    }
    const payload = operation.payload as TransitionTodayItemOperationPayload;
    await this.remote.transitionTodayItem({ ...payload, operationId: operation.id });
  }
}
