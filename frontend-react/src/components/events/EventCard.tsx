import { useNavigate } from 'react-router-dom';
import type { EventListItem } from '../../types';

interface EventCardProps {
  event: EventListItem;
}

export function EventCard({ event }: EventCardProps) {
  const navigate = useNavigate();

  return (
    <div className="event-card">
      <h4>{event.title}</h4>
      <p className="event-info">
        {event.category} &bull; {event.venue_name || 'TBD'}
        {event.venue_city ? `, ${event.venue_city}` : ''}
      </p>
      <p className="event-sessions">
        <strong>Sessions:</strong> {event.total_sessions}
      </p>
      <button
        className="btn-view-seats"
        onClick={() => navigate(`/events/${event.event_id}`)}
      >
        View Seats
      </button>
    </div>
  );
}
