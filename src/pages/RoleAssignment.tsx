import React, { useState, useEffect } from 'react';
import api from '@/services/api'; // Updated to use your path alias

const RoleAssignment: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/api/users');
        setUsers(res.data);
      } catch (err) {
        console.error("Authorization Error: Supervisor clearance required.");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    try {
      // Fulfills 'Assign role' requirement
      await api.patch(`/api/users/${userId}/role`, { role: newRole });
      alert("SYSTEM UPDATE: Clearance Level Reassigned.");
      setUsers(prev => prev.map(u => (u.id === userId || u._id === userId) ? { ...u, role: newRole } : u));
    } catch (err) {
      alert("ACCESS DENIED: Insufficient Privileges.");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06080f] flex items-center justify-center">
      <div className="text-blue-500 font-black animate-pulse uppercase tracking-[0.4em]">Decrypting Personnel Database...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06080f] text-white p-8">
      <div className="mb-10">
        <h1 className="text-3xl font-black italic tracking-tighter uppercase text-amber-500">Personnel Management</h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Supervisor Authorization Terminal</p>
      </div>
      <div className="bg-[#0f111a] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-[9px] uppercase font-black text-slate-500 tracking-widest">
            <tr>
              <th className="p-8">Officer Identity</th>
              <th className="p-8">Current Clearance</th>
              <th className="p-8 text-right">Assign New Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(user => (
              <tr key={user.id || user._id} className="hover:bg-white/[0.01] transition-colors">
                <td className="p-8">
                  <p className="font-bold text-lg">{user.name || 'Unknown Officer'}</p>
                  <p className="text-[10px] font-mono text-slate-500">{user.email}</p>
                </td>
                <td className="p-8">
                  <span className="bg-blue-500/10 text-blue-400 px-4 py-1 rounded-full text-[9px] font-black uppercase border border-blue-500/20">{user.role}</span>
                </td>
                <td className="p-8 text-right">
                  <select 
                    className="bg-[#1a1d29] border border-white/10 p-3 rounded-xl text-xs font-bold outline-none focus:border-amber-500 text-gray-300 cursor-pointer"
                    onChange={(e) => handleRoleUpdate(user.id || user._id, e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>Select Role...</option>
                    <option value="Investigator">Investigator</option>
                    <option value="Desk Officer">Desk Officer</option>
                    <option value="Supervisor">Supervisor</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RoleAssignment;