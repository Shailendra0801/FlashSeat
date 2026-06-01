import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ToastContainer } from './components/ui/Toast';
import { SessionTimeoutWarning } from './components/ui/SessionTimeout';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { EventPage } from './pages/EventPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { CreateEventPage } from './pages/CreateEventPage';
import { ManageEventsPage } from './pages/ManageEventsPage';
import { ManageUsersPage } from './pages/ManageUsersPage';
import { ManageOrdersPage } from './pages/ManageOrdersPage';
import { NotFoundPage } from './pages/NotFoundPage';
import './pages/DashboardPage.css';
import './pages/AdminPages.css';
import './components/checkout/CheckoutSuccess.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/events/:eventId" element={<EventPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/events/create" element={<CreateEventPage />} />
          <Route path="/admin/events" element={<ManageEventsPage />} />
          <Route path="/admin/users" element={<ManageUsersPage />} />
          <Route path="/admin/orders" element={<ManageOrdersPage />} />
        </Route>
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      <ToastContainer />
      <SessionTimeoutWarning />
    </BrowserRouter>
  );
}
