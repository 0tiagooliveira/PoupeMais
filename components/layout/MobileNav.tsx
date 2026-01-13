import React from 'react';
import { NavLink } from 'react-router-dom';

export const MobileNav: React.FC = () => {
  const links = [
    { to: '/', icon: 'dashboard', label: 'Início' },
    { to: '/transactions', icon: 'receipt_long', label: 'Extrato' },
    { to: '/incomes', icon: 'trending_up', label: 'Receitas' },
    { to: '/expenses', icon: 'trending_down', label: 'Despesas' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white px-6 pb-safe pt-2 md:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-lg p-2 transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-gray-400 hover:text-slate-600'
              }`
            }
          >
            <span className="material-symbols-outlined text-2xl">{link.icon}</span>
            <span className="text-[10px] font-medium">{link.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};