import { useState, useRef, useEffect } from 'react';

export function StatusBadge({ status }) {
  const map = {
    active: 'badge-active',
    available: 'badge-available',
    published: 'badge-published',
    suspended: 'badge-suspended',
    pending: 'badge-pending',
    draft: 'badge-draft',
    deleted: 'badge-deleted',
    closed: 'badge-closed',
  };
  return (
    <span className={`badge ${map[status] || 'badge-default'}`}>
      {status}
    </span>
  );
}

export default function DataTable({
  columns,
  data,
  total = 0,
  page = 1,
  limit = 20,
  onPageChange,
  onSearch,
  loading = false,
  onAdd,
  addLabel = '+ Add',
  onExport,        // if provided: fn(format) — enables multi-format dropdown
  exporting = '',  // current format being exported, e.g. 'csv'
}) {
  const [searchVal,  setSearchVal]  = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);
  const pages = Math.max(1, Math.ceil(total / limit));

  function handleSearch(e) {
    const val = e.target.value;
    setSearchVal(val);
    onSearch?.(val);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function exportCSV() {
    const exportCols = columns.filter((c) => c.key && c.key !== 'actions');
    const header = exportCols.map((c) => `"${c.label}"`).join(',');
    const rows = data.map((row) =>
      exportCols.map((c) => {
        const val = row[c.key] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="datatable-wrapper">
      <div className="datatable-toolbar">
        <div className="datatable-toolbar-left" />
        <div className="datatable-toolbar-right">
          <input
            className="input search-input"
            placeholder="Search..."
            value={searchVal}
            onChange={handleSearch}
          />

          {/* Multi-format export dropdown (when onExport prop is provided) */}
          {onExport ? (
            <div className="export-dropdown" ref={exportRef}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setExportOpen((o) => !o)}
                disabled={!!exporting}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {exporting ? 'Exporting…' : 'Export'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11" style={{ marginLeft: 2 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {exportOpen && (
                <div className="export-menu">
                  <button className="export-menu-item" onClick={() => { setExportOpen(false); onExport('csv'); }}>
                    <span className="export-fmt-icon export-fmt-csv">CSV</span>
                    Comma-separated (.csv)
                  </button>
                  <button className="export-menu-item" onClick={() => { setExportOpen(false); onExport('xlsx'); }}>
                    <span className="export-fmt-icon export-fmt-xlsx">XLS</span>
                    Excel workbook (.xlsx)
                  </button>
                  <button className="export-menu-item" onClick={() => { setExportOpen(false); onExport('pdf'); }}>
                    <span className="export-fmt-icon export-fmt-pdf">PDF</span>
                    PDF document (.pdf)
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Fallback: plain CSV-only button */
            <button className="btn btn-outline btn-sm" onClick={exportCSV}>
              Export CSV
            </button>
          )}

          {onAdd && (
            <button className="btn btn-primary btn-sm" onClick={onAdd}>
              {addLabel}
            </button>
          )}
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  No records found
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={row._id || i}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="pagination">
          <button
            className="btn btn-outline btn-sm"
            disabled={page === 1}
            onClick={() => onPageChange?.(page - 1)}
          >
            ← Prev
          </button>
          <span className="pagination-info">
            Page {page} of {pages}
          </span>
          <button
            className="btn btn-outline btn-sm"
            disabled={page >= pages}
            onClick={() => onPageChange?.(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
