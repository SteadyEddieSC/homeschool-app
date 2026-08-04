import type {
  HostedPilotListener,
  HostedPilotOperationalSnapshot,
  StudioConflict
} from '../domain/pilot';

const STORAGE_KEY = 'beaufortLearningHarbor.v11.beta4.studioConflicts';
const STATE_SCHEMA = 'beaufort-learning-harbor-hosted-pilot-state-v1';

interface HostedPilotState {
  schema: typeof STATE_SCHEMA;
  conflicts: StudioConflict[];
  refreshes: Record<string, { lastRemoteRefreshAt: string | null; lastRemoteRefreshError: string }>;
}

function emptyState(): HostedPilotState {
  return { schema: STATE_SCHEMA, conflicts: [], refreshes: {} };
}

function loadState(): HostedPilotState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<HostedPilotState> | null;
    if (parsed?.schema === STATE_SCHEMA) {
      return {
        schema: STATE_SCHEMA,
        conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
        refreshes: parsed.refreshes && typeof parsed.refreshes === 'object' ? parsed.refreshes : {}
      };
    }
  } catch {
    // Damaged diagnostic state is discarded; learning records are never read from this store.
  }
  const state = emptyState();
  saveState(state);
  return state;
}

function saveState(state: HostedPilotState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function safeError(reason: unknown): string {
  return reason instanceof Error ? reason.message.slice(0, 500) : 'Remote refresh failed.';
}

export class StudioConflictStore {
  private readonly listeners = new Set<HostedPilotListener>();
  private activeOrganizationId = 'preview-organization';

  setActiveOrganization(organizationId: string): void {
    this.activeOrganizationId = organizationId;
    this.emit();
  }

  subscribe(listener: HostedPilotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot(this.activeOrganizationId));
    return () => this.listeners.delete(listener);
  }

  getSnapshot(organizationId = this.activeOrganizationId): HostedPilotOperationalSnapshot {
    const state = loadState();
    const conflicts = state.conflicts
      .filter((conflict) => conflict.organizationId === organizationId)
      .sort((left, right) => right.detectedAt.localeCompare(left.detectedAt));
    const refresh = state.refreshes[organizationId];
    return {
      organizationId,
      conflicts: structuredClone(conflicts),
      openConflictCount: conflicts.filter((conflict) => conflict.status === 'open').length,
      lastRemoteRefreshAt: refresh?.lastRemoteRefreshAt ?? null,
      lastRemoteRefreshError: refresh?.lastRemoteRefreshError ?? ''
    };
  }

  replaceOrganizationConflicts(organizationId: string, conflicts: StudioConflict[]): void {
    const state = loadState();
    const prior = new Map(
      state.conflicts
        .filter((conflict) => conflict.organizationId === organizationId)
        .map((conflict) => [`${conflict.entityType}:${conflict.recordId}:${conflict.localDigest}:${conflict.remoteDigest}`, conflict])
    );
    const next = conflicts.map((conflict) => {
      const previous = prior.get(`${conflict.entityType}:${conflict.recordId}:${conflict.localDigest}:${conflict.remoteDigest}`);
      return previous?.status === 'acknowledged' ? { ...conflict, status: 'acknowledged' as const } : conflict;
    });
    state.conflicts = [
      ...state.conflicts.filter((conflict) => conflict.organizationId !== organizationId),
      ...next
    ];
    saveState(state);
    this.emit();
  }

  acknowledge(conflictId: string): void {
    const state = loadState();
    const conflict = state.conflicts.find((candidate) => candidate.id === conflictId);
    if (!conflict) return;
    conflict.status = 'acknowledged';
    saveState(state);
    this.emit();
  }

  recordRefreshSuccess(organizationId: string): void {
    const state = loadState();
    state.refreshes[organizationId] = {
      lastRemoteRefreshAt: new Date().toISOString(),
      lastRemoteRefreshError: ''
    };
    saveState(state);
    this.emit();
  }

  recordRefreshFailure(organizationId: string, reason: unknown): void {
    const state = loadState();
    state.refreshes[organizationId] = {
      lastRemoteRefreshAt: state.refreshes[organizationId]?.lastRemoteRefreshAt ?? null,
      lastRemoteRefreshError: safeError(reason)
    };
    saveState(state);
    this.emit();
  }

  reset(): void {
    saveState(emptyState());
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot(this.activeOrganizationId);
    for (const listener of this.listeners) listener(snapshot);
  }
}

export const STUDIO_CONFLICT_STORAGE_KEY = STORAGE_KEY;
