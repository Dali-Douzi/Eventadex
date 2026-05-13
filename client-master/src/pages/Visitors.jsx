import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Visitors() {
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [yearFilter, setYearFilter]       = useState('');
  const [counts, setCounts]               = useState({ 2024: 0, 2025: 0 });

  const LIMIT = 50;

  const fetchRows = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (search.trim()) params.set('search', search.trim());
    if (yearFilter)    params.set('year', yearFilter);

    api.get(`/api/master/visitors?${params}`)
      .then(({ data }) => {
        setRows(data.data || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
        setCounts({ 2024: data.count2024 || 0, 2025: data.count2025 || 0 });
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page, search, yearFilter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => { setPage(1); }, [search, yearFilter]);


  // ── Stat card config ───────────────────────────────────────────────────────
  const STAT_CARDS = [
    {
      key: 'all',
      label: 'All Visitors',
      count: counts[2024] + counts[2025],
      color: '#64748b',
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
      key: '2024',
      label: '2024 Visitors',
      count: counts[2024],
      color: '#2563eb',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
    {
      key: '2025',
      label: '2025 Visitors',
      count: counts[2025],
      color: '#16a34a',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <h1 className="page-title">Visitors</h1>
      </div>

      {/* ── Stat cards (clickable year filter) ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        {STAT_CARDS.map((card) => {
          const isActive = card.key === 'all' ? !yearFilter : yearFilter === card.key;
          return (
            <div
              key={card.key}
              className="stat-card"
              style={{
                '--accent': card.color,
                cursor: 'pointer',
                opacity: (!yearFilter && card.key !== 'all') || (yearFilter && !isActive) ? 0.6 : 1,
                transition: 'opacity 0.15s, box-shadow 0.15s',
                boxShadow: isActive ? `0 0 0 2px ${card.color}40, var(--shadow)` : undefined,
              }}
              onClick={() => setYearFilter(card.key === 'all' ? '' : card.key)}
            >
              <div className="stat-icon">{card.icon}</div>
              <div>
                <div className="stat-value">{card.count.toLocaleString()}</div>
                <div className="stat-label">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Table ── */}
      <div className="datatable-wrapper">
        <div className="datatable-toolbar">
          <div className="datatable-toolbar-left">
            <input
              className="input search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or organisation…"
              style={{ width: 260 }}
            />
            <select
              className="input"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              style={{ width: 130 }}
            >
              <option value="">All Years</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
            </select>
          </div>
          <div className="datatable-toolbar-right">
            <span style={{ fontSize: 13, color: 'var(--text-medium)' }}>
              {total.toLocaleString()} visitor{total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Organisation</th>
                <th>Phone</th>
                <th>Year</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="table-empty">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">No visitors found.</td></tr>
              ) : rows.map((v) => (
                <tr key={v._id}>
                  <td style={{ color: 'var(--text-medium)' }}>{v.email}</td>
                  <td style={{ fontWeight: 500 }}>
                    {[v.firstName, v.lastName].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td>{v.organization || '—'}</td>
                  <td>{v.phone || '—'}</td>
                  <td>
                    <span className="badge" style={{
                      background: v.year === 2025 ? '#dcfce7' : '#dbeafe',
                      color:      v.year === 2025 ? '#16a34a' : '#2563eb',
                    }}>
                      {v.year || '—'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-medium)' }}>{fmtDate(v.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="pagination">
            <button
              className="btn btn-outline btn-sm"
              disabled={page === 1}
              onClick={() => setPage(1)}
            >
              «
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>

            <span className="pagination-info" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Page
              <input
                type="number"
                min={1}
                max={pages}
                value={page}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (v >= 1 && v <= pages) setPage(v);
                }}
                style={{
                  width: 56,
                  padding: '3px 6px',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  fontSize: 13,
                  textAlign: 'center',
                  outline: 'none',
                }}
              />
              of {pages}
            </span>

            <button
              className="btn btn-outline btn-sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={page >= pages}
              onClick={() => setPage(pages)}
            >
              »
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
