import { useEffect, useState, useCallback, useRef } from "react";

const QUEUE_KEY = "attendx_offline_queue";

export type QueuedLeaveRequest = {
  id: string;
  payload: {
    type: string;
    startDate: string;
    endDate: string;
    reason?: string;
    documentPath?: string;
  };
  queuedAt: string;
};

function readQueue(): QueuedLeaveRequest[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedLeaveRequest[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function useOfflineQueue(onSync: (item: QueuedLeaveRequest) => Promise<void>) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<QueuedLeaveRequest[]>(readQueue);
  const [syncing, setSyncing] = useState(false);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const syncQueue = useCallback(async () => {
    const current = readQueue();
    if (current.length === 0 || syncing) return;
    setSyncing(true);
    const remaining: QueuedLeaveRequest[] = [];
    for (const item of current) {
      try {
        await onSyncRef.current(item);
      } catch {
        remaining.push(item);
      }
    }
    writeQueue(remaining);
    setQueue(remaining);
    setSyncing(false);
  }, [syncing]);

  useEffect(() => {
    if (isOnline) {
      syncQueue();
    }
  }, [isOnline]);

  const enqueue = useCallback((payload: QueuedLeaveRequest["payload"]) => {
    const item: QueuedLeaveRequest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      payload,
      queuedAt: new Date().toISOString(),
    };
    const next = [...readQueue(), item];
    writeQueue(next);
    setQueue(next);
    return item.id;
  }, []);

  const clearQueue = useCallback(() => {
    writeQueue([]);
    setQueue([]);
  }, []);

  return { isOnline, queue, syncing, enqueue, syncQueue, clearQueue };
}
