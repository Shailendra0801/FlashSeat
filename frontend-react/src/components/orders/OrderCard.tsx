import type { OrderHistory } from '../../types';

interface OrderCardProps {
  order: OrderHistory;
}

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function OrderCard({ order }: OrderCardProps) {
  const status = order.status || 'unknown';

  let badgeClass = 'status-pending';
  if (status === 'confirmed') badgeClass = 'status-confirmed';
  if (status === 'failed') badgeClass = 'status-failed';

  return (
    <div className="order-card">
      <div className="order-header">
        <span className="order-id">Order {order.order_id.slice(0, 8)}...</span>
        <span className={`status-badge ${badgeClass}`}>{status}</span>
      </div>
      <div className="order-date">{formatDateTime(order.created_at)}</div>
      {order.items.length > 0 ? (
        <div className="order-seats">
          {order.items.map((item) => (
            <span key={item.order_item_id} className="seat-pill">
              {item.seat_label}
            </span>
          ))}
        </div>
      ) : (
        <p className="order-no-items">No seat details available.</p>
      )}
    </div>
  );
}
