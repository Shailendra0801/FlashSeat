import type { SeatMapItem } from '../../types';
import { useCartStore } from '../../stores/cartStore';
import { getSeatClassName, getSeatLabel } from '../../utils/seatUtils';
import { SECTION_LABELS, SECTION_PRICES, formatPrice } from '../../utils/constants';

interface SeatProps {
  seat: SeatMapItem;
  onLock: (seat: SeatMapItem) => void;
}

export function Seat({ seat, onLock }: SeatProps) {
  const seatIds = useCartStore((s) => s.seatIds);
  const isLockedByMe = seatIds.has(seat.seat_id);
  const className = getSeatClassName(seat, isLockedByMe);
  const label = getSeatLabel(seat);

  const isClickable = seat.status === 'available' && !isLockedByMe;

  const statusLabel = isLockedByMe ? 'Selected' : seat.status;
  const sectionLabel = SECTION_LABELS[seat.section] || seat.section;
  const price = SECTION_PRICES[seat.section] || 0;
  const tooltipText = `${label} (${sectionLabel}) — ${statusLabel} — ${formatPrice(price)}`;

  return (
    <div
      className={className}
      role="gridcell"
      aria-label={tooltipText}
      aria-disabled={!isClickable}
      onClick={isClickable ? () => onLock(seat) : undefined}
      tabIndex={isClickable ? 0 : -1}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onLock(seat);
              }
            }
          : undefined
      }
    >
      <span className="seat-tooltip">{tooltipText}</span>
      {isLockedByMe ? 'Locked' : label}
    </div>
  );
}
