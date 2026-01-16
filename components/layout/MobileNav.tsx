
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { NewTransactionModal } from '../../features/dashboard/components/NewTransactionModal';
import { useTransactions } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';

export const MobileNav: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addTransaction, deleteTransaction } = useTransactions(new Date());
  const { accounts } = useAccounts();

  const links = [
    { to: '/', icon: 'home', label: 'Início' },
    { to: '/ai-analysis', icon: 'psychology', label: 'IA' }, // Novo link
    { to: '/charts', icon: 'bar_chart', label: 'Análise' },
    { to: '/settings', icon: 'settings', label: 'Ajustes' },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100/50 bg-white/80 px-4 pb-safe pt-1 md:hidden backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-around h-14 relative">
          
          {links.slice(0, 2).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-1 nav-transition ${
                  isActive ? 'text-success' : 'text-slate-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`material-symbols-outlined text-[22px] ${isActive ? 'icon-fill' : 'icon-outline'}`}>{link.icon}</span>
                  <span className="text-[9px] font-medium tracking-tight uppercase">{link.label}</span>
                </>
              )}
            </NavLink>
          ))}

          <div className="flex-shrink-0 relative -top-3 px-2">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-success to-emerald-600 text-white shadow-lg shadow-success/30 active:scale-90 nav-transition"
            >
              <span className="material-symbols-outlined text-[28px] font-light">add</span>
            </button>
          </div>

          {links.slice(2).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-1 nav-transition ${
                  isActive ? 'text-success' : 'text-slate-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`material-symbols-outlined text-[22px] ${isActive ? 'icon-fill' : 'icon-outline'}`}>{link.icon}</span>
                  <span className="text-[9px] font-medium tracking-tight uppercase">{link.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <NewTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={addTransaction}
        onDelete={deleteTransaction}
        accounts={accounts}
      />
    </>
  );
};
