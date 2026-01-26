import { useEffect, useState } from 'react';
import axios from 'axios';
import keycloak from '../services/keycloak';
import api from '../services/api';
import { UserDTO } from '../types';

const UserManagement = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Form State including Assignment Data
  const [newUser, setNewUser] = useState({
    username: '',
    firstName: '',
    lastName: '',
    role: 'INVESTIGATOR',
    password: '',
    isActive: true,
    caseId: '', // Added for Case Assignment
  });

  const triggerNotify = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Sync Error", err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAddPersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Create in Keycloak
      if (keycloak.token) {
        try {
          await axios.post(
            'http://localhost:8080/admin/realms/pcrs-realm/users',
            {
              username: newUser.username,
              firstName: newUser.firstName,
              lastName: newUser.lastName,
              enabled: true,
              emailVerified: true,
              credentials: [
                {
                  type: 'password',
                  value: newUser.password,
                  temporary: false,
                },
              ],
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
          if (kcError.response && kcError.response.status === 409) {
            console.warn('User already exists in Keycloak, proceeding to DB sync.');
          } else {
            triggerNotify("KEYCLOAK CREATION FAILED", "error");
            return;
          }
        }
      }

      const payload: any = {
        username: newUser.username,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        password: newUser.password,
        isActive: newUser.isActive,
      };

      if (newUser.caseId && newUser.caseId.trim() !== '') {
        payload.caseId = newUser.caseId.trim();
      }

      await api.post('/users', payload);
      
      triggerNotify("PERSONNEL AUTHORIZED & CASE ASSIGNED", "success");
      setIsModalOpen(false);
      setNewUser({ username: '', firstName: '', lastName: '', role: 'INVESTIGATOR', password: '', isActive: true, caseId: '' });
      fetchUsers();
    } catch (err: any) {
      console.error("AUTHORIZATION FAILED", err);
      const serverData = err.response?.data;
      const serverMessage =
        typeof serverData === 'string'
          ? serverData
          : serverData?.message;
      const msg = serverMessage || err.message || "AUTHORIZATION FAILED";
      triggerNotify(msg.toUpperCase(), "error");
    }
  };

  const filteredUsers = users.filter((u) => 
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.caseId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full gap-6 p-4 text-white relative">
      
      {/* NOTIFICATION OVERLAY */}
      {notification && (
        <div className={`fixed top-5 right-5 z-[100] px-6 py-3 rounded-xl border font-black uppercase tracking-widest text-[10px] shadow-2xl animate-bounce
          ${notification.type === 'success' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-red-500/20 border-red-500 text-red-500'}`}>
          {notification.msg}
        </div>
      )}

      {/* HEADER & SEARCH */}
      <div className="flex justify-between items-center bg-[#11141d] p-6 rounded-3xl border border-white/5">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-black italic uppercase italic">User <span className="text-blue-500">Directory</span></h1>
          <input 
            type="text"
            placeholder="SEARCH BY USER OR CASE ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-black border border-white/10 rounded-xl px-4 py-2 text-[10px] font-bold w-72 focus:border-blue-500 outline-none uppercase"
          />
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/40"
        >
          + Add New Personnel
        </button>
      </div>

      {/* DIRECTORY TABLE */}
      <div className="bg-[#11141d] rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl flex-grow">
        <div className="grid grid-cols-5 p-8 bg-black/40 border-b border-white/10 text-[9px] font-black uppercase tracking-widest text-blue-500">
          <div>Personnel</div>
          <div>Assigned Case</div>
          <div>Assignment Date</div>
          <div>Status</div>
          <div className="text-right">Actions</div>
        </div>

        <div className="overflow-y-auto max-h-[600px] custom-scrollbar">
          {loading ? (
            <div className="p-20 text-center animate-pulse text-blue-500 font-mono text-[10px] uppercase">Syncing Personnel Database...</div>
          ) : filteredUsers.map((u) => (
            <div key={u.userId} className="grid grid-cols-5 p-8 border-b border-white/5 hover:bg-white/[0.02] items-center">
              <div className="font-black text-slate-200 uppercase">{u.username}</div>
              
              {/* Case ID from Assignment Data */}
              <div className="text-[11px] font-mono text-blue-400 font-bold">{u.caseId || 'UNASSIGNED'}</div>
              
              {/* Formatted Assigned Date */}
              <div className="text-[10px] text-slate-500 font-bold">
                {u.assignedDate ? new Date(u.assignedDate).toLocaleDateString() : 'N/A'}
              </div>

              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500 shadow-[0_0_8px_emerald]' : 'bg-red-500 shadow-[0_0_8px_red]'}`}></span>
                <span className={`text-[10px] font-black uppercase ${u.isActive ? 'text-emerald-500' : 'text-red-500'}`}>
                  {u.isActive ? 'Active' : 'Locked'}
                </span>
              </div>
              
              <div className="flex justify-end gap-3">
                <button className="text-[9px] font-black uppercase bg-white/5 px-4 py-2 rounded-lg border border-white/5 hover:bg-blue-600 transition-all">Edit</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: ADD PERSONNEL & ASSIGN CASE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddPersonnel} className="bg-[#11141d] p-10 rounded-[3rem] border border-white/10 w-full max-w-lg flex flex-col gap-6">
            <h2 className="text-2xl font-black uppercase italic text-center">Authorize <span className="text-blue-500">Personnel</span></h2>
            
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <input 
                  placeholder="FIRST NAME" 
                  value={newUser.firstName} 
                  onChange={e => setNewUser({...newUser, firstName: e.target.value})} 
                  className="bg-black p-4 rounded-xl border border-white/5 text-xs font-bold focus:border-blue-500 outline-none" 
                  required 
                />
                <input 
                  placeholder="LAST NAME" 
                  value={newUser.lastName} 
                  onChange={e => setNewUser({...newUser, lastName: e.target.value})} 
                  className="bg-black p-4 rounded-xl border border-white/5 text-xs font-bold focus:border-blue-500 outline-none" 
                  required 
                />
              </div>
              <input 
                placeholder="USERNAME" 
                value={newUser.username} 
                onChange={e => setNewUser({...newUser, username: e.target.value.toUpperCase()})} 
                className="bg-black p-4 rounded-xl border border-white/5 text-xs font-bold focus:border-blue-500 outline-none" 
                required 
              />
              <input 
                placeholder="CASE ASSIGNMENT (CASE ID)" 
                value={newUser.caseId} 
                onChange={e => setNewUser({...newUser, caseId: e.target.value.toUpperCase()})} 
                className="bg-black p-4 rounded-xl border border-white/5 text-xs font-bold focus:border-blue-500 outline-none" 
              />
              <input 
                type="password"
                placeholder="SYSTEM PASSWORD" 
                value={newUser.password} 
                onChange={e => setNewUser({...newUser, password: e.target.value})} 
                className="bg-black p-4 rounded-xl border border-white/5 text-xs font-bold focus:border-blue-500 outline-none" 
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-4 rounded-xl text-[10px] font-black uppercase bg-white/5">Abort</button>
              <button type="submit" className="p-4 rounded-xl text-[10px] font-black uppercase bg-blue-600 shadow-lg shadow-blue-900/40 hover:bg-blue-500">Authorize Access</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
