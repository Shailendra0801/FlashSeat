import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.is_admin;

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <nav>
        <ul>
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''} onClick={onClose}>
              <span className="sidebar-icon">&#127968;</span> Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/dashboard" onClick={onClose}>
              <span className="sidebar-icon">&#127915;</span> Events
            </NavLink>
          </li>
          <li>
            <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''} onClick={onClose}>
              <span className="sidebar-icon">&#128196;</span> My Bookings
            </NavLink>
          </li>
          <li>
            <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''} onClick={onClose}>
              <span className="sidebar-icon">&#128100;</span> Profile
            </NavLink>
          </li>
          {isAdmin && (
            <>
              <li className="sidebar-divider" />
              <li className="sidebar-section-label">Admin</li>
              <li>
                <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''} onClick={onClose}>
                  <span className="sidebar-icon">&#128202;</span> Admin Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/events" className={({ isActive }) => isActive ? 'active' : ''} onClick={onClose}>
                  <span className="sidebar-icon">&#127914;</span> Manage Events
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/orders" className={({ isActive }) => isActive ? 'active' : ''} onClick={onClose}>
                  <span className="sidebar-icon">&#128179;</span> Manage Orders
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'active' : ''} onClick={onClose}>
                  <span className="sidebar-icon">&#128101;</span> Manage Users
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </nav>
    </aside>
  );
}
