import React from 'react';
import { Transaction } from '../../../types';
import { formatCurrency } from '../../../utils/formatters';
import { Button } from '../../../components/ui/Button';

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
  const colorClass = isIncome ? 'text-[#16a34a]' : 'text-[#dc2626]';
  const bgClass = isIncome ? 'bg-[#16a34a]' : 'bg-[#dc2626]';
  const icon = isIncome ? 'savings' : 'shopping_cart';
  const title = isIncome ? 'Últimas Receitas' : 'Últimas Despesas';

  const getCategoryIcon = (category: string) => {
    const map: Record<string, string> = {
      'Moradia': 'home',
      'Alimentação': 'restaurant',
      'Transporte': 'directions_car',
      'Lazer': 'movie',
      'Saúde': 'medical_services',
      'Receita/Salário': 'work',
      'Educação': 'school',
      'Compras': 'shopping_bag',
      'Outros': 'more_horiz'
    };
    return map[category] || 'receipt';
  };

  return (
    <div className="flex flex-col rounded-3xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500">{title}</h3>
        <button onClick={onViewAll} className="text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
        </button>
      </div>

      {/* Total Big Display */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isIncome ? 'bg-green-100' : 'bg-red-100'}`}>
          <span className={`material-symbols-outlined text-2xl ${colorClass}`}>
            {icon}
          </span>
        </div>
        <span className={`text-2xl font-bold ${colorClass}`}>
          {formatCurrency(total)}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 space-y-3 mb-4 overflow-y-auto max-h-[250px] scrollbar-thin scrollbar-thumb-gray-200">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs text-center border border-dashed border-gray-100 rounded-xl bg-gray-50/50">
            <span className="material-symbols-outlined mb-2 text-2xl text-gray-300">block</span>
            <p className="mb-2">Nenhum lançamento</p>
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={onAdd}
                className="text-primary hover:bg-white h-8"
            >
                + Criar agora
            </Button>
          </div>
        ) : (
          transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/50 p-3 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ${colorClass}`}>
                  <span className="material-symbols-outlined text-base">
                    {getCategoryIcon(t.category)}
                  </span>
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-sm font-semibold text-slate-700 w-24 sm:w-auto">
                    {t.description}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(t.date).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'})}
                  </span>
                </div>
              </div>
              <span className={`text-sm font-bold whitespace-nowrap ${colorClass}`}>
                 {formatCurrency(t.amount)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Button */}
      {transactions.length > 0 && (
        <button 
            onClick={onViewAll}
            className={`w-full rounded-xl py-2.5 text-sm font-bold text-white shadow-md transition-transform active:scale-95 ${bgClass} hover:opacity-90`}
        >
            Ver todas
        </button>
      )}
    </div>
  );
};