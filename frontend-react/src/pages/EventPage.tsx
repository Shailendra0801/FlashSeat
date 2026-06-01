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
import { API_BASE } from '../utils/constants';
import type { EventDetail, SeatMapItem } from '../types';
import './EventPage.css';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState<SeatMapItem[]>([]);
  const [successOpen, setSuccessOpen] = useState(false);

  const { sessionId, setSession, addSeat, checkoutSuccess, clearCheckoutResult } = useCartStore();

  // Validate eventId is a valid UUID
  const isValidEventId = eventId && UUID_RE.test(eventId);

  const { position, estimatedWait, isInQueue, loading: queueLoading } = useQueuePolling(
    isValidEventId ? eventId : undefined,
    () => loadEvent()
  );

  const loadEvent = useCallback(async () => {
    if (!isValidEventId) return;
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
  }, [eventId, setSession, sessionId, isValidEventId]);

  useEffect(() => {
    if (!isValidEventId) {
      navigate('/dashboard');
      return;
    }
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

  const { refetch } = useSeatPolling(
    isValidEventId ? eventId : undefined,
    sessionId,
    user?.user_id,
    onSeatsLoaded
  );

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

  const handleLeave = () => {
    notifyLeave();
    navigate('/dashboard');
  };

  const notifyLeave = useCallback(() => {
    if (!isValidEventId) return;
    const token = localStorage.getItem('flashseat-token');
    if (!token) return;
    fetch(`${API_BASE}/events/${eventId}/leave`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      keepalive: true,
    }).catch(() => {});
  }, [eventId, isValidEventId]);

  useEffect(() => {
    return () => {
      notifyLeave();
    };
  }, [notifyLeave]);

  if (!isValidEventId) {
    return (
      <div className="event-page-error">
        <p>Invalid event URL.</p>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

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
