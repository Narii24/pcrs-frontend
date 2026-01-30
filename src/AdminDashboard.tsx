import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import keycloak from '@/services/keycloak';
import {
  Search,
  Edit,
  Eye,
  ShieldCheck,
  LayoutDashboard,
  Briefcase,
  Users,
  Bell,
  LogOut,
  ClipboardList,
} from 'lucide-react';
import api from '@/services/api';
import CaseDetails from '@/pages/CaseDetails';
import { useAuthStore } from '@/stores/authStore';
import { usePreferencesStore, t } from '@/stores/preferencesStore';

interface AdminProps {
  cases?: any[];
  setCases?: React.Dispatch<React.SetStateAction<any[]>>;
  onRefresh?: () => void;
  deletedCases?: Set<string>;
  setDeletedCases?: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const AdminDashboard: React.FC<AdminProps> = ({ cases = [], setCases, onRefresh, deletedCases, setDeletedCases }) => {
  const { userInfo, logout } = useAuthStore() as any;
  const { language, theme, toggleTheme, setLanguage } = usePreferencesStore();
  const isLight = theme === 'light';
  const themeLabel = theme === 'dark' ? t(language, 'brightMode') : t(language, 'darkMode');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<'dashboard' | 'cases' | 'assigned' | 'users'>('assigned');
  const [activeFilter, setActiveFilter] = useState<'all' | 'new' | 'progress' | 'closed'>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [keycloakUsers, setKeycloakUsers] = useState<any[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'view' | 'edit' | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);

  const fetchKeycloakUsers = async () => {
    try {
      const response = await axios.get(
        'http://localhost:8080/admin/realms/pcrs-realm/users',
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const kcUsers = Array.isArray(response.data) ? response.data : [];
      setKeycloakUsers(kcUsers);
      console.log('Keycloak users loaded:', kcUsers.length);
    } catch (err: any) {
      console.error('Failed to fetch Keycloak users:', err);
      setKeycloakUsers([]);
    }
  };

  // Fetch data using exact Supervisor.tsx approach
  const loadData = async () => {
    console.log('AdminDashboard: loadData start (Supervisor.tsx logic)');

    const [usersRes, assignmentsRes] = await Promise.allSettled([
      api.get('/users'),
      api.get('/assignedcases'),
    ]);

    let nextCases: any[] = Array.isArray(cases) ? [...cases] : [];
    if (deletedCases && deletedCases.size > 0 && nextCases.length > 0) {
      nextCases = nextCases.filter(c => {
        const id = String(c.caseId || c.case_id || c.id || '').trim().toLowerCase();
        if (!id) return true;
        return !deletedCases.has(id);
      });
    }

    let normalizedUsers: any[] = [];
    const localUserMap: Record<string, string> = {};
    if (usersRes.status === 'fulfilled') {
      const rawUsers = Array.isArray(usersRes.value.data) ? usersRes.value.data : [];
      normalizedUsers = rawUsers
        .map((u: any) => {
          const uid = u.userId || u.userID || u.id || u._id || u.username;
          const uname = u.username || u.userName || u.name || uid;
          const full = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
          const normalized = {
            ...u,
            userId: String(uid),
            username: String(uname),
            name: full || String(uname),
          };
          localUserMap[normalized.userId] = normalized.name;
          return normalized;
        })
        .filter((u: any) => !!u.userId);
    }
    setUsers(normalizedUsers);
    console.log('AdminDashboard: Users processed:', normalizedUsers.length);

    let normalizedAssignments: any[] = [];
    if (assignmentsRes.status === 'fulfilled') {
      const rawAssignments = Array.isArray(assignmentsRes.value.data) ? assignmentsRes.value.data : [];
      normalizedAssignments = rawAssignments
        .map((a: any) => ({
          ...a,
          caseId: a.caseId || a.case_id || a.caseID || a.id || a._id,
          userId: a.userId || a.user_id || a.userID || a.investigatorId,
          userName: a.userName || a.username || a.investigatorName,
          assignmentId: a.assignmentId || a.assignment_id || a.id,
        }))
        .filter((a: any) => a.caseId && a.userId);
    } else {
      try {
        const cached = localStorage.getItem('cached_assignments');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            normalizedAssignments = parsed
              .map((a: any) => ({
                ...a,
                caseId: a.caseId || a.case_id || a.caseID || a.id || a._id,
                userId: a.userId || a.user_id || a.userID || a.investigatorId,
                userName: a.userName || a.username || a.investigatorName,
                assignmentId: a.assignmentId || a.assignment_id || a.id,
              }))
              .filter((a: any) => a.caseId && a.userId);
          }
        }
      } catch (_) {}
    }

    if ((normalizedAssignments?.length || 0) === 0 && Array.isArray(nextCases)) {
      const derived: any[] = [];
      nextCases.forEach((c: any) => {
        const directId =
          c.assignedInvestigatorId ||
          c.assigned_investigator_id ||
          c.investigatorId ||
          c.userId ||
          c.user_id;
        if (directId) {
          derived.push({
            caseId: c.caseId,
            userId: directId,
            userName:
              localUserMap[String(directId)] ||
              c.assignedInvestigator?.name ||
              c.assignedInvestigator?.username,
          });
        }
      });
      if (derived.length > 0) normalizedAssignments = derived;
    }

    console.log('AdminDashboard: Assignments loaded:', normalizedAssignments.length);

    setAssignments(normalizedAssignments);

    console.log('AdminDashboard: loadData complete (Supervisor.tsx logic)');
  };

  // Fetch data on component mount using Supervisor.tsx approach
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeSection !== 'users') return;
    if (keycloakUsers.length > 0) return;
    fetchKeycloakUsers();
  }, [activeSection, keycloakUsers.length]);

  // Build userById map like Supervisor.tsx
  const userById = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => {
      const full = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      map[u.userId] = full || u.username || u.userId;
    });
    return map;
  }, [users]);

  // Enrich cases with assignment data like Supervisor.tsx
  const casesWithAssignments = useMemo(() => {
    const uuidToNumber = new Map<string, string>();
    cases.forEach((c: any) => {
      const u = c.caseId || c.uuid || c.id || c._id;
      const n = c.caseNumber || (c as any).case_number;
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (u && n && uuidRegex.test(String(u))) {
        uuidToNumber.set(String(u).toLowerCase(), String(n));
      }
      if (typeof u === 'string' && u.startsWith('C-')) {
        const extracted = u.replace('C-', '');
        if (extracted) uuidToNumber.set(u.toLowerCase(), extracted);
      }
    });

    const finalAssignMap = new Map<string, string[]>();

    assignments.forEach((a: any) => {
      if (!a.caseId) return;
      const uId = a.userId;
      const uName = userById[uId] || a.userName || uId || 'Unknown';

      const keys = new Set<string>();
      keys.add(String(a.caseId).toLowerCase());

      const numMatch = String(a.caseId).match(/(\d+)/);
      if (numMatch) {
        keys.add(numMatch[1]);
        keys.add(`c-${numMatch[1]}`);
      }

      const mappedNumber = uuidToNumber.get(String(a.caseId).toLowerCase());
      if (mappedNumber) {
        keys.add(mappedNumber);
        keys.add(`c-${mappedNumber}`);
      }

      keys.forEach(k => {
        const kNorm = String(k).toLowerCase();
        if (!finalAssignMap.has(kNorm)) finalAssignMap.set(kNorm, []);
        const list = finalAssignMap.get(kNorm)!;
        if (!list.includes(uName)) list.push(uName);
      });
    });

    return cases.map((c: any) => {
      const cId = String(c.caseId || '').toLowerCase();
      let names = finalAssignMap.get(cId) || [];

      if (names.length === 0) {
        const num = c.caseNumber || (c as any).case_number;
        if (num) {
          const n = String(num).toLowerCase();
          names = finalAssignMap.get(n) || [];
          if (names.length === 0) names = finalAssignMap.get(`c-${n}`) || [];
        }
      }

      if (
        names.length === 0 &&
        typeof c.caseId === 'string' &&
        c.caseId.startsWith('C-')
      ) {
        const extracted = c.caseId.replace('C-', '').toLowerCase();
        if (extracted) {
          names = finalAssignMap.get(extracted) || [];
          if (names.length === 0)
            names = finalAssignMap.get(`c-${extracted}`) || [];
        }
      }

      if (names.length === 0) {
        const directId =
          c.assignedInvestigatorId ||
          c.assigned_investigator_id ||
          c.investigatorId ||
          c.userId ||
          c.user_id;
        if (directId) {
          const mappedName = userById[directId] || directId;
          names = [mappedName];
        }
      }

      if (names.length > 0) {
        return { ...c, assignedNames: names };
      }
      return c;
    });
  }, [cases, assignments, userById]);

  // Match Supervisor.tsx structure exactly - use existing casesWithAssignments
  const visibleCases = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return casesWithAssignments;
    return casesWithAssignments.filter(c => {
      const id = String(c.caseId || '').toLowerCase();
      const title = String(c.title || '').toLowerCase();
      const status = String(c.currentStatus || '').toLowerCase();
      const location = String(c.location || '').toLowerCase();
      return (
        id.includes(query) ||
        title.includes(query) ||
        status.includes(query) ||
        location.includes(query)
      );
    });
  }, [casesWithAssignments, searchTerm]);

  // Exact Supervisor.tsx assignedCases logic
  const assignedCases = useMemo(() => {
    const seen = new Set<string>();
    const normalize = (c: any) => {
      const cid = String(c.caseId || '').toLowerCase();
      const num = c.caseNumber || (c as any).case_number;
      if (cid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(cid)) return cid;
      if (typeof c.caseId === 'string' && c.caseId.startsWith('C-')) return c.caseId.slice(2);
      if (num) return String(num);
      return cid;
    };
    return visibleCases.filter(c => {
      const isAssigned = (c.assignedNames || []).length > 0 || !!c.assignedInvestigatorId || !!c.assignedInvestigator;
      if (!isAssigned) return false;
      const key = normalize(c);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [visibleCases]);

  // Debug logging to track Supervisor.tsx logic
  useEffect(() => {
    console.log('=== AdminDashboard Supervisor.tsx Logic Debug ===');
    console.log('1. Total cases:', cases.length);
    console.log('2. Assignments loaded:', assignments.length);
    console.log('3. Cases with assignments:', casesWithAssignments.length);
    console.log('4. Visible cases (search filtered):', visibleCases.length);
    console.log('5. Assigned cases (final):', assignedCases.length);
    console.log('6. Assigned cases list:', assignedCases.map(c => ({
      caseId: c.caseId,
      title: c.title,
      assignedNames: c.assignedNames,
      assignedInvestigatorId: c.assignedInvestigatorId
    })));
    console.log('===============================================');
  }, [cases, assignments, casesWithAssignments, visibleCases, assignedCases]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    
    const newCount = cases.filter(c => {
      const caseDate = new Date(c.createdAt || c.createdDate || c.registrationDate);
      caseDate.setHours(0, 0, 0, 0); // Set to start of case date
      return caseDate.getTime() === today.getTime();
    }).length;
    
    const progressCount = cases.filter(c => c.currentStatus && c.currentStatus.toLowerCase().includes('progress')).length;
    const closedCount = cases.filter(c => c.currentStatus && c.currentStatus.toLowerCase().includes('closed')).length;
    return { new: newCount, progress: progressCount, closed: closedCount, total: cases.length };
  }, [cases]);

  const filteredCases = useMemo(() => {
    let baseCases = cases;
    
    // Apply status filter (for Dashboard section)
    if (activeFilter === 'new') {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of today
      
      baseCases = cases.filter(c => {
        const caseDate = new Date(c.createdAt || c.createdDate || c.registrationDate);
        caseDate.setHours(0, 0, 0, 0); // Set to start of case date
        return caseDate.getTime() === today.getTime();
      });
    } else if (activeFilter === 'progress') {
      baseCases = cases.filter(c => c.currentStatus && c.currentStatus.toLowerCase().includes('progress'));
    } else if (activeFilter === 'closed') {
      baseCases = cases.filter(c => c.currentStatus && c.currentStatus.toLowerCase().includes('closed'));
    }
    
    // Apply search filter
    if (!searchTerm) return baseCases;
    const query = searchTerm.toLowerCase();
    return baseCases.filter((c: any) => {
      const id = String(c.caseId || c.id || '').toLowerCase();
      const number = String(c.caseNumber || '').toLowerCase();
      const title = String(c.title || '').toLowerCase();
      return id.includes(query) || number.includes(query) || title.includes(query);
    });
  }, [cases, searchTerm, activeFilter]);

  const allCasesForCasesSection = useMemo(() => {
    // Always show all cases for the Cases section
    if (!searchTerm) return cases;
    const query = searchTerm.toLowerCase();
    return cases.filter((c: any) => {
      const id = String(c.caseId || c.id || '').toLowerCase();
      const number = String(c.caseNumber || '').toLowerCase();
      const title = String(c.title || '').toLowerCase();
      return id.includes(query) || number.includes(query) || title.includes(query);
    });
  }, [cases, searchTerm]);

  // Use the already defined assignedCases from above
  const assignedCasesForSection = useMemo(() => {
    // Show assigned cases for the Assigned section - use the already filtered assignedCases
    return assignedCases;
  }, [assignedCases]);

  const getStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    let style = '';
    let label = '';
    
    if (!status || normalized === 'registered') {
      style = isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      label = t(language, 'newCase');
    } else if (normalized.includes('progress')) {
      style = isLight ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-orange-500/10 text-orange-300 border-orange-500/20';
      label = status;
    } else if (normalized.includes('closed')) {
      style = isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      label = status;
    } else {
      style = isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-white/5 text-slate-300 border-white/10';
      label = status;
    }
    
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${style}`}>
        {label}
      </span>
    );
  };

  const handleView = (caseId: string) => {
    setSelectedCaseId(caseId);
    setDetailMode('view');
  };

  const handleEdit = (caseId: string) => {
    setSelectedCaseId(caseId);
    setDetailMode('edit');
  };

  return (
    <div
      className={`flex h-screen ${
        isLight
          ? 'bg-slate-50 text-slate-900'
          : 'bg-gradient-to-r from-[#00040F] to-[#0A1631] text-white'
      }`}
    >
      <aside
        className={`w-72 flex flex-col ${
          isLight ? 'bg-white border-r border-slate-200 text-slate-900' : 'bg-[#0f172a] text-white'
        }`}
      >
        <div className="px-8 pt-8 pb-6 flex items-center gap-3">
          <div
            className={`p-2 rounded-xl border ${
              isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-600/10 border-blue-500/40'
            }`}
          >
            <ShieldCheck className={isLight ? 'text-blue-600' : 'text-blue-400'} size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black">{t(language, 'adminPanel')}</h1>
            <p
              className={`text-[11px] font-semibold uppercase tracking-widest ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {t(language, 'pcrManagement')}
            </p>
          </div>
        </div>

        <nav className="mt-4 flex-1 px-4 space-y-2">
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition ${
              activeSection === 'dashboard'
                ? 'bg-blue-600 text-white'
                : isLight
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <LayoutDashboard size={18} />
            <span>{t(language, 'dashboard')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('cases')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition ${
              activeSection === 'cases'
                ? 'bg-blue-600 text-white'
                : isLight
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Briefcase size={18} />
            <span>{t(language, 'cases')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('assigned')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition ${
              activeSection === 'assigned'
                ? 'bg-blue-600 text-white'
                : isLight
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <ClipboardList size={18} />
            <span>{t(language, 'assignedCases')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition ${
              activeSection === 'users'
                ? 'bg-blue-600 text-white'
                : isLight
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Users size={18} />
            <span>{t(language, 'users')}</span>
          </button>
        </nav>

        <div className="mt-auto px-4 pb-6">
          <div
            className={`rounded-2xl border p-4 flex items-center gap-4 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/20">
              {String(userInfo?.name || userInfo?.username || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p
                className={`text-[10px] font-black uppercase tracking-widest ${
                  isLight ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {t(language, 'administrator')}
              </p>
              <p className={`text-sm font-bold truncate italic ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {userInfo?.name || userInfo?.username || userInfo?.preferred_username || 'admin'}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-tighter">
                  {t(language, 'authorized')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header
          className={`px-10 py-6 ${
            isLight
              ? 'bg-white border-b border-slate-200'
              : 'bg-white/5 backdrop-blur-md border-b border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-2xl font-black uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {activeSection === 'dashboard' && t(language, 'dashboard')}
                {activeSection === 'cases' && t(language, 'cases')}
                {activeSection === 'assigned' && t(language, 'assignedCases')}
                {activeSection === 'users' && t(language, 'userDirectory')}
              </h2>
              <p className={`text-[11px] font-semibold mt-1 ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>
                {activeSection === 'dashboard' && t(language, 'adminDashboardSubtitle')}
                {activeSection === 'cases' && t(language, 'adminCasesSubtitle')}
                {activeSection === 'assigned' && t(language, 'adminAssignedSubtitle')}
                {activeSection === 'users' && t(language, 'adminUsersSubtitle')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search
                  className={`absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-300'}`}
                  size={18}
                />
                <input
                  type="text"
                  placeholder={t(language, 'searchCasesPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 ${
                    isLight
                      ? 'border-slate-200 bg-white text-slate-900 placeholder-slate-400'
                      : 'border-white/10 bg-white/5 text-white placeholder-slate-500'
                  }`}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>
                  {t(language, 'language')}
                </span>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value as any)}
                  className={`h-9 px-3 rounded-lg border text-[10px] font-black uppercase tracking-widest outline-none ${
                    isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'
                  }`}
                >
                  <option value="en">EN</option>
                  <option value="am">AM</option>
                </select>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`h-9 px-3 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                    isLight ? 'bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  }`}
                >
                  {themeLabel}
                </button>
              </div>
              <button
                type="button"
                onClick={logout}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                    isLight
                      ? 'border-red-200 text-red-700 bg-red-50 hover:bg-red-600 hover:text-white hover:border-red-600'
                      : 'border-red-500/30 text-red-300 bg-red-500/10 hover:bg-red-600 hover:text-white hover:border-red-600'
                  }`}
              >
                <LogOut size={16} />
                {t(language, 'logout')}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10">
          {selectedCaseId ? (
            <CaseDetails
              caseId={selectedCaseId}
              embedded
              startInEdit={detailMode === 'edit'}
              theme={isLight ? 'light' : 'dark'}
              onClose={() => {
                setSelectedCaseId(null);
                setDetailMode(null);
              }}
              onCaseUpdated={onRefresh}
            />
          ) : (
            <>
              {activeSection === 'dashboard' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div 
                      onClick={() => setActiveFilter('all')}
                      className={`p-6 rounded-xl border shadow-sm cursor-pointer transition-all ${
                        isLight ? 'bg-white hover:bg-slate-50' : 'bg-white/5 hover:bg-white/10'
                      } ${
                        activeFilter === 'all' 
                          ? 'border-blue-500 ring-2 ring-blue-500/20' 
                          : isLight ? 'border-slate-200 hover:border-blue-300' : 'border-white/10 hover:border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <Briefcase className={isLight ? 'text-blue-600' : 'text-blue-300'} size={20} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-blue-600' : 'text-blue-300'}`}>{t(language, 'total')}</span>
                      </div>
                      <p className={`text-3xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{stats.total}</p>
                      <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>{t(language, 'cases')}</p>
                    </div>
                    <div 
                      onClick={() => setActiveFilter('new')}
                      className={`p-6 rounded-xl border shadow-sm cursor-pointer transition-all ${
                        isLight ? 'bg-white hover:bg-slate-50' : 'bg-white/5 hover:bg-white/10'
                      } ${
                        activeFilter === 'new' 
                          ? 'border-blue-500 ring-2 ring-blue-500/20' 
                          : isLight ? 'border-slate-200 hover:border-blue-300' : 'border-white/10 hover:border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <Bell className={isLight ? 'text-blue-600' : 'text-blue-300'} size={20} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-blue-600' : 'text-blue-300'}`}>{t(language, 'new')}</span>
                      </div>
                      <p className={`text-3xl font-bold ${isLight ? 'text-blue-600' : 'text-blue-300'}`}>{stats.new}</p>
                      <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>{t(language, 'newCases')}</p>
                    </div>
                    <div 
                      onClick={() => setActiveFilter('progress')}
                      className={`p-6 rounded-xl border shadow-sm cursor-pointer transition-all ${
                        isLight ? 'bg-white hover:bg-slate-50' : 'bg-white/5 hover:bg-white/10'
                      } ${
                        activeFilter === 'progress' 
                          ? 'border-orange-500 ring-2 ring-orange-500/20' 
                          : isLight ? 'border-slate-200 hover:border-orange-300' : 'border-white/10 hover:border-orange-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                          <Bell className={isLight ? 'text-orange-600' : 'text-orange-300'} size={20} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-orange-600' : 'text-orange-300'}`}>{t(language, 'inProgress')}</span>
                      </div>
                      <p className={`text-3xl font-bold ${isLight ? 'text-orange-600' : 'text-orange-300'}`}>{stats.progress}</p>
                      <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>{t(language, 'inProgress')}</p>
                    </div>
                    <div 
                      onClick={() => setActiveFilter('closed')}
                      className={`p-6 rounded-xl border shadow-sm cursor-pointer transition-all ${
                        isLight ? 'bg-white hover:bg-slate-50' : 'bg-white/5 hover:bg-white/10'
                      } ${
                        activeFilter === 'closed' 
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                          : isLight ? 'border-slate-200 hover:border-emerald-300' : 'border-white/10 hover:border-emerald-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <Briefcase className={isLight ? 'text-emerald-700' : 'text-emerald-300'} size={20} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>{t(language, 'closed')}</span>
                      </div>
                      <p className={`text-3xl font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>{stats.closed}</p>
                      <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>{t(language, 'closed')}</p>
                    </div>
                  </div>

                  <div className={`rounded-xl border shadow-sm overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                    <div className={`p-6 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                      <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t(language, 'cases')}</h3>
                      <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>{filteredCases.length} {t(language, 'total')}</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className={isLight ? 'bg-slate-50 border-b border-slate-200' : 'bg-white/5 border-b border-white/10'}>
                          <tr>
                            <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'caseNumber')}</th>
                            <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'titleLabel')}</th>
                            <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'statusLabel')}</th>
                            <th className={`px-6 py-3 text-[10px] font-bold uppercase text-right ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'actions')}</th>
                          </tr>
                        </thead>
                        <tbody className={isLight ? 'divide-y divide-slate-200' : 'divide-y divide-white/10'}>
                          {filteredCases.map((caseItem: any) => (
                            <tr key={caseItem.caseId || caseItem.id} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}>
                              <td className="px-6 py-4">
                                <div className={`font-mono text-sm font-bold bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-lg inline-block ${isLight ? 'text-blue-700' : 'text-blue-300'}`}>
                                  {caseItem.caseNumber || (caseItem as any).case_number || `PCRS-${String(caseItem.caseId || '').substring(0, 8)}` || 'N/A'}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className={`font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{caseItem.title}</div>
                              </td>
                              <td className="px-6 py-4">
                                {getStatusBadge(caseItem.currentStatus)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => handleView(caseItem.caseId || caseItem.id)}
                                  className={`text-xs font-medium ${isLight ? 'text-blue-700 hover:text-blue-800' : 'text-blue-300 hover:text-blue-200'}`}
                                >
                                  {t(language, 'viewLabel')}
                                </button>
                              </td>
                            </tr>
                          ))}
                          {filteredCases.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-6 py-10 text-center text-[11px] text-slate-400 font-semibold uppercase">
                                {t(language, 'noCasesFound')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'cases' && (
                <div className={`rounded-xl border shadow-sm overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                  <div className={`p-6 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                    <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t(language, 'cases')}</h3>
                    <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>{allCasesForCasesSection.length} {t(language, 'total')}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className={isLight ? 'bg-slate-50 border-b border-slate-200' : 'bg-white/5 border-b border-white/10'}>
                        <tr>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'caseNumber')}</th>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'titleLabel')}</th>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'statusLabel')}</th>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase text-right ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'actions')}</th>
                        </tr>
                      </thead>
                      <tbody className={isLight ? 'divide-y divide-slate-200' : 'divide-y divide-white/10'}>
                        {allCasesForCasesSection.map((caseItem: any) => (
                          <tr key={caseItem.caseId || caseItem.id} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}>
                            <td className="px-6 py-4">
                              <div className={`font-mono text-sm font-bold bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-lg inline-block ${isLight ? 'text-blue-700' : 'text-blue-300'}`}>
                                {caseItem.caseNumber || (caseItem as any).case_number || `PCRS-${String(caseItem.caseId || '').substring(0, 8)}` || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className={`font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{caseItem.title}</div>
                            </td>
                            <td className="px-6 py-4">
                              {getStatusBadge(caseItem.currentStatus)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => handleView(caseItem.caseId || caseItem.id)}
                                className={`text-xs font-medium ${isLight ? 'text-blue-700 hover:text-blue-800' : 'text-blue-300 hover:text-blue-200'}`}
                              >
                                {t(language, 'viewLabel')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeSection === 'assigned' && (
                <div className={`rounded-xl border shadow-sm overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                  <div className={`p-6 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                    <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t(language, 'assignedCases')}</h3>
                    <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>
                      {assignedCasesForSection.length} assigned cases found | 
                      Total cases: {cases.length} | 
                      Assignments: {assignments.length} | 
                      Enriched: {casesWithAssignments.length}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className={isLight ? 'bg-slate-50 border-b border-slate-200' : 'bg-white/5 border-b border-white/10'}>
                        <tr>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'caseNumber')}</th>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'titleLabel')}</th>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'investigatorLabel')}</th>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'statusLabel')}</th>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase text-right ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'actions')}</th>
                        </tr>
                      </thead>
                      <tbody className={isLight ? 'divide-y divide-slate-200' : 'divide-y divide-white/10'}>
                        {assignedCasesForSection.map((caseItem: any, idx: number) => {
                          const assignedNames: string[] = Array.isArray(caseItem.assignedNames) ? caseItem.assignedNames : [];
                          const cid = caseItem.caseId ? String(caseItem.caseId) : '';
                          const displayId = cid.startsWith('C-')
                            ? cid
                            : (caseItem.caseNumber
                                ? `C-${caseItem.caseNumber}`
                                : (cid ? cid.slice(0, 8) + '...' : '—'));
                          return (
                            <tr key={cid || String(idx)} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}>
                              <td className="px-6 py-4">
                              <div className={`font-mono text-sm font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg inline-block ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                                  {displayId}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className={`font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{caseItem.title || t(language, 'untitledCase')}</div>
                                <div className={`text-[10px] font-semibold mt-1 ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>{caseItem.currentStatus}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                  {assignedNames.length > 0 ? assignedNames.map((name: string, i: number) => (
                                    <span key={i} className={`px-2 py-1 border text-[10px] font-medium rounded ${isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/10 border-white/10 text-slate-200'}`}>
                                      {name}
                                    </span>
                                  )) : (
                                    <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>{t(language, 'unassigned')}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {getStatusBadge(caseItem.currentStatus)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => handleView(caseItem.caseId || caseItem.id)}
                                  className={`text-xs font-medium ${isLight ? 'text-blue-700 hover:text-blue-800' : 'text-blue-300 hover:text-blue-200'}`}
                                >
                                  {t(language, 'viewLabel')}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {assignedCasesForSection.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-[11px] text-slate-400 font-semibold uppercase">
                              {t(language, 'noAssignedCasesFound')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeSection === 'users' && (
                <div className={`rounded-xl border shadow-sm overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                  <div className={`p-6 border-b flex items-center justify-between ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                    <div>
                      <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {t(language, 'users')}
                      </h3>
                      <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>
                        {keycloakUsers.length} records
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className={isLight ? 'bg-slate-50 border-b border-slate-200' : 'bg-white/5 border-b border-white/10'}>
                        <tr>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Username</th>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Full Name</th>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Email</th>
                          <th className={`px-6 py-3 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{t(language, 'statusLabel')}</th>
                        </tr>
                      </thead>
                      <tbody className={isLight ? 'divide-y divide-slate-200' : 'divide-y divide-white/10'}>
                        {keycloakUsers.map((user: any) => {
                          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                          const isActive = user.enabled;
                          const activeClass = isActive
                            ? isLight
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            : isLight
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-white/5 text-slate-300 border-white/10';
                          const activeLabel = isActive ? 'Active' : 'Inactive';
                          
                          return (
                            <tr key={user.id || user.username} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}>
                              <td className="px-6 py-4">
                                <div className={`font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{user.username}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className={`font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                  {fullName || user.displayName || 'N/A'}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className={isLight ? 'text-slate-600' : 'text-slate-300'}>{user.email || 'N/A'}</div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${activeClass}`}>
                                  {activeLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {keycloakUsers.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-10 text-center text-[11px] text-slate-400 font-semibold uppercase">
                              No users found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
