export const APP_ROLES = [
  'student',
  'parent',
  'teacher',
  'director',
  'group-admin',
  'system-admin'
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type Capability =
  | 'view-today'
  | 'view-group'
  | 'manage-household-learners'
  | 'create-ticket'
  | 'view-own-tickets'
  | 'manage-org-tickets'
  | 'view-internal-support-notes'
  | 'manage-group-settings'
  | 'manage-system-settings';

export interface RoleDefinition {
  role: AppRole;
  label: string;
  description: string;
  capabilities: readonly Capability[];
}

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    role: 'student',
    label: 'Student',
    description: 'Completes assigned work and can ask for help or report a problem.',
    capabilities: ['view-today', 'create-ticket', 'view-own-tickets']
  },
  {
    role: 'parent',
    label: 'Parent / Guardian',
    description: 'Coordinates household learners, reviews work, and manages family support requests.',
    capabilities: ['view-today', 'view-group', 'manage-household-learners', 'create-ticket', 'view-own-tickets']
  },
  {
    role: 'teacher',
    label: 'Teacher / Facilitator',
    description: 'Delivers learning activities and submits instructional or platform feedback.',
    capabilities: ['view-today', 'view-group', 'create-ticket', 'view-own-tickets']
  },
  {
    role: 'director',
    label: 'Director',
    description: 'Coordinates the homeschool group and triages organization support requests without automatically opening household learner records.',
    capabilities: [
      'view-today',
      'view-group',
      'create-ticket',
      'view-own-tickets',
      'manage-org-tickets'
    ]
  },
  {
    role: 'group-admin',
    label: 'Group Administrator',
    description: 'Manages organization membership and explicitly authorized household learning operations.',
    capabilities: [
      'view-today',
      'view-group',
      'manage-household-learners',
      'create-ticket',
      'view-own-tickets',
      'manage-org-tickets',
      'view-internal-support-notes',
      'manage-group-settings'
    ]
  },
  {
    role: 'system-admin',
    label: 'System Administrator / Developer',
    description: 'Operates the platform, deployments, recovery, and technical support without automatic family-record access.',
    capabilities: [
      'view-today',
      'view-group',
      'create-ticket',
      'view-own-tickets',
      'manage-org-tickets',
      'view-internal-support-notes',
      'manage-group-settings',
      'manage-system-settings'
    ]
  }
] as const;

const roleMap = new Map(ROLE_DEFINITIONS.map((definition) => [definition.role, definition]));

export function getRoleDefinition(role: AppRole): RoleDefinition {
  const definition = roleMap.get(role);
  if (!definition) throw new Error(`Unsupported role: ${role}`);
  return definition;
}

export function hasCapability(role: AppRole, capability: Capability): boolean {
  return getRoleDefinition(role).capabilities.includes(capability);
}

export function isAppRole(value: string): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}
