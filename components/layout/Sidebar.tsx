import React from 'react';
import { NavLink } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  const links = [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/transactions', icon: 'receipt_long', label: 'Transações' },
    { to: '/incomes', icon: 'trending_up', label: 'Receitas' },
    { to: '/expenses', icon: 'trending_down', label: 'Despesas' },
    { to: '/charts', icon: 'bar_chart', label: 'Gráficos' },
    { to: '/settings', icon: 'settings', label: 'Ajustes' },
  ];

  return (
    <aside className="hidden w-64 flex-col border-r border-gray-100 bg-surface md:flex">
      <div className="flex h-full flex-col px-4 py-6">
        <nav className="flex-1 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold tracking-tight transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-lg shadow-slate-200'
                    : 'text-secondary hover:bg-slate-50 hover:text-slate-800'
                }`
              }
            >
              <span className="material-symbols-outlined text-xl">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>
        
        <div className="mt-auto rounded-3xl bg-gradient-to-br from-success to-emerald-700 p-5 text-white shadow-xl shadow-success/20">
            <h4 className="font-bold text-sm mb-1 tracking-tight">Poup+ Pro</h4>
            <p className="text-[10px] font-bold text-white/80 mb-4 leading-tight">Inteligência artificial e gráficos avançados.</p>
            <button className="w-full rounded-2xl bg-white/20 py-2.5 text-xs font-bold hover:bg-white/30 transition-all active:scale-95">
                Saiba mais
            </button>
        </div>
      </div>
    </aside>
  );
};