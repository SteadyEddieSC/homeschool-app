import { expect, test } from '@playwright/test';
import { SyncQueueManager } from '../src/services/sync-queue';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

test('an unresolved operation times out visibly and ordered processing continues after retry', async () => {
  const originalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: new MemoryStorage()
  });

  try {
    const manager = new SyncQueueManager({
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

    void manager.process();
    await expect.poll(() => manager.getSnapshot().failedCount).toBe(1);
    const timedOut = manager.getSnapshot();
    expect(timedOut.pendingCount).toBe(1);
    expect(timedOut.operations.find((operation) => operation.id === 'synthetic-operation-one')).toMatchObject({
      status: 'failed',
      attempts: 1,
      lastError: 'Synchronization timed out. Retry when the connection is stable.'
    });
    expect(timedOut.operations.find((operation) => operation.id === 'synthetic-operation-two')).toMatchObject({
      status: 'pending',
      attempts: 0
    });

    manager.retry('synthetic-operation-one');
    await expect.poll(() => {
      const snapshot = manager.getSnapshot();
      return `${snapshot.pendingCount}:${snapshot.failedCount}:${snapshot.completedCount}:${snapshot.processing}`;
    }).toBe('0:0:2:false');

    const completed = manager.getSnapshot();
    expect(completed.operations.find((operation) => operation.id === 'synthetic-operation-one')).toMatchObject({
      status: 'completed',
      attempts: 2,
      lastError: ''
    });
    expect(completed.operations.find((operation) => operation.id === 'synthetic-operation-two')).toMatchObject({
      status: 'completed',
      attempts: 1,
      lastError: ''
    });
    expect(completedKinds).toEqual(['create-household', 'create-household']);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalStorage
    });
  }
});
