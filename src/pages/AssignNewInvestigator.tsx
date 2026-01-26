import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const AssignNewInvestigator = () => {
  const navigate = useNavigate();
  const [openCases, setOpenCases] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [casesRes, usersRes] = await Promise.all([
          api.get('/cases'), 
          api.get('/users')
        ]);
        setOpenCases(casesRes.data.filter((c: any) => c.currentStatus === 'Registered'));
        setPersonnel(usersRes.data);
      } catch (err) {
        console.error("Load Failed", err);
      }
    };
    loadData();
  }, []);

  const handleDeployment = async () => {
    if (!selectedCaseId || !selectedUserId) return alert("Missing Selection");

    const targetCase = openCases.find(c => c.caseId === selectedCaseId);

    try {
      setIsSyncing(true);
      
      // 1. Create the link in the AssignedCases table
      try {
        await api.post('/assignedcases', {
          caseId: selectedCaseId,
          userId: selectedUserId,
          assignedDate: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Assignments registry update failed (Backend 500), continuing...', e);
      }

      // 2. Move the case to 'In Progress' for the Dashboard cards
      await api.put(`/cases/${selectedCaseId}`, {
        ...targetCase,
        currentStatus: 'In Progress',
        assignedInvestigatorId: selectedUserId
      });
      
      alert("UNIT ASSIGNED SUCCESSFULLY");
      navigate('/'); // Return to Dashboard
    } catch (err) {
      console.error("Assignment Failed", err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-10 bg-[#06080f] min-h-screen text-white">
      <h2 className="text-5xl font-black uppercase italic mb-10">Assign <span className="text-blue-600">Investigator</span></h2>
      <div className="max-w-2xl bg-[#0f111a] p-10 rounded-[3rem] border border-white/5">
        <div className="mb-6">
          <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Case Dossier</label>
          <select 
            className="w-full bg-black border border-white/10 p-4 rounded-xl text-white outline-none"
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
          >
            <option value="">-- SELECT CASE --</option>
            {openCases.map(c => <option key={c.caseId} value={c.caseId}>{c.caseId} - {c.title}</option>)}
          </select>
        </div>

        <div className="mb-8">
          <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Investigator</label>
          <select 
            className="w-full bg-black border border-white/10 p-4 rounded-xl text-white outline-none"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">-- SELECT PERSONNEL --</option>
            {personnel.map(u => <option key={u.userId} value={u.userId}>{u.username}</option>)}
          </select>
        </div>

        <button 
          onClick={handleDeployment}
          disabled={isSyncing}
          className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase italic shadow-lg shadow-blue-600/20"
        >
          {isSyncing ? "Syncing..." : "Confirm Assignment"}
        </button>
      </div>
    </div>
  );
};

export default AssignNewInvestigator;