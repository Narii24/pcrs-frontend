import { motion } from 'framer-motion';

const UserProfile = () => {
  return (
    <div className="min-h-screen bg-[#06080f] p-8 md:p-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-8"
      >
        {/* Header Dossier */}
        <div className="bg-[#0f111a] rounded-[3rem] p-10 border border-white/5 shadow-2xl flex flex-col md:flex-row gap-10 items-center">
          <div className="w-40 h-40 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-6xl font-black text-white shadow-2xl shadow-blue-500/20">
            M
          </div>
          <div className="text-center md:text-left space-y-2">
            <h1 className="text-5xl font-black italic tracking-tighter text-white uppercase">Mulu Getachew</h1>
            <p className="text-blue-500 font-bold tracking-[0.4em] uppercase text-xs">Senior Investigator • Rank IV</p>
            <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
               <span className="px-4 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full border border-emerald-500/20 uppercase tracking-widest">Authorized</span>
               <span className="px-4 py-1 bg-white/5 text-gray-400 text-[10px] font-black rounded-full border border-white/10 uppercase tracking-widest">ID: PCRS-00529</span>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0f111a] p-8 rounded-[2.5rem] border border-white/5">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">Security Clearance</h3>
            <ul className="space-y-4">
              <li className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-400">Clearance Level</span>
                <span className="text-sm font-black text-blue-500 italic">ADMIN_TOP_SECRET</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-400">Department</span>
                <span className="text-sm font-black text-white">Cyber Fraud Division</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#0f111a] p-8 rounded-[2.5rem] border border-white/5">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">Case Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-3xl font-black text-white">14</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase">Active Cases</p>
              </div>
              <div>
                <p className="text-3xl font-black text-blue-500">128</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase">Total Closures</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UserProfile;