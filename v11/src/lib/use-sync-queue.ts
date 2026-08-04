import { useEffect, useState } from 'react';
import type { SyncQueueSnapshot } from '../domain/sync';
import { SyncQueueManager } from '../services/sync-queue';

export function useSyncQueue(manager: SyncQueueManager): SyncQueueSnapshot {
  const [snapshot, setSnapshot] = useState<SyncQueueSnapshot>(() => manager.getSnapshot());

  useEffect(() => manager.subscribe(setSnapshot), [manager]);

  useEffect(() => {
    const handleOnline = () => {
      void manager.process();
    };
    const handleOffline = () => {
      setSnapshot(manager.getSnapshot());
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [manager]);

  return snapshot;
}
