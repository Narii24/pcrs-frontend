import { useAuthStore } from '@/stores/authStore';

const Header = () => {
  const { logout } = useAuthStore();

  return (
    <header className="h-20 flex items-center justify-between px-8 bg-transparent">
      <div className="flex items-center gap-4">
        {/* Breadcrumb or Search */}
        <div className="hidden md:flex items-center bg-white/50 backdrop-blur-md px-4 py-2 rounded-xl border border-white/30 shadow-sm">
          <span className="text-gray-400 mr-2">🔍</span>
          <input 
            type="text" 
            placeholder="Search cases, files..." 
            className="bg-transparent border-none outline-none text-sm w-64"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="relative p-2 hover:bg-white/50 rounded-lg transition">
          <span className="text-xl">🔔</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <button 
          onClick={logout}
          className="clay px-6 py-2 bg-red-50 text-red-600 font-bold text-sm hover:bg-red-600 hover:text-white transition-all duration-300"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
