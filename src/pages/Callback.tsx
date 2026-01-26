// src/pages/Callback.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const Callback = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useAuthStore();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
    // If there's an error, we might want to go back to login
    if (!loading && error) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, error, navigate]);

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h2>{loading ? 'Finalizing Authentication...' : error ? 'Authentication Failed' : 'Redirecting...'}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default Callback;
