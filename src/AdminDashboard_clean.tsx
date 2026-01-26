import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import keycloak from '@/services/keycloak';
import {
  Search,
  Edit,
  Trash2,
  Eye,
  ShieldCheck,
  LayoutDashboard,
  Briefcase,
  Inbox,
  FileText,
  Users,
  Bell,
} from 'lucide-react';
import api from '@/services/api';
import { listEvidences } from '@/services/Evidence';
import { listInvestigatorLogs } from '@/services/InvestigatorLog';
import { listUsers } from '@/services/User';
import CaseDetails from '@/pages/CaseDetails';

interface AdminProps {
  cases?: any[];
  setCases?: React.Dispatch<React.SetStateAction<any[]>>;
  onRefresh?: () => void;
  deletedCases?: Set<string>;
  setDeletedCases?: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const AdminDashboard: React.FC<AdminProps> = ({ cases = [], setCases, onRefresh, deletedCases, setDeletedCases }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'new' | 'progress' | 'closed' | 'total'>('total');
  const [activeSection, setActiveSection] = useState<'dashboard' | 'cases' | 'assign' | 'evidence' | 'documents' | 'users'>('dashboard');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [keycloakUsers, setKeycloakUsers] = useState<any[]>([]);
  const [showKeycloakUsers, setShowKeycloakUsers] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    firstName: '',
    lastName: '',
    role: 'INVESTIGATOR',
    password: '',
    isActive: true,
    caseId: '',
  });

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingUser(true);

      if (keycloak.token) {
        try {
          await axios.post(
            'http://localhost:8080/admin/realms/pcrs-realm/users',
            {
              username: newUser.username,
              firstName: newUser.firstName,
              lastName: newUser.lastName,
              enabled: newUser.isActive,
              credentials: [{ type: 'password', value: newUser.password, temporary: false }],
            },
            {
              headers: {
                Authorization: `Bearer ${keycloak.token}`,
                'Content-Type': 'application/json',
              },
            }
          );
        } catch (kcError: any) {
          console.error('Keycloak creation failed', kcError);
        }
      }

      const payload = { ...newUser };
      if (payload.caseId) {
        payload.caseId = newUser.caseId.trim();
      }

      await api.post('/users', payload);
      setIsUserModalOpen(false);
      setNewUser({
        username: '',
        firstName: '',
        lastName: '',
        role: 'INVESTIGATOR',
        password: '',
        isActive: true,
        caseId: '',
      });
      const dbUsersList = await listUsers();
      const dbUsers = Array.isArray(dbUsersList) ? dbUsersList : [];
      setUsers(dbUsers);
    } catch (err: any) {
      console.error('Failed to create user', err);
    } finally {
      setCreatingUser(false);
    }
  };

  const stats = useMemo(() => {
    const newCount = cases.filter(c => c.currentStatus === 'New' || !c.currentStatus).length;
    const progressCount = cases.filter(c => c.currentStatus && c.currentStatus.toLowerCase().includes('progress')).length;
    const closedCount = cases.filter(c => c.currentStatus && c.currentStatus.toLowerCase().includes('closed')).length;
    return { new: newCount, progress: progressCount, closed: closedCount, total: cases.length };
  }, [cases]);

  const filteredCases = useMemo(() => {
    if (!searchTerm) return cases;
    const query = searchTerm.toLowerCase();
    return cases.filter((c: any) => {
      const id = String(c.caseId || c.id || '').toLowerCase();
      const number = String(c.caseNumber || '').toLowerCase();
      const title = String(c.title || '').toLowerCase();
      return id.includes(query) || number.includes(query) || title.includes(query);
    });
  }, [cases, searchTerm]);

  const statusFilteredCases = useMemo(() => {
    if (activeFilter === 'total') return filteredCases;
    return filteredCases.filter((c: any) => {
      const status = String(c.currentStatus || '').toLowerCase();
      if (activeFilter === 'new') return !status || status === 'new' || status === 'registered';
      if (activeFilter === 'progress') return status.includes('progress');
      if (activeFilter === 'closed') return status.includes('closed');
      return true;
    });
  }, [filteredCases, activeFilter]);

  const getStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    let style = '';
    let label = '';
    
    if (!status || normalized === 'registered') {
      style = 'bg-blue-50 text-blue-600 border-blue-100';
      label = 'New Case';
    } else if (normalized.includes('progress')) {
      style = 'bg-orange-50 text-orange-600 border-orange-100';
      label = status;
    } else if (normalized.includes('closed')) {
      style = 'bg-emerald-50 text-emerald-600 border-emerald-100';
      label = status;
    } else {
      style = 'bg-slate-50 text-slate-600 border-slate-100';
      label = status;
    }
    
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${style}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-slate-100">
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
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-10 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase">
                {activeSection === 'dashboard' && 'Dashboard Overview'}
                {activeSection === 'cases' && 'All Cases'}
                {activeSection === 'users' && 'User Management'}
              </h2>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                {activeSection === 'dashboard' && 'System statistics and case overview'}
                {activeSection === 'cases' && `Total ${cases.length} cases in the system`}
                {activeSection === 'users' && 'Manage system users and permissions'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search cases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10 space-y-8">
          {activeSection === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <Briefcase className="text-blue-600" size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase">Total</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
                  <p className="text-[11px] text-slate-400 mt-1">All Cases</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <Bell className="text-blue-600" size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase">New</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">{stats.new}</p>
                  <p className="text-[11px] text-slate-400 mt-1">New Cases</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-lg bg-orange-50">
                      <Inbox className="text-orange-600" size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-orange-600 uppercase">Progress</span>
                  </div>
                  <p className="text-3xl font-bold text-orange-600">{stats.progress}</p>
                  <p className="text-[11px] text-slate-400 mt-1">In Progress</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-lg bg-emerald-50">
                      <FileText className="text-emerald-600" size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Closed</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-600">{stats.closed}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Completed</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800">Recent Cases</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Latest case updates</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Case Number</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Title</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Status</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statusFilteredCases.slice(0, 5).map((caseItem: any) => (
                        <tr key={caseItem.caseId || caseItem.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div className="font-mono text-xs font-bold text-slate-700">
                              {caseItem.caseNumber || caseItem.id}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">{caseItem.title}</div>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(caseItem.currentStatus)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeSection === 'cases' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800">All Cases</h3>
                <p className="text-[11px] text-slate-400 mt-1">{filteredCases.length} cases found</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Case Number</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Title</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Status</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCases.map((caseItem: any) => (
                      <tr key={caseItem.caseId || caseItem.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="font-mono text-xs font-bold text-slate-700">
                            {caseItem.caseNumber || caseItem.id}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{caseItem.title}</div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(caseItem.currentStatus)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3">
                            View
                          </button>
                          <button className="text-slate-600 hover:text-slate-800 text-xs font-medium">
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'users' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {showKeycloakUsers ? 'Keycloak Users' : 'System Users'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
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
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    Database Users
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
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    Keycloak Users
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(true)}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors"
                  >
                    Add User
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Username</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Full Name</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Email</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Created</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(showKeycloakUsers ? keycloakUsers : users).map((user: any) => {
                      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                      const created = showKeycloakUsers 
                        ? (user.createdTimestamp ? new Date(user.createdTimestamp).toLocaleDateString() : 'N/A')
                        : (user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A');
                      const isActive = showKeycloakUsers ? user.enabled : user.isActive;
                      const activeClass = isActive
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-slate-50 text-slate-500 border-slate-100';
                      const activeLabel = isActive ? 'Active' : 'Inactive';
                      
                      return (
                        <tr key={user.userId || user.username || user.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">{user.username}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">
                              {fullName || user.displayName || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-slate-600">{user.email || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-slate-600">{created}</div>
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
                        <td colSpan={5} className="px-6 py-10 text-center text-[11px] text-slate-400 font-semibold uppercase">
                          {showKeycloakUsers ? 'No Keycloak users found.' : 'No users found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <form onSubmit={handleCreateUser} className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h4 className="text-lg font-bold text-slate-900">Create New User</h4>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
              <input
                type="text"
                required
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingUser}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-60"
              >
                {creatingUser ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
