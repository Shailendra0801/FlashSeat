import type { SeatSection } from '../types';

export const API_BASE = 'http://127.0.0.1:8000';

export const SECTION_COLORS: Record<SeatSection, string> = {
  vip: '#8b5cf6',
  premium: '#3b82f6',
  regular: '#6b7280',
  standing: '#f59e0b',
};

export const SECTION_LABELS: Record<SeatSection, string> = {
  vip: 'VIP',
  premium: 'Premium',
  regular: 'Regular',
  standing: 'Standing',
};
