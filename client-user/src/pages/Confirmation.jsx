import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';

// ─── Date formatter ───────────────────────────────────────────────────────────
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ─── QR download ─────────────────────────────────────────────────────────────
function downloadQR(dataUrl, filename) {
  const a    = document.createElement('a');
  a.href     = dataUrl;
  a.download = filename || 'registration-qr.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── VIP badge display ────────────────────────────────────────────────────────
function VipBadgeDisplay() {
  return (
    <div className="conf-vip-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
           width="22" height="22" style={{ marginRight: 8 }}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      VIP Guest
    </div>
  );
}

// ─── Confirmation page ────────────────────────────────────────────────────────
export default function Confirmation({ vip = false }) {
  const { orgSlug, registrantId } = useParams();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (vip) document.body.classList.add('vip-mode');
    api.get(`/api/public/${orgSlug}/registrant/${registrantId}`)
      .then(({ data: d }) => { setData(d); })
      .catch((err) => {
        setError(
          err.response?.status === 404
            ? 'Registration record not found.'
            : 'Could not load your confirmation. Please try again.'
        );
      })
      .finally(() => setLoading(false));
    return () => { document.body.classList.remove('vip-mode'); };
  }, [orgSlug, registrantId, vip]);

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="not-available">
        <div className="not-available-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
               width="28" height="28">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h1 className="not-available-title">Confirmation Error</h1>
        <p className="not-available-sub">{error}</p>
        <Link to={`/${orgSlug}`} style={{ marginTop: 20, display: 'inline-block', color: 'var(--primary-color)', fontWeight: 600 }}>
          ← Back to registration
        </Link>
      </div>
    );
  }

  const {
    firstName, lastName, email,
    qrCodeImage, qrCode,
    sessionName, sessionDate,
    eventName,
    paymentStatus,
    badgeType,
  } = data;

  const isVip = vip || badgeType === 'vip';

  const fullName = `${firstName} ${lastName}`;

  return (
    <div className="conf-page">
      <div className="conf-card">

        {/* ── Confirmation header ──────────────── */}
        <div className="conf-header">
          <div className="conf-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" width="28" height="28">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          {isVip && <VipBadgeDisplay />}
          <h1 className="conf-header-title">You're Registered!</h1>
          <p className="conf-header-sub">Welcome, {firstName}. See you at the event.</p>
        </div>

        <div className="conf-body">

          {/* ── Email confirmation note ──────────── */}
          <div className="conf-email-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"
                 width="15" height="15" style={{ flexShrink: 0 }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            A confirmation email has been sent to <strong>{email}</strong>
          </div>

          {/* ── Registration details ─────────────── */}
          <div className="conf-info-section">
            <div className="conf-info-title">Registration Details</div>
            <div className="conf-info-grid">
              <div>
                <div className="conf-info-label">Name</div>
                <div className="conf-info-value">{fullName}</div>
              </div>
              {eventName && (
                <div>
                  <div className="conf-info-label">Event</div>
                  <div className="conf-info-value">{eventName}</div>
                </div>
              )}
              {sessionName && (
                <div>
                  <div className="conf-info-label">Session</div>
                  <div className="conf-info-value">{sessionName}</div>
                </div>
              )}
              {sessionDate && (
                <div>
                  <div className="conf-info-label">Date</div>
                  <div className="conf-info-value">{fmtDate(sessionDate)}</div>
                </div>
              )}
              {paymentStatus && paymentStatus !== 'free' && (
                <div>
                  <div className="conf-info-label">Payment</div>
                  <div className="conf-info-value" style={{ color: 'var(--text-success)', textTransform: 'capitalize' }}>
                    ✓ {paymentStatus}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── QR code ──────────────────────────── */}
          {qrCodeImage && (
            <div className="conf-qr-section">
              <img
                src={qrCodeImage}
                alt={`QR Code for ${fullName}`}
                className="conf-qr-img"
              />
              <span className="conf-qr-code">
                {qrCode}
              </span>
              <p style={{ fontSize: 12.5, color: 'var(--text-light)', textAlign: 'center' }}>
                Present this QR code at check-in
              </p>
            </div>
          )}

          {/* ── Actions ──────────────────────────── */}
          <div className="conf-actions">
            {qrCodeImage && (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => downloadQR(qrCodeImage, `${fullName.replace(/\s+/g, '-')}-qr.png`)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" width="16" height="16">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download QR Code
              </button>
            )}

            <Link to={isVip ? `/${orgSlug}/vip` : `/${orgSlug}`} className="btn btn-outline btn-lg">
              Register Another Attendee
            </Link>
          </div>

        </div>{/* end conf-body */}
      </div>{/* end conf-card */}
    </div>
  );
}
