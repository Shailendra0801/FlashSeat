import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      textAlign: 'center',
      padding: 40,
    }}>
      <h1 style={{ fontSize: '6rem', fontWeight: 900, lineHeight: 1, marginBottom: 16 }}>404</h1>
      <p style={{ fontSize: '1.3rem', opacity: 0.85, marginBottom: 32 }}>
        The page you are looking for does not exist.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '14px 32px',
            background: 'white',
            color: '#667eea',
            border: 'none',
            borderRadius: 50,
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Go to Dashboard
        </button>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '14px 32px',
            background: 'transparent',
            color: 'white',
            border: '2px solid white',
            borderRadius: 50,
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
