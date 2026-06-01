import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header-left">
        <button className="hamburger" onClick={onToggleSidebar} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
        <h2 className="header-logo">FlashSeat</h2>
      </div>
      <div className="header-right">
        <span className="header-greeting">
          {user ? `Welcome, ${user.full_name}` : 'Welcome'}
        </span>
        <button className="btn-logout" onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );
}
