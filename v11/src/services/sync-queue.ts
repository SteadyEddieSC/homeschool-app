import {
  type EnqueueSyncOperationInput,
  type SyncOperation,
  type SyncOperationExecutor,
  type SyncQueueListener,
  type SyncQueueSnapshot
} from '../domain/sync';

const STORAGE_KEY = 'beaufortLearningHarbor.v11.beta2.syncQueue';
const MAX_OPERATIONS = 250;
const DEFAULT_OPERATION_TIMEOUT_MS = 20_000;

interface StoredQueueState {
  schema: 'beaufort-learning-harbor-sync-queue-v1';
  lastSuccessfulSyncAt: string | null;
  operations: SyncOperation[];
}

interface StructuredSyncError {
  code?: unknown;
  message?: unknown;
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

function structuredError(error: unknown): StructuredSyncError {
  if (!error || typeof error !== 'object') return {};
  return error as StructuredSyncError;
}

function safeProviderCode(error: unknown): string {
  const code = String(structuredError(error).code ?? '').trim().toUpperCase();
  return /^[A-Z0-9_-]{1,20}$/.test(code) ? code : '';
}

function safeError(error: unknown): string {
  const structured = structuredError(error);
  const message = error instanceof Error
    ? error.message
    : typeof structured.message === 'string'
      ? structured.message
      : '';
  const code = safeProviderCode(error);
  const normalized = `${code} ${message}`.toLowerCase();

  if (message === 'Synchronization timed out. Retry when the connection is stable.' || normalized.includes('timed out')) {
    return 'Synchronization timed out. Retry when the connection is stable.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('internet')) {
    return 'Synchronization failed because the network connection was interrupted. Retry when the connection is stable.';
  }
  if (
    code === '42501'
    || normalized.includes('permission')
    || normalized.includes('row-level')
    || normalized.includes('not authorized')
    || normalized.includes('unauthorized')
    || normalized.includes('forbidden')
  ) {
    return 'Hosted synchronization was not authorized. Confirm access and retry.';
  }
  if (message === 'Synchronization executor is unavailable.') return message;
  if (/^Hosted [A-Za-z -]+ synchronization is not configured\.$/.test(message)) return message;
  if (code) return `Hosted provider rejected synchronization (${code}). Retry or contact support.`;
  return 'Synchronization failed. Retry or contact support.';
}

function timeoutError(): Error {
  return new Error('Synchronization timed out. Retry when the connection is stable.');
}

export interface SyncQueueManagerOptions {
  mode: SyncQueueSnapshot['mode'];
  onlineProvider?: () => boolean;
  operationTimeoutMs?: number;
}

export class SyncQueueManager {
  private readonly listeners = new Set<SyncQueueListener>();
  private processing = false;
  private enabled = true;
  private executor: SyncOperationExecutor | null = null;
  private mode: SyncQueueSnapshot['mode'];
  private readonly onlineProvider: () => boolean;
  private readonly operationTimeoutMs: number;

  constructor(options: SyncQueueManagerOptions) {
    this.mode = options.mode;
    this.onlineProvider = options.onlineProvider ?? (() => navigator.onLine);
    this.operationTimeoutMs = Math.max(100, options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS);
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

  hasActiveFingerprint(fingerprint: string): boolean {
    return loadState().operations.some((operation) =>
      operation.fingerprint === fingerprint
      && ['pending', 'syncing', 'failed'].includes(operation.status)
    );
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
          await this.executeWithDeadline(operation);
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

  private async executeWithDeadline(operation: SyncOperation): Promise<void> {
    if (!this.executor) throw new Error('Synchronization executor is unavailable.');
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const deadline = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(timeoutError()), this.operationTimeoutMs);
    });
    try {
      await Promise.race([this.executor(operation), deadline]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export const SYNC_QUEUE_STORAGE_KEY = STORAGE_KEY;
