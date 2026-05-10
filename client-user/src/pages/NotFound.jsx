import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg, #f1f5f9)', padding: '24px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 80, fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>404</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '16px 0 10px' }}>
        Page Not Found
      </h1>
      <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.65, maxWidth: 360, marginBottom: 32 }}>
        This registration link doesn't exist or may have expired.
        Please check the link and try again, or contact the event organizer.
      </p>
    </div>
  );
}
