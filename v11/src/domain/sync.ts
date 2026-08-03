import type {
  CreateLearnerInput,
  CreateTodayItemInput,
  TransitionTodayItemInput
} from './learning';

export const SYNC_OPERATION_KINDS = [
  'create-household',
  'create-learner',
  'create-today-item',
  'transition-today-item'
] as const;

export const SYNC_OPERATION_STATUSES = [
  'pending',
  'syncing',
  'failed',
  'completed',
  'cancelled'
] as const;

export type SyncOperationKind = (typeof SYNC_OPERATION_KINDS)[number];
export type SyncOperationStatus = (typeof SYNC_OPERATION_STATUSES)[number];

export interface CreateHouseholdOperationPayload {
  organizationId: string;
  actorId: string;
  householdId: string;
  name: string;
}

export interface CreateLearnerOperationPayload extends CreateLearnerInput {
  learnerId: string;
}

export interface CreateTodayItemOperationPayload extends CreateTodayItemInput {
  itemId: string;
}

export interface TransitionTodayItemOperationPayload extends TransitionTodayItemInput {
  operationId: string;
}

export type SyncOperationPayload =
  | CreateHouseholdOperationPayload
  | CreateLearnerOperationPayload
  | CreateTodayItemOperationPayload
  | TransitionTodayItemOperationPayload;

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
  lastError: string;
}

export interface SyncQueueSnapshot {
  mode: 'local-only' | 'cloud-ready' | 'cloud-connected' | 'cloud-simulation';
  online: boolean;
  processing: boolean;
  pendingCount: number;
  failedCount: number;
  completedCount: number;
  lastSuccessfulSyncAt: string | null;
  operations: SyncOperation[];
}

export type SyncOperationExecutor = (operation: SyncOperation) => Promise<void>;
export type SyncQueueListener = (snapshot: SyncQueueSnapshot) => void;

export interface EnqueueSyncOperationInput {
  id?: string;
  kind: SyncOperationKind;
  fingerprint: string;
  payload: SyncOperationPayload;
}

export function syncStatusLabel(status: SyncOperationStatus): string {
  if (status === 'syncing') return 'Syncing';
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

export function operationKindLabel(kind: SyncOperationKind): string {
  if (kind === 'create-household') return 'Create household';
  if (kind === 'create-learner') return 'Create learner';
  if (kind === 'create-today-item') return 'Create Today item';
  return 'Update Today item';
}
