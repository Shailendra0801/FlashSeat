import { useCartStore } from '../../stores/cartStore';

interface CartItemProps {
  seatId: string;
  label: string;
}

export function CartItem({ seatId, label }: CartItemProps) {
  const removeSeatWithUnlock = useCartStore((s) => s.removeSeatWithUnlock);

  return (
    <div className="cart-item" role="listitem">
      <span className="cart-item-label">{label}</span>
      <button
        className="cart-item-remove"
        onClick={() => removeSeatWithUnlock(seatId)}
        title="Remove from cart and release lock"
        aria-label={`Remove ${label} from cart`}
      >
        &times;
      </button>
    </div>
  );
}
