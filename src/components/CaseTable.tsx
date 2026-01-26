import { CaseDTO } from '../types';

interface CaseTableProps {
  cases: CaseDTO[];
  onEdit: (id: string) => void;
  onView: (id: string) => void;
}

const CaseTable = ({ cases, onEdit, onView }: CaseTableProps) => {
  return (
    <div className="bg-[#0a0c14] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.15em] text-blue-500/70 italic">
            <th className="p-5">Case ID</th>
            <th className="p-5">Intelligence Title</th>
            <th className="p-5">Status</th>
            <th className="p-5">Lead Investigator</th>
            <th className="p-5 text-right">System Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {cases.map((c) => (
            <tr key={c.caseId} className="hover:bg-blue-600/[0.03] transition-colors group">
              <td className="p-5 font-mono text-cyan-400 text-xs font-bold">{c.caseId}</td>
              <td className="p-5 text-white text-xs font-black uppercase italic tracking-tight">
                {c.title}
              </td>
              <td className="p-5">
                <span className={`text-[9px] font-black px-3 py-1 rounded-lg border uppercase ${
                  c.currentStatus === 'CLOSED' 
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                  : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                }`}>
                  {c.currentStatus}
                </span>
              </td>
              <td className="p-5 text-gray-400 text-[11px] font-bold">
                {c.assignedInvestigatorId || "UNASSIGNED"}
              </td>
              <td className="p-5 text-right space-x-2">
                <button 
                  onClick={() => onEdit(c.caseId)}
                  className="bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all"
                >
                  Edit
                </button>
                <button 
                  onClick={() => onView(c.caseId)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase shadow-lg shadow-blue-600/20 transition-all"
                >
                  View Dossier
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CaseTable;