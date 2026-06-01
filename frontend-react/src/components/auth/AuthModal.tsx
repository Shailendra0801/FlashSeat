import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import './AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'register';
}

export function AuthModal({ isOpen, onClose, initialTab = 'login' }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const { login, register, error, isLoading, clearError } = useAuthStore();
  const navigate = useNavigate();

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setLocalError('');
      clearError();
    }
  }, [isOpen, initialTab]);

  const switchTab = (t: 'login' | 'register') => {
    setTab(t);
    setLocalError('');
    clearError();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    try {
      await login(loginForm.email, loginForm.password);
      onClose();
      navigate('/dashboard');
    } catch {
      setLocalError(error || 'Login failed. Please try again.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (registerForm.password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    try {
      await register(registerForm.fullName, registerForm.email, registerForm.password);
      setLocalError('');
      switchTab('login');
      setLocalError('Account created! Please login.');
    } catch {
      setLocalError(error || 'Registration failed. Please try again.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tab === 'login' ? 'Welcome Back' : 'Create Account'}>
      <div className="auth-tabs">
        <button
          className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
          onClick={() => switchTab('login')}
        >
          Login
        </button>
        <button
          className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
          onClick={() => switchTab('register')}
        >
          Register
        </button>
      </div>

      {localError && (
        <div className={`auth-message ${localError.includes('created') ? 'success' : 'error'}`}>
          {localError}
        </div>
      )}

      {tab === 'login' ? (
        <form className="auth-form" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email Address"
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            required
          />
          <button type="submit" className="auth-submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Full Name"
            value={registerForm.fullName}
            onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
            required
          />
          <input
            type="email"
            placeholder="Email Address"
            value={registerForm.email}
            onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={registerForm.password}
            onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={registerForm.confirmPassword}
            onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
            required
          />
          <button type="submit" className="auth-submit" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      )}
    </Modal>
  );
}
