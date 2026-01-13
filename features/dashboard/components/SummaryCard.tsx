import React from 'react';
import { Card } from '../../../components/ui/Card';
import { formatCurrency } from '../../../utils/formatters';

interface SummaryCardProps {
  income: number;
  expenses: number;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ income, expenses }) => {
  const balance = income - expenses;
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

  return (
    <Card title="Resumo Mensal" icon="analytics">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm text-secondary">
            <span className="material-symbols-outlined text-success text-lg">arrow_downward</span>
            Entradas
          </div>
          <p className="text-lg font-semibold text-slate-800">{formatCurrency(income)}</p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm text-secondary">
            <span className="material-symbols-outlined text-danger text-lg">arrow_upward</span>
            Saídas
          </div>
          <p className="text-lg font-semibold text-slate-800">{formatCurrency(expenses)}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-secondary">Balanço</span>
          <span className={`font-semibold ${balance >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatCurrency(balance)}
          </span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
           <div 
             className="h-full bg-success transition-all duration-500"
             style={{ width: `${Math.max(0, Math.min(100, savingsRate))}%` }}
           />
        </div>
        <div className="mt-1 text-xs text-secondary text-right">
          Taxa de poupança: {savingsRate.toFixed(1)}%
        </div>
      </div>
    </Card>
  );
};