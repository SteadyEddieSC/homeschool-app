import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isActivityType,
  isGradeBand,
  isLearnerAvatar,
  isTodayItemStatus,
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

interface HouseholdRow {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
}

interface LearnerRow {
  id: string;
  organization_id: string;
  household_id: string;
  preferred_name: string;
  pronouns: string;
  grade_band: string;
  avatar_key: string;
  access_mode: string;
  status: LearnerProfile['status'];
  created_at: string;
  updated_at: string;
}

interface TodayItemRow {
  id: string;
  organization_id: string;
  household_id: string;
  learner_id: string;
  title: string;
  instructions: string;
  activity_type: string;
  due_date: string;
  status: string;
  learner_note: string;
  review_feedback: string;
  assigned_by: string;
  reviewed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function householdFromRow(row: HouseholdRow): HouseholdSummary {
  return { id: row.id, organizationId: row.organization_id, name: row.name, createdAt: row.created_at };
}

function learnerFromRow(row: LearnerRow): LearnerProfile {
  if (!isGradeBand(row.grade_band)) throw new Error('Learner contains an unsupported grade band.');
  if (!isLearnerAvatar(row.avatar_key)) throw new Error('Learner contains an unsupported avatar.');
  if (row.access_mode !== 'parent-assisted') throw new Error('Learner contains an unsupported access mode.');
  return {
    id: row.id,
    organizationId: row.organization_id,
    householdId: row.household_id,
    preferredName: row.preferred_name,
    pronouns: row.pronouns,
    gradeBand: row.grade_band,
    avatar: row.avatar_key,
    accessMode: row.access_mode,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function todayItemFromRow(row: TodayItemRow): TodayItem {
  if (!isActivityType(row.activity_type)) throw new Error('Today item contains an unsupported activity type.');
  if (!isTodayItemStatus(row.status)) throw new Error('Today item contains an unsupported status.');
  return {
    id: row.id,
    organizationId: row.organization_id,
    householdId: row.household_id,
    learnerId: row.learner_id,
    title: row.title,
    instructions: row.instructions,
    activityType: row.activity_type,
    dueDate: row.due_date,
    status: row.status,
    learnerNote: row.learner_note,
    reviewFeedback: row.review_feedback,
    assignedBy: row.assigned_by,
    reviewedBy: row.reviewed_by,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const learnerColumns = 'id, organization_id, household_id, preferred_name, pronouns, grade_band, avatar_key, access_mode, status, created_at, updated_at';
const todayColumns = 'id, organization_id, household_id, learner_id, title, instructions, activity_type, due_date, status, learner_note, review_feedback, assigned_by, reviewed_by, completed_at, created_at, updated_at';

export class SupabaseLearningRepository implements LearningRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listHouseholds(organizationId: string): Promise<HouseholdSummary[]> {
    const result = await this.client
      .from('households')
      .select('id, organization_id, name, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });
    if (result.error) throw result.error;
    return (result.data as HouseholdRow[]).map(householdFromRow);
  }

  async createHousehold(organizationId: string, actorId: string, name: string): Promise<HouseholdSummary> {
    const result = await this.client
      .from('households')
      .insert({ organization_id: organizationId, name: normalizeHouseholdName(name), created_by: actorId })
      .select('id, organization_id, name, created_at')
      .single();
    if (result.error) throw result.error;
    return householdFromRow(result.data as HouseholdRow);
  }

  async listLearners(organizationId: string): Promise<LearnerProfile[]> {
    const result = await this.client
      .from('learners')
      .select(learnerColumns)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });
    if (result.error) throw result.error;
    return (result.data as unknown as LearnerRow[]).map(learnerFromRow);
  }

  async createLearner(input: CreateLearnerInput): Promise<LearnerProfile> {
    const result = await this.client
      .from('learners')
      .insert({
        organization_id: input.organizationId,
        household_id: input.householdId,
        preferred_name: normalizePreferredName(input.preferredName),
        pronouns: normalizePronouns(input.pronouns),
        grade_band: input.gradeBand,
        avatar_key: input.avatar,
        access_mode: 'parent-assisted',
        status: 'active'
      })
      .select(learnerColumns)
      .single();
    if (result.error) throw result.error;
    return learnerFromRow(result.data as unknown as LearnerRow);
  }

  async listTodayItems(organizationId: string, learnerId?: string): Promise<TodayItem[]> {
    let query = this.client
      .from('learner_today_items')
      .select(todayColumns)
      .eq('organization_id', organizationId)
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (learnerId) query = query.eq('learner_id', learnerId);
    const result = await query;
    if (result.error) throw result.error;
    return (result.data as unknown as TodayItemRow[]).map(todayItemFromRow);
  }

  async createTodayItem(input: CreateTodayItemInput): Promise<TodayItem> {
    const result = await this.client
      .from('learner_today_items')
      .insert({
        organization_id: input.organizationId,
        household_id: input.householdId,
        learner_id: input.learnerId,
        assigned_by: input.assignedBy,
        title: normalizeTitle(input.title),
        instructions: normalizeInstructions(input.instructions),
        activity_type: input.activityType,
        due_date: input.dueDate,
        status: 'assigned'
      })
      .select(todayColumns)
      .single();
    if (result.error) throw result.error;
    return todayItemFromRow(result.data as unknown as TodayItemRow);
  }

  async transitionTodayItem(input: TransitionTodayItemInput): Promise<TodayItem> {
    const result = await this.client.rpc('transition_learner_today_item', {
      target_item: input.itemId,
      requested_action: input.action,
      submitted_learner_note: normalizeNote(input.learnerNote),
      submitted_review_feedback: normalizeNote(input.reviewFeedback)
    });
    if (result.error) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row) throw new Error('Today transition did not return the updated item.');
    return todayItemFromRow(row as TodayItemRow);
  }
}
