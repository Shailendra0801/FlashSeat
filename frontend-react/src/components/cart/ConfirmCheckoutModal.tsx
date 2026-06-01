import { useCartStore } from '../../stores/cartStore';
import type { SeatMapItem } from '../../types';
import { getSeatLabel } from '../../utils/seatUtils';
import { Modal } from '../ui/Modal';

interface ConfirmCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  seatMap: SeatMapItem[];
}

export function ConfirmCheckoutModal({ isOpen, onClose, seatMap }: ConfirmCheckoutModalProps) {
  const { seatIds, checkoutInProgress, checkout } = useCartStore();

  const selectedSeats = seatMap.filter((s) => seatIds.has(s.seat_id));

  const handleConfirm = async () => {
    try {
      await checkout();
      onClose();
    } catch {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Booking" maxWidth="440px">
      <div className="confirm-checkout">
        <p className="confirm-description">
          You are about to book <strong>{selectedSeats.length}</strong> seat
          {selectedSeats.length !== 1 ? 's' : ''}:
        </p>

        <div className="confirm-seats">
          {selectedSeats.map((seat) => (
            <span key={seat.seat_id} className="confirm-seat-pill">
              {getSeatLabel(seat)}
            </span>
          ))}
        </div>

        <p className="confirm-note">
          This action cannot be undone. Your seats will be permanently reserved.
        </p>

        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onClose} disabled={checkoutInProgress}>
            Cancel
          </button>
          <button className="btn-confirm" onClick={handleConfirm} disabled={checkoutInProgress}>
            {checkoutInProgress ? 'Processing...' : 'Confirm Booking'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
