import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';

const APP_USER_URL = import.meta.env.VITE_USER_APP_URL || 'http://localhost:3002';

function copyToClipboard(text, setCopied) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}

function downloadDataUrl(dataUrl, filename) {
  const a    = document.createElement('a');
  a.href     = dataUrl;
  a.download = filename;
  a.click();
}

// ─── Link card ────────────────────────────────────────────────────────────────
function LinkCard({ title, subtitle, url, qrDataUrl, tag, tagColor }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rl-card">
      <div className="rl-card-header">
        <div>
          <div className="rl-card-title">
            {title}
            {tag && (
              <span className="rl-tag" style={{ background: tagColor || '#e2b96f', color: tagColor ? '#fff' : '#7c5c00' }}>
                {tag}
              </span>
            )}
          </div>
          <div className="rl-card-subtitle">{subtitle}</div>
        </div>
      </div>

      <div className="rl-url-row">
        <input
          className="rl-url-input"
          value={url}
          readOnly
          onClick={(e) => e.target.select()}
        />
        <button
          className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline'}`}
          onClick={() => copyToClipboard(url, setCopied)}
          title="Copy link"
        >
          {copied ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
            </>
          )}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sm btn-ghost"
          title="Open link"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Open
        </a>
      </div>

      {qrDataUrl && (
        <div className="rl-qr-section">
          <img src={qrDataUrl} alt={`QR for ${title}`} className="rl-qr-img" />
          <button
            className="btn btn-sm btn-outline"
            onClick={() => downloadDataUrl(qrDataUrl, `${title.toLowerCase().replace(/\s+/g, '-')}-qr.png`)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download QR
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RegistrationLinks() {
  const { user }             = useAuth();
  const [qrNormal, setQrNormal] = useState('');
  const [qrVip,    setQrVip]    = useState('');

  const slug       = user?.slug || '';
  const normalUrl  = `${APP_USER_URL}/${slug}`;
  const vipUrl     = `${APP_USER_URL}/${slug}/vip`;

  useEffect(() => {
    if (!slug) return;
    QRCode.toDataURL(normalUrl, { width: 256, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } })
      .then(setQrNormal)
      .catch(() => {});
    QRCode.toDataURL(vipUrl, { width: 256, margin: 2, color: { dark: '#1a1a2e', light: '#fff8e6' } })
      .then(setQrVip)
      .catch(() => {});
  }, [slug, normalUrl, vipUrl]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Registration Links</h1>
      </div>

      <p className="rl-intro">
        Share these links or QR codes so attendees can register. Scan the QR code with any phone camera to open the form.
      </p>

      <div className="rl-grid">
        <LinkCard
          title="Standard Registration"
          subtitle="Public registration form for all attendees"
          url={normalUrl}
          qrDataUrl={qrNormal}
        />
        <LinkCard
          title="VIP Registration"
          subtitle="Private VIP registration form with dark gold theme"
          url={vipUrl}
          qrDataUrl={qrVip}
          tag="VIP"
          tagColor="#b8962e"
        />
      </div>
    </div>
  );
}
