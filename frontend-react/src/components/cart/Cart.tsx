import { useState } from 'react';
import { useCartStore } from '../../stores/cartStore';
import { CartItem } from './CartItem';
import { CartSummary } from './CartSummary';
import { ConfirmCheckoutModal } from './ConfirmCheckoutModal';
import type { SeatMapItem } from '../../types';
import { getSeatLabel } from '../../utils/seatUtils';
import './Cart.css';

interface CartProps {
  seatMap: SeatMapItem[];
}

export function Cart({ seatMap }: CartProps) {
  const { seatIds, checkoutInProgress, errorMessage } = useCartStore();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedSeats = seatMap.filter((s) => seatIds.has(s.seat_id));
  const seatLabelMap = new Map(seatMap.map((s) => [s.seat_id, getSeatLabel(s)]));

  return (
    <>
      <div className="cart-panel">
        <h2>Cart</h2>

        <CartSummary seatMap={seatMap} />

        {seatIds.size === 0 ? (
          <p className="cart-empty">Click available seats to add them to your cart.</p>
        ) : (
          <div className="cart-items">
            {Array.from(seatIds).map((seatId) => (
              <CartItem
                key={seatId}
                seatId={seatId}
                label={seatLabelMap.get(seatId) || `Seat ${seatId.slice(0, 8)}`}
              />
            ))}
          </div>
        )}

        {errorMessage && <p className="cart-error">{errorMessage}</p>}

        <button
          className="btn-checkout"
          disabled={seatIds.size === 0 || checkoutInProgress}
          onClick={() => setConfirmOpen(true)}
        >
          {checkoutInProgress ? 'Processing...' : `Checkout (${seatIds.size} seat${seatIds.size !== 1 ? 's' : ''})`}
        </button>

        <p className="cart-note">
          Removed seats will be released automatically when the lock expires.
        </p>
      </div>

      <ConfirmCheckoutModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        seatMap={seatMap}
      />
    </>
  );
}
