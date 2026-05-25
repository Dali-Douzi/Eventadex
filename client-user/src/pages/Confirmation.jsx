import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import api from '../api/axios';

// ─── Date formatter ───────────────────────────────────────────────────────────
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US-u-nu-latn', {
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

// ─── Calendar helpers ─────────────────────────────────────────────────────────
function toCalDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
}

function buildGoogleCalUrl(title, start, end, loc, description) {
  const base   = 'https://www.google.com/calendar/render?action=TEMPLATE';
  const parts  = [`text=${encodeURIComponent(title || 'Event')}`];
  if (start) {
    parts.push(`dates=${toCalDate(start)}/${toCalDate(end || start)}`);
  }
  if (loc)         parts.push(`location=${encodeURIComponent(loc)}`);
  if (description) parts.push(`details=${encodeURIComponent(description)}`);
  return `${base}&${parts.join('&')}`;
}

function downloadIcs(title, start, end, loc, filename) {
  const esc  = (s) => (s || '').replace(/[\\;,]/g, '\\$&');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RegApp//EN',
    'BEGIN:VEVENT',
    `SUMMARY:${esc(title || 'Event')}`,
    start ? `DTSTART:${toCalDate(start)}` : '',
    `DTEND:${toCalDate(end || start)}`,
    loc ? `LOCATION:${esc(loc)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename || 'event.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  const location = useLocation();
  const isEmbedded = new URLSearchParams(location.search).has('embed');

  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [resendStatus, setResendStatus] = useState('idle'); // idle | loading | success | error

  // Broadcast height to parent iframe when embedded
  useEffect(() => {
    if (!isEmbedded) return;
    const notify = () => window.parent.postMessage(
      { type: 'reg-height', height: document.body.scrollHeight }, '*'
    );
    notify();
    const ro = new ResizeObserver(notify);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [isEmbedded, loading]);

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

  async function handleResend() {
    setResendStatus('loading');
    try {
      await api.post(`/api/public/${orgSlug}/registrant/${registrantId}/resend`);
      setResendStatus('success');
      setTimeout(() => setResendStatus('idle'), 5000);
    } catch {
      setResendStatus('error');
      setTimeout(() => setResendStatus('idle'), 5000);
    }
  }

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
    isWaitlisted,
    waitlistPosition,
    eventStartDate,
    eventEndDate,
    location: eventLocation,
  } = data;

  const isVip    = vip || badgeType === 'vip';
  const fullName = `${firstName} ${lastName}`;

  // ── Social share helpers ──────────────────────────────────
  const shareUrl  = window.location.origin + window.location.pathname;
  const shareText = eventName
    ? `I just registered for ${eventName}! 🎉`
    : "I'm going to this event! 🎉";

  // ── Waitlist confirmation ─────────────────────────────────────────────────
  if (isWaitlisted) {
    return (
      <div className="conf-page">
        <div className="conf-card">
          <div className="conf-header" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <div className="conf-check" style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.6)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="3" width="28" height="28">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            {isVip && <VipBadgeDisplay />}
            <h1 className="conf-header-title">You're on the Waitlist</h1>
            <p className="conf-header-sub">
              {waitlistPosition
                ? `You're #${waitlistPosition} in line, ${firstName}.`
                : `You've been added to the waitlist, ${firstName}.`}
            </p>
          </div>

          <div className="conf-body">
            <div className="conf-email-note" style={{ borderColor: '#fcd34d', background: '#fffbeb' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"
                   width="15" height="15" style={{ flexShrink: 0 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              A waitlist confirmation has been sent to <strong>{email}</strong>
            </div>

            <div className="conf-info-section">
              <div className="conf-info-title">Waitlist Details</div>
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
                {waitlistPosition && (
                  <div>
                    <div className="conf-info-label">Waitlist Position</div>
                    <div className="conf-info-value" style={{ fontWeight: 700, fontSize: 18 }}>
                      #{waitlistPosition}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{
              background: '#fffbeb', border: '1px solid #fcd34d',
              borderRadius: 'var(--radius)', padding: '14px 16px',
              fontSize: 13.5, color: '#92400e', lineHeight: 1.5,
            }}>
              <strong>What happens next?</strong><br />
              If a confirmed attendee cancels, you'll be automatically moved up the list.
              The event organizer will contact you at <strong>{email}</strong> if a spot becomes available.
              No payment is required until you're confirmed.
            </div>

            <div className="conf-actions" style={{ marginTop: 20 }}>
              <Link to={isVip ? `/${orgSlug}/vip` : `/${orgSlug}`} className="btn btn-outline btn-lg">
                Register Another Attendee
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Confirmed registration ────────────────────────────────────────────────
  const calTitle = eventName || 'Event';
  const calStart = eventStartDate || sessionDate;
  const calEnd   = eventEndDate;

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

          {/* ── Add to Calendar ──────────────────── */}
          {calStart && (
            <div className="conf-section">
              <div className="conf-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     width="14" height="14">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Add to Calendar
              </div>
              <div className="conf-cal-buttons">
                <a
                  href={buildGoogleCalUrl(calTitle, calStart, calEnd, eventLocation, `Registered by ${fullName}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn conf-cal-btn"
                >
                  {/* Google G logo */}
                  <svg viewBox="0 0 24 24" width="15" height="15" style={{ flexShrink: 0 }}>
                    <path fill="#4285F4" d="M21.805 10.023H12v3.977h5.617c-.242 1.242-1 2.297-2.117 3.008v2.508h3.43c2.008-1.852 3.164-4.578 3.164-7.781 0-.531-.047-1.047-.117-1.516z"/>
                    <path fill="#34A853" d="M12 22c2.797 0 5.141-.922 6.852-2.484l-3.43-2.508c-.953.641-2.172 1.016-3.422 1.016-2.633 0-4.867-1.781-5.664-4.172H2.758v2.594C4.461 19.898 8.02 22 12 22z"/>
                    <path fill="#FBBC05" d="M6.336 13.852A5.95 5.95 0 0 1 6 12c0-.648.117-1.273.336-1.852V7.554H2.758A9.96 9.96 0 0 0 2 12c0 1.617.387 3.148 1.074 4.508l3.262-2.656z"/>
                    <path fill="#EA4335" d="M12 6.172c1.484 0 2.812.512 3.859 1.508l2.898-2.898C16.953 3.219 14.805 2.25 12 2.25c-3.98 0-7.539 2.102-9.242 5.148l3.578 2.781C7.133 7.953 9.367 6.172 12 6.172z"/>
                  </svg>
                  Google Calendar
                </a>
                <button
                  className="btn conf-cal-btn"
                  onClick={() => downloadIcs(
                    calTitle, calStart, calEnd, eventLocation,
                    `${fullName.replace(/\s+/g, '-')}-event.ics`
                  )}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" width="14" height="14" style={{ flexShrink: 0 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Apple / Outlook
                </button>
              </div>
            </div>
          )}

          {/* ── Share ────────────────────────────── */}
          <div className="conf-section">
            <div className="conf-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   width="14" height="14">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share with Friends
            </div>
            <div className="conf-share-row">
              {/* WhatsApp */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`}
                target="_blank" rel="noopener noreferrer"
                className="conf-share-btn conf-share-wa"
                title="Share on WhatsApp"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                </svg>
              </a>
              {/* X / Twitter */}
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank" rel="noopener noreferrer"
                className="conf-share-btn conf-share-x"
                title="Share on X"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.75l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              {/* LinkedIn */}
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank" rel="noopener noreferrer"
                className="conf-share-btn conf-share-li"
                title="Share on LinkedIn"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
          </div>

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

            {/* ── Resend confirmation email ────── */}
            <button
              className="btn btn-outline btn-lg"
              onClick={handleResend}
              disabled={resendStatus === 'loading' || resendStatus === 'success'}
              style={resendStatus === 'success' ? { borderColor: '#16a34a', color: '#16a34a' } : {}}
            >
              {resendStatus === 'loading' ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, margin: 0 }} />
                  Sending…
                </>
              ) : resendStatus === 'success' ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                       width="14" height="14">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Email Sent!
                </>
              ) : resendStatus === 'error' ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                       width="14" height="14">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Retry Sending Email
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                       width="14" height="14">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Resend Confirmation Email
                </>
              )}
            </button>

            <Link to={isVip ? `/${orgSlug}/vip` : `/${orgSlug}`} className="btn btn-outline btn-lg">
              Register Another Attendee
            </Link>
          </div>

        </div>{/* end conf-body */}
      </div>{/* end conf-card */}
    </div>
  );
}
