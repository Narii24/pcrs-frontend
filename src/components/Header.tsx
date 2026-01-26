import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import keycloak from '@/services/keycloak';

const Header = () => {
  const { logout, token, isAuthenticated } = useAuthStore() as any;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [lastCaseCount, setLastCaseCount] = useState<number | null>(null);

  const globalQuery = searchParams.get('search') || '';

  // 1. LIVE NOTIFICATION POLLING
  useEffect(() => {
    // Don't poll if not logged in or token is missing
    if (!token || !isAuthenticated) return;

    const checkNewCases = async () => {
      try {
        // Proactively refresh token if it's about to expire (within 30s)
        try {
           if (keycloak.authenticated) {
               const refreshed = await keycloak.updateToken(30);
               if (refreshed) {
                   console.debug("Token refreshed during polling");
                   useAuthStore.setState({ token: keycloak.token });
               }
           }
        } catch (refreshError) {
           console.warn("Token refresh failed. Session may be expired.");
           return; // Stop polling iteration if refresh fails
        }

        const res = await api.get('/cases');
        const currentCases = Array.isArray(res.data) ? res.data : [];

        // If this is the first run, just set the baseline count
        if (lastCaseCount === null) {
          setLastCaseCount(currentCases.length);
          return;
        }

        // If new cases are detected
        if (currentCases.length > lastCaseCount) {
          const newEntries = currentCases.slice(0, currentCases.length - lastCaseCount);
          const newNotifs = newEntries.map((c: any) => ({
            id: c.caseId || c.id,
            caseNumber: c.caseNumber,
            title: c.title,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));
          
          setNotifications(prev => [...newNotifs, ...prev].slice(0, 5));
          setLastCaseCount(currentCases.length);
        }
      } catch (err: any) {
        // Prevent console flooding if server is down or 401
        if (!err.response) {
            console.debug("Polling paused: Backend unreachable.");
        } else if (err.response.status === 401) {
            console.warn("Pulse Sync 401: Unauthorized. Pausing poll.");
        } else {
            console.error("Pulse Sync Failed:", err.response.status);
        }
      }
    };

    checkNewCases();
    const interval = setInterval(checkNewCases, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [lastCaseCount, token, isAuthenticated]);

  // 2. GLOBAL SEARCH HANDLER
  const handleGlobalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const newParams = new URLSearchParams(searchParams);
    
    if (val) newParams.set('search', val);
    else newParams.delete('search');

    if (location.pathname !== '/dashboard') {
      navigate(`/dashboard?${newParams.toString()}`);
    } else {
      setSearchParams(newParams);
    }
  };

  return (
    <header className="h-20 flex items-center justify-between px-8 bg-[#06080f]/50 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">System Active</span>
        </div>

        <div className="hidden md:flex items-center bg-white/5 px-4 py-2 rounded-xl border border-white/10 focus-within:border-blue-500/50 transition-all">
          <span className="text-gray-500 text-sm">🔍</span>
          <input 
            type="text" 
            placeholder="Global Intelligence Search..." 
            value={globalQuery}
            onChange={handleGlobalSearch}
            className="bg-transparent border-none outline-none text-sm w-80 text-white ml-3 placeholder-white/20 font-bold uppercase tracking-widest"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          <button 
            onClick={() => setShowNotifs(!showNotifs)}
            className={`relative p-2 transition group rounded-xl ${showNotifs ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <span className="text-xl block group-hover:scale-110 transition-transform">🔔</span>
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-[#06080f] text-[8px] font-black items-center justify-center text-white">
                  {notifications.length}
                </span>
              </span>
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-[-1]" onClick={() => setShowNotifs(false)} />
              <div className="absolute top-full right-0 mt-4 w-80 bg-[#0f111a] border border-white/10 rounded-[2rem] p-6 shadow-2xl animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Intelligence Alerts</h3>
                  <button onClick={() => setNotifications([])} className="text-[8px] font-bold text-red-500 uppercase hover:underline">Clear</button>
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                  {notifications.map((n) => (
                    <div 
                      key={n.id}
                      onClick={() => { navigate(`/cases/${n.id}`); setShowNotifs(false); }}
                      className="flex gap-4 p-3 hover:bg-white/5 rounded-2xl transition-all cursor-pointer border-l-2 border-blue-500 bg-blue-500/5"
                    >
                      <span className="text-lg">📁</span>
                      <div>
                        <div className="flex justify-between items-center w-48">
                          <p className="text-[10px] font-black text-white uppercase italic">New Case</p>
                          <span className="text-[8px] text-slate-600">{n.time}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{n.title}</p>
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 && <p className="text-center text-[10px] text-gray-600 py-4 font-bold uppercase">No Alerts</p>}
                </div>
              </div>
            </>
          )}
        </div>
        
        <button onClick={logout} className="px-6 py-2 bg-red-500/10 text-red-500 border border-red-500/20 font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all rounded-lg">
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
