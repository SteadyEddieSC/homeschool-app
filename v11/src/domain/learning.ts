export const GRADE_BANDS = ['k-3', '4-6', '7-9', '10-12', 'mixed', 'unspecified'] as const;
export type GradeBand = (typeof GRADE_BANDS)[number];

export const LEARNER_AVATARS = ['harbor', 'dolphin', 'heron', 'turtle', 'compass', 'lighthouse'] as const;
export type LearnerAvatar = (typeof LEARNER_AVATARS)[number];

export const ACTIVITY_TYPES = ['learn', 'practice', 'quiz', 'proof'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const TODAY_ITEM_STATUSES = ['assigned', 'in-progress', 'ready-for-review', 'completed', 'returned'] as const;
export type TodayItemStatus = (typeof TODAY_ITEM_STATUSES)[number];

export type TodayTransitionAction = 'start' | 'submit-review' | 'complete' | 'return';

export interface HouseholdSummary {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
}

export interface LearnerProfile {
  id: string;
  organizationId: string;
  householdId: string;
  preferredName: string;
  pronouns: string;
  gradeBand: GradeBand;
  avatar: LearnerAvatar;
  accessMode: 'parent-assisted';
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface TodayItem {
  id: string;
  organizationId: string;
  householdId: string;
  learnerId: string;
  title: string;
  instructions: string;
  activityType: ActivityType;
  dueDate: string;
  status: TodayItemStatus;
  learnerNote: string;
  reviewFeedback: string;
  assignedBy: string;
  reviewedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHouseholdOptions {
  householdId?: string;
  operationId?: string;
}

export interface CreateLearnerInput {
  organizationId: string;
  householdId: string;
  preferredName: string;
  pronouns: string;
  gradeBand: GradeBand;
  avatar: LearnerAvatar;
  learnerId?: string;
  operationId?: string;
}

export interface CreateTodayItemInput {
  organizationId: string;
  householdId: string;
  learnerId: string;
  assignedBy: string;
  title: string;
  instructions: string;
  activityType: ActivityType;
  dueDate: string;
  itemId?: string;
  operationId?: string;
}

export interface TransitionTodayItemInput {
  itemId: string;
  action: TodayTransitionAction;
  learnerNote?: string;
  reviewFeedback?: string;
  operationId?: string;
}

export interface LearningRepository {
  listHouseholds(organizationId: string): Promise<HouseholdSummary[]>;
  createHousehold(organizationId: string, actorId: string, name: string, options?: CreateHouseholdOptions): Promise<HouseholdSummary>;
  listLearners(organizationId: string): Promise<LearnerProfile[]>;
  createLearner(input: CreateLearnerInput): Promise<LearnerProfile>;
  listTodayItems(organizationId: string, learnerId?: string): Promise<TodayItem[]>;
  createTodayItem(input: CreateTodayItemInput): Promise<TodayItem>;
  transitionTodayItem(input: TransitionTodayItemInput): Promise<TodayItem>;
}

export interface LearningSnapshot {
  households: HouseholdSummary[];
  learners: LearnerProfile[];
  todayItems: TodayItem[];
}

export interface LearningMirrorRepository extends LearningRepository {
  exportSnapshot(): LearningSnapshot;
  replaceOrganizationSnapshot(organizationId: string, snapshot: LearningSnapshot): void;
}

export function normalizeHouseholdName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 160) {
    throw new Error('Household name must be between 2 and 160 characters.');
  }
  return normalized;
}

export function normalizePreferredName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 1 || normalized.length > 120) {
    throw new Error('Preferred name must be between 1 and 120 characters.');
  }
  return normalized;
}

export function normalizePronouns(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length > 80) throw new Error('Pronouns must be 80 characters or fewer.');
  return normalized;
}

export function normalizeTitle(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 180) {
    throw new Error('Assignment title must be between 2 and 180 characters.');
  }
  return normalized;
}

export function normalizeInstructions(value: string): string {
  const normalized = value.trim();
  if (normalized.length > 3000) throw new Error('Instructions must be 3,000 characters or fewer.');
  return normalized;
}

export function normalizeNote(value: string | undefined, limit = 2000): string {
  const normalized = (value ?? '').trim();
  if (normalized.length > limit) throw new Error(`Note must be ${limit.toLocaleString()} characters or fewer.`);
  return normalized;
}

export function isGradeBand(value: string): value is GradeBand {
  return GRADE_BANDS.includes(value as GradeBand);
}

export function isLearnerAvatar(value: string): value is LearnerAvatar {
  return LEARNER_AVATARS.includes(value as LearnerAvatar);
}

export function isActivityType(value: string): value is ActivityType {
  return ACTIVITY_TYPES.includes(value as ActivityType);
}

export function isTodayItemStatus(value: string): value is TodayItemStatus {
  return TODAY_ITEM_STATUSES.includes(value as TodayItemStatus);
}

export function activityLabel(value: ActivityType): string {
  if (value === 'quiz') return 'Quiz / Test';
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
