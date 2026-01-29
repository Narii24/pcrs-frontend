import { motion } from 'framer-motion';
import { usePreferencesStore, t } from '@/stores/preferencesStore';

const UserProfile = () => {
  const { language, theme } = usePreferencesStore();
  const isLight = theme === 'light';

  return (
    <div
      className={`min-h-screen p-8 md:p-12 ${
        isLight ? 'bg-white text-slate-900' : 'bg-[#06080f] text-white'
      }`}
    >
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-8"
      >
        {/* Header Dossier */}
        <div
          className={`rounded-[3rem] p-10 border shadow-2xl flex flex-col md:flex-row gap-10 items-center ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0f111a] border-white/5'
          }`}
        >
          <div className="w-40 h-40 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-6xl font-black text-white shadow-2xl shadow-blue-500/20">
            M
          </div>
          <div className="text-center md:text-left space-y-2">
            <h1
              className={`text-5xl font-black italic tracking-tighter uppercase ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              Mulu Getachew
            </h1>
            <p className="text-blue-500 font-bold tracking-[0.4em] uppercase text-xs">{t(language, 'seniorInvestigatorRankIV')}</p>
            <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
               <span className="px-4 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full border border-emerald-500/20 uppercase tracking-widest">{t(language, 'authorized')}</span>
               <span
                 className={`px-4 py-1 text-[10px] font-black rounded-full border uppercase tracking-widest ${
                   isLight
                     ? 'bg-slate-200 text-slate-700 border-slate-300'
                     : 'bg-white/5 text-gray-400 border-white/10'
                 }`}
               >
                 {t(language, 'idLabel')}: PCRS-00529
               </span>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className={`p-8 rounded-[2.5rem] border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0f111a] border-white/5'
            }`}
          >
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">{t(language, 'securityClearanceTitle')}</h3>
            <ul className="space-y-4">
              <li className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-400">{t(language, 'clearanceLevelLabel')}</span>
                <span className="text-sm font-black text-blue-500 italic">ADMIN_TOP_SECRET</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-400">{t(language, 'departmentLabel')}</span>
                <span className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Cyber Fraud Division
                </span>
              </li>
            </ul>
          </div>

          <div
            className={`p-8 rounded-[2.5rem] border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0f111a] border-white/5'
            }`}
          >
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">{t(language, 'caseStatisticsTitle')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className={`text-3xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>14</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase">{t(language, 'activeCasesLabel')}</p>
              </div>
              <div>
                <p className="text-3xl font-black text-blue-500">128</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase">{t(language, 'totalClosuresLabel')}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UserProfile;
