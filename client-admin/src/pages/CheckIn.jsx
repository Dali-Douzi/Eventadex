import { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import api from '../api/axios';
import AttendeeCard from '../components/AttendeeCard';
import { useToast } from '../context/ToastContext';

// ─── QR Camera Scanner Modal ──────────────────────────────────────────────────
function QrScanModal({ onScan, onClose }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const rafRef      = useRef(null);
  const detectedRef = useRef(false);  // prevent double-fire

  const [camError, setCamError] = useState('');
  const [ready,    setReady]    = useState(false);

  // Stop camera + animation loop
  const stopCamera = useCallback(() => {
    if (rafRef.current)    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  // Main scan loop — runs every animation frame
  const scanFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imgData.data, imgData.width, imgData.height, {
      inversionAttempts: 'dontInvert',
    });
    if (code && code.data && !detectedRef.current) {
      detectedRef.current = true;
      stopCamera();
      onScan(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [onScan, stopCamera]);

  // Start camera on mount
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setReady(true);
            rafRef.current = requestAnimationFrame(scanFrame);
          };
        }
      } catch (err) {
        const msg = err.name === 'NotAllowedError'
          ? 'Camera access denied. Allow camera permission and try again.'
          : err.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : 'Could not open camera.';
        setCamError(msg);
      }
    }
    startCamera();
    return stopCamera;
  }, [scanFrame, stopCamera]);

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>

        {/* Close */}
        <button className="qr-modal-close" onClick={onClose} aria-label="Close scanner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {camError ? (
          <div className="qr-cam-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" width="36" height="36">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <line x1="12" y1="11" x2="12" y2="15"/><circle cx="12" cy="17.5" r="0.5" fill="#dc2626"/>
            </svg>
            <p>{camError}</p>
            <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            {/* Video feed */}
            <video
              ref={videoRef}
              className="qr-cam-video"
              playsInline
              muted
              autoPlay
            />

            {/* Hidden canvas for frame processing */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Scan frame overlay */}
            <div className="qr-scan-frame">
              <div className="qr-corner qr-corner-tl" />
              <div className="qr-corner qr-corner-tr" />
              <div className="qr-corner qr-corner-bl" />
              <div className="qr-corner qr-corner-br" />
              {ready && <div className="qr-scan-line" />}
            </div>

            <p className="qr-scan-hint">
              {ready ? 'Point at QR code to scan' : 'Starting camera…'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

// ─── Main component ───────────────────────────────────────────────────────────
export default function CheckIn() {
  const toast = useToast();
  const [query,       setQuery]     = useState('');
  const [status,      setStatus]    = useState('idle');   // idle|searching|found|not-found|error
  const [registrant,  setReg]       = useState(null);
  const [sessions,    setSessions]  = useState([]);
  const [actionState, setAction]    = useState('');       // ''|'in'|'out'
  const [successMsg,  setSuccMsg]   = useState('');
  const [scanning,    setScanning]  = useState(false);
  const inputRef = useRef(null);

  // Auto-focus + load sessions
  useEffect(() => {
    inputRef.current?.focus();
    api.get('/api/admin/event')
      .then(({ data }) => setSessions(data.sessions || []))
      .catch(() => {});
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────────
  async function runSearch(q) {
    const trimmed = q.trim();
    if (!trimmed) return;

    setStatus('searching');
    setReg(null);
    setSuccMsg('');
    setQuery(trimmed);

    try {
      const { data } = await api.get(`/api/admin/registrants/search?q=${encodeURIComponent(trimmed)}`);
      setReg(data);
      setStatus('found');
    } catch (err) {
      if (err.response?.status === 404) {
        try {
          const { data } = await api.get(`/api/admin/vip-registrants/search?q=${encodeURIComponent(trimmed)}`);
          setReg({ ...data, _isVip: true });
          setStatus('found');
        } catch (vipErr) {
          setStatus(vipErr.response?.status === 404 ? 'not-found' : 'error');
        }
      } else {
        setStatus('error');
      }
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    runSearch(query);
  }

  // Called by QR scanner modal — auto-searches the decoded value
  function handleQrScanned(text) {
    setScanning(false);
    runSearch(text);
  }

  // ── Check In ───────────────────────────────────────────────────────────────
  async function handleCheckIn() {
    setAction('in');
    const ep = registrant._isVip
      ? `/api/admin/vip-registrants/${registrant._id}/checkin`
      : `/api/admin/registrants/${registrant._id}/checkin`;
    try {
      const { data } = await api.patch(ep);
      setReg((prev) => ({ ...data, _isVip: prev._isVip }));
      setSuccMsg(`✓ ${data.firstName} ${data.lastName} checked in successfully.`);
    } catch (err) {
      toast(err.response?.data?.message || 'Check-in failed', 'error');
    } finally {
      setAction('');
    }
  }

  // ── Check Out ──────────────────────────────────────────────────────────────
  async function handleCheckOut() {
    setAction('out');
    const ep = registrant._isVip
      ? `/api/admin/vip-registrants/${registrant._id}/checkout`
      : `/api/admin/registrants/${registrant._id}/checkout`;
    try {
      const { data } = await api.patch(ep);
      setReg((prev) => ({ ...data, _isVip: prev._isVip }));
      setSuccMsg(`${data.firstName} ${data.lastName} checked out.`);
    } catch (err) {
      toast(err.response?.data?.message || 'Check-out failed', 'error');
    } finally {
      setAction('');
    }
  }

  // ── Clear ──────────────────────────────────────────────────────────────────
  function handleClear() {
    setQuery('');
    setStatus('idle');
    setReg(null);
    setSuccMsg('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const sessionName = (() => {
    if (!registrant?.sessionId) return null;
    const s = sessions.find(
      (x) => x._id === registrant.sessionId || x._id?.toString() === registrant.sessionId?.toString()
    );
    return s?.name || null;
  })();

  return (
    <>
      {/* Camera scanner modal */}
      {scanning && (
        <QrScanModal
          onScan={handleQrScanned}
          onClose={() => setScanning(false)}
        />
      )}

      <div className="checkin-wrapper">

        {/* ── Hero ── */}
        <div className="checkin-hero">
          <h1>Venue Check-in</h1>
          <p>Scan attendee QR codes or search by email to check in.</p>
        </div>

        {/* ── Scan + Search card ── */}
        <div className="checkin-search-card">
          {/* Primary camera scan button */}
          <button className="checkin-scan-btn" onClick={() => setScanning(true)}>
            <CameraIcon />
            Scan QR Code
          </button>

          <div className="checkin-divider"><span>or search manually</span></div>

          {/* Manual text search */}
          <form onSubmit={handleSearch}>
            <div className="checkin-input-wrap">
              <SearchIcon />
              <input
                ref={inputRef}
                className="checkin-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type email or paste QR code…"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck="false"
              />
              {query && (
                <button type="button" className="checkin-input-clear" onClick={() => setQuery('')}
                  aria-label="Clear">×</button>
              )}
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }}
              disabled={!query.trim() || status === 'searching'}>
              {status === 'searching' ? 'Searching…' : 'Search'}
            </button>
          </form>
        </div>

        {/* ── States ── */}
        {status === 'searching' && (
          <div className="checkin-loading">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" width="32" height="32"
              style={{ margin: '0 auto 12px', display: 'block', animation: 'spin 0.9s linear infinite' }}>
              <circle cx="12" cy="12" r="10" strokeOpacity=".2"/>
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
            </svg>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Looking up registrant…
          </div>
        )}

        {status === 'not-found' && (
          <div className="checkin-not-found">
            <div className="checkin-error-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="24" height="24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            <p style={{ fontWeight: 600, color: 'var(--text-dark)', marginBottom: 6 }}>No registrant found</p>
            <p style={{ fontSize: 13, color: 'var(--text-medium)', marginBottom: 20 }}>
              No match for <strong>"{query}"</strong>
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={() => setScanning(true)}>
                <CameraIcon /> Scan Again
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleClear}>Clear</button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="checkin-not-found">
            <div className="checkin-error-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="24" height="24">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <p style={{ fontWeight: 600, color: 'var(--text-dark)', marginBottom: 6 }}>Server error</p>
            <p style={{ fontSize: 13, color: 'var(--text-medium)', marginBottom: 18 }}>
              Could not complete the search. Try again in a moment.
            </p>
            <button className="btn btn-outline btn-sm" onClick={handleClear}>Try Again</button>
          </div>
        )}

        {status === 'found' && registrant && (
          <div className="checkin-result">

            {/* Status bar */}
            <div className="checkin-status-bar">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {registrant.checkedIn && registrant.checkedOut
                  ? <span className="checkin-badge checkin-badge-out">Checked out</span>
                  : registrant.checkedIn
                  ? <span className="checkin-badge checkin-badge-in">✓ Checked in</span>
                  : <span className="checkin-badge checkin-badge-pending">Not checked in</span>
                }
                {registrant._isVip && <span className="badge-vip">VIP</span>}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={handleClear}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"
                  style={{ marginRight: 4 }}>
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back
              </button>
            </div>

            <div className="checkin-result-body">
              {/* Success banner */}
              {successMsg && (
                <div className="checkin-success-banner">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {successMsg}
                </div>
              )}

              {/* Attendee card */}
              <AttendeeCard registrant={registrant} sessions={sessions} compact />

              {/* Session */}
              {sessionName && (
                <p style={{ fontSize: 13, color: 'var(--text-medium)', marginTop: 10 }}>
                  Session: <strong>{sessionName}</strong>
                </p>
              )}

              {/* Action buttons */}
              <div className="checkin-actions">
                {!registrant.checkedIn && (
                  <button className="btn-checkin-in" onClick={handleCheckIn} disabled={actionState === 'in'}>
                    {actionState === 'in' ? (
                      'Checking In…'
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          width="18" height="18" style={{ marginRight: 7 }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Check In
                      </>
                    )}
                  </button>
                )}

                {registrant.checkedIn && !registrant.checkedOut && (
                  <button className="btn-checkin-out" onClick={handleCheckOut} disabled={actionState === 'out'}>
                    {actionState === 'out' ? (
                      'Checking Out…'
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          width="18" height="18" style={{ marginRight: 7 }}>
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                          <polyline points="16 17 21 12 16 7"/>
                          <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Check Out
                      </>
                    )}
                  </button>
                )}

                {registrant.checkedIn && registrant.checkedOut && (
                  <div className="checkin-already-out">
                    Already checked out
                  </div>
                )}

                {/* Scan next */}
                <button className="btn-checkin-next" onClick={() => { handleClear(); setScanning(true); }}>
                  <CameraIcon />
                  Scan Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
