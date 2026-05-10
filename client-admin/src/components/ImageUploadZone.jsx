import { useState, useRef } from 'react';

/**
 * Reusable image upload zone component.
 *
 * Props:
 *   src       – current image URL (absolute). When truthy shows the "filled" state.
 *   loading   – shows a spinner / progress bar.
 *   onFile    – called with a File object when the user selects or drops a file.
 *   onRemove  – called when the user clicks Remove.
 *   label     – used in "Upload {label}" text (optional).
 *   hint      – shown below the label in the empty state (optional).
 *   accept    – MIME types string, default "image/*".
 *   objectFit – CSS object-fit for the thumbnail preview, default "contain".
 */
export default function ImageUploadZone({
  src,
  loading,
  onFile,
  onRemove,
  label = '',
  hint  = 'PNG, JPG, SVG · max 10 MB',
  accept = 'image/*',
  objectFit = 'contain',
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging]   = useState(false);
  const [error,    setError]      = useState('');

  function pickFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large — max 10 MB.');
      return;
    }
    setError('');
    onFile(file);
  }

  function handleChange(e) {
    pickFile(e.target.files?.[0]);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  function handleDragOver(e) { e.preventDefault(); setDragging(true); }
  function handleDragLeave()  { setDragging(false); }

  // ── Filled state ──────────────────────────────────────────────────────────
  if (src) {
    return (
      <div className="iuz-preview-wrap">
        <div className="iuz-preview">
          <img
            src={src}
            alt={label || 'Preview'}
            className="iuz-thumb"
            style={{ objectFit }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          {/* Hover overlay */}
          <div className="iuz-overlay">
            <button
              className="iuz-overlay-btn iuz-btn-replace"
              onClick={() => !loading && inputRef.current?.click()}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Replace
            </button>
            <button
              className="iuz-overlay-btn iuz-btn-remove"
              onClick={onRemove}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Remove
            </button>
          </div>
          {/* Loading bar */}
          {loading && <div className="iuz-loading-bar" />}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        {error && <p className="iuz-error">{error}</p>}
      </div>
    );
  }

  // ── Empty / drop state ────────────────────────────────────────────────────
  return (
    <div
      className={[
        'iuz-zone',
        dragging ? 'iuz-zone--drag'    : '',
        loading  ? 'iuz-zone--loading' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => !loading && inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {loading ? (
        <span className="iuz-spinner" />
      ) : dragging ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" width="28" height="28">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span className="iuz-drop-label" style={{ color: '#2563eb', fontWeight: 600 }}>Drop to upload</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" width="24" height="24">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span className="iuz-drop-label">
            {label ? `Upload ${label}` : 'Click or drag to upload'}
          </span>
          <span className="iuz-hint">{hint}</span>
        </>
      )}

      {error && <p className="iuz-error" onClick={(e) => e.stopPropagation()}>{error}</p>}
    </div>
  );
}
