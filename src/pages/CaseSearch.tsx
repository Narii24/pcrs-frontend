import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import { usePreferencesStore, t } from '@/stores/preferencesStore';

const CaseSearch: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = usePreferencesStore();
  
  // ✅ LISTEN TO THE SAME "search" KEY AS THE HEADER
  const globalSearch = searchParams.get('search') || '';

  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await api.get('/cases');
        setCases(res.data);
      } catch (err) {
        console.error("Failed to load records.");
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  const filteredCases = cases.filter(c => 
    c.caseNumber?.toLowerCase().includes(globalSearch.toLowerCase()) ||
    c.title?.toLowerCase().includes(globalSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#06080f] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">
            {t(language, 'intelligenceDirectory')}
          </h1>
          {globalSearch && (
            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mt-1">
              {t(language, 'showingResultsFor')}: "{globalSearch}"
            </p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 animate-pulse text-blue-500 font-black uppercase">{t(language, 'scanningDatabase')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCases.map((item) => (
              <div 
                key={item.caseId}
                onClick={() => navigate(`/case-details/${item.caseId}`)}
                className="group bg-[#0f111a] border border-white/5 p-6 rounded-[2rem] hover:border-blue-500/50 transition-all cursor-pointer shadow-xl"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black px-3 py-1 rounded-full border border-blue-500/20 uppercase tracking-tighter">{item.caseType || t(language, 'general')}</span>
                  <p className="text-[10px] font-mono text-slate-600 font-bold uppercase">{item.caseNumber}</p>
                </div>
                <h3 className="text-xl font-black mb-4 group-hover:text-blue-400 transition-colors uppercase italic truncate tracking-tighter leading-none">{item.title}</h3>
                <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${
                      item.currentStatus === 'Closed' ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'
                  }`}>
                      {item.currentStatus || t(language, 'activeOperation')}
                  </span>
                  <button className="text-blue-500 text-[9px] font-black uppercase tracking-widest">{t(language, 'fullDossier')}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredCases.length === 0 && (
          <div className="text-center py-24 opacity-20">
            <p className="text-4xl font-black italic uppercase italic">{t(language, 'noRecordsFound')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseSearch;
