import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { BadgePrintView, AVAILABLE_FIELDS, DEFAULT_BADGE_CONFIG } from '../components/BadgePrintView';
import { useToast } from '../context/ToastContext';
import { assetUrl } from '../utils/assetUrl';

// ─── Small reusable controls ──────────────────────────────────────────────────

function Toggle({ checked, onChange, title }) {
  return (
    <label className="toggle" title={title}>
      <input type="checkbox" className="toggle-input" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" />
    </label>
  );
}

// Number input with inline unit label
function MmInput({ label, value, onChange, min = 0, max = 300, step = 0.5, unit = 'mm' }) {
  return (
    <div className="bs-mm-row">
      <span className="bs-mm-label">{label}</span>
      <div className="bs-mm-control">
        <input
          className="bs-num-input"
          type="number"
          min={min} max={max} step={step}
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="bs-mm-unit">{unit}</span>
      </div>
    </div>
  );
}

// Color picker row: swatch + hex input
function ColorRow({ label, value, onChange }) {
  return (
    <div className="bs-mm-row">
      <span className="bs-mm-label">{label}</span>
      <div className="color-row" style={{ flex: 1 }}>
        <input type="color" className="color-swatch" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} />
        <input className="input" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="#000000" maxLength={7} style={{ flex: 1 }} />
      </div>
    </div>
  );
}

// Toggle row with optional indent
function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="bs-toggle-row">
      <Toggle checked={checked} onChange={onChange} />
      <span className="bs-toggle-label">{label}</span>
    </div>
  );
}

// Section accordion
function Section({ title, icon, isOpen, onToggle, children }) {
  return (
    <div className="pb-section">
      <button className="pb-section-toggle" onClick={onToggle}>
        <span className="pb-section-left">{icon}{title}</span>
        <svg className={`pb-chevron${isOpen ? ' pb-chevron-open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && <div className="pb-section-body">{children}</div>}
    </div>
  );
}

// Sub-heading within a section
function SubHeading({ children }) {
  return <p className="bs-subheading">{children}</p>;
}

// ─── Section icons ────────────────────────────────────────────────────────────
const CanvasIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>;
const HeaderIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>;
const FieldsIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const FooterIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18"/></svg>;

// ─── Position picker (left / center / right) ──────────────────────────────────
function PosPicker({ value, onChange, options }) {
  return (
    <div className="bs-btn-group">
      {options.map(({ value: v, label }) => (
        <button
          key={v}
          className={`bs-pos-btn${value === v ? ' bs-pos-btn-active' : ''}`}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BadgeSetup() {
  const toast = useToast();
  const [config,      setConfig]      = useState(DEFAULT_BADGE_CONFIG);
  const [orgLogoUrl,  setOrgLogoUrl]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [saveState,   setSaveState]   = useState('idle');
  const [bgUploading, setBgUploading] = useState(false);
  const bgInputRef = useRef(null);

  const [sections, setSections] = useState({
    canvas:  true,
    header:  true,
    fields:  true,
    footer:  true,
  });

  // ── Fetch config + org logo ───────────────────────────────
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

  // ── Generic setters ───────────────────────────────────────
  function set(key, value) { setConfig((c) => ({ ...c, [key]: value })); }
  function toggleSection(key) { setSections((s) => ({ ...s, [key]: !s[key] })); }

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
    set('fields', config.fields.map((f, idx) => idx === i ? { ...f, [key]: value } : f));
  }

  function moveField(i, dir) {
    const fields = [...config.fields];
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[i], fields[j]] = [fields[j], fields[i]];
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

  // ── Full-size preview ─────────────────────────────────────
  function handleFullSizePreview() {
    try { sessionStorage.setItem('badge-preview', JSON.stringify({ config, orgLogoUrl })); } catch {}
    window.open('/admin/badge-preview', '_blank', 'noopener');
  }

  const saveBtnClass = saveState === 'saved' ? 'btn btn-sm btn-success'
    : saveState === 'error' ? 'btn btn-sm btn-danger-ghost'
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
          {[...Array(8)].map((_, i) => (
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

          {/* ════ 1. CANVAS ════ */}
          <Section title="Canvas" icon={<CanvasIcon />} isOpen={sections.canvas} onToggle={() => toggleSection('canvas')}>

            <div className="form-row-2" style={{ marginBottom: 0 }}>
              <MmInput label="Width"  value={config.width}  onChange={(v) => set('width',  v)} min={30}  max={300} step={1} />
              <MmInput label="Height" value={config.height} onChange={(v) => set('height', v)} min={20}  max={300} step={1} />
            </div>

            <MmInput label="Outer padding" value={config.padding} onChange={(v) => set('padding', v)} min={0} max={20} step={0.5} />

            <ColorRow label="Background color" value={config.backgroundColor} onChange={(v) => set('backgroundColor', v)} />

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label">Background Image</label>
              <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>
                Overrides background color when set.
              </p>
              {config.backgroundImageUrl ? (
                <div className="bs-bg-preview">
                  <img src={assetUrl(config.backgroundImageUrl)} alt="Badge background" onError={(e) => { e.target.style.display = 'none'; }} />
                  <button className="btn btn-ghost btn-sm text-danger" onClick={() => set('backgroundImageUrl', '')}>
                    Remove image
                  </button>
                </div>
              ) : (
                <div className="logo-drop-zone" onClick={() => bgInputRef.current?.click()}>
                  <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} style={{ display: 'none' }} />
                  {bgUploading ? (
                    <span className="logo-uploading">Uploading…</span>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" width="22" height="22">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <span className="logo-drop-label">Click to upload</span>
                      <span className="logo-drop-hint">PNG, JPG</span>
                    </>
                  )}
                </div>
              )}
            </div>

          </Section>

          {/* ════ 2. HEADER ════ */}
          <Section title="Header" icon={<HeaderIcon />} isOpen={sections.header} onToggle={() => toggleSection('header')}>

            <MmInput label="Header height" value={config.headerHeight} onChange={(v) => set('headerHeight', v)} min={0} max={60} step={0.5} />

            <SubHeading>Divider</SubHeading>
            <ToggleRow label="Show divider line" checked={config.showHeaderDivider} onChange={(v) => set('showHeaderDivider', v)} />
            {config.showHeaderDivider && (
              <ColorRow label="Divider color" value={config.headerDividerColor} onChange={(v) => set('headerDividerColor', v)} />
            )}

            <SubHeading>Logo</SubHeading>
            <ToggleRow label="Show logo" checked={config.showLogo} onChange={(v) => set('showLogo', v)} />
            {config.showLogo && (<>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Position</label>
                <PosPicker
                  value={config.logoPosition}
                  onChange={(v) => set('logoPosition', v)}
                  options={[
                    { value: 'top-left',   label: '⬅ Left'   },
                    { value: 'top-center', label: '↔ Center' },
                    { value: 'top-right',  label: 'Right ➡'  },
                  ]}
                />
              </div>
              <div className="form-row-2" style={{ marginBottom: 0 }}>
                <MmInput label="Max width"  value={config.logoMaxWidth}  onChange={(v) => set('logoMaxWidth',  v)} min={5} max={100} step={1} />
                <MmInput label="Max height" value={config.logoMaxHeight} onChange={(v) => set('logoMaxHeight', v)} min={3} max={50}  step={1} />
              </div>
            </>)}

            <SubHeading>Event Name</SubHeading>
            <ToggleRow label="Show event name" checked={config.showEventName} onChange={(v) => set('showEventName', v)} />
            {config.showEventName && (<>
              <div className="form-row-2" style={{ marginBottom: 0 }}>
                <MmInput label="Font size" value={config.eventNameSize} onChange={(v) => set('eventNameSize', v)} min={4} max={36} step={0.5} unit="pt" />
                <div className="bs-mm-row">
                  <span className="bs-mm-label">Weight</span>
                  <select
                    className="input"
                    style={{ flex: 1 }}
                    value={config.eventNameWeight ?? 600}
                    onChange={(e) => set('eventNameWeight', Number(e.target.value))}
                  >
                    <option value={300}>Light</option>
                    <option value={400}>Normal</option>
                    <option value={500}>Medium</option>
                    <option value={600}>Semibold</option>
                    <option value={700}>Bold</option>
                    <option value={800}>Extra Bold</option>
                  </select>
                </div>
              </div>
              <ColorRow label="Color" value={config.eventNameColor} onChange={(v) => set('eventNameColor', v)} />
            </>)}

          </Section>

          {/* ════ 3. FIELDS ════ */}
          <Section title="Fields" icon={<FieldsIcon />} isOpen={sections.fields} onToggle={() => toggleSection('fields')}>

            <div className="form-row-2" style={{ marginBottom: 12 }}>
              <MmInput label="Gap between fields" value={config.fieldGap}       onChange={(v) => set('fieldGap',       v)} min={0} max={15} step={0.5} />
              <MmInput label="Vertical padding"   value={config.middlePaddingY} onChange={(v) => set('middlePaddingY', v)} min={0} max={15} step={0.5} />
            </div>

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

                <div className="bs-field-name-cell">
                  <Toggle checked={field.visible !== false} onChange={(v) => updateField(i, 'visible', v)} title="Show on badge" />
                  <span className="bs-field-name-text" style={{ opacity: field.visible === false ? 0.4 : 1 }}>
                    {field.label || field.fieldName}
                  </span>
                </div>

                <input
                  className="bs-num-input"
                  type="number" min={4} max={72}
                  value={field.fontSize || 10}
                  onChange={(e) => updateField(i, 'fontSize', Number(e.target.value) || 10)}
                  title="Font size (pt)"
                  disabled={field.visible === false}
                />

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Toggle
                    checked={field.fontWeight === 'bold'}
                    onChange={(v) => updateField(i, 'fontWeight', v ? 'bold' : 'normal')}
                    title="Bold"
                  />
                </div>

                <input
                  type="color"
                  className="color-swatch bs-field-color"
                  value={field.textColor || '#000000'}
                  onChange={(e) => updateField(i, 'textColor', e.target.value)}
                  title="Text color"
                  disabled={field.visible === false}
                />

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

                <div className="field-reorder">
                  <button className="btn-icon-sq" disabled={i === 0} onClick={() => moveField(i, -1)} title="Move up">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><polyline points="18 15 12 9 6 15" /></svg>
                  </button>
                  <button className="btn-icon-sq" disabled={i === config.fields.length - 1} onClick={() => moveField(i, 1)} title="Move down">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                </div>

              </div>
            ))}

          </Section>

          {/* ════ 4. FOOTER / QR ════ */}
          <Section title="Footer & QR Code" icon={<FooterIcon />} isOpen={sections.footer} onToggle={() => toggleSection('footer')}>

            <MmInput label="Footer height" value={config.footerHeight} onChange={(v) => set('footerHeight', v)} min={0} max={60} step={0.5} />

            <SubHeading>Divider</SubHeading>
            <ToggleRow label="Show divider line" checked={config.showFooterDivider} onChange={(v) => set('showFooterDivider', v)} />
            {config.showFooterDivider && (
              <ColorRow label="Divider color" value={config.footerDividerColor} onChange={(v) => set('footerDividerColor', v)} />
            )}

            <SubHeading>QR Code</SubHeading>
            <ToggleRow label="Show QR code" checked={config.showQrCode} onChange={(v) => set('showQrCode', v)} />
            {config.showQrCode && (<>
              <MmInput label="QR size" value={config.qrSize} onChange={(v) => set('qrSize', v)} min={8} max={50} step={0.5} />
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Position</label>
                <PosPicker
                  value={config.qrPosition}
                  onChange={(v) => set('qrPosition', v)}
                  options={[
                    { value: 'bottom-left',  label: '⬅ Left'   },
                    { value: 'center',       label: '↔ Center' },
                    { value: 'bottom-right', label: 'Right ➡'  },
                  ]}
                />
              </div>
            </>)}

          </Section>

        </div>{/* end pb-config-scroll */}
      </div>{/* end pb-config */}

      {/* ════ RIGHT PREVIEW PANEL ════ */}
      <div className="pb-preview">

        <p className="pb-preview-label">Live Preview</p>
        <p className="bs-dims-label">{config.width} × {config.height} mm</p>

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

        <button className="btn btn-outline btn-sm bs-fullsize-btn" onClick={handleFullSizePreview}>
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

      </div>

    </div>
  );
}
