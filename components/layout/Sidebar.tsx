import React from 'react';
import { NavLink } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  const links = [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/transactions', icon: 'receipt_long', label: 'Transações' },
    { to: '/incomes', icon: 'trending_up', label: 'Receitas' },
    { to: '/expenses', icon: 'trending_down', label: 'Despesas' },
    // { to: '/credit-expenses', icon: 'credit_card', label: 'Desp. Cartão' }, // Futuro
  ];

  return (
    <aside className="hidden w-64 flex-col border-r border-gray-200 bg-surface md:flex">
      <div className="flex h-full flex-col px-4 py-6">
        <nav className="flex-1 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-primary'
                    : 'text-secondary hover:bg-gray-50 hover:text-slate-800'
                }`
              }
            >
              <span className="material-symbols-outlined text-xl">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>
        
        <div className="mt-auto rounded-xl bg-gradient-to-br from-primary to-blue-600 p-4 text-white">
            <h4 className="font-bold text-sm mb-1">Poup+ Premium</h4>
            <p className="text-xs text-blue-100 mb-3">Desbloqueie gráficos avançados e sincronização bancária.</p>
            <button className="w-full rounded-lg bg-white/20 py-1.5 text-xs font-semibold hover:bg-white/30 transition-colors">
                Em breve
            </button>
        </div>
      </div>
    </aside>
  );
};