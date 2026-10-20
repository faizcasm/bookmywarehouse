import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicOnly, RequireAuth } from './auth/RouteGuard';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { DashboardPage } from './pages/Dashboard';
import { OnboardingPage } from './pages/Onboarding';
import { ListingsPage } from './pages/Listings';
import { ListingNewPage } from './pages/ListingNew';
import { ListingDetailPage } from './pages/ListingDetail';
import { BookingsPage } from './pages/Bookings';
import { BookingDetailPage } from './pages/BookingDetail';
import { EarningsPage } from './pages/Earnings';
import { ReviewsPage } from './pages/Reviews';
import { MessagesPage } from './pages/Messages';
import { ConversationPage } from './pages/Conversation';
import { NotificationsPage } from './pages/Notifications';
import { ProfilePage } from './pages/Profile';

export function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <div className="page-transition">
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          </div>
        }
      />
      <Route
        path="/register"
        element={
          <div className="page-transition">
            <PublicOnly>
              <RegisterPage />
            </PublicOnly>
          </div>
        }
      />

      {/* Partner console — PARTNER (or ADMIN) only */}
      <Route
        element={
          <RequireAuth roles={['PARTNER', 'ADMIN']}>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/listings" element={<ListingsPage />} />
        <Route path="/listings/new" element={<ListingNewPage />} />
        <Route path="/listings/:id" element={<ListingDetailPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
        <Route path="/earnings" element={<EarningsPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:id" element={<ConversationPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
