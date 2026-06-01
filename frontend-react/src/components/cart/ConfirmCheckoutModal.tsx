import { useState } from 'react';
import { useCartStore } from '../../stores/cartStore';
import type { SeatMapItem, SeatSection } from '../../types';
import { getSeatLabel } from '../../utils/seatUtils';
import { SECTION_PRICES, SECTION_LABELS, formatPrice } from '../../utils/constants';
import { Modal } from '../ui/Modal';

interface ConfirmCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  seatMap: SeatMapItem[];
}

type Step = 'confirm' | 'payment' | 'processing';

export function ConfirmCheckoutModal({ isOpen, onClose, seatMap }: ConfirmCheckoutModalProps) {
  const { seatIds, checkoutInProgress, checkout } = useCartStore();
  const [step, setStep] = useState<Step>('confirm');

  const selectedSeats = seatMap.filter((s) => seatIds.has(s.seat_id));

  // Calculate total
  const sectionCounts: Partial<Record<SeatSection, number>> = {};
  let totalAmount = 0;
  selectedSeats.forEach((seat) => {
    sectionCounts[seat.section] = (sectionCounts[seat.section] || 0) + 1;
    totalAmount += SECTION_PRICES[seat.section] || 0;
  });

  const handleClose = () => {
    setStep('confirm');
    onClose();
  };

  const handleProceedToPayment = () => {
    setStep('payment');
  };

  const handlePay = async () => {
    setStep('processing');
    try {
      // Simulate payment processing delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await checkout();
      handleClose();
    } catch {
      handleClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={
      step === 'confirm' ? 'Confirm Booking' :
      step === 'payment' ? 'Payment' :
      'Processing...'
    } maxWidth="480px">
      <div className="confirm-checkout">
        {step === 'confirm' && (
          <>
            <p className="confirm-description">
              You are about to book <strong>{selectedSeats.length}</strong> seat
              {selectedSeats.length !== 1 ? 's' : ''}:
            </p>

            <div className="confirm-seats">
              {selectedSeats.map((seat) => (
                <span key={seat.seat_id} className="confirm-seat-pill">
                  {getSeatLabel(seat)}
                  <span className="confirm-seat-section">
                    {SECTION_LABELS[seat.section]}
                  </span>
                </span>
              ))}
            </div>

            <div className="confirm-price-breakdown">
              {Object.entries(sectionCounts).map(([section, n]) => (
                <div key={section} className="confirm-price-line">
                  <span>{n}x {SECTION_LABELS[section as SeatSection]}</span>
                  <span>{formatPrice((SECTION_PRICES[section as SeatSection] || 0) * n!)}</span>
                </div>
              ))}
              <div className="confirm-price-total">
                <span>Total</span>
                <span>{formatPrice(totalAmount)}</span>
              </div>
            </div>

            <p className="confirm-note">
              This action cannot be undone. Your seats will be permanently reserved.
            </p>

            <div className="confirm-actions">
              <button className="btn-cancel" onClick={handleClose}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={handleProceedToPayment}>
                Proceed to Payment
              </button>
            </div>
          </>
        )}

        {step === 'payment' && (
          <>
            <div className="payment-section">
              <div className="payment-amount">
                <span className="payment-label">Amount to pay</span>
                <span className="payment-value">{formatPrice(totalAmount)}</span>
              </div>

              <div className="payment-method">
                <p className="payment-method-label">Payment Method</p>
                <div className="payment-option active">
                  <span className="payment-icon">&#128179;</span>
                  <div>
                    <strong>Pay with Card / UPI</strong>
                    <p className="payment-option-desc">Secure payment gateway</p>
                  </div>
                </div>
              </div>

              <p className="payment-disclaimer">
                This is a placeholder. A real payment gateway (Razorpay, Stripe, etc.)
                will be integrated here.
              </p>
            </div>

            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setStep('confirm')}>
                Back
              </button>
              <button className="btn-confirm" onClick={handlePay}>
                Pay {formatPrice(totalAmount)}
              </button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="payment-processing">
            <div className="payment-spinner" />
            <p>Processing your payment...</p>
            <p className="payment-processing-sub">Please do not close this window.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
