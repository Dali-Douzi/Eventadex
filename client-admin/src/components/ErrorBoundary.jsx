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
        background: '#f1f5f9', padding: 24, fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          background: 'white', borderRadius: 12, padding: '40px 48px',
          maxWidth: 480, width: '100%', textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          <div style={{
            width: 56, height: 56, background: '#fee2e2', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', color: '#dc2626',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="26" height="26">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
            An unexpected error occurred in the admin panel.
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <><br /><code style={{ fontSize: 12, color: '#94a3b8' }}>{this.state.error.message}</code></>
            )}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={this.handleReset} style={{
              padding: '9px 20px', borderRadius: 7, background: '#2563eb',
              color: 'white', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            }}>
              Try Again
            </button>
            <button onClick={() => window.location.reload()} style={{
              padding: '9px 20px', borderRadius: 7, background: 'white',
              color: '#475569', border: '1px solid #e2e8f0', cursor: 'pointer',
              fontSize: 14, fontWeight: 500,
            }}>
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
