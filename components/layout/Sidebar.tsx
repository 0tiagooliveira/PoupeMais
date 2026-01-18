
import React from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const Sidebar: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const links = [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/transactions', icon: 'receipt_long', label: 'Transações' },
    { to: '/ai-analysis', icon: 'savings', label: 'Poup+ IA', pro: true },
    { to: '/credit-cards', icon: 'credit_card', label: 'Cartões' },
    { to: '/charts', icon: 'bar_chart', label: 'Análise' },
    { to: '/categories', icon: 'category', label: 'Categorias' },
    { to: '/settings', icon: 'settings', label: 'Ajustes' },
  ];

  return (
    <aside className="hidden w-64 flex-col border-r border-slate-100 bg-white md:flex">
      <div className="flex h-full flex-col px-4 py-8">
        <div className="mb-10 px-4">
           <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
             <img 
               src="https://raw.githubusercontent.com/0tiagooliveira/Poupe-/main/Logo%20Poup%2B%20Horizontal%20Verde.svg" 
               alt="Poup+" 
               className="h-10 w-auto object-contain"
               onError={(e) => {
                 (e.target as HTMLImageElement).style.display = 'none';
                 (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
               }}
             />
             <span className="hidden text-2xl font-black text-primary tracking-tighter">Poup+</span>
           </Link>
        </div>

        <nav className="flex-1 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `group flex items-center gap-4 rounded-2xl px-4 py-3 text-[13.5px] font-medium tracking-tight nav-transition relative ${
                  isActive
                    ? 'text-primary'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 h-5 w-1 rounded-full bg-primary" />
                  )}
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${isActive ? 'bg-success/10 text-success' : 'text-slate-400 group-hover:text-slate-600'}`}>
                    <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
                  </div>
                  <span className="truncate">{link.label}</span>
                  {link.pro && !currentUser?.isPro && (
                    <span className="ml-auto text-[9px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase">PRO</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto px-4">
           <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-xl relative overflow-hidden group cursor-pointer" onClick={() => navigate('/pricing')}>
              <div className="absolute top-0 right-0 p-3 opacity-10 transition-transform group-hover:scale-110">
                 <span className="material-symbols-outlined text-6xl">verified</span>
              </div>
              <div className="relative z-10">
                 <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center mb-3 backdrop-blur-sm">
                    <span className="material-symbols-outlined text-amber-400">star</span>
                 </div>
                 <p className="text-xs font-bold text-slate-300 mb-0.5">Upgrade</p>
                 <p className="text-sm font-black tracking-tight">Seja Premium</p>
              </div>
           </div>
        </div>
      </div>
    </aside>
  );
};
