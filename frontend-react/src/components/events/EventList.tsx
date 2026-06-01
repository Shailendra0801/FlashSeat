import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { EventCard } from './EventCard';
import type { EventListItem } from '../../types';

export function EventList() {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest<{ events: EventListItem[] }>('/events/');
        setEvents(data.events || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load events');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="loading-spinner" />;
  }

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  if (events.length === 0) {
    return <p className="empty-text">No upcoming events found.</p>;
  }

  return (
    <div className="event-grid">
      {events.map((event) => (
        <EventCard key={event.event_id} event={event} />
      ))}
    </div>
  );
}
