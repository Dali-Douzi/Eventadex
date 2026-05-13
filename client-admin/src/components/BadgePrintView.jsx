/**
 * BadgePrintView
 * ──────────────
 * Shared badge renderer used in:
 *   • BadgeSetup    — live preview (preview=true, scales to previewWidth px)
 *   • BadgePreview  — full-size tab preview (preview=true, previewWidth=actual px)
 *   • PrintCards    — print output (preview=false, uses mm/pt units)
 */

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { assetUrl } from '../utils/assetUrl';

const MM_TO_PX = 3.7795; // 1 mm at 96 dpi
const PT_TO_PX = 1.3333; // 1 pt at 96 dpi

// ─── Local QR generator hook ──────────────────────────────────────────────────
function useQrDataUrl(value) {
  const [dataUrl, setDataUrl] = useState(null);
  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: 512, margin: 1,
      color: { dark: '#1e293b', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then((url) => { if (!cancelled) setDataUrl(url); });
    return () => { cancelled = true; };
  }, [value]);
  return dataUrl;
}

function resolveUrl(p) { return assetUrl(p) || null; }

// ─── Available badge fields ───────────────────────────────────────────────────
export const AVAILABLE_FIELDS = [
  { fieldName: 'fullName',    label: 'Full Name',      defaultFontSize: 15, defaultFontWeight: 'bold'   },
  { fieldName: 'firstName',   label: 'First Name',     defaultFontSize: 13, defaultFontWeight: 'normal' },
  { fieldName: 'lastName',    label: 'Last Name',      defaultFontSize: 13, defaultFontWeight: 'normal' },
  { fieldName: 'title',       label: 'Title (Mr/Mrs)', defaultFontSize: 9,  defaultFontWeight: 'normal' },
  { fieldName: 'sessionName', label: 'Session',        defaultFontSize: 8,  defaultFontWeight: 'normal' },
  { fieldName: 'country',     label: 'Country',        defaultFontSize: 8,  defaultFontWeight: 'normal' },
];

// Per-field defaults (mirrors server DEFAULT_BADGE_FIELDS)
const FIELD_DEFAULTS = {
  fullName:    { visible: true,  fontSize: 15, fontWeight: 'bold',   textColor: '#0f172a' },
  firstName:   { visible: false, fontSize: 13, fontWeight: 'normal', textColor: '#0f172a' },
  lastName:    { visible: false, fontSize: 13, fontWeight: 'normal', textColor: '#0f172a' },
  title:       { visible: true,  fontSize: 9,  fontWeight: 'normal', textColor: '#475569' },
  sessionName: { visible: true,  fontSize: 8,  fontWeight: 'normal', textColor: '#64748b' },
  country:     { visible: false, fontSize: 8,  fontWeight: 'normal', textColor: '#64748b' },
};

// ─── Default config ───────────────────────────────────────────────────────────
export const DEFAULT_BADGE_CONFIG = {
  // Canvas
  width:              85,
  height:             54,
  padding:            3,
  backgroundColor:    '#ffffff',
  backgroundImageUrl: '',

  // Header
  headerHeight:       12,
  showHeaderDivider:  true,
  headerDividerColor: '#e2e8f0',

  // Logo
  showLogo:     true,
  logoPosition: 'top-left',
  logoMaxWidth:  28,
  logoMaxHeight: 9,

  // Event name
  showEventName:   true,
  eventNameSize:   7.5,
  eventNameWeight: 600,
  eventNameColor:  '#1e293b',

  // Fields / middle
  fieldGap:       0.8,
  middlePaddingY: 1.5,

  // Footer / QR
  footerHeight:       18,
  showFooterDivider:  true,
  footerDividerColor: '#e2e8f0',
  showQrCode:  true,
  qrPosition:  'bottom-right',
  qrSize:       17,

  fields: AVAILABLE_FIELDS.map((f, i) => ({
    fieldName:  f.fieldName,
    label:      f.label,
    align:      'center',
    order:      i,
    ...(FIELD_DEFAULTS[f.fieldName] || { visible: false, fontSize: 10, fontWeight: 'normal', textColor: '#0f172a' }),
  })),
};

// ─── Dummy preview data ───────────────────────────────────────────────────────
const DUMMY = {
  firstName:   'John',
  lastName:    'Doe',
  title:       'Mr.',
  sessionName: 'Morning Session',
  country:     'Saudi Arabia',
  eventName:   'Eventadex Conference 2026',
  qrCode:      'PREVIEW',
};

// ─── Field value extractor ────────────────────────────────────────────────────
function getFieldValue(fieldName, data) {
  switch (fieldName) {
    case 'fullName':    return [data.firstName, data.lastName].filter(Boolean).join(' ');
    case 'firstName':   return data.firstName   || '';
    case 'lastName':    return data.lastName    || '';
    case 'title':       return data.title       || '';
    case 'sessionName': return data.sessionName || '';
    case 'country':     return data.country     || '';
    default:            return data[fieldName]  || '';
  }
}

// ─── BadgePrintView ───────────────────────────────────────────────────────────
export function BadgePrintView({
  registrant,
  config,
  preview      = false,
  previewWidth  = 300,
  orgLogoUrl   = null,
}) {
  const cfg = { ...DEFAULT_BADGE_CONFIG, ...(config || {}) };
  if (config?.fields?.length) cfg.fields = config.fields;

  const W = cfg.width  || 85;
  const H = cfg.height || 54;

  const scale = preview ? (previewWidth / (W * MM_TO_PX)) : null;

  const mm = (val) => preview
    ? `${(val * MM_TO_PX * scale).toFixed(2)}px`
    : `${val}mm`;

  const pt = (val) => preview
    ? `${(val * PT_TO_PX * scale).toFixed(2)}px`
    : `${val}pt`;

  const data = preview
    ? { ...DUMMY }
    : {
        firstName:   registrant?.firstName   || '',
        lastName:    registrant?.lastName    || '',
        title:       registrant?.title       || '',
        sessionName: registrant?.sessionName || '',
        country:     registrant?.country     || '',
        eventName:   registrant?.eventName   || '',
        qrCode:      registrant?.qrCode      || '',
        logoUrl:     registrant?.logoUrl     || null,
      };

  const logoSrc   = preview ? resolveUrl(orgLogoUrl) : resolveUrl(data.logoUrl);
  const qrDataUrl = useQrDataUrl(data.qrCode || 'PREVIEW');

  const visibleFields = (cfg.fields || [])
    .filter((f) => f.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // ── Derived layout values ────────────────────────
  const pad    = cfg.padding       ?? 3;
  const hdrH   = cfg.headerHeight  ?? 12;
  const ftrH   = cfg.footerHeight  ?? 18;
  const qrSz   = cfg.qrSize        ?? 17;
  const pos    = cfg.logoPosition  || 'top-left';
  const qPos   = cfg.qrPosition    || 'bottom-right';

  const showTop = cfg.showLogo || cfg.showEventName;
  const showBot = cfg.showQrCode;

  // ── Container ────────────────────────────────────
  const bgImg = cfg.backgroundImageUrl ? resolveUrl(cfg.backgroundImageUrl) : null;

  const containerStyle = {
    width:           preview ? `${(W * MM_TO_PX * scale).toFixed(2)}px` : `${W}mm`,
    height:          preview ? `${(H * MM_TO_PX * scale).toFixed(2)}px` : `${H}mm`,
    backgroundColor: cfg.backgroundColor || '#ffffff',
    ...(bgImg ? {
      backgroundImage:    `url(${bgImg})`,
      backgroundSize:     'cover',
      backgroundPosition: 'center',
      backgroundRepeat:   'no-repeat',
    } : {}),
    padding:        mm(pad),
    boxSizing:      'border-box',
    display:        'flex',
    flexDirection:  'column',
    fontFamily:     '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    overflow:       'hidden',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust:       'exact',
  };

  // ── Header ───────────────────────────────────────
  const topStyle = {
    display:        'flex',
    flexDirection:  pos === 'top-right' ? 'row-reverse' : 'row',
    alignItems:     'center',
    justifyContent: pos === 'top-center' ? 'center' : 'space-between',
    height:         mm(hdrH),
    paddingBottom:  mm(1.5),
    borderBottom:   cfg.showHeaderDivider !== false
      ? `${mm(0.3)} solid ${cfg.headerDividerColor || '#e2e8f0'}`
      : 'none',
    flexShrink:     0,
    overflow:       'hidden',
    gap:            pos === 'top-center' ? mm(3) : '0px',
  };

  // ── Middle ───────────────────────────────────────
  const middleStyle = {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        `${mm(cfg.middlePaddingY ?? 1.5)} 0`,
    overflow:       'hidden',
    gap:            mm(cfg.fieldGap ?? 0.8),
    minHeight:      0,
  };

  // ── Footer ───────────────────────────────────────
  const bottomStyle = {
    display:        'flex',
    alignItems:     'flex-end',
    justifyContent: qPos === 'center' ? 'center' : (qPos === 'bottom-left' ? 'flex-start' : 'flex-end'),
    height:         mm(ftrH),
    paddingTop:     mm(1.5),
    borderTop:      cfg.showFooterDivider !== false
      ? `${mm(0.3)} solid ${cfg.footerDividerColor || '#e2e8f0'}`
      : 'none',
    flexShrink:     0,
    overflow:       'hidden',
  };

  return (
    <div style={containerStyle}>

      {/* ── Header: logo + event name ── */}
      {showTop && (
        <div style={topStyle}>
          {cfg.showLogo && logoSrc && (
            <img
              src={logoSrc}
              alt="Logo"
              style={{
                maxHeight:  mm(cfg.logoMaxHeight ?? 9),
                maxWidth:   mm(cfg.logoMaxWidth  ?? 28),
                objectFit:  'contain',
                display:    'block',
                flexShrink: 0,
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          {cfg.showEventName && (
            <span style={{
              fontSize:     pt(cfg.eventNameSize   ?? 7.5),
              fontWeight:   cfg.eventNameWeight     ?? 600,
              color:        cfg.eventNameColor      ?? '#1e293b',
              textAlign:    pos === 'top-right' ? 'left' : 'right',
              maxWidth:     pos === 'top-center' ? '100%' : mm(50),
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              lineHeight:   1.3,
              flex:         pos === 'top-center' ? '0 1 auto' : '1 1 0',
            }}>
              {data.eventName || 'Event Name'}
            </span>
          )}
        </div>
      )}

      {/* ── Middle: text fields ── */}
      <div style={middleStyle}>
        {visibleFields.map((field) => {
          const value = getFieldValue(field.fieldName, data);
          if (!value) return null;
          return (
            <div key={field.fieldName} style={{
              fontSize:     pt(field.fontSize  || 10),
              fontWeight:   field.fontWeight   || 'normal',
              color:        field.textColor    || '#000000',
              textAlign:    field.align        || 'center',
              lineHeight:   1.2,
              width:        '100%',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              flexShrink:   0,
            }}>
              {value}
            </div>
          );
        })}
        {visibleFields.length === 0 && preview && (
          <div style={{ fontSize: pt(8), color: '#cbd5e1', textAlign: 'center' }}>
            No fields visible
          </div>
        )}
      </div>

      {/* ── Footer: QR code ── */}
      {showBot && qrDataUrl && (
        <div style={bottomStyle}>
          <img
            src={qrDataUrl}
            alt="QR"
            style={{
              width:          mm(qrSz),
              height:         mm(qrSz),
              display:        'block',
              imageRendering: 'pixelated',
            }}
          />
        </div>
      )}

    </div>
  );
}
