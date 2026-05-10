import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import DataTable, { StatusBadge } from '../components/DataTable';
import Modal from '../components/Modal';

const EVENT_TYPES = [
  'Conference', 'Workshop', 'Seminar', 'Networking Event',
  'Trade Show', 'Exhibition', 'Gala / Dinner', 'Corporate Meeting',
  'Training', 'Webinar', 'Community Event', 'Other',
];

// Colour map for event type badges
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

function EventTypeBadge({ type }) {
  if (!type) return null;
  const color = TYPE_COLORS[type] || '#64748b';
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 7px',
      borderRadius: 4, background: `${color}18`, color, marginTop: 3,
      whiteSpace: 'nowrap',
    }}>
      {type}
    </span>
  );
}

const LIMIT = 20;

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function ActionsMenu({ org, isOpen, onToggle, onEdit, onResetPwd, onToggleStatus, onDelete, onBanish, onPermissions }) {
  const btnRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  function handleToggle() {
    if (!isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 5, right: window.innerWidth - rect.right });
    }
    onToggle();
  }

  return (
    <div className="dropdown" onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} className="btn btn-sm btn-outline" onClick={handleToggle}>
        Actions ▾
      </button>
      {isOpen && (
        <div
          className="dropdown-menu"
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, left: 'auto' }}
        >
          <button className="dropdown-item" onClick={onEdit}>Edit</button>
          <button className="dropdown-item" onClick={onResetPwd}>Reset Password</button>
          <button className="dropdown-item" onClick={onPermissions}>Permissions</button>
          {org.status !== 'deleted' && (
            <button className="dropdown-item" onClick={onToggleStatus}>
              {org.status === 'active' ? 'Suspend' : 'Activate'}
            </button>
          )}
          {org.status !== 'deleted' && (
            <button className="dropdown-item dropdown-item-danger" onClick={onDelete}>Delete</button>
          )}
          {org.status === 'deleted' && (
            <>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item dropdown-item-banish"
                onClick={onBanish}
                title="Permanently remove this organization and all its data from the database"
              >
                ☠ Banish
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const EMPTY_ADD = { name: '', email: '', password: '', eventType: 'Conference' };
const EMPTY_EDIT = { name: '', email: '', slug: '' };

export default function Organizations() {
  const [orgs, setOrgs]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [dropdownId, setDropdownId] = useState(null);

  const [addOpen, setAddOpen]     = useState(false);
  const [addForm, setAddForm]     = useState(EMPTY_ADD);
  const [addError, setAddError]   = useState('');

  const [editModal, setEditModal] = useState({ open: false, org: null });
  const [editForm, setEditForm]   = useState(EMPTY_EDIT);
  const [editError, setEditError] = useState('');

  const [resetModal, setResetModal] = useState({ open: false, orgId: null });
  const [newPwd, setNewPwd]         = useState('');
  const [resetError, setResetError] = useState('');

  const [permModal, setPermModal] = useState({ open: false, org: null });
  const [permForm, setPermForm]   = useState({
    canExportData: true, canCheckIn: true, canViewVip: true, canEditPageBuilder: true,
  });
  const [permError, setPermError] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = () => setDropdownId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const fetchOrgs = useCallback(async (p = page, s = search) => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/master/organizations', {
        params: { page: p, limit: LIMIT, ...(s && { search: s }) },
      });
      setOrgs(data.data);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchOrgs(page, search); }, [page, search]);

  // ── Add ──────────────────────────────────────────────────
  async function handleAdd(e) {
    e.preventDefault();
    setAddError('');
    setSubmitting(true);
    try {
      await api.post('/api/master/organizations', addForm);
      setAddOpen(false);
      setAddForm(EMPTY_ADD);
      fetchOrgs(1, search);
      setPage(1);
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Edit ─────────────────────────────────────────────────
  function openEdit(org) {
    setEditForm({ name: org.name, email: org.email, slug: org.slug || '' });
    setEditError('');
    setEditModal({ open: true, org });
    setDropdownId(null);
  }

  async function handleEdit(e) {
    e.preventDefault();
    setEditError('');
    setSubmitting(true);
    try {
      await api.patch(`/api/master/organizations/${editModal.org._id}`, editForm);
      setEditModal({ open: false, org: null });
      fetchOrgs(page, search);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update organization');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Reset Password ────────────────────────────────────────
  function openResetPwd(orgId) {
    setNewPwd('');
    setResetError('');
    setResetModal({ open: true, orgId });
    setDropdownId(null);
  }

  async function handleResetPwd(e) {
    e.preventDefault();
    setResetError('');
    setSubmitting(true);
    try {
      await api.patch(`/api/master/organizations/${resetModal.orgId}/reset-password`, {
        password: newPwd,
      });
      setResetModal({ open: false, orgId: null });
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Permissions ───────────────────────────────────────────
  function openPermissions(org) {
    setPermForm({
      canExportData:      org.permissions?.canExportData      !== false,
      canCheckIn:         org.permissions?.canCheckIn         !== false,
      canViewVip:         org.permissions?.canViewVip         !== false,
      canEditPageBuilder: org.permissions?.canEditPageBuilder !== false,
    });
    setPermError('');
    setPermModal({ open: true, org });
    setDropdownId(null);
  }

  async function handlePermSave(e) {
    e.preventDefault();
    setPermError('');
    setSubmitting(true);
    try {
      await api.patch(`/api/master/organizations/${permModal.org._id}/permissions`, permForm);
      setPermModal({ open: false, org: null });
      fetchOrgs(page, search);
    } catch (err) {
      setPermError(err.response?.data?.message || 'Failed to update permissions');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Suspend / Activate ────────────────────────────────────
  async function handleToggleStatus(org) {
    setDropdownId(null);
    const newStatus = org.status === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/api/master/organizations/${org._id}`, { status: newStatus });
      fetchOrgs(page, search);
    } catch (err) {
      console.error(err);
    }
  }

  // ── Delete (soft) ─────────────────────────────────────────
  async function handleDelete(orgId) {
    setDropdownId(null);
    if (!window.confirm('Delete this organization? It will be marked as deleted but can be reviewed later.')) return;
    try {
      await api.delete(`/api/master/organizations/${orgId}`);
      fetchOrgs(page, search);
    } catch (err) {
      console.error(err);
    }
  }

  // ── Banish (permanent hard delete) ───────────────────────
  async function handleBanish(orgId, orgName) {
    setDropdownId(null);
    if (!window.confirm(
      `PERMANENTLY DELETE "${orgName}"?\n\nThis will erase the organization and ALL its data (event, sessions, registrants, templates) from the database forever. This cannot be undone.`
    )) return;
    try {
      await api.delete(`/api/master/organizations/${orgId}/banish`);
      fetchOrgs(page, search);
    } catch (err) {
      console.error(err);
    }
  }

  const columns = [
    { key: 'name',  label: 'Organization' },
    { key: 'email', label: 'Email' },
    {
      key: 'eventType',
      label: 'Event',
      render: (row) => row.eventId ? (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{row.eventId.name}</div>
          <EventTypeBadge type={row.eventId.eventType} />
        </div>
      ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => fmtDate(row.createdAt),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <ActionsMenu
          org={row}
          isOpen={dropdownId === row._id}
          onToggle={() => setDropdownId((prev) => (prev === row._id ? null : row._id))}
          onEdit={() => openEdit(row)}
          onResetPwd={() => openResetPwd(row._id)}
          onToggleStatus={() => handleToggleStatus(row)}
          onDelete={() => handleDelete(row._id)}
          onBanish={() => handleBanish(row._id, row.name)}
          onPermissions={() => openPermissions(row)}
        />
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Organizations</h1>
      </div>

      <DataTable
        columns={columns}
        data={orgs}
        total={total}
        page={page}
        limit={LIMIT}
        onPageChange={setPage}
        onSearch={(val) => { setSearch(val); setPage(1); }}
        loading={loading}
        onAdd={() => { setAddForm(EMPTY_ADD); setAddError(''); setAddOpen(true); }}
        addLabel="+ Add Organization"
      />

      {/* ── Add Modal ── */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Organization"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="btn btn-primary" form="add-org-form" type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <form id="add-org-form" onSubmit={handleAdd}>
          {addError && <div className="alert alert-error">{addError}</div>}
          <div className="form-group">
            <label className="label">Organization Name *</label>
            <input
              className="input" required
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Acme Events"
            />
          </div>
          <div className="form-group">
            <label className="label">Email *</label>
            <input
              className="input" type="email" required
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="organizer@example.com"
            />
          </div>
          <div className="form-group">
            <label className="label">Password *</label>
            <input
              className="input" type="password" required minLength={6}
              value={addForm.password}
              onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min 6 characters"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="label">Event Type</label>
            <select
              className="input"
              value={addForm.eventType}
              onChange={(e) => setAddForm((f) => ({ ...f, eventType: e.target.value }))}
              style={{ cursor: 'pointer' }}
            >
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </form>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, org: null })}
        title="Edit Organization"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditModal({ open: false, org: null })}>Cancel</button>
            <button className="btn btn-primary" form="edit-org-form" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form id="edit-org-form" onSubmit={handleEdit}>
          {editError && <div className="alert alert-error">{editError}</div>}
          <div className="form-group">
            <label className="label">Organization Name</label>
            <input
              className="input"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input
              className="input" type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="label">Slug</label>
            <input
              className="input"
              value={editForm.slug}
              onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="url-friendly-slug"
            />
          </div>
        </form>
      </Modal>

      {/* ── Reset Password Modal ── */}
      <Modal
        isOpen={resetModal.open}
        onClose={() => setResetModal({ open: false, orgId: null })}
        title="Reset Password"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setResetModal({ open: false, orgId: null })}>Cancel</button>
            <button className="btn btn-primary" form="reset-pwd-form" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Reset Password'}
            </button>
          </>
        }
      >
        <form id="reset-pwd-form" onSubmit={handleResetPwd}>
          {resetError && <div className="alert alert-error">{resetError}</div>}
          <div className="form-group">
            <label className="label">New Password *</label>
            <input
              className="input" type="password" required minLength={6}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Min 6 characters"
            />
          </div>
        </form>
      </Modal>

      {/* ── Permissions Modal ── */}
      <Modal
        isOpen={permModal.open}
        onClose={() => setPermModal({ open: false, org: null })}
        title="Admin Permissions"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setPermModal({ open: false, org: null })}>Cancel</button>
            <button className="btn btn-primary" form="perm-form" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Permissions'}
            </button>
          </>
        }
      >
        <form id="perm-form" onSubmit={handlePermSave}>
          {permError && <div className="alert alert-error">{permError}</div>}
          <p style={{ fontSize: 13, color: 'var(--text-medium)', marginBottom: 16 }}>
            Control what this admin can access in their panel.
          </p>
          {[
            { key: 'canExportData',      label: 'Export registrant data (CSV)' },
            { key: 'canCheckIn',         label: 'Use check-in feature' },
            { key: 'canViewVip',         label: 'Access VIP registrants' },
            { key: 'canEditPageBuilder', label: 'Edit registration page design' },
          ].map(({ key, label }) => (
            <div key={key} className="perm-row">
              <label className="toggle" style={{ marginRight: 10 }}>
                <input
                  type="checkbox"
                  className="toggle-input"
                  checked={!!permForm[key]}
                  onChange={(e) => setPermForm((f) => ({ ...f, [key]: e.target.checked }))}
                />
                <span className="toggle-track" />
              </label>
              <span style={{ fontSize: 13.5 }}>{label}</span>
            </div>
          ))}
        </form>
      </Modal>
    </div>
  );
}
