import type { SeatMapItem, SeatStatus } from '../types';

export function getSeatClassName(
  seat: SeatMapItem,
  isLockedByMe: boolean
): string {
  if (isLockedByMe) return 'seat locked-by-you';
  const status = seat.status.toLowerCase() as SeatStatus;
  switch (status) {
    case 'available':
      return 'seat available';
    case 'reserved':
      return 'seat unavailable';
    case 'booked':
      return 'seat sold';
    case 'blocked':
      return 'seat blocked';
    default:
      return 'seat';
  }
}

export function getSeatLabel(seat: SeatMapItem): string {
  return `${seat.row_name}${seat.seat_number}`;
}
