import { useEffect, useMemo, useState } from 'react';
import {
  GRADE_BANDS,
  LEARNER_AVATARS,
  type GradeBand,
  type HouseholdSummary,
  type LearnerAvatar,
  type LearnerProfile,
  type LearningRepository
} from '../domain/learning';

interface LearnersWorkspaceProps {
  organizationId: string;
  actorId: string;
  repository: LearningRepository;
  onBeginHandoff(learnerId: string): void;
}

function avatarLabel(avatar: LearnerAvatar): string {
  return avatar.charAt(0).toUpperCase() + avatar.slice(1);
}

export function LearnersWorkspace({ organizationId, actorId, repository, onBeginHandoff }: LearnersWorkspaceProps) {
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [learners, setLearners] = useState<LearnerProfile[]>([]);
  const [householdName, setHouseholdName] = useState('');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [gradeBand, setGradeBand] = useState<GradeBand>('unspecified');
  const [avatar, setAvatar] = useState<LearnerAvatar>('harbor');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh(): Promise<void> {
    const [nextHouseholds, nextLearners] = await Promise.all([
      repository.listHouseholds(organizationId),
      repository.listLearners(organizationId)
    ]);
    setHouseholds(nextHouseholds);
    setLearners(nextLearners);
    setSelectedHouseholdId((current) => current || nextHouseholds[0]?.id || '');
  }

  useEffect(() => {
    void refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load learners.'));
  }, [organizationId, repository]);

  const householdNames = useMemo(() => new Map(households.map((household) => [household.id, household.name])), [households]);

  async function createHousehold(): Promise<void> {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const created = await repository.createHousehold(organizationId, actorId, householdName);
      setHouseholdName('');
      setSelectedHouseholdId(created.id);
      setMessage(`${created.name} was created. Only household managers can add learners.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the household.');
    } finally {
      setBusy(false);
    }
  }

  async function createLearner(): Promise<void> {
    if (!selectedHouseholdId) {
      setError('Create or select a household first.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const learner = await repository.createLearner({
        organizationId,
        householdId: selectedHouseholdId,
        preferredName,
        pronouns,
        gradeBand,
        avatar
      });
      setPreferredName('');
      setPronouns('');
      setGradeBand('unspecified');
      setAvatar('harbor');
      setMessage(`${learner.preferredName} was added without an email account.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the learner.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack" data-testid="learners-workspace">
      <section className="page-heading">
        <span className="eyebrow">Parent-managed learners</span>
        <h1>Create a learner profile without creating another email account.</h1>
        <p>Beta 1 uses supervised parent-assisted device handoff. It is a focused learning view, not a separate authentication boundary.</p>
      </section>

      {message && <p className="message success" role="status">{message}</p>}
      {error && <p className="message error" role="alert">{error}</p>}

      <section className="beta-grid two-column">
        <article className="panel beta-form-card">
          <div className="section-heading"><div><span className="eyebrow">Step 1</span><h2>Household</h2></div><span className="status-chip neutral">Private boundary</span></div>
          <label className="field"><span>Household name</span><input value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="Synthetic Harbor Household" data-testid="household-name" /></label>
          <button className="button primary" type="button" onClick={() => void createHousehold()} disabled={busy || householdName.trim().length < 2} data-testid="create-household">Create household</button>
          {households.length > 0 && <div className="compact-list" aria-label="Households">{households.map((household) => <div key={household.id}><strong>{household.name}</strong><span>Household managers only</span></div>)}</div>}
        </article>

        <article className="panel beta-form-card">
          <div className="section-heading"><div><span className="eyebrow">Step 2</span><h2>Learner profile</h2></div><span className="status-chip acknowledged">No learner email</span></div>
          <label className="field"><span>Household</span><select value={selectedHouseholdId} onChange={(event) => setSelectedHouseholdId(event.target.value)} data-testid="learner-household"><option value="">Select a household</option>{households.map((household) => <option key={household.id} value={household.id}>{household.name}</option>)}</select></label>
          <label className="field"><span>Preferred name</span><input value={preferredName} onChange={(event) => setPreferredName(event.target.value)} data-testid="learner-name" /></label>
          <label className="field"><span>Pronouns <small>optional</small></span><input value={pronouns} onChange={(event) => setPronouns(event.target.value)} data-testid="learner-pronouns" /></label>
          <div className="field-row">
            <label className="field"><span>Grade band</span><select value={gradeBand} onChange={(event) => setGradeBand(event.target.value as GradeBand)} data-testid="learner-grade">{GRADE_BANDS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label className="field"><span>Avatar</span><select value={avatar} onChange={(event) => setAvatar(event.target.value as LearnerAvatar)} data-testid="learner-avatar">{LEARNER_AVATARS.map((option) => <option key={option} value={option}>{avatarLabel(option)}</option>)}</select></label>
          </div>
          <button className="button primary" type="button" onClick={() => void createLearner()} disabled={busy || !selectedHouseholdId || preferredName.trim().length < 1} data-testid="create-learner">Add learner</button>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">Household learners</span><h2>Supervised access</h2></div><span className="status-chip neutral">Parent-assisted only</span></div>
        {learners.length === 0 ? <p className="empty-state">No learners yet. Create a household, then add the first learner.</p> : <div className="learner-card-grid">{learners.map((learner) => <article className="learner-card" key={learner.id} data-testid={`learner-card-${learner.id}`}>
          <div className="learner-avatar" aria-hidden="true">{avatarLabel(learner.avatar).slice(0, 2)}</div>
          <div className="learner-card-body"><h3>{learner.preferredName}</h3><p>{learner.pronouns || 'Pronouns not provided'} · {learner.gradeBand}</p><small>{householdNames.get(learner.householdId) ?? 'Household'} · Parent-assisted</small></div>
          <button className="button secondary" type="button" onClick={() => onBeginHandoff(learner.id)} data-testid={`begin-handoff-${learner.id}`}>Start learner mode</button>
        </article>)}</div>}
      </section>
    </div>
  );
}
