import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../api/client';
import { showToast } from '../components/ui/Toast';
import type { User } from '../types';
import './AdminPages.css';

export function ManageUsersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !user.is_admin) { navigate('/dashboard'); return; }
    async function load() {
      try {
        const data = await apiRequest<User[]>('/auth/users');
        setUsers(data || []);
      } catch (err: any) {
        showToast(err.message || 'Failed to load users', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, navigate]);

  if (loading) return <div className="loading-spinner" />;

  return (
    <>
      <h1 className="page-title">Manage Users</h1>
      <div className="card" style={{ overflow: 'auto' }}>
        {users.length === 0 ? (
          <div className="empty-state"><p>No users found.</p></div>
        ) : (
          <table className="manage-events-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>User ID</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td><strong>{u.full_name}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`status-badge ${u.is_admin ? 'status-published' : 'status-draft'}`}>
                      {u.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8' }}>
                    {u.user_id.slice(0, 8)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
