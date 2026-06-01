import type { SeatMapItem } from '../../types';
import { Seat } from './Seat';
import './SeatMap.css';

interface SeatMapProps {
  seats: SeatMapItem[];
  onLockSeat: (seat: SeatMapItem) => void;
}

export function SeatMap({ seats, onLockSeat }: SeatMapProps) {
  if (seats.length === 0) {
    return <p className="empty-text">No seats available for this session.</p>;
  }

  return (
    <div
      className="seat-grid"
      role="grid"
      aria-label="Venue seat map"
    >
      {seats.map((seat) => (
        <Seat key={seat.seat_id} seat={seat} onLock={onLockSeat} />
      ))}
    </div>
  );
}
