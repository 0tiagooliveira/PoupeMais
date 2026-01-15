
import React from 'react';
import { Card } from '../../../components/ui/Card';
import { formatCurrency } from '../../../utils/formatters';
import { CategoryData } from '../../../types';

interface CategoryChartCardProps {
  title: string;
  type: 'income' | 'expense';
  categories: CategoryData[];
  total: number;
}

export const CategoryChartCard: React.FC<CategoryChartCardProps> = ({ title, type, categories, total }) => {
  const isIncome = type === 'income';
  const textColor = isIncome ? 'text-success' : 'text-danger';
  const titleColor = isIncome ? 'text-slate-700' : 'text-danger'; // Título colorido se for despesa para destaque
  
  const size = 160;
  const strokeWidth = 18;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <Card className="!p-6 border-none shadow-sm">
      <h3 className={`mb-6 text-lg font-bold ${type === 'expense' ? 'text-danger' : 'text-slate-700'}`}>{title}</h3>
      
      <div className="flex flex-col items-center gap-8 md:flex-row">
        <div className="relative flex-shrink-0">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Círculo de fundo para quando não houver dados */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />
            
            {/* Segmentos do gráfico */}
            {total > 0 && categories.map((cat) => {
              const percentage = Math.max(0, cat.amount / total);
              const strokeDasharray = `${percentage * circumference} ${circumference}`;
              const strokeDashoffset = -currentOffset;
              
              currentOffset += percentage * circumference;
              
              // Evita renderizar segmentos minúsculos que causam artefatos
              if (percentage < 0.005) return null;

              return (
                <circle
                  key={cat.id}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={cat.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="butt"
                  className="transition-all duration-1000 ease-out"
                />
              );
            })}
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-xl font-bold leading-none ${textColor}`}>
              {formatCurrency(total)}
            </span>
            <span className="mt-1 text-[10px] font-bold text-slate-400">Total</span>
          </div>
        </div>

        <div className="flex-1 space-y-5 w-full">
          {categories.length === 0 ? (
            <p className="text-center text-sm text-slate-400 italic py-4">Sem dados para exibir</p>
          ) : (
            categories.slice(0, 5).map((cat) => {
              const percentage = total > 0 ? (cat.amount / total) * 100 : 0;
              return (
                <div key={cat.id} className="flex items-center gap-3">
                  <div 
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {cat.icon}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-sm font-bold text-slate-700 truncate">{cat.name}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-800 block leading-tight">
                          {formatCurrency(cat.amount)}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">{percentage.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${percentage}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Card>
  );
};
