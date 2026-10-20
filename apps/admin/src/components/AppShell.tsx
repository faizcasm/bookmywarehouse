import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface NavSection {
  title: string;
  links: { to: string; label: string; end?: boolean }[];
}

const SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    links: [{ to: '/', label: 'Dashboard', end: true }],
  },
  {
    title: 'People',
    links: [
      { to: '/users', label: 'Users' },
      { to: '/partners', label: 'Partners' },
      { to: '/verification-queue', label: 'Verification queue' },
    ],
  },
  {
    title: 'Marketplace',
    links: [
      { to: '/listings', label: 'Listings' },
      { to: '/categories', label: 'Categories' },
      { to: '/reviews', label: 'Reviews' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { to: '/bookings', label: 'Bookings' },
      { to: '/disputes', label: 'Disputes' },
    ],
  },
  {
    title: 'Finance',
    links: [
      { to: '/payments', label: 'Payments' },
      { to: '/refunds', label: 'Refunds' },
      { to: '/invoices', label: 'Invoices' },
    ],
  },
  {
    title: 'System',
    links: [
      { to: '/settings', label: 'Settings' },
      { to: '/audit', label: 'Audit log' },
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

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageTitle = TITLES.find((t) => t.match(location.pathname))?.title ?? 'Admin';

  return (
    <div className="shell">
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
              {section.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {link.label}
                </NavLink>
              ))}
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
            ☰
          </button>
          <h1 className="topbar__title">{pageTitle}</h1>
          <div className="topbar__user">
            <button
              type="button"
              className="topbar__user-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="avatar" aria-hidden="true">
                {(user?.name ?? 'A').charAt(0).toUpperCase()}
              </span>
              <span className="topbar__user-name">{user?.name ?? 'Admin'}</span>
              <span className="topbar__chevron" aria-hidden="true">
                ▾
              </span>
            </button>
            {menuOpen ? (
              <div className="user-menu" role="menu" onMouseLeave={() => setMenuOpen(false)}>
                <div className="user-menu__head">
                  <div className="user-menu__name">{user?.name}</div>
                  <div className="user-menu__email">{user?.email}</div>
                </div>
                <button
                  type="button"
                  className="user-menu__item user-menu__item--danger"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="content">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
