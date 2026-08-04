import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ACTIVITY_TYPES,
  activityLabel,
  type ActivityType,
  type LearnerProfile,
  type LearningRepository,
  type TodayItem
} from '../domain/learning';
import type { AppRole } from '../domain/roles';

interface TodayWorkspaceProps {
  organizationId: string;
  actorId: string;
  role: AppRole;
  repository: LearningRepository;
  handoffLearnerId: string | null;
  onBeginHandoff(learnerId: string): void;
  onEndHandoff(): void;
  renderLearnerSupplement?: (version: number, onLearningChanged: () => Promise<void>) => ReactNode;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(status: TodayItem['status']): string {
  return status.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function TodayWorkspace({
  organizationId,
  actorId,
  role,
  repository,
  handoffLearnerId,
  onBeginHandoff,
  onEndHandoff,
  renderLearnerSupplement
}: TodayWorkspaceProps) {
  const [learners, setLearners] = useState<LearnerProfile[]>([]);
  const [items, setItems] = useState<TodayItem[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('learn');
  const [dueDate, setDueDate] = useState(todayDate());
  const [learnerNotes, setLearnerNotes] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [supplementVersion, setSupplementVersion] = useState(0);

  const canManage = role === 'parent' || role === 'group-admin';

  async function refresh(): Promise<void> {
    const [nextLearners, nextItems] = await Promise.all([
      repository.listLearners(organizationId),
      repository.listTodayItems(organizationId)
    ]);
    setLearners(nextLearners);
    setItems(nextItems);
    setSelectedLearnerId((current) => current || nextLearners[0]?.id || '');
  }

  useEffect(() => {
    void refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load the Today workflow.'));
  }, [organizationId, repository]);

  const learnerMap = useMemo(() => new Map(learners.map((learner) => [learner.id, learner])), [learners]);
  const activeLearner = handoffLearnerId ? learnerMap.get(handoffLearnerId) ?? null : null;
  const visibleItems = handoffLearnerId ? items.filter((item) => item.learnerId === handoffLearnerId) : items;
  const reviewQueue = items.filter((item) => item.status === 'ready-for-review' && item.activityType !== 'proof');
  const proofReviewCount = items.filter((item) => item.status === 'ready-for-review' && item.activityType === 'proof').length;

  async function assignItem(): Promise<void> {
    const learner = learnerMap.get(selectedLearnerId);
    if (!learner) {
      setError('Create and select a learner first.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await repository.createTodayItem({
        organizationId,
        householdId: learner.householdId,
        learnerId: learner.id,
        assignedBy: actorId,
        title,
        instructions,
        activityType,
        dueDate
      });
      setTitle('');
      setInstructions('');
      setActivityType('learn');
      setMessage(`The ${activityLabel(activityType).toLowerCase()} item was assigned to ${learner.preferredName}.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to assign the item.');
    } finally {
      setBusy(false);
    }
  }

  async function transition(itemId: string, action: 'start' | 'submit-review' | 'complete' | 'return'): Promise<void> {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const item = await repository.transitionTodayItem({
        itemId,
        action,
        learnerNote: learnerNotes[itemId],
        reviewFeedback: reviewNotes[itemId]
      });
      setMessage(action === 'submit-review'
        ? 'Work was sent to the adult review queue.'
        : action === 'complete'
          ? 'The adult review marked this item complete.'
          : action === 'return'
            ? 'The item was returned with feedback.'
            : `${item.title} is now in progress.`);
      await refresh();
      setSupplementVersion((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update the item.');
    } finally {
      setBusy(false);
    }
  }

  if (handoffLearnerId) {
    return (
      <div className="learner-handoff-shell" data-testid="learner-handoff">
        <header className="handoff-header">
          <div><span className="eyebrow">Parent-assisted learner mode</span><h1>{activeLearner?.preferredName ?? 'Learner'}’s Today</h1></div>
          <button className="button ghost" type="button" onClick={onEndHandoff} data-testid="end-handoff">Return to adult view</button>
        </header>
        <main className="handoff-main">
          <section className="handoff-notice"><strong>Focused device handoff</strong><p>The adult account remains signed in. This view hides adult navigation and does not create an independent learner login.</p></section>
          {message && <p className="message success" role="status">{message}</p>}
          {error && <p className="message error" role="alert">{error}</p>}
          <div className="today-card-list">{visibleItems.length === 0 ? <p className="empty-state">Nothing is assigned yet.</p> : visibleItems.map((item) => <article className="today-card learner-view" key={item.id} data-testid={`handoff-item-${item.id}`}>
            <div className="today-card-heading"><div><span className="eyebrow">{activityLabel(item.activityType)}</span><h2>{item.title}</h2></div><span className={`status-chip status-${item.status}`}>{statusLabel(item.status)}</span></div>
            {item.instructions && <p>{item.instructions}</p>}
            <p className="muted">Due {item.dueDate}</p>
            {item.reviewFeedback && <div className="feedback-box"><strong>Adult feedback</strong><p>{item.reviewFeedback}</p></div>}
            {['assigned', 'returned'].includes(item.status) && <button className="button primary" type="button" disabled={busy} onClick={() => void transition(item.id, 'start')} data-testid={`start-item-${item.id}`}>Start</button>}
            {item.status === 'in-progress' && item.activityType !== 'quiz' && item.activityType !== 'proof' && <div className="review-submit"><label className="field"><span>Note for the adult reviewer <small>optional</small></span><textarea value={learnerNotes[item.id] ?? ''} onChange={(event) => setLearnerNotes((current) => ({ ...current, [item.id]: event.target.value }))} data-testid={`learner-note-${item.id}`} /></label><button className="button primary" type="button" disabled={busy} onClick={() => void transition(item.id, 'submit-review')} data-testid={`submit-review-${item.id}`}>Send for review</button></div>}
            {item.status === 'in-progress' && ['quiz', 'proof'].includes(item.activityType) && <p className="message info">Continue below to complete the knowledge check or submit proof.</p>}
            {item.status === 'ready-for-review' && <p className="message info">Waiting for an adult review. No grade, mastery, attendance, or XP is awarded automatically.</p>}
            {item.status === 'completed' && <p className="message success">Adult review completed this item.</p>}
          </article>)}</div>
          {renderLearnerSupplement?.(supplementVersion, refresh)}
        </main>
      </div>
    );
  }

  return (
    <div className="page-stack" data-testid="today-workspace">
      <section className="hero-panel">
        <div><span className="eyebrow">Household learning day</span><h1>{canManage ? 'Assign, hand off, score, and review without hidden outcomes.' : 'Know what happens next.'}</h1><p>{canManage ? 'Beta 3 keeps Today as the clear path into objective checks, subjective proof, weekly planning, and explicit adult decisions.' : 'Learner work remains visible only through an authorized household relationship.'}</p></div>
        <div className="hero-badge"><strong>v11</strong><span>Beta 3</span></div>
      </section>

      {message && <p className="message success" role="status">{message}</p>}
      {error && <p className="message error" role="alert">{error}</p>}

      {canManage && <section className="beta-grid two-column">
        <article className="panel beta-form-card">
          <div className="section-heading"><div><span className="eyebrow">Assign</span><h2>Add a Today item</h2></div><span className="status-chip neutral">Adult-created</span></div>
          <label className="field"><span>Learner</span><select value={selectedLearnerId} onChange={(event) => setSelectedLearnerId(event.target.value)} data-testid="assignment-learner"><option value="">Select a learner</option>{learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.preferredName}</option>)}</select></label>
          <label className="field"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} data-testid="assignment-title" /></label>
          <label className="field"><span>Instructions <small>optional</small></span><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} data-testid="assignment-instructions" /></label>
          <div className="field-row"><label className="field"><span>Activity</span><select value={activityType} onChange={(event) => setActivityType(event.target.value as ActivityType)} data-testid="assignment-type">{ACTIVITY_TYPES.map((option) => <option key={option} value={option}>{activityLabel(option)}</option>)}</select></label><label className="field"><span>Due date</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} data-testid="assignment-due" /></label></div>
          <button className="button primary" type="button" disabled={busy || !selectedLearnerId || title.trim().length < 2} onClick={() => void assignItem()} data-testid="create-assignment">Assign item</button>
        </article>

        <article className="panel beta-form-card">
          <div className="section-heading"><div><span className="eyebrow">Handoff</span><h2>Choose the learner</h2></div><span className="status-chip acknowledged">Supervised</span></div>
          <p>Starting learner mode removes adult navigation until the adult explicitly exits.</p>
          <div className="compact-list">{learners.length === 0 ? <p className="empty-state">Create a learner in the Learners workspace first.</p> : learners.map((learner) => <div key={learner.id}><span><strong>{learner.preferredName}</strong><small>{items.filter((item) => item.learnerId === learner.id && item.status !== 'completed').length} open item(s)</small></span><button className="button secondary small" type="button" onClick={() => onBeginHandoff(learner.id)} data-testid={`today-handoff-${learner.id}`}>Start learner mode</button></div>)}</div>
        </article>
      </section>}

      <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">Adult review queue</span><h2>Explicit decisions only</h2></div><span className="status-chip neutral">{reviewQueue.length} waiting</span></div>
        {!canManage ? <p className="empty-state">Adult household review is not available to this role.</p> : <>{proofReviewCount > 0 && <p className="message info">{proofReviewCount} proof item(s) require explicit evidence review in Plan before completion.</p>}{reviewQueue.length === 0 ? <p className="empty-state">No objective or general work is waiting for review.</p> : <div className="today-card-list">{reviewQueue.map((item) => <article className="today-card" key={item.id} data-testid={`review-item-${item.id}`}>
          <div className="today-card-heading"><div><span className="eyebrow">{learnerMap.get(item.learnerId)?.preferredName ?? 'Learner'} · {activityLabel(item.activityType)}</span><h3>{item.title}</h3></div><span className="status-chip acknowledged">Ready for review</span></div>
          {item.learnerNote && <div className="feedback-box"><strong>Learner note</strong><p>{item.learnerNote}</p></div>}
          <label className="field"><span>Adult feedback <small>optional for complete, recommended for return</small></span><textarea value={reviewNotes[item.id] ?? ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))} data-testid={`review-note-${item.id}`} /></label>
          <div className="button-row"><button className="button primary" type="button" disabled={busy} onClick={() => void transition(item.id, 'complete')} data-testid={`complete-item-${item.id}`}>Mark complete after review</button><button className="button secondary" type="button" disabled={busy} onClick={() => void transition(item.id, 'return')} data-testid={`return-item-${item.id}`}>Return with feedback</button></div>
        </article>)}</div>}</>}
      </section>

      <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">Current queue</span><h2>All visible Today items</h2></div></div>
        <div className="today-card-list">{visibleItems.length === 0 ? <p className="empty-state">No Today items are visible yet.</p> : visibleItems.map((item) => <article className="today-card compact" key={item.id}><div className="today-card-heading"><div><span className="eyebrow">{learnerMap.get(item.learnerId)?.preferredName ?? 'Learner'} · {activityLabel(item.activityType)}</span><h3>{item.title}</h3></div><span className={`status-chip status-${item.status}`}>{statusLabel(item.status)}</span></div><p className="muted">Due {item.dueDate}. Completion is recorded only after an explicit adult review.</p></article>)}</div>
      </section>
    </div>
  );
}
