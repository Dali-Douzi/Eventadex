import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="placeholder-page" style={{ minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 64, fontWeight: 800, color: 'var(--border)', lineHeight: 1 }}>404</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-dark)' }}>Page Not Found</h2>
      <p style={{ fontSize: 14, color: 'var(--text-medium)', maxWidth: 340, textAlign: 'center', lineHeight: 1.6 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/dashboard')}>
        Go to Dashboard
      </button>
    </div>
  );
}
