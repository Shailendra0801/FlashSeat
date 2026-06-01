import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { OrderCard } from './OrderCard';
import type { OrderHistory } from '../../types';

export function OrderList() {
  const [orders, setOrders] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest<{ orders: OrderHistory[] }>('/orders/me');
        setOrders(data.orders || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="loading-spinner" />;
  }

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <p>No orders yet. Book some seats to get started!</p>
      </div>
    );
  }

  return (
    <div className="order-list">
      {orders.map((order) => (
        <OrderCard key={order.order_id} order={order} />
      ))}
    </div>
  );
}
