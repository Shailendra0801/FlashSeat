import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { showToast } from './Toast';

/**
 * Decodes JWT expiry and warns user 2 minutes before session expires.
 * Also handles 429 rate limiting globally via fetch override.
 */
export function SessionTimeoutWarning() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [warningShown, setWarningShown] = useState(false);

  useEffect(() => {
    if (!token) return;

    let timeout: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval>;

    try {
      // Decode JWT payload (middle part)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expMs = payload.exp * 1000;
      const now = Date.now();
      const msUntilExpiry = expMs - now;

      if (msUntilExpiry <= 0) {
        logout();
        showToast('Session expired. Please login again.', 'info');
        return;
      }

      // Warn 2 minutes before expiry
      const warnAt = msUntilExpiry - 120_000;
      if (warnAt > 0) {
        timeout = setTimeout(() => {
          setWarningShown(true);
          showToast('Session expiring in 2 minutes. Please save your work.', 'info');
        }, warnAt);
      }

      // Auto-logout at expiry
      interval = setInterval(() => {
        if (Date.now() >= expMs) {
          logout();
          showToast('Session expired. Please login again.', 'info');
          clearInterval(interval);
        }
      }, 10_000);
    } catch {
      // Token is not a valid JWT, skip
    }

    return () => {
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [token, logout]);

  // Rate limit handler - override fetch to show toast on 429
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 429) {
        showToast('Too many requests. Please slow down.', 'error');
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
