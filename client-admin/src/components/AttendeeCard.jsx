/**
 * AttendeeCard — shared between Registrants drawer and Check-in page.
 *
 * Props:
 *   registrant  — full registrant object from API
 *   sessions    — array of event sessions (for name lookup), optional
 *   compact     — boolean; if true, hides timestamps section
 */

const QR_API = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&bgcolor=ffffff&color=1e293b&data=';

function qrSrc(code) {
  return `${QR_API}${encodeURIComponent(code || 'NO-CODE')}`;
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Status badges ────────────────────────────────────────────────────────────
export function CheckInBadge({ checkedIn }) {
  return checkedIn
    ? <span className="badge badge-green">✓ Checked In</span>
    : <span className="badge badge-gray">Not Checked In</span>;
}

export function PaymentBadge({ status }) {
  const map = {
    free:    { cls: 'badge-blue',   label: 'Free'    },
    paid:    { cls: 'badge-green',  label: 'Paid'    },
    pending: { cls: 'badge-yellow', label: 'Pending' },
  };
  const { cls, label } = map[status] || map.pending;
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function EventStatusBadge({ status }) {
  const map = {
    draft:     { cls: 'badge-gray',   label: 'Draft'     },
    published: { cls: 'badge-green',  label: 'Published' },
    closed:    { cls: 'badge-red',    label: 'Closed'    },
  };
  const { cls, label } = map[status] || map.draft;
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ─── Optional field (suppressed if empty) ────────────────────────────────────
function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="ac-field">
      <div className="ac-field-label">{label}</div>
      <div className="ac-field-value">{value}</div>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────
export default function AttendeeCard({ registrant: r, sessions = [], compact = false }) {
  if (!r) return null;

  const sessionName = (() => {
    if (!r.sessionId) return null;
    const s = sessions.find((x) => x._id?.toString() === r.sessionId?.toString());
    return s?.name || null;
  })();

  const hasDetails =
    r.phone || r.country || r.title || r.hearAbout;

  return (
    <div>
      {/* ── Name & status ─────────────────────────── */}
      <div className="ac-name">{r.firstName} {r.lastName}</div>
      <div className="ac-email">{r.email}</div>
      <div className="ac-badges">
        <CheckInBadge checkedIn={r.checkedIn} />
        <PaymentBadge status={r.paymentStatus} />
        {sessionName && <span className="badge badge-purple">{sessionName}</span>}
      </div>

      <hr className="ac-divider" />

      {/* ── QR code ───────────────────────────────── */}
      <div className="ac-section-title">QR Code</div>
      <div className="ac-qr-block">
        <img
          src={qrSrc(r.qrCode)}
          alt={`QR: ${r.qrCode}`}
          loading="lazy"
          onError={(e) => { e.target.style.opacity = 0.3; }}
        />
        <span className="ac-qr-code">{r.qrCode}</span>
      </div>

      {/* ── Details grid ──────────────────────────── */}
      {hasDetails && (
        <>
          <hr className="ac-divider" />
          <div className="ac-section-title">Details</div>
          <div className="ac-field-grid">
            <Field label="Phone"             value={r.phone}            />
            <Field label="Country"           value={r.country}          />
            <Field label="Title"             value={r.title}            />
            <Field label="Hear About"        value={r.hearAbout}        />
          </div>
        </>
      )}

      {/* ── Timestamps ────────────────────────────── */}
      {!compact && (
        <>
          <hr className="ac-divider" />
          <div className="ac-section-title">Timestamps</div>
          <div className="ac-ts-row">
            <div className="ac-ts-item">
              <strong>Registered:</strong> {fmt(r.createdAt)}
            </div>
            {r.checkedIn && (
              <div className="ac-ts-item">
                <strong>Checked In:</strong> {fmt(r.checkedInAt)}
              </div>
            )}
            {r.checkedOut && (
              <div className="ac-ts-item">
                <strong>Checked Out:</strong> {fmt(r.checkedOutAt)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
