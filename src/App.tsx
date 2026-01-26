import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Dashboard from '@/pages/Dashboard';
import CaseRegistration from '@/pages/CaseRegistration';
import CaseDetails from '@/pages/CaseDetails';
import CaseList from '@/pages/CaseList';
import CaseAssignment from '@/pages/CaseAssignment';
import Documents from '@/pages/Documents';
import AdminDashboard from '@/AdminDashboard'; 
import ProtectedRoute, { AdminRoute, SupervisorRoute, InvestigatorRoute } from '@/components/ProtectedRoute'; 
import Supervisor from '@/Supervisor';
import Investigator from '@/Investigator';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

const HomeRedirect: React.FC = () => {
  const { userInfo } = useAuthStore() as any;
  const username = String(
    userInfo?.username || userInfo?.preferred_username || ''
  ).toLowerCase();

  if (username === 'admin01') {
    return <Navigate to="/admin" replace />;
  }

  if (username === 'supervisor01') {
    return <Navigate to="/Supervisor" replace />;
  }

  if (username === 'investigator01') {
    return <Navigate to="/investigator" replace />;
  }
  if (username === 'inv01' || username === 'inv02' || username === 'nardi') {
    return <Navigate to="/investigator" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const DashboardEntry: React.FC<{
  cases: any[];
  onRefresh: () => void;
  refreshTrigger: number;
  deletedCases: Set<string>;
}> = ({ cases, onRefresh, refreshTrigger, deletedCases }) => {
  const { userInfo } = useAuthStore() as any;
  const username = String(
    userInfo?.username || userInfo?.preferred_username || ''
  ).toLowerCase();

  if (username === 'admin01') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <Dashboard
      cases={cases}
      onRefresh={onRefresh}
      refreshTrigger={refreshTrigger}
      deletedCases={deletedCases}
    />
  );
};

const App = () => {
  const [cases, setCases] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Global refresh trigger
  const [deletedCases, setDeletedCases] = useState<Set<string>>(new Set()); // Track deleted cases
  const { token, isAuthenticated, error } = useAuthStore() as any;

  const refreshCases = useCallback(async () => {
    console.log('DEBUG: refreshCases called');
    console.log('DEBUG: refreshCases auth state', { tokenPresent: !!token, isAuthenticated });
    try {
      const [casesRes, assignmentsRes] = await Promise.allSettled([
        api.get('/cases'),
        api.get('/assignedcases'),
      ]);

      let nextCases: any[] = [];
      
      if (casesRes.status === 'fulfilled') {
        nextCases = Array.isArray(casesRes.value.data) ? casesRes.value.data : [];
        // Filter out deleted cases
        nextCases = nextCases.filter(c => !deletedCases.has(String(c.caseId || '').toLowerCase()));
        setCases(nextCases);
        localStorage.setItem('cached_cases', JSON.stringify(nextCases));
      }

      if (assignmentsRes.status === 'fulfilled') {
        const fetchedAssignments = Array.isArray(assignmentsRes.value.data) ? assignmentsRes.value.data : [];
        localStorage.setItem('cached_assignments', JSON.stringify(fetchedAssignments));
      }

      // ORPHAN RECOVERY: Fetch assigned cases that are missing from the list
      if (assignmentsRes.status === 'fulfilled' && Array.isArray(assignmentsRes.value.data)) {
        const assignedIds = new Set(assignmentsRes.value.data.map((a: any) => String(a.caseId || '').toLowerCase()));
        const existingIds = new Set(nextCases.map((c: any) => String(c.caseId || '').toLowerCase()));
        const missingIds = Array.from(assignedIds).filter(id => {
            // Strict filter to prevent 404s on bad IDs
            if (!id) return false;
            const strId = String(id);
            if (strId === 'null' || strId === 'undefined') return false;
            // Skip deleted cases
            if (deletedCases.has(strId)) return false;
            return !existingIds.has(id);
        });

        if (missingIds.length > 0) {
          console.log(`App: Recovering ${missingIds.length} missing assigned cases...`);
          const recoveredResults = await Promise.allSettled(
            missingIds.map(id => api.get(`/cases/${id}`))
          );
          const recoveredCases = recoveredResults
            .filter(r => r.status === 'fulfilled')
            .map((r: any) => r.value.data)
            .filter(c => c && (c.caseId || c.id));

          if (recoveredCases.length > 0) {
            nextCases = [...nextCases, ...recoveredCases];
            setCases(nextCases);
          }
        }
      }

      console.log('DEBUG: Total cases before deduplication:', nextCases.length);

      // GLOBAL DEDUPLICATION & MERGE STRATEGY - DISABLED BY USER REQUEST
      // The user wants to see ALL 54 database cases, including potential duplicates/ghost records.
      // We keep the variable name 'uniqueCases' to minimize code changes downstream.
      const uniqueCases = nextCases;

      /*
      const uniqueCases = nextCases.reduce((acc: any[], current: any) => {
          const currentId = current.caseId;
          // Improved Number Extraction
          let currentNum = current.caseNumber || (current as any).case_number;
          if (!currentNum && typeof currentId === 'string' && currentId.startsWith('C-')) {
               currentNum = currentId.replace('C-', '');
          }
          
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const isReal = uuidRegex.test(currentId);
          
          const existingIndex = acc.findIndex(item => {
             const itemId = item.caseId;
             // Improved Number Extraction for Item
             let itemNum = item.caseNumber || (item as any).case_number;
             if (!itemNum && typeof itemId === 'string' && itemId.startsWith('C-')) {
                 itemNum = itemId.replace('C-', '');
             }

             if (itemId === currentId) return true;
             // Strict number comparison
             if (currentNum && itemNum && String(currentNum) === String(itemNum)) return true;
             
             // Cross-check C- ID with Number (Strict Match)
             if (currentId === `C-${itemNum}`) return true;
             if (itemId === `C-${currentNum}`) return true;

             return false;
          });
          
          if (existingIndex > -1) {
              const existing = acc[existingIndex];
              const existingIsReal = uuidRegex.test(existing.caseId);
              if (isReal && !existingIsReal) {
                  // MERGE STRATEGY: Keep assignment info if missing in new real record
                  const merged = { ...current };
                  // Check direct ID or object
                  const existingAssignedId = existing.assignedInvestigatorId || existing.assignedInvestigator?.userId;
                  const currentAssignedId = merged.assignedInvestigatorId || merged.assignedInvestigator?.userId;

                  if (!currentAssignedId && existingAssignedId) {
                      merged.assignedInvestigatorId = existingAssignedId;
                  }
                  if (!merged.caseNumber && existing.caseNumber) {
                       merged.caseNumber = existing.caseNumber;
                  }
                  acc[existingIndex] = merged;
              } else if (!isReal && existingIsReal) {
                   // Existing is real, current is C-. Update existing if it's missing info
                   const merged = { ...existing };
                   let changed = false;
                   
                   const existingAssignedId = merged.assignedInvestigatorId || merged.assignedInvestigator?.userId;
                   const currentAssignedId = current.assignedInvestigatorId || current.assignedInvestigator?.userId;

                   if (!existingAssignedId && currentAssignedId) {
                       merged.assignedInvestigatorId = currentAssignedId;
                       changed = true;
                   }
                   if (!merged.caseNumber && current.caseNumber) {
                       merged.caseNumber = current.caseNumber;
                       changed = true;
                   }
                   if (changed) acc[existingIndex] = merged;
              }
          } else {
              acc.push(current);
          }
          return acc;
        }, []);
        */

      console.log('DEBUG: Final unique cases count:', uniqueCases.length);
      setCases(uniqueCases);

      // Cache the final processed list if we successfully fetched data
      if (casesRes.status === 'fulfilled') {
        localStorage.setItem('cached_cases', JSON.stringify(uniqueCases));
      }

      // Trigger global refresh for all components
      setRefreshTrigger(prev => prev + 1);
      console.log('Global refresh triggered for all dashboard views');
    } catch (err: any) {
      // Fallback if Promise.allSettled fails unexpectedly (though it shouldn't throw)
      console.warn('Refresh failed - Backend may be offline', err);
      if (err?.response?.status === 401) {
        window.location.href = '/login';
      }
    }
  }, [token, isAuthenticated, deletedCases]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem('cached_cases');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          console.log('DEBUG: Loaded cases from cache on start:', parsed.length);
          setCases(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load cached cases on start');
    }
  }, []);

  useEffect(() => {
    try {
      const existing = localStorage.getItem('minio_presign_enabled');
      if (existing === null) {
        localStorage.setItem('minio_presign_enabled', 'false');
      }
    } catch (_) {}
    if (error) return;
    refreshCases();
  }, [refreshCases, error]);

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#020617] text-white p-10">
        <div className="text-center max-w-lg animate-in fade-in zoom-in duration-500">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">System Uplink Failed</h1>
          <p className="text-slate-400 mb-8">{error}</p>
          
          <div className="bg-slate-900/50 p-6 rounded-xl text-left text-sm border border-slate-800 mb-8">
            <p className="font-semibold text-slate-300 mb-3">Troubleshooting Guide:</p>
            <ul className="space-y-2 text-slate-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Start Docker Desktop application
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Ensure Keycloak container is running on port 8080
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Check network connection
              </li>
            </ul>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          <div className="bg-[#020617] h-screen flex flex-col items-center justify-center text-white text-center p-10">
            <p className="animate-pulse font-bold tracking-[0.5em] text-blue-500 text-xs">ESTABLISHING ENCRYPTED LINK...</p>
          </div>
        } />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard 
                cases={cases} 
                setCases={setCases} 
                onRefresh={refreshCases} 
                deletedCases={deletedCases}
                setDeletedCases={setDeletedCases}
              />
            </AdminRoute>
          }
        />

        <Route
          path="/Supervisor"
          element={
            <SupervisorRoute>
              <Supervisor onRefresh={refreshCases} refreshTrigger={refreshTrigger} deletedCases={deletedCases} />
            </SupervisorRoute>
          }
        />

        <Route
          path="/investigator"
          element={
            <InvestigatorRoute>
              <Investigator onRefresh={refreshCases} refreshTrigger={refreshTrigger} deletedCases={deletedCases} />
            </InvestigatorRoute>
          }
        />

        <Route path="/*" element={
          <ProtectedRoute>
            <div className="flex h-screen w-full overflow-hidden bg-[#020617]">
              <Sidebar />
              <div className="flex-1 flex flex-col relative overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                  <Routes>
                    <Route
                      path="/dashboard"
                      element={
                        <DashboardEntry
                          cases={cases}
                          onRefresh={refreshCases}
                          refreshTrigger={refreshTrigger}
                          deletedCases={deletedCases}
                        />
                      }
                    />
                    <Route path="/register-case" element={<CaseRegistration onRefresh={refreshCases} />} />
                    <Route path="/cases" element={<CaseList cases={cases} />} />
                    <Route path="/cases/:id" element={<CaseDetails onCaseUpdated={refreshCases} />} />
                    <Route path="/assign-cases" element={<CaseAssignment />} />
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/" element={<HomeRedirect />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </main>
              </div>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
