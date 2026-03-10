
import React from 'react';
import { Card } from '../../../components/ui/Card';
import { formatCurrency } from '../../../utils/formatters';

interface BalanceCardProps {
  balance: number;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ 
  balance
}) => {
  const isPositive = balance >= 0;

  return (
    <Card className="py-6 shadow-sm bg-white border border-slate-100">
      <div className="flex flex-col items-center justify-center text-center">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Saldo Atual em Contas</span>
        
        <div className={`text-4xl font-black tracking-tighter ${isPositive ? 'text-slate-800' : 'text-danger'}`}>
          {formatCurrency(balance)}
        </div>
      </div>
    </Card>
  );
};
