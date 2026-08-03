import {
  type EnqueueSyncOperationInput,
  type SyncOperation,
  type SyncOperationExecutor,
  type SyncQueueListener,
  type SyncQueueSnapshot
} from '../domain/sync';

const STORAGE_KEY = 'beaufortLearningHarbor.v11.beta2.syncQueue';
const MAX_OPERATIONS = 250;

interface StoredQueueState {
  schema: 'beaufort-learning-harbor-sync-queue-v1';
  lastSuccessfulSyncAt: string | null;
  operations: SyncOperation[];
}

function now(): string {
  return new Date().toISOString();
}

function emptyState(): StoredQueueState {
  return {
    schema: 'beaufort-learning-harbor-sync-queue-v1',
    lastSuccessfulSyncAt: null,
    operations: []
  };
}

function loadState(): StoredQueueState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredQueueState | null;
    if (parsed?.schema === 'beaufort-learning-harbor-sync-queue-v1' && Array.isArray(parsed.operations)) {
      return parsed;
    }
  } catch {
    // Damaged queue data is replaced with a clean queue rather than executed.
  }
  const state = emptyState();
  saveState(state);
  return state;
}

function saveState(state: StoredQueueState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...state,
    operations: state.operations.slice(-MAX_OPERATIONS)
  }));
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return 'Synchronization failed.';
}

export interface SyncQueueManagerOptions {
  mode: SyncQueueSnapshot['mode'];
  onlineProvider?: () => boolean;
}

export class SyncQueueManager {
  private readonly listeners = new Set<SyncQueueListener>();
  private processing = false;
  private enabled = true;
  private executor: SyncOperationExecutor | null = null;
  private mode: SyncQueueSnapshot['mode'];
  private readonly onlineProvider: () => boolean;

  constructor(options: SyncQueueManagerOptions) {
    this.mode = options.mode;
    this.onlineProvider = options.onlineProvider ?? (() => navigator.onLine);
  }

  setMode(mode: SyncQueueSnapshot['mode']): void {
    this.mode = mode;
    this.emit();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.emit();
    if (enabled) void this.process();
  }

  setExecutor(executor: SyncOperationExecutor | null): void {
    this.executor = executor;
  }

  subscribe(listener: SyncQueueListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): SyncQueueSnapshot {
    const state = loadState();
    const active = state.operations.filter((operation) => operation.status !== 'cancelled');
    return {
      mode: this.mode,
      online: this.onlineProvider(),
      processing: this.processing,
      pendingCount: active.filter((operation) => operation.status === 'pending' || operation.status === 'syncing').length,
      failedCount: active.filter((operation) => operation.status === 'failed').length,
      completedCount: active.filter((operation) => operation.status === 'completed').length,
      lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
      operations: structuredClone(state.operations).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    };
  }

  enqueue(input: EnqueueSyncOperationInput): SyncOperation {
    const state = loadState();
    const duplicate = state.operations.find((operation) =>
      operation.fingerprint === input.fingerprint
      && ['pending', 'syncing', 'failed'].includes(operation.status)
    );
    if (duplicate) return structuredClone(duplicate);

    const timestamp = now();
    const operation: SyncOperation = {
      id: input.id ?? crypto.randomUUID(),
      kind: input.kind,
      fingerprint: input.fingerprint,
      payload: structuredClone(input.payload),
      status: 'pending',
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      lastError: ''
    };
    state.operations.push(operation);
    saveState(state);
    this.emit();
    return structuredClone(operation);
  }

  async process(): Promise<void> {
    if (!this.enabled || this.processing || !this.executor || !this.onlineProvider()) {
      this.emit();
      return;
    }

    this.processing = true;
    this.emit();
    try {
      while (this.enabled && this.onlineProvider()) {
        const state = loadState();
        const operation = state.operations.find((candidate) => candidate.status === 'pending' || candidate.status === 'failed');
        if (!operation) break;

        operation.status = 'syncing';
        operation.attempts += 1;
        operation.updatedAt = now();
        operation.lastError = '';
        saveState(state);
        this.emit();

        try {
          await this.executor(operation);
          const latest = loadState();
          const completed = latest.operations.find((candidate) => candidate.id === operation.id);
          if (completed) {
            completed.status = 'completed';
            completed.completedAt = now();
            completed.updatedAt = completed.completedAt;
            completed.lastError = '';
            latest.lastSuccessfulSyncAt = completed.completedAt;
            saveState(latest);
          }
        } catch (error) {
          const latest = loadState();
          const failed = latest.operations.find((candidate) => candidate.id === operation.id);
          if (failed) {
            failed.status = 'failed';
            failed.updatedAt = now();
            failed.lastError = safeError(error);
            saveState(latest);
          }
          break;
        }
        this.emit();
      }
    } finally {
      this.processing = false;
      this.emit();
    }
  }

  retry(operationId?: string): void {
    const state = loadState();
    for (const operation of state.operations) {
      if (operation.status !== 'failed') continue;
      if (operationId && operation.id !== operationId) continue;
      operation.status = 'pending';
      operation.updatedAt = now();
      operation.lastError = '';
    }
    saveState(state);
    this.emit();
    void this.process();
  }

  cancel(operationId: string): void {
    const state = loadState();
    const operation = state.operations.find((candidate) => candidate.id === operationId);
    if (!operation || operation.status === 'completed') return;
    operation.status = 'cancelled';
    operation.updatedAt = now();
    saveState(state);
    this.emit();
  }

  clearCompleted(): void {
    const state = loadState();
    state.operations = state.operations.filter((operation) => operation.status !== 'completed' && operation.status !== 'cancelled');
    saveState(state);
    this.emit();
  }

  reset(): void {
    saveState(emptyState());
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export const SYNC_QUEUE_STORAGE_KEY = STORAGE_KEY;
