import { expect, test } from '@playwright/test';

test('an unresolved operation times out visibly and ordered processing continues after retry', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  const result = await page.evaluate(async () => {
    const moduleUrl = '/src/services/sync-queue.ts';
    const queueModule = await import(/* @vite-ignore */ moduleUrl) as {
      SyncQueueManager: new (options: {
        mode: 'cloud-connected';
        onlineProvider: () => boolean;
        operationTimeoutMs: number;
      }) => {
        setExecutor(executor: (operation: { kind: string }) => Promise<void>): void;
        enqueue(input: Record<string, unknown>): unknown;
        process(): Promise<void>;
        retry(operationId: string): void;
        getSnapshot(): {
          pendingCount: number;
          failedCount: number;
          completedCount: number;
          processing: boolean;
          operations: Array<{
            id: string;
            kind: string;
            status: string;
            attempts: number;
            lastError: string;
          }>;
        };
      };
    };

    const manager = new queueModule.SyncQueueManager({
      mode: 'cloud-connected',
      onlineProvider: () => true,
      operationTimeoutMs: 100
    });
    let firstAttempt = true;
    const completedKinds: string[] = [];

    manager.setExecutor(async (operation) => {
      if (firstAttempt) {
        firstAttempt = false;
        await new Promise<void>(() => undefined);
      }
      completedKinds.push(operation.kind);
    });

    manager.enqueue({
      id: 'synthetic-operation-one',
      kind: 'create-household',
      fingerprint: 'synthetic-household-one',
      payload: {
        organizationId: 'synthetic-organization',
        actorId: 'synthetic-actor',
        householdId: 'synthetic-household-one',
        name: 'Synthetic Household One'
      }
    });
    manager.enqueue({
      id: 'synthetic-operation-two',
      kind: 'create-household',
      fingerprint: 'synthetic-household-two',
      payload: {
        organizationId: 'synthetic-organization',
        actorId: 'synthetic-actor',
        householdId: 'synthetic-household-two',
        name: 'Synthetic Household Two'
      }
    });

    async function waitFor(predicate: () => boolean, timeoutMs = 3_000): Promise<void> {
      const startedAt = Date.now();
      while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) throw new Error('Timed out waiting for the synthetic queue state.');
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    void manager.process();
    await waitFor(() => manager.getSnapshot().failedCount === 1);
    const timedOut = manager.getSnapshot();

    manager.retry('synthetic-operation-one');
    await waitFor(() => {
      const snapshot = manager.getSnapshot();
      return snapshot.pendingCount === 0
        && snapshot.failedCount === 0
        && snapshot.completedCount === 2
        && snapshot.processing === false;
    });

    return {
      timedOut: {
        pendingCount: timedOut.pendingCount,
        failedCount: timedOut.failedCount,
        first: timedOut.operations.find((operation) => operation.id === 'synthetic-operation-one'),
        second: timedOut.operations.find((operation) => operation.id === 'synthetic-operation-two')
      },
      completed: manager.getSnapshot(),
      completedKinds
    };
  });

  expect(result.timedOut.pendingCount).toBe(1);
  expect(result.timedOut.failedCount).toBe(1);
  expect(result.timedOut.first).toMatchObject({
    status: 'failed',
    attempts: 1,
    lastError: 'Synchronization timed out. Retry when the connection is stable.'
  });
  expect(result.timedOut.second).toMatchObject({
    status: 'pending',
    attempts: 0
  });
  expect(result.completed).toMatchObject({
    pendingCount: 0,
    failedCount: 0,
    completedCount: 2,
    processing: false
  });
  expect(result.completed.operations.find((operation) => operation.id === 'synthetic-operation-one')).toMatchObject({
    status: 'completed',
    attempts: 2,
    lastError: ''
  });
  expect(result.completed.operations.find((operation) => operation.id === 'synthetic-operation-two')).toMatchObject({
    status: 'completed',
    attempts: 1,
    lastError: ''
  });
  expect(result.completedKinds).toEqual(['create-household', 'create-household']);
});

test('structured hosted authorization errors are sanitized before queue storage', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  const result = await page.evaluate(async () => {
    const moduleUrl = '/src/services/sync-queue.ts';
    const queueModule = await import(/* @vite-ignore */ moduleUrl) as {
      SyncQueueManager: new (options: {
        mode: 'cloud-connected';
        onlineProvider: () => boolean;
        operationTimeoutMs: number;
      }) => {
        setExecutor(executor: () => Promise<void>): void;
        enqueue(input: Record<string, unknown>): unknown;
        process(): Promise<void>;
        getSnapshot(): {
          failedCount: number;
          operations: Array<{ id: string; status: string; attempts: number; lastError: string }>;
        };
      };
    };

    const manager = new queueModule.SyncQueueManager({
      mode: 'cloud-connected',
      onlineProvider: () => true,
      operationTimeoutMs: 1_000
    });
    manager.setExecutor(async () => {
      throw {
        code: '42501',
        message: 'raw row-level provider detail must not be stored',
        details: 'private table and policy information'
      };
    });
    manager.enqueue({
      id: 'synthetic-authorization-operation',
      kind: 'create-household',
      fingerprint: 'synthetic-authorization-fingerprint',
      payload: { synthetic: true }
    });
    await manager.process();
    return manager.getSnapshot();
  });

  expect(result.failedCount).toBe(1);
  expect(result.operations.find((operation) => operation.id === 'synthetic-authorization-operation')).toMatchObject({
    status: 'failed',
    attempts: 1,
    lastError: 'Hosted synchronization was not authorized. Confirm access and retry.'
  });
  expect(JSON.stringify(result)).not.toContain('raw row-level provider detail');
  expect(JSON.stringify(result)).not.toContain('private table and policy information');
});
