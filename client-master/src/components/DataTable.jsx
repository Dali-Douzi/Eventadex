import { useState } from 'react';

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
}) {
  const [searchVal, setSearchVal] = useState('');
  const pages = Math.max(1, Math.ceil(total / limit));

  function handleSearch(e) {
    const val = e.target.value;
    setSearchVal(val);
    onSearch?.(val);
  }

  function exportCSV() {
    const exportCols = columns.filter((c) => c.key && c.key !== 'actions');
    const header = exportCols.map((c) => `"${c.label}"`).join(',');
    const rows = data.map((row) =>
      exportCols
        .map((c) => {
          const val = row[c.key] ?? '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
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
          <button className="btn btn-outline btn-sm" onClick={exportCSV}>
            Export CSV
          </button>
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
