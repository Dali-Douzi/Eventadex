import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { BadgePrintView, AVAILABLE_FIELDS, DEFAULT_BADGE_CONFIG } from '../components/BadgePrintView';
import { useToast } from '../context/ToastContext';
import { assetUrl } from '../utils/assetUrl';

// ─── Size presets ─────────────────────────────────────────────────────────────

const SIZE_PRESETS = [
  { label: 'Credit Card (85 × 54 mm)',  value: 'credit', w: 85,  h: 54  },
  { label: 'A6 (105 × 74 mm)',          value: 'a6',     w: 105, h: 74  },
  { label: 'Large (120 × 90 mm)',        value: 'large',  w: 120, h: 90  },
  { label: 'Custom',                     value: 'custom', w: null, h: null },
];

function detectPreset(w, h) {
  const found = SIZE_PRESETS.find((p) => p.w === w && p.h === h);
  return found ? found.value : 'custom';
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function Toggle({ checked, onChange, title }) {
  return (
    <label className="toggle" title={title}>
      <input
        type="checkbox"
        className="toggle-input"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" />
    </label>
  );
}

function Section({ title, icon, isOpen, onToggle, children }) {
  return (
    <div className="pb-section">
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

// ─── Section icons ────────────────────────────────────────────────────────────

const SizeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M3 9h18M9 3v18"/>
  </svg>
);
const BgIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);
const LogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
  </svg>
);
const QrIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
    <path d="M14 14h1v1h-1zM17 14h3v3h-3zM14 17h3v3"/>
  </svg>
);
const FieldsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

// ─── Main component ───────────────────────────────────────────────────────────

export default function BadgeSetup() {
  const toast = useToast();
  const [config,     setConfig]     = useState(DEFAULT_BADGE_CONFIG);
  const [orgLogoUrl, setOrgLogoUrl] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saveState,  setSaveState]  = useState('idle'); // idle|saving|saved|error
  const [bgUploading, setBgUploading] = useState(false);

  const [sections, setSections] = useState({
    size:       true,
    background: true,
    logo:       true,
    qr:         true,
    fields:     true,
  });

  const bgInputRef = useRef(null);

  // ── Fetch badge config + org logo on mount ────────────────
  useEffect(() => {
    Promise.all([
      api.get('/api/admin/badge-config'),
      api.get('/api/admin/page-config').catch(() => ({ data: {} })),
    ])
      .then(([{ data: badge }, { data: page }]) => {
        setConfig({
          ...DEFAULT_BADGE_CONFIG,
          ...badge,
          fields: badge.fields?.length ? badge.fields : DEFAULT_BADGE_CONFIG.fields,
        });
        setOrgLogoUrl(page?.logoUrl || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Generic config setter ─────────────────────────────────
  function set(key, value) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function toggleSection(key) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  // ── Size preset handling ──────────────────────────────────
  function handlePreset(value) {
    const preset = SIZE_PRESETS.find((p) => p.value === value);
    if (preset?.w) set('width', preset.w);
    if (preset?.h) set('height', preset.h);
  }

  const currentPreset = detectPreset(config.width, config.height);

  // ── Background image upload ───────────────────────────────
  async function handleBgUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('background', file);
    setBgUploading(true);
    try {
      const { data } = await api.post('/api/admin/badge-config/background', fd);
      set('backgroundImageUrl', data.backgroundImageUrl);
    } catch (err) {
      toast(err.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setBgUploading(false);
      if (bgInputRef.current) bgInputRef.current.value = '';
    }
  }

  // ── Field helpers ─────────────────────────────────────────
  function updateField(i, key, value) {
    set('fields', config.fields.map((f, idx) =>
      idx === i ? { ...f, [key]: value } : f
    ));
  }

  function moveField(i, dir) {
    const fields = [...config.fields];
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[i], fields[j]] = [fields[j], fields[i]];
    // Update order values to match new positions
    set('fields', fields.map((f, idx) => ({ ...f, order: idx })));
  }

  // ── Save ──────────────────────────────────────────────────
  async function handleSave() {
    setSaveState('saving');
    try {
      const { backgroundImageUrl: _bg, organizationId: _oid, ...rest } = config;
      await api.put('/api/admin/badge-config', rest);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2200);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }

  // ── Full-size preview in new tab ──────────────────────────
  function handleFullSizePreview() {
    try {
      sessionStorage.setItem('badge-preview', JSON.stringify({
        config,
        orgLogoUrl,
      }));
    } catch {
      // sessionStorage unavailable — open anyway, will show defaults
    }
    window.open('/admin/badge-preview', '_blank', 'noopener');
  }

  // ── Derived values ────────────────────────────────────────
  const saveBtnClass = saveState === 'saved'
    ? 'btn btn-sm btn-success'
    : saveState === 'error'
      ? 'btn btn-sm btn-danger-ghost'
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
          {[...Array(7)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="skeleton" style={{ flex: 1, height: 34, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 6 }} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton sk-title" style={{ width: 100, marginBottom: 4 }} />
          <div className="skeleton" style={{ flex: 1, borderRadius: 8, maxHeight: 360 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-wrapper">

      {/* ════ LEFT CONFIG PANEL ════ */}
      <div className="pb-config">

        <div className="pb-config-header">
          <span className="pb-config-title">Badge Designer</span>
          <button className={saveBtnClass} onClick={handleSave} disabled={saveState === 'saving'}>
            {saveBtnLabel}
          </button>
        </div>

        <div className="pb-config-scroll">

          {/* ── 1. Badge Size ── */}
          <Section title="Badge Size" icon={<SizeIcon />} isOpen={sections.size} onToggle={() => toggleSection('size')}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label">Preset Size</label>
              <select
                className="input"
                value={currentPreset}
                onChange={(e) => handlePreset(e.target.value)}
              >
                {SIZE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {currentPreset === 'custom' && (
              <div className="form-row-2" style={{ marginBottom: 0 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Width (mm)</label>
                  <input
                    className="input"
                    type="number"
                    min={30} max={300}
                    value={config.width}
                    onChange={(e) => set('width', Number(e.target.value) || 85)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Height (mm)</label>
                  <input
                    className="input"
                    type="number"
                    min={20} max={300}
                    value={config.height}
                    onChange={(e) => set('height', Number(e.target.value) || 54)}
                  />
                </div>
              </div>
            )}
          </Section>

          {/* ── 2. Background ── */}
          <Section title="Background" icon={<BgIcon />} isOpen={sections.background} onToggle={() => toggleSection('background')}>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label">Background Color</label>
              <div className="color-row">
                <input
                  type="color"
                  className="color-swatch"
                  value={config.backgroundColor || '#ffffff'}
                  onChange={(e) => set('backgroundColor', e.target.value)}
                />
                <input
                  className="input"
                  value={config.backgroundColor || ''}
                  onChange={(e) => set('backgroundColor', e.target.value)}
                  placeholder="#ffffff"
                  maxLength={7}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label">Background Image</label>
              <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>
                Image overrides the background color when set.
              </p>

              {config.backgroundImageUrl ? (
                <div className="bs-bg-preview">
                  <img
                    src={assetUrl(config.backgroundImageUrl)}
                    alt="Badge background"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <button
                    className="btn btn-ghost btn-sm text-danger"
                    onClick={() => set('backgroundImageUrl', '')}
                  >
                    Clear background image
                  </button>
                </div>
              ) : (
                <div
                  className="logo-drop-zone"
                  onClick={() => bgInputRef.current?.click()}
                >
                  <input
                    ref={bgInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBgUpload}
                    style={{ display: 'none' }}
                  />
                  {bgUploading ? (
                    <span className="logo-uploading">Uploading…</span>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" width="22" height="22">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <span className="logo-drop-label">Click to upload background</span>
                      <span className="logo-drop-hint">PNG, JPG</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* ── 3. Logo & Event Name ── */}
          <Section title="Logo & Event Name" icon={<LogoIcon />} isOpen={sections.logo} onToggle={() => toggleSection('logo')}>

            <div className="bs-toggle-row">
              <Toggle checked={config.showLogo} onChange={(v) => set('showLogo', v)} />
              <span className="bs-toggle-label">Show logo</span>
            </div>

            {config.showLogo && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Logo Position</label>
                <div className="bs-btn-group">
                  {['top-left', 'top-center', 'top-right'].map((pos) => (
                    <button
                      key={pos}
                      className={`bs-pos-btn${config.logoPosition === pos ? ' bs-pos-btn-active' : ''}`}
                      onClick={() => set('logoPosition', pos)}
                    >
                      {pos === 'top-left' ? '⬅ Left' : pos === 'top-center' ? '↔ Center' : 'Right ➡'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bs-toggle-row">
              <Toggle checked={config.showEventName} onChange={(v) => set('showEventName', v)} />
              <span className="bs-toggle-label">Show event name</span>
            </div>
          </Section>

          {/* ── 4. QR Code ── */}
          <Section title="QR Code" icon={<QrIcon />} isOpen={sections.qr} onToggle={() => toggleSection('qr')}>

            <div className="bs-toggle-row">
              <Toggle checked={config.showQrCode} onChange={(v) => set('showQrCode', v)} />
              <span className="bs-toggle-label">Show QR code</span>
            </div>

            {config.showQrCode && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">QR Position</label>
                <div className="bs-btn-group">
                  {[
                    { value: 'bottom-left',  label: '⬅ Bottom Left' },
                    { value: 'center',       label: '↔ Bottom Center' },
                    { value: 'bottom-right', label: 'Bottom Right ➡' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      className={`bs-pos-btn${config.qrPosition === value ? ' bs-pos-btn-active' : ''}`}
                      onClick={() => set('qrPosition', value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ── 5. Fields ── */}
          <Section title="Fields" icon={<FieldsIcon />} isOpen={sections.fields} onToggle={() => toggleSection('fields')}>

            {/* Column headers */}
            <div className="bs-fields-header">
              <span>Field (toggle to show)</span>
              <span>Size</span>
              <span>Bold</span>
              <span>Color</span>
              <span>Align</span>
              <span>Order</span>
            </div>

            {(config.fields || []).map((field, i) => (
              <div key={field.fieldName} className="bs-field-row">

                {/* Name cell: visible toggle + label */}
                <div className="bs-field-name-cell">
                  <Toggle
                    checked={field.visible !== false}
                    onChange={(v) => updateField(i, 'visible', v)}
                    title="Show on badge"
                  />
                  <span
                    className="bs-field-name-text"
                    style={{ opacity: field.visible === false ? 0.4 : 1 }}
                  >
                    {field.label || field.fieldName}
                  </span>
                </div>

                {/* Font size */}
                <input
                  className="bs-num-input"
                  type="number"
                  min={4} max={36}
                  value={field.fontSize || 10}
                  onChange={(e) => updateField(i, 'fontSize', Number(e.target.value) || 10)}
                  title="Font size (pt)"
                  disabled={field.visible === false}
                />

                {/* Bold toggle */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Toggle
                    checked={field.fontWeight === 'bold'}
                    onChange={(v) => updateField(i, 'fontWeight', v ? 'bold' : 'normal')}
                    title="Bold"
                  />
                </div>

                {/* Text color */}
                <input
                  type="color"
                  className="color-swatch bs-field-color"
                  value={field.textColor || '#000000'}
                  onChange={(e) => updateField(i, 'textColor', e.target.value)}
                  title="Text color"
                  disabled={field.visible === false}
                />

                {/* Alignment */}
                <div className="bs-align-group">
                  {['left', 'center', 'right'].map((a) => (
                    <button
                      key={a}
                      className={`bs-align-btn${field.align === a ? ' bs-align-btn-active' : ''}`}
                      onClick={() => updateField(i, 'align', a)}
                      title={`Align ${a}`}
                      disabled={field.visible === false}
                    >
                      {a === 'left' ? '←' : a === 'center' ? '↔' : '→'}
                    </button>
                  ))}
                </div>

                {/* Reorder */}
                <div className="field-reorder">
                  <button
                    className="btn-icon-sq"
                    disabled={i === 0}
                    onClick={() => moveField(i, -1)}
                    title="Move up"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                  <button
                    className="btn-icon-sq"
                    disabled={i === config.fields.length - 1}
                    onClick={() => moveField(i, 1)}
                    title="Move down"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>

              </div>
            ))}
          </Section>

        </div>{/* end pb-config-scroll */}
      </div>{/* end pb-config */}

      {/* ════ RIGHT PREVIEW PANEL ════ */}
      <div className="pb-preview">

        <p className="pb-preview-label">Live Preview</p>

        <p className="bs-dims-label">
          {config.width} × {config.height} mm
        </p>

        {/* Scaled badge preview */}
        <div className="bs-preview-center">
          <div className="bs-preview-shadow">
            <BadgePrintView
              config={config}
              preview={true}
              previewWidth={300}
              orgLogoUrl={orgLogoUrl}
            />
          </div>
        </div>

        {/* Full-size preview button */}
        <button
          className="btn btn-outline btn-sm bs-fullsize-btn"
          onClick={handleFullSizePreview}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Preview at Full Size
        </button>

        <p className="bs-preview-hint">
          Uses sample data to demonstrate the layout. Save first, then click "Preview at Full Size"
          to judge font sizes at actual print dimensions.
        </p>

      </div>{/* end pb-preview */}

    </div>
  );
}
