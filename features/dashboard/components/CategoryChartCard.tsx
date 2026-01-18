
import React, { useState, useMemo } from 'react';
import { Card } from '../../../components/ui/Card';
import { formatCurrency } from '../../../utils/formatters';
import { CategoryData } from '../../../types';

interface CategoryChartCardProps {
  title: string;
  type: 'income' | 'expense';
  categories: CategoryData[];
  total: number;
  onCategoryClick?: (category: CategoryData) => void;
}

export const CategoryChartCard: React.FC<CategoryChartCardProps> = ({ title, type, categories, total, onCategoryClick }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const isIncome = type === 'income';
  const textColor = isIncome ? 'text-success' : 'text-danger';
  
  const size = 160;
  const strokeWidth = 20;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setHoveredId(id);
    setTooltipPos({ x: clientX, y: clientY });
  };

  const hoveredCat = useMemo(() => 
    categories.find(c => c.id === hoveredId), 
  [categories, hoveredId]);

  return (
    <Card className="!p-6 border-none shadow-sm relative group overflow-hidden">
      <h3 className={`mb-6 text-lg font-black tracking-tight truncate ${type === 'expense' ? 'text-rose-500' : 'text-slate-700'}`}>
        {title}
      </h3>
      
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="relative flex-shrink-0">
          <svg 
            width={size} height={size} 
            className="transform -rotate-90 overflow-visible"
          >
            <circle cx={center} cy={center} r={radius} fill="none" stroke="#f8fafc" strokeWidth={strokeWidth} />
            
            {total > 0 && categories.map((cat) => {
              const percentage = Math.max(0, cat.amount / total);
              const strokeDasharray = `${percentage * circumference} ${circumference}`;
              const strokeDashoffset = -currentOffset;
              currentOffset += percentage * circumference;
              
              if (percentage < 0.005) return null;
              const isHovered = hoveredId === cat.id;

              return (
                <circle
                  key={cat.id}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={cat.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  onMouseEnter={(e) => handleInteraction(e, cat.id)}
                  onMouseMove={(e) => handleInteraction(e, cat.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onCategoryClick?.(cat)}
                  className="transition-all duration-300 ease-out cursor-pointer origin-center"
                  style={{ 
                    opacity: hoveredId ? (isHovered ? 1 : 0.3) : 1,
                    filter: isHovered ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' : 'none'
                  }}
                />
              );
            })}
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className={`text-lg sm:text-xl font-black leading-none tracking-tighter ${textColor}`}>
              {formatCurrency(total).replace(',00', '')}
            </span>
            <span className="mt-1 text-[9px] font-black text-slate-300 uppercase tracking-widest">Total</span>
          </div>
        </div>

        <div className="flex-1 w-full min-w-0 space-y-3">
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-slate-300">
               <span className="material-symbols-outlined text-4xl opacity-20 mb-2">pie_chart</span>
               <p className="text-[10px] font-black uppercase tracking-widest">Sem lançamentos</p>
            </div>
          ) : (
            categories.slice(0, 5).map((cat) => {
              const percentage = total > 0 ? (cat.amount / total) * 100 : 0;
              const isHovered = hoveredId === cat.id;
              
              return (
                <div 
                  key={cat.id} 
                  onClick={() => onCategoryClick?.(cat)}
                  className={`flex items-center gap-3 transition-all duration-300 cursor-pointer p-1 rounded-xl hover:bg-slate-50 ${hoveredId && !isHovered ? 'opacity-30 blur-[0.5px]' : 'opacity-100'}`}
                  onMouseEnter={() => setHoveredId(cat.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div 
                    className="flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:rotate-6"
                    style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                  >
                    <span className="material-symbols-outlined text-base sm:text-lg">{cat.icon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-bold text-slate-700 truncate mr-2">{cat.name}</span>
                      <div className="text-right flex-shrink-0">
                        <span className="text-[10px] sm:text-[11px] font-black text-slate-800 block leading-tight">{formatCurrency(cat.amount)}</span>
                        <span className="text-[8px] sm:text-[9px] font-black text-slate-300">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-50 overflow-hidden border border-slate-100/50">
                      <div className="h-full rounded-full transition-all duration-700 shadow-sm" style={{ width: `${percentage}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {hoveredId && hoveredCat && (
        <div className="fixed z-[100] pointer-events-none transform -translate-x-1/2 -translate-y-[125%] animate-in fade-in zoom-in-95 duration-200" style={{ left: tooltipPos.x, top: tooltipPos.y }}>
          <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${hoveredCat.color}20`, color: hoveredCat.color }}>
               <span className="material-symbols-outlined text-xl">{hoveredCat.icon}</span>
             </div>
             <div>
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none mb-1 max-w-[100px] truncate">{hoveredCat.name}</p>
                <div className="flex items-baseline gap-2">
                   <span className="text-sm font-black text-white">{formatCurrency(hoveredCat.amount)}</span>
                   <span className="text-[10px] font-black text-white/60">{((hoveredCat.amount / total) * 100).toFixed(1)}%</span>
                </div>
             </div>
          </div>
        </div>
      )}
    </Card>
  );
};
