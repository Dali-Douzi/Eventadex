import { useState, useEffect, useRef } from 'react';

/**
 * GradientBuilder
 *
 * Props:
 *   value    – current CSS gradient string (e.g. "linear-gradient(135deg, #1e3c72, #2a5298)")
 *   onChange – called with the new CSS gradient string whenever angle or stops change
 */

const ANGLES = [
  { arrow: '↑',  deg: 0   },
  { arrow: '↗',  deg: 45  },
  { arrow: '→',  deg: 90  },
  { arrow: '↘',  deg: 135 },
  { arrow: '↓',  deg: 180 },
  { arrow: '↙',  deg: 225 },
  { arrow: '←',  deg: 270 },
  { arrow: '↖',  deg: 315 },
];

const FALLBACK = { angle: 135, stops: ['#667eea', '#764ba2'] };

function parseGradient(str) {
  if (!str) return FALLBACK;
  const m = str.match(/linear-gradient\(\s*(-?\d+)deg\s*,\s*(.+)\s*\)/i);
  if (!m) return FALLBACK;
  const stops = m[2]
    .split(',')
    .map(s => { const h = s.trim().match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/); return h ? h[0] : null; })
    .filter(Boolean);
  return {
    angle: parseInt(m[1]),
    stops: stops.length >= 2 ? stops.slice(0, 4) : FALLBACK.stops,
  };
}

function build(angle, stops) {
  return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
}

// Expand 3-char hex to 6-char for <input type="color">
function toFullHex(h) {
  if (!h || !h.startsWith('#')) return '#000000';
  if (h.length === 4) return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return h.length === 7 ? h : '#000000';
}

export default function GradientBuilder({ value, onChange }) {
  const init = parseGradient(value);
  const [angle, setAngle] = useState(init.angle);
  const [stops, setStops] = useState(init.stops);
  const emittedRef = useRef('');

  // Emit whenever angle or stops change
  useEffect(() => {
    const css = build(angle, stops);
    if (css === emittedRef.current) return;
    emittedRef.current = css;
    onChange(css);
  }, [angle, stops]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync when an external preset is selected
  useEffect(() => {
    if (!value || value === emittedRef.current) return;
    const p = parseGradient(value);
    emittedRef.current = value;
    setAngle(p.angle);
    setStops(p.stops);
  }, [value]);

  function updateStop(i, color) {
    setStops(s => { const n = [...s]; n[i] = color; return n; });
  }

  function addStop() {
    if (stops.length >= 4) return;
    setStops(s => [...s, '#ffffff']);
  }

  function removeStop(i) {
    setStops(s => s.filter((_, j) => j !== i));
  }

  return (
    <div className="grad-builder">
      {/* Live preview strip */}
      <div className="grad-preview-strip" style={{ background: build(angle, stops) }} />

      {/* Direction picker */}
      <div className="grad-directions">
        {ANGLES.map(({ arrow, deg }) => (
          <button
            key={deg}
            type="button"
            className={`grad-dir-btn${angle === deg ? ' active' : ''}`}
            onClick={() => setAngle(deg)}
            title={`${deg}°`}
          >
            {arrow}
          </button>
        ))}
      </div>

      {/* Color stops */}
      <div className="grad-stops">
        {stops.map((color, i) => (
          <div key={i} className="grad-stop-row">
            <input
              type="color"
              className="color-swatch"
              style={{ width: 32, height: 32 }}
              value={toFullHex(color)}
              onChange={e => updateStop(i, e.target.value)}
            />
            <input
              type="text"
              className="input"
              value={color}
              onChange={e => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) updateStop(i, v);
              }}
              maxLength={7}
              placeholder="#000000"
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
            {stops.length > 2 && (
              <button
                type="button"
                className="grad-stop-remove"
                onClick={() => removeStop(i)}
                title="Remove stop"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {stops.length < 4 && (
        <button type="button" className="grad-add-btn" onClick={addStop}>
          + Add color stop
        </button>
      )}
    </div>
  );
}
