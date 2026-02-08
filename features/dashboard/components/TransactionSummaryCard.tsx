
import React from 'react';
import { Transaction } from '../../../types';
import { formatCurrency } from '../../../utils/formatters';
import { Button } from '../../../components/ui/Button';
import { incomeCategories, expenseCategories } from './NewTransactionModal';

interface TransactionSummaryCardProps {
  type: 'income' | 'expense';
  total: number;
  transactions: Transaction[];
  onViewAll: () => void;
  onAdd: () => void;
  onItemClick?: (transaction: Transaction) => void;
}

export const TransactionSummaryCard: React.FC<TransactionSummaryCardProps> = ({
  type,
  total,
  transactions,
  onViewAll,
  onAdd,
  onItemClick
}) => {
  const isIncome = type === 'income';
  const colorClass = isIncome ? 'text-success' : 'text-danger';
  const bgClass = isIncome ? 'bg-success' : 'bg-danger';
  const themeBg = isIncome ? 'bg-success/10' : 'bg-danger/10';
  const headerIcon = isIncome ? 'payments' : 'shopping_cart';
  const title = isIncome ? 'Últimas receitas' : 'Últimas despesas';

  const getCategoryInfo = (categoryName: string) => {
    const all = [...incomeCategories, ...expenseCategories];
    return all.find(c => c.name === categoryName) || { icon: 'receipt_long', color: '#94a3b8' };
  };

  return (
    <div className="flex flex-col rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-all h-full">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-bold text-slate-400">{title}</h3>
        <button onClick={onViewAll} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 text-slate-300 hover:text-slate-500 transition-colors">
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </button>
      </div>

      <div className="flex items-center gap-4 mb-7">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm border border-white dark:border-slate-700 ${themeBg}`}>
          <span className={`material-symbols-outlined text-xl ${colorClass}`}>
            {headerIcon}
          </span>
        </div>
        <div>
            <p className="text-[10px] font-bold text-slate-400 leading-none mb-1">Total mensal</p>
            <span className={`text-2xl font-bold tracking-tighter ${colorClass}`}>
                {formatCurrency(total)}
            </span>
        </div>
      </div>

      <div className="flex-1 space-y-3 mb-6">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-300 dark:text-slate-600 text-xs text-center border-2 border-dashed border-slate-50 dark:border-slate-800 rounded-[24px] bg-slate-50/20 dark:bg-slate-800/20">
            <span className="material-symbols-outlined mb-2 text-xl opacity-30">history</span>
            <p className="font-bold opacity-50">Sem registros</p>
          </div>
        ) : (
          transactions.map((t) => {
            const cat = getCategoryInfo(t.category);
            const isParcelado = t.totalInstallments && t.totalInstallments > 1;
            const isIgnored = !!t.isIgnored;

            return (
              <button 
                key={t.id} 
                onClick={() => onItemClick?.(t)}
                className={`group flex w-full items-center justify-between rounded-[18px] border border-slate-50/50 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-800/30 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left active:scale-[0.98] ${isIgnored ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div 
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px] shadow-sm transition-transform group-hover:scale-105 ${isIgnored ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500' : `${themeBg} ${colorClass}`}`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {isIgnored ? 'visibility_off' : cat.icon}
                    </span>
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <div className="flex items-center gap-1">
                      <span className={`truncate text-xs font-bold leading-tight ${isIgnored ? 'text-slate-400 dark:text-slate-500 line-through decoration-slate-400 decoration-2' : 'text-slate-700 dark:text-slate-200'}`}>
                        {t.description}
                      </span>
                      {isParcelado && !isIgnored && (
                        <span className={`text-[8px] font-bold px-1 rounded bg-white/50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 ${colorClass}`}>
                          {t.installmentNumber}/{t.totalInstallments}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 tracking-tight">
                      {new Date(t.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <div className="text-right ml-2">
                    <span className={`text-xs font-bold tracking-tight ${isIgnored ? 'text-slate-400 dark:text-slate-500 line-through' : colorClass}`}>
                       {formatCurrency(t.amount)}
                    </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {transactions.length > 0 ? (
        <button 
            onClick={onViewAll}
            className={`w-full rounded-2xl py-3 text-xs font-bold text-white shadow-md transition-all active:scale-[0.98] ${bgClass} hover:opacity-90`}
        >
            Ver extrato
        </button>
      ) : (
        <Button 
            variant="secondary" 
            onClick={onAdd}
            className="w-full rounded-2xl py-3 text-xs font-bold text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800"
        >
            Adicionar novo
        </Button>
      )}
    </div>
  );
};
