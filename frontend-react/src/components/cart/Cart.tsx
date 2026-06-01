import { useMemo, useState } from 'react';
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

  const seatLabelMap = useMemo(
    () => new Map(seatMap.map((s) => [s.seat_id, getSeatLabel(s)])),
    [seatMap]
  );

  return (
    <>
      <section className="cart-panel" aria-label="Shopping cart" aria-live="polite">
        <h2 id="cart-heading">Cart</h2>

        <CartSummary seatMap={seatMap} />

        {seatIds.size === 0 ? (
          <p className="cart-empty">Click available seats to add them to your cart.</p>
        ) : (
          <div className="cart-items" role="list" aria-label="Selected seats">
            {Array.from(seatIds).map((seatId) => (
              <div key={seatId} role="listitem">
                <CartItem
                  seatId={seatId}
                  label={seatLabelMap.get(seatId) || `Seat ${seatId.slice(0, 8)}`}
                />
              </div>
            ))}
          </div>
        )}

        {errorMessage && (
          <p className="cart-error" role="alert">{errorMessage}</p>
        )}

        <button
          className="btn-checkout"
          disabled={seatIds.size === 0 || checkoutInProgress}
          onClick={() => setConfirmOpen(true)}
          aria-describedby="cart-heading"
        >
          {checkoutInProgress
            ? 'Processing...'
            : `Checkout (${seatIds.size} seat${seatIds.size !== 1 ? 's' : ''})`}
        </button>

        <p className="cart-note">
          Removed seats will be released automatically when the lock expires.
        </p>
      </section>

      <ConfirmCheckoutModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        seatMap={seatMap}
      />
    </>
  );
}
