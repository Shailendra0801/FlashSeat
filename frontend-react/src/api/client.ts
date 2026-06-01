import { API_BASE } from '../utils/constants';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('flashseat-token');

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (response.status === 401) {
    localStorage.removeItem('flashseat-token');
    window.location.href = '/';
    throw new ApiError('Session expired. Please login again.', 401);
  }

  if (!response.ok) {
    let detail = `API request failed (HTTP ${response.status})`;
    try {
      const errData = await response.json();
      detail = errData.detail || detail;
    } catch {}
    throw new ApiError(detail, response.status);
  }

  try {
    return await response.json();
  } catch {
    return null as T;
  }
}
