import { useState } from 'react';
import type { OrderHistory } from '../../types';
import { apiRequest } from '../../api/client';
import { showToast } from '../ui/Toast';

interface OrderCardProps {
  order: OrderHistory;
  onCancelled?: () => void;
}

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function OrderCard({ order, onCancelled }: OrderCardProps) {
  const status = order.status || 'unknown';
  const [cancelling, setCancelling] = useState(false);

  let badgeClass = 'status-pending';
  if (status === 'confirmed') badgeClass = 'status-confirmed';
  if (status === 'failed') badgeClass = 'status-failed';
  if (status === 'cancelled') badgeClass = 'status-cancelled';

  const canCancel = status === 'confirmed' || status === 'pending';

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this order? Your seats will be released.')) return;
    setCancelling(true);
    try {
      await apiRequest(`/orders/${order.order_id}/cancel`, { method: 'POST' });
      showToast('Order cancelled successfully.', 'success');
      onCancelled?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel order', 'error');
    } finally {
      setCancelling(false);
    }
  };

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
      {canCancel && (
        <button
          className="btn-small btn-cancel-order"
          onClick={handleCancel}
          disabled={cancelling}
          style={{ marginTop: 12 }}
        >
          {cancelling ? 'Cancelling...' : 'Cancel Order'}
        </button>
      )}
    </div>
  );
}
