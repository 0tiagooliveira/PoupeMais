import React from 'react';
import { formatCurrency } from '../../../utils/formatters';

interface StatCardProps {
  type: 'income' | 'expense';
  value: number;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({ type, value, onClick }) => {
  const isIncome = type === 'income';
  const colorClass = isIncome ? 'text-[#16a34a]' : 'text-[#dc2626]';
  const iconBg = isIncome ? 'bg-[#16a34a]' : 'bg-[#dc2626]';
  const icon = isIncome ? 'savings' : 'shopping_cart';
  const label = isIncome ? 'Receitas' : 'Despesas';

  return (
    <div 
      onClick={onClick}
      className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-secondary">{label}</span>
        <span className="material-symbols-outlined text-gray-300 text-sm">arrow_forward</span>
      </div>
      
      <div className="flex items-center gap-3">
         <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm ${iconBg}`}>
            <span className="material-symbols-outlined text-xl">{icon}</span>
         </div>
         <span className={`text-xl font-bold ${colorClass}`}>
           {formatCurrency(value)}
         </span>
      </div>
    </div>
  );
};