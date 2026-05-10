import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import AttendeeCard, { CheckInBadge, PaymentBadge } from '../components/AttendeeCard';
import { useToast } from '../context/ToastContext';

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── VIP badge pill ───────────────────────────────────────────────────────────
function VipBadge() {
  return <span className="badge-vip">VIP</span>;
}

// ─── VIP registrant detail drawer ────────────────────────────────────────────
function VipRegistrantDrawer({ registrant, sessions, onClose, onUpdate }) {
  const [working, setWorking] = useState('');
  const toast = useToast();

  async function doCheckIn() {
    setWorking('in');
    try {
      const { data } = await api.patch(`/api/admin/vip-registrants/${registrant._id}/checkin`);
      onUpdate(data);
      toast(`${data.firstName} ${data.lastName} checked in`, 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Check-in failed', 'error');
    } finally {
      setWorking('');
    }
  }

  async function doCheckOut() {
    setWorking('out');
    try {
      const { data } = await api.patch(`/api/admin/vip-registrants/${registrant._id}/checkout`);
      onUpdate(data);
      toast(`${data.firstName} ${data.lastName} checked out`, 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Check-out failed', 'error');
    } finally {
      setWorking('');
    }
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <span className="drawer-title">
            VIP Registrant Details
            <VipBadge />
          </span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          <AttendeeCard registrant={registrant} sessions={sessions} />

          <div className="checkin-actions" style={{ marginTop: 20 }}>
            {!registrant.checkedIn && (
              <button className="btn-checkin-in" onClick={doCheckIn} disabled={working === 'in'}>
                {working === 'in' ? 'Checking In…' : '✓ Check In'}
              </button>
            )}
            {registrant.checkedIn && !registrant.checkedOut && (
              <button className="btn-checkin-out" onClick={doCheckOut} disabled={working === 'out'}>
                {working === 'out' ? 'Checking Out…' : 'Check Out'}
              </button>
            )}
            {registrant.checkedIn && registrant.checkedOut && (
              <span className="badge badge-gray" style={{ padding: '8px 16px' }}>
                Checked out
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VipRegistrants() {
  const toast = useToast();
  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [sessions, setSessions]   = useState([]);
  const [selected, setSelected]   = useState(null);
  const [exporting, setExporting] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  const LIMIT = 20;

  useEffect(() => {
    api.get('/api/admin/event')
      .then(({ data }) => setSessions(data.sessions || []))
      .catch(() => {});
  }, []);

  const fetchRows = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (search.trim()) params.set('search', search.trim());
    if (sessionFilter) params.set('sessionId', sessionFilter);

    api.get(`/api/admin/vip-registrants?${params}`)
      .then(({ data }) => {
        setRows(data.data || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page, search, sessionFilter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => { setPage(1); }, [search, sessionFilter]);

  function getSessionName(sessionId) {
    if (!sessionId) return '—';
    const s = sessions.find((x) => x._id === sessionId || x._id?.toString() === sessionId?.toString());
    return s?.name || '—';
  }

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const MIME = { csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf' };

  async function handleExport(fmt) {
    setExportOpen(false);
    setExporting(fmt);
    try {
      const params = new URLSearchParams({ format: fmt });
      if (sessionFilter) params.set('sessionId', sessionFilter);

      const response = await api.get(`/api/admin/vip-registrants/export?${params}`, {
        responseType: 'blob',
      });
      const url  = URL.createObjectURL(new Blob([response.data], { type: MIME[fmt] }));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `vip-registrants-${Date.now()}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Export failed. Please try again.', 'error');
    } finally {
      setExporting('');
    }
  }

  function openDrawer(r) { setSelected(r); }
  function closeDrawer()  { setSelected(null); }

  function handleUpdate(updated) {
    setRows((rs) => rs.map((r) => r._id === updated._id ? updated : r));
    setSelected(updated);
  }

  function pageNums() {
    const nums = [];
    const delta = 2;
    for (let i = Math.max(1, page - delta); i <= Math.min(pages, page + delta); i++) {
      nums.push(i);
    }
    return nums;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          VIP Registrants
          <VipBadge />
        </h1>
        <div className="export-dropdown" ref={exportRef}>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setExportOpen((o) => !o)}
            disabled={!!exporting}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exporting ? `Exporting…` : 'Export'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11" style={{ marginLeft: 2 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {exportOpen && (
            <div className="export-menu">
              <button className="export-menu-item" onClick={() => handleExport('csv')}>
                <span className="export-fmt-icon export-fmt-csv">CSV</span>
                Comma-separated (.csv)
              </button>
              <button className="export-menu-item" onClick={() => handleExport('xlsx')}>
                <span className="export-fmt-icon export-fmt-xlsx">XLS</span>
                Excel workbook (.xlsx)
              </button>
              <button className="export-menu-item" onClick={() => handleExport('pdf')}>
                <span className="export-fmt-icon export-fmt-pdf">PDF</span>
                PDF document (.pdf)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="search-input-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email…"
              />
            </div>
            <select className="filter-select" value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)}>
              <option value="">All Sessions</option>
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="table-toolbar-right">
            <span style={{ fontSize: 13, color: 'var(--text-light)' }}>
              {total.toLocaleString()} VIP registrant{total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Session</th>
                <th>Check-in</th>
                <th>Type</th>
                <th>Registered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="dt-empty-row"><td colSpan={7}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr className="dt-empty-row"><td colSpan={7}>No VIP registrants found.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} onClick={() => openDrawer(r)}>
                    <td>
                      <div className="dt-name">{r.firstName} {r.lastName}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{r.email}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{getSessionName(r.sessionId)}</div>
                    </td>
                    <td><CheckInBadge checkedIn={r.checkedIn} /></td>
                    <td><VipBadge /></td>
                    <td>
                      <div style={{ fontSize: 13 }}>{fmtDate(r.createdAt)}</div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="dt-actions">
                        <button className="btn-icon-sq" title="View details" onClick={() => openDrawer(r)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="table-pagination">
            <span>Page {page} of {pages}</span>
            <div className="pagination-btns">
              <button className="pg-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              {pageNums().map((n) => (
                <button key={n} className={`pg-btn${n === page ? ' pg-active' : ''}`} onClick={() => setPage(n)}>{n}</button>
              ))}
              <button className="pg-btn" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <VipRegistrantDrawer
          registrant={selected}
          sessions={sessions}
          onClose={closeDrawer}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
