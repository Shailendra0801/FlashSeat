import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { AuthModal } from '../components/auth/AuthModal';
import './LandingPage.css';

export function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'login' | 'register'>('login');
  const { token } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      navigate('/dashboard');
    }
  }, [token, navigate]);

  const openLogin = () => {
    setInitialTab('login');
    setModalOpen(true);
  };

  const openRegister = () => {
    setInitialTab('register');
    setModalOpen(true);
  };

  return (
    <div className="landing-page">
      <div className="landing-bg" />
      <div className="landing-content">
        <div className="hero">
          <h1 className="hero-title">FlashSeat</h1>
          <p className="hero-subtitle">
            Book tickets for concerts, sports, and live events in seconds
          </p>
          <div className="hero-actions">
            <button className="btn-hero-primary" onClick={openLogin}>
              Login
            </button>
            <button className="btn-hero-outline" onClick={openRegister}>
              Register
            </button>
          </div>
        </div>

        <div className="landing-features">
          <div className="feature-card">
            <div className="feature-icon">&#9889;</div>
            <h3>Lightning Fast</h3>
            <p>Real-time seat locking ensures you never lose your spot</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#127915;</div>
            <h3>Live Events</h3>
            <p>Concerts, sports, theater &mdash; all in one place</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#128274;</div>
            <h3>Secure Booking</h3>
            <p>ACID-compliant transactions protect every purchase</p>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialTab={initialTab}
      />
    </div>
  );
}
