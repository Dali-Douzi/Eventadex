import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import DataTable, { StatusBadge } from '../components/DataTable';
import Modal from '../components/Modal';

const TYPE_CONFIG = {
  titles:              { apiType: 'Title',            label: 'Titles',            singular: 'Title' },
  countries:           { apiType: 'Country',          label: 'Countries',         singular: 'Country' },
  'sponsor-types':     { apiType: 'SponsorType',      label: 'Sponsor Types',     singular: 'Sponsor Type' },
  'hear-about':        { apiType: 'HearAbout',        label: 'Hear About',        singular: 'Hear About' },
  'register-interest': { apiType: 'RegisterInterest', label: 'Register Interest', singular: 'Register Interest' },
};

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function Lookups() {
  const { type } = useParams();
  const config = TYPE_CONFIG[type];

  const [items, setItems]           = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addOpen, setAddOpen]       = useState(false);
  const [editModal, setEditModal]   = useState({ open: false, item: null });
  const [formName, setFormName]     = useState('');
  const [formError, setFormError]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => setRefreshKey((k) => k + 1);

  // Re-fetch whenever type, search, or refreshKey changes
  useEffect(() => {
    if (!config) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { data } = await api.get(`/api/master/lookups/${config.apiType}`, {
          params: { ...(search && { search }) },
        });
        if (!cancelled) setItems(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [type, search, refreshKey, config]);

  if (!config) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Not Found</h1>
        </div>
        <p className="text-medium">Unknown lookup type: <strong>{type}</strong></p>
      </div>
    );
  }

  // ── Add ──────────────────────────────────────────────────
  async function handleAdd(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.post(`/api/master/lookups/${config.apiType}`, { name: formName });
      setAddOpen(false);
      setFormName('');
      refresh();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create entry');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Edit ─────────────────────────────────────────────────
  function openEdit(item) {
    setFormName(item.name);
    setFormError('');
    setEditModal({ open: true, item });
  }

  async function handleEdit(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.patch(`/api/master/lookups/${config.apiType}/${editModal.item._id}`, {
        name: formName,
      });
      setEditModal({ open: false, item: null });
      refresh();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to update entry');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete (soft) ────────────────────────────────────────
  async function handleDelete(itemId) {
    if (!window.confirm('Delete this entry? It will be marked as deleted but can be reviewed later.')) return;
    try {
      await api.delete(`/api/master/lookups/${config.apiType}/${itemId}`);
      refresh();
    } catch (err) {
      console.error(err);
    }
  }

  // ── Banish (permanent hard delete) ───────────────────────
  async function handleBanish(item) {
    if (!window.confirm(
      `PERMANENTLY DELETE "${item.name}"?\n\nThis will erase the entry from the database forever. This cannot be undone.`
    )) return;
    try {
      await api.delete(`/api/master/lookups/${config.apiType}/${item._id}/banish`);
      refresh();
    } catch (err) {
      console.error(err);
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      label: 'Created On',
      render: (row) => fmtDate(row.createdAt),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-sm btn-outline" onClick={() => openEdit(row)}>
            Edit
          </button>
          {row.status !== 'deleted' ? (
            <button
              className="btn btn-sm btn-outline text-danger"
              onClick={() => handleDelete(row._id)}
            >
              Delete
            </button>
          ) : (
            <button
              className="btn btn-sm btn-banish"
              onClick={() => handleBanish(row)}
              title="Permanently remove this entry from the database"
            >
              ☠ Banish
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{config.label}</h1>
      </div>

      <DataTable
        columns={columns}
        data={items}
        total={items.length}
        page={1}
        limit={items.length || 1}
        onSearch={(val) => setSearch(val)}
        loading={loading}
        onAdd={() => { setFormName(''); setFormError(''); setAddOpen(true); }}
        addLabel={`+ Add ${config.singular}`}
      />

      {/* ── Add Modal ── */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title={`Add ${config.singular}`}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="btn btn-primary" form="lookup-add-form" type="submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add'}
            </button>
          </>
        }
      >
        <form id="lookup-add-form" onSubmit={handleAdd}>
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="form-group">
            <label className="label">Name *</label>
            <input
              className="input" required autoFocus
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={`Enter ${config.singular.toLowerCase()}`}
            />
          </div>
        </form>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, item: null })}
        title={`Edit ${config.singular}`}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditModal({ open: false, item: null })}>Cancel</button>
            <button className="btn btn-primary" form="lookup-edit-form" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form id="lookup-edit-form" onSubmit={handleEdit}>
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="form-group">
            <label className="label">Name *</label>
            <input
              className="input" required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
