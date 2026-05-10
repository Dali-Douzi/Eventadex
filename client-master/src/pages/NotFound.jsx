import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f1f5f9', padding: 24, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        textAlign: 'center', maxWidth: 420,
      }}>
        <div style={{ fontSize: 72, fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>
          404
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '12px 0 8px' }}>
          Page Not Found
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '10px 24px', borderRadius: 7, background: '#2563eb',
            color: 'white', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
          }}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
