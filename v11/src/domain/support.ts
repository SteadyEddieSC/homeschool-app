import type { AppRole } from './roles';

export const TICKET_CATEGORIES = [
  'bug',
  'feedback',
  'content',
  'account',
  'privacy',
  'question'
] as const;

export const TICKET_STATUSES = [
  'new',
  'acknowledged',
  'needs-info',
  'planned',
  'in-progress',
  'resolved',
  'closed'
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = 'normal' | 'high' | 'urgent';

export interface TicketMessage {
  id: string;
  authorId: string;
  authorLabel: string;
  authorRole: AppRole;
  body: string;
  internal: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  number: number;
  organizationId: string;
  createdBy: string;
  createdByLabel: string;
  createdByRole: AppRole;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  subject: string;
  description: string;
  route: string;
  appVersion: string;
  diagnosticsConsent: boolean;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface CreateTicketInput {
  category: TicketCategory;
  subject: string;
  description: string;
  diagnosticsConsent: boolean;
  route: string;
}

export interface SupportActor {
  id: string;
  label: string;
  role: AppRole;
  organizationId: string;
}

export interface SupportRepository {
  listTickets(actor: SupportActor): Promise<SupportTicket[]>;
  createTicket(actor: SupportActor, input: CreateTicketInput): Promise<SupportTicket>;
  addMessage(actor: SupportActor, ticketId: string, body: string, internal: boolean): Promise<SupportTicket>;
  setStatus(actor: SupportActor, ticketId: string, status: TicketStatus): Promise<SupportTicket>;
}

export function normalizeTicketText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  if (normalized.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  return normalized;
}

export function ticketStatusLabel(status: TicketStatus): string {
  return status
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
