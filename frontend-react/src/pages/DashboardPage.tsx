import { useAuth } from '../hooks/useAuth';
import { EventList } from '../components/events/EventList';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <h1 className="page-title">Welcome Back{user ? `, ${user.full_name}` : ''}!</h1>
      <div className="card">
        <h3 className="card-title">Upcoming Events</h3>
        <EventList />
      </div>
    </>
  );
}
