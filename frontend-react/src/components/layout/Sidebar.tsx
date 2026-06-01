import { NavLink } from 'react-router-dom';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
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
        </ul>
      </nav>
    </aside>
  );
}
