import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const USER_APP_URL = import.meta.env.VITE_USER_APP_URL || 'http://localhost:3002';

// ─── Event type options ───────────────────────────────────────────────────────
const EVENT_TYPES = [
  'Conference', 'Workshop', 'Seminar', 'Networking Event',
  'Trade Show', 'Exhibition', 'Gala / Dinner', 'Corporate Meeting',
  'Training', 'Webinar', 'Community Event', 'Other',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateInput(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Session modal ────────────────────────────────────────────────────────────
const SESSION_BLANK = { name: '', date: '', capacity: '', waitlistCapacity: '' };

function SessionModal({ mode, initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(
    mode === 'edit'
      ? { ...initial, date: toDateInput(initial?.date), capacity: String(initial?.capacity ?? ''), waitlistCapacity: String(initial?.waitlistCapacity ?? '') }
      : SESSION_BLANK
  );
  const [err, setErr] = useState('');

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim())          return setErr('Name is required.');
    if (!form.date)                  return setErr('Date is required.');
    if (!form.capacity || isNaN(Number(form.capacity)) || Number(form.capacity) < 1)
      return setErr('Capacity must be a positive number.');
    setErr('');
    onSave({
      name:             form.name.trim(),
      date:             form.date,
      capacity:         Number(form.capacity),
      waitlistCapacity: Number(form.waitlistCapacity) || 0,
    });
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{mode === 'edit' ? 'Edit Session' : 'Add Session'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form id="session-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            {err && <div className="alert alert-error">{err}</div>}
            <div className="form-group">
              <label className="label">Session Name *</label>
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Morning Keynote" />
            </div>
            <div className="form-group">
              <label className="label">Date *</label>
              <input className="input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div className="form-row-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Capacity *</label>
                <input className="input" type="number" min="1" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="e.g. 200" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Waitlist Cap</label>
                <input className="input" type="number" min="0" value={form.waitlistCapacity} onChange={(e) => set('waitlistCapacity', e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>
        </form>
        <div className="modal-footer">
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" form="session-form" type="submit" disabled={saving}>
            {saving ? 'Saving…' : mode === 'edit' ? 'Update Session' : 'Add Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EventSetup() {
  const toast      = useToast();
  const { user }   = useAuth();
  const orgSlug    = user?.slug || '';
  const [event, setEvent]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saveState, setSaveState] = useState('idle'); // idle|saving|saved|error
  const [modal, setModal]         = useState(null);   // null | { mode:'add'|'edit', session? }
  const [sessOp, setSessOp]       = useState(false);  // session add/edit saving
  const [deleting, setDeleting]   = useState(null);   // sessionId being deleted

  const [form, setForm] = useState({
    name: '', description: '', eventType: 'Conference',
    startDate: '', endDate: '', registrationOpenDate: '', status: 'draft',
  });

  // Payment settings form — standard + VIP
  const [payForm, setPayForm]       = useState({ paymentEnabled: false, ticketPrice: '', currency: 'USD' });
  const [vipPayForm, setVipPayForm] = useState({ vipPaymentEnabled: false, vipTicketPrice: '', vipCurrency: 'USD' });
  const [payState, setPayState]     = useState('idle'); // idle|saving|saved|error

  // Embed widget
  const [embedUrl, setEmbedUrl]       = useState('');
  const [copied, setCopied]           = useState(false);
  const snippetRef                    = useRef(null);

  // ── Fetch ──────────────────────────────────────────────────
  useEffect(() => {
    api.get('/api/admin/event')
      .then(({ data }) => {
        setEvent(data);
        setForm({
          name:                 data.name                 || '',
          description:          data.description          || '',
          eventType:            data.eventType            || 'Conference',
          startDate:            toDateInput(data.startDate),
          endDate:              toDateInput(data.endDate),
          registrationOpenDate: toDateInput(data.registrationOpenDate),
          status:               data.status               || 'draft',
        });
        setPayForm({
          paymentEnabled: data.paymentEnabled || false,
          ticketPrice:    data.ticketPrice    ? String(data.ticketPrice) : '',
          currency:       data.currency       || 'USD',
        });
        setVipPayForm({
          vipPaymentEnabled: data.vipPaymentEnabled || false,
          vipTicketPrice:    data.vipTicketPrice    ? String(data.vipTicketPrice) : '',
          vipCurrency:       data.vipCurrency       || 'USD',
        });
        setEmbedUrl(data.embedUrl || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  // ── Save event details ─────────────────────────────────────
  async function handleSave() {
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      toast('End date must be on or after start date.', 'error');
      return;
    }
    if (form.registrationOpenDate && form.startDate && form.registrationOpenDate > form.startDate) {
      toast('Registration open date must be before the event start date.', 'error');
      return;
    }
    setSaveState('saving');
    try {
      const { data } = await api.patch('/api/admin/event', {
        name:                 form.name,
        description:          form.description,
        eventType:            form.eventType,
        startDate:            form.startDate   || undefined,
        endDate:              form.endDate     || undefined,
        registrationOpenDate: form.registrationOpenDate || undefined,
        status:               form.status,
        embedUrl:             embedUrl.trim(),
      });
      setEvent(data);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2200);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }

  // ── Add session ────────────────────────────────────────────
  async function handleAddSession(payload) {
    setSessOp(true);
    try {
      const { data } = await api.post('/api/admin/event/sessions', payload);
      setEvent(data);
      setModal(null);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to add session', 'error');
    } finally {
      setSessOp(false);
    }
  }

  // ── Edit session ───────────────────────────────────────────
  async function handleEditSession(sessionId, payload) {
    setSessOp(true);
    try {
      const { data } = await api.patch(`/api/admin/event/sessions/${sessionId}`, payload);
      setEvent(data);
      setModal(null);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to update session', 'error');
    } finally {
      setSessOp(false);
    }
  }

  // ── Delete session ─────────────────────────────────────────
  async function handleDeleteSession(sessionId) {
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    setDeleting(sessionId);
    try {
      const { data } = await api.delete(`/api/admin/event/sessions/${sessionId}`);
      setEvent(data);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to delete session', 'error');
    } finally {
      setDeleting(null);
    }
  }

  // ── Save payment settings ──────────────────────────────────
  async function handleSavePayment() {
    if (payForm.paymentEnabled && (!payForm.ticketPrice || Number(payForm.ticketPrice) <= 0)) {
      toast('Please enter a valid standard ticket price greater than 0.', 'warning');
      return;
    }
    if (vipPayForm.vipPaymentEnabled && (!vipPayForm.vipTicketPrice || Number(vipPayForm.vipTicketPrice) <= 0)) {
      toast('Please enter a valid VIP ticket price greater than 0.', 'warning');
      return;
    }
    setPayState('saving');
    try {
      const { data } = await api.patch('/api/admin/event/payment', {
        paymentEnabled:    payForm.paymentEnabled,
        ticketPrice:       payForm.paymentEnabled    ? Number(payForm.ticketPrice)          : 0,
        currency:          payForm.currency,
        vipPaymentEnabled: vipPayForm.vipPaymentEnabled,
        vipTicketPrice:    vipPayForm.vipPaymentEnabled ? Number(vipPayForm.vipTicketPrice) : 0,
        vipCurrency:       vipPayForm.vipCurrency,
      });
      setEvent(data);
      setPayState('saved');
      setTimeout(() => setPayState('idle'), 2200);
    } catch {
      setPayState('error');
      setTimeout(() => setPayState('idle'), 3000);
    }
  }

  // ── Copy embed snippet ─────────────────────────────────────
  const embedSnippet = orgSlug
    ? `<script src="${USER_APP_URL}/embed.js" data-slug="${orgSlug}"></script>`
    : '';

  function handleCopySnippet() {
    if (!embedSnippet) return;
    navigator.clipboard.writeText(embedSnippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const saveBtnClass = saveState === 'saved'  ? 'btn btn-sm btn-success'
                     : saveState === 'error'  ? 'btn btn-sm btn-danger-ghost'
                     : 'btn btn-sm btn-primary';
  const saveBtnLabel = saveState === 'saving' ? 'Saving…'
                     : saveState === 'saved'  ? '✓ Saved'
                     : saveState === 'error'  ? '✕ Error'
                     : 'Save Changes';

  const payBtnClass = payState === 'saved'  ? 'btn btn-sm btn-success'
                    : payState === 'error'  ? 'btn btn-sm btn-danger-ghost'
                    : 'btn btn-sm btn-primary';
  const payBtnLabel = payState === 'saving' ? 'Saving…'
                    : payState === 'saved'  ? '✓ Saved'
                    : payState === 'error'  ? '✕ Error'
                    : 'Save Payment Settings';

  if (loading) return (
    <div>
      <div className="page-header">
        <div className="skeleton sk-title" style={{ width: 140 }} />
        <div className="skeleton" style={{ width: 100, height: 30, borderRadius: 6 }} />
      </div>
      <div className="sk-card" style={{ marginBottom: 20 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <div className="skeleton sk-text" style={{ width: '25%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 36, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div className="sk-card">
        <div className="skeleton sk-text" style={{ width: '30%', marginBottom: 16 }} />
        {[...Array(2)].map((_, i) => (
          <div key={i} style={{ marginBottom: 12, display: 'flex', gap: 12 }}>
            <div className="skeleton" style={{ flex: 1, height: 36, borderRadius: 6 }} />
            <div className="skeleton" style={{ flex: 1, height: 36, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      {/* ── Header ─────────────────────────────── */}
      <div className="page-header">
        <h1 className="page-title">Event Setup</h1>
        <button className={saveBtnClass} onClick={handleSave} disabled={saveState === 'saving'}>
          {saveBtnLabel}
        </button>
      </div>

      {/* ── Event details form ─────────────────── */}
      <div className="event-form-card">
        <div className="event-form-title">Event Details</div>

        <div className="form-group">
          <label className="label">Event Name *</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Tech Summit 2026" />
        </div>

        <div className="form-group">
          <label className="label">Description</label>
          <textarea className="input" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="A short description of the event…" />
        </div>

        <div className="form-group">
          <label className="label">Event Type</label>
          <select className="input" value={form.eventType} onChange={(e) => set('eventType', e.target.value)} style={{ cursor: 'pointer' }}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="form-row-3" style={{ marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="label">Start Date</label>
            <input className="input" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="label">End Date</label>
            <input className="input" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="label">Registration Opens</label>
            <input className="input" type="date" value={form.registrationOpenDate} onChange={(e) => set('registrationOpenDate', e.target.value)} />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)} style={{ cursor: 'pointer' }}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* ── Sessions ──────────────────────────── */}
      <div className="sessions-card">
        <div className="sessions-card-header">
          <span style={{ fontSize: 15, fontWeight: 600 }}>Sessions</span>
          <button className="btn btn-sm btn-primary" onClick={() => setModal({ mode: 'add' })}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Session
          </button>
        </div>

        {(!event?.sessions || event.sessions.length === 0) ? (
          <p className="sessions-empty">No sessions yet. Click "Add Session" to create one.</p>
        ) : (
          <table className="sessions-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Capacity</th>
                <th>Waitlist Cap</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {event.sessions.map((s) => (
                <tr key={s._id}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td>{fmtDate(s.date)}</td>
                  <td>{s.capacity}</td>
                  <td>{s.waitlistCapacity ?? 0}</td>
                  <td>
                    <span style={{
                      color: s.registered >= s.capacity ? '#dc2626'
                           : s.registered >= s.capacity * 0.8 ? '#d97706'
                           : 'inherit'
                    }}>
                      {s.registered ?? 0}
                    </span>
                  </td>
                  <td>
                    <div className="td-actions">
                      <button
                        className="btn-icon-sq"
                        title="Edit session"
                        onClick={() => setModal({ mode: 'edit', session: s })}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        className="btn-icon-sq btn-danger-ghost"
                        title="Delete session"
                        disabled={deleting === s._id}
                        onClick={() => handleDeleteSession(s._id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Payment settings ──────────────────── */}
      <div className="event-form-card" style={{ marginTop: 24 }}>
        <div className="event-form-title">Payment Settings</div>

        {/* ── Standard Registration ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-light)', marginBottom: 14 }}>
            Standard Registration
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-dark)' }}>
                Enable Paid Registration
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-medium)', marginTop: 3, maxWidth: 380 }}>
                When enabled, attendees must complete a Moyasar payment before their
                registration is confirmed.
              </div>
            </div>
            <label className="toggle" style={{ flexShrink: 0, marginTop: 2 }}>
              <input
                type="checkbox"
                checked={payForm.paymentEnabled}
                onChange={(e) => setPayForm((f) => ({ ...f, paymentEnabled: e.target.checked }))}
              />
              <span className="toggle-track" />
            </label>
          </div>

          {payForm.paymentEnabled ? (
            <div className="form-row-2" style={{ marginTop: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Ticket Price *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-medium)', fontSize: 14, pointerEvents: 'none',
                  }}>
                    {{ USD: '$', EUR: '€', GBP: '£', SAR: 'ر.س', AED: 'د.إ', CAD: 'C$', AUD: 'A$' }[payForm.currency] ?? '$'}
                  </span>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={payForm.ticketPrice}
                    onChange={(e) => setPayForm((f) => ({ ...f, ticketPrice: e.target.value }))}
                    placeholder="e.g. 99.00"
                    style={{ paddingLeft: payForm.currency === 'SAR' ? 36 : 24 }}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Currency</label>
                <select
                  className="input"
                  value={payForm.currency}
                  onChange={(e) => setPayForm((f) => ({ ...f, currency: e.target.value }))}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="CAD">CAD — Canadian Dollar</option>
                  <option value="AUD">AUD — Australian Dollar</option>
                </select>
              </div>
            </div>
          ) : (
            <p style={{
              marginTop: 12, fontSize: 13, color: 'var(--text-light)',
              background: '#f8fafc', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '9px 12px',
            }}>
              Standard registration is currently <strong>free</strong>.
            </p>
          )}
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)', marginBottom: 24 }} />

        {/* ── VIP Registration ── */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-light)', marginBottom: 14 }}>
            VIP Registration
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-dark)' }}>
                Enable Paid VIP Registration
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-medium)', marginTop: 3, maxWidth: 380 }}>
                When enabled, VIP attendees must complete a Moyasar payment before their
                registration is confirmed.
              </div>
            </div>
            <label className="toggle" style={{ flexShrink: 0, marginTop: 2 }}>
              <input
                type="checkbox"
                checked={vipPayForm.vipPaymentEnabled}
                onChange={(e) => setVipPayForm((f) => ({ ...f, vipPaymentEnabled: e.target.checked }))}
              />
              <span className="toggle-track" />
            </label>
          </div>

          {vipPayForm.vipPaymentEnabled ? (
            <div className="form-row-2" style={{ marginTop: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">VIP Ticket Price *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-medium)', fontSize: 14, pointerEvents: 'none',
                  }}>
                    {{ USD: '$', EUR: '€', GBP: '£', SAR: 'ر.س', AED: 'د.إ', CAD: 'C$', AUD: 'A$' }[vipPayForm.vipCurrency] ?? '$'}
                  </span>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={vipPayForm.vipTicketPrice}
                    onChange={(e) => setVipPayForm((f) => ({ ...f, vipTicketPrice: e.target.value }))}
                    placeholder="e.g. 199.00"
                    style={{ paddingLeft: vipPayForm.vipCurrency === 'SAR' ? 36 : 24 }}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Currency</label>
                <select
                  className="input"
                  value={vipPayForm.vipCurrency}
                  onChange={(e) => setVipPayForm((f) => ({ ...f, vipCurrency: e.target.value }))}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="CAD">CAD — Canadian Dollar</option>
                  <option value="AUD">AUD — Australian Dollar</option>
                </select>
              </div>
            </div>
          ) : (
            <p style={{
              marginTop: 12, fontSize: 13, color: 'var(--text-light)',
              background: '#f8fafc', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '9px 12px',
            }}>
              VIP registration is currently <strong>free</strong>.
            </p>
          )}
        </div>

        {/* Save button */}
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <button className={payBtnClass} onClick={handleSavePayment} disabled={payState === 'saving'}>
            {payBtnLabel}
          </button>
          {payState === 'saved' && (
            <span style={{ fontSize: 12.5, color: '#16a34a' }}>Payment settings updated.</span>
          )}
        </div>
      </div>

      {/* ── Website Embed ────────────────────── */}
      <div className="event-form-card" style={{ marginTop: 24 }}>
        <div className="event-form-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               width="18" height="18">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
          Embed on Your Website
        </div>

        {/* ── What is this ── */}
        <p style={{ fontSize: 13.5, color: 'var(--text-medium)', marginBottom: 20, lineHeight: 1.6 }}>
          Add your registration form directly to any page on your website — no redirects,
          no external links. Attendees register without ever leaving your site.
        </p>

        {/* ── Step-by-step tutorial ── */}
        <div style={{
          background: '#f8fafc', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '18px 20px', marginBottom: 22,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 14, letterSpacing: '0.01em' }}>
            How to embed the form — 2 steps
          </div>

          {/* Step 1 */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
              background: 'var(--primary-color)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>1</div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 4 }}>
                Copy the snippet below
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.55 }}>
                It's one single line of code. That's all you need.
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
              background: 'var(--primary-color)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>2</div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 4 }}>
                Paste it on your website page
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.55 }}>
                Open the page where you want the form to appear. Paste the snippet in the
                HTML editor right where you want the form to sit. On <strong>WordPress</strong>,
                use a Custom HTML block. On <strong>Wix / Squarespace</strong>, use an Embed
                or Custom Code block. On any other platform, paste it into the page's HTML.
                The form will appear there automatically — no other setup needed.
              </div>
            </div>
          </div>
        </div>

        {/* ── Generated snippet ── */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="label">Your embed snippet</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <input
              ref={snippetRef}
              className="input"
              readOnly
              value={embedSnippet}
              style={{
                fontFamily: 'monospace', fontSize: 12.5,
                background: '#0f172a', color: '#7dd3fc',
                borderColor: '#334155', cursor: 'text',
                flex: 1,
              }}
              onFocus={(e) => e.target.select()}
            />
            <button
              className={`btn btn-sm ${copied ? 'btn-success' : 'btn-primary'}`}
              onClick={handleCopySnippet}
              style={{ flexShrink: 0, minWidth: 80 }}
              disabled={!orgSlug}
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="3" width="13" height="13">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" width="13" height="13">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Your page URL (optional, for organizer's reference) ── */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">
            Your website page URL
            <span style={{ fontWeight: 400, color: 'var(--text-light)', marginLeft: 6 }}>(optional — for your reference)</span>
          </label>
          <input
            className="input"
            type="url"
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            placeholder="https://yourwebsite.com/events/register"
          />
          <p style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-light)' }}>
            Paste the URL of the page where you placed the snippet. Saved with your event details.
          </p>
        </div>
      </div>

      {/* ── Session modal ─────────────────────── */}
      {modal && (
        <SessionModal
          mode={modal.mode}
          initial={modal.session}
          saving={sessOp}
          onClose={() => setModal(null)}
          onSave={(payload) => {
            if (modal.mode === 'add') handleAddSession(payload);
            else handleEditSession(modal.session._id, payload);
          }}
        />
      )}
    </div>
  );
}
