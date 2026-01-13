import React from 'react';
import { Card } from '../../../components/ui/Card';
import { formatCurrency } from '../../../utils/formatters';

interface CategorySpend {
  id: string;
  name: string;
  amount: number;
  color: string;
  icon: string;
}

interface CategoryListProps {
  categories: CategorySpend[];
  totalExpense: number;
}

export const CategoryList: React.FC<CategoryListProps> = ({ categories, totalExpense }) => {
  return (
    <Card title="Gastos por Categoria" icon="pie_chart">
      <div className="space-y-4">
        {categories.map((cat) => {
          const percentage = totalExpense > 0 ? (cat.amount / totalExpense) * 100 : 0;
          
          return (
            <div key={cat.id}>
              <div className="mb-1 flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-secondary">{cat.icon}</span>
                  <span className="font-medium text-slate-700">{cat.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-slate-800">{formatCurrency(cat.amount)}</span>
                  <span className="ml-2 text-xs text-secondary">({percentage.toFixed(0)}%)</span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${percentage}%`,
                    backgroundColor: cat.color 
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};