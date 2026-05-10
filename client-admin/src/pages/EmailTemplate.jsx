import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { assetUrl } from '../utils/assetUrl';

// ─── Available template variables ────────────────────────────────────────────
const VARIABLES = [
  { token: '{{firstName}}',   desc: 'Registrant first name'  },
  { token: '{{lastName}}',    desc: 'Registrant last name'   },
  { token: '{{eventName}}',   desc: 'Event name'             },
  { token: '{{sessionName}}', desc: 'Session name'           },
  { token: '{{sessionDate}}', desc: 'Session date'           },
  { token: '{{qrCode}}',      desc: 'QR code image (inline)' },
];

// ─── Variable substitution (preview only) ────────────────────────────────────
function substituteVars(text, eventName) {
  if (!text) return '';
  return text
    .replace(/\{\{firstName\}\}/g,   'John')
    .replace(/\{\{lastName\}\}/g,    'Doe')
    .replace(/\{\{eventName\}\}/g,   eventName || 'Your Event')
    .replace(/\{\{sessionName\}\}/g, 'Morning Keynote')
    .replace(/\{\{sessionDate\}\}/g, 'June 15, 2026')
    .replace(/\{\{qrCode\}\}/g,      '');
}

// ─── QR placeholder ───────────────────────────────────────────────────────────
function QRPlaceholder() {
  return (
    <div className="et-qr-block">
      <div className="et-qr-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" width="36" height="36">
          <rect x="3"  y="3"  width="7" height="7" rx="1"/>
          <rect x="14" y="3"  width="7" height="7" rx="1"/>
          <rect x="3"  y="14" width="7" height="7" rx="1"/>
          <path d="M14 14h2v2h-2zM18 14h3M14 18h2M18 18h3v3M18 21h3"/>
        </svg>
      </div>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>QR code appears here</span>
    </div>
  );
}

// ─── Live email preview ───────────────────────────────────────────────────────
function EmailPreview({ tmpl, images, pageLogoUrl, eventName }) {
  const { logoUrl, headerImageUrl, footerImageUrl } = images;
  // Use the email-specific logo if uploaded, otherwise fall back to the page logo
  const effectiveLogo  = logoUrl || pageLogoUrl;
  const logoSrc        = assetUrl(effectiveLogo)  || null;
  const headerImageSrc = assetUrl(headerImageUrl) || null;
  const footerImageSrc = assetUrl(footerImageUrl) || null;

  // Logo size style (mirrors buildEmailHtml logic)
  const logoImgStyle = tmpl.logoFit === 'fill'
    ? { display: 'block', width: '100%', height: 'auto', objectFit: 'contain', maxWidth: 'none' }
    : tmpl.logoFit === 'max'
    ? { display: 'block', width: '100%', objectFit: 'fill', maxWidth: 'none' }
    : {
        display: 'block',
        ...(tmpl.logoWidth  != null ? { width: `${tmpl.logoWidth}%` }    : { maxWidth: '180px' }),
        ...(tmpl.logoHeight != null ? { height: `${tmpl.logoHeight}px` } : { height: '48px' }),
        objectFit: 'contain',
      };

  const hdrH = tmpl.headerImageHeight ?? 200;
  const hdrImgStyle = {
    display: 'block', width: '100%',
    height: `${hdrH}px`,
    objectFit: tmpl.headerImageFit === 'fill' ? 'contain' : tmpl.headerImageFit === 'max' ? 'fill' : 'cover',
  };

  const ftrH = tmpl.footerImageHeight ?? 120;
  const ftrImgStyle = {
    display: 'block', width: '100%',
    height: `${ftrH}px`,
    objectFit: tmpl.footerImageFit === 'fill' ? 'contain' : tmpl.footerImageFit === 'max' ? 'fill' : 'cover',
  };

  const btnColor    = tmpl.buttonColor || '#2563eb';
  const subjectText = substituteVars(tmpl.subject, eventName);
  const headerText  = substituteVars(tmpl.headerText, eventName);
  const bodyText    = substituteVars(tmpl.bodyText, eventName);
  const btnLabel    = tmpl.buttonLabel || 'View My Ticket';
  const footerText  = substituteVars(tmpl.footerText, eventName);
  const showQr      = tmpl.bodyText?.includes('{{qrCode}}') || tmpl.showQr;
  const placement   = tmpl.logoPlacement || 'left';
  const hdrPad      = tmpl.headerPadding ?? 28;
  const ftrPad      = tmpl.footerImagePadding ?? 0;

  // ── Merged header band ────────────────────────────────────────────────────
  const hasHeaderContent = !!(tmpl.headerText || logoSrc);

  function renderHeaderBand() {
    if (!hasHeaderContent) return null;
    const bandStyle = { backgroundColor: btnColor, padding: `${hdrPad}px 36px` };

    if (!logoSrc) {
      return (
        <div className="et-email-header-block" style={bandStyle}>
          {headerText
            ? <h2 style={{ margin: 0, color: '#fff' }}>{headerText}</h2>
            : <h2 style={{ margin: 0, color: '#fff', opacity: 0.3 }}>Header text…</h2>
          }
        </div>
      );
    }

    if (placement === 'center') {
      return (
        <div className="et-email-header-block" style={{ ...bandStyle, textAlign: 'center' }}>
          <img src={logoSrc} alt="Logo" style={{ ...logoImgStyle, margin: '0 auto', display: 'block', marginBottom: headerText ? 16 : 0 }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          {headerText && <h2 style={{ margin: '16px 0 0', color: '#fff', textAlign: 'center' }}>{headerText}</h2>}
        </div>
      );
    }

    if (placement === 'right') {
      return (
        <div className="et-email-header-block" style={bandStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between' }}>
            <div>{headerText && <h2 style={{ margin: 0, color: '#fff' }}>{headerText}</h2>}</div>
            <img src={logoSrc} alt="Logo" style={logoImgStyle}
              onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
        </div>
      );
    }

    // left (default)
    return (
      <div className="et-email-header-block" style={bandStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src={logoSrc} alt="Logo" style={logoImgStyle}
            onError={(e) => { e.target.style.display = 'none'; }} />
          {headerText && <h2 style={{ margin: 0, color: '#fff' }}>{headerText}</h2>}
        </div>
      </div>
    );
  }

  return (
    <div className="et-preview-outer">
      <span className="et-preview-label">Live Preview</span>

      {/* Subject line */}
      <div className="et-subject-row">
        <strong>Subject:</strong>
        <span>{subjectText || <em style={{ color: '#cbd5e1' }}>No subject set</em>}</span>
      </div>

      {/* Email card */}
      <div className="et-email-card">

        {/* Header image */}
        {headerImageSrc && (
          <div className="et-email-header-image-row">
            <img src={headerImageSrc} alt="Header" style={hdrImgStyle} onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
        )}

        {/* Merged header band (logo + header text) */}
        {renderHeaderBand()}

        {/* Body */}
        {bodyText ? (
          <div className="et-email-body-block">{bodyText}</div>
        ) : (
          <div className="et-email-body-block" style={{ color: '#cbd5e1' }}>
            Body text will appear here…
          </div>
        )}

        {/* QR code placeholder */}
        {showQr && <QRPlaceholder />}

        {/* CTA button */}
        <div className="et-btn-block">
          <button className="et-cta-btn" style={{ backgroundColor: btnColor, color: tmpl.buttonTextColor || '#ffffff' }}>
            {btnLabel}
          </button>
        </div>

        {/* Footer image */}
        {footerImageSrc && (
          <div className="et-email-footer-image-row" style={{ padding: ftrPad > 0 ? ftrPad : 0 }}>
            <img src={footerImageSrc} alt="Footer" style={ftrImgStyle} onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
        )}

        {/* Footer text */}
        {footerText && (
          <div className="et-email-footer">{footerText}</div>
        )}

      </div>
    </div>
  );
}

// ─── Image uploader ───────────────────────────────────────────────────────────
function ImageUploader({ label, currentUrl, uploadType, uploadBase, onUploaded, onRemove }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');
  const inputRef = useRef(null);
  const base = uploadBase || '/api/admin/email-template';

  async function handleChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setUploading(true);
    const fd = new FormData();
    fd.append('image', file);
    try {
      const { data } = await api.post(`${base}/image/${uploadType}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded(data.url);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="et-image-uploader">
      {currentUrl ? (
        <div className="et-image-thumb-row">
          <img
            src={assetUrl(currentUrl)}
            alt={label}
            className="et-image-thumb"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div className="et-image-thumb-actions">
            <button
              className="btn btn-sm btn-outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              Replace
            </button>
            <button
              className="btn btn-sm btn-outline text-danger"
              onClick={onRemove}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`et-upload-drop${uploading ? ' et-upload-drop--loading' : ''}`}
          onClick={() => !uploading && inputRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" width="22" height="22">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>{uploading ? 'Uploading…' : `Upload ${label}`}</span>
          <span className="et-upload-hint">PNG, JPG, GIF · max 5 MB</span>
        </div>
      )}
      {error && <p className="et-upload-error">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={uploading}
      />
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastId = 0;
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, type = 'success') => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return { toasts, show };
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success'
            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          }
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({ title, icon, isOpen, onToggle, children }) {
  return (
    <div className="pb-section">
      <button className="pb-section-toggle" onClick={onToggle}>
        <span className="pb-section-left">{icon}{title}</span>
        <svg
          className={`pb-chevron${isOpen ? ' pb-chevron-open' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          width="14" height="14"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {isOpen && <div className="pb-section-body">{children}</div>}
    </div>
  );
}

// ─── Section icons ────────────────────────────────────────────────────────────
const ContentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/>
    <line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>
  </svg>
);
const StyleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
  </svg>
);
const ImagesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);
const VarsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);

// QR placeholder image for full-document preview (small SVG grid)
const QR_PREVIEW_SVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 10 10'><rect width='10' height='10' fill='%23fff'/><rect x='1' y='1' width='3' height='3' fill='%23334155'/><rect x='6' y='1' width='3' height='3' fill='%23334155'/><rect x='1' y='6' width='3' height='3' fill='%23334155'/><rect x='4' y='4' width='2' height='2' fill='%23334155'/><rect x='6' y='6' width='1' height='1' fill='%23334155'/><rect x='8' y='6' width='1' height='1' fill='%23334155'/><rect x='6' y='8' width='3' height='1' fill='%23334155'/></svg>`;

// ─── Full email HTML builder (used when customHtml is set) ───────────────────
function buildEmailPreviewHtml(tmpl, logoSrc, headerImageSrc, footerImageSrc, eventName) {
  // Detect complete HTML document — use it directly, no wrapping
  if (/^\s*<!doctype\s+html/i.test(tmpl.customHtml || '')) {
    const qrImg = `<img src="${QR_PREVIEW_SVG}" alt="QR Code" width="150" height="150" style="display:block;border-radius:8px;border:1px solid #e2e8f0;"/>`;
    return substituteVars(tmpl.customHtml, eventName)
      .replace(/\{\{qrCode\}\}/g, qrImg);
  }

  const sub      = (t) => substituteVars(t || '', eventName);
  const btnColor = tmpl.buttonColor    || '#2563eb';
  const btnTxt   = tmpl.buttonTextColor || '#ffffff';
  const hdrPad   = tmpl.headerPadding  ?? 28;
  const hdrH     = tmpl.headerImageHeight ?? 200;
  const ftrH     = tmpl.footerImageHeight ?? 120;
  const ftrPad   = tmpl.footerImagePadding ?? 0;
  const placement = tmpl.logoPlacement || 'left';

  const hdrImgFit = tmpl.headerImageFit === 'fill' ? 'contain'
                  : tmpl.headerImageFit === 'max'  ? 'fill' : 'cover';
  const ftrImgFit = tmpl.footerImageFit === 'fill' ? 'contain'
                  : tmpl.footerImageFit === 'max'  ? 'fill' : 'cover';

  const logoH   = tmpl.logoHeight ?? 48;
  const logoW   = tmpl.logoWidth  != null ? `${tmpl.logoWidth}%` : 'auto';
  const logoStyle = tmpl.logoFit === 'fill'
    ? 'display:block;width:100%;height:auto;object-fit:contain'
    : tmpl.logoFit === 'max'
    ? 'display:block;width:100%;object-fit:fill'
    : `display:block;height:${logoH}px;width:${logoW};max-width:${tmpl.logoWidth != null ? 'none' : '180px'};object-fit:contain`;

  const headerText = sub(tmpl.headerText);
  const footerText = sub(tmpl.footerText);
  const btnLabel   = tmpl.buttonLabel || 'View My Ticket';
  const body       = sub(tmpl.customHtml);

  // ── Header band ─────────────────────────────────────────────────────────────
  let headerBand = '';
  if (logoSrc || headerText) {
    const band = `background:${btnColor};padding:${hdrPad}px 36px`;
    if (!logoSrc) {
      headerBand = `<div style="${band}"><h2 style="margin:0;color:#fff;font-family:sans-serif">${headerText}</h2></div>`;
    } else if (placement === 'center') {
      headerBand = `<div style="${band};text-align:center">
        <img src="${logoSrc}" style="${logoStyle};margin:0 auto${headerText ? ';margin-bottom:16px' : ''}" />
        ${headerText ? `<h2 style="margin:0;color:#fff;font-family:sans-serif">${headerText}</h2>` : ''}
      </div>`;
    } else if (placement === 'right') {
      headerBand = `<div style="${band}">
        <div style="display:flex;align-items:center;gap:16px;justify-content:space-between">
          ${headerText ? `<h2 style="margin:0;color:#fff;font-family:sans-serif">${headerText}</h2>` : '<span></span>'}
          <img src="${logoSrc}" style="${logoStyle}" />
        </div>
      </div>`;
    } else {
      headerBand = `<div style="${band}">
        <div style="display:flex;align-items:center;gap:16px">
          <img src="${logoSrc}" style="${logoStyle}" />
          ${headerText ? `<h2 style="margin:0;color:#fff;font-family:sans-serif">${headerText}</h2>` : ''}
        </div>
      </div>`;
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px 16px; background: #e5e7eb; font-family: sans-serif; }
  </style>
</head>
<body>
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10)">
    ${headerImageSrc ? `<img src="${headerImageSrc}" style="width:100%;height:${hdrH}px;object-fit:${hdrImgFit};display:block" />` : ''}
    ${headerBand}
    <div style="padding:32px 36px">
      ${body}
    </div>
    <div style="padding:0 36px 32px;text-align:center">
      <a href="#" style="display:inline-block;padding:13px 32px;background:${btnColor};color:${btnTxt};text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;font-family:sans-serif">${btnLabel}</a>
    </div>
    ${footerImageSrc ? `<div style="${ftrPad > 0 ? `padding:${ftrPad}px` : ''}"><img src="${footerImageSrc}" style="width:100%;height:${ftrH}px;object-fit:${ftrImgFit};display:block" /></div>` : ''}
    ${footerText ? `<div style="padding:16px 36px 20px;text-align:center;color:#94a3b8;font-size:13px;font-family:sans-serif">${footerText}</div>` : ''}
  </div>
</body>
</html>`;
}

// ─── Default template state ───────────────────────────────────────────────────
const DEFAULT_TMPL = {
  subject:            '',
  headerText:         '',
  bodyText:           '',
  buttonLabel:        '',
  buttonColor:        '#2563eb',
  buttonTextColor:    '#ffffff',
  footerText:         '',
  showQr:             true,
  logoWidth:          null,
  logoHeight:         null,
  logoFit:            null,
  logoPlacement:      'left',
  headerPadding:      28,
  headerImageHeight:  200,
  headerImageFit:     null,
  footerImageHeight:  120,
  footerImageFit:     null,
  footerImagePadding: 0,
  customHtml:         '',
};

const DEFAULT_IMAGES = { logoUrl: null, headerImageUrl: null, footerImageUrl: null };

// ─── Main component ───────────────────────────────────────────────────────────
export default function EmailTemplate() {
  const [tab, setTab]         = useState('regular'); // 'regular' | 'vip'
  const [tmpl, setTmpl]       = useState(DEFAULT_TMPL);
  const [images, setImages]   = useState(DEFAULT_IMAGES);
  const [pageLogoUrl, setPageLogoUrl] = useState(null); // fallback logo from page config
  const [eventName, setEventName] = useState('');
  const [loading, setLoading]     = useState(true);
  const [saveState, setSaveState] = useState('idle');
  const [testState, setTestState] = useState('idle');
  const [sections, setSections]   = useState({ content: true, images: true, style: false, vars: false });
  const { toasts, show: showToast } = useToast();

  // Derived endpoints based on active tab
  const ENDPOINT     = tab === 'vip' ? '/api/admin/vip-email-template' : '/api/admin/email-template';
  const UPLOAD_BASE  = tab === 'vip' ? '/api/admin/vip-email-template' : '/api/admin/email-template';

  // ── Fetch on mount + tab switch ──────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(ENDPOINT).catch(() => ({ data: {} })),
      api.get('/api/admin/event').catch(() => ({ data: {} })),
    ]).then(([{ data: et }, { data: ev }]) => {
      setTmpl({
        subject:            et.subject            || '',
        headerText:         et.headerText         || '',
        bodyText:           et.bodyText           || '',
        buttonLabel:        et.buttonLabel        || '',
        buttonColor:        et.buttonColor        || '#2563eb',
        buttonTextColor:    et.buttonTextColor    || '#ffffff',
        footerText:         et.footerText         || '',
        showQr:             et.showQr !== undefined ? et.showQr : true,
        logoWidth:          et.logoWidth          ?? null,
        logoHeight:         et.logoHeight         ?? null,
        logoFit:            et.logoFit            ?? null,
        logoPlacement:      et.logoPlacement      || 'left',
        headerPadding:      et.headerPadding      ?? 28,
        headerImageHeight:  et.headerImageHeight  ?? 200,
        headerImageFit:     et.headerImageFit     ?? null,
        footerImageHeight:  et.footerImageHeight  ?? 120,
        footerImageFit:     et.footerImageFit     ?? null,
        footerImagePadding: et.footerImagePadding ?? 0,
        customHtml:         et.customHtml         || '',
      });
      setImages({
        logoUrl:        et.logoUrl        || null,
        headerImageUrl: et.headerImageUrl || null,
        footerImageUrl: et.footerImageUrl || null,
      });
      setPageLogoUrl(et._pageLogoUrl || null);
      setEventName(ev.name || '');
    }).finally(() => setLoading(false));
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, value) { setTmpl((t) => ({ ...t, [key]: value })); }
  function toggleSection(key) { setSections((s) => ({ ...s, [key]: !s[key] })); }

  // ── Image helpers ────────────────────────────────────────────────────────────
  function setImage(field, url) {
    setImages((prev) => ({ ...prev, [field]: url }));
  }

  async function removeImage(field) {
    try {
      await api.put(ENDPOINT, { [field]: null });
      setImages((prev) => ({ ...prev, [field]: null }));
    } catch {
      showToast('Failed to remove image', 'error');
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaveState('saving');
    try {
      await api.put(ENDPOINT, tmpl);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2200);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }

  // ── Send test email ──────────────────────────────────────────────────────────
  async function handleSendTest() {
    if (testState === 'sending') return;
    setTestState('sending');
    try {
      await api.post(`${ENDPOINT}/test`, tmpl);
      showToast('Test email sent successfully!', 'success');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send test email';
      showToast(msg, 'error');
    } finally {
      setTestState('idle');
    }
  }

  const saveBtnClass = saveState === 'saved'  ? 'btn btn-sm btn-success'
                     : saveState === 'error'  ? 'btn btn-sm btn-danger-ghost'
                     : 'btn btn-sm btn-primary';

  const saveBtnLabel = saveState === 'saving' ? 'Saving…'
                     : saveState === 'saved'  ? '✓ Saved'
                     : saveState === 'error'  ? '✕ Error'
                     : 'Save Template';

  if (loading) {
    return (
      <div className="pb-wrapper">
        <div style={{ width: '40%', minWidth: 300, background: 'white', borderRight: '1px solid var(--border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="skeleton sk-title" style={{ width: '55%' }} />
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <div className="skeleton sk-text" style={{ width: '35%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: i === 2 ? 80 : 36, borderRadius: 6 }} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton sk-title" style={{ width: 110, marginBottom: 4 }} />
          <div className="skeleton" style={{ flex: 1, borderRadius: 8, maxHeight: 480 }} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pb-wrapper">

        {/* ════ LEFT CONFIG PANEL ════ */}
        <div className="pb-config">

          {/* Sticky header */}
          <div className="pb-config-header">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="pb-config-title">Email Template</span>
              {/* Regular / VIP tabs */}
              <div className="et-tab-row">
                <button
                  className={`et-tab${tab === 'regular' ? ' et-tab-active' : ''}`}
                  onClick={() => setTab('regular')}
                >
                  Regular
                </button>
                <button
                  className={`et-tab${tab === 'vip' ? ' et-tab-active' : ''}`}
                  onClick={() => setTab('vip')}
                >
                  <span className="badge-vip" style={{ fontSize: 10, padding: '1px 5px', marginRight: 5 }}>VIP</span>
                  VIP
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => {
                  if (window.confirm('Reset all template settings to defaults?')) {
                    setTmpl(DEFAULT_TMPL);
                  }
                }}
              >
                Reset
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={handleSendTest}
                disabled={testState === 'sending'}
                title="Send a test email to your account"
              >
                {testState === 'sending' ? 'Sending…' : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" style={{ marginRight: 4 }}>
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Send Test
                  </>
                )}
              </button>
              <button className={saveBtnClass} onClick={handleSave} disabled={saveState === 'saving'}>
                {saveBtnLabel}
              </button>
            </div>
          </div>

          <div className="pb-config-scroll">

            {/* ── 1. Content ── */}
            <Section title="Email Content" icon={<ContentIcon />} isOpen={sections.content} onToggle={() => toggleSection('content')}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Subject Line</label>
                <input className="input" value={tmpl.subject} onChange={(e) => set('subject', e.target.value)} placeholder="e.g. Your ticket for {{eventName}}" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Header Text</label>
                <input className="input" value={tmpl.headerText} onChange={(e) => set('headerText', e.target.value)} placeholder="e.g. You're registered, {{firstName}}!" />
              </div>

              {/* ── Custom HTML body (optional) ── */}
              <div className="et-html-divider">
                <span>Body Content</span>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                    </svg>
                    Custom HTML
                    {tmpl.customHtml
                      ? <span className="et-html-badge et-html-badge--on">active</span>
                      : <span className="et-html-badge">optional</span>
                    }
                  </span>
                  {tmpl.customHtml && (
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => { if (window.confirm('Clear the custom HTML and use plain body text?')) set('customHtml', ''); }}
                    >
                      Clear
                    </button>
                  )}
                </label>
                <textarea
                  className="input et-html-editor"
                  value={tmpl.customHtml}
                  onChange={(e) => set('customHtml', e.target.value)}
                  placeholder={'<p>Hi <strong>{{firstName}}</strong>,</p>\n<p>Thank you for registering for <strong>{{eventName}}</strong>.</p>'}
                  rows={8}
                  spellCheck={false}
                />
                <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4, lineHeight: 1.5 }}>
                  {tmpl.customHtml
                    ? <>Custom HTML is active — the body text below is ignored. Logo, images, button and footer from the other sections still apply.</>
                    : <>Paste HTML to use it as the email body. Leave empty to use plain body text. Logo, images &amp; button always apply regardless.</>
                  }
                </p>
              </div>

              {/* Plain body text — shown but dimmed when customHtml is set */}
              <div className="form-group" style={{ marginBottom: 0, opacity: tmpl.customHtml ? 0.4 : 1, pointerEvents: tmpl.customHtml ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
                <label className="label">Body Text <span style={{ fontWeight: 400, color: 'var(--text-light)' }}>{tmpl.customHtml ? '(overridden by HTML)' : ''}</span></label>
                <textarea
                  className="input"
                  value={tmpl.bodyText}
                  onChange={(e) => set('bodyText', e.target.value)}
                  placeholder={"Hi {{firstName}},\n\nThank you for registering for {{eventName}}. Your QR code is below.\n\n{{qrCode}}"}
                  rows={6}
                  style={{ resize: 'vertical' }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
                  Use <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>{'{{qrCode}}'}</code> to place the QR code inline in the body.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Footer Text</label>
                <textarea className="input" value={tmpl.footerText} onChange={(e) => set('footerText', e.target.value)} placeholder="e.g. © 2026 Acme Events · Powered by Eventadex" rows={2} style={{ resize: 'vertical' }} />
              </div>
            </Section>

            {/* ── 2. Images ── */}
            <Section title="Images" icon={<ImagesIcon />} isOpen={sections.images} onToggle={() => toggleSection('images')}>

              {/* ── Logo (inside header band) ── */}
              <div className="et-image-field">
                <label className="label">Logo</label>
                <p className="et-image-hint">Shown inside the colored header band. Ideal size: 180 × 60 px.</p>
                {/* Page-logo fallback notice */}
                {!images.logoUrl && pageLogoUrl && (
                  <div className="et-logo-fallback-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    Using your registration page logo. Upload a custom logo to override.
                    <img
                      src={assetUrl(pageLogoUrl)}
                      alt="Page logo"
                      style={{ height: 28, maxWidth: 80, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--border)', background: '#f8fafc', padding: 2 }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
                <ImageUploader
                  label="Logo"
                  currentUrl={images.logoUrl}
                  uploadType="logo"
                  uploadBase={UPLOAD_BASE}
                  onUploaded={(url) => setImage('logoUrl', url)}
                  onRemove={() => removeImage('logoUrl')}
                />
                {images.logoUrl && (
                  <>
                    {/* Placement buttons */}
                    <div style={{ marginTop: 8, marginBottom: 4 }}>
                      <span className="img-resize-label" style={{ display: 'block', marginBottom: 4 }}>Logo placement</span>
                      <div className="img-fit-buttons">
                        <button className={`img-fit-btn${tmpl.logoPlacement === 'left' ? ' active' : ''}`}
                          onClick={() => set('logoPlacement', 'left')}>Left</button>
                        <button className={`img-fit-btn${tmpl.logoPlacement === 'center' ? ' active' : ''}`}
                          onClick={() => set('logoPlacement', 'center')}>Center</button>
                        <button className={`img-fit-btn${tmpl.logoPlacement === 'right' ? ' active' : ''}`}
                          onClick={() => set('logoPlacement', 'right')}>Right</button>
                      </div>
                    </div>
                    {/* Logo size controls */}
                    <div className="img-resize-row">
                      <span className="img-resize-label">Width: {tmpl.logoWidth ?? '—'}%</span>
                      <input type="range" className="img-resize-slider"
                        min={5} max={100} step={5}
                        value={tmpl.logoWidth ?? 25}
                        onChange={(e) => set('logoWidth', Number(e.target.value))}
                      />
                      <button className="img-resize-reset" title="Reset" onClick={() => set('logoWidth', null)}>✕</button>
                    </div>
                    <div className="img-resize-row">
                      <span className="img-resize-label">Height: {tmpl.logoHeight ?? '—'}px</span>
                      <input type="range" className="img-resize-slider"
                        min={20} max={200} step={4}
                        value={tmpl.logoHeight ?? 48}
                        onChange={(e) => set('logoHeight', Number(e.target.value))}
                      />
                      <button className="img-resize-reset" title="Reset" onClick={() => set('logoHeight', null)}>✕</button>
                    </div>
                    <div className="img-fit-buttons">
                      <button className={`img-fit-btn${tmpl.logoFit === 'fill' ? ' active' : ''}`}
                        onClick={() => set('logoFit', tmpl.logoFit === 'fill' ? null : 'fill')}>
                        Fill to container
                      </button>
                      <button className={`img-fit-btn${tmpl.logoFit === 'max' ? ' active' : ''}`}
                        onClick={() => set('logoFit', tmpl.logoFit === 'max' ? null : 'max')}>
                        Maximize
                      </button>
                    </div>
                  </>
                )}
                {/* Header band padding — shown whenever there's a logo OR header text */}
                {(images.logoUrl || tmpl.headerText) && (
                  <div className="img-resize-row" style={{ marginTop: 10 }}>
                    <span className="img-resize-label">Band padding: {tmpl.headerPadding ?? 28}px</span>
                    <input type="range" className="img-resize-slider"
                      min={0} max={60} step={4}
                      value={tmpl.headerPadding ?? 28}
                      onChange={(e) => set('headerPadding', Number(e.target.value))}
                    />
                  </div>
                )}
              </div>

              {/* ── Header Image ── */}
              <div className="et-image-field">
                <label className="label">Header Image</label>
                <p className="et-image-hint">Full-width banner at the top of the email. Ideal size: 600 × 200 px.</p>
                <ImageUploader
                  label="Header Image"
                  currentUrl={images.headerImageUrl}
                  uploadType="header"
                  uploadBase={UPLOAD_BASE}
                  onUploaded={(url) => setImage('headerImageUrl', url)}
                  onRemove={() => removeImage('headerImageUrl')}
                />
                {images.headerImageUrl && (
                  <>
                    <div className="img-resize-row">
                      <span className="img-resize-label">Height: {tmpl.headerImageHeight ?? 200}px</span>
                      <input type="range" className="img-resize-slider"
                        min={80} max={400} step={10}
                        value={tmpl.headerImageHeight ?? 200}
                        onChange={(e) => set('headerImageHeight', Number(e.target.value))}
                      />
                    </div>
                    <div className="img-fit-buttons">
                      <button className={`img-fit-btn${tmpl.headerImageFit === 'fill' ? ' active' : ''}`}
                        onClick={() => set('headerImageFit', tmpl.headerImageFit === 'fill' ? null : 'fill')}>
                        Fill to container
                      </button>
                      <button className={`img-fit-btn${tmpl.headerImageFit === 'max' ? ' active' : ''}`}
                        onClick={() => set('headerImageFit', tmpl.headerImageFit === 'max' ? null : 'max')}>
                        Maximize
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* ── Footer Image ── */}
              <div className="et-image-field">
                <label className="label">Footer Image</label>
                <p className="et-image-hint">Full-width image in the footer. Ideal size: 600 × 120 px.</p>
                <ImageUploader
                  label="Footer Image"
                  currentUrl={images.footerImageUrl}
                  uploadType="footer"
                  uploadBase={UPLOAD_BASE}
                  onUploaded={(url) => setImage('footerImageUrl', url)}
                  onRemove={() => removeImage('footerImageUrl')}
                />
                {images.footerImageUrl && (
                  <>
                    <div className="img-resize-row">
                      <span className="img-resize-label">Height: {tmpl.footerImageHeight ?? 120}px</span>
                      <input type="range" className="img-resize-slider"
                        min={40} max={200} step={4}
                        value={tmpl.footerImageHeight ?? 120}
                        onChange={(e) => set('footerImageHeight', Number(e.target.value))}
                      />
                    </div>
                    <div className="img-resize-row">
                      <span className="img-resize-label">Padding: {tmpl.footerImagePadding ?? 0}px</span>
                      <input type="range" className="img-resize-slider"
                        min={0} max={40} step={4}
                        value={tmpl.footerImagePadding ?? 0}
                        onChange={(e) => set('footerImagePadding', Number(e.target.value))}
                      />
                    </div>
                    <div className="img-fit-buttons">
                      <button className={`img-fit-btn${tmpl.footerImageFit === 'fill' ? ' active' : ''}`}
                        onClick={() => set('footerImageFit', tmpl.footerImageFit === 'fill' ? null : 'fill')}>
                        Fill to container
                      </button>
                      <button className={`img-fit-btn${tmpl.footerImageFit === 'max' ? ' active' : ''}`}
                        onClick={() => set('footerImageFit', tmpl.footerImageFit === 'max' ? null : 'max')}>
                        Maximize
                      </button>
                    </div>
                  </>
                )}
              </div>

            </Section>

            {/* ── 3. Style ── */}
            <Section title="Button Style" icon={<StyleIcon />} isOpen={sections.style} onToggle={() => toggleSection('style')}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Button Label</label>
                <input className="input" value={tmpl.buttonLabel} onChange={(e) => set('buttonLabel', e.target.value)} placeholder="e.g. View My Ticket" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Button Color</label>
                <div className="color-row">
                  <input type="color" className="color-swatch" value={tmpl.buttonColor || '#2563eb'} onChange={(e) => set('buttonColor', e.target.value)} />
                  <input className="input" value={tmpl.buttonColor || ''} onChange={(e) => set('buttonColor', e.target.value)} placeholder="#2563eb" maxLength={7} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Button Text Color</label>
                <div className="color-row">
                  <input type="color" className="color-swatch" value={tmpl.buttonTextColor || '#ffffff'} onChange={(e) => set('buttonTextColor', e.target.value)} />
                  <input className="input" value={tmpl.buttonTextColor || ''} onChange={(e) => set('buttonTextColor', e.target.value)} placeholder="#ffffff" maxLength={7} />
                </div>
              </div>
            </Section>

            {/* ── 4. Variables reference ── */}
            <Section title="Template Variables" icon={<VarsIcon />} isOpen={sections.vars} onToggle={() => toggleSection('vars')}>
              <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>
                Use these variables anywhere in the subject, header, body, or footer text.
              </p>
              <div className="et-vars-box">
                <span className="et-vars-label">Available variables</span>
                {VARIABLES.map(({ token, desc }) => (
                  <div key={token} className="et-var-row">
                    <span className="et-var-token">{token}</span>
                    <span className="et-var-desc">{desc}</span>
                  </div>
                ))}
              </div>
            </Section>

          </div>
        </div>

        {/* ════ RIGHT PREVIEW PANEL ════ */}
        <div className="pb-preview" style={{ padding: 0, overflow: 'hidden' }}>
          {tmpl.customHtml ? (
            /* Full iframe preview — stitches visual controls + custom HTML body */
            <div className="et-preview-outer">
              <span className="et-preview-label">Live Preview · Custom HTML</span>
              <div className="et-subject-row">
                <strong>Subject:</strong>
                <span>{substituteVars(tmpl.subject, eventName) || <em style={{ color: '#cbd5e1' }}>No subject set</em>}</span>
              </div>
              <div className="et-html-frame-wrap">
                <iframe
                  srcDoc={buildEmailPreviewHtml(
                    tmpl,
                    assetUrl(images.logoUrl || pageLogoUrl) || null,
                    assetUrl(images.headerImageUrl) || null,
                    assetUrl(images.footerImageUrl) || null,
                    eventName,
                  )}
                  sandbox="allow-same-origin"
                  title="Email Preview"
                  className="et-html-iframe"
                />
              </div>
            </div>
          ) : (
            <EmailPreview
              tmpl={tmpl}
              images={images}
              pageLogoUrl={pageLogoUrl}
              eventName={eventName}
            />
          )}
        </div>

      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
