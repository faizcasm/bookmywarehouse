import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu, X, Search } from 'lucide-react';
import { ThemeToggle } from '@bmw/ui';
import { useAuth, PARTNER_APP_URL } from '../auth/AuthContext';
import { api } from '../lib/api';
import { formatRelativeTime } from '../lib/format';
import type { NotificationsPayload } from '../lib/types';

const NAV_LINKS = [
  { to: '/search', label: 'Explore' },
  { to: '/bookings', label: 'My bookings', auth: true },
  { to: '/messages', label: 'Messages', auth: true },
];

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState<NotificationsPayload['items']>([]);
  const rootRef = useRef<HTMLElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);

  // Track scroll to solidify header
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setBellOpen(false);
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      setRecent([]);
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api.getWithMeta<NotificationsPayload>('/notifications', { page: 1, limit: 5 });
        if (!cancelled) {
          setUnread(data.data.unread ?? 0);
          setRecent(data.data.items ?? []);
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

  // Close dropdowns on outside click / Escape; restore focus to trigger on mobile close
  useEffect(() => {
    if (!menuOpen && !bellOpen && !mobileOpen) return undefined;
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setBellOpen(false);
        if (mobileOpen) {
          setMobileOpen(false);
          mobileMenuTriggerRef.current?.focus();
        }
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setBellOpen(false);
        if (mobileOpen) {
          setMobileOpen(false);
          mobileMenuTriggerRef.current?.focus();
        }
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, bellOpen, mobileOpen]);

  // Mobile menu: aria-controls / aria-expanded wiring
  const mobileMenuId = 'mobile-nav';

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  };

  const onMarkAllRead = async () => {
    try {
      await api.post('/notifications/read', {});
      setUnread(0);
      setRecent((items) => items.map((item) => ({ ...item, read: true })));
    } catch {
      /* ignore */
    }
  };

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header
      className={`site-header ${scrolled ? 'scrolled' : ''}`}
      ref={rootRef}
      role="banner"
    >
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="BookMyWarehouse home">
          <img className="brand-mark" src="/icons/icon-192.png" alt="" aria-hidden="true" />
          <span className="brand-text">
            BookMy<span className="brand-accent">Warehouse</span>
          </span>
        </Link>

        <form className="header-search" role="search" onSubmit={onSearch}>
          <label htmlFor="header-search-input" className="visually-hidden">
            Search listings
          </label>
          <input
            id="header-search-input"
            className="input header-search-input"
            type="search"
            placeholder="Search warehouses, equipment, services…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" aria-label="Search">
            <Search size={14} aria-hidden="true" />
            Search
          </button>
        </form>

        <nav
          id={mobileMenuId}
          className={`header-nav ${mobileOpen ? 'is-open' : ''}`}
          aria-label="Main navigation"
          aria-expanded={mobileOpen}
          aria-controls={mobileMenuId}
        >
          {NAV_LINKS.filter((link) => !link.auth || user).map((link) => (
            <NavLink key={link.to} to={link.to} className="nav-link">
              {link.label}
            </NavLink>
          ))}
          {!user ? (
            <>
              <a className="nav-link" href={PARTNER_APP_URL}>
                List your space
              </a>
              <Link to="/login" className="btn btn-outline btn-sm">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Join free
              </Link>
            </>
          ) : null}
        </nav>

        <div className="header-actions">
          {user ? (
            <>
              <div className="dropdown-anchor">
                <button
                  type="button"
                  className="icon-btn bell-btn"
                  aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
                  aria-expanded={bellOpen}
                  aria-controls={bellOpen ? 'notifications-dropdown' : undefined}
                  onClick={() => {
                    setBellOpen((v) => !v);
                    setMenuOpen(false);
                  }}
                >
                  <Bell size={17} aria-hidden="true" />
                  {unread > 0 ? <span className="badge-count">{unread > 99 ? '99+' : unread}</span> : null}
                </button>
                {bellOpen ? (
                  <div
                    id="notifications-dropdown"
                    className="dropdown bell-dropdown"
                    role="menu"
                    aria-label="Recent notifications"
                  >
                    <div className="dropdown-head">
                      <strong>Notifications</strong>
                      {unread > 0 ? (
                        <button type="button" className="link-btn" onClick={onMarkAllRead}>
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
                            <Link to="/notifications">
                              <strong>{item.title}</strong>
                              <span className="muted">{item.body}</span>
                              <time dateTime={item.createdAt}>{formatRelativeTime(item.createdAt)}</time>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link to="/notifications" className="dropdown-foot">
                      View all notifications →
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="dropdown-anchor">
                <button
                  type="button"
                  className="user-btn"
                  aria-label="Account menu"
                  aria-expanded={menuOpen}
                  aria-controls={menuOpen ? 'user-dropdown' : undefined}
                  onClick={() => {
                    setMenuOpen((v) => !v);
                    setBellOpen(false);
                  }}
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="avatar" />
                  ) : (
                    <span className="avatar avatar-fallback" aria-hidden="true">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="user-btn-name">{user.name.split(' ')[0]}</span>
                </button>
                {menuOpen ? (
                  <div
                    id="user-dropdown"
                    className="dropdown user-dropdown"
                    role="menu"
                    aria-label="Account"
                  >
                    <div className="dropdown-head">
                      <strong>{user.name}</strong>
                      <span className="muted">{user.email}</span>
                    </div>
                    <Link className="dropdown-item" to="/profile">
                      Profile
                    </Link>
                    <Link className="dropdown-item" to="/bookings">
                      My bookings
                    </Link>
                    <Link className="dropdown-item" to="/favorites">
                      Favorites
                    </Link>
                    <Link className="dropdown-item" to="/reviews">
                      My reviews
                    </Link>
                    <Link className="dropdown-item" to="/invoices">
                      Invoices
                    </Link>
                    <Link className="dropdown-item" to="/disputes">
                      Disputes
                    </Link>
                    <button type="button" className="dropdown-item dropdown-danger" onClick={onLogout}>
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <button
            type="button"
            ref={mobileMenuTriggerRef}
            className="icon-btn mobile-menu-btn"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            aria-controls={mobileMenuId}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <X size={18} aria-hidden="true" />
            ) : (
              <Menu size={18} aria-hidden="true" />
            )}
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
