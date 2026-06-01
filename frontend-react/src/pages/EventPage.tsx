import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSeatPolling } from '../hooks/useSeatPolling';
import { useQueuePolling } from '../hooks/useQueuePolling';
import { useCartStore } from '../stores/cartStore';
import { apiRequest, ApiError } from '../api/client';
import { showToast } from '../components/ui/Toast';
import { SeatMap } from '../components/seatmap/SeatMap';
import { SeatLegend } from '../components/seatmap/SeatLegend';
import { SessionSelector } from '../components/seatmap/SessionSelector';
import { Cart } from '../components/cart/Cart';
import { CheckoutSuccess } from '../components/checkout/CheckoutSuccess';
import { WaitingRoom } from '../components/queue/WaitingRoom';
import type { EventDetail, SeatMapItem } from '../types';
import './EventPage.css';

export function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState<SeatMapItem[]>([]);
  const [successOpen, setSuccessOpen] = useState(false);

  const { sessionId, setSession, addSeat, checkoutSuccess, clearCheckoutResult } = useCartStore();
  const { position, estimatedWait, isInQueue, loading: queueLoading } = useQueuePolling(
    eventId,
    () => loadEvent()
  );

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await apiRequest<EventDetail>(`/events/${eventId}`);
      setEvent(data);
      if (data.sessions.length > 0 && !sessionId) {
        setSession(data.sessions[0].session_id);
      }
    } catch (err) {
      console.error('Failed to load event:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId, setSession, sessionId]);

  useEffect(() => {
    loadEvent();
  }, []);

  useEffect(() => {
    if (checkoutSuccess) {
      setSuccessOpen(true);
    }
  }, [checkoutSuccess]);

  const onSeatsLoaded = useCallback((loadedSeats: SeatMapItem[]) => {
    setSeats(loadedSeats);
  }, []);

  const { refetch } = useSeatPolling(eventId, sessionId, user?.user_id, onSeatsLoaded);

  const handleSessionChange = (newSessionId: string) => {
    setSession(newSessionId);
    setSeats([]);
  };

  const handleLockSeat = async (seat: SeatMapItem) => {
    if (!sessionId) return;
    try {
      await apiRequest(`/events/seats/${seat.seat_id}/lock?session_id=${sessionId}`, {
        method: 'POST',
      });
      addSeat(seat.seat_id);
      refetch();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        showToast('This seat was just taken by another user. Please pick another.', 'error');
      } else {
        showToast(err instanceof Error ? err.message : 'Failed to lock seat', 'error');
      }
      refetch();
    }
  };

  const handleLeave = async () => {
    if (eventId) {
      try {
        await fetch(`http://127.0.0.1:8000/events/${eventId}/leave`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('flashseat-token')}`,
            'Content-Type': 'application/json',
          },
          keepalive: true,
        });
      } catch {}
    }
    navigate('/dashboard');
  };

  useEffect(() => {
    return () => {
      if (eventId) {
        navigator.sendBeacon?.('') || true;
        fetch(`http://127.0.0.1:8000/events/${eventId}/leave`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('flashseat-token')}`,
            'Content-Type': 'application/json',
          },
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [eventId]);

  if (queueLoading || loading) {
    return (
      <div className="event-page-loading">
        <div className="loading-spinner" />
        <p>Loading event...</p>
      </div>
    );
  }

  if (isInQueue) {
    return (
      <WaitingRoom
        position={position}
        estimatedWait={estimatedWait}
        onLeave={handleLeave}
      />
    );
  }

  if (!event) {
    return (
      <div className="event-page-error">
        <p>Failed to load event.</p>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="event-page">
      <button className="btn-back" onClick={handleLeave}>
        &larr; Back to Dashboard
      </button>

      <h1 className="event-title">{event.title}</h1>
      <div className="event-details">
        <span>{event.venue_name || 'No venue'}</span>
        {event.venue_city && <span>, {event.venue_city}</span>}
        <span className="event-separator">&bull;</span>
        <span>{event.category}</span>
      </div>

      {event.sessions.length > 0 && (
        <div className="card">
          <SessionSelector
            sessions={event.sessions}
            currentSessionId={sessionId}
            onChange={handleSessionChange}
          />
        </div>
      )}

      <SeatLegend />

      <div className="event-layout">
        <div className="seat-map-section card">
          <h2>Venue Seat Map</h2>
          <p className="session-info">
            Showing seats for:{' '}
            {event.sessions.find((s) => s.session_id === sessionId)?.session_name || 'N/A'}
          </p>
          <SeatMap seats={seats} onLockSeat={handleLockSeat} />
        </div>

        <div className="cart-section">
          <Cart seatMap={seats} />
        </div>
      </div>

      <CheckoutSuccess
        isOpen={successOpen}
        onClose={() => {
          setSuccessOpen(false);
          clearCheckoutResult();
          refetch();
        }}
      />
    </div>
  );
}
