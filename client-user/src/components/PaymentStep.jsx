import { useEffect, useRef, useState } from 'react';

const MOYASAR_KEY = import.meta.env.VITE_MOYASAR_PUBLIC_KEY;
const MOYASAR_JS  = 'https://cdn.moyasar.com/moyasar/1.14.0/moyasar.js';
const MOYASAR_CSS = 'https://cdn.moyasar.com/moyasar/1.14.0/moyasar.css';

// ─── Currency formatter ───────────────────────────────────────────────────────
function fmtCurrency(amount, currency) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'SAR',
    }).format(amount);
  } catch {
    return `${currency || 'SAR'} ${amount}`;
  }
}

// ─── Convert to smallest currency unit (halalas for SAR, fils for KWD etc.) ──
function toSmallestUnit(amount, currency) {
  const threeDecimal = ['KWD', 'BHD', 'OMR'];
  const factor = threeDecimal.includes((currency || '').toUpperCase()) ? 1000 : 100;
  return Math.round(amount * factor);
}

// ─── Payment step ─────────────────────────────────────────────────────────────
//
// Flow:
//   1. Saves current form values to sessionStorage so they survive the redirect.
//   2. Loads Moyasar's JS + CSS from CDN.
//   3. Initialises the Moyasar payment form in the `.mysr-form` div.
//   4. After the user pays, Moyasar redirects to:
//        /{orgSlug}?id=PAYMENT_ID&status=paid   (success)
//        /{orgSlug}?id=PAYMENT_ID&status=failed (failure)
//   5. RegistrationForm detects the URL params on mount, restores the saved
//      values from sessionStorage, and either jumps to review (success) or
//      stays on the payment step (failure) with paymentFailed=true.
// ─────────────────────────────────────────────────────────────────────────────
export default function PaymentStep({ orgSlug, vip = false, amount, currency, formValues, onBack, onNext, paymentFailed = false, isWaitlist = false }) {
  const initRef        = useRef(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // React strict-mode fires effects twice in dev — guard against double init
    if (initRef.current) return;
    initRef.current = true;

    // 1. Persist form values so they survive the Moyasar redirect
    sessionStorage.setItem(
      'moyasar_pending',
      JSON.stringify({ formValues, slug: orgSlug })
    );

    // 2. Inject Moyasar CSS (once)
    if (!document.getElementById('moyasar-css')) {
      const link = document.createElement('link');
      link.id   = 'moyasar-css';
      link.rel  = 'stylesheet';
      link.href = MOYASAR_CSS;
      document.head.appendChild(link);
    }

    // 3. Load Moyasar JS then initialise the form
    if (document.getElementById('moyasar-js')) {
      initForm();
    } else {
      const script    = document.createElement('script');
      script.id       = 'moyasar-js';
      script.src      = MOYASAR_JS;
      script.onload   = initForm;
      script.onerror  = () => setLoading(false); // script failed to load
      document.head.appendChild(script);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function initForm() {
    if (!window.Moyasar) return;
    window.Moyasar.init({
      element:             '.mysr-form',
      amount:              toSmallestUnit(amount, currency),
      currency:            (currency || 'SAR').toUpperCase(),
      description:         'Event registration fee',
      publishable_api_key: MOYASAR_KEY,
      // Moyasar appends ?id=PAYMENT_ID&status=paid to this URL after payment.
      // VIP form lives at /:orgSlug/vip, so the callback must match.
      callback_url:        `${window.location.origin}/${orgSlug}${vip ? '/vip' : ''}`,
      methods:             ['creditcard', 'applepay'],
      supported_networks:  ['mada', 'visa', 'mastercard', 'amex'],
    });
    setLoading(false);
  }

  // ── Waitlist — no payment needed ─────────────────────────────────────────
  if (isWaitlist) {
    return (
      <div className="step-content">
        <h2 className="step-heading">Payment</h2>
        <div className="waitlist-payment-notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               width="22" height="22" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <div>
            <strong>This session is currently full.</strong>
            <p style={{ marginTop: 6, marginBottom: 0 }}>
              You're joining the waitlist. No payment is required at this time —
              you'll be contacted if a confirmed spot becomes available.
            </p>
          </div>
        </div>
        <div className="step-nav">
          <button type="button" className="btn btn-outline" onClick={onBack}>← Back</button>
          <div className="step-nav-right">
            <button type="button" className="btn btn-primary" onClick={onNext}>
              Continue to Review →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Misconfigured (no publishable key) ────────────────────────────────────
  if (!MOYASAR_KEY) {
    return (
      <div className="step-content">
        <div className="payment-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               width="16" height="16" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Payment is not configured. Please contact the event organiser.
        </div>
        <div className="step-nav">
          <button className="btn btn-outline" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="step-content">
      <h2 className="step-heading">Payment</h2>

      {/* ── Failed payment banner ────────────────────────────────────────── */}
      {paymentFailed && (
        <div className="payment-error" style={{ marginBottom: 20 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               width="16" height="16" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>
            Your payment was not completed. Please try again or use a different payment method.
          </span>
        </div>
      )}

      {/* ── Price summary ─────────────────────────────────────────────────── */}
      <div className="payment-price-box">
        <span className="payment-price-label">Event registration fee</span>
        <span className="payment-price-amount">{fmtCurrency(amount, currency)}</span>
      </div>

      {/* ── Loading spinner (shown until Moyasar JS initialises the form) ─── */}
      {loading && (
        <div className="payment-loading">
          <div className="spinner" />
          <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 6 }}>
            Loading payment form…
          </p>
        </div>
      )}

      {/* ── Moyasar renders its form into this div ────────────────────────── */}
      <div className="mysr-form" style={{ marginTop: loading ? 0 : 20 }} />

      <div className="payment-secure-note" style={{ marginTop: 12 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             width="13" height="13">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Secured by Moyasar. We never store your card details.
      </div>

      <div className="step-nav">
        <button type="button" className="btn btn-outline" onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  );
}
