import { expect, test } from '@playwright/test';

test('ambiguous hosted create responses resolve existing operation rows without another write', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const moduleUrl = '/src/services/supabase-learning.ts';
    const repositoryModule = await import(/* @vite-ignore */ moduleUrl) as {
      SupabaseLearningRepository: new (client: unknown) => {
        createHousehold(
          organizationId: string,
          actorId: string,
          name: string,
          options: { householdId: string; operationId: string }
        ): Promise<{ id: string; organizationId: string; name: string }>;
        createLearner(input: Record<string, unknown>): Promise<{ id: string; preferredName: string }>;
        createTodayItem(input: Record<string, unknown>): Promise<{ id: string; title: string }>;
      };
    };

    const rows: Record<string, Record<string, unknown>> = {
      households: {
        id: 'household-existing',
        organization_id: 'organization-existing',
        name: 'Existing Household',
        created_at: '2026-08-06T00:00:00.000Z'
      },
      learners: {
        id: 'learner-existing',
        organization_id: 'organization-existing',
        household_id: 'household-existing',
        preferred_name: 'Existing Learner',
        pronouns: 'they/them',
        grade_band: '4-6',
        avatar_key: 'heron',
        access_mode: 'parent-assisted',
        status: 'active',
        created_at: '2026-08-06T00:00:00.000Z',
        updated_at: '2026-08-06T00:00:00.000Z'
      },
      learner_today_items: {
        id: 'today-existing',
        organization_id: 'organization-existing',
        household_id: 'household-existing',
        learner_id: 'learner-existing',
        title: 'Existing Today Item',
        instructions: '',
        activity_type: 'learn',
        due_date: '2026-08-06',
        status: 'assigned',
        learner_note: '',
        review_feedback: '',
        assigned_by: 'actor-existing',
        reviewed_by: null,
        completed_at: null,
        created_at: '2026-08-06T00:00:00.000Z',
        updated_at: '2026-08-06T00:00:00.000Z'
      }
    };
    const reads: string[] = [];
    const writes: Array<{ table: string; options: unknown }> = [];

    const client = {
      from(table: string) {
        return {
          select() {
            return {
              eq(column: string, value: string) {
                return {
                  async maybeSingle() {
                    reads.push(`${table}:${column}:${value}`);
                    return { data: rows[table] ?? null, error: null };
                  },
                  async single() {
                    throw new Error(`Unexpected post-write read for ${table}`);
                  }
                };
              }
            };
          },
          async upsert(_record: unknown, options: unknown) {
            writes.push({ table, options });
            return { data: null, error: null };
          }
        };
      },
      async rpc() {
        throw new Error('RPC is not used by this regression');
      }
    };

    const repository = new repositoryModule.SupabaseLearningRepository(client);
    const household = await repository.createHousehold(
      'organization-existing',
      'actor-existing',
      'Existing Household',
      { householdId: 'household-existing', operationId: 'operation-household' }
    );
    const learner = await repository.createLearner({
      organizationId: 'organization-existing',
      householdId: 'household-existing',
      preferredName: 'Existing Learner',
      pronouns: 'they/them',
      gradeBand: '4-6',
      avatar: 'heron',
      learnerId: 'learner-existing',
      operationId: 'operation-learner'
    });
    const todayItem = await repository.createTodayItem({
      organizationId: 'organization-existing',
      householdId: 'household-existing',
      learnerId: 'learner-existing',
      assignedBy: 'actor-existing',
      title: 'Existing Today Item',
      instructions: '',
      activityType: 'learn',
      dueDate: '2026-08-06',
      itemId: 'today-existing',
      operationId: 'operation-today'
    });

    return { household, learner, todayItem, reads, writes };
  });

  expect(result.household).toMatchObject({ id: 'household-existing', organizationId: 'organization-existing' });
  expect(result.learner).toMatchObject({ id: 'learner-existing', preferredName: 'Existing Learner' });
  expect(result.todayItem).toMatchObject({ id: 'today-existing', title: 'Existing Today Item' });
  expect(result.reads).toEqual([
    'households:client_operation_id:operation-household',
    'learners:client_operation_id:operation-learner',
    'learner_today_items:client_operation_id:operation-today'
  ]);
  expect(result.writes).toEqual([]);
});
