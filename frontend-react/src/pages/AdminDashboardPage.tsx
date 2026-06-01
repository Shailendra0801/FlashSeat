import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../api/client';
import { useNavigate } from 'react-router-dom';
import type { AdminStats } from '../types';
import './AdminPages.css';

export function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !user.is_admin) {
      navigate('/dashboard');
      return;
    }
    async function load() {
      try {
        const data = await apiRequest<AdminStats>('/admin/stats');
        setStats(data);
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, navigate]);

  if (loading) return <div className="loading-spinner" />;
  if (!stats) return <p className="error-text">Failed to load admin stats.</p>;

  const cards = [
    { label: 'Total Events', value: stats.total_events, icon: '&#127914;', color: '#667eea' },
    { label: 'Total Users', value: stats.total_users, icon: '&#128101;', color: '#8b5cf6' },
    { label: 'Confirmed Orders', value: stats.confirmed_orders, icon: '&#128179;', color: '#22c55e' },
    { label: 'Revenue', value: `₹${stats.total_revenue.toLocaleString('en-IN')}`, icon: '&#128176;', color: '#f59e0b' },
    { label: 'Total Seats', value: stats.total_seats, icon: '&#128186;', color: '#3b82f6' },
    { label: 'Seats Booked', value: stats.booked_seats, icon: '&#9989;', color: '#10b981' },
    { label: 'Utilization', value: `${stats.seat_utilization}%`, icon: '&#128200;', color: '#ec4899' },
  ];

  return (
    <>
      <h1 className="page-title">Admin Dashboard</h1>
      <div className="admin-stats-grid">
        {cards.map((c) => (
          <div key={c.label} className="admin-stat-card" style={{ borderTopColor: c.color }}>
            <div className="admin-stat-icon" dangerouslySetInnerHTML={{ __html: c.icon }} />
            <div className="admin-stat-value">{c.value}</div>
            <div className="admin-stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="admin-quick-actions">
        <h3 className="card-title">Quick Actions</h3>
        <div className="admin-action-grid">
          <button className="admin-action-btn" onClick={() => navigate('/admin/events/create')}>
            &#10010; Create Event
          </button>
          <button className="admin-action-btn" onClick={() => navigate('/admin/events')}>
            &#128203; Manage Events
          </button>
          <button className="admin-action-btn" onClick={() => navigate('/admin/orders')}>
            &#128179; View Orders
          </button>
          <button className="admin-action-btn" onClick={() => navigate('/admin/users')}>
            &#128101; Manage Users
          </button>
        </div>
      </div>
    </>
  );
}
