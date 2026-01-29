import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
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

interface CaseListProps {
  cases: any[];
}

const CaseList: React.FC<CaseListProps> = ({ cases = [] }) => {
  const navigate = useNavigate();
  const { language } = usePreferencesStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [users, setUsers] = useState<Investigator[]>([]);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        const [assignedRes, usersRes] = await Promise.all([
          api.get('/assignedcases'),
          api.get('/users'),
        ]);
        setAssignments(Array.isArray(assignedRes.data) ? assignedRes.data : []);
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      } catch (err) {
        console.error('New Cases assignment sync failed', err);
      }
    };
    loadAssignments();
  }, []);

  const userById = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => {
      map[u.userId] = u.name || u.username || u.userId;
    });
    return map;
  }, [users]);

  const assignmentsByCase = useMemo(() => {
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

  const onlyNew = cases.filter((c: any) => {
    const status = String(c.currentStatus || '').toLowerCase();
    return (
      status.includes('new') ||
      status.includes('registered') ||
      status.includes('open')
    );
  });

  const query = searchTerm.trim().toLowerCase();
  const filteredCases = !query
    ? onlyNew
    : onlyNew.filter((c: any) => {
        const id = String(c.caseId || '').toLowerCase();
        const number = String(c.caseNumber || '').toLowerCase();
        const title = String(c.title || '').toLowerCase();
        const location = String(c.location || '').toLowerCase();
        return (
          id.includes(query) ||
          number.includes(query) ||
          title.includes(query) ||
          location.includes(query)
        );
      });

  return (
    <div className="p-8 bg-[#06080f] min-h-screen text-white">
      <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic uppercase">{t(language, 'newIntelligenceCases')}</h2>
          <p className="text-[10px] text-blue-500 font-bold uppercase mt-2">{t(language, 'verifiedDatabaseRecords')}</p>
        </div>
        <div className="flex items-center bg-white/5 px-4 py-2 rounded-xl border border-white/10 focus-within:border-blue-500/50 transition-all max-w-xs">
          <span className="text-gray-500 text-sm">🔍</span>
          <input
            type="text"
            placeholder={t(language, 'filterNewCasesPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-xs w-full text-white ml-2 placeholder-white/30 font-bold uppercase tracking-widest"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-5xl">
        <AnimatePresence>
          {filteredCases.map(c => {
            const assignedNames: string[] = assignmentsByCase[c.caseId] || [];
            const assigned = assignedNames.length > 0;

            return (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={c.caseId}
                className="p-8 rounded-[3rem] bg-[#0f111a] border border-white/5 hover:border-blue-500/40 transition-all shadow-2xl flex justify-between items-center"
              >
                <div className="space-y-2">
                  <div className="flex gap-3 items-center">
                    <span className="text-[10px] font-mono text-blue-500 font-black bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                      PCRS-{c.caseNumber || c.caseId}
                    </span>
                    {assigned ? (
                      <span className="text-[9px] text-emerald-500 font-bold uppercase">
                        ● {t(language, 'deployed')}: {assignedNames.join(', ')}
                      </span>
                    ) : (
                      <span className="text-[9px] text-red-500 font-bold uppercase animate-pulse">
                        ● {t(language, 'pendingDeployment')}
                      </span>
                    )}
                  </div>
                  <h4 className="text-white font-black text-3xl uppercase italic">
                    {c.title}
                  </h4>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase">
                    <span>
                      {t(language, 'locLabel')}: <span className="text-slate-300">{c.location}</span>
                    </span>
                    <span className="w-1 h-1 bg-slate-700 rounded-full" />
                    <span>
                      {t(language, 'typeLabel')}: <span className="text-slate-300">{c.caseType}</span>
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/cases/${c.caseId}`)}
                  className="bg-blue-600 px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all mr-4"
                >
                  {t(language, 'analyze')}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CaseList;
