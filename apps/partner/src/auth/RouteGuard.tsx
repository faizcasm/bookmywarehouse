import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Role } from '../lib/types';

function loginUrlWithNext(pathname: string, search = ''): string {
  const next = encodeURIComponent(`${pathname}${search}`);
  return `/login?next=${next}`;
}

/** Full-page loader shown while the session is being restored. */
export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="fullpage-loader" role="status" aria-live="polite">
      <img className="fullpage-loader__logo" src="/icons/icon-192.png" alt="" aria-hidden="true" />
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

/**
 * Requires an authenticated user, optionally restricted to the given roles.
 * Unauthenticated users and users with a disallowed role are redirected to the
 * partner login page with a `next` parameter for post-login deep linking.
 */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader label="Restoring your session…" />;
  if (!user) return <Navigate to={loginUrlWithNext(location.pathname, location.search)} replace />;
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to={loginUrlWithNext(location.pathname, location.search)} replace />;
  }
  return <>{children}</>;
}

/** Redirects already-signed-in partners away from /login and /register. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader label="Restoring your session…" />;
  if (user && (user.role === 'PARTNER' || user.role === 'ADMIN')) {
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}
