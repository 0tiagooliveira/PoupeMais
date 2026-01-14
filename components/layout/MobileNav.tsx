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
    { to: '/', icon: 'home', label: 'Principal' },
    { to: '/transactions', icon: 'swap_horiz', label: 'Transações' },
    { to: '/charts', icon: 'bar_chart', label: 'Gráficos' },
    { to: '/settings', icon: 'settings', label: 'Configurações' },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-100 bg-white px-4 pb-safe pt-2 md:hidden shadow-[0_-8px_20px_-6px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between relative">
          {/* Esquerda */}
          <div className="flex flex-1 justify-around">
            {links.slice(0, 2).map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 p-2 transition-all ${
                    isActive ? 'text-slate-800' : 'text-slate-400'
                  }`
                }
              >
                <span className={`material-symbols-outlined text-2xl ${window.location.hash === '#'+link.to ? 'font-bold' : ''}`}>{link.icon}</span>
                <span className="text-[10px] font-bold">{link.label}</span>
              </NavLink>
            ))}
          </div>

          {/* Botão Central Floating */}
          <div className="relative -top-6">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white shadow-lg shadow-success/30 active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined text-3xl font-bold">add</span>
            </button>
          </div>

          {/* Direita */}
          <div className="flex flex-1 justify-around">
            {links.slice(2).map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 p-2 transition-all ${
                    isActive ? 'text-slate-800' : 'text-slate-400'
                  }`
                }
              >
                <span className={`material-symbols-outlined text-2xl ${window.location.hash === '#'+link.to ? 'font-bold' : ''}`}>{link.icon}</span>
                <span className="text-[10px] font-bold">{link.label}</span>
              </NavLink>
            ))}
          </div>
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