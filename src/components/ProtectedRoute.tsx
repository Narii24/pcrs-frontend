import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { userInfo, loading } = useAuthStore() as any;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!userInfo) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { userInfo, loading } = useAuthStore() as any;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const username = String(
    userInfo?.username || userInfo?.preferred_username || ''
  ).toLowerCase();
  const roles: string[] = Array.isArray(userInfo?.roles) ? userInfo.roles : [];
  const isAdmin =
    username === 'admin01' || roles.includes('ADMIN') || userInfo?.role === 'Administrator';

  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export const SupervisorRoute = ({ children }: { children: React.ReactNode }) => {
  const { userInfo, loading } = useAuthStore() as any;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentUsername = userInfo?.username || userInfo?.preferred_username;

  if (currentUsername === 'supervisor01') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">
      <div className="text-center space-y-2">
        <p className="text-2xl font-black tracking-[0.25em] uppercase">Access Denied</p>
        <p className="text-xs text-slate-400 tracking-[0.3em] uppercase">Supervisor clearance required</p>
      </div>
    </div>
  );
};

export const InvestigatorRoute = ({ children }: { children: React.ReactNode }) => {
  const { userInfo, loading } = useAuthStore() as any;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentUsername = String(
    userInfo?.username || userInfo?.preferred_username || ''
  ).toLowerCase();
  const roles: string[] = Array.isArray(userInfo?.roles) ? userInfo.roles : [];

  const isInvestigator =
    roles.includes('INVESTIGATOR') ||
    currentUsername === 'investigator01' ||
    currentUsername === 'inv01' ||
    currentUsername === 'inv02' ||
    currentUsername === 'nardi';

  if (isInvestigator) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">
      <div className="text-center space-y-2">
        <p className="text-2xl font-black tracking-[0.25em] uppercase">Access Denied</p>
        <p className="text-xs text-slate-400 tracking-[0.3em] uppercase">Investigator clearance required</p>
      </div>
    </div>
  );
};

export default ProtectedRoute;
