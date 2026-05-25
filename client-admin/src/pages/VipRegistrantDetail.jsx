import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { BadgePrintView, DEFAULT_BADGE_CONFIG } from '../components/BadgePrintView';
import { CheckInBadge, PaymentBadge } from '../components/AttendeeCard';
import { useToast } from '../context/ToastContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const QR_API = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&bgcolor=ffffff&color=1e293b&data=';

function fmt(v) {
  if (!v) return null;
  return new Date(v).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// ─── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value, accent }) {
  if (!value) return null;
  return (
    <div className="rdt-field-row">
      <span className="rdt-field-label">{label}</span>
      <span className={`rdt-field-value${accent ? ` rdt-val-${accent}` : ''}`}>{value}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VipRegistrantDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const toast    = useToast();

  const [registrant,      setRegistrant]      = useState(null);
  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [actionState,     setAction]          = useState('');    // ''|'in'|'out'
  const [resendState,     setResend]          = useState('idle'); // idle|loading|ok|error

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/api/admin/vip-registrants/${id}`),
      api.get('/api/admin/vip-page-config').catch(() => ({ data: {} })),
    ])
      .then(([regRes, pageRes]) => {
        setRegistrant(regRes.data);
        const STANDARD = new Set([
          'firstName', 'lastName', 'email', 'phone', 'landline',
          'mobile', 'gender', 'country', 'title', 'hearAbout',
        ]);
        setCustomFieldDefs(
          (pageRes.data.formFields || []).filter((f) => !STANDARD.has(f.fieldName))
        );
      })
      .catch((err) => {
        setError(err.response?.status === 404
          ? 'VIP registrant not found.'
          : 'Failed to load registrant details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  function getCustomLabel(key) {
    return customFieldDefs.find((d) => d.fieldName === key)?.label || fmtKey(key);
  }

  async function handleCheckIn() {
    setAction('in');
    try {
      const { data } = await api.patch(`/api/admin/vip-registrants/${id}/checkin`);
      setRegistrant((prev) => ({ ...prev, ...data }));
      toast(`${data.firstName} ${data.lastName} checked in`, 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Check-in failed', 'error');
    } finally {
      setAction('');
    }
  }

  async function handleCheckOut() {
    setAction('out');
    try {
      const { data } = await api.patch(`/api/admin/vip-registrants/${id}/checkout`);
      setRegistrant((prev) => ({ ...prev, ...data }));
      toast(`${data.firstName} ${data.lastName} checked out`, 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Check-out failed', 'error');
    } finally {
      setAction('');
    }
  }

  function handlePrint() {
    const cfg = registrant?.badgeConfig || DEFAULT_BADGE_CONFIG;
    const w   = cfg.width  || 85;
    const h   = cfg.height || 54;
    let styleEl = document.getElementById('bp-page-size');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'bp-page-size';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@media print { @page { size: ${w}mm ${h}mm; margin: 0; } }`;
    window.print();
  }

  async function handleResend() {
    setResend('loading');
    try {
      await api.post(`/api/admin/vip-registrants/${id}/resend`);
      setResend('ok');
      setTimeout(() => setResend('idle'), 3500);
    } catch (err) {
      setResend('error');
      toast(err.response?.data?.message || 'Failed to resend email', 'error');
      setTimeout(() => setResend('idle'), 3500);
    }
  }

  // ─── Loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rdt-wrapper">
        <div className="rdt-placeholder">Loading registrant…</div>
      </div>
    );
  }

  if (error || !registrant) {
    return (
      <div className="rdt-wrapper">
        <button className="rdt-back-btn" onClick={() => navigate('/admin/vip-registrants')}>
          ← Back to VIP Registrants
        </button>
        <div className="rdt-error-box">{error || 'VIP registrant not found.'}</div>
      </div>
    );
  }

  const r = registrant;

  const customEntries = r.customFields
    ? Object.entries(r.customFields).filter(([, v]) => v && String(v).trim())
    : [];

  const badgeCfg = r.badgeConfig
    ? {
        ...DEFAULT_BADGE_CONFIG,
        ...r.badgeConfig,
        fields: r.badgeConfig.fields?.length
          ? r.badgeConfig.fields
          : DEFAULT_BADGE_CONFIG.fields,
      }
    : DEFAULT_BADGE_CONFIG;

  const checkInStatus = r.checkedIn && r.checkedOut
    ? 'Checked out'
    : r.checkedIn
    ? 'Checked in'
    : 'Not checked in';

  const checkInAccent = r.checkedIn && !r.checkedOut
    ? 'green'
    : r.checkedOut
    ? 'gray'
    : 'none';

  return (
    <div className="rdt-wrapper">

      {/* ── Back ──────────────────────────────────────── */}
      <button className="rdt-back-btn" onClick={() => navigate('/admin/vip-registrants')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
             width="13" height="13" style={{ marginRight: 5 }}>
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back to VIP Registrants
      </button>

      {/* ── Profile header ────────────────────────────── */}
      <div className="rdt-header-card">
        <div className="rdt-avatar" style={{ background: '#92400e' }}>
          {(r.firstName?.[0] || '?').toUpperCase()}
        </div>
        <div className="rdt-header-info">
          <h1 className="rdt-name">
            {r.firstName} {r.lastName}
            <span className="badge-vip" style={{ marginLeft: 10, verticalAlign: 'middle', fontSize: 11 }}>VIP</span>
          </h1>
          <p className="rdt-email">{r.email}</p>
          <div className="rdt-badges">
            <CheckInBadge checkedIn={r.checkedIn} />
            <PaymentBadge status={r.paymentStatus} />
            {r.sessionName && (
              <span className="badge badge-purple">{r.sessionName}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body: two columns ─────────────────────────── */}
      <div className="rdt-body">

        {/* ── Left column ─────────────────────────────── */}
        <div className="rdt-col-left">

          {/* Registration info */}
          <div className="rdt-card">
            <h2 className="rdt-card-title">Registration Info</h2>
            <div className="rdt-fields">
              {r.sessionName && <InfoRow label="Session"    value={r.sessionName} />}
              <InfoRow label="Registered"  value={fmt(r.createdAt)} />
              <InfoRow label="Title"       value={r.title}      />
              <InfoRow label="Gender"      value={r.gender}     />
              <InfoRow label="Country"     value={r.country}    />
              <InfoRow label="Phone"       value={r.phone}      />
              <InfoRow label="Mobile"      value={r.mobile}     />
              <InfoRow label="Landline"    value={r.landline}   />
              <InfoRow label="Hear About"  value={r.hearAbout}  />
              {customEntries.map(([key, val]) => (
                <InfoRow key={key} label={getCustomLabel(key)} value={String(val)} />
              ))}
            </div>
          </div>

          {/* Check-in history */}
          <div className="rdt-card">
            <h2 className="rdt-card-title">Check-in</h2>
            <div className="rdt-fields">
              <InfoRow label="Status"         value={checkInStatus}        accent={checkInAccent} />
              <InfoRow label="Checked in at"  value={fmt(r.checkedInAt)}  />
              <InfoRow label="Checked out at" value={fmt(r.checkedOutAt)} />
            </div>

            <div className="rdt-action-row">
              <button
                className="btn-pc-checkin"
                onClick={handleCheckIn}
                disabled={r.checkedIn || actionState === 'in'}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {actionState === 'in' ? 'Checking In…' : '✓ Check In'}
              </button>
              <button
                className="btn-pc-checkout"
                onClick={handleCheckOut}
                disabled={!r.checkedIn || r.checkedOut || actionState === 'out'}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {actionState === 'out' ? 'Checking Out…' : 'Check Out'}
              </button>
            </div>
          </div>

        </div>

        {/* ── Right column ─────────────────────────────── */}
        <div className="rdt-col-right">

          {/* QR code */}
          <div className="rdt-card rdt-qr-card">
            <h2 className="rdt-card-title">QR Code</h2>
            <div className="rdt-qr-wrap">
              <img
                src={`${QR_API}${encodeURIComponent(r.qrCode || 'NO-CODE')}`}
                alt="QR code"
                width="150" height="150"
                loading="lazy"
                style={{ display: 'block', borderRadius: 8, border: '1px solid var(--border)' }}
              />
              <p className="rdt-qr-code">{r.qrCode}</p>
            </div>
          </div>

          {/* Badge preview */}
          <div className="rdt-card">
            <h2 className="rdt-card-title">Badge Preview</h2>
            <div className="rdt-badge-wrap">
              <BadgePrintView
                registrant={r}
                config={badgeCfg}
                preview={true}
                previewWidth={220}
              />
            </div>
            <button className="rdt-print-btn" onClick={handlePrint}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   width="14" height="14" style={{ marginRight: 6 }}>
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print Badge
            </button>
          </div>

          {/* Actions */}
          <div className="rdt-card">
            <h2 className="rdt-card-title">Actions</h2>
            <button
              className={`rdt-resend-btn${resendState === 'ok' ? ' ok' : resendState === 'error' ? ' err' : ''}`}
              onClick={handleResend}
              disabled={resendState === 'loading'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   width="14" height="14" style={{ marginRight: 7, flexShrink: 0 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              {resendState === 'loading'
                ? 'Sending…'
                : resendState === 'ok'
                ? '✓ Confirmation sent'
                : resendState === 'error'
                ? '✗ Failed to send'
                : 'Resend Confirmation Email'}
            </button>
          </div>

        </div>
      </div>

      {/* Print-only badge */}
      <div className="badge-print">
        <BadgePrintView
          registrant={r}
          config={badgeCfg}
          preview={false}
        />
      </div>

    </div>
  );
}
