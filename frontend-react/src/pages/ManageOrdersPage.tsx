import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../api/client';
import { showToast } from '../components/ui/Toast';
import type { AdminOrder, AdminOrderListResponse } from '../types';
import './AdminPages.css';

export function ManageOrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (user && !user.is_admin) { navigate('/dashboard'); return; }
    loadOrders();
  }, [user, statusFilter]);

  async function loadOrders() {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const data = await apiRequest<AdminOrderListResponse>(`/admin/orders${qs}`);
      setOrders(data.orders || []);
      setTotal(data.total);
    } catch (err: any) {
      showToast(err.message || 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  }

  const formatDT = (v: string) => {
    try { return new Date(v).toLocaleString(); } catch { return v; }
  };

  const statusClass = (s: string) => {
    if (s === 'confirmed') return 'status-confirmed';
    if (s === 'failed') return 'status-failed';
    if (s === 'cancelled') return 'status-cancelled';
    return 'status-pending';
  };

  return (
    <>
      <h1 className="page-title">Manage Orders ({total})</h1>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        {['', 'confirmed', 'pending', 'failed', 'cancelled'].map((s) => (
          <button
            key={s}
            className={`btn-small ${statusFilter === s ? 'btn-edit' : ''}`}
            style={{ background: statusFilter === s ? '#3b82f6' : '#f1f5f9', color: statusFilter === s ? 'white' : '#475569' }}
            onClick={() => setStatusFilter(s)}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        {loading ? (
          <div className="loading-spinner" />
        ) : orders.length === 0 ? (
          <div className="empty-state"><p>No orders found.</p></div>
        ) : (
          <table className="manage-events-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>User</th>
                <th>Event</th>
                <th>Seats</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{o.order_id.slice(0, 8)}...</td>
                  <td>{o.user_email}</td>
                  <td>{o.event_title}</td>
                  <td>
                    <div className="order-detail-items">
                      {o.items.map((item) => (
                        <span key={item.order_item_id} className="seat-pill">{item.seat_label}</span>
                      ))}
                    </div>
                  </td>
                  <td>{o.currency === 'INR' ? '₹' : ''}{o.total_amount}</td>
                  <td><span className={`status-badge ${statusClass(o.status)}`}>{o.status}</span></td>
                  <td>{formatDT(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
