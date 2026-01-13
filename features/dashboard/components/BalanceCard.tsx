import React from 'react';
import { Card } from '../../../components/ui/Card';
import { formatCurrency } from '../../../utils/formatters';
import { MonthSelector } from './MonthSelector';

interface BalanceCardProps {
  balance: number;
  previousBalance: number;
  currentDate: Date;
  onMonthChange: (date: Date) => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ 
  balance, 
  previousBalance, 
  currentDate, 
  onMonthChange 
}) => {
  const diff = balance - previousBalance;
  const percentage = previousBalance !== 0 ? (diff / previousBalance) * 100 : 0;
  const isPositive = diff >= 0;

  return (
    <Card className="py-8 shadow-sm">
      <div className="flex flex-col items-center justify-center text-center">
        <MonthSelector currentDate={currentDate} onMonthChange={onMonthChange} className="mb-6" />
        
        <span className="text-sm font-medium text-secondary">Saldo total</span>
        
        <div className="my-2 text-4xl font-bold tracking-tight text-slate-800">
          {formatCurrency(balance)}
        </div>
        
        <div className={`mt-2 flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium transition-colors ${
          isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          <span className="material-symbols-outlined mr-1 text-sm">
              {isPositive ? 'trending_up' : 'trending_down'}
            </span>
          {Math.abs(percentage).toFixed(1)}% vs mês anterior
        </div>
      </div>
    </Card>
  );
};