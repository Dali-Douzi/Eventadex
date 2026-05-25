import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { CheckInBadge, PaymentBadge } from '../components/AttendeeCard';
import { useToast } from '../context/ToastContext';

// ─── Import results modal ─────────────────────────────────────────────────────
function ImportResultsModal({ results, onClose }) {
  const { total, imported, updated, skipped, errors = [] } = results;
  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">Import Complete</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total rows processed', value: total,    color: '#1e293b' },
              { label: 'New registrants added', value: imported, color: '#16a34a' },
              { label: 'Existing records updated', value: updated,  color: '#2563eb' },
              { label: 'Rows skipped / errored', value: skipped,  color: '#dc2626' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {errors.length > 0 && (
            <>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>
                {errors.length} row{errors.length !== 1 ? 's' : ''} had issues:
              </p>
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #fee2e2', borderRadius: 6, background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#fef2f2' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#991b1b', width: 60 }}>Row</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#991b1b' }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map(({ row, reason }, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #fee2e2' }}>
                        <td style={{ padding: '5px 10px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{row}</td>
                        <td style={{ padding: '5px 10px', color: '#1e293b' }}>{reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </>
  );
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Registrants() {
  const toast    = useToast();
  const navigate = useNavigate();
  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [sessions, setSessions]   = useState([]);
  const [exporting, setExporting]   = useState('');   // ''|'csv'|'xlsx'|'pdf'
  const [exportOpen, setExportOpen] = useState(false);
  const [importing, setImporting]   = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importResults, setImportResults] = useState(null); // modal data
  const exportRef  = useRef(null);
  const importRef  = useRef(null);

  const LIMIT = 20;

  // ── Fetch sessions for filter ──────────────────────────────
  useEffect(() => {
    api.get('/api/admin/event')
      .then(({ data }) => setSessions(data.sessions || []))
      .catch(() => {});
  }, []);

  // ── Fetch registrants ──────────────────────────────────────
  const fetchRows = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (search.trim()) params.set('search', search.trim());
    if (sessionFilter) params.set('sessionId', sessionFilter);

    api.get(`/api/admin/registrants?${params}`)
      .then(({ data }) => {
        setRows(data.data || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page, search, sessionFilter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Reset to page 1 on filter/search change
  useEffect(() => { setPage(1); }, [search, sessionFilter]);

  // ── Session name lookup ────────────────────────────────────
  function getSessionName(sessionId) {
    if (!sessionId) return '—';
    const s = sessions.find((x) => x._id === sessionId || x._id?.toString() === sessionId?.toString());
    return s?.name || '—';
  }

  // Close export/import dropdowns when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
      // For import dropdown we don't have a ref, so just close on any outside click
      if (importOpen && importRef.current && !importRef.current.contains(e.target)) {
        setImportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [importOpen]);

  // ── Export ─────────────────────────────────────────────────
  const MIME = { csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf' };

  async function handleExport(fmt) {
    setExportOpen(false);
    setExporting(fmt);
    try {
      const params = new URLSearchParams({ format: fmt });
      if (sessionFilter) params.set('sessionId', sessionFilter);

      const response = await api.get(`/api/admin/registrants/export?${params}`, {
        responseType: 'blob',
      });
      const url  = URL.createObjectURL(new Blob([response.data], { type: MIME[fmt] }));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `registrants-${Date.now()}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Export failed. Please try again.', 'error');
    } finally {
      setExporting('');
    }
  }

  // ── Import ─────────────────────────────────────────────────
  function handleImportClick() {
    setImportOpen(false);
    importRef.current?.click();
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-selected

    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/api/admin/registrants/import', fd);
      setImportResults(data);
      fetchRows(); // refresh table
    } catch (err) {
      toast(err.response?.data?.message || 'Import failed. Check the file format and try again.', 'error');
    } finally {
      setImporting(false);
    }
  }

  async function handleDownloadTemplate() {
    setImportOpen(false);
    try {
      const response = await api.get('/api/admin/registrants/import-template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }));
      const a = document.createElement('a');
      a.href     = url;
      a.download = 'import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Could not download template', 'error');
    }
  }

  // ── Row click → detail page ───────────────────────────────
  function openDetail(r) { navigate(`/admin/registrants/${r._id}`); }

  // ── Pagination helpers ─────────────────────────────────────
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
      {/* Hidden file input for import */}
      <input
        ref={importRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      <div className="page-header">
        <h1 className="page-title">Registrants</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

        {/* ── Import dropdown ── */}
        <div className="export-dropdown" style={{ position: 'relative' }}>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setImportOpen((o) => !o)}
            disabled={importing}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 5 17 10"/>
              <line x1="12" y1="5" x2="12" y2="15"/>
            </svg>
            {importing ? 'Importing…' : 'Import'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11" style={{ marginLeft: 2 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {importOpen && (
            <div className="export-menu">
              <button className="export-menu-item" onClick={handleImportClick}>
                <span className="export-fmt-icon" style={{ background: '#ede9fe', color: '#6d28d9', fontWeight: 700, fontSize: 10 }}>XLS</span>
                Import from Excel / CSV
              </button>
              <button className="export-menu-item" onClick={handleDownloadTemplate}>
                <span className="export-fmt-icon" style={{ background: '#f0fdf4', color: '#15803d', fontWeight: 700, fontSize: 10 }}>TPL</span>
                Download import template
              </button>
            </div>
          )}
        </div>

        {/* ── Export dropdown ── */}
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

        </div>{/* end header button group */}
      </div>

      <div className="table-card">
        {/* Toolbar */}
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            {/* Search */}
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

            {/* Session filter */}
            <select
              className="filter-select"
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
            >
              <option value="">All Sessions</option>
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="table-toolbar-right">
            <span style={{ fontSize: 13, color: 'var(--text-light)' }}>
              {total.toLocaleString()} registrant{total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Session</th>
                <th>Check-in</th>
                <th>Payment</th>
                <th>Registered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="dt-empty-row">
                  <td colSpan={7}>Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className="dt-empty-row">
                  <td colSpan={7}>No registrants found.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} onClick={() => openDetail(r)} style={{ cursor: 'pointer' }}>
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
                    <td><PaymentBadge status={r.paymentStatus} /></td>
                    <td>
                      <div style={{ fontSize: 13 }}>{fmtDate(r.createdAt)}</div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="dt-actions">
                        <button
                          className="btn-icon-sq"
                          title="View full profile"
                          onClick={() => openDetail(r)}
                        >
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

        {/* Pagination */}
        {pages > 1 && (
          <div className="table-pagination">
            <span>
              Page {page} of {pages}
            </span>
            <div className="pagination-btns">
              <button
                className="pg-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              {pageNums().map((n) => (
                <button
                  key={n}
                  className={`pg-btn${n === page ? ' pg-active' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                className="pg-btn"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import results modal */}
      {importResults && (
        <ImportResultsModal
          results={importResults}
          onClose={() => setImportResults(null)}
        />
      )}
    </div>
  );
}
