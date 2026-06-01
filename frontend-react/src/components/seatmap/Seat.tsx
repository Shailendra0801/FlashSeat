import type { SeatMapItem } from '../../types';
import { useCartStore } from '../../stores/cartStore';
import { getSeatClassName } from '../../utils/seatUtils';

interface SeatProps {
  seat: SeatMapItem;
  onLock: (seat: SeatMapItem) => void;
}

export function Seat({ seat, onLock }: SeatProps) {
  const seatIds = useCartStore((s) => s.seatIds);
  const isLockedByMe = seatIds.has(seat.seat_id);
  const className = getSeatClassName(seat, isLockedByMe);
  const label = `${seat.row_name}${seat.seat_number}`;

  const isClickable = seat.status === 'available' && !isLockedByMe;

  return (
    <div
      className={className}
      title={`${label} - ${isLockedByMe ? 'locked by you' : seat.status}`}
      onClick={isClickable ? () => onLock(seat) : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
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
      {isLockedByMe ? 'Locked' : label}
    </div>
  );
}
