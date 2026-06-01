import type { SeatMapItem } from '../../types';
import { SECTION_LABELS } from '../../utils/constants';
import { useCartStore } from '../../stores/cartStore';

interface CartSummaryProps {
  seatMap: SeatMapItem[];
}

export function CartSummary({ seatMap }: CartSummaryProps) {
  const seatIds = useCartStore((s) => s.seatIds);
  const count = seatIds.size;

  if (count === 0) return null;

  const sectionCounts: Record<string, number> = {};
  seatMap.forEach((seat) => {
    if (seatIds.has(seat.seat_id)) {
      const label = SECTION_LABELS[seat.section] || seat.section;
      sectionCounts[label] = (sectionCounts[label] || 0) + 1;
    }
  });

  const breakdown = Object.entries(sectionCounts)
    .map(([section, n]) => `${n} ${section}`)
    .join(', ');

  return (
    <div className="cart-summary">
      <span className="cart-summary-count">{count} seat{count !== 1 ? 's' : ''} selected</span>
      {breakdown && <span className="cart-summary-breakdown">{breakdown}</span>}
    </div>
  );
}
