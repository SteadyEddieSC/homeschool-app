import type { ActivityType } from './learning';

export const KNOWLEDGE_QUESTION_TYPES = ['multiple-choice', 'true-false'] as const;
export type KnowledgeQuestionType = (typeof KNOWLEDGE_QUESTION_TYPES)[number];

export const EVIDENCE_KINDS = ['text', 'link'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_STATUSES = ['pending', 'accepted', 'returned'] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export interface KnowledgeQuestion {
  id: string;
  type: KnowledgeQuestionType;
  prompt: string;
  options: string[];
  correctOption: number;
  explanation: string;
}

export interface KnowledgeCheck {
  id: string;
  organizationId: string;
  householdId: string;
  learnerId: string;
  todayItemId: string;
  title: string;
  questions: KnowledgeQuestion[];
  createdBy: string;
  createdAt: string;
}

export interface KnowledgeQuestionResult {
  questionId: string;
  selectedOption: number;
  correctOption: number;
  correct: boolean;
}

export interface KnowledgeAttempt {
  id: string;
  organizationId: string;
  householdId: string;
  learnerId: string;
  todayItemId: string;
  checkId: string;
  answers: number[];
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  results: KnowledgeQuestionResult[];
  submittedAt: string;
}

export interface EvidenceSubmission {
  id: string;
  organizationId: string;
  householdId: string;
  learnerId: string;
  todayItemId: string;
  title: string;
  kind: EvidenceKind;
  content: string;
  learnerNote: string;
  revision: number;
  previousSubmissionId: string | null;
  status: EvidenceStatus;
  adultFeedback: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface WeeklyPlan {
  id: string;
  organizationId: string;
  householdId: string;
  weekStart: string;
  title: string;
  createdBy: string;
  createdAt: string;
}

export interface WeeklyPlanItem {
  id: string;
  organizationId: string;
  householdId: string;
  planId: string;
  learnerId: string;
  scheduledDate: string;
  title: string;
  activityType: ActivityType;
  todayItemId: string | null;
  createdAt: string;
}

export interface CreateKnowledgeCheckInput {
  organizationId: string;
  householdId: string;
  learnerId: string;
  todayItemId: string;
  title: string;
  questions: Array<Omit<KnowledgeQuestion, 'id'> & { id?: string }>;
  createdBy: string;
  checkId?: string;
  operationId?: string;
}

export interface SubmitKnowledgeAttemptInput {
  checkId: string;
  learnerId: string;
  answers: number[];
  attemptId?: string;
  operationId?: string;
}

export interface SubmitEvidenceInput {
  organizationId: string;
  householdId: string;
  learnerId: string;
  todayItemId: string;
  title: string;
  kind: EvidenceKind;
  content: string;
  learnerNote: string;
  submissionId?: string;
  operationId?: string;
}

export interface ReviewEvidenceInput {
  submissionId: string;
  decision: 'accept' | 'return';
  adultFeedback: string;
  reviewedBy: string;
  operationId?: string;
}

export interface CreateWeeklyPlanInput {
  organizationId: string;
  householdId: string;
  weekStart: string;
  title: string;
  createdBy: string;
  planId?: string;
  operationId?: string;
}

export interface CreateWeeklyPlanItemInput {
  organizationId: string;
  householdId: string;
  planId: string;
  learnerId: string;
  scheduledDate: string;
  title: string;
  activityType: ActivityType;
  todayItemId?: string | null;
  planItemId?: string;
  operationId?: string;
}

export interface LearningStudioRepository {
  listKnowledgeChecks(organizationId: string, learnerId?: string): Promise<KnowledgeCheck[]>;
  createKnowledgeCheck(input: CreateKnowledgeCheckInput): Promise<KnowledgeCheck>;
  listKnowledgeAttempts(organizationId: string, learnerId?: string): Promise<KnowledgeAttempt[]>;
  submitKnowledgeAttempt(input: SubmitKnowledgeAttemptInput): Promise<KnowledgeAttempt>;
  listEvidenceSubmissions(organizationId: string, learnerId?: string): Promise<EvidenceSubmission[]>;
  submitEvidence(input: SubmitEvidenceInput): Promise<EvidenceSubmission>;
  reviewEvidence(input: ReviewEvidenceInput): Promise<EvidenceSubmission>;
  listWeeklyPlans(organizationId: string, householdId?: string): Promise<WeeklyPlan[]>;
  createWeeklyPlan(input: CreateWeeklyPlanInput): Promise<WeeklyPlan>;
  listWeeklyPlanItems(organizationId: string, learnerId?: string): Promise<WeeklyPlanItem[]>;
  createWeeklyPlanItem(input: CreateWeeklyPlanItemInput): Promise<WeeklyPlanItem>;
}

function normalized(value: string, label: string, min: number, max: number): string {
  const result = value.trim().replace(/\s+/g, ' ');
  if (result.length < min || result.length > max) {
    throw new Error(`${label} must be between ${min} and ${max.toLocaleString()} characters.`);
  }
  return result;
}

export function normalizeStudioTitle(value: string): string {
  return normalized(value, 'Title', 2, 180);
}

export function normalizeQuestionPrompt(value: string): string {
  return normalized(value, 'Question prompt', 2, 500);
}

export function normalizeQuestionOption(value: string): string {
  return normalized(value, 'Answer option', 1, 240);
}

export function normalizeEvidenceContent(value: string, kind: EvidenceKind): string {
  const result = value.trim();
  if (result.length < 2 || result.length > 4_000) {
    throw new Error('Evidence content must be between 2 and 4,000 characters.');
  }
  if (kind === 'link') {
    let parsed: URL;
    try {
      parsed = new URL(result);
    } catch {
      throw new Error('Evidence link must be a valid URL.');
    }
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Evidence links must use http or https.');
  }
  return result;
}

export function normalizeStudioNote(value: string, required = false): string {
  const result = value.trim();
  if (required && result.length < 2) throw new Error('Feedback is required when returning evidence.');
  if (result.length > 2_000) throw new Error('Notes must be 2,000 characters or fewer.');
  return result;
}

export function normalizeKnowledgeQuestions(
  questions: CreateKnowledgeCheckInput['questions']
): KnowledgeQuestion[] {
  if (questions.length < 1 || questions.length > 20) {
    throw new Error('A knowledge check must contain between 1 and 20 questions.');
  }
  return questions.map((question) => {
    const options = question.type === 'true-false'
      ? ['True', 'False']
      : question.options.map(normalizeQuestionOption);
    if (options.length < 2 || options.length > 6) {
      throw new Error('Each question must have between 2 and 6 answer options.');
    }
    if (!Number.isInteger(question.correctOption) || question.correctOption < 0 || question.correctOption >= options.length) {
      throw new Error('Each question must identify one valid correct answer.');
    }
    return {
      id: question.id ?? crypto.randomUUID(),
      type: question.type,
      prompt: normalizeQuestionPrompt(question.prompt),
      options,
      correctOption: question.correctOption,
      explanation: question.explanation.trim().slice(0, 1_000)
    };
  });
}

export function scoreKnowledgeCheck(
  check: KnowledgeCheck,
  answers: number[]
): Pick<KnowledgeAttempt, 'answers' | 'correctCount' | 'totalQuestions' | 'percentage' | 'results'> {
  if (answers.length !== check.questions.length) throw new Error('Answer every question before submitting the check.');
  const results = check.questions.map((question, index): KnowledgeQuestionResult => {
    const selectedOption = answers[index];
    if (selectedOption === undefined || !Number.isInteger(selectedOption) || selectedOption < 0 || selectedOption >= question.options.length) {
      throw new Error('One or more selected answers are invalid.');
    }
    return {
      questionId: question.id,
      selectedOption,
      correctOption: question.correctOption,
      correct: selectedOption === question.correctOption
    };
  });
  const correctCount = results.filter((result) => result.correct).length;
  return {
    answers: [...answers],
    correctCount,
    totalQuestions: check.questions.length,
    percentage: Math.round((correctCount / check.questions.length) * 100),
    results
  };
}
