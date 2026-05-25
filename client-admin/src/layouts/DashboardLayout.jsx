import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

// ─── Nav structure ────────────────────────────────────────────────────────────
// type: 'link' | 'group'
// groups have children[] with { to, label, icon }

const NAV_ITEMS = [
  // ── Home ──────────────────────────────────────────────
  {
    type: 'link',
    to: '/admin/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },

  // ── Setup flow ────────────────────────────────────────
  {
    type: 'link',
    to: '/admin/event',
    label: 'Event',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    type: 'group',
    label: 'Page Builder',
    groupKey: 'pagebuilder',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
    ),
    children: [
      {
        to: '/admin/page-builder',
        label: 'Standard Page',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 9h18M9 21V9"/>
          </svg>
        ),
      },
      {
        to: '/admin/vip-page-builder',
        label: 'VIP Page',
        vip: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        ),
      },
    ],
  },
  {
    type: 'group',
    label: 'Email',
    groupKey: 'email',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
    children: [
      {
        to: '/admin/email-template',
        label: 'Email Template',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        ),
      },
      {
        to: '/admin/reminder-config',
        label: 'Reminders',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        ),
      },
      {
        to: '/admin/announcements',
        label: 'Announcements',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M22 12L3 20l4.5-8L3 4z"/>
            <line x1="13" y1="12" x2="7.5" y2="12"/>
          </svg>
        ),
      },
    ],
  },
  {
    type: 'group',
    label: 'Badges',
    groupKey: 'badges',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="14" r="2"/>
        <line x1="8" y1="14" x2="9.5" y2="14"/><line x1="14.5" y1="14" x2="16" y2="14"/>
      </svg>
    ),
    children: [
      {
        to: '/admin/badge-setup',
        label: 'Badge Design',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/>
          </svg>
        ),
      },
      {
        to: '/admin/print-cards',
        label: 'Print Cards',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
        ),
      },
    ],
  },
  {
    type: 'link',
    to: '/admin/registration-links',
    label: 'Share Links',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },

  // ── Operations ────────────────────────────────────────
  {
    type: 'group',
    label: 'Registrants',
    groupKey: 'registrants',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    children: [
      {
        to: '/admin/registrants',
        label: 'All Registrants',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
        ),
      },
      {
        to: '/admin/vip-registrants',
        label: 'VIP Registrants',
        vip: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        ),
      },
      {
        to: '/admin/waitlist',
        label: 'Waitlist',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        ),
      },
    ],
  },
  {
    type: 'link',
    to: '/admin/checkin',
    label: 'Check-in',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
  },
];

// ─── Collapsible group component ──────────────────────────────────────────────
function NavGroup({ item, collapsed, openGroups, setOpenGroups }) {
  const location = useLocation();
  const isChildActive = item.children.some((c) => location.pathname === c.to);
  const isOpen = openGroups[item.groupKey] ?? isChildActive;

  function toggle() {
    if (collapsed) return;
    setOpenGroups((g) => ({ ...g, [item.groupKey]: !isOpen }));
  }

  return (
    <div className="sidebar-group">
      <button
        className={`sidebar-group-btn${isChildActive ? ' active' : ''}`}
        onClick={toggle}
        title={collapsed ? item.label : undefined}
      >
        <span className="sidebar-icon">{item.icon}</span>
        {!collapsed && (
          <>
            <span className="sidebar-label">{item.label}</span>
            <svg
              className={`sidebar-group-chevron${isOpen ? ' open' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              width="12" height="12"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </>
        )}
      </button>

      {!collapsed && isOpen && (
        <div className="sidebar-group-children">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) => `sidebar-child-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-icon">{child.icon}</span>
              <span className="sidebar-label">{child.label}</span>
              {child.vip && <span className="badge-vip sidebar-vip-badge">VIP</span>}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────
export default function DashboardLayout() {
  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [openGroups,   setOpenGroups]   = useState({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    api.get('/api/admin/event')
      .then(({ data }) => {
        const name = data?.name;
        document.title = name ? `${name} — Admin` : 'Admin Panel — Eventadex';
      })
      .catch(() => {
        document.title = 'Admin Panel — Eventadex';
      });
  }, []);

  function toggleSidebar() {
    if (window.matchMedia('(max-width: 768px)').matches) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((c) => !c);
    }
  }

  function handleLogout() { logout(); navigate('/login'); }
  const initial = (user?.name || 'A')[0].toUpperCase();

  return (
    <div className="layout">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="navbar-left">
          <button className="sidebar-toggle" onClick={toggleSidebar} aria-label="Toggle sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="navbar-logo">Eventadex</div>
          {!collapsed && user?.name && (
            <span className="navbar-org">{user.name}</span>
          )}
        </div>
        <div className="navbar-right">
          <div className="user-menu" ref={userMenuRef}>
            <div className="avatar" onClick={() => setUserMenuOpen((o) => !o)} role="button" aria-label="User menu">
              {initial}
            </div>
            {userMenuOpen && (
              <div className="user-dropdown">
                <div className="user-dropdown-email">{user?.email}</div>
                <button
                  className="user-dropdown-item danger"
                  onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="layout-body">
        {/* ── Mobile backdrop ── */}
        {mobileOpen && (
          <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
        )}

        {/* ── Sidebar ── */}
        <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => {
              if (item.type === 'group') {
                return (
                  <NavGroup
                    key={item.groupKey}
                    item={item}
                    collapsed={collapsed}
                    openGroups={openGroups}
                    setOpenGroups={setOpenGroups}
                  />
                );
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {!collapsed && <span className="sidebar-label">{item.label}</span>}
                </NavLink>
              );
            })}
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
