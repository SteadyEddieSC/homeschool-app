import { hasCapability } from '../domain/roles';
import {
  normalizeTicketText,
  type CreateTicketInput,
  type SupportActor,
  type SupportRepository,
  type SupportTicket,
  type TicketMessage,
  type TicketStatus
} from '../domain/support';

const STORAGE_KEY = 'beaufortLearningHarbor.v11.alpha1.supportTickets';
const MAX_TICKETS = 100;

function cloneTicket(ticket: SupportTicket): SupportTicket {
  return structuredClone(ticket);
}

function loadTickets(): SupportTicket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SupportTicket => Boolean(item && typeof item === 'object'));
  } catch {
    return [];
  }
}

function saveTickets(tickets: SupportTicket[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets.slice(-MAX_TICKETS)));
}

function visibleTicket(ticket: SupportTicket, actor: SupportActor): boolean {
  return ticket.createdBy === actor.id || (
    ticket.organizationId === actor.organizationId && hasCapability(actor.role, 'manage-org-tickets')
  );
}

function redactInternalMessages(ticket: SupportTicket, actor: SupportActor): SupportTicket {
  const canViewInternal = hasCapability(actor.role, 'view-internal-support-notes');
  return {
    ...cloneTicket(ticket),
    messages: ticket.messages.filter((message) => !message.internal || canViewInternal)
  };
}

function requireTicket(tickets: SupportTicket[], ticketId: string, actor: SupportActor): SupportTicket {
  const ticket = tickets.find((item) => item.id === ticketId);
  if (!ticket || !visibleTicket(ticket, actor)) throw new Error('Ticket not found or access denied.');
  return ticket;
}

export class LocalSupportRepository implements SupportRepository {
  async listTickets(actor: SupportActor): Promise<SupportTicket[]> {
    return loadTickets()
      .filter((ticket) => visibleTicket(ticket, actor))
      .map((ticket) => redactInternalMessages(ticket, actor))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async createTicket(actor: SupportActor, input: CreateTicketInput): Promise<SupportTicket> {
    const tickets = loadTickets();
    const now = new Date().toISOString();
    const highestNumber = tickets.reduce((highest, ticket) => Math.max(highest, ticket.number), 1000);
    const ticket: SupportTicket = {
      id: crypto.randomUUID(),
      number: highestNumber + 1,
      organizationId: actor.organizationId,
      createdBy: actor.id,
      createdByLabel: actor.label,
      createdByRole: actor.role,
      category: input.category,
      status: 'new',
      priority: input.category === 'privacy' ? 'high' : 'normal',
      subject: normalizeTicketText(input.subject, 'Subject', 160),
      description: normalizeTicketText(input.description, 'Description', 4000),
      route: input.route.slice(0, 240),
      appVersion: '11.0.0-alpha.1',
      diagnosticsConsent: input.diagnosticsConsent,
      createdAt: now,
      updatedAt: now,
      messages: []
    };
    tickets.push(ticket);
    saveTickets(tickets);
    return redactInternalMessages(ticket, actor);
  }

  async addMessage(actor: SupportActor, ticketId: string, body: string, internal: boolean): Promise<SupportTicket> {
    const tickets = loadTickets();
    const ticket = requireTicket(tickets, ticketId, actor);
    const canManage = hasCapability(actor.role, 'manage-org-tickets');
    if (ticket.createdBy !== actor.id && !canManage) throw new Error('Only the submitter or support staff can reply.');
    if (internal && !hasCapability(actor.role, 'view-internal-support-notes')) {
      throw new Error('Internal notes require Group Administrator or System Administrator access.');
    }
    const now = new Date().toISOString();
    const message: TicketMessage = {
      id: crypto.randomUUID(),
      authorId: actor.id,
      authorLabel: actor.label,
      authorRole: actor.role,
      body: normalizeTicketText(body, 'Reply', 4000),
      internal,
      createdAt: now
    };
    ticket.messages.push(message);
    ticket.updatedAt = now;
    if (ticket.status === 'new' && canManage) ticket.status = 'acknowledged';
    saveTickets(tickets);
    return redactInternalMessages(ticket, actor);
  }

  async setStatus(actor: SupportActor, ticketId: string, status: TicketStatus): Promise<SupportTicket> {
    if (!hasCapability(actor.role, 'manage-org-tickets')) throw new Error('Support management access is required.');
    const tickets = loadTickets();
    const ticket = requireTicket(tickets, ticketId, actor);
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    saveTickets(tickets);
    return redactInternalMessages(ticket, actor);
  }
}
