import { useEffect, useMemo, useState } from 'react';
import { ACTIVITY_TYPES, activityLabel, type ActivityType, type LearnerProfile, type LearningRepository, type TodayItem } from '../domain/learning';
import type { AppRole } from '../domain/roles';
import {
  KNOWLEDGE_QUESTION_TYPES,
  type EvidenceKind,
  type EvidenceSubmission,
  type KnowledgeAttempt,
  type KnowledgeCheck,
  type KnowledgeQuestionType,
  type LearningStudioRepository,
  type WeeklyPlan,
  type WeeklyPlanItem
} from '../domain/studio';

interface LearningStudioWorkspaceProps {
  organizationId: string;
  actorId: string;
  role: AppRole;
  learningRepository: LearningRepository;
  studioRepository: LearningStudioRepository;
  mode: 'adult' | 'learner';
  learnerId?: string;
  onLearningChanged?(): Promise<void> | void;
}

interface DraftQuestion {
  id: string;
  type: KnowledgeQuestionType;
  prompt: string;
  options: [string, string, string, string];
  correctOption: number;
  explanation: string;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function draftQuestion(): DraftQuestion {
  return {
    id: crypto.randomUUID(),
    type: 'multiple-choice',
    prompt: '',
    options: ['', '', '', ''],
    correctOption: 0,
    explanation: ''
  };
}

function evidenceStatusLabel(status: EvidenceSubmission['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function LearningStudioWorkspace({
  organizationId,
  actorId,
  role,
  learningRepository,
  studioRepository,
  mode,
  learnerId,
  onLearningChanged
}: LearningStudioWorkspaceProps) {
  const [learners, setLearners] = useState<LearnerProfile[]>([]);
  const [todayItems, setTodayItems] = useState<TodayItem[]>([]);
  const [checks, setChecks] = useState<KnowledgeCheck[]>([]);
  const [attempts, setAttempts] = useState<KnowledgeAttempt[]>([]);
  const [evidence, setEvidence] = useState<EvidenceSubmission[]>([]);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [planItems, setPlanItems] = useState<WeeklyPlanItem[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [checkLearnerId, setCheckLearnerId] = useState('');
  const [checkTodayItemId, setCheckTodayItemId] = useState('');
  const [checkTitle, setCheckTitle] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>([draftQuestion()]);
  const [answers, setAnswers] = useState<Record<string, Record<string, number>>>({});

  const [planLearnerId, setPlanLearnerId] = useState('');
  const [planWeekStart, setPlanWeekStart] = useState(todayDate());
  const [planTitle, setPlanTitle] = useState('');
  const [planItemPlanId, setPlanItemPlanId] = useState('');
  const [planItemLearnerId, setPlanItemLearnerId] = useState('');
  const [planItemDate, setPlanItemDate] = useState(todayDate());
  const [planItemTitle, setPlanItemTitle] = useState('');
  const [planItemType, setPlanItemType] = useState<ActivityType>('learn');

  const [evidenceKinds, setEvidenceKinds] = useState<Record<string, EvidenceKind>>({});
  const [evidenceContent, setEvidenceContent] = useState<Record<string, string>>({});
  const [evidenceNotes, setEvidenceNotes] = useState<Record<string, string>>({});
  const [reviewFeedback, setReviewFeedback] = useState<Record<string, string>>({});

  const canManage = role === 'parent' || role === 'group-admin';

  async function refresh(): Promise<void> {
    const [nextLearners, nextTodayItems, nextChecks, nextAttempts, nextEvidence, nextPlans, nextPlanItems] = await Promise.all([
      learningRepository.listLearners(organizationId),
      learningRepository.listTodayItems(organizationId),
      studioRepository.listKnowledgeChecks(organizationId),
      studioRepository.listKnowledgeAttempts(organizationId),
      studioRepository.listEvidenceSubmissions(organizationId),
      studioRepository.listWeeklyPlans(organizationId),
      studioRepository.listWeeklyPlanItems(organizationId)
    ]);
    setLearners(nextLearners);
    setTodayItems(nextTodayItems);
    setChecks(nextChecks);
    setAttempts(nextAttempts);
    setEvidence(nextEvidence);
    setPlans(nextPlans);
    setPlanItems(nextPlanItems);
    const firstLearner = nextLearners[0]?.id ?? '';
    setCheckLearnerId((current) => current || firstLearner);
    setPlanLearnerId((current) => current || firstLearner);
    setPlanItemLearnerId((current) => current || firstLearner);
    setPlanItemPlanId((current) => current || nextPlans[0]?.id || '');
  }

  useEffect(() => {
    void refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load planning and evidence.'));
  }, [organizationId, learningRepository, studioRepository]);

  const learnerMap = useMemo(() => new Map(learners.map((learner) => [learner.id, learner])), [learners]);
  const todayMap = useMemo(() => new Map(todayItems.map((item) => [item.id, item])), [todayItems]);
  const quizItems = todayItems.filter((item) => item.learnerId === checkLearnerId && item.activityType === 'quiz');
  const pendingEvidence = evidence.filter((submission) => submission.status === 'pending');
  const activeLearner = learnerId ? learnerMap.get(learnerId) ?? null : null;

  useEffect(() => {
    if (!quizItems.some((item) => item.id === checkTodayItemId)) setCheckTodayItemId(quizItems[0]?.id ?? '');
  }, [checkLearnerId, todayItems]);

  function updateQuestion(index: number, update: Partial<DraftQuestion>): void {
    setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...update } : question));
  }

  function updateQuestionOption(questionIndex: number, optionIndex: number, value: string): void {
    setQuestions((current) => current.map((question, currentIndex) => {
      if (currentIndex !== questionIndex) return question;
      const options: DraftQuestion['options'] = [...question.options] as DraftQuestion['options'];
      options[optionIndex] = value;
      return { ...question, options };
    }));
  }

  async function createCheck(): Promise<void> {
    const learner = learnerMap.get(checkLearnerId);
    const todayItem = todayMap.get(checkTodayItemId);
    if (!learner || !todayItem) {
      setError('Select a learner and an existing Quiz / Test Today item.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await studioRepository.createKnowledgeCheck({
        organizationId,
        householdId: learner.householdId,
        learnerId: learner.id,
        todayItemId: todayItem.id,
        title: checkTitle || todayItem.title,
        createdBy: actorId,
        questions: questions.map((question) => ({
          type: question.type,
          prompt: question.prompt,
          options: question.type === 'true-false' ? ['True', 'False'] : question.options.filter((option) => option.trim()),
          correctOption: question.correctOption,
          explanation: question.explanation
        }))
      });
      setCheckTitle('');
      setQuestions([draftQuestion()]);
      setMessage(`Knowledge check attached to ${todayItem.title}. Tool scoring will not create a grade or mastery decision.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the knowledge check.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCheck(check: KnowledgeCheck): Promise<void> {
    const selected = answers[check.id] ?? {};
    const orderedAnswers = check.questions.map((question) => selected[question.id] ?? -1);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const attempt = await studioRepository.submitKnowledgeAttempt({
        checkId: check.id,
        learnerId: check.learnerId,
        answers: orderedAnswers
      });
      const item = todayMap.get(check.todayItemId);
      if (item?.status === 'in-progress') {
        await learningRepository.transitionTodayItem({
          itemId: item.id,
          action: 'submit-review',
          learnerNote: `Tool-scored result: ${attempt.correctCount}/${attempt.totalQuestions} (${attempt.percentage}%). Adult decision still required.`
        });
        await onLearningChanged?.();
      }
      setMessage(`Check scored ${attempt.correctCount} of ${attempt.totalQuestions}. The result is informational until an adult reviews the Today item.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit the knowledge check.');
    } finally {
      setBusy(false);
    }
  }

  async function createPlan(): Promise<void> {
    const learner = learnerMap.get(planLearnerId);
    if (!learner) {
      setError('Select a learner to identify the household plan.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const plan = await studioRepository.createWeeklyPlan({
        organizationId,
        householdId: learner.householdId,
        weekStart: planWeekStart,
        title: planTitle || `Week of ${planWeekStart}`,
        createdBy: actorId
      });
      setPlanTitle('');
      setPlanItemPlanId(plan.id);
      setMessage(`${plan.title} was created. Planning does not mark any learner work complete.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the weekly plan.');
    } finally {
      setBusy(false);
    }
  }

  async function addPlanItem(): Promise<void> {
    const learner = learnerMap.get(planItemLearnerId);
    const plan = plans.find((candidate) => candidate.id === planItemPlanId);
    if (!learner || !plan) {
      setError('Select a plan and learner first.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await studioRepository.createWeeklyPlanItem({
        organizationId,
        householdId: learner.householdId,
        planId: plan.id,
        learnerId: learner.id,
        scheduledDate: planItemDate,
        title: planItemTitle,
        activityType: planItemType
      });
      setPlanItemTitle('');
      setMessage(`${planItemTitle} was added to ${learner.preferredName}’s plan.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add the plan item.');
    } finally {
      setBusy(false);
    }
  }

  async function submitProof(item: TodayItem): Promise<void> {
    const learner = learnerMap.get(item.learnerId);
    if (!learner) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const submission = await studioRepository.submitEvidence({
        organizationId,
        householdId: learner.householdId,
        learnerId: learner.id,
        todayItemId: item.id,
        title: item.title,
        kind: evidenceKinds[item.id] ?? 'text',
        content: evidenceContent[item.id] ?? '',
        learnerNote: evidenceNotes[item.id] ?? ''
      });
      if (item.status === 'in-progress') {
        await learningRepository.transitionTodayItem({
          itemId: item.id,
          action: 'submit-review',
          learnerNote: `Proof revision ${submission.revision} submitted for explicit adult review.`
        });
        await onLearningChanged?.();
      }
      setMessage(`Proof revision ${submission.revision} was sent for adult review.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit proof.');
    } finally {
      setBusy(false);
    }
  }

  async function reviewProof(submission: EvidenceSubmission, decision: 'accept' | 'return'): Promise<void> {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await studioRepository.reviewEvidence({
        submissionId: submission.id,
        decision,
        adultFeedback: reviewFeedback[submission.id] ?? '',
        reviewedBy: actorId
      });
      const item = todayMap.get(submission.todayItemId);
      if (item?.status === 'ready-for-review') {
        await learningRepository.transitionTodayItem({
          itemId: item.id,
          action: decision === 'accept' ? 'complete' : 'return',
          reviewFeedback: reviewFeedback[submission.id] ?? ''
        });
        await onLearningChanged?.();
      }
      setMessage(decision === 'accept'
        ? 'Proof was explicitly accepted and the reviewed Today item was completed.'
        : 'Proof was returned with feedback and can be revised.');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to review proof.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'learner') {
    const learnerChecks = checks.filter((check) => check.learnerId === learnerId);
    const learnerEvidence = evidence.filter((submission) => submission.learnerId === learnerId);
    const learnerPlanItems = planItems.filter((item) => item.learnerId === learnerId);
    const proofItems = todayItems.filter((item) => item.learnerId === learnerId && item.activityType === 'proof');

    return (
      <section className="learner-studio" data-testid="learner-studio">
        <div className="section-heading"><div><span className="eyebrow">Learn, check, and prove</span><h2>{activeLearner?.preferredName ?? 'Learner'}’s next steps</h2></div><span className="status-chip neutral">Adult account supervised</span></div>
        {message && <p className="message success" role="status">{message}</p>}
        {error && <p className="message error" role="alert">{error}</p>}

        <div className="studio-grid">
          <article className="panel studio-card">
            <h3>Knowledge checks</h3>
            {learnerChecks.length === 0 ? <p className="empty-state">No knowledge check is assigned.</p> : learnerChecks.map((check) => {
              const attempt = attempts.find((candidate) => candidate.checkId === check.id && candidate.learnerId === learnerId);
              const item = todayMap.get(check.todayItemId);
              return <div className="check-card" key={check.id} data-testid={`learner-check-${check.id}`}><div className="today-card-heading"><div><strong>{check.title}</strong><small>{item?.title ?? 'Quiz / Test item'}</small></div>{attempt && <span className="status-chip acknowledged">{attempt.correctCount}/{attempt.totalQuestions}</span>}</div>{attempt ? <div className="attempt-review"><p><strong>{attempt.percentage}% tool score</strong> — informational only; no grade or mastery was created.</p>{check.questions.map((question, index) => { const result = attempt.results[index]; return <p key={question.id} className={result?.correct ? 'answer-correct' : 'answer-returned'}>{index + 1}. {question.prompt}: {result?.correct ? 'Correct' : `Review ${question.options[question.correctOption] ?? 'the answer'}`}</p>; })}</div> : item?.status !== 'in-progress' ? <p className="muted">Start this Quiz / Test in Today before answering it here.</p> : <><div className="question-list">{check.questions.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {question.prompt}</legend>{question.options.map((option, optionIndex) => <label className="answer-option" key={option}><input type="radio" name={`${check.id}-${question.id}`} checked={(answers[check.id]?.[question.id] ?? -1) === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [check.id]: { ...(current[check.id] ?? {}), [question.id]: optionIndex } }))} data-testid={`answer-${check.id}-${question.id}-${optionIndex}`} /><span>{option}</span></label>)}</fieldset>)}</div><button className="button primary" type="button" disabled={busy || check.questions.some((question) => answers[check.id]?.[question.id] === undefined)} onClick={() => void submitCheck(check)} data-testid={`submit-check-${check.id}`}>Score and send for adult review</button></>}</div>;
            })}
          </article>

          <article className="panel studio-card">
            <h3>Proof and evidence</h3>
            {proofItems.length === 0 ? <p className="empty-state">No proof item is assigned.</p> : proofItems.map((item) => {
              const history = learnerEvidence.filter((submission) => submission.todayItemId === item.id).sort((left, right) => right.revision - left.revision);
              const latest = history[0];
              const canSubmit = ['in-progress', 'returned'].includes(item.status) && (!latest || latest.status === 'returned');
              return <div className="evidence-card" key={item.id} data-testid={`proof-item-${item.id}`}><div className="today-card-heading"><div><strong>{item.title}</strong><small>{history.length} submission(s)</small></div>{latest && <span className={`status-chip evidence-${latest.status}`}>{evidenceStatusLabel(latest.status)}</span>}</div>{latest?.adultFeedback && <div className="feedback-box"><strong>Adult feedback</strong><p>{latest.adultFeedback}</p></div>}{canSubmit ? <><label className="field"><span>Evidence type</span><select value={evidenceKinds[item.id] ?? 'text'} onChange={(event) => setEvidenceKinds((current) => ({ ...current, [item.id]: event.target.value as EvidenceKind }))} data-testid={`evidence-kind-${item.id}`}><option value="text">Text description</option><option value="link">Link</option></select></label><label className="field"><span>{(evidenceKinds[item.id] ?? 'text') === 'link' ? 'Evidence link' : 'Describe or paste the evidence'}</span><textarea value={evidenceContent[item.id] ?? ''} onChange={(event) => setEvidenceContent((current) => ({ ...current, [item.id]: event.target.value }))} data-testid={`evidence-content-${item.id}`} /></label><label className="field"><span>Note for the adult <small>optional</small></span><textarea value={evidenceNotes[item.id] ?? ''} onChange={(event) => setEvidenceNotes((current) => ({ ...current, [item.id]: event.target.value }))} /></label><button className="button primary" type="button" disabled={busy || (evidenceContent[item.id] ?? '').trim().length < 2} onClick={() => void submitProof(item)} data-testid={`submit-evidence-${item.id}`}>Submit proof revision {(latest?.revision ?? 0) + 1}</button></> : <p className="muted">{latest?.status === 'pending' ? 'Waiting for an adult review.' : latest?.status === 'accepted' ? 'Proof accepted and the reviewed Today item is complete.' : 'Start the returned Today item to submit a revision.'}</p>}</div>;
            })}
          </article>
        </div>

        <article className="panel studio-card">
          <h3>Weekly plan</h3>
          {learnerPlanItems.length === 0 ? <p className="empty-state">No weekly plan items are assigned.</p> : <div className="plan-list">{learnerPlanItems.map((item) => <div key={item.id}><span><strong>{item.title}</strong><small>{item.scheduledDate} · {activityLabel(item.activityType)}</small></span><span className="status-chip neutral">Planned</span></div>)}</div>}
          <p className="muted">Planning is guidance only. It does not complete, grade, or approve work.</p>
        </article>
      </section>
    );
  }

  if (!canManage) {
    return <div className="page-stack"><section className="page-heading"><span className="eyebrow">Plan &amp; evidence</span><h1>Household planning and proof review are adult-authority workflows.</h1><p>This preview role does not have household-manager authority.</p></section></div>;
  }

  return (
    <div className="page-stack" data-testid="learning-studio-workspace">
      <section className="page-heading"><span className="eyebrow">Beta 3 learning studio</span><h1>Plan the week, score objective checks, and review subjective proof without hidden outcomes.</h1><p>Tool scores remain informational. Subjective proof requires an adult decision. Plans never mark work complete.</p></section>
      {message && <p className="message success" role="status">{message}</p>}
      {error && <p className="message error" role="alert">{error}</p>}

      <section className="studio-grid adult-studio-grid">
        <article className="panel beta-form-card">
          <div className="section-heading"><div><span className="eyebrow">Objective check</span><h2>Attach questions to a Quiz / Test</h2></div><span className="status-chip acknowledged">Deterministic scoring</span></div>
          <label className="field"><span>Learner</span><select value={checkLearnerId} onChange={(event) => setCheckLearnerId(event.target.value)} data-testid="check-learner"><option value="">Select a learner</option>{learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.preferredName}</option>)}</select></label>
          <label className="field"><span>Quiz / Test Today item</span><select value={checkTodayItemId} onChange={(event) => setCheckTodayItemId(event.target.value)} data-testid="check-today-item"><option value="">Select a Quiz / Test item</option>{quizItems.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label className="field"><span>Check title</span><input value={checkTitle} onChange={(event) => setCheckTitle(event.target.value)} data-testid="check-title" /></label>
          <div className="question-builder">{questions.map((question, questionIndex) => <fieldset key={question.id}><legend>Question {questionIndex + 1}</legend><label className="field"><span>Type</span><select value={question.type} onChange={(event) => updateQuestion(questionIndex, { type: event.target.value as KnowledgeQuestionType, correctOption: 0 })} data-testid={`question-type-${questionIndex}`}>{KNOWLEDGE_QUESTION_TYPES.map((type) => <option key={type} value={type}>{type === 'true-false' ? 'True / False' : 'Multiple choice'}</option>)}</select></label><label className="field"><span>Prompt</span><input value={question.prompt} onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })} data-testid={`question-prompt-${questionIndex}`} /></label>{question.type === 'multiple-choice' && <div className="option-grid">{question.options.map((option, optionIndex) => <label className="field" key={optionIndex}><span>Option {optionIndex + 1}</span><input value={option} onChange={(event) => updateQuestionOption(questionIndex, optionIndex, event.target.value)} data-testid={`question-option-${questionIndex}-${optionIndex}`} /></label>)}</div>}<label className="field"><span>Correct answer</span><select value={question.correctOption} onChange={(event) => updateQuestion(questionIndex, { correctOption: Number(event.target.value) })} data-testid={`question-correct-${questionIndex}`}>{(question.type === 'true-false' ? ['True', 'False'] : question.options).map((option, optionIndex) => <option value={optionIndex} key={optionIndex}>{option || `Option ${optionIndex + 1}`}</option>)}</select></label><label className="field"><span>Explanation <small>optional</small></span><textarea value={question.explanation} onChange={(event) => updateQuestion(questionIndex, { explanation: event.target.value })} /></label></fieldset>)}</div>
          <div className="button-row"><button className="button secondary" type="button" onClick={() => setQuestions((current) => [...current, draftQuestion()])} disabled={questions.length >= 20}>Add question</button>{questions.length > 1 && <button className="button ghost" type="button" onClick={() => setQuestions((current) => current.slice(0, -1))}>Remove last</button>}</div>
          <button className="button primary" type="button" disabled={busy || !checkLearnerId || !checkTodayItemId || questions.some((question) => question.prompt.trim().length < 2)} onClick={() => void createCheck()} data-testid="create-check">Create knowledge check</button>
        </article>

        <article className="panel beta-form-card">
          <div className="section-heading"><div><span className="eyebrow">Weekly household plan</span><h2>Create a bounded week</h2></div><span className="status-chip neutral">Planning only</span></div>
          <label className="field"><span>Household learner</span><select value={planLearnerId} onChange={(event) => setPlanLearnerId(event.target.value)} data-testid="plan-learner">{learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.preferredName}</option>)}</select></label>
          <label className="field"><span>Week starts</span><input type="date" value={planWeekStart} onChange={(event) => setPlanWeekStart(event.target.value)} data-testid="plan-week-start" /></label>
          <label className="field"><span>Plan title</span><input value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} data-testid="plan-title" /></label>
          <button className="button primary" type="button" disabled={busy || !planLearnerId} onClick={() => void createPlan()} data-testid="create-weekly-plan">Create weekly plan</button>

          <hr />
          <h3>Add a learner plan item</h3>
          <label className="field"><span>Plan</span><select value={planItemPlanId} onChange={(event) => setPlanItemPlanId(event.target.value)} data-testid="plan-item-plan"><option value="">Select a plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</select></label>
          <label className="field"><span>Learner</span><select value={planItemLearnerId} onChange={(event) => setPlanItemLearnerId(event.target.value)} data-testid="plan-item-learner">{learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.preferredName}</option>)}</select></label>
          <div className="field-row"><label className="field"><span>Date</span><input type="date" value={planItemDate} onChange={(event) => setPlanItemDate(event.target.value)} data-testid="plan-item-date" /></label><label className="field"><span>Activity</span><select value={planItemType} onChange={(event) => setPlanItemType(event.target.value as ActivityType)} data-testid="plan-item-type">{ACTIVITY_TYPES.map((type) => <option value={type} key={type}>{activityLabel(type)}</option>)}</select></label></div>
          <label className="field"><span>Plan item title</span><input value={planItemTitle} onChange={(event) => setPlanItemTitle(event.target.value)} data-testid="plan-item-title" /></label>
          <button className="button secondary" type="button" disabled={busy || !planItemPlanId || !planItemLearnerId || planItemTitle.trim().length < 2} onClick={() => void addPlanItem()} data-testid="add-plan-item">Add plan item</button>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">Subjective proof queue</span><h2>Adult acceptance or return</h2></div><span className="status-chip neutral">{pendingEvidence.length} pending</span></div>
        {pendingEvidence.length === 0 ? <p className="empty-state">No proof is waiting for review.</p> : <div className="evidence-review-list">{pendingEvidence.map((submission) => <article className="evidence-card" key={submission.id} data-testid={`review-evidence-${submission.id}`}><div className="today-card-heading"><div><strong>{submission.title}</strong><small>{learnerMap.get(submission.learnerId)?.preferredName ?? 'Learner'} · Revision {submission.revision}</small></div><span className="status-chip acknowledged">Pending</span></div><div className="feedback-box"><strong>{submission.kind === 'link' ? 'Submitted link' : 'Submitted evidence'}</strong>{submission.kind === 'link' ? <a href={submission.content} target="_blank" rel="noreferrer">{submission.content}</a> : <p>{submission.content}</p>}</div>{submission.learnerNote && <p>{submission.learnerNote}</p>}<label className="field"><span>Adult feedback <small>required for return</small></span><textarea value={reviewFeedback[submission.id] ?? ''} onChange={(event) => setReviewFeedback((current) => ({ ...current, [submission.id]: event.target.value }))} data-testid={`evidence-feedback-${submission.id}`} /></label><div className="button-row"><button className="button primary" type="button" disabled={busy} onClick={() => void reviewProof(submission, 'accept')} data-testid={`accept-evidence-${submission.id}`}>Accept proof</button><button className="button secondary" type="button" disabled={busy} onClick={() => void reviewProof(submission, 'return')} data-testid={`return-evidence-${submission.id}`}>Return for revision</button></div></article>)}</div>}
      </section>

      <section className="studio-summary-grid">
        <article className="panel"><span className="eyebrow">Knowledge checks</span><h2>{checks.length}</h2><p>{attempts.length} deterministic attempt(s); no automatic grade or mastery.</p></article>
        <article className="panel"><span className="eyebrow">Proof history</span><h2>{evidence.length}</h2><p>Every revision and adult decision remains visible.</p></article>
        <article className="panel"><span className="eyebrow">Weekly planning</span><h2>{plans.length}</h2><p>{planItems.length} planned item(s); no silent completion.</p></article>
      </section>
    </div>
  );
}
