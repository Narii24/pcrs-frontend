import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const EvidenceVault = () => {
  const [evidenceList, setEvidenceList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for form and file
  const [formData, setFormData] = useState({
    evidenceId: '',
    caseId: '',
    type: 'PHOTO', 
    description: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Helper to trigger notifications
  const triggerNotify = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // FETCH LIST: Display recorded intelligence
  const fetchEvidence = async () => {
    try {
      const response = await api.get('/api/evidences');
      setEvidenceList(response.data);
    } catch (err) { 
      console.error("Sync Error", err); 
    }
  };

  useEffect(() => { fetchEvidence(); }, []);

  // Filter list based on Evidence ID or Case ID
  const filteredList = evidenceList.filter((ev: any) => 
    ev.evidenceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ev.caseId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // SECURE ENTRY: Functional POST with File Upload and Notifications
  const handleSecureEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // REQUIRE FILE: If no file is sent, notification is FAILED
    if (!selectedFile) {
      triggerNotify("FAILED: NO FILE ATTACHED", "error");
      return;
    }

    const data = new FormData();
    data.append('evidenceId', formData.evidenceId);
    data.append('caseId', formData.caseId);
    data.append('type', formData.type);
    data.append('description', formData.description);
    data.append('file', selectedFile);

    try {
      await api.post('/api/evidences', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      triggerNotify("INTELLIGENCE SECURED SUCCESSFULLY", "success");
      setIsModalOpen(false);
      setSelectedFile(null);
      setFormData({ evidenceId: '', caseId: '', type: 'PHOTO', description: '' });
      fetchEvidence(); 
    } catch (err) {
      console.error("Secure Entry Failed", err);
      triggerNotify("FAILED: SERVER TRANSMISSION ERROR", "error");
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 p-4 bg-black text-white relative">
      
      {/* NOTIFICATION POPUP */}
      {notification && (
        <div className={`fixed top-5 right-5 z-[100] px-6 py-3 rounded-xl border font-black uppercase tracking-widest text-[10px] shadow-2xl animate-bounce
          ${notification.type === 'success' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-red-500/20 border-red-500 text-red-500'}`}>
          {notification.msg}
        </div>
      )}

      {/* HEADER & SEARCH & REGISTER BUTTON */}
      <div className="flex justify-between items-center bg-[#11141d] p-6 rounded-3xl border border-white/5 shadow-xl">
        <h1 className="text-2xl font-black italic uppercase">Evidence <span className="text-blue-500">Vault</span></h1>
        
        <div className="flex gap-4 items-center">
          {/* SEARCH INPUT */}
          <div className="relative">
            <input 
              type="text"
              placeholder="SEARCH ID OR CASE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-black border border-white/10 rounded-xl px-4 py-2 text-[10px] font-bold w-64 focus:border-blue-500 outline-none uppercase"
            />
          </div>

          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 px-6 py-3 rounded-xl font-black uppercase text-[10px] hover:bg-blue-500 transition-all">
            + Register Intelligence
          </button>
        </div>
      </div>

      {/* RECORDED LIST */}
      <div className="bg-[#11141d] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="grid grid-cols-4 p-6 bg-black/40 text-[9px] font-black uppercase text-blue-500 tracking-widest border-b border-white/5">
          <div>Evidence ID</div>
          <div>Case ID</div>
          <div>Evidence Type</div>
          <div>Intelligence Description</div>
        </div>
        <div className="max-h-[550px] overflow-y-auto custom-scrollbar">
          {filteredList.length > 0 ? (
            filteredList.map((ev: any) => (
              <div key={ev.evidenceId} className="grid grid-cols-4 p-6 border-b border-white/5 text-sm items-center hover:bg-white/[0.02] transition-colors">
                <div className="font-mono text-blue-400 font-bold">{ev.evidenceId}</div>
                <div className="font-black uppercase tracking-tight text-slate-200">{ev.caseId}</div>
                <div className="text-[11px] font-bold uppercase text-slate-400">{ev.type}</div>
                <div className="text-xs italic text-slate-500 truncate pr-4">{ev.description}</div>
              </div>
            ))
          ) : (
            <div className="p-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-600">No Intelligence Records Found</div>
          )}
        </div>
      </div>

      {/* MODAL: REGISTER INTELLIGENCE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSecureEntry} className="bg-[#11141d] p-10 rounded-[3rem] border border-white/10 w-full max-w-xl flex flex-col gap-6 shadow-[0_0_50px_rgba(37,99,235,0.1)]">
            <h2 className="text-2xl font-black uppercase italic text-center tracking-tighter">Register <span className="text-blue-500">Intelligence</span></h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-black text-slate-500 ml-2 uppercase">Evidence ID</label>
                <input placeholder="E-001" value={formData.evidenceId} onChange={e => setFormData({...formData, evidenceId: e.target.value.toUpperCase()})} className="bg-black p-4 rounded-xl border border-white/5 text-xs font-bold focus:border-blue-500 outline-none" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-black text-slate-500 ml-2 uppercase">Case ID</label>
                <input placeholder="C-2026" value={formData.caseId} onChange={e => setFormData({...formData, caseId: e.target.value.toUpperCase()})} className="bg-black p-4 rounded-xl border border-white/5 text-xs font-bold focus:border-blue-500 outline-none" required />
              </div>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-[8px] font-black text-slate-500 ml-2 uppercase">Intelligence Type</label>
                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="bg-black p-4 rounded-xl border border-white/5 text-xs font-bold appearance-none cursor-pointer focus:border-blue-500 outline-none">
                  <option value="PHOTO">PHOTO</option>
                  <option value="VIDEO">VIDEO</option>
                  <option value="AUDIO">AUDIO</option>
                  <option value="DOCUMENT">DOCUMENT</option>
                  <option value="PHYSICAL">PHYSICAL</option>
                </select>
            </div>

            {/* FILE UPLOAD BUTTON */}
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-slate-500 ml-2 uppercase">File Attachment</label>
              <input type="file" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="hidden" />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                className={`w-full border border-dashed p-4 rounded-xl text-[10px] font-bold uppercase transition-all ${selectedFile ? 'bg-blue-600/10 border-blue-500 text-blue-500' : 'bg-white/5 border-white/20 text-white hover:bg-white/10'}`}
              >
                {selectedFile ? `✔ ${selectedFile.name}` : "📁 Click to Upload Intelligence File"}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-slate-500 ml-2 uppercase">Details</label>
              <textarea placeholder="DESCRIBE COLLECTED INTELLIGENCE..." rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-black p-4 rounded-xl border border-white/5 text-xs font-bold resize-none focus:border-blue-500 outline-none" required />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-4 rounded-xl text-[10px] font-black uppercase bg-white/5 hover:bg-white/10 transition-all">Abort</button>
              <button type="submit" className="p-4 rounded-xl text-[10px] font-black uppercase bg-blue-600 shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-all">Secure Entry</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default EvidenceVault;