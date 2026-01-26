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
import { listUsers } from '@/services/User';
import CaseDetails from '@/pages/CaseDetails';
import { useAuthStore } from '@/stores/authStore';

interface AdminProps {
  cases?: any[];
  setCases?: React.Dispatch<React.SetStateAction<any[]>>;
  onRefresh?: () => void;
  deletedCases?: Set<string>;
  setDeletedCases?: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const AdminDashboard: React.FC<AdminProps> = ({ cases = [], setCases, onRefresh, deletedCases, setDeletedCases }) => {
  const { userInfo, logout } = useAuthStore() as any;
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<'dashboard' | 'cases' | 'assigned' | 'users'>('assigned');
  const [activeFilter, setActiveFilter] = useState<'all' | 'new' | 'progress' | 'closed'>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [keycloakUsers, setKeycloakUsers] = useState<any[]>([]);
  const [showKeycloakUsers, setShowKeycloakUsers] = useState(false);
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

    const [casesRes, usersRes, assignmentsRes] = await Promise.allSettled([
      api.get('/cases'),
      api.get('/users'),
      api.get('/assignedcases'),
    ]);

    let nextCases: any[] = [];
    if (casesRes.status === 'fulfilled') {
      nextCases = Array.isArray(casesRes.value.data) ? casesRes.value.data : [];
    } else {
      try {
        const cached = localStorage.getItem('cached_cases');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) nextCases = parsed;
        }
      } catch (_) {}
    }

    if (deletedCases && deletedCases.size > 0) {
      nextCases = nextCases.filter(c => {
        const id = String(c.caseId || '').toLowerCase();
        if (!id) return true;
        return !deletedCases.has(id);
      });
    }

    console.log('AdminDashboard: Cases loaded:', nextCases.length);

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

    if (normalizedAssignments.length > 0 && nextCases.length > 0) {
      const assignedIds = new Set(
        normalizedAssignments
          .map((a: any) => String(a.caseId || '').toLowerCase())
          .filter((id: string) => id && id !== 'null' && id !== 'undefined'),
      );
      const existingIds = new Set(
        nextCases.map((c: any) => String(c.caseId || '').toLowerCase()),
      );
      const missingIds = Array.from(assignedIds).filter(id => !existingIds.has(id));

      if (missingIds.length > 0) {
        const recoveredResults = await Promise.allSettled(
          missingIds.map(id => api.get(`/cases/${id}`)),
        );
        const recoveredCases = recoveredResults
          .filter(r => r.status === 'fulfilled')
          .map((r: any) => r.value.data)
          .filter((c: any) => c && (c.caseId || c.id));

        if (recoveredCases.length > 0) {
          nextCases = [...nextCases, ...recoveredCases];
          if (deletedCases && deletedCases.size > 0) {
            nextCases = nextCases.filter(c => {
              const id = String(c.caseId || '').toLowerCase();
              if (!id) return true;
              return !deletedCases.has(id);
            });
          }
        }
      }
    }

    console.log('AdminDashboard: Assignments loaded:', normalizedAssignments.length);

    setAssignments(normalizedAssignments);
    if (setCases && nextCases.length > 0) {
      setCases(nextCases);
    }

    console.log('AdminDashboard: loadData complete (Supervisor.tsx logic)');
  };

  // Fetch data on component mount using Supervisor.tsx approach
  useEffect(() => {
    loadData();
  }, []);

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
      style = 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      label = 'New Case';
    } else if (normalized.includes('progress')) {
      style = 'bg-orange-500/10 text-orange-300 border-orange-500/20';
      label = status;
    } else if (normalized.includes('closed')) {
      style = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      label = status;
    } else {
      style = 'bg-white/5 text-slate-300 border-white/10';
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
    <div className="flex h-screen bg-gradient-to-r from-[#00040F] to-[#0A1631]">
      <aside className="w-72 bg-[#0f172a] text-white flex flex-col">
        <div className="px-8 pt-8 pb-6 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/40">
            <ShieldCheck className="text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black">Admin Panel</h1>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest">PCR Management</p>
          </div>
        </div>

        <nav className="mt-4 flex-1 px-4 space-y-2">
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest ${
              activeSection === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-white/5 hover:text-white transition'
            }`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('cases')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest ${
              activeSection === 'cases'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-white/5 hover:text-white transition'
            }`}
          >
            <Briefcase size={18} />
            <span>Cases</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('assigned')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest ${
              activeSection === 'assigned'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-white/5 hover:text-white transition'
            }`}
          >
            <ClipboardList size={18} />
            <span>Assigned Cases</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest ${
              activeSection === 'users'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-white/5 hover:text-white transition'
            }`}
          >
            <Users size={18} />
            <span>Users</span>
          </button>
        </nav>

        <div className="mt-auto px-4 pb-6">
          <div className="bg-white/5 rounded-2xl border border-white/10 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/20">
              {String(userInfo?.name || userInfo?.username || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                Administrator
              </p>
              <p className="text-sm font-bold text-white truncate italic">
                {userInfo?.name || userInfo?.username || userInfo?.preferred_username || 'admin'}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-tighter">
                  Authorized
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white/5 backdrop-blur-md border-b border-white/10 px-10 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white uppercase">
                {activeSection === 'dashboard' && 'Dashboard Overview'}
                {activeSection === 'cases' && 'All Cases'}
                {activeSection === 'assigned' && 'Assigned Cases'}
                {activeSection === 'users' && 'User Management'}
              </h2>
              <p className="text-[11px] text-slate-300 font-semibold mt-1">
                {activeSection === 'dashboard' && 'System statistics and case overview'}
                {activeSection === 'cases' && `Total ${cases.length} cases in the system`}
                {activeSection === 'assigned' && `${assignedCases.length} assigned cases in the system`}
                {activeSection === 'users' && 'Manage system users and permissions'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="text"
                  placeholder="Search cases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-white/10 bg-white/5 text-white placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border border-red-500/30 text-red-300 bg-red-500/10 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
              >
                <LogOut size={16} />
                Logout
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
                      className={`bg-white/5 p-6 rounded-xl border shadow-sm cursor-pointer transition-all hover:bg-white/10 ${
                        activeFilter === 'all' 
                          ? 'border-blue-500 ring-2 ring-blue-500/20' 
                          : 'border-white/10 hover:border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <Briefcase className="text-blue-300" size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-blue-300 uppercase">Total</span>
                      </div>
                      <p className="text-3xl font-bold text-white">{stats.total}</p>
                      <p className="text-[11px] text-slate-300 mt-1">All Cases</p>
                    </div>
                    <div 
                      onClick={() => setActiveFilter('new')}
                      className={`bg-white/5 p-6 rounded-xl border shadow-sm cursor-pointer transition-all hover:bg-white/10 ${
                        activeFilter === 'new' 
                          ? 'border-blue-500 ring-2 ring-blue-500/20' 
                          : 'border-white/10 hover:border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <Bell className="text-blue-300" size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-blue-300 uppercase">New</span>
                      </div>
                      <p className="text-3xl font-bold text-blue-300">{stats.new}</p>
                      <p className="text-[11px] text-slate-300 mt-1">New Cases</p>
                    </div>
                    <div 
                      onClick={() => setActiveFilter('progress')}
                      className={`bg-white/5 p-6 rounded-xl border shadow-sm cursor-pointer transition-all hover:bg-white/10 ${
                        activeFilter === 'progress' 
                          ? 'border-orange-500 ring-2 ring-orange-500/20' 
                          : 'border-white/10 hover:border-orange-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                          <Bell className="text-orange-300" size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-orange-300 uppercase">Progress</span>
                      </div>
                      <p className="text-3xl font-bold text-orange-300">{stats.progress}</p>
                      <p className="text-[11px] text-slate-300 mt-1">In Progress</p>
                    </div>
                    <div 
                      onClick={() => setActiveFilter('closed')}
                      className={`bg-white/5 p-6 rounded-xl border shadow-sm cursor-pointer transition-all hover:bg-white/10 ${
                        activeFilter === 'closed' 
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                          : 'border-white/10 hover:border-emerald-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <Briefcase className="text-emerald-300" size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-300 uppercase">Closed</span>
                      </div>
                      <p className="text-3xl font-bold text-emerald-300">{stats.closed}</p>
                      <p className="text-[11px] text-slate-300 mt-1">Completed</p>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl border border-white/10 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                      <h3 className="text-lg font-bold text-white">All Cases</h3>
                      <p className="text-[11px] text-slate-300 mt-1">{filteredCases.length} total cases</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-white/5 border-b border-white/10">
                          <tr>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Case Number</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Title</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Status</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {filteredCases.map((caseItem: any) => (
                            <tr key={caseItem.caseId || caseItem.id} className="hover:bg-white/5">
                              <td className="px-6 py-4">
                                <div className="font-mono text-sm font-bold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-lg inline-block">
                                  {caseItem.caseNumber || (caseItem as any).case_number || `PCRS-${String(caseItem.caseId || '').substring(0, 8)}` || 'N/A'}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-medium text-white">{caseItem.title}</div>
                              </td>
                              <td className="px-6 py-4">
                                {getStatusBadge(caseItem.currentStatus)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => handleView(caseItem.caseId || caseItem.id)}
                                  className="text-blue-300 hover:text-blue-200 text-xs font-medium"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                          {filteredCases.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-6 py-10 text-center text-[11px] text-slate-400 font-semibold uppercase">
                                No cases found.
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
                <div className="bg-white/5 rounded-xl border border-white/10 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">All Cases</h3>
                    <p className="text-[11px] text-slate-300 mt-1">{allCasesForCasesSection.length} cases found</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Case Number</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Title</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Status</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {allCasesForCasesSection.map((caseItem: any) => (
                          <tr key={caseItem.caseId || caseItem.id} className="hover:bg-white/5">
                            <td className="px-6 py-4">
                              <div className="font-mono text-sm font-bold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-lg inline-block">
                                {caseItem.caseNumber || (caseItem as any).case_number || `PCRS-${String(caseItem.caseId || '').substring(0, 8)}` || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-white">{caseItem.title}</div>
                            </td>
                            <td className="px-6 py-4">
                              {getStatusBadge(caseItem.currentStatus)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => handleView(caseItem.caseId || caseItem.id)}
                                className="text-blue-300 hover:text-blue-200 text-xs font-medium"
                              >
                                View
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
                <div className="bg-white/5 rounded-xl border border-white/10 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">Assigned Cases (Supervisor.tsx Logic)</h3>
                    <p className="text-[11px] text-slate-300 mt-1">
                      {assignedCasesForSection.length} assigned cases found | 
                      Total cases: {cases.length} | 
                      Assignments: {assignments.length} | 
                      Enriched: {casesWithAssignments.length}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Case Number</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Title</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Assigned To</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Status</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {assignedCasesForSection.map((caseItem: any, idx: number) => {
                          const assignedNames: string[] = Array.isArray(caseItem.assignedNames) ? caseItem.assignedNames : [];
                          const cid = caseItem.caseId ? String(caseItem.caseId) : '';
                          const displayId = cid.startsWith('C-')
                            ? cid
                            : (caseItem.caseNumber
                                ? `C-${caseItem.caseNumber}`
                                : (cid ? cid.slice(0, 8) + '...' : '—'));
                          return (
                            <tr key={cid || String(idx)} className="hover:bg-white/5">
                              <td className="px-6 py-4">
                                <div className="font-mono text-sm font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg inline-block">
                                  {displayId}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-medium text-white">{caseItem.title || 'Untitled'}</div>
                                <div className="text-[10px] text-slate-300 font-semibold mt-1">{caseItem.currentStatus}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                  {assignedNames.length > 0 ? assignedNames.map((name: string, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-white/10 border border-white/10 text-[10px] text-slate-200 font-medium rounded">
                                      {name}
                                    </span>
                                  )) : (
                                    <span className="text-slate-300 text-xs">Not assigned</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {getStatusBadge(caseItem.currentStatus)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => handleView(caseItem.caseId || caseItem.id)}
                                  className="text-blue-300 hover:text-blue-200 text-xs font-medium"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {assignedCasesForSection.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-[11px] text-slate-400 font-semibold uppercase">
                              No assigned cases found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeSection === 'users' && (
                <div className="bg-white/5 rounded-xl border border-white/10 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {showKeycloakUsers ? 'Keycloak Users' : 'System Users'}
                      </h3>
                      <p className="text-[11px] text-slate-300 mt-1">
                        {showKeycloakUsers ? keycloakUsers.length : users.length} records
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowKeycloakUsers(false)}
                        className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                          !showKeycloakUsers
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/10 text-slate-200 hover:bg-white/15'
                        }`}
                      >
                         Users
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowKeycloakUsers(true);
                          if (keycloakUsers.length === 0) {
                            fetchKeycloakUsers();
                          }
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                          showKeycloakUsers
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/10 text-slate-200 hover:bg-white/15'
                        }`}
                      >
                        Users
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Username</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Full Name</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Email</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-300 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {(showKeycloakUsers ? keycloakUsers : users).map((user: any) => {
                          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                          const isActive = showKeycloakUsers ? user.enabled : user.isActive;
                          const activeClass = isActive
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            : 'bg-white/5 text-slate-300 border-white/10';
                          const activeLabel = isActive ? 'Active' : 'Inactive';
                          
                          return (
                            <tr key={user.userId || user.username || user.id} className="hover:bg-white/5">
                              <td className="px-6 py-4">
                                <div className="font-medium text-white">{user.username}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-medium text-white">
                                  {fullName || user.displayName || 'N/A'}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-slate-300">{user.email || 'N/A'}</div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${activeClass}`}>
                                  {activeLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {(showKeycloakUsers ? keycloakUsers : users).length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-10 text-center text-[11px] text-slate-400 font-semibold uppercase">
                              {showKeycloakUsers ? 'No Keycloak users found.' : 'No users found.'}
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
