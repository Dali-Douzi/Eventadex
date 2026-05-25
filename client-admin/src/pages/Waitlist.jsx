import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function StatusBadge({ status }) {
  const map = {
    waiting:   { label: 'Waiting',   bg: '#fef3c7', color: '#b45309' },
    promoted:  { label: 'Promoted',  bg: '#dcfce7', color: '#15803d' },
    cancelled: { label: 'Cancelled', bg: '#fee2e2', color: '#b91c1c' },
  };
  const s = map[status] || { label: status, bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
      fontSize: 11.5, fontWeight: 700, background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Waitlist() {
  const [tab,       setTab]       = useState('standard'); // 'standard' | 'vip'
  const [search,    setSearch]    = useState('');
  const [sessionId, setSessionId] = useState('');
  const [status,    setStatus]    = useState('');
  const [entries,   setEntries]   = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [pages,     setPages]     = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [sessions,  setSessions]  = useState([]);

  const searchTimeout = useRef(null);
  const LIMIT = 20;

  // ── Fetch sessions for filter dropdown
  useEffect(() => {
    api.get('/api/admin/event')
      .then(({ data }) => setSessions(data?.sessions || []))
      .catch(() => {});
  }, []);

  // ── Reset to page 1 on filter/tab change
  useEffect(() => { setPage(1); }, [tab, search, sessionId, status]);

  // ── Fetch waitlist
  const fetchEntries = useCallback(() => {
    setLoading(true);
    setError('');
    const endpoint = tab === 'vip' ? '/api/admin/vip-waitlist' : '/api/admin/waitlist';
    const params   = new URLSearchParams({ page, limit: LIMIT });
    if (search)    params.set('search',    search);
    if (sessionId) params.set('sessionId', sessionId);
    if (status)    params.set('status',    status);

    api.get(`${endpoint}?${params}`)
      .then(({ data }) => {
        setEntries(data.data  || []);
        setTotal(data.total   || 0);
        setPages(data.pages   || 1);
      })
      .catch((err) => {
        setError(
          err.response?.status === 403
            ? 'You do not have permission to view the VIP waitlist.'
            : 'Failed to load waitlist.'
        );
        setEntries([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [tab, page, search, sessionId, status]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const sessionMap = Object.fromEntries(sessions.map((s) => [s._id, s.name]));

  function handleSearch(e) {
    const val = e.target.value;
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(val), 300);
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Waitlist</h1>
          {!loading && !error && (
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-light)' }}>
              {total.toLocaleString()} entr{total === 1 ? 'y' : 'ies'}
            </p>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { key: 'standard', label: 'Standard Waitlist' },
          { key: 'vip',      label: 'VIP Waitlist', vip: true },
        ].map(({ key, label, vip }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setEntries([]); setError(''); }}
            style={{
              padding: '8px 18px',
              fontSize: 13.5,
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === key ? 'var(--primary)' : 'var(--text-medium)',
              marginBottom: -1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {vip && <span className="badge-vip">VIP</span>}
            {label}
          </button>
        ))}
      </div>

      {/* ── Toolbar ────────────────────────────── */}
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <div className="search-input-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="search-input"
              placeholder="Search name or email…"
              defaultValue={search}
              onChange={handleSearch}
            />
          </div>
          {sessions.length > 0 && (
            <select
              className="filter-select"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">All Sessions</option>
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          )}
          <select
            className="filter-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="waiting">Waiting</option>
            <option value="promoted">Promoted</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* ── Error ──────────────────────────────── */}
      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

      {/* ── Table card ─────────────────────────── */}
      <div className="table-card" style={{ marginTop: 16 }}>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ padding: '12px 18px' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div className="skeleton" style={{ width: 28, height: 14, borderRadius: 4 }} />
                <div className="skeleton sk-text" style={{ width: '18%' }} />
                <div className="skeleton sk-text" style={{ width: '24%' }} />
                <div className="skeleton sk-text" style={{ width: '16%' }} />
                <div className="skeleton sk-text" style={{ width: '10%' }} />
                <div className="skeleton sk-text" style={{ width: '12%' }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '56px 24px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                 width="40" height="40" style={{ color: '#94a3b8', marginBottom: 12 }}>
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
              {search || sessionId || status
                ? 'No entries match your filters.'
                : 'No one is on the waitlist yet.'}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && entries.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 52 }}>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  {sessions.length > 0 && <th>Session</th>}
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e._id}>
                    <td style={{ fontWeight: 700, color: '#94a3b8', fontSize: 13 }}>
                      {e.waitlistPosition ?? '—'}
                    </td>
                    <td style={{ fontWeight: 600 }}>{e.firstName} {e.lastName}</td>
                    <td style={{ color: '#475569' }}>{e.email}</td>
                    {sessions.length > 0 && (
                      <td style={{ color: '#475569' }}>
                        {e.sessionId ? (sessionMap[e.sessionId] || '—') : '—'}
                      </td>
                    )}
                    <td><StatusBadge status={e.status} /></td>
                    <td style={{ color: '#94a3b8', fontSize: 12.5 }}>{fmtDate(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && pages > 1 && (
          <div className="table-pagination">
            <span style={{ fontSize: 13, color: 'var(--text-medium)' }}>
              Page {page} of {pages} — {total.toLocaleString()} total
            </span>
            <div className="pagination-btns">
              <button
                className="pg-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹
              </button>
              <button
                className="pg-btn"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
