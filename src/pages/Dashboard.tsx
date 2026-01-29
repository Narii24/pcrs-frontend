import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, PlusCircle, BarChart3, Zap, ChevronRight, UserCheck, UserMinus, X, FileText } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import CaseDetails from '@/pages/CaseDetails';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { usePreferencesStore, t } from '@/stores/preferencesStore';

interface AssignmentRecord {
  assignmentId: number;
  caseId: string;
  userId: string;
  userName?: string;
}

interface Investigator {
  userId: string;
  username: string;
  name?: string;
}

interface DashboardProps {
  cases: any[];
  onRefresh?: () => void;
  refreshTrigger?: number;
  deletedCases?: Set<string>;
}

const Dashboard: React.FC<DashboardProps> = ({ cases = [], onRefresh, refreshTrigger, deletedCases }) => {
  console.log('DEBUG: Dashboard received cases:', cases.length);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, isAuthenticated } = useAuthStore() as any;
  const { theme, language } = usePreferencesStore();
  const [assignments, setAssignments] = React.useState<AssignmentRecord[]>([]);
  const [users, setUsers] = React.useState<Investigator[]>([]);
  const [showSummary, setShowSummary] = React.useState(false);
  const [openCaseId, setOpenCaseId] = React.useState<string | null>(null);
  const [localCases, setLocalCases] = React.useState<any[]>([]);

  const usersForbiddenRef = React.useRef(false);

  const getCaseId = React.useCallback((c: any) => {
    const raw = c?.caseId ?? c?.case_id ?? c?.id ?? c?._id ?? c?.uuid ?? '';
    return String(raw || '').trim();
  }, []);

  const getCaseNumber = React.useCallback((c: any) => {
    const raw = c?.caseNumber ?? c?.case_number ?? '';
    return String(raw || '').trim();
  }, []);

  const getPreferredCaseId = React.useCallback(
    (c: any) => {
      const num = getCaseNumber(c);
      if (num) return num.toUpperCase().startsWith('C-') ? num : `C-${num}`;
      const id = getCaseId(c);
      if (id) return id;
      return '';
    },
    [getCaseId, getCaseNumber]
  );

  const loadAssignmentsFromCache = React.useCallback(() => {
    const safeReadArray = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    let allAssignments = safeReadArray('cached_assignments');
    const cachedUsers = safeReadArray('cached_users');
    const pending = safeReadArray('supervisor_pending_assignments');

    if (pending.length > 0) {
      const pendingFiltered = pending.filter((p: any) => {
        return !allAssignments.some(
          (existing: any) =>
            String(existing.caseId).toLowerCase() === String(p.caseId).toLowerCase() &&
            existing.userId === p.userId
        );
      });
      allAssignments = [...allAssignments, ...pendingFiltered];
    }

    setAssignments(allAssignments);
    setUsers(cachedUsers);
  }, []);

  // Initialize localCases with cases prop on mount
  React.useEffect(() => {
    console.log('DEBUG: Dashboard initializing localCases with prop:', cases.length);
    setLocalCases(cases);
  }, []); // Empty dependency means run only once on mount

  // Sync with cases prop changes
  React.useEffect(() => {
    console.log('DEBUG: Dashboard cases prop updated:', cases.length);
    console.log('DEBUG: Dashboard cases prop data:', cases.slice(0, 3)); // Show first 3 cases
    setLocalCases(cases); // Update local state immediately
  }, [cases]);

  const search = (searchParams.get('search') || '').trim().toLowerCase();
  const [activeFilter, setActiveFilter] = React.useState<
    'new' | 'progress' | 'closed' | 'total'
  >('total');

  React.useEffect(() => {
    const loadAssignments = async () => {
      try {
        if (!isAuthenticated || !token) {
          loadAssignmentsFromCache();
          return;
        }

        const [assignedRes, usersRes] = await Promise.allSettled([
          api.get('/assignedcases'),
          usersForbiddenRef.current ? Promise.resolve({ data: [] }) : api.get('/users'),
        ]);

        const safeReadArray = (key: string) => {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        };

        let allAssignments =
          assignedRes.status === 'fulfilled' && Array.isArray((assignedRes as any).value?.data)
            ? (assignedRes as any).value.data
            : safeReadArray('cached_assignments');

        const nextUsers =
          usersRes.status === 'fulfilled' && Array.isArray((usersRes as any).value?.data)
            ? (usersRes as any).value.data
            : safeReadArray('cached_users');

        if (
          usersRes.status === 'rejected' &&
          (usersRes as any).reason?.response?.status === 403
        ) {
          usersForbiddenRef.current = true;
        }

        const pending = safeReadArray('supervisor_pending_assignments');
        if (pending.length > 0) {
          const pendingFiltered = pending.filter((p: any) => {
            return !allAssignments.some(
              (existing: any) =>
                String(existing.caseId).toLowerCase() === String(p.caseId).toLowerCase() &&
                existing.userId === p.userId
            );
          });
          allAssignments = [...allAssignments, ...pendingFiltered];
        }

        setAssignments(allAssignments);
        setUsers(nextUsers);

        if (assignedRes.status === 'fulfilled') {
          localStorage.setItem('cached_assignments', JSON.stringify(allAssignments));
        }
        if (usersRes.status === 'fulfilled') {
          localStorage.setItem('cached_users', JSON.stringify(nextUsers));
        }
      } catch (err: any) {
        loadAssignmentsFromCache();
      }
    };
    loadAssignments();
  }, [isAuthenticated, token, loadAssignmentsFromCache]);

  // Refresh data when triggered from AdminDashboard
  React.useEffect(() => {
    console.log('DEBUG: Dashboard refreshTrigger changed:', refreshTrigger);
    if (refreshTrigger && refreshTrigger > 0) {
      console.log('Dashboard: Refreshing data due to external trigger');
      const loadAssignments = async () => {
        try {
          if (!isAuthenticated || !token) {
            loadAssignmentsFromCache();
            return;
          }

          if (onRefresh) {
            console.log('Dashboard: Triggering parent refresh to update cases');
            onRefresh();
          }

          const [assignedRes, usersRes] = await Promise.allSettled([
            api.get('/assignedcases'),
            usersForbiddenRef.current ? Promise.resolve({ data: [] }) : api.get('/users'),
          ]);

          const safeReadArray = (key: string) => {
            try {
              const raw = localStorage.getItem(key);
              if (!raw) return [];
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          };

          let allAssignments =
            assignedRes.status === 'fulfilled' && Array.isArray((assignedRes as any).value?.data)
              ? (assignedRes as any).value.data
              : safeReadArray('cached_assignments');

          const nextUsers =
            usersRes.status === 'fulfilled' && Array.isArray((usersRes as any).value?.data)
              ? (usersRes as any).value.data
              : safeReadArray('cached_users');

          if (
            usersRes.status === 'rejected' &&
            (usersRes as any).reason?.response?.status === 403
          ) {
            usersForbiddenRef.current = true;
          }

          const pending = safeReadArray('supervisor_pending_assignments');
          if (pending.length > 0) {
            const pendingFiltered = pending.filter((p: any) => {
              return !allAssignments.some(
                (existing: any) =>
                  String(existing.caseId).toLowerCase() === String(p.caseId).toLowerCase() &&
                  existing.userId === p.userId
              );
            });
            allAssignments = [...allAssignments, ...pendingFiltered];
          }

          setAssignments(allAssignments);
          setUsers(nextUsers);

          if (assignedRes.status === 'fulfilled') {
            localStorage.setItem('cached_assignments', JSON.stringify(allAssignments));
          }
          if (usersRes.status === 'fulfilled') {
            localStorage.setItem('cached_users', JSON.stringify(nextUsers));
          }
        } catch (err) {
          loadAssignmentsFromCache();
        }
      };
      loadAssignments();
    }
  }, [refreshTrigger, onRefresh, isAuthenticated, token, loadAssignmentsFromCache]);

  // Real-time sync with localStorage for pending assignments
  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'supervisor_pending_assignments') {
        console.log('Dashboard: Detected pending assignments change');
        loadAssignmentsFromCache();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadAssignmentsFromCache]);

  // Periodic refresh to ensure Dashboard stays in sync with Supervisor
  React.useEffect(() => {
    if (!isAuthenticated || !token) return;

    const interval = setInterval(async () => {
      const [assignedRes, usersRes] = await Promise.allSettled([
        api.get('/assignedcases'),
        usersForbiddenRef.current ? Promise.resolve({ data: [] }) : api.get('/users'),
      ]);

      const isAuthFailure = (res: any) =>
        res.status === 'rejected' &&
        (res.reason?.response?.status === 401 || res.reason?.response?.status === 403);

      if (isAuthFailure(assignedRes)) {
        clearInterval(interval);
        loadAssignmentsFromCache();
        return;
      }

      if (
        usersRes.status === 'rejected' &&
        (usersRes as any).reason?.response?.status === 403
      ) {
        usersForbiddenRef.current = true;
      }

      const safeReadArray = (key: string) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      let allAssignments =
        assignedRes.status === 'fulfilled' && Array.isArray((assignedRes as any).value?.data)
          ? (assignedRes as any).value.data
          : safeReadArray('cached_assignments');

      const nextUsers =
        usersRes.status === 'fulfilled' && Array.isArray((usersRes as any).value?.data)
          ? (usersRes as any).value.data
          : safeReadArray('cached_users');

      const pending = safeReadArray('supervisor_pending_assignments');
      if (pending.length > 0) {
        const pendingFiltered = pending.filter((p: any) => {
          return !allAssignments.some(
            (existing: any) =>
              String(existing.caseId).toLowerCase() === String(p.caseId).toLowerCase() &&
              existing.userId === p.userId
          );
        });
        allAssignments = [...allAssignments, ...pendingFiltered];
      }

      setAssignments(allAssignments);
      setUsers(nextUsers);

      if (assignedRes.status === 'fulfilled') {
        localStorage.setItem('cached_assignments', JSON.stringify(allAssignments));
      }
      if (usersRes.status === 'fulfilled') {
        localStorage.setItem('cached_users', JSON.stringify(nextUsers));
      }
    }, 5000); // Refresh every 5 seconds (authenticated only)

    return () => clearInterval(interval);
  }, [isAuthenticated, token, loadAssignmentsFromCache]);

  const userById = React.useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => {
      map[u.userId] = u.name || u.username || u.userId;
    });
    return map;
  }, [users]);

  const assignmentsByCase = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    assignments.forEach(a => {
      if (!a.caseId) return;
      const key = a.caseId;
      if (!map[key]) map[key] = [];
      const label = a.userName || userById[a.userId] || a.userId;
      if (!map[key].includes(label)) {
        map[key].push(label);
      }
    });
    return map;
  }, [assignments, userById]);

  // Helper to calculate progress percentage based on status
  const getProgressPercent = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('closed')) return 100;
    if (s.includes('progress')) return 60;
    if (s.includes('new') || s.includes('registered')) return 20;
    return 10;
  };

  const getProgressColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('closed')) return 'bg-emerald-500';
    if (s.includes('progress')) return 'bg-yellow-400';
    return 'bg-blue-600';
  };

  const displayCases = React.useMemo(() => {
    const result: any[] = [];
    const seen = new Set<string>();

    for (const c of localCases) {
      const id = getPreferredCaseId(c);
      const key = id ? id.toLowerCase() : '';
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      result.push(c);
    }

    return result;
  }, [getPreferredCaseId, localCases]);

  const sourceCases = displayCases;

  const stats = sourceCases.reduce(
    (acc, c: any) => {
      const status = String(c.currentStatus || '').toLowerCase();

      if (status.includes('closed')) {
        acc.closed += 1;
      } else if (status.includes('progress')) {
        acc.progress += 1;
      } else if (status.includes('new') || status.includes('registered') || status.includes('open')) {
        acc.new += 1;
      }

      acc.total += 1;
      return acc;
    },
    { new: 0, progress: 0, closed: 0, total: 0 }
  );

  const todayKey = new Date().toISOString().slice(0, 10);

  const todaysCases = React.useMemo(
    () =>
      sourceCases.filter((c: any) => {
        const raw =
          c.registrationDate ||
          c.registration_date ||
          c.registeredDate ||
          '';
        if (!raw) return false;
        const dateOnly = String(raw).slice(0, 10);
        return dateOnly === todayKey;
      }),
    [sourceCases, todayKey]
  );

  const todayStats = todaysCases.reduce(
    (acc, c: any) => {
      const status = String(c.currentStatus || '').toLowerCase();

      if (status.includes('closed')) {
        acc.closed += 1;
      } else if (status.includes('progress')) {
        acc.progress += 1;
      } else if (
        status.includes('new') ||
        status.includes('registered') ||
        status.includes('open')
      ) {
        acc.new += 1;
      }

      acc.total += 1;
      return acc;
    },
    { new: 0, progress: 0, closed: 0, total: 0 }
  );

  const todaysBuckets = React.useMemo(() => {
    const buckets: Record<'new' | 'progress' | 'closed', any[]> = {
      new: [],
      progress: [],
      closed: [],
    };

    todaysCases.forEach((c: any) => {
      const status = String(c.currentStatus || '').toLowerCase();

      if (status.includes('closed')) {
        buckets.closed.push(c);
      } else if (status.includes('progress')) {
        buckets.progress.push(c);
      } else if (
        status.includes('new') ||
        status.includes('registered') ||
        status.includes('open')
      ) {
        buckets.new.push(c);
      }
    });

    return buckets;
  }, [todaysCases]);

  const filteredCases = !search
    ? sourceCases
    : sourceCases.filter((c: any) => {
        const id = getPreferredCaseId(c).toLowerCase();
        const number = getCaseNumber(c).toLowerCase();
        const title = String(c.title || '').toLowerCase();
        const status = String(c.currentStatus || '').toLowerCase();
        const location = String(c.location || '').toLowerCase();
        return (
          id.includes(search) ||
          number.includes(search) ||
          title.includes(search) ||
          status.includes(search) ||
          location.includes(search)
        );
      });

  const statusFilteredCases =
    activeFilter === 'total'
      ? filteredCases
      : filteredCases.filter((c: any) => {
          const status = String(c.currentStatus || '').toLowerCase();
          if (activeFilter === 'closed') return status.includes('closed');
          if (activeFilter === 'progress') return status.includes('progress');
          return (
            status.includes('new') ||
            status.includes('registered') ||
            status.includes('open')
          );
        });

  return (
    <div className="flex-1 space-y-10 animate-in fade-in duration-700 overflow-x-hidden overflow-y-auto">
      
      {/* 1. STAT CARDS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveFilter('new')}
          className="text-left"
        >
          <DarkStatCard
            label={t(language, 'new')}
            value={stats.new}
            color="text-blue-400"
            isActive={activeFilter === 'new'}
          />
        </button>
        <button
          onClick={() => setActiveFilter('progress')}
          className="text-left"
        >
          <DarkStatCard
            label={t(language, 'inProgress')}
            value={stats.progress}
            color="text-yellow-400"
            isActive={activeFilter === 'progress'}
          />
        </button>
        <button
          onClick={() => setActiveFilter('closed')}
          className="text-left"
        >
          <DarkStatCard
            label={t(language, 'closed')}
            value={stats.closed}
            color="text-emerald-400"
            isActive={activeFilter === 'closed'}
          />
        </button>
        <button
          onClick={() => setActiveFilter('total')}
          className="text-left"
        >
          <DarkStatCard
            label={t(language, 'total')}
            value={stats.total}
            color="text-purple-400"
            isLast
            isActive={activeFilter === 'total'}
          />
        </button>
      </div>

      {/* 2. MAIN HUB SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: DEPLOYMENT LIST */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter leading-none">
              {language === 'en' ? (
                <>
                  CASE <span className="text-blue-600">DEPLOYMENT</span>
                </>
              ) : (
                <span className="text-blue-600">{t(language, 'caseDeployment')}</span>
              )}
              <p className="text-[7px] not-italic font-bold text-slate-500 uppercase tracking-[0.5em] mt-0.5">
                {t(language, 'operationalHubTotalActivity')}
              </p>
            </h2>
          </div>

          <div className="space-y-4">
            {statusFilteredCases.length === 0 ? (
              <div className="p-24 border-2 border-dashed border-slate-800/50 rounded-[3rem] text-center">
                <p className="text-slate-600 font-black uppercase tracking-widest italic opacity-50">{t(language, 'noActiveDeploymentsFound')}</p>
              </div>
            ) : (
              statusFilteredCases.map((c: any) => {
                const preferredCaseId = getPreferredCaseId(c);
                const preferredCaseNumber = getCaseNumber(c);
                const progress = getProgressPercent(c.currentStatus);
                
                // ROBUST ASSIGNMENT LOOKUP
                let assignedNames: string[] = assignmentsByCase[preferredCaseId] || [];
                if (assignedNames.length === 0) {
                  const rawId = getCaseId(c);
                  if (rawId && assignmentsByCase[rawId]) {
                    assignedNames = assignmentsByCase[rawId];
                  }
                }
                
                // 1. Alias Lookup: Check C- number if UUID has no assignment
                if (assignedNames.length === 0) {
                   // A. If current ID is UUID, check C- alias
                   if (!String(preferredCaseId).startsWith('C-')) {
                       const cNum = preferredCaseNumber;
                       if (cNum) {
                           const cId = cNum.toUpperCase().startsWith('C-') ? cNum : `C-${cNum}`;
                           assignedNames = assignmentsByCase[cId] || [];
                           
                           // Check numeric ID (without C- prefix) as well
                           if (assignedNames.length === 0) {
                               assignedNames = assignmentsByCase[String(cNum)] || [];
                           }
                       }
                   } 
                   // B. If current ID is C-, check hidden UUID
                   else {
                       const hiddenUuid = c.id || c.uuid || c._id || (c as any).uniqueId;
                       if (hiddenUuid && assignmentsByCase[hiddenUuid]) {
                           assignedNames = assignmentsByCase[hiddenUuid];
                       }
                       // Also check numeric ID (without C- prefix) just in case
                       const numericId = String(preferredCaseId).replace(/^C-/i, '');
                       if (assignmentsByCase[numericId]) {
                            const numNames = assignmentsByCase[numericId];
                            if (numNames && numNames.length > 0) assignedNames = numNames;
                       }
                   }
                }

                // 2. Direct Property Fallback: Check assignedInvestigatorId
                if (assignedNames.length === 0 && c.assignedInvestigatorId) {
                    const fallbackName = userById[c.assignedInvestigatorId];
                    if (fallbackName) {
                        assignedNames = [fallbackName];
                    } else {
                         // Fallback to ID if name not found
                        assignedNames = [c.assignedInvestigatorId];
                    }
                }

                const isAssigned = assignedNames.length > 0;
                const hasDocuments = false; // Temporarily disabled
                const barColor = getProgressColor(c.currentStatus);

                return (
                  <div
                    key={`${preferredCaseId || 'case'}-${preferredCaseNumber || 'num'}-${String(
                      c.title || ''
                    )}`}
                    className="group bg-[#0F172A]/40 border border-slate-800/60 rounded-[2.5rem] p-8 hover:border-blue-600/40 transition-all duration-300"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-4 w-full mr-6">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-blue-500 font-bold uppercase tracking-widest">
                            PCRS-{preferredCaseId.substring(0, 8)}
                          </span>
                          
                          {/* ASSIGNED STATUS BADGE */}
                          {isAssigned ? (
                            <div className="flex flex-col items-start gap-1">
                              <span className="flex items-center gap-1 text-[8px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded font-black uppercase">
                                <UserCheck size={10} /> {t(language, 'assigned')}
                              </span>
                              <span className="text-[8px] text-emerald-300 font-semibold uppercase tracking-widest">
                                {t(language, 'leadInvestigator')}: {assignedNames.join(', ')}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[8px] bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded font-black uppercase">
                              <UserMinus size={10} /> {t(language, 'unassigned')}
                            </div>
                          )}

                          {/* DOCUMENT BADGE - Temporarily disabled */}
                          {/* {hasDocuments && (
                            <div className="flex items-center gap-1 text-[8px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded font-black uppercase">
                              <FileText size={10} /> {documentsByCase[c.caseId]} Doc(s)
                            </div>
                          )} */}
                        </div>

                        <h3 className="text-4xl font-black italic uppercase tracking-tighter group-hover:text-blue-400 transition-colors break-words overflow-wrap-anywhere">
                          {c.title}
                        </h3>

                        {/* PROGRESS TRACKING */}
                        <div className="space-y-2 max-w-md">
                          <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
                             <span>
                               {t(language, 'statusLabel')}: {c.currentStatus || t(language, 'unknown')}
                             </span>
                             <span>{progress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
                            <div 
                              className={`h-full transition-all duration-1000 ${barColor}`} 
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        
                        <div className="flex gap-3 pt-2">
                          {/* ANALYZE BUTTON - OPENS MODAL */}
                           <button 
                            onClick={() => setOpenCaseId(preferredCaseId)}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-6 py-2 rounded-lg uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                           >
                            {t(language, 'analyze')}
                           </button>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          console.log('Dashboard: Opening case details for:', preferredCaseId);
                          console.log('Dashboard: Full case object:', c);
                          setOpenCaseId(preferredCaseId);
                        }} 
                        className="p-4 bg-slate-800/30 border border-slate-700 rounded-2xl group-hover:bg-blue-600 transition-all text-[color:var(--pcrs-text)]"
                      >
                        <ChevronRight size={24} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: SYSTEM COMMAND */}
        <div className="space-y-6">
          <div className="bg-[#0F172A]/60 border border-slate-800 rounded-[2.5rem] p-8">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8 text-center">{t(language, 'systemCommand')}</h3>
            <div className="space-y-4">
              <CommandButton 
                label={t(language, 'newCaseFile')} 
                icon={<PlusCircle size={18}/>} 
                primary 
                onClick={() => navigate('/register-case')}
              />
              <CommandButton 
                label={t(language, 'assignedCases')} 
                icon={<UserCheck size={18}/>} 
                onClick={() => navigate('/assign-cases?view=assigned')}
              />
              <CommandButton 
                label={t(language, 'documentArchive')} 
                icon={<FileText size={18}/>} 
                onClick={() => navigate('/assign-cases?view=documents')}
              />
              <CommandButton 
                label={t(language, 'exportSummary')} 
                icon={<BarChart3 size={18}/>} 
                onClick={() => setShowSummary(true)}
              />
            </div>
          </div>
        </div>

      </div>

      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-6">
          <div className="w-full max-w-6xl max-h-[90vh] bg-[#020617] border border-slate-800 rounded-[2.5rem] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-10 py-6 border-b border-slate-800">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em]">
                  {t(language, 'dailyIntelligenceExport')}
                </p>
                <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter text-[color:var(--pcrs-text)]">
                  {t(language, 'todaysCaseSummary')}
                </h2>
              </div>
              <button
                onClick={() => setShowSummary(false)}
                className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                {t(language, 'close')}
              </button>
            </div>

            {todayStats.total === 0 ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center space-y-3">
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em]">
                    {t(language, 'noCaseActivityToday')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t(language, 'summaryZeroDetail')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar px-10 py-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <SummaryStatCard
                    label={t(language, 'newToday')}
                    value={todayStats.new}
                    accent="text-blue-400"
                  />
                  <SummaryStatCard
                    label={t(language, 'inProgressToday')}
                    value={todayStats.progress}
                    accent="text-yellow-400"
                  />
                  <SummaryStatCard
                    label={t(language, 'closedToday')}
                    value={todayStats.closed}
                    accent="text-emerald-400"
                  />
                  <SummaryStatCard
                    label={t(language, 'totalCasesToday')}
                    value={todayStats.total}
                    accent="text-purple-400"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <SummaryColumn
                    title={t(language, 'newCasesToday')}
                    accent="text-blue-400"
                    cases={todaysBuckets.new}
                  />
                  <SummaryColumn
                    title={t(language, 'inProgressCasesToday')}
                    accent="text-yellow-400"
                    cases={todaysBuckets.progress}
                  />
                  <SummaryColumn
                    title={t(language, 'closedCasesToday')}
                    accent="text-emerald-400"
                    cases={todaysBuckets.closed}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Case Details Modal */}
      <AnimatePresence>
        {openCaseId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8"
            onClick={() => setOpenCaseId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-6xl h-[90vh] bg-[color:var(--pcrs-bg)] border border-[color:var(--pcrs-border)] rounded-[2.5rem] overflow-hidden relative shadow-2xl flex flex-col"
            >
              <div className="absolute top-6 right-6 z-10">
                <button
                  onClick={() => setOpenCaseId(null)}
                  className="p-2 bg-slate-800/80 hover:bg-red-500/80 text-slate-400 hover:text-white rounded-full transition-all duration-300 backdrop-blur-md border border-slate-700 hover:border-red-400"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <CaseDetails
                  caseId={openCaseId}
                  embedded
                  onClose={() => setOpenCaseId(null)}
                  theme={theme}
                  onCaseUpdated={() => {
                    console.log('Dashboard: onCaseUpdated called from CaseDetails');
                    if (onRefresh) {
                      console.log('Dashboard: Calling onRefresh');
                      onRefresh();
                    } else {
                      console.log('Dashboard: onRefresh is undefined');
                    }
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Sub-components
const DarkStatCard = ({ label, value, color, isLast, isActive }: any) => {
  const { theme } = usePreferencesStore();
  const isLight = theme === 'light';
  const baseBg = isLight ? 'bg-[color:var(--pcrs-surface)]' : 'bg-[#0F172A]/60';
  const baseBorder = isLight ? 'border-[color:var(--pcrs-border)]' : 'border-slate-800/80';
  const iconColor = isLight ? 'text-slate-300' : 'text-slate-800/50';
  const borderState = isActive
    ? 'border-blue-500/60 shadow-[0_0_40px_rgba(59,130,246,0.3)]'
    : isLast
      ? 'border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.1)]'
      : baseBorder;

  return (
    <div
      className={`relative ${baseBg} border ${borderState} rounded-[2rem] p-5 overflow-hidden transition-all hover:border-blue-500/40`}
    >
      <p className="text-[7px] font-bold text-slate-500 uppercase tracking-[0.3em] mb-1">
        {label}
      </p>
      <p className={`text-3xl md:text-4xl font-black tracking-tighter ${color}`}>
        {value}
      </p>
      <Activity className={`absolute top-3 right-3 ${iconColor}`} size={20} />
    </div>
  );
};

const CommandButton = ({ label, icon, primary, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
      primary ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-800/40 hover:bg-slate-800 text-slate-400 border border-slate-700/50'
    }`}
  >
    {icon} {label}
  </button>
);

const SummaryStatCard = ({ label, value, accent }: any) => (
  <div className="bg-[#020617] border border-slate-800 rounded-2xl px-6 py-4 flex flex-col justify-between">
    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] mb-1">
      {label}
    </p>
    <p className={`text-4xl font-black tracking-tight ${accent}`}>{value}</p>
  </div>
);

const SummaryColumn = ({ title, accent, cases }: any) => (
  <div className="bg-[#020617] border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
    <div className="flex items-baseline justify-between mb-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
        {title}
      </p>
      <span className={`text-xs font-black ${accent}`}>{cases.length}</span>
    </div>
    {cases.length === 0 ? (
      <p className="text-[11px] text-slate-600">
        No cases in this category for today.
      </p>
    ) : (
      <div className="space-y-3">
        {cases.map((c: any) => (
          <button
            key={`${String(c.caseId ?? c.case_id ?? c.id ?? '').trim()}-${String(c.caseNumber ?? c.case_number ?? '').trim()}-${String(
              c.title || ''
            )}`}
            onClick={() => {}}
            className="w-full text-left bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 hover:border-blue-500/50 hover:bg-slate-900 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-widest">
                PCRS-{String(c.caseId ?? c.case_id ?? c.id ?? '').trim().substring(0, 8)}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-100 truncate">
              {c.title}
            </p>
            <p className="text-[10px] text-slate-500">
              Status: {c.currentStatus || 'Unknown'}
            </p>
          </button>
        ))}
      </div>
    )}
  </div>
);

export default Dashboard;
