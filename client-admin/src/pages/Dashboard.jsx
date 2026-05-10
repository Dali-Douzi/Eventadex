import { useState, useEffect } from 'react';
import api from '../api/axios';
import { EventStatusBadge } from '../components/AttendeeCard';

// ─── Relative time helper ─────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Capacity bar colour ──────────────────────────────────────────────────────
function capColor(pct) {
  if (pct >= 100) return '#dc2626'; // full
  if (pct >= 80)  return '#d97706'; // near-full
  return '#2563eb';                 // normal
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, iconClass }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <div>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
        <div className={`stat-icon ${iconClass}`}>{icon}</div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconCheckin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconStatus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

// ─── Main component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get('/api/admin/stats')
      .then(({ data }) => setStats(data))
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div>
      <div className="page-header">
        <div className="skeleton sk-title" style={{ width: 120 }} />
      </div>
      <div className="stat-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="sk-card">
            <div className="skeleton sk-text" style={{ width: '55%', marginBottom: 12 }} />
            <div className="skeleton sk-title" style={{ width: '35%' }} />
          </div>
        ))}
      </div>
      <div className="dash-grid" style={{ marginTop: 24 }}>
        <div className="sk-card" style={{ minHeight: 180 }}>
          <div className="skeleton sk-text" style={{ width: '40%', marginBottom: 16 }} />
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div className="skeleton sk-text" style={{ width: '70%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 8, borderRadius: 4 }} />
            </div>
          ))}
        </div>
        <div className="sk-card" style={{ minHeight: 180 }}>
          <div className="skeleton sk-text" style={{ width: '45%', marginBottom: 16 }} />
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton sk-text" style={{ width: '60%', marginBottom: 5 }} />
                <div className="skeleton sk-text" style={{ width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>
      <div className="alert alert-error">{error}</div>
    </div>
  );

  const {
    totalRegistrants = 0,
    checkedInToday   = 0,
    sessionsCount    = 0,
    eventStatus      = 'draft',
    sessions         = [],
    recentRegistrants = [],
  } = stats;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      {/* ── Stat cards ──────────────────────────── */}
      <div className="stat-grid">
        <StatCard
          label="Total Registrants"
          value={totalRegistrants.toLocaleString()}
          icon={<IconUsers />}
          iconClass="stat-icon-blue"
        />
        <StatCard
          label="Checked In Today"
          value={checkedInToday.toLocaleString()}
          icon={<IconCheckin />}
          iconClass="stat-icon-green"
        />
        <StatCard
          label="Sessions"
          value={sessionsCount}
          icon={<IconCalendar />}
          iconClass="stat-icon-purple"
        />
        <div className="stat-card">
          <div className="stat-card-top">
            <div>
              <div style={{ marginBottom: 8 }}>
                <EventStatusBadge status={eventStatus} />
              </div>
              <div className="stat-label">Event Status</div>
            </div>
            <div className="stat-icon stat-icon-amber"><IconStatus /></div>
          </div>
        </div>
      </div>

      {/* ── Bottom grid ─────────────────────────── */}
      <div className="dash-grid">

        {/* Session capacity bars */}
        <div className="dash-section">
          <div className="dash-section-title">Session Capacity</div>
          {sessions.length === 0 ? (
            <p className="dash-section-empty">No sessions configured yet.</p>
          ) : (
            sessions.map((s) => {
              const pct  = s.capacity > 0 ? Math.min(100, Math.round((s.registered / s.capacity) * 100)) : 0;
              const color = capColor(pct);
              return (
                <div key={s._id} className="cap-item">
                  <div className="cap-item-header">
                    <span className="cap-item-name">{s.name}</span>
                    <span className="cap-item-counts">{s.registered} / {s.capacity}</span>
                  </div>
                  <div className="cap-track">
                    <div className="cap-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="cap-meta">
                    <span>{pct}% full</span>
                    {s.waitlistCapacity > 0 && (
                      <span>Waitlist cap: {s.waitlistCapacity}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Recent registrations */}
        <div className="dash-section">
          <div className="dash-section-title">Recent Registrations</div>
          {recentRegistrants.length === 0 ? (
            <p className="dash-section-empty">No registrants yet.</p>
          ) : (
            <div>
              {recentRegistrants.map((r) => (
                <div key={r._id} className="recent-item">
                  <div className="recent-avatar">
                    {(r.firstName?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="recent-info">
                    <div className="recent-name">{r.firstName} {r.lastName}</div>
                    <div className="recent-email">
                      {r.sessionName ? r.sessionName : r.email}
                    </div>
                  </div>
                  <div className="recent-time">{timeAgo(r.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
