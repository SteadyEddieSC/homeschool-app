import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeTicketText,
  type CreateTicketInput,
  type SupportActor,
  type SupportRepository,
  type SupportTicket,
  type TicketMessage,
  type TicketStatus
} from '../domain/support';
import { isAppRole } from '../domain/roles';

interface MessageRow {
  id: string;
  author_id: string;
  author_label: string;
  author_role: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

interface TicketRow {
  id: string;
  ticket_number: number;
  organization_id: string;
  created_by: string;
  created_by_label: string;
  created_by_role: string;
  category: SupportTicket['category'];
  status: SupportTicket['status'];
  priority: SupportTicket['priority'];
  subject: string;
  description: string;
  route: string;
  app_version: string;
  diagnostics_consent: boolean;
  created_at: string;
  updated_at: string;
  support_ticket_messages?: MessageRow[];
}

const ticketSelection = `
  id,
  ticket_number,
  organization_id,
  created_by,
  created_by_label,
  created_by_role,
  category,
  status,
  priority,
  subject,
  description,
  route,
  app_version,
  diagnostics_consent,
  created_at,
  updated_at,
  support_ticket_messages (
    id,
    author_id,
    author_label,
    author_role,
    body,
    is_internal,
    created_at
  )
`;

function messageFromRow(row: MessageRow): TicketMessage {
  if (!isAppRole(row.author_role)) throw new Error('Support message contains an unsupported author role.');
  return {
    id: row.id,
    authorId: row.author_id,
    authorLabel: row.author_label,
    authorRole: row.author_role,
    body: row.body,
    internal: row.is_internal,
    createdAt: row.created_at
  };
}

function ticketFromRow(row: TicketRow): SupportTicket {
  if (!isAppRole(row.created_by_role)) throw new Error('Support ticket contains an unsupported creator role.');
  return {
    id: row.id,
    number: row.ticket_number,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    createdByLabel: row.created_by_label,
    createdByRole: row.created_by_role,
    category: row.category,
    status: row.status,
    priority: row.priority,
    subject: row.subject,
    description: row.description,
    route: row.route,
    appVersion: row.app_version,
    diagnosticsConsent: row.diagnostics_consent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages: (row.support_ticket_messages ?? []).map(messageFromRow)
  };
}

export class SupabaseSupportRepository implements SupportRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listTickets(_actor: SupportActor): Promise<SupportTicket[]> {
    const result = await this.client
      .from('support_tickets')
      .select(ticketSelection)
      .order('updated_at', { ascending: false });
    if (result.error) throw result.error;
    return (result.data as unknown as TicketRow[]).map(ticketFromRow);
  }

  async createTicket(actor: SupportActor, input: CreateTicketInput): Promise<SupportTicket> {
    const result = await this.client
      .from('support_tickets')
      .insert({
        organization_id: actor.organizationId,
        created_by: actor.id,
        created_by_label: actor.label,
        created_by_role: actor.role,
        category: input.category,
        status: 'new',
        priority: input.category === 'privacy' ? 'high' : 'normal',
        subject: normalizeTicketText(input.subject, 'Subject', 160),
        description: normalizeTicketText(input.description, 'Description', 4000),
        route: input.route.slice(0, 240),
        app_version: '11.0.0-alpha.1',
        diagnostics_consent: input.diagnosticsConsent
      })
      .select(ticketSelection)
      .single();
    if (result.error) throw result.error;
    return ticketFromRow(result.data as unknown as TicketRow);
  }

  async addMessage(actor: SupportActor, ticketId: string, body: string, internal: boolean): Promise<SupportTicket> {
    const insertResult = await this.client.from('support_ticket_messages').insert({
      ticket_id: ticketId,
      author_id: actor.id,
      author_label: actor.label,
      author_role: actor.role,
      body: normalizeTicketText(body, 'Reply', 4000),
      is_internal: internal
    });
    if (insertResult.error) throw insertResult.error;
    return this.getTicket(ticketId);
  }

  async setStatus(_actor: SupportActor, ticketId: string, status: TicketStatus): Promise<SupportTicket> {
    const updateResult = await this.client
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId);
    if (updateResult.error) throw updateResult.error;
    return this.getTicket(ticketId);
  }

  private async getTicket(ticketId: string): Promise<SupportTicket> {
    const result = await this.client
      .from('support_tickets')
      .select(ticketSelection)
      .eq('id', ticketId)
      .single();
    if (result.error) throw result.error;
    return ticketFromRow(result.data as unknown as TicketRow);
  }
}
