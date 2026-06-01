import { useAuth } from '../hooks/useAuth';
import { OrderList } from '../components/orders/OrderList';

export function ProfilePage() {
  useAuth();

  return (
    <>
      <h1 className="page-title">Your Profile</h1>
      <div className="card">
        <h3 className="card-title">Order History</h3>
        <OrderList />
      </div>
    </>
  );
}
