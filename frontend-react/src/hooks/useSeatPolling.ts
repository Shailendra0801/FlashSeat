import { useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '../api/client';
import { useCartStore } from '../stores/cartStore';
import type { SeatMapItem, SeatMapResponse } from '../types';

export function useSeatPolling(
  eventId: string | undefined,
  sessionId: string | null,
  currentUserId: string | undefined,
  onSeatsLoaded: (seats: SeatMapItem[]) => void
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkoutInProgress = useCartStore((s) => s.checkoutInProgress);

  const fetchSeats = useCallback(async () => {
    if (!eventId || !sessionId) return;
    if (checkoutInProgress) return;

    try {
      const data = await apiRequest<SeatMapResponse>(
        `/events/${eventId}/seats?session_id=${sessionId}`
      );
      onSeatsLoaded(data.seats);
      if (currentUserId) {
        useCartStore.getState().reconcile(data.seats, currentUserId);
      }
    } catch (err) {
      console.error('Seat polling failed:', err);
    }
  }, [eventId, sessionId, currentUserId, checkoutInProgress, onSeatsLoaded]);

  useEffect(() => {
    if (!eventId || !sessionId) return;

    fetchSeats();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchSeats, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [eventId, sessionId, fetchSeats]);

  return { refetch: fetchSeats };
}
