import type { SeatMapItem, SeatSection } from '../../types';
import { SECTION_LABELS, SECTION_PRICES, formatPrice } from '../../utils/constants';
import { useCartStore } from '../../stores/cartStore';

interface CartSummaryProps {
  seatMap: SeatMapItem[];
}

export function CartSummary({ seatMap }: CartSummaryProps) {
  const seatIds = useCartStore((s) => s.seatIds);
  const count = seatIds.size;

  if (count === 0) return null;

  const sectionCounts: Partial<Record<SeatSection, number>> = {};
  let totalAmount = 0;

  seatMap.forEach((seat) => {
    if (seatIds.has(seat.seat_id)) {
      sectionCounts[seat.section] = (sectionCounts[seat.section] || 0) + 1;
      totalAmount += SECTION_PRICES[seat.section] || 0;
    }
  });

  return (
    <div className="cart-summary">
      <div className="cart-summary-header">
        <span className="cart-summary-count">
          {count} seat{count !== 1 ? 's' : ''} selected
        </span>
        <span className="cart-summary-total">{formatPrice(totalAmount)}</span>
      </div>
      <div className="cart-summary-breakdown">
        {Object.entries(sectionCounts).map(([section, n]) => (
          <span key={section} className="cart-summary-item">
            {n} {SECTION_LABELS[section as SeatSection] || section}
            <span className="cart-summary-item-price">
              {formatPrice((SECTION_PRICES[section as SeatSection] || 0) * n!)}
            </span>
          </span>
        ))}
      </div>
      <p className="cart-summary-note">* Estimated pricing (final price set by organizer)</p>
    </div>
  );
}
