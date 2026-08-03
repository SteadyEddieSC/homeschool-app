import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { hasCapability } from '../domain/roles';
import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  ticketStatusLabel,
  type SupportActor,
  type SupportRepository,
  type SupportTicket,
  type TicketCategory,
  type TicketStatus
} from '../domain/support';

interface SupportWorkspaceProps {
  actor: SupportActor;
  repository: SupportRepository;
}

function categoryLabel(category: TicketCategory): string {
  if (category === 'bug') return 'Report a bug';
  if (category === 'feedback') return 'Suggest an improvement';
  if (category === 'content') return 'Report confusing content';
  if (category === 'account') return 'Account help';
  if (category === 'privacy') return 'Privacy or safety concern';
  return 'Ask a question';
}

export function SupportWorkspace({ actor, repository }: SupportWorkspaceProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [category, setCategory] = useState<TicketCategory>('bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [diagnosticsConsent, setDiagnosticsConsent] = useState(false);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canManage = hasCapability(actor.role, 'manage-org-tickets');
  const canUseInternalNotes = hasCapability(actor.role, 'view-internal-support-notes');

  const loadTickets = useCallback(async () => {
    setError('');
    try {
      const nextTickets = await repository.listTickets(actor);
      setTickets(nextTickets);
      setSelectedId((current) => current && nextTickets.some((ticket) => ticket.id === current)
        ? current
        : nextTickets[0]?.id ?? '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load support tickets.');
    }
  }, [actor, repository]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? null,
    [selectedId, tickets]
  );

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const ticket = await repository.createTicket(actor, {
        category,
        subject,
        description,
        diagnosticsConsent,
        route: window.location.hash || '#/support'
      });
      setSubject('');
      setDescription('');
      setDiagnosticsConsent(false);
      setNotice(`Ticket #${ticket.number} was submitted.`);
      await loadTickets();
      setSelectedId(ticket.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the ticket.');
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicket) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await repository.addMessage(actor, selectedTicket.id, reply, internal);
      setReply('');
      setInternal(false);
      setNotice(internal ? 'Internal note added.' : 'Reply sent.');
      setTickets((current) => current.map((ticket) => ticket.id === updated.id ? updated : ticket));
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : 'Unable to send the reply.');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(status: TicketStatus) {
    if (!selectedTicket) return;
    setBusy(true);
    setError('');
    try {
      const updated = await repository.setStatus(actor, selectedTicket.id, status);
      setTickets((current) => current.map((ticket) => ticket.id === updated.id ? updated : ticket));
      setNotice(`Ticket #${updated.number} is now ${ticketStatusLabel(updated.status)}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update ticket status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="support-layout" data-testid="support-workspace">
      <section className="panel support-compose" aria-labelledby="support-new-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Help &amp; feedback</span>
            <h2 id="support-new-heading">Tell us what needs attention</h2>
          </div>
          <span className="status-chip neutral">Private support record</span>
        </div>
        <p className="muted">
          Student names, private work, and screenshots remain in the support system. Nothing is sent to the public GitHub repository automatically.
        </p>
        <form className="form-stack" onSubmit={submitTicket}>
          <label>
            <span>Request type</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as TicketCategory)}>
              {TICKET_CATEGORIES.map((option) => (
                <option key={option} value={option}>{categoryLabel(option)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Subject</span>
            <input
              data-testid="ticket-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={160}
              required
              placeholder="Briefly describe the problem or suggestion"
            />
          </label>
          <label>
            <span>Details</span>
            <textarea
              data-testid="ticket-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={4000}
              rows={6}
              required
              placeholder="What happened, what did you expect, and what would help?"
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={diagnosticsConsent}
              onChange={(event) => setDiagnosticsConsent(event.target.checked)}
            />
            <span>Include basic app version, page, browser, and screen-size diagnostics. No page content is captured.</span>
          </label>
          <button className="button primary" type="submit" disabled={busy} data-testid="submit-ticket">
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </section>

      <section className="panel support-queue" aria-labelledby="support-queue-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{canManage ? 'Organization queue' : 'My requests'}</span>
            <h2 id="support-queue-heading">Support conversations</h2>
          </div>
          <span className="count-badge">{tickets.length}</span>
        </div>

        {(error || notice) && (
          <div className={error ? 'message error' : 'message success'} role="status">
            {error || notice}
          </div>
        )}

        <div className="ticket-grid">
          <div className="ticket-list" role="list" aria-label="Support tickets">
            {tickets.length === 0 ? (
              <div className="empty-state">
                <strong>No support requests yet</strong>
                <span>Your submitted requests and replies will appear here.</span>
              </div>
            ) : tickets.map((ticket) => (
              <button
                type="button"
                key={ticket.id}
                className={`ticket-list-item ${selectedId === ticket.id ? 'active' : ''}`}
                onClick={() => setSelectedId(ticket.id)}
                role="listitem"
              >
                <span className="ticket-number">#{ticket.number}</span>
                <strong>{ticket.subject}</strong>
                <span>{ticketStatusLabel(ticket.status)} · {ticket.createdByLabel}</span>
              </button>
            ))}
          </div>

          <div className="ticket-detail" data-testid="ticket-detail">
            {!selectedTicket ? (
              <div className="empty-state tall">
                <strong>Select a request</strong>
                <span>Choose a ticket to view its conversation.</span>
              </div>
            ) : (
              <>
                <div className="ticket-detail-header">
                  <div>
                    <span className="eyebrow">Ticket #{selectedTicket.number}</span>
                    <h3>{selectedTicket.subject}</h3>
                    <p>{selectedTicket.description}</p>
                  </div>
                  <span className={`status-chip ${selectedTicket.status}`}>{ticketStatusLabel(selectedTicket.status)}</span>
                </div>
                <dl className="ticket-meta">
                  <div><dt>Category</dt><dd>{categoryLabel(selectedTicket.category)}</dd></div>
                  <div><dt>Submitted by</dt><dd>{selectedTicket.createdByLabel}</dd></div>
                  <div><dt>App version</dt><dd>{selectedTicket.appVersion}</dd></div>
                  <div><dt>Diagnostics</dt><dd>{selectedTicket.diagnosticsConsent ? 'Approved' : 'Not included'}</dd></div>
                </dl>

                {canManage && (
                  <label className="inline-control">
                    <span>Status</span>
                    <select
                      data-testid="ticket-status"
                      value={selectedTicket.status}
                      onChange={(event) => void updateStatus(event.target.value as TicketStatus)}
                      disabled={busy}
                    >
                      {TICKET_STATUSES.map((status) => (
                        <option key={status} value={status}>{ticketStatusLabel(status)}</option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="conversation" aria-label="Ticket conversation">
                  {selectedTicket.messages.length === 0 ? (
                    <p className="muted">No replies yet.</p>
                  ) : selectedTicket.messages.map((message) => (
                    <article key={message.id} className={`conversation-message ${message.internal ? 'internal' : ''}`}>
                      <div>
                        <strong>{message.authorLabel}</strong>
                        <span>{new Date(message.createdAt).toLocaleString()}</span>
                      </div>
                      {message.internal && <span className="internal-badge">Internal note</span>}
                      <p>{message.body}</p>
                    </article>
                  ))}
                </div>

                <form className="reply-form" onSubmit={submitReply}>
                  <label>
                    <span>{canManage ? 'Reply to submitter' : 'Add information'}</span>
                    <textarea
                      data-testid="ticket-reply"
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      rows={4}
                      maxLength={4000}
                      required
                    />
                  </label>
                  {canUseInternalNotes && (
                    <label className="check-row compact">
                      <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
                      <span>Internal support note — hidden from students, parents, teachers, and directors</span>
                    </label>
                  )}
                  <button className="button secondary" type="submit" disabled={busy} data-testid="submit-reply">
                    {internal ? 'Add internal note' : 'Send reply'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
