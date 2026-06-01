import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../api/client';
import { showToast } from '../components/ui/Toast';
import type { SeatSection } from '../types';
import './AdminPages.css';

interface SeatRow {
  row_name: string;
  seat_count: number;
  section: SeatSection;
}

interface SessionRow {
  session_name: string;
  start_time: string;
  doors_open_time: string;
}

export function CreateEventPage() {
  useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('concert');
  const [venueName, setVenueName] = useState('');
  const [venueCity, setVenueCity] = useState('');
  const [seatRows, setSeatRows] = useState<SeatRow[]>([
    { row_name: 'A', seat_count: 10, section: 'regular' },
  ]);
  const [sessions, setSessions] = useState<SessionRow[]>([
    { session_name: 'Show 1', start_time: '', doors_open_time: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addSeatRow = () => {
    const lastRow = seatRows[seatRows.length - 1];
    const nextChar = lastRow
      ? String.fromCharCode(lastRow.row_name.charCodeAt(0) + 1)
      : 'A';
    setSeatRows([...seatRows, { row_name: nextChar, seat_count: 10, section: 'regular' }]);
  };

  const removeSeatRow = (i: number) => {
    setSeatRows(seatRows.filter((_, idx) => idx !== i));
  };

  const updateSeatRow = (i: number, field: keyof SeatRow, value: any) => {
    const updated = [...seatRows];
    updated[i] = { ...updated[i], [field]: value };
    setSeatRows(updated);
  };

  const addSession = () => {
    setSessions([...sessions, { session_name: `Show ${sessions.length + 1}`, start_time: '', doors_open_time: '' }]);
  };

  const removeSession = (i: number) => {
    setSessions(sessions.filter((_, idx) => idx !== i));
  };

  const updateSession = (i: number, field: keyof SessionRow, value: string) => {
    const updated = [...sessions];
    updated[i] = { ...updated[i], [field]: value };
    setSessions(updated);
  };

  const buildSeatLayout = () => {
    const layout: { row_name: string; seat_number: number; section: SeatSection }[] = [];
    for (const row of seatRows) {
      for (let n = 1; n <= row.seat_count; n++) {
        layout.push({ row_name: row.row_name, seat_number: n, section: row.section });
      }
    }
    return layout;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || seatRows.length === 0 || sessions.length === 0) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }
    if (sessions.some((s) => !s.start_time)) {
      showToast('All sessions need a start time.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/events/', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: description || null,
          category,
          venue_name: venueName || null,
          venue_city: venueCity || null,
          seat_layout: buildSeatLayout(),
          sessions: sessions.map((s) => ({
            session_name: s.session_name,
            start_time: new Date(s.start_time).toISOString(),
            doors_open_time: s.doors_open_time ? new Date(s.doors_open_time).toISOString() : null,
          })),
        }),
      });
      showToast('Event created successfully!', 'success');
      navigate('/admin/events');
    } catch (err: any) {
      showToast(err.message || 'Failed to create event', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalSeats = seatRows.reduce((sum, r) => sum + r.seat_count, 0);

  return (
    <>
      <h1 className="page-title">Create Event</h1>
      <div className="card create-event-form">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Event Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Coldplay World Tour 2025" />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional event description" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="concert">Concert</option>
                <option value="sports">Sports</option>
                <option value="theater">Theater</option>
                <option value="comedy">Comedy</option>
                <option value="conference">Conference</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Venue Name</label>
              <input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="e.g. DY Patil Stadium" />
            </div>
          </div>

          <div className="form-group">
            <label>Venue City</label>
            <input value={venueCity} onChange={(e) => setVenueCity(e.target.value)} placeholder="e.g. Mumbai" />
          </div>

          <h3 className="form-section-title">Seat Layout ({totalSeats} seats total)</h3>
          {seatRows.map((row, i) => (
            <div key={i} className="seat-builder">
              <div className="seat-builder-row">
                <div className="form-group">
                  <label>Row Name</label>
                  <input value={row.row_name} onChange={(e) => updateSeatRow(i, 'row_name', e.target.value.toUpperCase())} maxLength={5} />
                </div>
                <div className="form-group">
                  <label>Seats</label>
                  <input type="number" value={row.seat_count} onChange={(e) => updateSeatRow(i, 'seat_count', parseInt(e.target.value) || 0)} min={1} max={100} />
                </div>
                <div className="form-group">
                  <label>Section</label>
                  <select value={row.section} onChange={(e) => updateSeatRow(i, 'section', e.target.value as SeatSection)}>
                    <option value="vip">VIP</option>
                    <option value="premium">Premium</option>
                    <option value="regular">Regular</option>
                    <option value="standing">Standing</option>
                  </select>
                </div>
                <button type="button" className="btn-remove-row" onClick={() => removeSeatRow(i)} disabled={seatRows.length <= 1}>Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn-add-row" onClick={addSeatRow}>+ Add Row</button>

          <h3 className="form-section-title">Sessions</h3>
          {sessions.map((sess, i) => (
            <div key={i} className="session-builder">
              <div className="session-builder-row">
                <div className="form-group">
                  <label>Session Name</label>
                  <input value={sess.session_name} onChange={(e) => updateSession(i, 'session_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Start Time *</label>
                  <input type="datetime-local" value={sess.start_time} onChange={(e) => updateSession(i, 'start_time', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Doors Open</label>
                  <input type="datetime-local" value={sess.doors_open_time} onChange={(e) => updateSession(i, 'doors_open_time', e.target.value)} />
                </div>
                <button type="button" className="btn-remove-row" onClick={() => removeSession(i)} disabled={sessions.length <= 1}>Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn-add-row" onClick={addSession}>+ Add Session</button>

          <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
            <button type="button" className="btn-cancel" onClick={() => navigate('/admin/events')}>Cancel</button>
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
