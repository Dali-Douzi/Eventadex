import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import api from '../api/axios';

// ─── Stripe singleton (only initialised once, only if key is configured) ─────
const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripeKey && !stripeKey.startsWith('pk_test_your_')
  ? loadStripe(stripeKey)
  : null;

// ─── Currency formatter ───────────────────────────────────────────────────────
function fmtCurrency(amount, currency) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount}`;
  }
}

// ─── Inner Stripe form (must live inside <Elements>) ─────────────────────────
function StripeForm({ amount, currency, onSuccess, onBack }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError]           = useState('');

  async function handlePay(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError('');

    const { error: stripeErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (stripeErr) {
      setError(stripeErr.message || 'Payment failed. Please try again.');
      setProcessing(false);
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    } else {
      setError(`Unexpected payment status: ${paymentIntent?.status}. Please try again.`);
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handlePay} className="step-content">
      <h2 className="step-heading">Payment</h2>

      {/* Price summary */}
      <div className="payment-price-box">
        <span className="payment-price-label">Event registration fee</span>
        <span className="payment-price-amount">{fmtCurrency(amount, currency)}</span>
      </div>

      {/* Stripe card input */}
      <div className="payment-stripe-wrap">
        <PaymentElement />
      </div>

      {error && (
        <div className="payment-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
               width="15" height="15" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      <div className="payment-secure-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             width="13" height="13">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Secured by Stripe. We never store your card details.
      </div>

      {/* Navigation */}
      <div className="step-nav">
        <button type="button" className="btn btn-outline" onClick={onBack} disabled={processing}>
          ← Back
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!stripe || processing}
        >
          {processing
            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginBottom: 0, marginRight: 6, display: 'inline-block' }} />Processing…</>
            : `Pay ${fmtCurrency(amount, currency)} →`
          }
        </button>
      </div>
    </form>
  );
}

// ─── Outer wrapper — fetches clientSecret then mounts Elements ───────────────
export default function PaymentStep({ orgSlug, amount, currency, onSuccess, onBack }) {
  const [clientSecret, setClientSecret] = useState('');
  const [loadErr, setLoadErr]           = useState('');
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    api.post(`/api/public/${orgSlug}/create-payment-intent`)
      .then(({ data }) => setClientSecret(data.clientSecret))
      .catch((err) => setLoadErr(
        err.response?.data?.error || 'Could not initialise payment. Please try again.'
      ))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  if (!stripePromise) {
    return (
      <div className="step-content">
        <div className="payment-error">
          Stripe is not configured. Please set VITE_STRIPE_PUBLIC_KEY in your environment.
        </div>
        <div className="step-nav">
          <button className="btn btn-outline" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="payment-loading">
        <div className="spinner" />
        Preparing secure payment…
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="step-content">
        <div className="payment-error">{loadErr}</div>
        <div className="step-nav">
          <button className="btn btn-outline" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  const stripeOpts = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: { colorPrimary: '#2563eb', borderRadius: '8px' },
    },
  };

  return (
    <Elements stripe={stripePromise} options={stripeOpts}>
      <StripeForm
        amount={amount}
        currency={currency}
        onSuccess={onSuccess}
        onBack={onBack}
      />
    </Elements>
  );
}
