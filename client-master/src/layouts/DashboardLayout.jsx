import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: '/organizations',
    label: 'Organizations',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/visitors',
    label: 'Visitors',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
    ),
  },
];

const LOOKUP_LINKS = [
  { to: '/lookups/titles',            label: 'Titles' },
  { to: '/lookups/countries',         label: 'Countries' },
  { to: '/lookups/hear-about',        label: 'Hear About' },
];

const DotIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="7" height="7">
    <circle cx="12" cy="12" r="5" />
  </svg>
);

const LookupIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initial = (user?.name || 'M')[0].toUpperCase();

  return (
    <div className="layout">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="navbar-left">
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="navbar-logo">
            Eventadex
          </div>
        </div>

        <div className="navbar-right">
          <span className="navbar-welcome">Welcome, {user?.name || 'Master'}</span>
          <a
            href="https://analytics.google.com/analytics/web/#/p536641569/reports/reportinghub"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline-light"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Analytics
          </a>
          <div className="avatar">{initial}</div>
          <button className="btn btn-outline-light" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="layout-body">
        {/* ── Sidebar ── */}
        <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? ' active' : ''}`
                }
              >
                <span className="sidebar-icon">{item.icon}</span>
                {!collapsed && <span className="sidebar-label">{item.label}</span>}
              </NavLink>
            ))}

            {!collapsed && (
              <div className="sidebar-section-title">Lookup Tables</div>
            )}

            {LOOKUP_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `sidebar-link sidebar-sub-link${isActive ? ' active' : ''}`
                }
              >
                <span className="sidebar-icon">
                  {collapsed ? <LookupIcon /> : <DotIcon />}
                </span>
                {!collapsed && <span className="sidebar-label">{link.label}</span>}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* ── Content ── */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
