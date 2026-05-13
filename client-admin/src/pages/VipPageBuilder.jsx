import { useState, useEffect } from 'react';
import api from '../api/axios';
import ImageUploadZone from '../components/ImageUploadZone';
import GradientBuilder from '../components/GradientBuilder';
import { useToast } from '../context/ToastContext';
import { assetUrl } from '../utils/assetUrl';

function formatDateRange(start, end) {
  if (!start && !end) return '';
  const toDate  = (s) => new Date(s.includes('T') ? s : s + 'T00:00:00');
  const hasTime = (s) => s && s.includes('T') && !/T00:00/.test(s);
  const fmtDate = (d, year = true) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...(year ? { year: 'numeric' } : {}) });
  const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (!end)   { const d = toDate(start); return hasTime(start) ? `${fmtDate(d, false)}, ${fmtTime(d)}, ${d.getFullYear()}` : fmtDate(d); }
  if (!start) { const d = toDate(end);   return hasTime(end)   ? `${fmtDate(d, false)}, ${fmtTime(d)}, ${d.getFullYear()}` : fmtDate(d); }

  const s = toDate(start), e = toDate(end);
  const sStr = hasTime(start) ? `${fmtDate(s, false)}, ${fmtTime(s)}` : fmtDate(s, false);
  const eStr = hasTime(end)   ? `${fmtDate(e, false)}, ${fmtTime(e)}` : fmtDate(e, false);

  if (s.getFullYear() === e.getFullYear())
    return `${sStr} – ${eStr}, ${e.getFullYear()}`;
  return `${sStr}, ${s.getFullYear()} – ${eStr}, ${e.getFullYear()}`;
}

// ─── Field catalogue (shared with PageBuilder) ────────────────────────────────

const DEFAULT_FIELD_NAMES = ['firstName', 'lastName', 'gender', 'email'];

// Fields that must always stay visible AND required — toggles are disabled
const LOCKED_FIELDS = new Set(['email']);

const DEFAULT_FIELDS = [
  { fieldName: 'firstName', label: 'First Name', type: 'text',   required: true,  visible: true, options: [] },
  { fieldName: 'lastName',  label: 'Last Name',  type: 'text',   required: true,  visible: true, options: [] },
  { fieldName: 'gender',    label: 'Salutation', type: 'radio',  required: false, visible: true,
    options: ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'] },
  { fieldName: 'email',     label: 'Email',      type: 'email',  required: true,  visible: true, options: [] },
];

const OPTIONAL_FIELDS = [
  { fieldName: 'phone',            label: 'Phone',                       type: 'phone',    options: [] },
  { fieldName: 'landline',         label: 'Landline',                    type: 'landline', options: [] },
  { fieldName: 'mobile',           label: 'Mobile Phone',                type: 'mobile',   options: [] },
  { fieldName: 'country',          label: 'Country',                     type: 'select',   options: [] },
  { fieldName: 'title',            label: 'Title / Honorific',           type: 'select',   options: [] },
  { fieldName: 'hearAbout',        label: 'How did you hear about us?',  type: 'select',   options: [] },
];

function normalizeFields(saved) {
  const existing = saved || [];
  const result   = DEFAULT_FIELDS.map((def) => existing.find((f) => f.fieldName === def.fieldName) || { ...def });
  existing.forEach((f) => { if (!DEFAULT_FIELD_NAMES.includes(f.fieldName)) result.push(f); });
  return result;
}

const DEFAULT_CONFIG = {
  logoUrl:           '',
  primaryColor:      '#1a1a2e',
  textColor:         '#e2b96f',
  headerText:        '',
  durationStart:     '',
  durationEnd:       '',
  location:          '',
  footerText:        '',
  footerLinks:       [],
  formFields:        [],
  headerImageUrl:    '',
  footerImageUrl:    '',
  logoWidth:         null,
  logoHeight:        null,
  logoFit:           null,
  headerPadding:     28,
  headerImageHeight: 180,
  headerImageFit:    null,
  footerImageHeight:   80,
  footerImageFit:      null,
  footerImagePadding:  0,
  bodyBgType:          '',
  bodyBgColor:         '',
  bodyBgImageUrl:      '',
  bodyBgImageSize:     'cover',
  bodyBgGradient:      '',
  cardBgType:          '',
  cardBgColor:         '',
  cardBgGradient:      '',
};

// ─── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, title }) {
  return (
    <label className="toggle" title={title}>
      <input type="checkbox" className="toggle-input" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" />
    </label>
  );
}

// ─── Color quick-pick presets ─────────────────────────────────────────────────
const VIP_COLOR_PRESETS = [
  '#1a1a2e', '#0f0f1a', '#12122a', '#1e1b4b',
  '#2d2d4a', '#0c0a1a', '#1c1c2e', '#111827',
];
const VIP_TEXT_PRESETS = [
  '#e2b96f', '#ffd700', '#f59e0b', '#ffffff',
  '#d4af37', '#b8860b', '#fbbf24', '#fef9c3',
];

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({ title, icon, isOpen, onToggle, children }) {
  return (
    <div className={`pb-section${isOpen ? ' pb-section--open' : ''}`}>
      <button className="pb-section-toggle" onClick={onToggle}>
        <span className="pb-section-left">
          {icon}
          {title}
        </span>
        <svg
          className={`pb-chevron${isOpen ? ' pb-chevron-open' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          width="14" height="14"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && <div className="pb-section-body">{children}</div>}
    </div>
  );
}

// ─── Live preview field renderer ──────────────────────────────────────────────
function PreviewFieldInput({ field }) {
  if (field.type === 'checkbox') {
    return (
      <div className="preview-radio-group">
        <label className="preview-radio-option"><input type="radio" readOnly disabled /> Yes</label>
        <label className="preview-radio-option"><input type="radio" readOnly disabled /> No</label>
      </div>
    );
  }
  if (field.type === 'select') {
    return (
      <select className="preview-input" disabled>
        <option>Select {field.label}…</option>
        {(field.options || []).map((opt, i) => <option key={i}>{opt}</option>)}
      </select>
    );
  }
  if (field.type === 'radio') {
    return (
      <div className="preview-radio-group">
        {(field.options || []).map((opt, i) => (
          <label key={i} className="preview-radio-option">
            <input type="radio" readOnly disabled /> {opt}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === 'landline' || field.type === 'mobile') {
    return (
      <div className="preview-phone-row">
        <span className="preview-dial-code">+xxx</span>
        <input className="preview-input preview-phone-input" type="tel" placeholder="Phone number" readOnly />
      </div>
    );
  }
  const typeMap = { email: 'email', phone: 'tel' };
  return (
    <input
      className="preview-input"
      type={typeMap[field.type] || 'text'}
      placeholder={field.label || field.fieldName}
      readOnly
    />
  );
}

// ─── Live preview ─────────────────────────────────────────────────────────────
function LivePreview({ config }) {
  const visibleFields   = (config.formFields || []).filter((f) => f.visible !== false);
  const headerBg        = config.primaryColor || '#1a1a2e';
  const accentColor     = '#e2b96f';
  const headerTextColor = config.textColor    || '#e2b96f';
  const logoSrc         = assetUrl(config.logoUrl) || null;
  const logoWidth       = config.logoWidth         ?? null;
  const logoHeight      = config.logoHeight        ?? null;
  const logoFit         = config.logoFit           ?? null;
  const headerPadding   = config.headerPadding     ?? 28;
  const hdrImgHeight    = config.headerImageHeight || 180;
  const headerImageFit  = config.headerImageFit    ?? null;
  const ftrImgHeight       = config.footerImageHeight  || 80;
  const footerImageFit     = config.footerImageFit     ?? null;
  const footerImagePadding = config.footerImagePadding ?? 0;

  const bgType = config.bodyBgType || '';
  const bgPageStyle =
    bgType === 'color'    && config.bodyBgColor
      ? { background: config.bodyBgColor }
    : bgType === 'gradient' && config.bodyBgGradient
      ? { background: config.bodyBgGradient }
    : bgType === 'image'  && config.bodyBgImageUrl
      ? {
          backgroundImage:    `url(${assetUrl(config.bodyBgImageUrl)})`,
          backgroundSize:     config.bodyBgImageSize || 'cover',
          backgroundPosition: 'center',
          backgroundRepeat:   config.bodyBgImageSize === 'repeat' ? 'repeat' : 'no-repeat',
        }
    : {};

  const cBgType = config.cardBgType || '';
  const cardBgStyle =
    cBgType === 'color'    && config.cardBgColor
      ? { background: config.cardBgColor }
    : cBgType === 'gradient' && config.cardBgGradient
      ? { background: config.cardBgGradient }
    : cBgType === 'glass'
      ? {
          background:           'rgba(255,255,255,0.1)',
          backdropFilter:       'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderLeft:           '1px solid rgba(255,255,255,0.15)',
          borderRight:          '1px solid rgba(255,255,255,0.15)',
        }
    : {};

  const logoStyle = logoFit === 'fill'
    ? { width: '100%', height: 'auto', objectFit: 'contain', maxWidth: 'none', maxHeight: 'none' }
    : logoFit === 'max'
    ? { width: '100%', alignSelf: 'stretch', objectFit: 'fill', maxWidth: 'none', maxHeight: 'none' }
    : {
        ...(logoWidth  != null ? { width: `${logoWidth}%` }    : {}),
        ...(logoHeight != null ? { height: `${logoHeight}px` } : {}),
        objectFit: (logoWidth != null && logoWidth >= 80) ? 'cover' : 'contain',
        maxWidth: 'none', maxHeight: 'none',
      };

  const headerBgSize = headerImageFit === 'fill' ? 'contain'
                     : headerImageFit === 'max'  ? '100% 100%'
                     : 'cover';

  const footerImgStyle = footerImageFit === 'fill'
    ? { width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }
    : footerImageFit === 'max'
    ? { width: '100%', height: ftrImgHeight, objectFit: 'fill', display: 'block' }
    : { width: '100%', height: ftrImgHeight, objectFit: 'cover', display: 'block' };

  const hasLogo = !!logoSrc;
  const headerInfoAlign = hasLogo ? 'right' : 'center';

  return (
    <>
      <p className="pb-preview-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="M8 4v16M2 8h6"/>
        </svg>
        VIP Page · Live Preview
      </p>

      {/* Fake browser chrome */}
      <div className="pb-browser-chrome">
        <div className="pb-browser-dots">
          <span className="pb-browser-dot" style={{ background: '#fc5c57' }} />
          <span className="pb-browser-dot" style={{ background: '#febc2e' }} />
          <span className="pb-browser-dot" style={{ background: '#28c840' }} />
        </div>
        <div className="pb-browser-url">yoursite.com/vip-register</div>
      </div>

      <div className="pb-preview-card pb-preview-card--chromed vip-preview">

        {/* Header */}
        <div
          className="preview-header"
          style={{
            backgroundColor: headerBg,
            borderBottom: `2px solid ${accentColor}`,
            padding: `${headerPadding}px`,
            ...(config.headerImageUrl ? {
              backgroundImage: `url(${assetUrl(config.headerImageUrl)})`,
              backgroundSize: headerBgSize,
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              minHeight: hdrImgHeight,
            } : {}),
          }}
        >
          {logoSrc && (
            <img src={logoSrc} className="preview-logo" alt="Logo"
              style={{
                ...logoStyle,
                WebkitMaskImage: 'linear-gradient(to right, black 55%, transparent 92%)',
                maskImage:       'linear-gradient(to right, black 55%, transparent 92%)',
              }}
              onError={(e) => { e.target.style.display = 'none'; }} />
          )}
          <div className="preview-header-info" style={{ textAlign: headerInfoAlign, flex: hasLogo ? 1 : 'unset', width: hasLogo ? undefined : '100%' }}>
            {config.headerText
              ? <h1 style={{ color: headerTextColor }}>{config.headerText}</h1>
              : <h1 style={{ color: headerTextColor, opacity: 0.5 }}>Event Name</h1>
            }
            {formatDateRange(config.durationStart, config.durationEnd) && (
              <p style={{ color: headerTextColor, opacity: 0.8 }}>{formatDateRange(config.durationStart, config.durationEnd)}</p>
            )}
            {config.location      && <p style={{ color: headerTextColor, opacity: 0.7 }}>{config.location}</p>}
          </div>
        </div>

        {/* Page body area — shows the body background colour */}
        <div className="preview-page-area" style={bgPageStyle}>

          {/* Form card */}
          <div className="preview-body" style={cBgType ? cardBgStyle : { background: '#12122a' }}>
            {visibleFields.length === 0 ? (
              <p className="preview-empty" style={{ color: '#8888aa' }}>No visible form fields configured</p>
            ) : (
              visibleFields.map((field, i) => (
                <div key={field.fieldName || i} className="preview-field">
                  <label className={`preview-label${field.required ? ' preview-label-required' : ''}`}
                    style={{ color: accentColor }}>
                    {field.label || field.fieldName}
                  </label>
                  <PreviewFieldInput field={field} />
                </div>
              ))
            )}

            {/* Submit button */}
            <button
              className="preview-submit"
              style={{ backgroundColor: accentColor, color: '#0f0f1a', fontWeight: 700 }}
            >
              Register as VIP
            </button>
          </div>

          {/* Footer */}
          {(config.footerText || (config.footerLinks || []).length > 0 || config.footerImageUrl) && (
            <div className="preview-footer" style={{ background: headerBg, borderTop: `1px solid #2d2d4a`, borderRadius: 6, marginTop: 12 }}>
              {config.footerText && <p style={{ marginBottom: config.footerLinks?.length ? 6 : 0, color: '#9999bb' }}>{config.footerText}</p>}
              {(config.footerLinks || []).filter(l => l.label).length > 0 && (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {config.footerLinks.filter(l => l.label).map((link, i) => (
                    <a key={i} style={{ color: accentColor, fontSize: 12 }}>{link.label}</a>
                  ))}
                </div>
              )}
              {config.footerImageUrl && (
                <div style={footerImagePadding > 0 ? { padding: footerImagePadding } : {}}>
                  <img
                    src={assetUrl(config.footerImageUrl)}
                    alt="Footer banner"
                    style={footerImgStyle}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </>
  );
}

// ─── Section icons ────────────────────────────────────────────────────────────
const BrandingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <circle cx="13.5" cy="6.5" r="2.5"/>
    <circle cx="17.5" cy="10.5" r="2.5"/>
    <circle cx="8.5" cy="7.5" r="2.5"/>
    <circle cx="6.5" cy="12.5" r="2.5"/>
    <path d="M12 21a9 9 0 1 1 0-18"/>
  </svg>
);
const ContentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/>
    <line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>
  </svg>
);
const FieldsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <rect x="3" y="5" width="18" height="4" rx="1"/><rect x="3" y="13" width="18" height="4" rx="1"/>
  </svg>
);
const BackgroundIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <rect x="2" y="3" width="20" height="18" rx="2"/>
    <path d="M2 9h20M9 21V9"/>
  </svg>
);

// ─── Gradient presets ─────────────────────────────────────────────────────────
const GRADIENT_PRESETS = [
  { name: 'Cobalt',     value: 'linear-gradient(135deg, #1e3c72, #2a5298)' },
  { name: 'Ocean',      value: 'linear-gradient(135deg, #1a6b8a, #6dd5ed)' },
  { name: 'Sunset',     value: 'linear-gradient(135deg, #f12711, #f5af19)' },
  { name: 'Amethyst',   value: 'linear-gradient(135deg, #7b2ff7, #f107a3)' },
  { name: 'Forest',     value: 'linear-gradient(135deg, #134e5e, #71b280)' },
  { name: 'Midnight',   value: 'linear-gradient(135deg, #0f0c29, #302b63)' },
  { name: 'Dusk',       value: 'linear-gradient(135deg, #2c3e50, #fd746c)' },
  { name: 'Rose',       value: 'linear-gradient(135deg, #ffecd2, #fcb69f)' },
  { name: 'Sky',        value: 'linear-gradient(180deg, #87ceeb, #e0f4ff)' },
  { name: 'Emerald',    value: 'linear-gradient(135deg, #0f9b58, #a8e063)' },
  { name: 'Dark Steel', value: 'linear-gradient(135deg, #1c1c2e, #2d2d4a)' },
  { name: 'Gold',       value: 'linear-gradient(135deg, #b8860b, #ffd700)' },
];

// ─── Dominant colour extraction ───────────────────────────────────────────────
async function sampleLogoColor(logoPath) {
  const res = await fetch(assetUrl(logoPath));
  if (!res.ok) throw new Error('Could not fetch logo');
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 64;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      URL.revokeObjectURL(blobUrl);

      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
      const buckets = {};

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue; // skip transparent pixels only

        // Quantize into 32-step buckets to group near-identical shades
        const key = `${Math.round(r/32)*32},${Math.round(g/32)*32},${Math.round(b/32)*32}`;
        buckets[key] = (buckets[key] || 0) + 1;
      }

      const best = Object.entries(buckets).sort(([, a], [, b]) => b - a)[0];
      if (!best) { resolve(null); return; }

      const [r, g, b] = best[0].split(',').map(Number);
      resolve('#' + [r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join(''));
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
    img.src = blobUrl;
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VipPageBuilder() {
  const toast = useToast();
  const [config, setConfig]       = useState(DEFAULT_CONFIG);
  const [sections, setSections]   = useState({ branding: true, background: false, content: true, fields: true });
  const [saveState, setSaveState] = useState('idle');
  const [logoLoading, setLogoLoading] = useState(false);
  const [headerBannerLoading, setHeaderBannerLoading] = useState(false);
  const [footerBannerLoading, setFooterBannerLoading] = useState(false);
  const [bgImageLoading, setBgImageLoading]           = useState(false);
  const [loading, setLoading]     = useState(true);
  const [newField, setNewField]   = useState(null);
  const [samplingColor, setSamplingColor] = useState(false);

  useEffect(() => {
    api.get('/api/admin/vip-page-config')
      .then(({ data }) => {
        setConfig({
          logoUrl:        data.logoUrl        || '',
          primaryColor:   data.primaryColor   || '#1a1a2e',
          textColor:      data.textColor      || '#e2b96f',
          headerText:     data.headerText     || '',
          durationStart:  data.durationStart ? data.durationStart.slice(0, 16) : '',
          durationEnd:    data.durationEnd   ? data.durationEnd.slice(0, 16)   : '',
          location:       data.location       || '',
          footerText:     data.footerText     || '',
          footerLinks:    data.footerLinks    || [],
          formFields:     normalizeFields(data.formFields),
          headerImageUrl:    data.headerImageUrl    || '',
          footerImageUrl:    data.footerImageUrl    || '',
          logoWidth:         data.logoWidth         ?? null,
          logoHeight:        data.logoHeight        ?? null,
          logoFit:           data.logoFit           ?? null,
          headerPadding:     data.headerPadding     ?? 28,
          headerImageHeight: data.headerImageHeight ?? 180,
          headerImageFit:    data.headerImageFit    ?? null,
          footerImageHeight:   data.footerImageHeight   ?? 80,
          footerImageFit:      data.footerImageFit      ?? null,
          footerImagePadding:  data.footerImagePadding  ?? 0,
          bodyBgType:          data.bodyBgType          || '',
          bodyBgColor:         data.bodyBgColor         || '',
          bodyBgImageUrl:      data.bodyBgImageUrl      || '',
          bodyBgImageSize:     data.bodyBgImageSize     || 'cover',
          bodyBgGradient:      data.bodyBgGradient      || '',
          cardBgType:          data.cardBgType          || '',
          cardBgColor:         data.cardBgColor         || '',
          cardBgGradient:      data.cardBgGradient      || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(key, value) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  async function handleLogoUpload(file) {
    const formData = new FormData();
    formData.append('logo', file);
    setLogoLoading(true);
    try {
      const { data } = await api.post('/api/admin/vip-page-config/logo', formData);
      set('logoUrl', data.logoUrl);
    } catch (err) {
      toast(err.response?.data?.message || 'Logo upload failed', 'error');
    } finally {
      setLogoLoading(false);
    }
  }

  async function handleHeaderBannerUpload(file) {
    const formData = new FormData();
    formData.append('image', file);
    setHeaderBannerLoading(true);
    try {
      const { data } = await api.post('/api/admin/vip-page-config/banner/header', formData);
      set('headerImageUrl', data.headerImageUrl);
    } catch (err) {
      toast(err.response?.data?.message || 'Header banner upload failed', 'error');
    } finally {
      setHeaderBannerLoading(false);
    }
  }

  async function handleFooterBannerUpload(file) {
    const formData = new FormData();
    formData.append('image', file);
    setFooterBannerLoading(true);
    try {
      const { data } = await api.post('/api/admin/vip-page-config/banner/footer', formData);
      set('footerImageUrl', data.footerImageUrl);
    } catch (err) {
      toast(err.response?.data?.message || 'Footer banner upload failed', 'error');
    } finally {
      setFooterBannerLoading(false);
    }
  }

  async function handleBgImageUpload(file) {
    const formData = new FormData();
    formData.append('image', file);
    setBgImageLoading(true);
    try {
      const { data } = await api.post('/api/admin/vip-page-config/banner/bg', formData);
      set('bodyBgImageUrl', data.bodyBgImageUrl);
    } catch (err) {
      toast(err.response?.data?.message || 'Background image upload failed', 'error');
    } finally {
      setBgImageLoading(false);
    }
  }

  // ── Logo colour sampler ─────────────────────────────────
  async function handleSampleLogoColor() {
    setSamplingColor(true);
    try {
      const color = await sampleLogoColor(config.logoUrl);
      if (color) {
        set('primaryColor', color);
        toast('Header color updated from logo', 'success');
      } else {
        toast('Could not detect a dominant colour — try a logo with bolder colours', 'error');
      }
    } catch {
      toast('Could not read logo image', 'error');
    } finally {
      setSamplingColor(false);
    }
  }

  function addLink() {
    set('footerLinks', [...(config.footerLinks || []), { label: '', url: '' }]);
  }
  function removeLink(i) {
    set('footerLinks', config.footerLinks.filter((_, idx) => idx !== i));
  }
  function updateLink(i, field, value) {
    set('footerLinks', config.footerLinks.map((l, idx) =>
      idx === i ? { ...l, [field]: value } : l
    ));
  }

  function addOptionalField(def) {
    if (config.formFields.some((f) => f.fieldName === def.fieldName)) return;
    set('formFields', [...config.formFields, { ...def, required: false, visible: true }]);
  }

  function removeField(i) {
    set('formFields', config.formFields.filter((_, idx) => idx !== i));
  }

  function confirmNewField() {
    if (!newField.label.trim()) return;
    const fieldName = `custom_${Date.now()}`;
    const opts = (newField.type === 'select' || newField.type === 'radio') ? newField.options.filter((o) => o.trim()) : [];
    set('formFields', [...config.formFields, {
      fieldName, label: newField.label.trim(), type: newField.type,
      required: false, visible: true, options: opts,
    }]);
    setNewField(null);
  }

  function addNewFieldOption() {
    const opt = (newField.optionInput || '').trim();
    if (!opt) return;
    setNewField((f) => ({ ...f, options: [...f.options, opt], optionInput: '' }));
  }

  function removeNewFieldOption(i) {
    setNewField((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }));
  }

  function updateFieldLabel(i, label) {
    set('formFields', config.formFields.map((f, idx) => idx === i ? { ...f, label } : f));
  }
  function toggleVisible(i, val) {
    if (LOCKED_FIELDS.has(config.formFields[i]?.fieldName)) return; // cannot hide
    set('formFields', config.formFields.map((f, idx) => idx === i ? { ...f, visible: val } : f));
  }
  function toggleRequired(i, val) {
    if (LOCKED_FIELDS.has(config.formFields[i]?.fieldName)) return; // cannot make optional
    set('formFields', config.formFields.map((f, idx) => idx === i ? { ...f, required: val } : f));
  }
  function moveField(i, dir) {
    const fields = [...config.formFields];
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[i], fields[j]] = [fields[j], fields[i]];
    set('formFields', fields);
  }

  function toggleSection(key) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  async function handleSave() {
    setSaveState('saving');
    try {
      await api.put('/api/admin/vip-page-config', config);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2200);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }

  const saveBtnClass = saveState === 'saved'  ? 'btn btn-sm btn-success'
                     : saveState === 'error'  ? 'btn btn-sm btn-danger-ghost'
                     : 'btn btn-sm btn-primary';

  const saveBtnLabel = saveState === 'saving' ? 'Saving…'
                     : saveState === 'saved'  ? '✓ Saved'
                     : saveState === 'error'  ? '✕ Error'
                     : 'Save Changes';

  if (loading) {
    return (
      <div className="pb-wrapper">
        <div style={{ width: '40%', minWidth: 300, background: 'white', borderRight: '1px solid var(--border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="skeleton sk-title" style={{ width: '55%' }} />
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <div className="skeleton sk-text" style={{ width: '40%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 36, borderRadius: 6 }} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton sk-title" style={{ width: 140, marginBottom: 4 }} />
          <div className="skeleton" style={{ flex: 1, borderRadius: 8, maxHeight: 500 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-wrapper">

      {/* ════ LEFT CONFIG PANEL ════ */}
      <div className="pb-config">
        <div className="pb-config-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="pb-config-title">
              Page Builder
              <span className="badge-vip" style={{ marginLeft: 8, fontSize: 10, verticalAlign: 'middle' }}>VIP</span>
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--text-light)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              VIP Registration
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className="btn btn-sm btn-ghost"
              title="Reset all settings to defaults"
              onClick={() => {
                if (window.confirm('Reset all settings to defaults? This will not delete saved data until you Save.')) {
                  setConfig({ ...DEFAULT_CONFIG, formFields: normalizeFields([]) });
                }
              }}
            >
              Reset
            </button>
            <button className={saveBtnClass} onClick={handleSave} disabled={saveState === 'saving'}>
              {saveBtnLabel}
            </button>
          </div>
        </div>

        <div className="pb-config-scroll">

          {/* ── 1. Branding ── */}
          <Section title="Branding" icon={<BrandingIcon />} isOpen={sections.branding} onToggle={() => toggleSection('branding')}>
            <div className="form-group">
              <label className="label">Logo</label>
              <ImageUploadZone
                src={assetUrl(config.logoUrl) || null}
                loading={logoLoading}
                onFile={handleLogoUpload}
                onRemove={() => set('logoUrl', '')}
                label="Logo"
                hint="PNG, JPG, SVG · ideal: 240 × 80 px"
              />
              {config.logoUrl && (
                <>
                  <div className="img-resize-row">
                    <span className="img-resize-label">Width: {config.logoWidth ?? '—'}%</span>
                    <input type="range" className="img-resize-slider"
                      min={5} max={100} step={5}
                      value={config.logoWidth ?? 25}
                      onChange={(e) => set('logoWidth', Number(e.target.value))}
                    />
                    <button className="img-resize-reset" title="Reset width"
                      onClick={() => set('logoWidth', null)}>✕</button>
                  </div>
                  <div className="img-resize-row">
                    <span className="img-resize-label">Height: {config.logoHeight ?? '—'}px</span>
                    <input type="range" className="img-resize-slider"
                      min={20} max={400} step={4}
                      value={config.logoHeight ?? 64}
                      onChange={(e) => set('logoHeight', Number(e.target.value))}
                    />
                    <button className="img-resize-reset" title="Reset height"
                      onClick={() => set('logoHeight', null)}>✕</button>
                  </div>
                  <div className="img-fit-buttons">
                    <button className={`img-fit-btn${config.logoFit === 'fill' ? ' active' : ''}`}
                      onClick={() => set('logoFit', config.logoFit === 'fill' ? null : 'fill')}>
                      Fill to container
                    </button>
                    <button className={`img-fit-btn${config.logoFit === 'max' ? ' active' : ''}`}
                      onClick={() => set('logoFit', config.logoFit === 'max' ? null : 'max')}>
                      Maximize
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Header Banner Image */}
            <div className="form-group">
              <label className="label">Header Banner Image</label>
              <ImageUploadZone
                src={assetUrl(config.headerImageUrl) || null}
                loading={headerBannerLoading}
                onFile={handleHeaderBannerUpload}
                onRemove={() => set('headerImageUrl', '')}
                label="Header Banner"
                hint="PNG, JPG · wide banner image"
                objectFit="cover"
              />
              {config.headerImageUrl && (
                <>
                  <div className="img-resize-row">
                    <span className="img-resize-label">Height: {config.headerImageHeight ?? 180}px</span>
                    <input type="range" className="img-resize-slider"
                      min={80} max={400} step={10}
                      value={config.headerImageHeight ?? 180}
                      onChange={(e) => set('headerImageHeight', Number(e.target.value))}
                    />
                  </div>
                  <div className="img-fit-buttons">
                    <button className={`img-fit-btn${config.headerImageFit === 'fill' ? ' active' : ''}`}
                      onClick={() => set('headerImageFit', config.headerImageFit === 'fill' ? null : 'fill')}>
                      Fill to container
                    </button>
                    <button className={`img-fit-btn${config.headerImageFit === 'max' ? ' active' : ''}`}
                      onClick={() => set('headerImageFit', config.headerImageFit === 'max' ? null : 'max')}>
                      Maximize
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Footer Banner Image */}
            <div className="form-group">
              <label className="label">Footer Banner Image</label>
              <ImageUploadZone
                src={assetUrl(config.footerImageUrl) || null}
                loading={footerBannerLoading}
                onFile={handleFooterBannerUpload}
                onRemove={() => set('footerImageUrl', '')}
                label="Footer Banner"
                hint="PNG, JPG · footer strip image"
                objectFit="cover"
              />
              {config.footerImageUrl && (
                <>
                  <div className="img-resize-row">
                    <span className="img-resize-label">Height: {config.footerImageHeight ?? 80}px</span>
                    <input type="range" className="img-resize-slider"
                      min={40} max={200} step={4}
                      value={config.footerImageHeight ?? 80}
                      onChange={(e) => set('footerImageHeight', Number(e.target.value))}
                    />
                  </div>
                  <div className="img-resize-row">
                    <span className="img-resize-label">Padding: {config.footerImagePadding ?? 0}px</span>
                    <input type="range" className="img-resize-slider"
                      min={0} max={40} step={4}
                      value={config.footerImagePadding ?? 0}
                      onChange={(e) => set('footerImagePadding', Number(e.target.value))}
                    />
                  </div>
                  <div className="img-fit-buttons">
                    <button className={`img-fit-btn${config.footerImageFit === 'fill' ? ' active' : ''}`}
                      onClick={() => set('footerImageFit', config.footerImageFit === 'fill' ? null : 'fill')}>
                      Fill to container
                    </button>
                    <button className={`img-fit-btn${config.footerImageFit === 'max' ? ' active' : ''}`}
                      onClick={() => set('footerImageFit', config.footerImageFit === 'max' ? null : 'max')}>
                      Maximize
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Header padding */}
            <div className="form-group">
              <label className="label">Header Padding</label>
              <div className="img-resize-row" style={{ marginTop: 0 }}>
                <span className="img-resize-label">{config.headerPadding ?? 28}px</span>
                <input type="range" className="img-resize-slider"
                  min={0} max={60} step={4}
                  value={config.headerPadding ?? 28}
                  onChange={(e) => set('headerPadding', Number(e.target.value))}
                />
              </div>
            </div>

            <div className="form-group">
              <div className="color-label-row">
                <label className="label">Header Background Color</label>
                {config.logoUrl && (
                  <button
                    className="color-from-logo-btn"
                    onClick={handleSampleLogoColor}
                    disabled={samplingColor}
                    title="Sample the dominant colour from your logo"
                  >
                    {samplingColor ? (
                      <span className="color-from-logo-spinner" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                    {samplingColor ? 'Sampling…' : 'From logo'}
                  </button>
                )}
              </div>
              <div className="color-row">
                <input type="color" className="color-swatch"
                  value={config.primaryColor || '#1a1a2e'}
                  onChange={(e) => set('primaryColor', e.target.value)} />
                <input className="input" value={config.primaryColor || ''}
                  onChange={(e) => set('primaryColor', e.target.value)}
                  placeholder="#1a1a2e" maxLength={7} />
              </div>
              <div className="color-presets">
                {VIP_COLOR_PRESETS.map((c) => (
                  <button key={c}
                    className={`color-preset-dot${(config.primaryColor || '#1a1a2e') === c ? ' selected' : ''}`}
                    style={{ background: c }} title={c}
                    onClick={() => set('primaryColor', c)} />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="label">Header Text Color</label>
              <div className="color-row">
                <input type="color" className="color-swatch"
                  value={config.textColor || '#e2b96f'}
                  onChange={(e) => set('textColor', e.target.value)} />
                <input className="input" value={config.textColor || ''}
                  onChange={(e) => set('textColor', e.target.value)}
                  placeholder="#e2b96f" maxLength={7} />
              </div>
              <div className="color-presets">
                {VIP_TEXT_PRESETS.map((c) => (
                  <button key={c}
                    className={`color-preset-dot${(config.textColor || '#e2b96f') === c ? ' selected' : ''}`}
                    style={{ background: c }} title={c}
                    onClick={() => set('textColor', c)} />
                ))}
              </div>
            </div>
          </Section>

          {/* ── 2. Background ── */}
          <Section
            title="Page Background"
            icon={<BackgroundIcon />}
            isOpen={sections.background}
            onToggle={() => toggleSection('background')}
          >
            {/* Mode selector */}
            <div className="bg-type-tabs">
              {['', 'color', 'image', 'gradient'].map((t) => (
                <button
                  key={t}
                  className={`bg-type-tab${config.bodyBgType === t ? ' active' : ''}`}
                  onClick={() => set('bodyBgType', t)}
                >
                  {t === '' ? 'None' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* ── Color ── */}
            {config.bodyBgType === 'color' && (
              <div className="form-group" style={{ marginTop: 8 }}>
                <label className="label">Background Color</label>
                <div className="color-row">
                  <input type="color" className="color-swatch"
                    value={config.bodyBgColor || '#0f0f1a'}
                    onChange={(e) => set('bodyBgColor', e.target.value)} />
                  <input className="input"
                    value={config.bodyBgColor || ''}
                    onChange={(e) => set('bodyBgColor', e.target.value)}
                    placeholder="#0f0f1a" maxLength={7} />
                </div>
              </div>
            )}

            {/* ── Image ── */}
            {config.bodyBgType === 'image' && (
              <div className="form-group" style={{ marginTop: 8 }}>
                <label className="label">Background Image</label>
                <ImageUploadZone
                  src={assetUrl(config.bodyBgImageUrl) || null}
                  loading={bgImageLoading}
                  onFile={handleBgImageUpload}
                  onRemove={() => set('bodyBgImageUrl', '')}
                  label="Background Image"
                  hint="PNG, JPG · full-page background"
                  objectFit="cover"
                />
                {config.bodyBgImageUrl && (
                  <>
                    <div style={{ marginTop: 8 }}>
                      <span className="img-resize-label" style={{ display: 'block', marginBottom: 4 }}>Image sizing</span>
                      <div className="img-fit-buttons">
                        {[['cover', 'Cover'], ['contain', 'Contain'], ['repeat', 'Tile']].map(([val, label]) => (
                          <button key={val}
                            className={`img-fit-btn${config.bodyBgImageSize === val ? ' active' : ''}`}
                            onClick={() => set('bodyBgImageSize', val)}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Gradient ── */}
            {config.bodyBgType === 'gradient' && (
              <div style={{ marginTop: 8 }}>
                <label className="label">Gradient Presets</label>
                <div className="bg-gradient-grid">
                  {GRADIENT_PRESETS.map((g) => (
                    <button key={g.name}
                      className={`bg-gradient-swatch${config.bodyBgGradient === g.value ? ' active' : ''}`}
                      style={{ background: g.value }}
                      title={g.name}
                      onClick={() => set('bodyBgGradient', g.value)}
                    />
                  ))}
                </div>
                <GradientBuilder
                  value={config.bodyBgGradient || ''}
                  onChange={(v) => set('bodyBgGradient', v)}
                />
              </div>
            )}

            {/* ── Form Card background ── */}
            <div className="bg-subsection-divider">
              <span>Form Card</span>
            </div>
            <div className="bg-type-tabs">
              {['', 'color', 'gradient', 'glass'].map((t) => (
                <button
                  key={t}
                  className={`bg-type-tab${config.cardBgType === t ? ' active' : ''}`}
                  onClick={() => set('cardBgType', t)}
                >
                  {t === '' ? 'Default' : t === 'glass' ? '✦ Glass' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {config.cardBgType === 'color' && (
              <div className="form-group" style={{ marginTop: 8 }}>
                <label className="label">Card Background Color</label>
                <div className="color-row">
                  <input type="color" className="color-swatch"
                    value={config.cardBgColor || '#12122a'}
                    onChange={(e) => set('cardBgColor', e.target.value)} />
                  <input className="input"
                    value={config.cardBgColor || ''}
                    onChange={(e) => set('cardBgColor', e.target.value)}
                    placeholder="#12122a" maxLength={7} />
                </div>
              </div>
            )}

            {config.cardBgType === 'gradient' && (
              <div style={{ marginTop: 8 }}>
                <label className="label">Card Gradient</label>
                <div className="bg-gradient-grid">
                  {GRADIENT_PRESETS.map((g) => (
                    <button key={g.name}
                      className={`bg-gradient-swatch${config.cardBgGradient === g.value ? ' active' : ''}`}
                      style={{ background: g.value }}
                      title={g.name}
                      onClick={() => set('cardBgGradient', g.value)}
                    />
                  ))}
                </div>
                <GradientBuilder
                  value={config.cardBgGradient || ''}
                  onChange={(v) => set('cardBgGradient', v)}
                />
              </div>
            )}

            {config.cardBgType === 'glass' && (
              <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 6, lineHeight: 1.5 }}>
                Frosted glass effect — best used over an image or gradient body background.
              </p>
            )}
          </Section>

          {/* ── 3. Page Content ── */}
          <Section title="Page Content" icon={<ContentIcon />} isOpen={sections.content} onToggle={() => toggleSection('content')}>
            <div className="form-group">
              <label className="label">Event Name</label>
              <input className="input" value={config.headerText}
                onChange={(e) => set('headerText', e.target.value)}
                placeholder="e.g. Tech Summit 2026" />
            </div>
            <div className="form-group">
              <label className="label">Duration</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>
                  <span className="duration-sublabel">Start</span>
                  <input className="input" type="datetime-local"
                    value={config.durationStart || ''}
                    onChange={(e) => set('durationStart', e.target.value)} />
                </div>
                <div>
                  <span className="duration-sublabel">End</span>
                  <input className="input" type="datetime-local"
                    value={config.durationEnd || ''}
                    onChange={(e) => set('durationEnd', e.target.value)} />
                </div>
              </div>
              {formatDateRange(config.durationStart, config.durationEnd) && (
                <p style={{ fontSize: 12, color: 'var(--text-medium)', marginTop: 6 }}>
                  {formatDateRange(config.durationStart, config.durationEnd)}
                </p>
              )}
            </div>
            <div className="form-group">
              <label className="label">Location</label>
              <input className="input" value={config.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="e.g. Dubai World Trade Centre" />
            </div>
            <div className="form-group">
              <label className="label">Footer Text</label>
              <textarea className="input" value={config.footerText}
                onChange={(e) => set('footerText', e.target.value)}
                placeholder="e.g. © 2026 Acme Events · VIP Programme"
                rows={2} style={{ resize: 'vertical' }} />
            </div>
            <div>
              <label className="label">Footer Links</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(config.footerLinks || []).length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text-light)' }}>No footer links added.</p>
                )}
                {(config.footerLinks || []).map((link, i) => (
                  <div key={i} className="footer-link-row">
                    <input className="input" value={link.label}
                      onChange={(e) => updateLink(i, 'label', e.target.value)} placeholder="Label" />
                    <input className="input" value={link.url}
                      onChange={(e) => updateLink(i, 'url', e.target.value)} placeholder="https://…" />
                    <button className="btn-icon-sq btn-danger-ghost" onClick={() => removeLink(i)} title="Remove">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <button className="add-link-btn" onClick={addLink}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Footer Link
                </button>
              </div>
            </div>
          </Section>

          {/* ── 3. Form Fields ── */}
          <Section title="Form Fields" icon={<FieldsIcon />} isOpen={sections.fields} onToggle={() => toggleSection('fields')}>
            <div className="fields-header">
              <span>Label</span><span>Show</span><span>Req</span><span>Order</span>
            </div>

            {config.formFields.map((field, i) => {
              const isDefault = DEFAULT_FIELD_NAMES.includes(field.fieldName);
              const isLocked  = LOCKED_FIELDS.has(field.fieldName);
              return (
                <div key={field.fieldName || i} className={`field-row${isDefault ? ' field-row-default' : ''}`}>
                  <div className="field-label-cell">
                    <input
                      className="field-label-input"
                      value={field.label || ''}
                      onChange={(e) => updateFieldLabel(i, e.target.value)}
                      title={`key: ${field.fieldName} · type: ${field.type}`}
                    />
                    {isDefault && <span className="field-default-dot" title={isLocked ? 'Required field — always visible and required' : 'Default — cannot be removed'}>●</span>}
                  </div>
                  <div className="field-controls" title={isLocked ? 'Email must always be visible' : undefined}>
                    <Toggle checked={field.visible !== false} onChange={(v) => toggleVisible(i, v)} title={isLocked ? 'Email is always visible' : 'Visible'} />
                  </div>
                  <div className="field-controls" title={isLocked ? 'Email is always required' : undefined}>
                    <Toggle checked={isLocked ? true : !!field.required} onChange={(v) => toggleRequired(i, v)} title={isLocked ? 'Email is always required' : 'Required'} />
                  </div>
                  <div className="field-reorder">
                    <button className="btn-icon-sq" disabled={i === 0} onClick={() => moveField(i, -1)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button className="btn-icon-sq" disabled={i === config.formFields.length - 1} onClick={() => moveField(i, 1)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {!isDefault && (
                      <button className="btn-icon-sq btn-danger-ghost" onClick={() => removeField(i)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {OPTIONAL_FIELDS.some((o) => !config.formFields.find((f) => f.fieldName === o.fieldName)) && (
              <div className="optional-palette">
                <span className="optional-palette-label">Add optional field:</span>
                <div className="optional-palette-chips">
                  {OPTIONAL_FIELDS.filter((o) => !config.formFields.find((f) => f.fieldName === o.fieldName)).map((o) => (
                    <button key={o.fieldName} className="palette-chip" onClick={() => addOptionalField(o)}>+ {o.label}</button>
                  ))}
                </div>
              </div>
            )}

            {newField ? (
              <div className="custom-field-form">
                <div className="custom-field-form-row">
                  <input className="input" placeholder="Question / label" value={newField.label}
                    onChange={(e) => setNewField((f) => ({ ...f, label: e.target.value }))} autoFocus />
                  <select className="input" value={newField.type} style={{ maxWidth: 150 }}
                    onChange={(e) => setNewField((f) => ({ ...f, type: e.target.value, options: [] }))}>
                    <option value="text">Text</option>
                    <option value="select">Dropdown</option>
                    <option value="radio">Radio Buttons</option>
                    <option value="checkbox">Yes / No</option>
                  </select>
                </div>
                {(newField.type === 'select' || newField.type === 'radio') && (
                  <div className="custom-options-list">
                    {newField.options.map((opt, i) => (
                      <div key={i} className="custom-option-row">
                        <span>{opt}</span>
                        <button className="btn-icon-sq btn-danger-ghost" onClick={() => removeNewFieldOption(i)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                    <div className="custom-option-input-row">
                      <input className="input" placeholder="Add option…" value={newField.optionInput || ''}
                        onChange={(e) => setNewField((f) => ({ ...f, optionInput: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && addNewFieldOption()} />
                      <button className="btn btn-sm btn-outline" onClick={addNewFieldOption}>Add</button>
                    </div>
                  </div>
                )}
                <div className="custom-field-form-actions">
                  <button className="btn btn-sm btn-primary" onClick={confirmNewField}
                    disabled={!newField.label.trim() || ((newField.type === 'select' || newField.type === 'radio') && newField.options.length === 0)}>
                    Add Field
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setNewField(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="add-link-btn" style={{ marginTop: 8 }}
                onClick={() => setNewField({ label: '', type: 'text', options: [], optionInput: '' })}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Custom Field
              </button>
            )}
          </Section>

        </div>
      </div>

      {/* ════ RIGHT PREVIEW PANEL ════ */}
      <div className="pb-preview">
        <LivePreview config={config} />
      </div>

    </div>
  );
}
