import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../api/client';
import { EventCard } from '../components/events/EventCard';
import type { EventListItem } from '../types';
import './DashboardPage.css';

export function DashboardPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (city) params.set('city', city);
      const qs = params.toString();
      const data = await apiRequest<{ events: EventListItem[] }>(`/events/${qs ? '?' + qs : ''}`);
      setEvents(data.events || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [search, category, city]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Debounce search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setCategory('');
    setCity('');
  };

  const hasFilters = search || category || city;

  return (
    <>
      <h1 className="page-title">
        Welcome Back{user ? `, ${user.full_name}` : ''}!
      </h1>

      <div className="card filter-bar">
        <input
          className="filter-search"
          type="text"
          placeholder="Search events..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          className="filter-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="concert">Concert</option>
          <option value="sports">Sports</option>
          <option value="theater">Theater</option>
          <option value="comedy">Comedy</option>
          <option value="conference">Conference</option>
        </select>
        <input
          className="filter-input"
          type="text"
          placeholder="Filter by city..."
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        {hasFilters && (
          <button className="btn-clear-filters" onClick={clearFilters}>
            Clear
          </button>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">
          {hasFilters ? 'Search Results' : 'Upcoming Events'}
          {!loading && <span className="event-count">{events.length}</span>}
        </h3>

        {loading ? (
          <div className="skeleton-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-line skeleton-wide" />
                <div className="skeleton-line skeleton-medium" />
                <div className="skeleton-line skeleton-narrow" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">&#128269;</div>
            <p>{hasFilters ? 'No events match your filters.' : 'No upcoming events found.'}</p>
            {hasFilters && (
              <button className="btn-clear-filters" onClick={clearFilters}>Clear Filters</button>
            )}
          </div>
        ) : (
          <div className="event-grid">
            {events.map((event) => (
              <EventCard key={event.event_id} event={event} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
