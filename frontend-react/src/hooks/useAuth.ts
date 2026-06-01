import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const navigate = useNavigate();
  const { token, user, fetchUser } = useAuthStore();

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    if (!user) {
      fetchUser();
    }
  }, [token, user, fetchUser, navigate]);

  return { token, user };
}
