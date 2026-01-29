import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePreferencesStore, t } from '@/stores/preferencesStore';
import api from '@/services/api';
import keycloak from '@/services/keycloak';

const Header = () => {
  const { logout, token, isAuthenticated } = useAuthStore() as any;
  const { theme, toggleTheme, language, setLanguage } = usePreferencesStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const initializedRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const snapshotRef = useRef<Record<string, string>>({});

  const globalQuery = searchParams.get('search') || '';
  const isLight = theme === 'light';
  const themeLabel = theme === 'dark' ? t(language, 'brightMode') : t(language, 'darkMode');
  const notifButtonClass = showNotifs
    ? isLight
      ? 'bg-slate-900/5 text-slate-900'
      : 'bg-white/10 text-white'
    : isLight
      ? 'text-slate-600 hover:text-slate-900'
      : 'text-gray-400 hover:text-white';

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

        const getCaseId = (c: any) => {
          const raw = c?.caseId ?? c?.case_id ?? c?.id ?? c?._id ?? c?.uuid ?? '';
          return String(raw || '').trim();
        };

        const buildFingerprint = (c: any) => {
          const title = String(c?.title ?? c?.caseTitle ?? c?.case_title ?? '').trim().toLowerCase();
          const status = String(c?.currentStatus ?? c?.current_status ?? c?.status ?? '').trim().toLowerCase();
          const ts = String(
            c?.updatedAt ??
              c?.updated_at ??
              c?.modifiedAt ??
              c?.modified_at ??
              c?.createdAt ??
              c?.created_at ??
              c?.registrationDate ??
              c?.registration_date ??
              '',
          ).trim();
          const assigned = String(
            c?.assignedInvestigatorId ??
              c?.assigned_investigator_id ??
              c?.assignedInvestigator?.userId ??
              '',
          )
            .trim()
            .toLowerCase();
          const assignedNames = Array.isArray(c?.assignedNames)
            ? c.assignedNames
                .map((n: any) => String(n ?? '').trim().toLowerCase())
                .filter(Boolean)
                .sort()
                .join(',')
            : '';
          return `${title}|${status}|${ts}|${assigned}|${assignedNames}`;
        };

        const res = await api.get('/cases');
        const currentCases = Array.isArray(res.data) ? res.data : [];

        if (!initializedRef.current) {
          const nextSeen = new Set<string>();
          const nextSnapshot: Record<string, string> = {};
          currentCases.forEach((c: any) => {
            const id = getCaseId(c);
            if (!id) return;
            const key = id.toLowerCase();
            nextSeen.add(key);
            nextSnapshot[key] = buildFingerprint(c);
          });
          seenIdsRef.current = nextSeen;
          snapshotRef.current = nextSnapshot;
          initializedRef.current = true;
          return;
        }

        const prevSeen = seenIdsRef.current;
        const prevSnapshot = snapshotRef.current;
        const nextSeen = new Set<string>(prevSeen);
        const nextSnapshot: Record<string, string> = { ...prevSnapshot };

        const newNotifs: any[] = [];
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        currentCases.forEach((c: any) => {
          const id = getCaseId(c);
          if (!id) return;
          const key = id.toLowerCase();
          const fp = buildFingerprint(c);
          const title = String(c?.title ?? c?.caseTitle ?? c?.case_title ?? '').trim();
          const safeTitle = title || String(c?.caseType ?? 'CASE').trim() || 'CASE';

          if (!prevSeen.has(key)) {
            nextSeen.add(key);
            nextSnapshot[key] = fp;
            newNotifs.push({
              id,
              type: 'new',
              title: safeTitle,
              time: nowTime,
            });
            return;
          }

          const prevFp = prevSnapshot[key];
          if (prevFp && fp !== prevFp) {
            nextSnapshot[key] = fp;
            newNotifs.push({
              id,
              type: 'updated',
              title: safeTitle,
              time: nowTime,
            });
          }
        });

        if (newNotifs.length > 0) {
          setNotifications(prev => {
            const merged = [...newNotifs, ...prev];
            const seenNotif = new Set<string>();
            const deduped = merged.filter(n => {
              const k = `${String(n.id).toLowerCase()}|${n.type}|${String(n.time)}`;
              if (seenNotif.has(k)) return false;
              seenNotif.add(k);
              return true;
            });
            return deduped.slice(0, 5);
          });
        }

        seenIdsRef.current = nextSeen;
        snapshotRef.current = nextSnapshot;
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
  }, [token, isAuthenticated]);

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
    <header className="h-20 flex items-center justify-between px-8 bg-[color:var(--pcrs-header)] backdrop-blur-md border-b border-[color:var(--pcrs-border)] sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">{t(language, 'systemActive')}</span>
        </div>

        <div className="hidden md:flex items-center bg-[color:var(--pcrs-surface-2)] px-4 py-2 rounded-xl border border-[color:var(--pcrs-border)] focus-within:border-blue-500/50 transition-all">
          <span className="text-[color:var(--pcrs-muted)] text-sm">🔍</span>
          <input 
            type="text" 
            placeholder={t(language, 'globalSearchPlaceholder')}
            value={globalQuery}
            onChange={handleGlobalSearch}
            className="bg-transparent border-none outline-none text-sm w-80 text-[color:var(--pcrs-text)] ml-3 placeholder-[color:var(--pcrs-muted)] font-bold uppercase tracking-widest"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeLabel}
            className="flex items-center justify-center p-2 rounded-xl bg-[color:var(--pcrs-surface-2)] border border-[color:var(--pcrs-border)] hover:border-blue-500/40 transition-all"
            title={themeLabel}
          >
            <span className="text-sm">{isLight ? '🌙' : '☀️'}</span>
          </button>

          <div
            className="relative flex items-center justify-center p-2 rounded-xl bg-[color:var(--pcrs-surface-2)] border border-[color:var(--pcrs-border)]"
            title={t(language, 'language')}
          >
            <span className="text-sm">🌐</span>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value as any)}
              aria-label={t(language, 'language')}
              className="absolute inset-0 opacity-0 cursor-pointer"
            >
              <option value="en">EN</option>
              <option value="am">AM</option>
            </select>
          </div>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowNotifs(!showNotifs)}
            className={`relative p-2 transition group rounded-xl ${notifButtonClass}`}
          >
            <span className="text-xl block group-hover:scale-110 transition-transform">🔔</span>
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-[color:var(--pcrs-header)] text-[8px] font-black items-center justify-center text-white">
                  {notifications.length}
                </span>
              </span>
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-[-1]" onClick={() => setShowNotifs(false)} />
              <div className="absolute top-full right-0 mt-4 w-80 bg-[color:var(--pcrs-surface)] border border-[color:var(--pcrs-border)] rounded-[2rem] p-6 shadow-2xl animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-[color:var(--pcrs-border)]">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t(language, 'intelligenceAlerts')}</h3>
                  <button onClick={() => setNotifications([])} className="text-[8px] font-bold text-red-500 uppercase hover:underline">{t(language, 'clear')}</button>
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                  {notifications.map((n) => (
                    <div 
                      key={n.id}
                      onClick={() => { navigate(`/cases/${n.id}`); setShowNotifs(false); }}
                      className={`flex gap-4 p-3 hover:bg-white/5 rounded-2xl transition-all cursor-pointer border-l-2 ${
                        n.type === 'updated' ? 'border-amber-500 bg-amber-500/5' : 'border-blue-500 bg-blue-500/5'
                      }`}
                    >
                      <span className="text-lg">📁</span>
                      <div>
                        <div className="flex justify-between items-center w-48">
                          <p className="text-[10px] font-black text-[color:var(--pcrs-text)] uppercase italic">
                            {n.type === 'updated' ? t(language, 'caseUpdated') : t(language, 'newCase')}
                          </p>
                          <span className="text-[8px] text-slate-600">{n.time}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{n.title}</p>
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 && <p className="text-center text-[10px] text-gray-600 py-4 font-bold uppercase">{t(language, 'noAlerts')}</p>}
                </div>
              </div>
            </>
          )}
        </div>
        
        <button onClick={logout} className="px-6 py-2 bg-red-500/10 text-red-500 border border-red-500/20 font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all rounded-lg">
          {t(language, 'logout')}
        </button>
      </div>
    </header>
  );
};

export default Header;
