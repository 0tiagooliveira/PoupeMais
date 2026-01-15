
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
      className="group cursor-pointer rounded-[24px] md:rounded-[32px] border border-slate-50 bg-white p-3 md:p-5 shadow-sm transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
    >
      {/* Top row with label and small arrow */}
      <div className="mb-3 md:mb-4 flex items-center justify-between">
        <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="material-symbols-outlined text-slate-200 text-sm transition-colors group-hover:text-slate-400">arrow_forward</span>
      </div>
      
      {/* Content row with icon and value */}
      <div className="flex items-center gap-2 md:gap-4">
         {/* Ultra small circle on mobile, larger squircle on desktop */}
         <div className={`flex items-center justify-center text-white shadow-sm shadow-black/5 transition-transform group-hover:scale-105 ${iconBg}
           h-8 w-8 rounded-full text-sm md:h-14 md:w-12 md:rounded-[20px] md:text-2xl`}>
            <span className="material-symbols-outlined font-bold">{icon}</span>
         </div>
         
         <div className="flex flex-col flex-1">
            <span className={`text-xl md:text-2xl font-bold tracking-tighter ${colorClass}`}>
              {formatCurrency(value)}
            </span>
         </div>
      </div>
    </div>
  );
};
