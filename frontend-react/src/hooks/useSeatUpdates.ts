import { useEffect, useRef, useState, useCallback } from 'react';
import { SeatWebSocket } from '../utils/websocket';
import { useSeatPolling } from './useSeatPolling';
import { useCartStore } from '../stores/cartStore';
import type { SeatMapItem } from '../types';

/**
 * Tries WebSocket for real-time seat updates.
 * Falls back to 5s polling if WS connection fails or backend doesn't support it yet.
 */
export function useSeatUpdates(
  eventId: string | undefined,
  sessionId: string | null,
  currentUserId: string | undefined,
  onSeatsLoaded: (seats: SeatMapItem[]) => void
) {
  const [transport, setTransport] = useState<'ws' | 'polling' | 'connecting'>('connecting');
  const wsRef = useRef<SeatWebSocket | null>(null);
  const checkoutInProgress = useCartStore((s) => s.checkoutInProgress);

  // Handle incoming WS seat data
  const handleWsMessage = useCallback(
    (data: any) => {
      if (checkoutInProgress) return;
      // Expect message shape: { seats: SeatMapItem[] }
      if (data?.seats && Array.isArray(data.seats)) {
        onSeatsLoaded(data.seats);
        if (currentUserId) {
          useCartStore.getState().reconcile(data.seats, currentUserId);
        }
      }
    },
    [checkoutInProgress, onSeatsLoaded, currentUserId]
  );

  // Try WS on mount/session change
  useEffect(() => {
    if (!eventId || !sessionId) return;

    setTransport('connecting');

    const ws = new SeatWebSocket(
      eventId,
      sessionId,
      handleWsMessage,
      () => {
        // WS closed — if we were using it, switch to polling
        setTransport('polling');
      }
    );
    wsRef.current = ws;

    ws.connect().then((ok) => {
      if (ok) {
        setTransport('ws');
      } else {
        setTransport('polling');
        ws.disconnect();
      }
    });

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [eventId, sessionId, handleWsMessage]);

  // Polling fallback — always runs if WS isn't connected
  // useSeatPolling internally skips if checkoutInProgress
  const polling = useSeatPolling(
    transport === 'polling' || transport === 'connecting' ? eventId : undefined,
    transport === 'polling' || transport === 'connecting' ? sessionId : null,
    currentUserId,
    onSeatsLoaded
  );

  const refetch = useCallback(() => {
    if (wsRef.current?.connected) {
      // WS auto-pushes, but we can send a refresh request
      // For now just trigger polling fallback refetch
      polling.refetch();
    } else {
      polling.refetch();
    }
  }, [polling]);

  return { transport, refetch };
}
