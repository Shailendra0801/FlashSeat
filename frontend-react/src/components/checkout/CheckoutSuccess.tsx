import { Modal } from '../ui/Modal';
import { useCartStore } from '../../stores/cartStore';
import { useNavigate } from 'react-router-dom';

interface CheckoutSuccessProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheckoutSuccess({ isOpen, onClose }: CheckoutSuccessProps) {
  const lastOrder = useCartStore((s) => s.lastOrder);
  const navigate = useNavigate();

  const goToOrders = () => {
    onClose();
    navigate('/profile');
  };

  if (!lastOrder) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Booking Confirmed!" maxWidth="440px">
      <div className="checkout-success">
        <div className="success-icon">&#10003;</div>
        <p className="success-message">Your seats have been successfully booked.</p>
        <div className="success-order-id">
          Order ID: <code>{lastOrder.order.order_id}</code>
        </div>
        <div className="success-actions">
          <button className="btn-done" onClick={onClose}>
            Done
          </button>
          <button className="btn-view-orders" onClick={goToOrders}>
            View My Orders
          </button>
        </div>
      </div>
    </Modal>
  );
}
