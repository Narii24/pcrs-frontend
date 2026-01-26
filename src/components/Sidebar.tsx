import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const Sidebar = () => {
  const location = useLocation();
  const { userInfo } = useAuthStore() as any;
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
    { name: 'Dashboard', icon: '📊', path: '/dashboard' },
    { name: 'New Cases', icon: '📁', path: '/cases' }, 
    { name: 'Register Case', icon: '📝', path: '/register-case' },
    { name: 'Assign Cases', icon: '⚖️', path: '/assign-cases' },
    { name: 'Document Archive', icon: '📜', path: '/documents' },
  ];

  return (
    <aside className="w-72 h-screen bg-[#0a0c14] border-r border-white/5 flex flex-col p-6 sticky top-0 z-50">
      <div className="mb-12 px-2">
        <Link to="/dashboard" className="group">
          <h1 className="text-2xl font-black italic tracking-tighter text-white group-hover:text-blue-500 transition-colors">
            PCRS <span className="text-blue-500"></span>
          </h1>
        </Link>
        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.3em]">Justice Information System</p>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-2">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group ${
              location.pathname === item.path 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                : 'text-gray-500 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className={`text-xl transition-transform group-hover:scale-110`}>{item.icon}</span>
            <span className="text-[11px] font-black uppercase tracking-widest">{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* ✅ CLICKABLE INVESTIGATOR CARD - Leads to "About User" */}
      <div className="mt-auto border-t border-white/5 pt-6">
        <Link 
          to={`/users/${userInfo?.sub || 'U-00529'}`} 
          className={`block group transition-all duration-300 transform hover:-translate-y-1 ${
            location.pathname.includes('/users/') ? 'ring-1 ring-blue-500/50 rounded-[2rem]' : ''
          }`}
        >
          <div className="bg-white/5 p-4 rounded-[2rem] border border-white/5 flex items-center gap-4 group-hover:border-blue-500/30 group-hover:bg-blue-500/5 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40">
              {displayName.charAt(0) || 'M'}
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{displayRole}</p>
              <p className="text-sm font-bold text-white truncate italic group-hover:text-blue-400 transition-colors">
                {displayName}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-tighter">Authorized</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
