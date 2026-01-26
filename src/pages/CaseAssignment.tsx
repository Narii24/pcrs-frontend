import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '@/stores/authStore';
import { UserCheck, UserMinus, Search, Filter, FileText, ChevronRight } from 'lucide-react';
import { listDocuments } from '../services/Document';

interface CaseAssignmentData {
  assignmentId: number;
  caseId: string;
  userId: string;
  userName: string;
  assignedDate: string;
  fullName: string;
  partyId: string;
  partyType: string;
  phoneNumber: string;
  updateDetails: string;
  lastEntryDate: string;
}

const CaseAssignment = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuthStore() as any;
  const canEditAssignment = hasRole('Supervisor') || hasRole('Admin');

  const [assignments, setAssignments] = useState<CaseAssignmentData[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<CaseAssignmentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'assigned' | 'unassigned' | 'documents'>('assigned');
  const [searchParams] = useSearchParams();

  // Initialize from localStorage
  const getInitialPending = () => {
    try {
        const saved = localStorage.getItem('supervisor_pending_assignments');
        return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  };

  useEffect(() => {
    // Initialize view mode from query param (?view=assigned|unassigned|documents)
    const initialView = (searchParams.get('view') || '').toLowerCase();
    if (initialView === 'assigned' || initialView === 'unassigned' || initialView === 'documents') {
      setViewMode(initialView as 'assigned' | 'unassigned' | 'documents');
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        setIsLoading(true);
        // Use allSettled to prevent one failure from blocking the others
        const [assignedRes, casesRes, usersRes, documentsRes] = await Promise.allSettled([
          api.get('/assignedcases'),
          api.get('/cases'),
          api.get('/users'),
          listDocuments(),
        ]);

        // 1. Process Users First (for name mapping)
        const localUserMap: Record<string, string> = {};
        const rawUsers = usersRes.status === 'fulfilled' && Array.isArray(usersRes.value.data) ? usersRes.value.data : [];
        rawUsers.forEach((u: any) => {
             const full = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
             localUserMap[u.userId] = full || u.username || u.userId;
        });
        setUsers(rawUsers);

        // 2. Process Assignments & Merge Pending
        let rawAssignments: CaseAssignmentData[] = [];
        if (assignedRes.status === 'fulfilled' && Array.isArray(assignedRes.value.data)) {
            rawAssignments = assignedRes.value.data;
        }

        // Merge Pending Assignments
        const pending = getInitialPending();
        const mergedAssignments = [...rawAssignments];
        
        pending.forEach((p: any) => {
            const exists = rawAssignments.some((a: any) => 
                String(a.caseId).toLowerCase() === String(p.caseId).toLowerCase() && 
                a.userId === p.userId
            );
            if (!exists) {
                // Map to CaseAssignmentData structure
                mergedAssignments.push({
                    assignmentId: p.assignmentId || Date.now(), // Temporary ID
                    caseId: p.caseId,
                    userId: p.userId,
                    userName: localUserMap[p.userId] || p.userId,
                    assignedDate: new Date(p.timestamp || Date.now()).toISOString(),
                    fullName: 'Pending Sync...', // Placeholder
                    partyId: '',
                    partyType: 'Subject',
                    phoneNumber: '',
                    updateDetails: 'Assignment pending synchronization...',
                    lastEntryDate: new Date().toISOString()
                });
            }
        });
        setAssignments(mergedAssignments);

        // 3. Process Cases & Orphan Recovery
        let rawCases = casesRes.status === 'fulfilled' && Array.isArray(casesRes.value.data) ? casesRes.value.data : [];
        const existingCaseIds = new Set(rawCases.map((c: any) => c.caseId));
        
        // Find assignments that point to cases we don't have
        const missingIds = [...new Set(mergedAssignments
            .map(a => a.caseId)
            .filter(id => id && !existingCaseIds.has(id))
        )]

        if (missingIds.length > 0) {
             console.log(`Recovering ${missingIds.length} orphan cases...`);
             const recoveredResults = await Promise.allSettled(
                missingIds.map(id => api.get(`/cases/${id}`))
             );
             const recovered = recoveredResults
                .filter(r => r.status === 'fulfilled')
                .map((r: any) => r.value.data)
                .filter(c => c && c.caseId);
             
             if (recovered.length > 0) {
                 rawCases = [...rawCases, ...recovered];
             }
        }
        setCases(rawCases);

        // 4. Process Documents
        const rawDocuments = documentsRes.status === 'fulfilled' ? documentsRes.value : [];
        setDocuments(Array.isArray(rawDocuments) ? rawDocuments : []);

      } catch (err) {
        console.error("Critical Sync Error", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAssignments();
  }, []);

  const caseById = useMemo(() => {
    const map: Record<string, any> = {};
    cases.forEach(c => {
      if (c.caseId) {
        map[c.caseId] = c;
      }
    });
    return map;
  }, [cases]);

  const userById = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => {
      const id = u.userId || u.id;
      if (!id) return;
      map[id] = u.name || u.username || id;
    });
    return map;
  }, [users]);

  const saveChanges = async (id: number) => {
    if (!editFormData) return;
    try {
      await api.put(`/assignedcases/${id}`, {
        assignedDate: new Date().toISOString(),
        caseId: editFormData.caseId,
        userId: editFormData.userId,
        updateDetails: editFormData.updateDetails
      });
      setAssignments(prev => prev.map(c => c.assignmentId === id ? { ...editFormData } : c));
      setEditingId(null);
      alert("SYSTEM UPDATE SUCCESSFUL");
    } catch (error) {
      alert("SYSTEM ERROR: Assignment synchronization failed.");
    }
  };

  const filteredAssignments = useMemo(() => {
    return assignments.filter(item => {
      const investigatorName =
        item.userName || userById[item.userId] || item.userId || '';
      const needle = searchTerm.toLowerCase();
      return (
        item.caseId.toLowerCase().includes(needle) ||
        investigatorName.toLowerCase().includes(needle)
      );
    });
  }, [assignments, searchTerm, userById]);

  const unassignedCases = useMemo(() => {
    const assignedIds = new Set(assignments.map(a => a.caseId));
    return cases.filter(c => !assignedIds.has(c.caseId));
  }, [cases, assignments]);

  const filteredUnassigned = useMemo(() => {
    return unassignedCases.filter(c => {
      const needle = searchTerm.toLowerCase();
      return (
        String(c.caseId).toLowerCase().includes(needle) ||
        String(c.title).toLowerCase().includes(needle)
      );
    });
  }, [unassignedCases, searchTerm]);

  const documentsByCase = useMemo(() => {
    const map: Record<string, any[]> = {};
    documents.forEach(doc => {
      if (!doc.caseId) return;
      const key = doc.caseId;
      if (!map[key]) map[key] = [];
      map[key].push(doc);
    });
    return map;
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const needle = searchTerm.toLowerCase();
      return (
        String(doc.caseId).toLowerCase().includes(needle) ||
        String(doc.file_name).toLowerCase().includes(needle) ||
        String(doc.typeOfDocument).toLowerCase().includes(needle)
      );
    });
  }, [documents, searchTerm]);

  if (isLoading) return <div className="p-10 text-blue-500 font-black animate-pulse uppercase">Syncing Neural Registry...</div>;

  return (
    <div className="p-8 space-y-10 bg-[#06080f] min-h-screen text-white">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-6 border-b border-white/5 pb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter">
              Personnel <span className="text-blue-600">Deployment</span>
            </h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-2">
              System Registry • {viewMode === 'assigned' ? 'Active Deployments' : 'Pending Assignments'}
            </p>
          </div>

          <div className="flex gap-4">
             <div className="flex items-center gap-2 bg-[#0f111a] border border-white/10 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('assigned')}
                  className={`px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${
                    viewMode === 'assigned' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Assigned ({assignments.length})
                </button>
                <button
                  onClick={() => setViewMode('unassigned')}
                  className={`px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${
                    viewMode === 'unassigned' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Unassigned ({unassignedCases.length})
                </button>
                <button
                  onClick={() => setViewMode('documents')}
                  className={`px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${
                    viewMode === 'documents' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Documents ({documents.length})
                </button>
             </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4 bg-[#0f111a] border border-white/10 px-4 py-2 rounded-xl w-full max-w-md">
             <Search size={14} className="text-gray-500" />
             <input 
               type="text"
               placeholder={
                 viewMode === 'assigned' ? "SEARCH ASSIGNMENTS..." : 
                 viewMode === 'unassigned' ? "SEARCH UNASSIGNED CASES..." : 
                 "SEARCH DOCUMENTS..."
               }
               className="bg-transparent border-none outline-none text-[10px] font-black uppercase w-full text-white placeholder-gray-600"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
           
           <button 
             onClick={() => navigate('/assign-new')} 
             className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-xl text-[10px] font-black uppercase italic shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
           >
             <Filter size={14} /> Assign New
           </button>
        </div>
      </div>

      {/* GRID CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {viewMode === 'assigned' ? (
          filteredAssignments.map((item) => (
            <div key={item.assignmentId} className="bg-[#0f111a] border border-white/5 rounded-[3.5rem] p-10 relative group hover:border-blue-500/30 transition-all">
              {(() => {
                const caseInfo = caseById[item.caseId] || {};
                const investigatorName =
                  item.userName || userById[item.userId] || item.userId;
                const title = caseInfo.title || 'Active Operation';
                const status = caseInfo.currentStatus || 'Unknown';
                const location = caseInfo.location || 'Unknown';
                const caseType = caseInfo.caseType || 'Unspecified';
                return (
                  <>
                    <div className="flex justify-between items-start mb-8">
                      <div className="space-y-3">
                        <span className="bg-blue-600/10 text-blue-400 border border-blue-500/20 px-4 py-1 rounded-lg text-[10px] font-black uppercase">
                          {item.caseId}
                        </span>
                        <div className="space-y-1">
                          <h3 className="text-2xl font-black uppercase italic tracking-tight">
                            {title}
                          </h3>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.25em]">
                            Status: {status}
                          </p>
                          <div className="flex flex-wrap gap-3 text-[9px] font-bold uppercase text-gray-500">
                            <span>Loc: <span className="text-gray-300">{location}</span></span>
                            <span className="w-1 h-1 bg-gray-600 rounded-full" />
                            <span>Type: <span className="text-gray-300">{caseType}</span></span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-gray-500 font-black uppercase">Lead Investigator</p>
                        <p className="text-blue-400 text-lg font-black uppercase italic">{investigatorName}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                           <UserCheck size={12} className="text-emerald-500" />
                           <p className="text-[9px] text-emerald-500 font-black uppercase">Deployed</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-black/30 p-6 rounded-[2rem] border border-white/5">
                        <label className="text-[9px] text-emerald-500 font-black uppercase tracking-widest block mb-2">
                          {item.partyType || 'Subject'}
                        </label>
                        <p className="text-xl font-bold uppercase">{item.fullName}</p>
                        <p className="text-[10px] text-gray-500 font-mono mt-1">
                          {item.phoneNumber || 'No contact number recorded'}
                        </p>
                      </div>

                      <div className="bg-black/30 p-6 rounded-[2rem] border border-white/5">
                        <label className="text-[9px] text-blue-500 font-black uppercase tracking-widest block mb-2">
                          Investigator & Notes
                        </label>
                        <p className="text-sm font-bold text-white uppercase mb-3">
                          {investigatorName}
                        </p>
                        {editingId === item.assignmentId ? (
                          <textarea
                            className="w-full bg-black/50 border border-blue-500/50 p-2 rounded-lg text-[11px] text-white h-16 outline-none"
                            value={editFormData?.updateDetails}
                            onChange={(e) =>
                              setEditFormData({ ...editFormData!, updateDetails: e.target.value })
                            }
                          />
                        ) : (
                          <p className="text-[11px] text-gray-400 leading-relaxed italic line-clamp-3">
                            "{item.updateDetails || 'No recent activity logs recorded.'}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/5 flex justify-between items-center">
                      <div className="flex gap-4">
                        {canEditAssignment && (
                          editingId === item.assignmentId ? (
                            <button onClick={() => saveChanges(item.assignmentId)} className="bg-emerald-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase">Save Update</button>
                          ) : (
                            <button onClick={() => {
                                setEditingId(item.assignmentId);
                                setEditFormData({ ...item });
                              }} className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-xl text-[10px] font-black uppercase">Modify Lead</button>
                          )
                        )}
                        <button onClick={() => navigate(`/cases/${item.caseId}`)} className="text-blue-400 text-[10px] font-black uppercase hover:underline">Full Dossier →</button>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-gray-600 font-black uppercase">Last Updated</p>
                        <p className="text-[10px] font-mono text-gray-400">{item.lastEntryDate || item.assignedDate}</p>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ))
        ) : (
          filteredDocuments.map((doc) => (
             <div key={doc.documentId} className="bg-[#0f111a] border border-white/5 rounded-[3.5rem] p-10 relative group hover:border-blue-500/30 transition-all">
                <div className="flex justify-between items-start mb-8">
                  <div className="space-y-3 w-full mr-6">
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-600/10 text-blue-400 border border-blue-500/20 px-4 py-1 rounded-lg text-[10px] font-black uppercase">
                        {doc.caseId}
                      </span>
                      
                      <div className="flex items-center gap-1 text-[8px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded font-black uppercase">
                        <FileText size={10} /> Document
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-2xl font-black uppercase italic tracking-tight text-white">
                        {doc.file_name}
                      </h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.25em]">
                        Type: {doc.typeOfDocument}
                      </p>
                      <div className="flex flex-wrap gap-3 text-[9px] font-bold uppercase text-gray-500">
                        <span>Size: <span className="text-gray-300">{Math.round(doc.fileSize / 1024)}KB</span></span>
                        <span>Date: <span className="text-gray-300">{new Date(doc.createdAt).toLocaleDateString()}</span></span>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => navigate(`/cases/${doc.caseId}`)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-6 py-2 rounded-lg uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                       >
                        View Case
                       </button>
                    </div>
                  </div>

                  <button 
                    onClick={() => navigate(`/cases/${doc.caseId}`)} 
                    className="p-4 bg-slate-800/30 border border-slate-700 rounded-2xl group-hover:bg-blue-600 transition-all text-white"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
             </div>
          ))
        )}
      </div>
      
      {((viewMode === 'assigned' && filteredAssignments.length === 0) || (viewMode === 'unassigned' && filteredUnassigned.length === 0) || (viewMode === 'documents' && filteredDocuments.length === 0)) && (
        <div className="text-center py-24 border-2 border-dashed border-white/5 rounded-[4rem]">
          <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">📂</div>
          <p className="text-gray-500 font-black uppercase tracking-widest">
            {viewMode === 'assigned' ? "No Active Assignments Found" : 
             viewMode === 'unassigned' ? "No Unassigned Cases Found" : 
             "No Documents Found"}
          </p>
        </div>
      )}
    </div>
  );
};

export default CaseAssignment;
