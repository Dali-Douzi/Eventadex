import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';

// ─── Variable token chips ─────────────────────────────────────────────────────
const VARS = [
  { token: '{{firstName}}', label: 'First name' },
  { token: '{{lastName}}',  label: 'Last name'  },
  { token: '{{eventName}}', label: 'Event name' },
];

// ─── Audience options ─────────────────────────────────────────────────────────
const AUDIENCE_OPTIONS = [
  { value: 'all',          label: 'All Registrants'      },
  { value: 'standard',     label: 'Standard Only'        },
  { value: 'vip',          label: 'VIP Only'             },
  { value: 'checkedIn',    label: 'Checked In'           },
  { value: 'notCheckedIn', label: 'Not Yet Checked In'   },
];

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       width="18" height="18"
       style={{ animation: 'spin 0.9s linear infinite', display: 'block' }}>
    <circle cx="12" cy="12" r="10" strokeOpacity=".2"/>
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
  </svg>
);

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Announcements() {
  // ── Form state
  const [audience,   setAudience]   = useState('all');
  const [sessionId,  setSessionId]  = useState('');
  const [subject,    setSubject]    = useState('');
  const [body,       setBody]       = useState('');

  // ── Preview state
  const [preview,        setPreview]        = useState(null);   // { total, standard, vip }
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Send state
  const [phase,  setPhase]  = useState('compose'); // compose | confirm | sending | done
  const [result, setResult] = useState(null);       // { sent, failed, total }
  const [error,  setError]  = useState('');

  // ── Event sessions
  const [sessions, setSessions] = useState([]);

  const debounceRef = useRef(null);
  const bodyRef     = useRef(null);

  // ── Load sessions on mount ────────────────────────────────────────────────
  useEffect(() => {
    api.get('/api/admin/event')
      .then(({ data }) => setSessions(data.sessions || []))
      .catch(() => {});
  }, []);

  // ── Debounced recipient preview ────────────────────────────────────────────
  const fetchPreview = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const params = new URLSearchParams({ audience });
        if (sessionId) params.set('sessionId', sessionId);
        const { data } = await api.get(`/api/admin/announcements/preview?${params}`);
        setPreview(data);
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 350);
  }, [audience, sessionId]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  // ── Insert variable token at cursor ───────────────────────────────────────
  function insertToken(token, target) {
    if (target === 'subject') {
      setSubject((prev) => prev + token);
    } else {
      const el = bodyRef.current;
      if (!el) { setBody((prev) => prev + token); return; }
      const start = el.selectionStart;
      const end   = el.selectionEnd;
      const next  = body.slice(0, start) + token + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    setPhase('sending');
    setError('');
    try {
      const params = { subject, body, audience };
      if (sessionId) params.sessionId = sessionId;
      const { data } = await api.post('/api/admin/announcements/send', params);
      setResult(data);
      setPhase('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send announcement. Please try again.');
      setPhase('compose');
    }
  }

  function handleReset() {
    setPhase('compose');
    setSubject('');
    setBody('');
    setAudience('all');
    setSessionId('');
    setResult(null);
    setError('');
  }

  // ─── Render phases ─────────────────────────────────────────────────────────

  // Done
  if (phase === 'done' && result) {
    return (
      <div className="ann-wrapper">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div className="ann-card ann-done-card">
          <div className="ann-done-icon">✅</div>
          <h2 className="ann-done-title">Announcement sent!</h2>
          <div className="ann-done-stats">
            <div className="ann-done-stat">
              <span className="ann-done-stat-value">{result.sent}</span>
              <span className="ann-done-stat-label">Delivered</span>
            </div>
            {result.failed > 0 && (
              <div className="ann-done-stat">
                <span className="ann-done-stat-value ann-done-failed">{result.failed}</span>
                <span className="ann-done-stat-label">Failed</span>
              </div>
            )}
            <div className="ann-done-stat">
              <span className="ann-done-stat-value">{result.total}</span>
              <span className="ann-done-stat-label">Total</span>
            </div>
          </div>
          <button className="ann-btn-primary" onClick={handleReset}>
            Send Another
          </button>
        </div>
      </div>
    );
  }

  // Sending
  if (phase === 'sending') {
    return (
      <div className="ann-wrapper">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div className="ann-card ann-sending-card">
          <div className="ann-sending-spinner"><Spinner /></div>
          <p className="ann-sending-text">
            Sending to {preview?.total ?? '…'} recipient{(preview?.total ?? 0) !== 1 ? 's' : ''}…
          </p>
          <p className="ann-sending-sub">This may take a moment. Please don't close this tab.</p>
        </div>
      </div>
    );
  }

  // Confirm
  if (phase === 'confirm') {
    return (
      <div className="ann-wrapper">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div className="ann-card">
          <h2 className="ann-section-title" style={{ marginBottom: 4 }}>Confirm Send</h2>
          <p style={{ fontSize: 13, color: 'var(--text-medium)', marginBottom: 24 }}>
            Review the details below before sending.
          </p>

          <div className="ann-confirm-row">
            <span className="ann-confirm-label">To</span>
            <span className="ann-confirm-value">
              {preview
                ? <strong>{preview.total} recipient{preview.total !== 1 ? 's' : ''}</strong>
                : '—'}
              {preview && preview.total > 0 && (
                <span className="ann-confirm-breakdown">
                  {audience === 'all'
                    ? ` (${preview.standard} standard · ${preview.vip} VIP)`
                    : audience === 'vip'
                    ? ` (VIP)`
                    : audience === 'standard'
                    ? ` (Standard)`
                    : audience === 'checkedIn'
                    ? ` (Checked in)`
                    : ` (Not checked in)`}
                </span>
              )}
            </span>
          </div>

          <div className="ann-confirm-row">
            <span className="ann-confirm-label">Subject</span>
            <span className="ann-confirm-value">{subject}</span>
          </div>

          <div className="ann-confirm-row ann-confirm-body-row">
            <span className="ann-confirm-label">Body</span>
            <span className="ann-confirm-value ann-confirm-body">{body}</span>
          </div>

          {preview?.total === 0 && (
            <div className="ann-warn-box" style={{ marginBottom: 16 }}>
              No recipients match the selected audience. The email will not be sent.
            </div>
          )}

          <div className="ann-confirm-actions">
            <button className="ann-btn-outline" onClick={() => setPhase('compose')}>
              ← Edit
            </button>
            <button
              className="ann-btn-primary"
              onClick={handleSend}
              disabled={!preview || preview.total === 0}
            >
              Send Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compose (default)
  const canSubmit = subject.trim() && body.trim() && preview && preview.total > 0;

  return (
    <div className="ann-wrapper">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <div className="ann-hero">
        <h1>Announcements</h1>
        <p>Send a custom email to your registrants — schedule changes, reminders, and more.</p>
      </div>

      {/* ── Audience card ──────────────────────────────────────── */}
      <div className="ann-card">
        <h2 className="ann-section-title">Audience</h2>

        <div className="ann-row">
          <div className="ann-field">
            <label className="ann-label">Recipients</label>
            <select
              className="ann-select"
              value={audience}
              onChange={(e) => { setAudience(e.target.value); setSessionId(''); }}
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {sessions.length > 0 && audience !== 'vip' && (
            <div className="ann-field">
              <label className="ann-label">Filter by session</label>
              <select
                className="ann-select"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              >
                <option value="">All sessions</option>
                {sessions.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Recipient count pill */}
        <div className="ann-preview-pill">
          {previewLoading ? (
            <span className="ann-preview-loading"><Spinner />&nbsp;Counting…</span>
          ) : preview ? (
            preview.total === 0 ? (
              <span className="ann-preview-zero">No recipients found for this selection</span>
            ) : (
              <span className="ann-preview-count">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     width="14" height="14" style={{ marginRight: 5, flexShrink: 0 }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <strong>{preview.total}</strong>&nbsp;recipient{preview.total !== 1 ? 's' : ''}
                {audience === 'all' && preview.total > 0 && (
                  <span className="ann-preview-breakdown">
                    &nbsp;·&nbsp;{preview.standard} standard, {preview.vip} VIP
                  </span>
                )}
              </span>
            )
          ) : null}
        </div>
      </div>

      {/* ── Message card ───────────────────────────────────────── */}
      <div className="ann-card">
        <h2 className="ann-section-title">Message</h2>

        {/* Subject */}
        <div className="ann-field" style={{ marginBottom: 18 }}>
          <div className="ann-label-row">
            <label className="ann-label">Subject</label>
            <div className="ann-var-chips">
              {VARS.map((v) => (
                <button key={v.token} className="ann-var-chip"
                        onClick={() => insertToken(v.token, 'subject')}
                        type="button" title={`Insert ${v.token}`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <input
            className="ann-input"
            type="text"
            placeholder="e.g. Important update about {{eventName}}"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        {/* Body */}
        <div className="ann-field">
          <div className="ann-label-row">
            <label className="ann-label">Body</label>
            <div className="ann-var-chips">
              {VARS.map((v) => (
                <button key={v.token} className="ann-var-chip"
                        onClick={() => insertToken(v.token, 'body')}
                        type="button" title={`Insert ${v.token}`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            ref={bodyRef}
            className="ann-textarea"
            placeholder={`Hi {{firstName}},\n\nWe wanted to let you know…`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
          />
          <p className="ann-hint">
            Supports basic HTML. Variables above are substituted per recipient.
            The email will use your organisation's configured header and footer branding.
          </p>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && (
        <div className="ann-error-box">{error}</div>
      )}

      {/* ── Send button ────────────────────────────────────────── */}
      <div className="ann-actions">
        <button
          className="ann-btn-primary ann-btn-lg"
          disabled={!canSubmit}
          onClick={() => { setError(''); setPhase('confirm'); }}
        >
          Preview &amp; Send
          {preview && preview.total > 0 && (
            <span className="ann-btn-count"> · {preview.total}</span>
          )}
        </button>
        {!canSubmit && (
          <p className="ann-actions-hint">
            {!subject.trim()
              ? 'Enter a subject to continue'
              : !body.trim()
              ? 'Enter a message body to continue'
              : preview?.total === 0
              ? 'No recipients match the current selection'
              : 'Loading recipient count…'}
          </p>
        )}
      </div>
    </div>
  );
}
