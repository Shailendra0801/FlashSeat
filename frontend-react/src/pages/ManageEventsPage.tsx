import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../api/client';
import { showToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import type { EventListItem, EventDetail, EventSession } from '../types';
import './AdminPages.css';

export function ManageEventsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editEvent, setEditEvent] = useState<EventDetail | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '', venue_name: '', venue_city: '' });
  const [sessionStatusTarget, setSessionStatusTarget] = useState<{ event: EventListItem; session: EventSession } | null>(null);
  const [newSessionStatus, setNewSessionStatus] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EventListItem | null>(null);

  useEffect(() => {
    if (user && !user.is_admin) { navigate('/dashboard'); return; }
    loadEvents();
  }, [user]);

  async function loadEvents() {
    try {
      const data = await apiRequest<{ events: EventListItem[] }>('/events/');
      setEvents(data.events || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load events', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = async (evt: EventListItem) => {
    try {
      const detail = await apiRequest<EventDetail>(`/events/${evt.event_id}`);
      setEditEvent(detail);
      setEditForm({
        title: detail.title,
        description: detail.description || '',
        category: detail.category,
        venue_name: detail.venue_name || '',
        venue_city: detail.venue_city || '',
      });
    } catch (err: any) {
      showToast('Failed to load event details', 'error');
    }
  };

  const handleSaveEdit = async () => {
    if (!editEvent) return;
    try {
      await apiRequest(`/admin/events/${editEvent.event_id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      showToast('Event updated!', 'success');
      setEditEvent(null);
      loadEvents();
    } catch (err: any) {
      showToast(err.message || 'Failed to update event', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/admin/events/${deleteTarget.event_id}`, { method: 'DELETE' });
      showToast('Event deleted.', 'success');
      setDeleteTarget(null);
      loadEvents();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete event', 'error');
    }
  };

  const handleSessionStatus = async () => {
    if (!sessionStatusTarget || !newSessionStatus) return;
    try {
      await apiRequest(
        `/admin/events/${sessionStatusTarget.event.event_id}/sessions/${sessionStatusTarget.session.session_id}/status`,
        { method: 'PATCH', body: JSON.stringify({ status: newSessionStatus }) }
      );
      showToast(`Session status updated to ${newSessionStatus}`, 'success');
      setSessionStatusTarget(null);
      loadEvents();
    } catch (err: any) {
      showToast(err.message || 'Failed to update session status', 'error');
    }
  };

  if (loading) return <div className="loading-spinner" />;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Manage Events</h1>
        <button className="btn-submit" onClick={() => navigate('/admin/events/create')}>+ Create Event</button>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        {events.length === 0 ? (
          <div className="empty-state"><p>No events yet.</p></div>
        ) : (
          <table className="manage-events-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Venue</th>
                <th>Sessions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.event_id}>
                  <td><strong>{evt.title}</strong></td>
                  <td>{evt.category}</td>
                  <td>{evt.venue_name || 'TBD'}{evt.venue_city ? `, ${evt.venue_city}` : ''}</td>
                  <td>{evt.total_sessions}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn-small btn-edit" onClick={() => handleEdit(evt)}>Edit</button>
                      <button className="btn-small btn-block" onClick={() => {
                        apiRequest<EventDetail>(`/events/${evt.event_id}`).then((d) => {
                          if (d.sessions.length > 0) {
                            setSessionStatusTarget({ event: evt, session: d.sessions[0] });
                            setNewSessionStatus(d.sessions[0].status);
                          }
                        });
                      }}>Sessions</button>
                      <button className="btn-small btn-danger" onClick={() => setDeleteTarget(evt)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={!!editEvent} onClose={() => setEditEvent(null)} title="Edit Event" maxWidth="520px">
        <div style={{ padding: 24 }}>
          <div className="form-group">
            <label>Title</label>
            <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Venue Name</label>
              <input value={editForm.venue_name} onChange={(e) => setEditForm({ ...editForm, venue_name: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Venue City</label>
            <input value={editForm.venue_city} onChange={(e) => setEditForm({ ...editForm, venue_city: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn-cancel" onClick={() => setEditEvent(null)}>Cancel</button>
            <button className="btn-submit" onClick={handleSaveEdit}>Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Session Status Modal */}
      <Modal isOpen={!!sessionStatusTarget} onClose={() => setSessionStatusTarget(null)} title="Update Session Status" maxWidth="400px">
        <div style={{ padding: 24 }}>
          <p style={{ marginBottom: 16, color: '#475569' }}>
            Session: <strong>{sessionStatusTarget?.session.session_name}</strong>
          </p>
          <div className="form-group">
            <label>Status</label>
            <select value={newSessionStatus} onChange={(e) => setNewSessionStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="sold_out">Sold Out</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn-cancel" onClick={() => setSessionStatusTarget(null)}>Cancel</button>
            <button className="btn-submit" onClick={handleSessionStatus}>Update Status</button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Event" maxWidth="400px">
        <div style={{ padding: 24 }}>
          <p style={{ marginBottom: 20, color: '#475569' }}>
            Are you sure you want to delete <strong>{deleteTarget?.title}</strong>?
            This will remove all sessions, seats, and cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button className="btn-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn-submit" style={{ background: '#ef4444' }} onClick={handleDelete}>Delete Event</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
