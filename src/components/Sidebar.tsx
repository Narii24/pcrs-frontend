import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePreferencesStore, t } from '@/stores/preferencesStore';

const Sidebar = () => {
  const location = useLocation();
  const { userInfo } = useAuthStore() as any;
  const { theme, language } = usePreferencesStore();
  const isLight = theme === 'light';
  const username = String(userInfo?.username || userInfo?.preferred_username || '').toLowerCase();
  const displayRole =
    username === 'desk01'
      ? 'Desk Officer'
      : String(userInfo?.role || '').trim() || 'User';
  const displayName =
    username === 'desk01'
      ? 'John Doe'
      : String(userInfo?.name || '').trim() || 'Mulu Getachew';

  const menuItems = [
    { name: t(language, 'dashboard'), icon: '📊', path: '/dashboard' },
    { name: t(language, 'newCases'), icon: '📁', path: '/cases' }, 
    { name: t(language, 'registerCase'), icon: '📝', path: '/register-case' },
    { name: t(language, 'assignCases'), icon: '⚖️', path: '/assign-cases' },
    { name: t(language, 'documentArchive'), icon: '📜', path: '/documents' },
  ];

  return (
    <aside className="w-60 h-screen bg-[color:var(--pcrs-surface-2)] border-r border-[color:var(--pcrs-border)] flex flex-col p-4 sticky top-0 z-50">
      <div className="mb-7 px-0.5">
        <Link to="/dashboard" className="group">
          <h1 className="text-lg font-black italic tracking-tighter text-[color:var(--pcrs-text)] group-hover:text-blue-500 transition-colors">
            PCRS <span className="text-blue-500"></span>
          </h1>
        </Link>
        <p className="text-[7px] text-gray-600 font-bold uppercase tracking-[0.3em]">
          {t(language, 'justiceInformationSystem')}
        </p>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-2xl transition-all duration-300 group ${
              location.pathname === item.path 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                : isLight
                  ? 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900'
                  : 'text-gray-500 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="text-sm transition-transform group-hover:scale-110">{item.icon}</span>
            <span className="text-[8px] font-black uppercase tracking-widest">{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* ✅ CLICKABLE INVESTIGATOR CARD - Leads to "About User" */}
      <div className="mt-auto border-t border-[color:var(--pcrs-border)] pt-5">
        <Link 
          to={`/users/${userInfo?.sub || 'U-00529'}`} 
          className={`block group transition-all duration-300 transform hover:-translate-y-1 ${
            location.pathname.includes('/users/') ? 'ring-1 ring-blue-500/50 rounded-[2rem]' : ''
          }`}
        >
          <div className="bg-[color:var(--pcrs-surface)] p-2.5 rounded-[2rem] border border-[color:var(--pcrs-border)] flex items-center gap-2.5 group-hover:border-blue-500/30 group-hover:bg-blue-500/5 transition-all">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40">
              {displayName.charAt(0) || 'M'}
            </div>
            <div className="overflow-hidden">
              <p className="text-[7px] text-gray-500 font-black uppercase tracking-widest">{displayRole}</p>
              <p className="text-[11px] font-bold text-[color:var(--pcrs-text)] truncate italic group-hover:text-blue-400 transition-colors">
                {displayName}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[7px] text-emerald-500 font-bold uppercase tracking-tighter">{t(language, 'authorized')}</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
