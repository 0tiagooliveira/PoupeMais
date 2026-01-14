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
}

export const TransactionSummaryCard: React.FC<TransactionSummaryCardProps> = ({
  type,
  total,
  transactions,
  onViewAll,
  onAdd
}) => {
  const isIncome = type === 'income';
  const colorClass = isIncome ? 'text-success' : 'text-danger';
  const bgClass = isIncome ? 'bg-success' : 'bg-danger';
  const themeBg = isIncome ? 'bg-success/10' : 'bg-danger/10';
  const headerIcon = isIncome ? 'payments' : 'shopping_cart';
  const title = isIncome ? 'Últimas Receitas' : 'Últimas Despesas';

  const getCategoryInfo = (categoryName: string) => {
    const all = [...incomeCategories, ...expenseCategories];
    return all.find(c => c.name === categoryName) || { icon: 'receipt_long', color: '#94a3b8' };
  };

  return (
    <div className="flex flex-col rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{title}</h3>
        <button onClick={onViewAll} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-300 hover:text-slate-500 transition-colors">
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </button>
      </div>

      {/* Total Display */}
      <div className="flex items-center gap-4 mb-7">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm border border-white ${themeBg}`}>
          <span className={`material-symbols-outlined text-xl ${colorClass}`}>
            {headerIcon}
          </span>
        </div>
        <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Total Mensal</p>
            <span className={`text-2xl font-bold tracking-tighter ${colorClass}`}>
                {formatCurrency(total)}
            </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 space-y-3 mb-6">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-300 text-xs text-center border-2 border-dashed border-slate-50 rounded-[24px] bg-slate-50/20">
            <span className="material-symbols-outlined mb-2 text-xl opacity-30">history</span>
            <p className="font-bold uppercase tracking-tight opacity-50">Sem registros</p>
          </div>
        ) : (
          transactions.map((t) => {
            const cat = getCategoryInfo(t.category);
            const isParcelado = t.totalInstallments && t.totalInstallments > 1;
            return (
              <div 
                key={t.id} 
                className="group flex items-center justify-between rounded-[18px] border border-slate-50/50 bg-slate-50/30 p-3 hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div 
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px] shadow-sm transition-transform group-hover:scale-105 ${themeBg} ${colorClass}`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {cat.icon}
                    </span>
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-xs font-bold text-slate-700 leading-tight">
                        {t.description}
                      </span>
                      {isParcelado && (
                        <span className={`text-[8px] font-black px-1 rounded bg-white/50 border border-slate-100 ${colorClass}`}>
                          {t.installmentNumber}/{t.totalInstallments}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-tight">
                      {new Date(t.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <div className="text-right ml-2">
                    <span className={`text-xs font-bold tracking-tight ${colorClass}`}>
                       {formatCurrency(t.amount)}
                    </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Action Button */}
      {transactions.length > 0 ? (
        <button 
            onClick={onViewAll}
            className={`w-full rounded-2xl py-3 text-[10px] font-bold text-white shadow-md transition-all active:scale-[0.98] ${bgClass} hover:opacity-90 uppercase tracking-[0.1em]`}
        >
            Ver Extrato
        </button>
      ) : (
        <Button 
            variant="secondary" 
            onClick={onAdd}
            className="w-full rounded-2xl py-3 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] border-slate-100"
        >
            Adicionar Novo
        </Button>
      )}
    </div>
  );
};