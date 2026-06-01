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

// Placeholder prices (INR) — will be replaced by backend pricing when available
export const SECTION_PRICES: Record<SeatSection, number> = {
  vip: 5000,
  premium: 3000,
  regular: 1500,
  standing: 800,
};

export const CURRENCY = 'INR';

export function formatPrice(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
