import { useCartStore } from '../../stores/cartStore';

interface CartItemProps {
  seatId: string;
  label: string;
}

export function CartItem({ seatId, label }: CartItemProps) {
  const removeSeat = useCartStore((s) => s.removeSeat);

  return (
    <div className="cart-item" role="listitem">
      <span className="cart-item-label">{label}</span>
      <button
        className="cart-item-remove"
        onClick={() => removeSeat(seatId)}
        title="Remove from cart (lock expires naturally)"
        aria-label={`Remove ${label} from cart`}
      >
        &times;
      </button>
    </div>
  );
}
