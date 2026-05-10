/**
 * BadgePrintView
 * ──────────────
 * Shared badge renderer used in:
 *   • BadgeSetup  — live preview (preview=true, scales to previewWidth px)
 *   • BadgePreview — full-size tab preview (preview=true, previewWidth=actual px)
 *   • PrintCards  — print output (preview=false, uses mm/pt units)
 *
 * Props:
 *   registrant   object  — real attendee data (used when preview=false)
 *   config       object  — BadgeConfig document
 *   preview      bool    — when true, render at screen px scale
 *   previewWidth number  — target pixel width for preview (default 300)
 *   orgLogoUrl   string  — org logo path, used in preview mode
 *
 * QR codes are generated locally via the `qrcode` npm package —
 * no external network request needed (works fully offline).
 */

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { assetUrl } from '../utils/assetUrl';

// Physical unit constants
const MM_TO_PX = 3.7795; // 1 mm at 96 dpi
const PT_TO_PX = 1.3333; // 1 pt at 96 dpi  (96/72)

// ─── Local QR generator hook ──────────────────────────────────────────────────
// Generates a PNG data URL from `value` using the qrcode package.
// Returns null until the first render completes (generation is ~instant).
function useQrDataUrl(value) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    QRCode.toDataURL(value, {
      width:  512,
      margin: 1,
      color:  { dark: '#1e293b', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => { cancelled = true; };
  }, [value]);

  return dataUrl;
}

function resolveUrl(p) {
  return assetUrl(p) || null;
}

// ─── Available badge fields ───────────────────────────────────────────────────

export const AVAILABLE_FIELDS = [
  { fieldName: 'fullName',    label: 'Full Name',      defaultFontSize: 15, defaultFontWeight: 'bold'   },
  { fieldName: 'firstName',   label: 'First Name',     defaultFontSize: 13, defaultFontWeight: 'normal' },
  { fieldName: 'lastName',    label: 'Last Name',      defaultFontSize: 13, defaultFontWeight: 'normal' },
  { fieldName: 'title',       label: 'Title (Mr/Mrs)', defaultFontSize: 9,  defaultFontWeight: 'normal' },
  { fieldName: 'sponsorType', label: 'Job Title',      defaultFontSize: 9,  defaultFontWeight: 'normal' },
  { fieldName: 'sessionName', label: 'Session',        defaultFontSize: 8,  defaultFontWeight: 'normal' },
  { fieldName: 'country',     label: 'Country',        defaultFontSize: 8,  defaultFontWeight: 'normal' },
];

// ─── Default config (matches server DEFAULT_BADGE_FIELDS) ────────────────────

export const DEFAULT_BADGE_CONFIG = {
  width:              85,
  height:             54,
  backgroundColor:    '#ffffff',
  backgroundImageUrl: '',
  showLogo:           true,
  logoPosition:       'top-left',
  showEventName:      true,
  showQrCode:         true,
  qrPosition:         'bottom-right',
  fields: AVAILABLE_FIELDS.map((f, i) => ({
    fieldName:  f.fieldName,
    label:      f.label,
    visible:    ['fullName', 'title', 'sessionName'].includes(f.fieldName),
    fontSize:   f.defaultFontSize,
    fontWeight: f.defaultFontWeight,
    textColor:  '#000000',
    align:      'center',
    order:      i,
  })),
};

// ─── Dummy data for preview ───────────────────────────────────────────────────

const DUMMY = {
  firstName:   'John',
  lastName:    'Doe',
  title:       'Mr.',
  sponsorType: 'Speaker',
  sessionName: 'Day 1 — Morning',
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
    case 'sponsorType': return data.sponsorType || '';
    case 'sessionName': return data.sessionName || '';
    case 'country':     return data.country     || '';
    default:            return data[fieldName]  || '';
  }
}

// ─── BadgePrintView component ─────────────────────────────────────────────────

export function BadgePrintView({
  registrant,
  config,
  preview     = false,
  previewWidth = 300,
  orgLogoUrl  = null,
}) {
  // Merge with defaults so every key is guaranteed to be present
  const cfg = { ...DEFAULT_BADGE_CONFIG, ...(config || {}) };
  // Use config.fields if provided (don't fall back to DEFAULT on fields)
  if (config?.fields?.length) cfg.fields = config.fields;

  const W = cfg.width  || 85;
  const H = cfg.height || 54;

  // Scale factor: maps mm → px for the preview
  const scale = preview ? (previewWidth / (W * MM_TO_PX)) : null;

  // Unit converters — mm/pt in print mode, scaled px in preview mode
  const mm = (val) => preview
    ? `${(val * MM_TO_PX * scale).toFixed(2)}px`
    : `${val}mm`;

  const pt = (val) => preview
    ? `${(val * PT_TO_PX * scale).toFixed(2)}px`
    : `${val}pt`;

  // Data to display
  const data = preview
    ? { ...DUMMY }
    : {
        firstName:   registrant?.firstName   || '',
        lastName:    registrant?.lastName    || '',
        title:       registrant?.title       || '',
        sponsorType: registrant?.sponsorType || '',
        sessionName: registrant?.sessionName || '',
        country:     registrant?.country     || '',
        eventName:   registrant?.eventName   || '',
        qrCode:      registrant?.qrCode      || '',
        logoUrl:     registrant?.logoUrl     || null,
      };

  // Logo image source
  const logoSrc = preview
    ? resolveUrl(orgLogoUrl)
    : resolveUrl(data.logoUrl);

  // QR — generated locally, no external network needed
  const qrDataUrl = useQrDataUrl(data.qrCode || 'PREVIEW');

  // Visible fields sorted by order
  const visibleFields = (cfg.fields || [])
    .filter((f) => f.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // ── Styles ────────────────────────────────────────────────

  const bgImg = cfg.backgroundImageUrl ? resolveUrl(cfg.backgroundImageUrl) : null;

  const containerStyle = {
    width:          preview ? `${(W * MM_TO_PX * scale).toFixed(2)}px` : `${W}mm`,
    height:         preview ? `${(H * MM_TO_PX * scale).toFixed(2)}px` : `${H}mm`,
    backgroundColor: cfg.backgroundColor || '#ffffff',
    ...(bgImg ? {
      backgroundImage:    `url(${bgImg})`,
      backgroundSize:     'cover',
      backgroundPosition: 'center',
      backgroundRepeat:   'no-repeat',
    } : {}),
    padding:        mm(3),
    boxSizing:      'border-box',
    display:        'flex',
    flexDirection:  'column',
    fontFamily:     '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    overflow:       'hidden',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust:       'exact',
  };

  // Top section layout varies by logoPosition
  const pos = cfg.logoPosition || 'top-left';
  const topStyle = {
    display:        'flex',
    flexDirection:  pos === 'top-right' ? 'row-reverse' : 'row',
    alignItems:     'center',
    justifyContent: pos === 'top-center' ? 'center' : 'space-between',
    height:         mm(12),
    paddingBottom:  mm(1.5),
    borderBottom:   `${mm(0.3)} solid #e2e8f0`,
    flexShrink:     0,
    overflow:       'hidden',
    gap:            pos === 'top-center' ? mm(3) : '0px',
  };

  const middleStyle = {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        `${mm(1.5)} 0`,
    overflow:       'hidden',
    gap:            mm(0.8),
    minHeight:      0,
  };

  const qPos = cfg.qrPosition || 'bottom-right';
  const bottomStyle = {
    display:        'flex',
    alignItems:     'flex-end',
    justifyContent: qPos === 'center' ? 'center' : (qPos === 'bottom-left' ? 'flex-start' : 'flex-end'),
    height:         mm(18),
    paddingTop:     mm(1.5),
    borderTop:      `${mm(0.3)} solid #e2e8f0`,
    flexShrink:     0,
    overflow:       'hidden',
  };

  const showTop = cfg.showLogo || cfg.showEventName;

  return (
    <div style={containerStyle}>

      {/* ── Top: logo + event name ── */}
      {showTop && (
        <div style={topStyle}>
          {cfg.showLogo && (
            logoSrc
              ? (
                <img
                  src={logoSrc}
                  alt="Logo"
                  style={{
                    maxHeight:  mm(9),
                    maxWidth:   mm(28),
                    objectFit:  'contain',
                    display:    'block',
                    flexShrink: 0,
                  }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )
              : (
                <span style={{
                  display:      'inline-block',
                  width:        mm(20),
                  height:       mm(8),
                  background:   '#f1f5f9',
                  borderRadius: mm(2),
                  flexShrink:   0,
                }} />
              )
          )}

          {cfg.showEventName && (
            <span style={{
              fontSize:     pt(7.5),
              fontWeight:   600,
              color:        '#1e293b',
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
            <div
              key={field.fieldName}
              style={{
                fontSize:     pt(field.fontSize || 10),
                fontWeight:   field.fontWeight || 'normal',
                color:        field.textColor  || '#000000',
                textAlign:    field.align      || 'center',
                lineHeight:   1.2,
                width:        '100%',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
                flexShrink:   0,
              }}
            >
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

      {/* ── Bottom: QR code ── */}
      {cfg.showQrCode && qrDataUrl && (
        <div style={bottomStyle}>
          <img
            src={qrDataUrl}
            alt="QR Code"
            style={{
              width:           mm(17),
              height:          mm(17),
              display:         'block',
              imageRendering:  'pixelated',
            }}
          />
        </div>
      )}

    </div>
  );
}
