import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Guards the admin shell: while the boot check runs we show a splash,
 * then either render the app or bounce to /login preserving the target path.
 * Non-ADMIN sessions are also bounced (never rendered).
 */
export function RequireAdmin() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="route-splash" role="status" aria-live="polite">
        <img className="route-splash__logo" src="/icons/icon-192.png" alt="" aria-hidden="true" />
        <div className="route-splash__spinner" aria-hidden="true" />
        <p>Checking session…</p>
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <Outlet />;
}

/** For /login: ADMINs never see the login form again. */
export function RequireGuest() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="route-splash" role="status" aria-live="polite">
        <img className="route-splash__logo" src="/icons/icon-192.png" alt="" aria-hidden="true" />
        <div className="route-splash__spinner" aria-hidden="true" />
        <p>Checking session…</p>
      </div>
    );
  }

  if (user && user.role === 'ADMIN') {
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    return <Navigate to={next && next.startsWith('/') ? next : '/'} replace />;
  }

  return <Outlet />;
}
