import {
  normalizeHouseholdName,
  normalizeInstructions,
  normalizeNote,
  normalizePreferredName,
  normalizePronouns,
  normalizeTitle,
  type CreateLearnerInput,
  type CreateTodayItemInput,
  type HouseholdSummary,
  type LearnerProfile,
  type LearningRepository,
  type TodayItem,
  type TransitionTodayItemInput
} from '../domain/learning';

interface LocalLearningState {
  households: HouseholdSummary[];
  learners: LearnerProfile[];
  todayItems: TodayItem[];
}

const STORAGE_KEY = 'beaufortLearningHarbor.v11.beta1.learning';

function now(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function loadState(): LocalLearningState {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as LocalLearningState | null;
    if (value && Array.isArray(value.households) && Array.isArray(value.learners) && Array.isArray(value.todayItems)) {
      return value;
    }
  } catch {
    // Replace damaged synthetic preview state with an empty deterministic store.
  }
  const state: LocalLearningState = { households: [], learners: [], todayItems: [] };
  saveState(state);
  return state;
}

function saveState(state: LocalLearningState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function findItem(state: LocalLearningState, itemId: string): TodayItem {
  const item = state.todayItems.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error('Today item was not found.');
  return item;
}

export class LocalLearningRepository implements LearningRepository {
  async listHouseholds(organizationId: string): Promise<HouseholdSummary[]> {
    return clone(loadState().households.filter((household) => household.organizationId === organizationId));
  }

  async createHousehold(organizationId: string, _actorId: string, name: string): Promise<HouseholdSummary> {
    const state = loadState();
    const household: HouseholdSummary = {
      id: crypto.randomUUID(),
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
    const household = state.households.find((candidate) => candidate.id === input.householdId && candidate.organizationId === input.organizationId);
    if (!household) throw new Error('Create a household before adding a learner.');
    const timestamp = now();
    const learner: LearnerProfile = {
      id: crypto.randomUUID(),
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
    const learner = state.learners.find((candidate) => candidate.id === input.learnerId && candidate.householdId === input.householdId);
    if (!learner) throw new Error('Select a valid learner.');
    const timestamp = now();
    const item: TodayItem = {
      id: crypto.randomUUID(),
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
      item.status = 'returned';
      item.reviewFeedback = normalizeNote(input.reviewFeedback);
      item.reviewedBy = 'preview-household-manager';
      item.completedAt = null;
    }

    item.updatedAt = timestamp;
    saveState(state);
    return clone(item);
  }
}
