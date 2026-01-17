
import React from 'react';
import { formatCurrency } from '../../../utils/formatters';

interface StatCardProps {
  type: 'income' | 'expense';
  value: number;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({ type, value, onClick }) => {
  const isIncome = type === 'income';
  const colorClass = isIncome ? 'text-success' : 'text-danger';
  const iconBg = isIncome ? 'bg-success' : 'bg-danger';
  const icon = isIncome ? 'savings' : 'shopping_cart';
  const label = isIncome ? 'Receitas' : 'Despesas';

  return (
    <div 
      onClick={onClick}
      className="group cursor-pointer rounded-[32px] border border-slate-50 bg-white p-5 shadow-sm transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] overflow-hidden"
    >
      {/* Top row with label and small arrow */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</span>
        <span className="material-symbols-outlined text-slate-200 text-sm transition-colors group-hover:text-slate-400">arrow_forward</span>
      </div>
      
      {/* Content row with icon and value */}
      <div className="flex items-center gap-3">
         {/* Circle Icon Container - Fixed size and flex-shrink-0 to prevent distortion */}
         <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-white shadow-sm shadow-black/5 transition-transform group-hover:scale-105 ${iconBg}`}>
            <span className="material-symbols-outlined text-2xl font-bold">{icon}</span>
         </div>
         
         <div className="flex flex-1 flex-col overflow-hidden">
            <span className={`text-xl sm:text-2xl font-black tracking-tighter truncate ${colorClass}`}>
              {formatCurrency(value)}
            </span>
         </div>
      </div>
    </div>
  );
};
