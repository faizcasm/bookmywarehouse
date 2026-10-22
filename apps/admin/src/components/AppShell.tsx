import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowRightLeft,
  BadgeCheck,
  Banknote,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Percent,
  Receipt,
  ScrollText,
  Settings,
  Star,
  Tags,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Avatar, ThemeToggle, pageTransition } from '@bmw/ui';
import { useAuth } from '../auth/AuthContext';
import { apiGet, apiSend } from '../lib/api';
import { formatRelativeTime } from '../lib/format';

interface NavSection {
  title: string;
  links: { to: string; label: string; end?: boolean; icon: typeof Users }[];
}

const SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    links: [{ to: '/', label: 'Dashboard', end: true, icon: LayoutDashboard }],
  },
  {
    title: 'People',
    links: [
      { to: '/users', label: 'Users', icon: Users },
      { to: '/partners', label: 'Partners', icon: Building2 },
      { to: '/verification-queue', label: 'Verification queue', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Marketplace',
    links: [
      { to: '/listings', label: 'Listings', icon: Boxes },
      { to: '/categories', label: 'Categories', icon: Tags },
      { to: '/reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    title: 'Operations',
    links: [
      { to: '/bookings', label: 'Bookings', icon: CalendarDays },
      { to: '/disputes', label: 'Disputes', icon: ArrowRightLeft },
    ],
  },
  {
    title: 'Finance',
    links: [
      { to: '/payments', label: 'Payments', icon: Banknote },
      { to: '/refunds', label: 'Refunds', icon: Wallet },
      { to: '/invoices', label: 'Invoices', icon: Receipt },
    ],
  },
  {
    title: 'System',
    links: [
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: '/audit', label: 'Audit log', icon: ScrollText },
    ],
  },
];

const TITLES: { match: (p: string) => boolean; title: string }[] = [
  { match: (p) => p === '/', title: 'Dashboard' },
  { match: (p) => p.startsWith('/users'), title: 'Users' },
  { match: (p) => p.startsWith('/verification-queue'), title: 'Verification queue' },
  { match: (p) => p.startsWith('/partners'), title: 'Partners' },
  { match: (p) => p.startsWith('/listings'), title: 'Listings' },
  { match: (p) => p.startsWith('/categories'), title: 'Categories' },
  { match: (p) => p.startsWith('/reviews'), title: 'Reviews' },
  { match: (p) => p.startsWith('/bookings'), title: 'Bookings' },
  { match: (p) => p.startsWith('/disputes'), title: 'Disputes' },
  { match: (p) => p.startsWith('/payments'), title: 'Payments' },
  { match: (p) => p.startsWith('/refunds'), title: 'Refunds' },
  { match: (p) => p.startsWith('/invoices'), title: 'Invoices' },
  { match: (p) => p.startsWith('/settings'), title: 'Settings' },
  { match: (p) => p.startsWith('/audit'), title: 'Audit log' },
];

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

/** Scrolls the window to the top on route change. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState<NotificationItem[]>([]);

  const pageTitle = TITLES.find((t) => t.match(location.pathname))?.title ?? 'Admin';

  // Keep the tab title in sync with the visible page heading.
  useEffect(() => {
    document.title = `${pageTitle} · BookMyWarehouse`;
  }, [pageTitle]);

  // Close transient chrome whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
    setBellOpen(false);
    setSidebarOpen(false);
  }, [location.pathname, location.search]);

  // Non-critical notifications feed for the bell.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiGet<{ unread?: number; items?: NotificationItem[] }>('/notifications', {
          page: 1,
          limit: 5,
        });
        if (!cancelled) {
          setUnread(data.unread ?? 0);
          setRecent(data.items ?? []);
        }
      } catch {
        /* the bell is non-critical */
      }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (!menuOpen && !bellOpen) return undefined;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.dropdown-anchor') && !target?.closest('.topbar__user')) {
        setMenuOpen(false);
        setBellOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, bellOpen]);

  const onMarkAllRead = async () => {
    try {
      await apiSend('POST', '/notifications/read', {});
      setUnread(0);
      setRecent((items) => items.map((item) => ({ ...item, read: true })));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="shell">
      <ScrollToTop />
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">
            BMW
          </span>
          <div>
            <div className="sidebar__name">BookMyWarehouse</div>
            <div className="sidebar__tag">Admin console</div>
          </div>
        </div>
        <nav className="sidebar__nav" aria-label="Main navigation">
          {SECTIONS.map((section) => (
            <div key={section.title} className="nav-section">
              <div className="nav-section__title">{section.title}</div>
              {section.links.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon size={16} className="nav-link__icon" aria-hidden="true" />
                    {link.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="shell__main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__burger"
            aria-label="Toggle navigation"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
          <h1 className="topbar__title">{pageTitle}</h1>
          <div className="topbar__actions">
            <div className="dropdown-anchor">
              <button
                type="button"
                className="icon-btn bell-btn"
                aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
                aria-expanded={bellOpen}
                onClick={() => {
                  setBellOpen((v) => !v);
                  setMenuOpen(false);
                }}
              >
                <Bell size={17} aria-hidden="true" />
                {unread > 0 ? <span className="badge-count">{unread > 99 ? '99+' : unread}</span> : null}
              </button>
              {bellOpen ? (
                <div className="dropdown bell-dropdown" role="menu" aria-label="Recent notifications">
                  <div className="dropdown-head">
                    <strong>Notifications</strong>
                    {unread > 0 ? (
                      <button type="button" className="btn btn--sm btn--ghost" onClick={onMarkAllRead}>
                        Mark all read
                      </button>
                    ) : null}
                  </div>
                  {recent.length === 0 ? (
                    <p className="dropdown-empty">No notifications yet.</p>
                  ) : (
                    <ul className="notification-mini-list">
                      {recent.map((item) => (
                        <li key={item.id} className={item.read ? 'is-read' : 'is-unread'}>
                          {item.link ? (
                            <Link to={item.link}>
                              <strong>{item.title}</strong>
                              <span className="muted">{item.body}</span>
                              <time dateTime={item.createdAt}>{formatRelativeTime(item.createdAt)}</time>
                            </Link>
                          ) : (
                            <span>
                              <strong>{item.title}</strong>
                              <span className="muted">{item.body}</span>
                              <time dateTime={item.createdAt}>{formatRelativeTime(item.createdAt)}</time>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <div className="topbar__sep" aria-hidden="true" />

            <div className="topbar__user">
              <button
                type="button"
                className="topbar__user-btn"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <Avatar name={user?.name ?? 'Admin'} size={30} />
                <span className="topbar__user-name">{user?.name ?? 'Admin'}</span>
                <span className="topbar__chevron" aria-hidden="true">
                  <ChevronDown size={14} />
                </span>
              </button>
              {menuOpen ? (
                <div className="user-menu" role="menu" onMouseLeave={() => setMenuOpen(false)}>
                  <div className="user-menu__head">
                    <div className="user-menu__name">{user?.name}</div>
                    <div className="user-menu__email">{user?.email}</div>
                  </div>
                  <Link className="user-menu__item" role="menuitem" to="/users">
                    <UserRound size={15} aria-hidden="true" />
                    Manage account
                  </Link>
                  <Link className="user-menu__item" role="menuitem" to="/settings">
                    <Settings size={15} aria-hidden="true" />
                    Platform settings
                  </Link>
                  <Link className="user-menu__item" role="menuitem" to="/audit">
                    <Activity size={15} aria-hidden="true" />
                    Audit log
                  </Link>
                  <button
                    type="button"
                    className="user-menu__item user-menu__item--danger"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout().then(() => navigate('/login'));
                    }}
                  >
                    <LogOut size={15} aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>

            <ThemeToggle />
          </div>
        </header>
        <main className="content">
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
