import {
  normalizeHouseholdName,
  normalizeInstructions,
  normalizeNote,
  normalizePreferredName,
  normalizePronouns,
  normalizeTitle,
  type CreateHouseholdOptions,
  type CreateLearnerInput,
  type CreateTodayItemInput,
  type HouseholdSummary,
  type LearnerProfile,
  type LearningMirrorRepository,
  type LearningSnapshot,
  type TodayItem,
  type TransitionTodayItemInput
} from '../domain/learning';

interface LocalLearningState extends LearningSnapshot {
  transitionReceipts: Record<string, string>;
}

export const LOCAL_LEARNING_STORAGE_KEY = 'beaufortLearningHarbor.v11.beta1.learning';

function now(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyState(): LocalLearningState {
  return { households: [], learners: [], todayItems: [], transitionReceipts: {} };
}

function loadState(): LocalLearningState {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_LEARNING_STORAGE_KEY) ?? 'null') as Partial<LocalLearningState> | null;
    if (value && Array.isArray(value.households) && Array.isArray(value.learners) && Array.isArray(value.todayItems)) {
      return {
        households: value.households,
        learners: value.learners,
        todayItems: value.todayItems,
        transitionReceipts: value.transitionReceipts && typeof value.transitionReceipts === 'object' ? value.transitionReceipts : {}
      };
    }
  } catch {
    // Replace damaged synthetic preview state with an empty deterministic store.
  }
  const state = emptyState();
  saveState(state);
  return state;
}

function saveState(state: LocalLearningState): void {
  localStorage.setItem(LOCAL_LEARNING_STORAGE_KEY, JSON.stringify(state));
}

function findItem(state: LocalLearningState, itemId: string): TodayItem {
  const item = state.todayItems.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error('Today item was not found.');
  return item;
}

export class LocalLearningRepository implements LearningMirrorRepository {
  async listHouseholds(organizationId: string): Promise<HouseholdSummary[]> {
    return clone(loadState().households.filter((household) => household.organizationId === organizationId));
  }

  async createHousehold(
    organizationId: string,
    _actorId: string,
    name: string,
    options: CreateHouseholdOptions = {}
  ): Promise<HouseholdSummary> {
    const state = loadState();
    if (options.householdId) {
      const existing = state.households.find((household) => household.id === options.householdId);
      if (existing) return clone(existing);
    }
    const household: HouseholdSummary = {
      id: options.householdId ?? crypto.randomUUID(),
      organizationId,
      name: normalizeHouseholdName(name),
      createdAt: now()
    };
    state.households.push(household);
    saveState(state);
    return clone(household);
  }

  async listLearners(organizationId: string): Promise<LearnerProfile[]> {
    return clone(loadState().learners.filter((learner) => learner.organizationId === organizationId));
  }

  async createLearner(input: CreateLearnerInput): Promise<LearnerProfile> {
    const state = loadState();
    if (input.learnerId) {
      const existing = state.learners.find((learner) => learner.id === input.learnerId);
      if (existing) return clone(existing);
    }
    const household = state.households.find((candidate) => candidate.id === input.householdId && candidate.organizationId === input.organizationId);
    if (!household) throw new Error('Create a household before adding a learner.');
    const timestamp = now();
    const learner: LearnerProfile = {
      id: input.learnerId ?? crypto.randomUUID(),
      organizationId: input.organizationId,
      householdId: input.householdId,
      preferredName: normalizePreferredName(input.preferredName),
      pronouns: normalizePronouns(input.pronouns),
      gradeBand: input.gradeBand,
      avatar: input.avatar,
      accessMode: 'parent-assisted',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    state.learners.push(learner);
    saveState(state);
    return clone(learner);
  }

  async listTodayItems(organizationId: string, learnerId?: string): Promise<TodayItem[]> {
    const items = loadState().todayItems
      .filter((item) => item.organizationId === organizationId && (!learnerId || item.learnerId === learnerId))
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.createdAt.localeCompare(right.createdAt));
    return clone(items);
  }

  async createTodayItem(input: CreateTodayItemInput): Promise<TodayItem> {
    const state = loadState();
    if (input.itemId) {
      const existing = state.todayItems.find((item) => item.id === input.itemId);
      if (existing) return clone(existing);
    }
    const learner = state.learners.find((candidate) => candidate.id === input.learnerId && candidate.householdId === input.householdId);
    if (!learner) throw new Error('Select a valid learner.');
    const timestamp = now();
    const item: TodayItem = {
      id: input.itemId ?? crypto.randomUUID(),
      organizationId: input.organizationId,
      householdId: input.householdId,
      learnerId: input.learnerId,
      title: normalizeTitle(input.title),
      instructions: normalizeInstructions(input.instructions),
      activityType: input.activityType,
      dueDate: input.dueDate,
      status: 'assigned',
      learnerNote: '',
      reviewFeedback: '',
      assignedBy: input.assignedBy,
      reviewedBy: null,
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    state.todayItems.push(item);
    saveState(state);
    return clone(item);
  }

  async transitionTodayItem(input: TransitionTodayItemInput): Promise<TodayItem> {
    const state = loadState();
    if (input.operationId && state.transitionReceipts[input.operationId]) {
      return clone(findItem(state, state.transitionReceipts[input.operationId]));
    }
    const item = findItem(state, input.itemId);
    const timestamp = now();

    if (input.action === 'start') {
      if (!['assigned', 'returned'].includes(item.status)) throw new Error('Only assigned or returned work can be started.');
      item.status = 'in-progress';
    } else if (input.action === 'submit-review') {
      if (item.status !== 'in-progress') throw new Error('Start the item before sending it for review.');
      item.status = 'ready-for-review';
      item.learnerNote = normalizeNote(input.learnerNote);
      item.reviewFeedback = '';
    } else if (input.action === 'complete') {
      if (item.status !== 'ready-for-review') throw new Error('Only work awaiting review can be completed.');
      item.status = 'completed';
      item.reviewFeedback = normalizeNote(input.reviewFeedback);
      item.reviewedBy = 'preview-household-manager';
      item.completedAt = timestamp;
    } else {
      if (item.status !== 'ready-for-review') throw new Error('Only work awaiting review can be returned.');
      const feedback = normalizeNote(input.reviewFeedback);
      if (!feedback) throw new Error('Feedback is required when returning work.');
      item.status = 'returned';
      item.reviewFeedback = feedback;
      item.reviewedBy = 'preview-household-manager';
      item.completedAt = null;
    }

    item.updatedAt = timestamp;
    if (input.operationId) state.transitionReceipts[input.operationId] = item.id;
    saveState(state);
    return clone(item);
  }

  exportSnapshot(): LearningSnapshot {
    const state = loadState();
    return clone({ households: state.households, learners: state.learners, todayItems: state.todayItems });
  }

  replaceOrganizationSnapshot(organizationId: string, snapshot: LearningSnapshot): void {
    const state = loadState();
    state.households = [
      ...state.households.filter((household) => household.organizationId !== organizationId),
      ...snapshot.households.filter((household) => household.organizationId === organizationId)
    ];
    state.learners = [
      ...state.learners.filter((learner) => learner.organizationId !== organizationId),
      ...snapshot.learners.filter((learner) => learner.organizationId === organizationId)
    ];
    state.todayItems = [
      ...state.todayItems.filter((item) => item.organizationId !== organizationId),
      ...snapshot.todayItems.filter((item) => item.organizationId === organizationId)
    ];
    saveState(state);
  }
}
