import type {
  CreateLearnerInput,
  CreateTodayItemInput,
  TransitionTodayItemInput
} from './learning';
import type {
  CreateKnowledgeCheckInput,
  CreateWeeklyPlanInput,
  CreateWeeklyPlanItemInput,
  ReviewEvidenceInput,
  SubmitEvidenceInput,
  SubmitKnowledgeAttemptInput
} from './studio';

export const SYNC_OPERATION_STATUSES = ['pending', 'syncing', 'failed', 'completed', 'cancelled'] as const;
export type SyncOperationStatus = (typeof SYNC_OPERATION_STATUSES)[number];

export const SYNC_OPERATION_KINDS = [
  'create-household',
  'create-learner',
  'create-today-item',
  'transition-today-item',
  'create-knowledge-check',
  'submit-knowledge-attempt',
  'submit-evidence',
  'review-evidence',
  'create-weekly-plan',
  'create-weekly-plan-item'
] as const;
export type SyncOperationKind = (typeof SYNC_OPERATION_KINDS)[number];

export type SyncOperationPayload =
  | { organizationId: string; name: string; createdBy: string; householdId: string; operationId: string }
  | (CreateLearnerInput & { learnerId: string; operationId: string })
  | (CreateTodayItemInput & { itemId: string; operationId: string })
  | (TransitionTodayItemInput & { operationId: string })
  | (CreateKnowledgeCheckInput & { checkId: string; operationId: string })
  | (SubmitKnowledgeAttemptInput & { attemptId: string; operationId: string })
  | (SubmitEvidenceInput & { submissionId: string; operationId: string })
  | (ReviewEvidenceInput & { operationId: string })
  | (CreateWeeklyPlanInput & { planId: string; operationId: string })
  | (CreateWeeklyPlanItemInput & { planItemId: string; operationId: string });

export interface SyncOperation {
  id: string;
  kind: SyncOperationKind;
  fingerprint: string;
  payload: SyncOperationPayload;
  status: SyncOperationStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  lastError: string | null;
}

export interface EnqueueSyncOperationInput {
  id: string;
  kind: SyncOperationKind;
  fingerprint: string;
  payload: SyncOperationPayload;
}

export type SyncMode = 'local-only' | 'cloud-ready' | 'cloud-simulation' | 'cloud-connected';

export interface SyncQueueSnapshot {
  mode: SyncMode;
  online: boolean;
  processing: boolean;
  pendingCount: number;
  failedCount: number;
  completedCount: number;
  lastSuccessfulSyncAt: string | null;
  operations: SyncOperation[];
}

export function syncStatusLabel(status: SyncOperationStatus): string {
  if (status === 'pending') return 'Pending';
  if (status === 'syncing') return 'Syncing';
  if (status === 'failed') return 'Failed';
  if (status === 'completed') return 'Completed';
  return 'Cancelled';
}

export function operationKindLabel(kind: SyncOperationKind): string {
  if (kind === 'create-household') return 'Create household';
  if (kind === 'create-learner') return 'Create learner';
  if (kind === 'create-today-item') return 'Create Today item';
  if (kind === 'transition-today-item') return 'Update Today item';
  if (kind === 'create-knowledge-check') return 'Create knowledge check';
  if (kind === 'submit-knowledge-attempt') return 'Submit knowledge attempt';
  if (kind === 'submit-evidence') return 'Submit proof';
  if (kind === 'review-evidence') return 'Review proof';
  if (kind === 'create-weekly-plan') return 'Create weekly plan';
  return 'Add weekly plan item';
}
