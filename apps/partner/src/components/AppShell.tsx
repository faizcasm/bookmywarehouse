import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { CUSTOMER_APP_URL } from '../lib/app-links';
import { initials, mapNotificationLink, relativeTime } from '../lib/format';
import type { NotificationDTO } from '../lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '▤', end: true },
  { to: '/listings', label: 'Listings', icon: '▦' },
  { to: '/bookings', label: 'Bookings', icon: '◷' },
  { to: '/earnings', label: 'Earnings', icon: '₹' },
  { to: '/reviews', label: 'Reviews', icon: '★' },
  { to: '/messages', label: 'Messages', icon: '✉' },
  { to: '/notifications', label: 'Notifications', icon: '◔' },
  { to: '/onboarding', label: 'Onboarding & KYC', icon: '✓' },
  { to: '/profile', label: 'Profile', icon: '☰' },
];

const PAGE_TITLES: { match: RegExp; title: string }[] = [
  { match: /^\/$/, title: 'Dashboard' },
  { match: /^\/listings\/new/, title: 'New listing' },
  { match: /^\/listings\/[^/]+/, title: 'Listing' },
  { match: /^\/listings/, title: 'Listings' },
  { match: /^\/bookings\/[^/]+/, title: 'Booking details' },
  { match: /^\/bookings/, title: 'Bookings' },
  { match: /^\/earnings/, title: 'Earnings' },
  { match: /^\/reviews/, title: 'Reviews' },
  { match: /^\/messages\/[^/]+/, title: 'Conversation' },
  { match: /^\/messages/, title: 'Messages' },
  { match: /^\/notifications/, title: 'Notifications' },
  { match: /^\/onboarding/, title: 'Onboarding & KYC' },
  { match: /^\/profile/, title: 'Profile' },
];

function pageTitle(pathname: string): string {
  return PAGE_TITLES.find((entry) => entry.match.test(pathname))?.title ?? 'Partner console';
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState<NotificationDTO[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.get<{ unread: number; items: NotificationDTO[] }>('/notifications', {
        limit: 5,
      });
      setUnread(data.unread ?? 0);
      setRecent(Array.isArray(data.items) ? data.items.slice(0, 5) : []);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const timer = setInterval(() => void loadNotifications(), 30_000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => {
    setDrawerOpen(false);
    setBellOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) setBellOpen(false);
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  return (
    <div className={`shell ${drawerOpen ? 'shell--drawer-open' : ''}`}>
      <div className="shell__sidebar" id="app-sidebar">
        <div className="shell__brand">
          <span className="shell__brand-mark" aria-hidden="true">
            BMW
          </span>
          <div className="shell__brand-text">
            <strong>BookMyWarehouse</strong>
            <span>Partner console</span>
          </div>
        </div>
        <nav className="shell__nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `shell__nav-link ${isActive ? 'shell__nav-link--active' : ''}`
              }
            >
              <span className="shell__nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
              {item.to === '/notifications' && unread > 0 ? (
                <span className="shell__nav-badge">{unread}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="shell__sidebar-footer">
          <a
            href={CUSTOMER_APP_URL}
            target="_blank"
            rel="noreferrer"
            className="shell__customer-link"
          >
            Customer marketplace ↗
          </a>
        </div>
      </div>
      {drawerOpen ? (
        <div className="shell__scrim" onClick={() => setDrawerOpen(false)} role="presentation" />
      ) : null}

      <div className="shell__main">
        <header className="shell__topbar">
          <button
            type="button"
            className="shell__hamburger"
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            aria-controls="app-sidebar"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            ☰
          </button>
          <h1 className="shell__title">{pageTitle(location.pathname)}</h1>
          <div className="shell__topbar-actions">
            <div className="bell" ref={bellRef}>
              <button
                type="button"
                className="bell__button"
                aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
                onClick={() => setBellOpen((open) => !open)}
              >
                ◔
                {unread > 0 ? (
                  <span className="bell__badge">{unread > 99 ? '99+' : unread}</span>
                ) : null}
              </button>
              {bellOpen ? (
                <div className="bell__dropdown" role="menu" aria-label="Recent notifications">
                  <div className="bell__header">Notifications</div>
                  {recent.length === 0 ? (
                    <p className="bell__empty">No notifications yet.</p>
                  ) : (
                    recent.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`bell__item ${item.read ? '' : 'bell__item--unread'}`}
                        onClick={() => navigate(mapNotificationLink(item.link))}
                      >
                        <span className="bell__item-title">{item.title}</span>
                        <span className="bell__item-body">{item.body}</span>
                        <span className="bell__item-time">{relativeTime(item.createdAt)}</span>
                      </button>
                    ))
                  )}
                  <Link to="/notifications" className="bell__footer">
                    View all notifications
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="user-menu__button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="avatar avatar--sm">{initials(user?.name)}</span>
                <span className="user-menu__name">{user?.name}</span>
                <span className="user-menu__caret" aria-hidden="true">
                  ▾
                </span>
              </button>
              {menuOpen ? (
                <div className="user-menu__dropdown" role="menu">
                  <div className="user-menu__meta">
                    <strong>{user?.name}</strong>
                    <span>{user?.email}</span>
                  </div>
                  <Link to="/profile" className="user-menu__item" role="menuitem">
                    Profile
                  </Link>
                  <Link to="/onboarding" className="user-menu__item" role="menuitem">
                    Onboarding & KYC
                  </Link>
                  <button
                    type="button"
                    className="user-menu__item user-menu__item--danger"
                    role="menuitem"
                    onClick={() => void handleLogout()}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="shell__content">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
