/**
 * BadgePreview — standalone page for full-size badge preview in a new tab.
 * Reads config from sessionStorage (set by BadgeSetup's "Preview at Full Size").
 * This route is rendered without the DashboardLayout wrapper.
 */
import { useEffect, useState } from 'react';
import { BadgePrintView, DEFAULT_BADGE_CONFIG } from '../components/BadgePrintView';

const MM_TO_PX = 3.7795;

export default function BadgePreview() {
  const [config,     setConfig]     = useState(null);
  const [orgLogoUrl, setOrgLogoUrl] = useState(null);

  useEffect(() => {
    document.title = 'Badge Preview — Full Size';

    try {
      const stored = sessionStorage.getItem('badge-preview');
      if (stored) {
        const { config: cfg, orgLogoUrl: logo } = JSON.parse(stored);
        setConfig({ ...DEFAULT_BADGE_CONFIG, ...cfg, fields: cfg?.fields?.length ? cfg.fields : DEFAULT_BADGE_CONFIG.fields });
        setOrgLogoUrl(logo || null);
        return;
      }
    } catch {
      // fall through to default
    }
    setConfig(DEFAULT_BADGE_CONFIG);
  }, []);

  if (!config) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f1f5f9', fontFamily: 'system-ui',
      }}>
        <span style={{ color: '#94a3b8', fontSize: 14 }}>Loading preview…</span>
      </div>
    );
  }

  const W = config.width  || 85;
  const H = config.height || 54;
  const wPx = Math.round(W * MM_TO_PX);
  const hPx = Math.round(H * MM_TO_PX);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#e2e8f0',
      display:   'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      gap: 20,
    }}>

      {/* Info bar */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        gap:             16,
        background:      'white',
        borderRadius:    8,
        padding:         '10px 20px',
        boxShadow:       '0 1px 4px rgba(0,0,0,0.1)',
        fontSize:        13,
        color:           '#475569',
      }}>
        <span>
          <strong style={{ color: '#1e293b' }}>Full-size preview</strong>
          {' · '}Sample data · Actual screen rendering may differ slightly from physical print
        </span>
        <span style={{
          background: '#f1f5f9', borderRadius: 6, padding: '3px 10px',
          fontFamily: 'monospace', fontSize: 12, color: '#64748b',
        }}>
          {W} × {H} mm &nbsp;·&nbsp; {wPx} × {hPx} px @ 96dpi
        </span>
        <button
          onClick={() => window.close()}
          style={{
            padding: '5px 14px', borderRadius: 6,
            background: '#f1f5f9', border: '1px solid #e2e8f0',
            fontSize: 12, color: '#64748b', cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>

      {/* Badge at 1:1 pixel equivalent */}
      <div style={{
        boxShadow:    '0 8px 32px rgba(0,0,0,0.15)',
        borderRadius: 4,
        overflow:     'hidden',
        outline:      '1px solid rgba(0,0,0,0.08)',
      }}>
        <BadgePrintView
          config={config}
          preview={true}
          previewWidth={wPx}
          orgLogoUrl={orgLogoUrl}
        />
      </div>

      <p style={{ fontSize: 12, color: '#94a3b8', maxWidth: 480, textAlign: 'center', lineHeight: 1.6 }}>
        This preview renders at {wPx} × {hPx} pixels — the screen-pixel equivalent of the
        {' '}{W} × {H} mm physical badge at 96 dpi.
        Font sizes may appear smaller on the physical print (typically 300+ dpi).
      </p>

    </div>
  );
}
