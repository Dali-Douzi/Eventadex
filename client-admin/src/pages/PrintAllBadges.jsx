/**
 * PrintAllBadges — standalone print page (no sidebar/navbar).
 * Opened in a new tab by PrintCards' "Print All" flow.
 * Reads { registrants, badgeConfig, sessionLabel } from sessionStorage key 'badge-batch'.
 * Renders all badges in a grid, then auto-triggers window.print().
 */
import { useEffect, useState } from 'react';
import { BadgePrintView, DEFAULT_BADGE_CONFIG } from '../components/BadgePrintView';

const MM_TO_PX = 3.7795;
const PREVIEW_WIDTH_PX = 240; // screen preview size per badge

export default function PrintAllBadges() {
  const [registrants,  setRegistrants]  = useState([]);
  const [badgeConfig,  setBadgeConfig]  = useState(DEFAULT_BADGE_CONFIG);
  const [sessionLabel, setSessionLabel] = useState('');
  const [ready,        setReady]        = useState(false);
  const [error,        setError]        = useState('');

  useEffect(() => {
    document.title = 'Print All Badges';
    try {
      const raw = sessionStorage.getItem('badge-batch');
      if (!raw) { setError('No badge data found. Please go back and try again.'); return; }
      const { registrants: regs, badgeConfig: cfg, sessionLabel: lbl } = JSON.parse(raw);
      setRegistrants(regs || []);
      setBadgeConfig(cfg ? { ...DEFAULT_BADGE_CONFIG, ...cfg, fields: cfg.fields?.length ? cfg.fields : DEFAULT_BADGE_CONFIG.fields } : DEFAULT_BADGE_CONFIG);
      setSessionLabel(lbl || '');
      setReady(true);
    } catch {
      setError('Could not read badge data. Please go back and try again.');
    }
  }, []);

  // Auto-print once ready — delay 1 s so QR codes and images can render
  useEffect(() => {
    if (!ready || registrants.length === 0) return;
    const timer = setTimeout(() => window.print(), 1000);
    return () => clearTimeout(timer);
  }, [ready, registrants.length]);

  // ── Badge dimensions for screen preview
  const W = badgeConfig.width  || 85;
  const H = badgeConfig.height || 54;
  const previewH = Math.round((PREVIEW_WIDTH_PX / (W * MM_TO_PX)) * H * MM_TO_PX);

  if (error) {
    return (
      <div style={styles.errorPage}>
        <p style={styles.errorText}>{error}</p>
        <button onClick={() => window.close()} style={styles.closeBtn}>Close tab</button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={styles.loadingPage}>
        <span style={styles.loadingText}>Preparing badges…</span>
      </div>
    );
  }

  return (
    <div>
      {/* ── Screen-only info bar ─────────────────────────────── */}
      <div className="pab-info-bar" style={styles.infoBar}>
        <div>
          <strong style={{ color: '#1e293b' }}>Print All Badges</strong>
          {sessionLabel && (
            <span style={{ marginLeft: 10, color: '#64748b' }}>· {sessionLabel}</span>
          )}
          <span style={{ marginLeft: 10, color: '#64748b' }}>· {registrants.length} badge{registrants.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()} style={styles.printBtn}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 width="14" height="14" style={{ marginRight: 5 }}>
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print / Save as PDF
          </button>
          <button onClick={() => window.close()} style={styles.closeBtn}>Close</button>
        </div>
      </div>

      {/* ── Screen preview grid (hidden when printing) ───────── */}
      <div style={{ ...styles.previewGrid, '--badge-w': `${PREVIEW_WIDTH_PX}px`, '--badge-h': `${previewH}px` }}>
        {registrants.map((r) => (
          <div key={r._id} style={styles.previewItem}>
            <BadgePrintView
              registrant={r}
              config={badgeConfig}
              preview={true}
              previewWidth={PREVIEW_WIDTH_PX}
            />
            <div style={styles.previewLabel}>{r.firstName} {r.lastName}</div>
          </div>
        ))}
      </div>

      {/* ── Print-only output ─────────────────────────────────── */}
      <div className="pab-print-grid">
        {registrants.map((r) => (
          <div key={r._id} className="pab-print-item">
            <BadgePrintView
              registrant={r}
              config={badgeConfig}
              preview={false}
            />
          </div>
        ))}
      </div>

      {/* ── Inline print styles ───────────────────────────────── */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          .pab-info-bar { display: none !important; }
          div[style*="previewGrid"] { display: none !important; }

          /* Hide everything except the print grid */
          * { visibility: hidden !important; }
          .pab-print-grid,
          .pab-print-grid * { visibility: visible !important; }

          .pab-print-grid {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 4mm !important;
            align-content: flex-start !important;
          }
          .pab-print-item {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        .pab-print-grid { display: none; }
      `}</style>
    </div>
  );
}

// ─── Inline styles (screen only) ─────────────────────────────────────────────
const styles = {
  infoBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 24px',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    fontSize: 13,
    position: 'sticky',
    top: 0,
    zIndex: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  printBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 16px',
    borderRadius: 7,
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  closeBtn: {
    padding: '7px 14px',
    borderRadius: 7,
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    fontSize: 13,
    cursor: 'pointer',
  },
  previewGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    padding: 24,
    background: '#f1f5f9',
    minHeight: 'calc(100vh - 53px)',
    alignContent: 'flex-start',
  },
  previewItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  previewLabel: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 240,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  errorPage: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16, background: '#f8fafc',
  },
  errorText: { color: '#dc2626', fontSize: 14 },
  loadingPage: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#f8fafc',
  },
  loadingText: { color: '#94a3b8', fontSize: 14 },
};
