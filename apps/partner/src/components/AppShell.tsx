import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  ExternalLink,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ShieldCheck,
  Star,
  User,
  UserRound,
  Warehouse,
  X,
} from 'lucide-react';
import { ThemeToggle, pageTransition, popIn } from '@bmw/ui';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { CUSTOMER_APP_URL } from '../lib/app-links';
import { initials, mapNotificationLink, relativeTime } from '../lib/format';
import type { NotificationDTO } from '../lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Warehouse;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/listings', label: 'Listings', icon: Warehouse },
  { to: '/bookings', label: 'Bookings', icon: CalendarClock },
  { to: '/earnings', label: 'Earnings', icon: IndianRupee },
  { to: '/reviews', label: 'Reviews', icon: Star },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/onboarding', label: 'Onboarding & KYC', icon: BadgeCheck },
  { to: '/profile', label: 'Profile', icon: UserRound },
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
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Close topmost layer on Esc: user menu > bell > mobile drawer
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (menuOpen) {
        setMenuOpen(false);
        event.preventDefault();
      } else if (bellOpen) {
        setBellOpen(false);
        event.preventDefault();
      } else if (drawerOpen) {
        setDrawerOpen(false);
        event.preventDefault();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, bellOpen, drawerOpen]);

  // Restore focus to hamburger when drawer closes
  useEffect(() => {
    if (!drawerOpen && hamburgerRef.current) {
      hamburgerRef.current.focus();
    }
  }, [drawerOpen]);

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

  const currentTitle = pageTitle(location.pathname);

  // Keep the tab title in sync with the visible page heading.
  useEffect(() => {
    document.title = `${currentTitle} · BookMyWarehouse`;
  }, [currentTitle]);

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
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `shell__nav-link ${isActive ? 'shell__nav-link--active' : ''}`
                }
              >
                <span className="shell__nav-icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={2} />
                </span>
                {item.label}
                {item.to === '/notifications' && unread > 0 ? (
                  <span className="shell__nav-badge">{unread}</span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
        <div className="shell__sidebar-footer">
          <a
            href={CUSTOMER_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shell__customer-link"
          >
            Customer marketplace
            <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
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
            {drawerOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
          <h1 className="shell__title">{currentTitle}</h1>
          <div className="shell__topbar-actions">
            <div className="bell" ref={bellRef}>
              <button
                type="button"
                className="bell__button"
                aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
                onClick={() => setBellOpen((open) => !open)}
              >
                <Bell size={19} strokeWidth={2} aria-hidden="true" />
                {unread > 0 ? (
                  <span className="bell__badge">{unread > 99 ? '99+' : unread}</span>
                ) : null}
              </button>
              <AnimatePresence>
                {bellOpen && (
                  <motion.div className="bell__dropdown glass-strong" role="menu" aria-label="Recent notifications" variants={popIn} initial="hidden" animate="show" exit="exit">
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
                  </motion.div>
                )}
              </AnimatePresence>
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
                  <ChevronDown size={16} strokeWidth={2} />
                </span>
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div className="user-menu__dropdown glass-strong" role="menu" variants={popIn} initial="hidden" animate="show" exit="exit">
                    <div className="user-menu__meta">
                      <strong>{user?.name}</strong>
                      <span>{user?.email}</span>
                    </div>
                    <Link to="/profile" className="user-menu__item" role="menuitem">
                      <User size={15} strokeWidth={2} aria-hidden="true" />
                      Profile
                    </Link>
                    <Link to="/onboarding" className="user-menu__item" role="menuitem">
                      <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
                      Onboarding & KYC
                    </Link>
                    <button
                      type="button"
                      className="user-menu__item user-menu__item--danger"
                      role="menuitem"
                      onClick={() => void handleLogout()}
                    >
                      <LogOut size={15} strokeWidth={2} aria-hidden="true" />
                      Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <ThemeToggle className="shell__theme-toggle" />
          </div>
        </header>
        <main className="shell__content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageTransition}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
