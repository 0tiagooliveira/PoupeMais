
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { NewTransactionModal } from '../../features/dashboard/components/NewTransactionModal';
import { useTransactions } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../contexts/AuthContext';

export const MobileNav: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { addTransaction, deleteTransaction } = useTransactions(new Date());
  const { accounts } = useAccounts();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const mainLinks = [
    { to: '/', icon: 'home', label: 'Início' },
    { to: '/ai-analysis', icon: 'psychology', label: 'Poup IA' },
  ];

  const menuLinks = [
    { to: '/transactions', icon: 'receipt_long', label: 'Transações', desc: 'Histórico completo de lançamentos' },
    { to: '/credit-cards', icon: 'credit_card', label: 'Cartões', desc: 'Faturas e limites de crédito' },
    { to: '/charts', icon: 'bar_chart', label: 'Análise', desc: 'Gráficos e visão anual' },
    { to: '/categories', icon: 'category', label: 'Categorias', desc: 'Gerencie suas categorias' },
    { to: '/pricing', icon: 'verified', label: 'Plano PRO', desc: 'Benefícios exclusivos', pro: true },
    { to: '/settings', icon: 'settings', label: 'Ajustes', desc: 'Perfil e importação de dados' },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100/50 bg-white/80 px-4 pb-safe pt-1 md:hidden backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-around h-14 relative">
          
          {mainLinks.map((link) => (
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
                  <span className="text-[9px] font-bold tracking-tight uppercase">{link.label}</span>
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

          <button
            onClick={() => navigate('/charts')}
            className={`flex flex-1 flex-col items-center justify-center gap-1 nav-transition text-slate-400`}
          >
            <span className="material-symbols-outlined text-[22px] icon-outline">bar_chart</span>
            <span className="text-[9px] font-bold tracking-tight uppercase">Análise</span>
          </button>

          <button
            onClick={() => setIsMenuOpen(true)}
            className={`flex flex-1 flex-col items-center justify-center gap-1 nav-transition ${isMenuOpen ? 'text-success' : 'text-slate-400'}`}
          >
            <span className="material-symbols-outlined text-[22px] icon-outline">menu</span>
            <span className="text-[9px] font-bold tracking-tight uppercase">Menu</span>
          </button>
        </div>
      </nav>

      <NewTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={addTransaction}
        onDelete={deleteTransaction}
        accounts={accounts}
      />

      <Modal isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} title="Navegação">
        <div className="grid grid-cols-1 gap-3 py-2">
           {menuLinks.map((link) => (
             <button
               key={link.to}
               onClick={() => { navigate(link.to); setIsMenuOpen(false); }}
               className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50 border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all active:scale-[0.98]"
             >
               <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-white shadow-sm ${link.pro && !currentUser?.isPro ? 'text-amber-500' : 'text-slate-500'}`}>
                 <span className="material-symbols-outlined">{link.icon}</span>
               </div>
               <div className="text-left flex-1">
                 <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">{link.label}</p>
                    {link.pro && !currentUser?.isPro && <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase">PRO</span>}
                 </div>
                 <p className="text-[10px] font-medium text-slate-400">{link.desc}</p>
               </div>
               <span className="material-symbols-outlined text-slate-300">chevron_right</span>
             </button>
           ))}
        </div>
      </Modal>
    </>
  );
};
