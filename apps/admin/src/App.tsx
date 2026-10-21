import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin, RequireGuest } from './auth/RouteGuard';
import { AppShell } from './components/AppShell';
import { ToastProvider } from './components/Toast';
import { AuditPage } from './pages/AuditPage';
import { BookingDetailPage } from './pages/BookingDetailPage';
import { BookingsPage } from './pages/BookingsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { DashboardPage } from './pages/DashboardPage';
import { DisputesPage } from './pages/DisputesPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ListingsPage } from './pages/ListingsPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PartnerDetailPage } from './pages/PartnerDetailPage';
import { PartnersPage } from './pages/PartnersPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { RefundsPage } from './pages/RefundsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { VerificationQueuePage } from './pages/VerificationQueuePage';

export function App() {
  // Match the router to the Vite base (/admin/ on Vercel, / locally).
  const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '');
  return (
    <BrowserRouter basename={routerBasename || undefined}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<RequireGuest />}>
              <Route
                path="/login"
                element={
                  <div className="page-transition">
                    <LoginPage />
                  </div>
                }
              />
            </Route>
            <Route element={<RequireAdmin />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/partners" element={<PartnersPage />} />
                <Route path="/partners/:id" element={<PartnerDetailPage />} />
                <Route path="/verification-queue" element={<VerificationQueuePage />} />
                <Route path="/listings" element={<ListingsPage />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/bookings/:id" element={<BookingDetailPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/refunds" element={<RefundsPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/disputes" element={<DisputesPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/reviews" element={<ReviewsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
