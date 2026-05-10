import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg, #f1f5f9)', padding: '24px 16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          background: 'white', borderRadius: 16, padding: '40px 32px',
          maxWidth: 440, width: '100%', textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            width: 60, height: 60, background: '#fee2e2', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', color: '#dc2626',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="28" height="28">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.65, marginBottom: 28 }}>
            We hit an unexpected error. Please try again — your registration has not been submitted.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '11px 24px', borderRadius: 8,
                background: 'var(--primary-color, #2563eb)',
                color: 'white', border: 'none', cursor: 'pointer',
                fontSize: 15, fontWeight: 600,
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '11px 24px', borderRadius: 8, background: 'white',
                color: '#475569', border: '1px solid #e2e8f0', cursor: 'pointer',
                fontSize: 15, fontWeight: 500,
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
