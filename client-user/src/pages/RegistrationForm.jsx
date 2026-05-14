import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import StepIndicator from '../components/StepIndicator';
import PaymentStep from '../components/PaymentStep';
import DIAL_CODES from '../utils/dialCodes';
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

// ─── Lookup field → lookup array key ─────────────────────────────────────────
const FIELD_LOOKUP_MAP = {
  title:            'titles',
  country:          'countries',
  hearAbout:        'hearAbout',
  wingType:         'wingTypes',
};

// ─── Get the form state key for a field ──────────────────────────────────────
// Lookup-backed selects store an ObjectId under `${fieldName}Id`.
// Inline selects (gender, custom) store the option string under `fieldName`.
function stateKey(field) {
  if (field.type === 'select' && FIELD_LOOKUP_MAP[field.fieldName]) {
    return `${field.fieldName}Id`;
  }
  return field.fieldName;
}

// ─── Date formatter ───────────────────────────────────────────────────────────
function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ─── Currency formatter ───────────────────────────────────────────────────────
function fmtCurrency(amount, currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${amount}`;
  }
}

// ─── Build the ordered step list ──────────────────────────────────────────────
function buildSteps(event) {
  if (event?.paymentEnabled) return ['personal', 'session', 'payment', 'review'];
  return ['personal', 'session', 'review'];
}

// ─── Dynamic field component ──────────────────────────────────────────────────
function DynamicField({ field, values, onChange, error, lookups }) {
  const key   = stateKey(field);
  const value = values[key] ?? '';

  // Resolve dial code for landline / mobile fields
  const dialCode = useMemo(() => {
    if (field.type !== 'landline' && field.type !== 'mobile') return '';
    const countryId = values.countryId;
    if (!countryId) return '';
    const country = (lookups?.countries || []).find((c) => c._id === countryId);
    return country ? (DIAL_CODES[country.name] || '') : '';
  }, [field.type, values.countryId, lookups]);

  const label = (
    <label className="field-label">
      {field.label}
      {field.required && <span className="field-required">*</span>}
    </label>
  );

  if (field.type === 'select') {
    const lookupKey = FIELD_LOOKUP_MAP[field.fieldName];
    if (lookupKey) {
      // Lookup-backed select (country, title, etc.) — options come from the DB
      const items = lookups?.[lookupKey] || [];
      return (
        <div className="form-group">
          {label}
          <select
            className={`field-input${error ? ' has-error' : ''}`}
            value={value}
            onChange={(e) => onChange(key, e.target.value)}
          >
            <option value="">Select {field.label}…</option>
            {items.map((item) => (
              <option key={item._id} value={item._id}>{item.name}</option>
            ))}
          </select>
          {error && <span className="field-error-msg">{error}</span>}
        </div>
      );
    }
    // Inline select (gender, custom fields) — options stored in field.options
    const opts = field.options || [];
    return (
      <div className="form-group">
        {label}
        <select
          className={`field-input${error ? ' has-error' : ''}`}
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
        >
          <option value="">Select {field.label}…</option>
          {opts.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {error && <span className="field-error-msg">{error}</span>}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(key, e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--primary-color)', cursor: 'pointer' }}
          />
          <span className="field-label" style={{ marginBottom: 0 }}>
            {field.label}
            {field.required && <span className="field-required">*</span>}
          </span>
        </label>
        {error && <span className="field-error-msg">{error}</span>}
      </div>
    );
  }

  // Radio button group (e.g. Salutation)
  if (field.type === 'radio') {
    const opts = field.options || [];
    return (
      <div className="form-group">
        {label}
        <div className="radio-group">
          {opts.map((opt) => (
            <label key={opt} className={`radio-option${value === opt ? ' radio-option-selected' : ''}`}>
              <input
                type="radio"
                name={field.fieldName}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(key, opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
        {error && <span className="field-error-msg">{error}</span>}
      </div>
    );
  }

  // Phone fields with country dial-code prefix
  if (field.type === 'landline' || field.type === 'mobile') {
    // Separate the local portion from any stored dial-code prefix
    const localPart = dialCode && value.startsWith(dialCode)
      ? value.slice(dialCode.length).trimStart()
      : value;

    return (
      <div className="form-group">
        {label}
        <div className={`phone-input-wrapper${error ? ' has-error' : ''}`}>
          {dialCode && (
            <span className="phone-dial-code" title="Country code">
              {dialCode}
            </span>
          )}
          <input
            className={`phone-local-input${!dialCode ? ' no-prefix' : ''}`}
            type="tel"
            value={localPart}
            onChange={(e) => {
              const local = e.target.value;
              onChange(key, dialCode ? `${dialCode} ${local}`.trimEnd() : local);
            }}
            placeholder={dialCode ? 'Phone number' : field.label}
          />
        </div>
        {!dialCode && (
          <span className="phone-no-country-hint">
            Select a country above to get the dial code
          </span>
        )}
        {error && <span className="field-error-msg">{error}</span>}
      </div>
    );
  }

  const typeMap = { email: 'email', phone: 'tel', text: 'text' };
  return (
    <div className="form-group">
      {label}
      <input
        className={`field-input${error ? ' has-error' : ''}`}
        type={typeMap[field.type] || 'text'}
        value={value}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={field.label}
        autoComplete={field.fieldName === 'email' ? 'email' : undefined}
      />
      {error && <span className="field-error-msg">{error}</span>}
    </div>
  );
}

// ─── Step 1 — Personal info ───────────────────────────────────────────────────
function Step1Personal({ formFields, values, onChange, errors, lookups }) {
  const visibleFields = (formFields || []).filter((f) => f.visible !== false);

  // Try to pair firstName / lastName side by side if both are consecutive text fields
  const paired = [];
  let i = 0;
  while (i < visibleFields.length) {
    const curr = visibleFields[i];
    const next = visibleFields[i + 1];
    if (
      curr.fieldName === 'firstName' &&
      next?.fieldName === 'lastName' &&
      curr.type !== 'select' &&
      next?.type !== 'select'
    ) {
      paired.push({ type: 'pair', fields: [curr, next] });
      i += 2;
    } else {
      paired.push({ type: 'single', field: curr });
      i += 1;
    }
  }

  if (visibleFields.length === 0) {
    return (
      <div className="step-content">
        <h2 className="step-heading">Personal Information</h2>
        <p style={{ color: 'var(--text-light)', fontSize: 14 }}>
          No form fields have been configured. Please contact the event organizer.
        </p>
      </div>
    );
  }

  return (
    <div className="step-content">
      <h2 className="step-heading">Personal Information</h2>
      {paired.map((item, idx) => {
        if (item.type === 'pair') {
          return (
            <div key={idx} className="form-row-2">
              {item.fields.map((f) => (
                <DynamicField
                  key={f.fieldName}
                  field={f}
                  values={values}
                  onChange={onChange}
                  error={errors[stateKey(f)]}
                  lookups={lookups}
                />
              ))}
            </div>
          );
        }
        return (
          <DynamicField
            key={item.field.fieldName}
            field={item.field}
            values={values}
            onChange={onChange}
            error={errors[stateKey(item.field)]}
            lookups={lookups}
          />
        );
      })}
    </div>
  );
}

// ─── Step 2 — Session selection ───────────────────────────────────────────────
function Step2Session({ sessions, values, onChange, errors }) {
  return (
    <div className="step-content">
      <h2 className="step-heading">Select a Session</h2>
      <div className="session-grid">
        {sessions.map((s) => {
          const isFull     = s.isFull;
          const isSelected = values.sessionId === s._id;
          const remaining  = s.remainingCapacity;
          const spotsClass = isFull          ? 'spots-full'
                           : remaining <= 10 ? 'spots-few'
                           : 'spots-ok';

          return (
            <div
              key={s._id}
              className={`session-card${isSelected ? ' session-selected' : ''}${isFull ? ' session-full' : ''}`}
              onClick={() => !isFull && onChange('sessionId', s._id)}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={isFull}
              tabIndex={isFull ? -1 : 0}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isFull) onChange('sessionId', s._id); }}
            >
              {/* Check mark for selected */}
              {isSelected && (
                <span className="session-card-check" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="3" width="11" height="11">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}

              <div className="session-name">{s.name}</div>
              <div className="session-date">{fmtDate(s.date)}</div>

              {isFull ? (
                <span className="session-full-badge">Session Full</span>
              ) : (
                <span className={`session-spots ${spotsClass}`}>
                  {remaining <= 10
                    ? `Only ${remaining} spot${remaining !== 1 ? 's' : ''} left!`
                    : `${remaining} spots remaining`
                  }
                </span>
              )}
            </div>
          );
        })}
      </div>

      {errors.sessionId && (
        <p className="session-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
               width="14" height="14">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {errors.sessionId}
        </p>
      )}
    </div>
  );
}

// ─── Step 3 — Review ──────────────────────────────────────────────────────────
function Step3Review({ formFields, values, sessions, lookups, event, submitting, submitError, onSubmit, captchaRef, onCaptchaChange, captchaToken }) {
  const visibleFields = (formFields || []).filter((f) => f.visible !== false);

  function displayValue(field) {
    if (field.type === 'checkbox') return values[field.fieldName] ? 'Yes' : 'No';
    if (field.type === 'select') {
      const lookupKey = FIELD_LOOKUP_MAP[field.fieldName];
      if (lookupKey) {
        // Lookup-backed: resolve stored ObjectId to display name
        const items = lookups?.[lookupKey] || [];
        const id    = values[`${field.fieldName}Id`];
        return items.find((x) => x._id === id)?.name || '—';
      }
      // Inline (gender, custom): value is already the display string
      return values[field.fieldName] || '—';
    }
    return values[field.fieldName] || '—';
  }

  const selectedSession = sessions.find((s) => s._id === values.sessionId);

  return (
    <div className="step-content">
      <h2 className="step-heading">Review Your Registration</h2>

      {submitError && (
        <div className="submit-error">{submitError}</div>
      )}

      {/* Personal info */}
      <div className="review-section">
        <div className="review-section-title">Personal Information</div>
        <div className="review-grid">
          {visibleFields.map((f) => (
            <div key={f.fieldName}>
              <div className="review-field-label">{f.label}</div>
              <div className="review-field-value">{displayValue(f)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Session */}
      <div className="review-section">
        <div className="review-section-title">Session</div>
        {selectedSession ? (
          <div className="review-grid">
            <div>
              <div className="review-field-label">Session</div>
              <div className="review-field-value">{selectedSession.name}</div>
            </div>
            <div>
              <div className="review-field-label">Date</div>
              <div className="review-field-value">{fmtDate(selectedSession.date)}</div>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-light)', fontSize: 14 }}>No session selected</p>
        )}
      </div>

      {/* Payment (if applicable) */}
      {event?.paymentEnabled && (
        <div className="review-section">
          <div className="review-section-title">Payment</div>
          <div className="review-grid">
            <div>
              <div className="review-field-label">Amount</div>
              <div className="review-field-value">{fmtCurrency(event.ticketPrice, event.currency)}</div>
            </div>
            <div>
              <div className="review-field-label">Status</div>
              <div className="review-field-value" style={{ color: 'var(--text-success)' }}>
                ✓ Payment confirmed
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Captcha + Submit */}
      {!submitting && (
        <div style={{ marginTop: 24 }}>
          <ReCAPTCHA
            ref={captchaRef}
            sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'}
            onChange={onCaptchaChange}
          />
        </div>
      )}
      {submitting ? (
        <div className="submit-loading">
          <div className="spinner" />
          <p className="text-medium" style={{ fontSize: 14 }}>Submitting your registration…</p>
        </div>
      ) : (
        <button
          className="btn btn-success btn-lg"
          style={{ marginTop: 16, opacity: captchaToken ? 1 : 0.5, cursor: captchaToken ? 'pointer' : 'not-allowed' }}
          onClick={onSubmit}
          disabled={!captchaToken}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
               width="17" height="17">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Submit Registration
        </button>
      )}
    </div>
  );
}

// ─── Main registration page ───────────────────────────────────────────────────
export default function RegistrationForm({ vip = false }) {
  const { orgSlug } = useParams();
  const navigate    = useNavigate();

  // ── Load state ────────────────────────────────────────────
  const [loadState, setLoadState] = useState('loading'); // loading|loaded|not-found|error
  const [formData, setFormData]   = useState(null);      // { event, pageConfig, sessions, lookups }

  // ── Wizard state ──────────────────────────────────────────
  const [steps, setSteps]       = useState([]);
  const [stepIdx, setStepIdx]   = useState(0);

  // ── Form values & errors ─────────────────────────────────
  const [values, setValues]   = useState({ sessionId: '', paymentIntentId: '' });
  const [errors, setErrors]   = useState({});

  // ── Submission ────────────────────────────────────────────
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Captcha ───────────────────────────────────────────────
  const captchaRef  = useRef(null);
  const [captchaToken, setCaptchaToken] = useState('');

  // ── Embed mode ────────────────────────────────────────────
  const isEmbedded = new URLSearchParams(window.location.search).has('embed');

  // Broadcast height to parent when embedded so iframe resizes automatically
  useEffect(() => {
    if (!isEmbedded) return;
    const notify = () => window.parent.postMessage(
      { type: 'reg-height', height: document.body.scrollHeight }, '*'
    );
    notify();
    const ro = new ResizeObserver(notify);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [isEmbedded, stepIdx]);

  // ── Fetch form config on mount ────────────────────────────
  useEffect(() => {
    const configUrl = vip
      ? `/api/public/${orgSlug}/vip`
      : `/api/public/${orgSlug}`;

    api.get(configUrl)
      .then(({ data }) => {
        setFormData(data);

        // Build wizard steps
        const s = vip ? ['personal', 'session', 'review'] : buildSteps(data.event);
        setSteps(s);

        // Initialise form values from visible formFields
        const init = { sessionId: '', paymentIntentId: '' };
        (data.pageConfig?.formFields || []).forEach((f) => {
          const k = stateKey(f);
          init[k] = f.type === 'checkbox' ? false : '';
        });

        // ── Moyasar redirect handling ─────────────────────────────────────
        // After paying, Moyasar redirects back to /:orgSlug?id=PAY_ID&status=paid
        // Restore the form values saved before the redirect and either jump to
        // the review step (paid) or stay on the payment step (failed).
        const urlParams     = new URLSearchParams(window.location.search);
        const moyasarId     = urlParams.get('id');
        const moyasarStatus = urlParams.get('status');

        if (moyasarId) {
          const raw = sessionStorage.getItem('moyasar_pending');
          if (raw) {
            try {
              const { formValues, slug } = JSON.parse(raw);
              if (slug === orgSlug) {
                sessionStorage.removeItem('moyasar_pending');
                window.history.replaceState({}, '', window.location.pathname);

                if (moyasarStatus === 'paid') {
                  setValues({ ...init, ...formValues, paymentIntentId: moyasarId });
                  setStepIdx(s.length - 1); // jump straight to review
                  setLoadState('loaded');
                  return;
                } else {
                  // Payment failed — restore personal info, land back on payment step
                  setValues({ ...init, ...formValues });
                  setStepIdx(s.indexOf('payment'));
                  setLoadState('loaded');
                  return;
                }
              }
            } catch { /* malformed sessionStorage — fall through to normal init */ }
          }
        }
        // ─────────────────────────────────────────────────────────────────

        setValues(init);

        // Dynamic page title
        document.title = vip
          ? (data.event?.name ? `VIP Registration — ${data.event.name}` : 'VIP Registration')
          : (data.event?.name ? `Register for ${data.event.name}` : 'Event Registration');

        // Apply brand colors
        const primary   = data.pageConfig?.primaryColor   || (vip ? '#1a1a2e' : '#2563eb');
        const secondary = data.pageConfig?.secondaryColor || (vip ? '#e2b96f' : '#64748b');
        const textColor = data.pageConfig?.textColor      || '#ffffff';
        document.documentElement.style.setProperty('--primary-color',   primary);
        document.documentElement.style.setProperty('--secondary-color', secondary);
        document.documentElement.style.setProperty('--text-color',      textColor);

        setLoadState('loaded');
      })
      .catch((err) => {
        if (err.response?.status === 404) setLoadState('not-found');
        else setLoadState('error');
      });

    return () => {
      document.documentElement.style.removeProperty('--primary-color');
      document.documentElement.style.removeProperty('--secondary-color');
      document.documentElement.style.removeProperty('--text-color');
      document.title = 'Event Registration';
    };
  }, [orgSlug, vip]);

  // ── Auto-prefix landline / mobile when country changes ───
  useEffect(() => {
    if (!formData) return;
    const countryId = values.countryId;
    const phoneFields = (formData.pageConfig?.formFields || []).filter(
      (f) => (f.type === 'landline' || f.type === 'mobile') && f.visible !== false
    );
    if (phoneFields.length === 0) return;

    const country  = (formData.lookups?.countries || []).find((c) => c._id === countryId);
    const dialCode = country ? (DIAL_CODES[country.name] || '') : '';

    setValues((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const field of phoneFields) {
        const current   = prev[field.fieldName] || '';
        // Strip any existing +xxx prefix so we only keep the local number
        const localPart = current.replace(/^\+\d[\d\s\-()+]{0,6}\s*/, '').trimStart();
        const newVal    = dialCode ? `${dialCode} ${localPart}`.trimEnd() : localPart;
        if (newVal !== current) {
          next[field.fieldName] = newVal;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.countryId]);

  // ── Value setter ─────────────────────────────────────────
  const handleChange = useCallback((key, val) => {
    setValues((v) => ({ ...v, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  // ── Validate current step ─────────────────────────────────
  function validateStep(stepName) {
    const errs = {};
    if (stepName === 'personal') {
      const { formFields = [] } = formData.pageConfig || {};
      formFields
        .filter((f) => f.visible !== false && f.required)
        .forEach((f) => {
          const k   = stateKey(f);
          const val = values[k];
          if (f.type === 'checkbox') {
            if (!val) errs[k] = `${f.label} is required`;
          } else if (!val || (typeof val === 'string' && !val.trim())) {
            errs[k] = `${f.label} is required`;
          }
        });
    }
    if (stepName === 'session') {
      if (!values.sessionId) errs.sessionId = 'Please select a session to continue.';
    }
    return errs;
  }

  // ── Navigation ────────────────────────────────────────────
  function handleNext() {
    const errs = validateStep(steps[stepIdx]);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStepIdx((i) => i + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleBack() {
    setErrors({});
    setStepIdx((i) => i - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Submit ────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const registerUrl = vip
        ? `/api/public/${orgSlug}/vip/register`
        : `/api/public/${orgSlug}/register`;
      const { data } = await api.post(registerUrl, { ...values, captchaToken });
      const confirmPath = vip
        ? `/${orgSlug}/vip/confirmation/${data.registrantId}`
        : `/${orgSlug}/confirmation/${data.registrantId}`;
      navigate(confirmPath);
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed. Please try again.';
      setSubmitError(msg);
      // Reset captcha so the user can try again
      captchaRef.current?.reset();
      setCaptchaToken('');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Early-exit renders ────────────────────────────────────
  if (loadState === 'loading') {
    return (
      <div className="loading-page">
        <div><div className="spinner" /></div>
      </div>
    );
  }

  if (loadState === 'not-found') {
    return (
      <div className="not-available">
        <div className="not-available-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
               width="28" height="28">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h1 className="not-available-title">Registration Not Available</h1>
        <p className="not-available-sub">
          This registration page is not available. It may have been closed or the link may be incorrect.
        </p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="not-available">
        <div className="not-available-icon" style={{ background: '#fef3c7' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5"
               width="28" height="28">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h1 className="not-available-title">Something Went Wrong</h1>
        <p className="not-available-sub">
          Could not load the registration form. Please check your connection and try again.
        </p>
      </div>
    );
  }

  const { event, pageConfig, sessions, lookups } = formData;
  const { formFields = [], logoUrl, headerText, durationStart, durationEnd, location, footerText, footerLinks = [],
          headerImageUrl, footerImageUrl,
          logoWidth = null, logoHeight = null, logoFit = null, headerPadding = 28,
          headerImageHeight = 180, headerImageFit = null,
          footerImageHeight = 80, footerImageFit = null, footerImagePadding = 0,
          bodyBgType = '', bodyBgColor = '', bodyBgImageUrl = null,
          bodyBgImageSize = 'cover', bodyBgGradient = '',
          cardBgType = '', cardBgColor = '', cardBgGradient = '' } = pageConfig;

  // ── Form card background style ───────────────────────────
  const cardBgStyle =
    cardBgType === 'color'    && cardBgColor
      ? { background: cardBgColor }
    : cardBgType === 'gradient' && cardBgGradient
      ? { background: cardBgGradient }
    : cardBgType === 'glass'
      ? {
          background:           'rgba(255,255,255,0.15)',
          backdropFilter:       'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border:               '1px solid rgba(255,255,255,0.25)',
          boxShadow:            '0 8px 32px rgba(0,0,0,0.2)',
        }
    : {};

  // ── Page background style ───────────────────────────────
  const pageBgStyle =
    bodyBgType === 'color'    && bodyBgColor
      ? { background: bodyBgColor }
    : bodyBgType === 'gradient' && bodyBgGradient
      ? { background: bodyBgGradient }
    : bodyBgType === 'image'  && bodyBgImageUrl
      ? {
          backgroundImage:    `url(${assetUrl(bodyBgImageUrl)})`,
          backgroundSize:     bodyBgImageSize || 'cover',
          backgroundPosition: 'center',
          backgroundRepeat:   bodyBgImageSize === 'repeat' ? 'repeat' : 'no-repeat',
          backgroundAttachment: 'fixed',
        }
    : {};

  const logoStyle = logoFit === 'fill'
    ? { width: '100%', height: 'auto', objectFit: 'contain', maxWidth: 'none', maxHeight: 'none' }
    : logoFit === 'max'
    ? { width: '100%', height: '100%', alignSelf: 'stretch', objectFit: 'fill', maxWidth: 'none', maxHeight: 'none' }
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
    ? { width: '100%', height: footerImageHeight, objectFit: 'contain', display: 'block' }
    : footerImageFit === 'max'
    ? { width: '100%', height: footerImageHeight, objectFit: 'fill', display: 'block' }
    : { width: '100%', height: footerImageHeight, objectFit: 'cover', display: 'block' };
  const currentStep = steps[stepIdx];
  const isLastStep  = stepIdx === steps.length - 1;

  return (
    <div className={`reg-page${vip ? ' vip-mode' : ''}`} style={pageBgStyle}>
      <div className="form-dock">

        {/* ── Header ────────────────────────────── */}
        {!isEmbedded && <header
          className="reg-header"
          style={{
            padding: `${headerPadding}px`,
            ...(headerImageUrl ? {
              backgroundImage: `url(${assetUrl(headerImageUrl)})`,
              backgroundSize: headerBgSize,
              backgroundPosition: 'center',
              minHeight: headerImageHeight,
            } : {}),
          }}
        >
          {logoUrl && (
            <img
              src={assetUrl(logoUrl)}
              alt="Event logo"
              className="reg-header-logo"
              style={{
                ...logoStyle,
                WebkitMaskImage: 'linear-gradient(to right, black 55%, transparent 92%)',
                maskImage:       'linear-gradient(to right, black 55%, transparent 92%)',
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <div
            className="reg-header-info"
            style={logoUrl ? {} : { textAlign: 'center', flex: 'unset', width: '100%' }}
          >
            <h1 className="reg-header-title">{headerText || event.name}</h1>
            {formatDateRange(durationStart, durationEnd) && (
              <p className="reg-header-subtitle">{formatDateRange(durationStart, durationEnd)}</p>
            )}
            {location      && <p className="reg-header-location">{location}</p>}
          </div>
        </header>}

        {/* ── Form card ─────────────────────────── */}
        <div className="reg-card" style={cardBgStyle}>

          {/* Step indicator */}
          <StepIndicator steps={steps} current={stepIdx} />

          {/* Step content */}
          <div className="reg-card-body">

            {/* ── Step 1: Personal info ── */}
            {currentStep === 'personal' && (
              <Step1Personal
                formFields={formFields}
                values={values}
                onChange={handleChange}
                errors={errors}
                lookups={lookups}
              />
            )}

            {/* ── Step 2: Session ── */}
            {currentStep === 'session' && (
              <Step2Session
                sessions={sessions}
                values={values}
                onChange={handleChange}
                errors={errors}
              />
            )}

            {/* ── Step 3: Payment (only when paymentEnabled) ── */}
            {currentStep === 'payment' && (
              <PaymentStep
                orgSlug={orgSlug}
                amount={event.ticketPrice}
                currency={event.currency || 'SAR'}
                formValues={values}
                onBack={handleBack}
              />
            )}

            {/* ── Step 4: Review & submit ── */}
            {currentStep === 'review' && (
              <Step3Review
                formFields={formFields}
                values={values}
                sessions={sessions}
                lookups={lookups}
                event={event}
                submitting={submitting}
                submitError={submitError}
                onSubmit={handleSubmit}
                captchaRef={captchaRef}
                onCaptchaChange={setCaptchaToken}
                captchaToken={captchaToken}
              />
            )}

            {/* ── Default navigation (not on review or payment step) ── */}
            {!isLastStep && currentStep !== 'payment' && (
              <div className="step-nav">
                {stepIdx > 0 && (
                  <button className="btn btn-outline" onClick={handleBack}>
                    ← Back
                  </button>
                )}
                <div className="step-nav-right">
                  <button className="btn btn-primary" onClick={handleNext}>
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* ── Back button on review step ── */}
            {isLastStep && !submitting && (
              <div className="step-nav" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                <button className="btn btn-outline" onClick={handleBack}>
                  ← Back
                </button>
              </div>
            )}

          </div>{/* end reg-card-body */}
        </div>{/* end reg-card */}

        {/* ── Footer ──────────────────────────── */}
        {!isEmbedded && (footerText || footerLinks.length > 0 || footerImageUrl) && (
          <footer className="reg-footer">
            {footerImageUrl && (
              <div style={footerImagePadding > 0 ? { padding: footerImagePadding } : {}}>
                <img
                  src={assetUrl(footerImageUrl)}
                  alt="Footer banner"
                  className="reg-footer-banner"
                  style={footerImgStyle}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}
            {footerText && <p className="reg-footer-text">{footerText}</p>}
            {footerLinks.filter((l) => l.label).length > 0 && (
              <div className="reg-footer-links">
                {footerLinks.filter((l) => l.label).map((link, i) => (
                  <a
                    key={i}
                    href={link.url || '#'}
                    className="reg-footer-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </footer>
        )}

      </div>{/* end form-dock */}
    </div>
  );
}
