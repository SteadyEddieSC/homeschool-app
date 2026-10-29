import type { AdultIdentity, Household, HouseholdRepository, Learner } from './domain';

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}

interface D1Database {
  prepare(sql: string): D1Statement;
  batch<T = unknown>(statements: D1Statement[]): Promise<T[]>;
}

type WriteOnce = <T>(db: D1Database, operationId: string, body: unknown, result: T,
  buildWrites: (claim: string) => D1Statement[]) => Promise<T>;
type HouseholdMemberCheck = (db: D1Database, householdId: string, adultId: string) => Promise<void>;
type ClaimSql = (claim: string) => string;

/** Household data access is provider-neutral at the domain boundary. */
export class D1HouseholdRepository implements HouseholdRepository {
  constructor(private readonly db: D1Database, private readonly support: {
    writeOnce: WriteOnce;
    requireHouseholdAdult: HouseholdMemberCheck;
    claimExists: ClaimSql;
    now: () => string;
    statement: (sql: string, ...values: unknown[]) => D1Statement;
  }) {}

  async createHousehold(adult: AdultIdentity, input: { id: string; name: string; operationId: string }): Promise<Household> {
    const createdAt = this.support.now();
    const result = { id: input.id, name: input.name, createdAt };
    return this.support.writeOnce(this.db, input.operationId,
      { kind: 'create-household', id: input.id, name: input.name, adultId: adult.adultId }, result,
      (claim) => [
        this.support.statement(`INSERT INTO households (id, name, created_at) SELECT ?, ?, ? WHERE ${this.support.claimExists(claim)}`, input.id, input.name, createdAt),
        this.support.statement(`INSERT INTO household_adults (household_id, adult_id, role, created_at) SELECT ?, ?, 'owner', ? WHERE ${this.support.claimExists(claim)}`, input.id, adult.adultId, createdAt)
      ]);
  }

  async listLearners(adult: AdultIdentity, householdId: string): Promise<Learner[]> {
    await this.support.requireHouseholdAdult(this.db, householdId, adult.adultId);
    const rows = await this.support.statement(
      'SELECT id, household_id AS householdId, preferred_name AS preferredName, grade_band AS gradeBand, created_at AS createdAt FROM learners WHERE household_id = ? AND status = ? ORDER BY id',
      householdId, 'active'
    ).all<Learner>();
    return rows.results;
  }

  async createLearner(adult: AdultIdentity, input: { id: string; householdId: string; preferredName: string; gradeBand: string; operationId: string }): Promise<Learner> {
    await this.support.requireHouseholdAdult(this.db, input.householdId, adult.adultId);
    const createdAt = this.support.now();
    const result = { id: input.id, householdId: input.householdId, preferredName: input.preferredName, gradeBand: input.gradeBand, createdAt };
    return this.support.writeOnce(this.db, input.operationId,
      { kind: 'create-learner', householdId: input.householdId, id: input.id, preferredName: input.preferredName, gradeBand: input.gradeBand }, result,
      (claim) => [this.support.statement(
        `INSERT INTO learners (id, household_id, preferred_name, grade_band, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ? WHERE ${this.support.claimExists(claim)}`,
        input.id, input.householdId, input.preferredName, input.gradeBand, createdAt, createdAt
      )]);
  }
}
