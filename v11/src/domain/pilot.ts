export const STUDIO_CONFLICT_ENTITY_TYPES = [
  'knowledge-check',
  'knowledge-attempt',
  'evidence-submission',
  'weekly-plan',
  'weekly-plan-item'
] as const;

export type StudioConflictEntityType = (typeof STUDIO_CONFLICT_ENTITY_TYPES)[number];
export type StudioConflictStatus = 'open' | 'acknowledged';

export interface StudioConflict {
  id: string;
  organizationId: string;
  entityType: StudioConflictEntityType;
  recordId: string;
  summary: string;
  localDigest: string;
  remoteDigest: string;
  detectedAt: string;
  status: StudioConflictStatus;
}

export interface HostedPilotOperationalSnapshot {
  organizationId: string;
  conflicts: StudioConflict[];
  openConflictCount: number;
  lastRemoteRefreshAt: string | null;
  lastRemoteRefreshError: string;
}

export type HostedPilotListener = (snapshot: HostedPilotOperationalSnapshot) => void;
