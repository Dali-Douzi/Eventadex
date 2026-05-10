import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import AttendeeCard from '../components/AttendeeCard';
import { BadgePrintView, DEFAULT_BADGE_CONFIG } from '../components/BadgePrintView';
import { useToast } from '../context/ToastContext';

// ─── SVG icons ────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       width="22" height="22">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"
       width="28" height="28"
       style={{ margin: '0 auto 10px', display: 'block', animation: 'spin 0.9s linear infinite' }}>
    <circle cx="12" cy="12" r="10" strokeOpacity=".22"/>
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
       width="16" height="16" style={{ marginRight: 6 }}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const CheckOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
       width="16" height="16" style={{ marginRight: 6 }}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const PrintIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       width="16" height="16" style={{ marginRight: 6 }}>
    <polyline points="6 9 6 2 18 2 18 9"/>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
       width="13" height="13" style={{ marginRight: 4 }}>
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PrintCards() {
  const toast = useToast();
  const [query,       setQuery]      = useState('');
  const [status,      setStatus]     = useState('idle'); // idle|searching|found|not-found|error
  const [registrant,  setReg]        = useState(null);
  const [sessions,    setSessions]   = useState([]);
  const [actionState, setAction]     = useState('');     // ''|'in'|'out'
  const [successMsg,  setSuccMsg]    = useState('');
  const [badgeConfig, setBadgeCfg]   = useState(DEFAULT_BADGE_CONFIG);
  const inputRef                     = useRef(null);

  // Auto-focus + load event sessions + badge config on mount
  useEffect(() => {
    inputRef.current?.focus();
    api.get('/api/admin/event')
      .then(({ data }) => setSessions(data.sessions || []))
      .catch(() => {});
    api.get('/api/admin/badge-config')
      .then(({ data }) => {
        setBadgeCfg({
          ...DEFAULT_BADGE_CONFIG,
          ...data,
          fields: data.fields?.length ? data.fields : DEFAULT_BADGE_CONFIG.fields,
        });
      })
      .catch(() => {});
  }, []);

  // ── Search ─────────────────────────────────────────────────
  async function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setStatus('searching');
    setReg(null);
    setSuccMsg('');

    try {
      const { data } = await api.get(
        `/api/admin/registrants/search?q=${encodeURIComponent(q)}`
      );
      setReg(data);
      if (data.badgeConfig) {
        setBadgeCfg({
          ...DEFAULT_BADGE_CONFIG,
          ...data.badgeConfig,
          fields: data.badgeConfig.fields?.length ? data.badgeConfig.fields : DEFAULT_BADGE_CONFIG.fields,
        });
      }
      setStatus('found');
    } catch (err) {
      if (err.response?.status === 404) {
        // Fallback: search VIP registrants
        try {
          const { data } = await api.get(
            `/api/admin/vip-registrants/search?q=${encodeURIComponent(q)}`
          );
          setReg({ ...data, _isVip: true });
          if (data.badgeConfig) {
            setBadgeCfg({
              ...DEFAULT_BADGE_CONFIG,
              ...data.badgeConfig,
              fields: data.badgeConfig.fields?.length ? data.badgeConfig.fields : DEFAULT_BADGE_CONFIG.fields,
            });
          }
          setStatus('found');
        } catch (vipErr) {
          setStatus(vipErr.response?.status === 404 ? 'not-found' : 'error');
        }
      } else {
        setStatus('error');
      }
    }
  }

  // ── Check In ───────────────────────────────────────────────
  async function handleCheckIn() {
    setAction('in');
    const endpoint = registrant._isVip
      ? `/api/admin/vip-registrants/${registrant._id}/checkin`
      : `/api/admin/registrants/${registrant._id}/checkin`;
    try {
      const { data } = await api.patch(endpoint);
      setReg((prev) => ({
        ...data,
        _isVip:      prev._isVip,
        eventName:   prev.eventName,
        sessionName: prev.sessionName,
        sessionDate: prev.sessionDate,
        logoUrl:     prev.logoUrl,
      }));
      setSuccMsg(`${data.firstName} ${data.lastName} checked in successfully.`);
    } catch (err) {
      toast(err.response?.data?.message || 'Check-in failed', 'error');
    } finally {
      setAction('');
    }
  }

  // ── Check Out ──────────────────────────────────────────────
  async function handleCheckOut() {
    setAction('out');
    const endpoint = registrant._isVip
      ? `/api/admin/vip-registrants/${registrant._id}/checkout`
      : `/api/admin/registrants/${registrant._id}/checkout`;
    try {
      const { data } = await api.patch(endpoint);
      setReg((prev) => ({
        ...data,
        _isVip:      prev._isVip,
        eventName:   prev.eventName,
        sessionName: prev.sessionName,
        sessionDate: prev.sessionDate,
        logoUrl:     prev.logoUrl,
      }));
      setSuccMsg(`${data.firstName} ${data.lastName} checked out successfully.`);
    } catch (err) {
      toast(err.response?.data?.message || 'Check-out failed', 'error');
    } finally {
      setAction('');
    }
  }

  // ── Print ──────────────────────────────────────────────────
  function handlePrint() {
    // Dynamically inject the @page size matching the configured badge dimensions
    const w = badgeConfig?.width  || 85;
    const h = badgeConfig?.height || 54;
    let styleEl = document.getElementById('bp-page-size');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'bp-page-size';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@media print { @page { size: ${w}mm ${h}mm; margin: 0; } }`;
    window.print();
  }

  // ── Clear / reset ──────────────────────────────────────────
  function handleClear() {
    setQuery('');
    setStatus('idle');
    setReg(null);
    setSuccMsg('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // ─────────────────────────────────────────────────────────
  return (
    <div className="pc-wrapper">

      {/* ── Page title ───────────────────────────── */}
      <div className="pc-hero">
        <h1>Print Badges</h1>
        <p>Scan a QR code or enter an email address to find an attendee and print their badge.</p>
      </div>

      {/* ── Search bar ──────────────────────────── */}
      <div className="pc-search-card">
        <form onSubmit={handleSearch}>
          <div className="pc-input-wrap">
            <SearchIcon />
            <input
              ref={inputRef}
              className="pc-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Scan QR code or type email…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
            />
            <button
              type="submit"
              className="pc-search-btn"
              disabled={status === 'searching'}
            >
              {status === 'searching' ? 'Searching…' : 'Search'}
            </button>
          </div>
          <p className="pc-hint">
            Press <kbd>Enter</kbd> to search · QR scanners auto-submit on scan
          </p>
        </form>
      </div>

      {/* ── Loading ─────────────────────────────── */}
      {status === 'searching' && (
        <div className="pc-state-card">
          <SpinnerIcon />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ color: 'var(--text-medium)', fontSize: 14 }}>Searching…</span>
        </div>
      )}

      {/* ── Not found ───────────────────────────── */}
      {status === 'not-found' && (
        <div className="pc-state-card pc-state-error">
          <div className="pc-error-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" width="24" height="24">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
          <p style={{ fontWeight: 600, color: 'var(--text-dark)', marginBottom: 6 }}>
            Attendee not found
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-medium)', marginBottom: 20 }}>
            No match for <strong>"{query}"</strong>. Check the QR code or email and try again.
          </p>
          <button className="btn btn-outline" onClick={handleClear}>
            Try Again
          </button>
        </div>
      )}

      {/* ── Server error ────────────────────────── */}
      {status === 'error' && (
        <div className="pc-state-card pc-state-error">
          <div className="pc-error-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" width="24" height="24">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p style={{ fontWeight: 600, color: 'var(--text-dark)', marginBottom: 6 }}>
            Server error
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-medium)', marginBottom: 20 }}>
            Could not complete the search. Try again in a moment.
          </p>
          <button className="btn btn-outline" onClick={handleClear}>
            Try Again
          </button>
        </div>
      )}

      {/* ── Found ───────────────────────────────── */}
      {status === 'found' && registrant && (
        <div className="pc-result">

          {/* Status bar */}
          <div className="pc-status-bar">
            <span style={{ fontSize: 13, color: 'var(--text-medium)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {registrant.checkedIn && registrant.checkedOut
                ? '⚪ Checked out'
                : registrant.checkedIn
                  ? '🟢 Currently checked in'
                  : '⚪ Not yet checked in'}
              {registrant._isVip && <span className="badge-vip">VIP</span>}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handleClear}>
              <BackIcon />
              Clear
            </button>
          </div>

          <div className="pc-result-body">

            {/* Success message */}
            {successMsg && (
              <div className="alert alert-success" style={{ marginBottom: 16 }}>
                {successMsg}
              </div>
            )}

            {/* Attendee card */}
            <AttendeeCard registrant={registrant} sessions={sessions} compact />

            {/* Badge screen preview */}
            <div className="pc-badge-preview-wrap">
              <p className="pc-badge-preview-label">Badge Preview</p>
              <div className="pc-badge-preview-inner">
                <BadgePrintView
                  registrant={registrant}
                  config={badgeConfig}
                  preview={true}
                  previewWidth={280}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="pc-actions">

              {/* Check In */}
              <button
                className="btn-pc-checkin"
                onClick={handleCheckIn}
                disabled={registrant.checkedIn || actionState === 'in'}
                title={registrant.checkedIn ? 'Already checked in' : 'Check in this attendee'}
              >
                {actionState === 'in'
                  ? 'Checking In…'
                  : <><CheckIcon />Check In</>
                }
              </button>

              {/* Check Out */}
              <button
                className="btn-pc-checkout"
                onClick={handleCheckOut}
                disabled={!registrant.checkedIn || registrant.checkedOut || actionState === 'out'}
                title={
                  !registrant.checkedIn   ? 'Not checked in yet'
                  : registrant.checkedOut ? 'Already checked out'
                  : 'Check out this attendee'
                }
              >
                {actionState === 'out'
                  ? 'Checking Out…'
                  : <><CheckOutIcon />Check Out</>
                }
              </button>

              {/* Print Badge */}
              <button
                className="btn-pc-print"
                onClick={handlePrint}
                title="Print attendee badge"
              >
                <PrintIcon />
                Print Badge
              </button>

              {/* Clear */}
              <button
                className="btn btn-outline pc-clear-btn"
                onClick={handleClear}
              >
                Clear
              </button>

            </div>
          </div>
        </div>
      )}

      {/* ── Print-only badge (hidden on screen, shown when printing) ── */}
      {registrant && (
        <div className="badge-print">
          <BadgePrintView
            registrant={registrant}
            config={badgeConfig}
            preview={false}
          />
        </div>
      )}

    </div>
  );
}
