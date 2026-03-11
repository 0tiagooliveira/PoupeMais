
import React from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const HORIZONTAL_LOGO_SRC = '/brand/logo-poup-horizontal-verde.png';

export const Sidebar: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const links = [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/transactions', icon: 'sync_alt', label: 'Transações' },       
    { to: '/ai-analysis', icon: 'savings', label: 'Poup+ IA', pro: true },      
    { to: '/ai-consultoria', icon: 'chat', label: 'Consultoria Poup +', pro: true },
    { to: '/goals', icon: 'flag', label: 'Metas' },
    { to: '/credit-cards', icon: 'credit_card', label: 'Cartões' },
    { to: '/charts', icon: 'bar_chart', label: 'Análise' },
    { to: '/categories', icon: 'category', label: 'Categorias' },
    { to: '/settings', icon: 'settings', label: 'Ajustes' },
  ];

  return (
    <aside className="hidden w-80 flex-col border-r border-slate-100 bg-white xl:flex">
      <div className="flex h-full flex-col px-6 py-8">
        <div className="mb-10 px-3">
           <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
             <img 
               src={HORIZONTAL_LOGO_SRC}
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

        <nav className="flex-1 space-y-2.5">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `group relative flex items-center gap-4 rounded-2xl px-4 py-4 text-base font-bold tracking-tight nav-transition ${
                  isActive
                    ? 'text-primary'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 h-6 w-1 rounded-full bg-primary" />
                  )}
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all ${isActive ? 'bg-success/10 text-success' : 'text-slate-400 group-hover:text-slate-600'}`}>
                    <span className="material-symbols-outlined text-[24px]">{link.icon}</span>
                  </div>
                  <span className="truncate text-base">{link.label}</span>
                  {link.pro && !currentUser?.isPro && (
                    <span className="ml-auto rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-600">PRO</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto px-4">
           <div className="rounded-2xl bg-gradient-to-br from-primary to-emerald-800 p-5 text-white shadow-xl relative overflow-hidden group cursor-pointer" onClick={() => navigate('/pricing')}>
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
