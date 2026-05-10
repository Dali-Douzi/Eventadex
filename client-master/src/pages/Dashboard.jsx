import { useState, useEffect } from 'react';
import api from '../api/axios';

// ─── Stat cards config ────────────────────────────────────────────────────────
const CARDS = [
  {
    key: 'totalOrgs',
    label: 'Total Organizations',
    color: '#2563eb',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key: 'activeOrgs',
    label: 'Active',
    color: '#16a34a',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
  },
  {
    key: 'totalRegistrants',
    label: 'Registrants',
    color: '#7c3aed',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    key: 'totalEvents',
    label: 'Events',
    color: '#d97706',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
];

// ─── Event type colour map (shared with Organizations.jsx) ────────────────────
const TYPE_COLORS = {
  'Conference':       '#2563eb',
  'Workshop':         '#7c3aed',
  'Seminar':          '#0891b2',
  'Networking Event': '#16a34a',
  'Trade Show':       '#d97706',
  'Exhibition':       '#ea580c',
  'Gala / Dinner':    '#be185d',
  'Corporate Meeting':'#475569',
  'Training':         '#0d9488',
  'Webinar':          '#6d28d9',
  'Community Event':  '#15803d',
  'Other':            '#64748b',
};

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function StatusDot({ status }) {
  const color = status === 'active' ? '#16a34a' : status === 'suspended' ? '#d97706' : '#94a3b8';
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: color, marginRight: 6, flexShrink: 0,
    }} />
  );
}

export default function Dashboard() {
  const [stats,   setStats]   = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/master/stats')
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const eventsByType  = stats.eventsByType  || {};
  const recentOrgs    = stats.recentOrgs    || [];
  const totalEvents   = stats.totalEvents   || 0;
  const typeEntries   = Object.entries(eventsByType).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      {/* ── Stat cards ── */}
      <div className="stats-grid">
        {CARDS.map((card) => (
          <div key={card.key} className="stat-card" style={{ '--accent': card.color }}>
            <div className="stat-icon">{card.icon}</div>
            <div>
              <div className="stat-value">
                {loading ? '—' : (stats[card.key] ?? 0).toLocaleString()}
              </div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom row: event type breakdown + recent orgs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>

        {/* Event types breakdown */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: '20px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: 'var(--text-dark)' }}>
            Events by Type
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ height: 28, borderRadius: 6, background: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : typeEntries.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>No events yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {typeEntries.map(([type, count]) => {
                const color = TYPE_COLORS[type] || '#64748b';
                const pct   = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-dark)', fontWeight: 500 }}>{type}</span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: color, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent organizations */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: '20px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: 'var(--text-dark)' }}>
            Recent Organizations
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ height: 44, borderRadius: 6, background: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : recentOrgs.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>No organizations yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {recentOrgs.map((org, i) => (
                <div key={org._id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < recentOrgs.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: '#e0e7ff', color: '#2563eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13,
                  }}>
                    {org.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StatusDot status={org.status} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {org.name}
                      </span>
                    </div>
                    {org.eventId && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                        {org.eventId.eventType || 'Event'}
                        {org.eventId.name ? ` · ${org.eventId.name}` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {fmtDate(org.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
