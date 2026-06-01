import { useEffect, useRef, useState, useCallback } from 'react';
import { apiRequest } from '../api/client';
import type { QueueStatus } from '../types';

export function useQueuePolling(
  eventId: string | undefined,
  onAccessGranted: () => void
) {
  const [position, setPosition] = useState<number | null>(null);
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [isInQueue, setIsInQueue] = useState(false);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkQueue = useCallback(async () => {
    if (!eventId) return;

    try {
      const data = await apiRequest<QueueStatus>(`/events/${eventId}/queue`);

      if (data.status === 'access_granted') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsInQueue(false);
        setLoading(false);
        onAccessGranted();
      } else if (data.status === 'in_queue') {
        setIsInQueue(true);
        setPosition(data.queue_position ?? null);
        setEstimatedWait(data.estimated_wait_seconds ?? null);
        setLoading(false);
      }
    } catch (err) {
      console.error('Queue check failed:', err);
      setLoading(false);
    }
  }, [eventId, onAccessGranted]);

  useEffect(() => {
    if (!eventId) return;

    checkQueue();

    intervalRef.current = setInterval(checkQueue, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [eventId, checkQueue]);

  return { position, estimatedWait, isInQueue, loading };
}
