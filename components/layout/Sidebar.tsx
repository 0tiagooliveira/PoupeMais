
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const Sidebar: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const links = [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/transactions', icon: 'receipt_long', label: 'Transações' },
    { to: '/ai-analysis', icon: 'psychology', label: 'Poup+ IA', pro: true },
    { to: '/credit-cards', icon: 'credit_card', label: 'Cartões' },
    { to: '/charts', icon: 'bar_chart', label: 'Análise' },
    { to: '/categories', icon: 'category', label: 'Categorias' },
    { to: '/settings', icon: 'settings', label: 'Ajustes' },
  ];

  return (
    <aside className="hidden w-64 flex-col border-r border-slate-100 bg-white md:flex">
      <div className="flex h-full flex-col px-4 py-8">
        <div className="mb-10 px-4">
           <img 
             src="https://poup-beta.web.app/Icon/LogoPoup.svg" 
             alt="Poup+" 
             className="h-8 w-auto opacity-90" 
           />
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
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${isActive ? 'bg-success/10 text-success' : 'text-slate-400 group-hover:text-slate-500'}`}>
                    <span className={`material-symbols-outlined text-[20px] ${isActive ? 'icon-fill' : 'icon-outline'}`}>
                      {link.icon}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={isActive ? 'font-semibold' : ''}>{link.label}</span>
                    {link.pro && !currentUser?.isPro && (
                      <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase">PRO</span>
                    )}
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        
        <div className="mt-auto space-y-4">
          <div className="rounded-3xl border border-slate-50 bg-slate-50/50 p-3">
             <div className="flex items-center gap-3">
                <img 
                  src={currentUser?.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                  className="h-9 w-9 rounded-full border border-white shadow-sm object-cover"
                  alt="Avatar"
                />
                <div className="flex-1 overflow-hidden">
                   <p className="truncate text-xs font-semibold text-slate-700 leading-none mb-1">
                     {currentUser?.displayName || 'Usuário'}
                   </p>
                   <p className="truncate text-[10px] text-slate-400">
                     {currentUser?.isPro ? 'Membro Premium' : 'Plano Gratuito'}
                   </p>
                </div>
             </div>
          </div>
          
          {!currentUser?.isPro && (
            <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-sm overflow-hidden relative">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1.5">
                     <span className="material-symbols-outlined text-success text-lg icon-fill">verified</span>
                     <h4 className="font-semibold text-[11px] tracking-tight">Status Pro</h4>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-3 leading-tight">Libere a Inteligência Artificial e análises profundas.</p>
                  <button 
                    onClick={() => navigate('/pricing')}
                    className="w-full rounded-xl bg-white/10 py-2.5 text-[10px] font-bold hover:bg-white/20 nav-transition"
                  >
                      Saiba Mais
                  </button>
                </div>
                <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-white/5 text-[80px] rotate-12">auto_awesome</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
