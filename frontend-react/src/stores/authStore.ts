import { create } from 'zustand';
import { apiRequest } from '../api/client';
import type { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  fetchUser: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('flashseat-token'),
  user: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest<{ access_token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('flashseat-token', data.access_token);
      set({ token: data.access_token });
      const user = await apiRequest<User>('/auth/me');
      set({ user, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Login failed', isLoading: false });
      throw err;
    }
  },

  register: async (fullName, email, password) => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest<User>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ full_name: fullName, email, password }),
      });
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Registration failed', isLoading: false });
      throw err;
    }
  },

  fetchUser: async () => {
    try {
      const user = await apiRequest<User>('/auth/me');
      set({ user });
    } catch {
      set({ token: null, user: null });
      localStorage.removeItem('flashseat-token');
    }
  },

  logout: () => {
    localStorage.removeItem('flashseat-token');
    set({ token: null, user: null });
  },

  clearError: () => set({ error: null }),
}));
