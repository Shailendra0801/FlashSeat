export interface User {
  user_id: string;
  full_name: string;
  email: string;
  is_admin: boolean;
}

export interface EventListItem {
  event_id: string;
  title: string;
  category: string;
  venue_name: string | null;
  venue_city: string | null;
  created_at: string;
  total_sessions: number;
}

export interface EventSession {
  session_id: string;
  session_name: string;
  start_time: string;
  doors_open_time: string | null;
  total_seats: number;
  available_seats: number;
  status: string;
}

export interface EventDetail {
  event_id: string;
  title: string;
  description: string | null;
  category: string;
  venue_name: string | null;
  venue_city: string | null;
  created_by: string;
  created_at: string;
  total_seats: number;
  total_sessions: number;
  sessions: EventSession[];
}

export type SeatStatus = 'available' | 'reserved' | 'booked' | 'blocked';
export type SeatSection = 'vip' | 'premium' | 'regular' | 'standing';

export interface SeatMapItem {
  session_seat_id: string;
  seat_id: string;
  row_name: string;
  seat_number: number;
  section: SeatSection;
  status: SeatStatus;
  booked_by: string | null;
  booked_at: string | null;
}

export interface SeatMapResponse {
  event_id: string;
  session_id: string;
  session_name: string;
  total_seats: number;
  available_seats: number;
  booked_seats: number;
  blocked_seats: number;
  unavailable_seats: number;
  seats: SeatMapItem[];
}

export interface OrderItem {
  order_item_id: string;
  seat_label: string;
}

export interface OrderHistory {
  order_id: string;
  status: string;
  created_at: string;
  items: OrderItem[];
}

export interface OrderResponse {
  order_id: string;
  status: string;
  failure_reason: string | null;
  created_at: string;
}

export interface CreateOrderResponse {
  order: OrderResponse;
}

export interface QueueStatus {
  status: 'access_granted' | 'in_queue';
  queue_position?: number;
  estimated_wait_seconds?: number;
}
