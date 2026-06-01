import { create } from 'zustand';
import { apiRequest } from '../api/client';
import type { CreateOrderResponse, SeatMapItem } from '../types';

interface CartState {
  seatIds: Set<string>;
  sessionId: string | null;
  checkoutInProgress: boolean;
  checkoutSuccess: boolean;
  lastOrder: CreateOrderResponse | null;
  errorMessage: string | null;

  addSeat: (seatId: string) => void;
  removeSeat: (seatId: string) => void;
  setSession: (sessionId: string) => void;
  clearCart: () => void;
  reconcile: (seats: SeatMapItem[], currentUserId: string) => void;
  checkout: () => Promise<void>;
  clearCheckoutResult: () => void;
  setErrorMessage: (msg: string | null) => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  seatIds: new Set(),
  sessionId: null,
  checkoutInProgress: false,
  checkoutSuccess: false,
  lastOrder: null,
  errorMessage: null,

  addSeat: (seatId) => {
    const next = new Set(get().seatIds);
    next.add(seatId);
    set({ seatIds: next });
  },

  removeSeat: (seatId) => {
    const next = new Set(get().seatIds);
    next.delete(seatId);
    set({ seatIds: next });
  },

  setSession: (sessionId) => {
    const current = get().sessionId;
    if (current !== sessionId) {
      set({ sessionId, seatIds: new Set(), checkoutSuccess: false, lastOrder: null, errorMessage: null });
    }
  },

  clearCart: () => {
    set({ seatIds: new Set(), checkoutSuccess: false, lastOrder: null, errorMessage: null });
  },

  reconcile: (seats, currentUserId) => {
    const newIds = new Set<string>();
    for (const seat of seats) {
      if (
        seat.status === 'reserved' &&
        seat.booked_by === currentUserId
      ) {
        newIds.add(seat.seat_id);
      }
    }
    set({ seatIds: newIds });
  },

  checkout: async () => {
    const { sessionId, seatIds } = get();
    if (!sessionId || seatIds.size === 0) return;

    set({ checkoutInProgress: true, errorMessage: null });

    try {
      const data = await apiRequest<CreateOrderResponse>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          seat_ids: Array.from(seatIds),
        }),
      });
      set({
        lastOrder: data,
        checkoutSuccess: true,
        seatIds: new Set(),
        checkoutInProgress: false,
      });
    } catch (err: any) {
      set({
        errorMessage: err.message || 'Checkout failed',
        checkoutInProgress: false,
      });
      throw err;
    }
  },

  clearCheckoutResult: () => {
    set({ checkoutSuccess: false, lastOrder: null });
  },

  setErrorMessage: (msg) => {
    set({ errorMessage: msg });
  },
}));
