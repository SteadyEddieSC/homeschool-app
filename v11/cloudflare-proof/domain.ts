/** Provider-neutral contracts for the local Cloudflare data-plane proof. */
export interface AdultIdentity {
  adultId: string;
  issuer: 'synthetic-local';
}

export interface Household {
  id: string;
  name: string;
  createdAt: string;
}

export interface Learner {
  id: string;
  householdId: string;
  preferredName: string;
  gradeBand: string;
  createdAt: string;
}

export interface HouseholdRepository {
  createHousehold(adult: AdultIdentity, input: { id: string; name: string; operationId: string }): Promise<Household>;
  listLearners(adult: AdultIdentity, householdId: string): Promise<Learner[]>;
  createLearner(adult: AdultIdentity, input: { id: string; householdId: string; preferredName: string; gradeBand: string; operationId: string }): Promise<Learner>;
}

export interface LearningRepository {
  createWorkItem(adult: AdultIdentity, input: { id: string; householdId: string; learnerId: string; title: string; operationId: string }): Promise<unknown>;
  listToday(adult: AdultIdentity, householdId: string): Promise<unknown[]>;
  recordAttendance(adult: AdultIdentity, input: { id: string; householdId: string; learnerId: string; date: string; minutes: number; operationId: string }): Promise<unknown>;
  submitEvidence(adult: AdultIdentity, input: { id: string; householdId: string; learnerId: string; workItemId: string; label: string; reference: string; operationId: string }): Promise<unknown>;
  reviewEvidence(adult: AdultIdentity, input: { id: string; householdId: string; evidenceId: string; decision: 'accepted' | 'returned'; feedback: string; operationId: string }): Promise<unknown>;
}

export interface CoOpRepository {
  createClass(adult: AdultIdentity, input: { id: string; organizationId: string; name: string; operationId: string }): Promise<unknown>;
  grantLearnerShare(adult: AdultIdentity, input: { id: string; classId: string; learnerId: string; householdId: string; operationId: string }): Promise<unknown>;
  createAssignment(adult: AdultIdentity, input: { id: string; classId: string; organizationId: string; title: string; operationId: string }): Promise<unknown>;
  submitClassResult(adult: AdultIdentity, input: { id: string; assignmentId: string; learnerId: string; result: string; operationId: string }): Promise<unknown>;
  listClassRecords(adult: AdultIdentity, classId: string): Promise<unknown[]>;
}
