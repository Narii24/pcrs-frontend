import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import keycloak from '@/services/keycloak';
import { FiShield, FiLoader } from 'react-icons/fi';

const Login = () => {
  const navigate = useNavigate();
  const { isAuthenticated, userInfo, loading } = useAuthStore() as any;

  useEffect(() => {
    // 1. If not logged in, go to Keycloak
    if (!loading && !isAuthenticated) {
      keycloak.login();
    }

    // 2. If logged in, redirect based on the specific username
    if (isAuthenticated && userInfo) {
      const username = userInfo.username || userInfo.preferred_username;
      
      if (username?.toLowerCase() === 'admin01') {
        // FORCE ADMIN TO THEIR EXCLUSIVE PAGE
        navigate('/admin', { replace: true });
      } else {
        // STAFF GO TO NORMAL DASHBOARD
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, userInfo, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
      <div className="max-w-md w-full bg-[#1E293B] rounded-3xl shadow-2xl p-12 text-center border border-slate-700">
        <div className="inline-flex bg-blue-600 p-4 rounded-2xl mb-6 shadow-lg shadow-blue-500/20">
          <FiShield className="text-4xl text-white" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tighter mb-2 uppercase">System Gateway</h1>
        <p className="text-slate-400 text-xs mb-8 uppercase tracking-widest font-bold italic">Authorizing Session...</p>
        <div className="flex justify-center">
          <FiLoader className="text-blue-500 text-2xl animate-spin" />
        </div>
      </div>
    </div>
  );
};

export default Login;
