
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency } from '../../utils/formatters';
import { getIconByCategoryName } from '../../utils/categoryIcons';
import { MonthSelector } from '../dashboard/components/MonthSelector';
import { Transaction, CategoryData, TransactionType } from '../../types';
import { useNavigate } from 'react-router-dom';

// --- GRÃFICO ANUAL COM INTERATIVIDADE E FILTROS ---
interface AnnualMixedChartProps {
  data: any[];
  selectedMonthIndex: number;
  onMonthClick: (index: number) => void;
}

const AnnualMixedChart: React.FC<AnnualMixedChartProps> = ({ data, selectedMonthIndex, onMonthClick }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    income: true,
    expense: true,
    flow: true
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ConfiguraÃ§Ãµes do SVG (ViewBox Fixo, mas renderizado responsivamente via CSS)
  const viewBoxWidth = 1000;
  const viewBoxHeight = 350;
  const paddingX = 50; 
  const paddingY = 30;
  const topPadding = 40;

  const chartHeight = viewBoxHeight - paddingY - topPadding;
  const chartWidth = viewBoxWidth - paddingX * 2;

  // 1. Calcular Escalas dinÃ¢micas baseadas nos filtros ativos
  const activeValues: number[] = [0]; // Inicializa com 0 para evitar erros se tudo estiver desmarcado
  if (filters.income) activeValues.push(...data.map(d => d.income));
  if (filters.expense) activeValues.push(...data.map(d => d.expense));
  if (filters.flow) activeValues.push(...data.map(d => d.income - d.expense));
  
  // Definir limites (Max e Min) para o eixo Y
  let maxVal = Math.max(...activeValues);
  let minVal = Math.min(...activeValues); 

  // Ajustes de margem para o grÃ¡fico nÃ£o tocar nas bordas
  if (maxVal === 0 && minVal === 0) maxVal = 1000; // Valor padrÃ£o se vazio
  maxVal = maxVal * 1.1; 
  if (minVal < 0) minVal = minVal * 1.2;

  const range = maxVal - minVal;
  
  // FunÃ§Ã£o Y: Valor -> Pixel
  const getY = (val: number) => {
    if (range === 0) return topPadding + chartHeight;
    const percentage = (val - minVal) / range; 
    return topPadding + (chartHeight * (1 - percentage));
  };

  const zeroY = getY(0);

  // FunÃ§Ã£o X: Ãndice -> Pixel
  const stepX = chartWidth / (data.length - 1 || 1);
  const getX = (i: number) => paddingX + (i * stepX);

  // Largura das barras
  const barWidth = 16;

  // 2. Grid Lines
  const gridLines = [];
  const gridCount = 5;
  for (let i = 0; i <= gridCount; i++) {
    const val = minVal + (range * (i / gridCount));
    gridLines.push(val);
  }

  // 3. Caminho da Linha de Fluxo
  let pathD = "";
  if (filters.flow && data.length > 0) {
    const flowPoints = data.map((d, i) => ({ 
        x: getX(i), 
        y: getY(d.income - d.expense) 
    }));
    pathD = `M ${flowPoints[0].x} ${flowPoints[0].y}`;
    for (let i = 0; i < flowPoints.length - 1; i++) {
        const p0 = flowPoints[i];
        const p1 = flowPoints[i + 1];
        const cp1x = p0.x + (p1.x - p0.x) / 2;
        pathD += ` C ${cp1x} ${p0.y}, ${cp1x} ${p1.y}, ${p1.x} ${p1.y}`;
    }
  }

  // Dados Ativos (Hover)
  const activeIndex = hoveredIndex;
  const activeData = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div ref={containerRef} className="w-full bg-white rounded-[32px] p-4 sm:p-6 border border-slate-100 shadow-sm relative group select-none">
      {/* CabeÃ§alho / Legenda Interativa */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
         <h3 className="text-base font-black text-slate-800 md:text-lg">Panorama Anual</h3>
         
         {/* BotÃµes de Filtro */}
         <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl overflow-x-auto max-w-full">
            <button 
                onClick={() => setFilters({ income: true, expense: true, flow: true })}
                className="px-3.5 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap bg-white shadow-sm text-slate-800 border border-slate-100 hover:bg-slate-50 md:text-sm"
            >
              Tudo
            </button>
            <button 
                onClick={() => toggleFilter('income')}
                className={`px-3.5 py-2 flex items-center gap-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap md:text-sm ${filters.income ? 'bg-white shadow-sm text-slate-700 border border-slate-100' : 'text-slate-400 opacity-60 hover:opacity-100'}`}
            >
              <span className={`w-2 h-2 rounded-full ${filters.income ? 'bg-[#10B981]' : 'bg-slate-300'}`}></span> Receitas
            </button>
            <button 
                onClick={() => toggleFilter('expense')}
                className={`px-3.5 py-2 flex items-center gap-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap md:text-sm ${filters.expense ? 'bg-white shadow-sm text-slate-700 border border-slate-100' : 'text-slate-400 opacity-60 hover:opacity-100'}`}
            >
              <span className={`w-2 h-2 rounded-full ${filters.expense ? 'bg-[#F43F5E]' : 'bg-slate-300'}`}></span> Despesas
            </button>
            <button 
                onClick={() => toggleFilter('flow')}
                className={`px-3.5 py-2 flex items-center gap-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap md:text-sm ${filters.flow ? 'bg-white shadow-sm text-slate-700 border border-slate-100' : 'text-slate-400 opacity-60 hover:opacity-100'}`}
            >
              <span className={`w-2 h-2 rounded-full ${filters.flow ? 'bg-primary' : 'bg-slate-300'}`}></span> Fluxo
            </button>
         </div>
      </div>

      {/* Container SVG Responsivo */}
      <div className="w-full relative">
        <svg 
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} 
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-auto overflow-visible touch-pan-x"
        >
             {/* GRID & LABELS */}
             <g className="grid-lines">
               {gridLines.map((val, i) => {
                 const y = getY(val);
                 return (
                   <g key={`grid-${i}`}>
                     <line 
                        x1={paddingX} y1={y} x2={viewBoxWidth - 20} y2={y} 
                        stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" 
                     />
                     <text 
                        x={paddingX - 10} y={y + 4} 
                        textAnchor="end" 
                        className="text-[10px] fill-slate-400 font-medium"
                     >
                        {formatCurrency(val).replace(',00', '')}
                     </text>
                   </g>
                 );
               })}
             </g>

             {/* Linha Zero */}
             <line x1={paddingX} y1={zeroY} x2={viewBoxWidth - 20} y2={zeroY} stroke="#94a3b8" strokeWidth="1" />

             {/* BARRAS */}
             {data.map((d, i) => {
               const x = getX(i);
               const yIncome = getY(d.income);
               const yExpense = getY(d.expense);
               
               const isHovered = hoveredIndex === i;
               const isSelected = selectedMonthIndex === i;

               const incomeColor = isHovered || isSelected ? '#10B981' : '#A7F3D0';
               const expenseColor = isHovered || isSelected ? '#F43F5E' : '#FECACA';
               // Aumentamos a opacidade base para melhorar visibilidade no mobile
               const opacity = (hoveredIndex !== null && !isHovered) ? 0.6 : 1;

               return (
                 <g key={`bars-${i}`} style={{ opacity, transition: 'opacity 0.2s' }}>
                    {filters.expense && (
                        <rect 
                        x={x - barWidth - 2} 
                        y={yExpense} 
                        width={barWidth} 
                        height={Math.max(0, zeroY - yExpense)} 
                        fill={expenseColor}
                        rx="3" ry="3"
                        className="transition-colors duration-200"
                        />
                    )}
                    
                    {filters.income && (
                        <rect 
                        x={x + 2} 
                        y={yIncome} 
                        width={barWidth} 
                        height={Math.max(0, zeroY - yIncome)} 
                        fill={incomeColor}
                        rx="3" ry="3"
                        className="transition-colors duration-200"
                        />
                    )}
                 </g>
               );
             })}

             {/* LINHA DE FLUXO */}
             {filters.flow && (
                 <path 
                    d={pathD} 
                    fill="none" 
                    stroke="#1e293b" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="pointer-events-none drop-shadow-sm"
                 />
             )}

             {/* PONTOS & LABELS X */}
             {data.map((d, i) => {
                const x = getX(i);
                const yFlow = getY(d.income - d.expense);
                const isHovered = hoveredIndex === i;
                const isSelected = selectedMonthIndex === i;

                return (
                  <g key={`points-${i}`}>
                    {/* Linha Vertical de Cursor (Hover) */}
                    {isHovered && (
                      <line 
                        x1={x} y1={topPadding} x2={x} y2={viewBoxHeight - paddingY} 
                        stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3"
                        className="pointer-events-none"
                      />
                    )}

                    {/* Pontos da Linha de Fluxo */}
                    {filters.flow && (
                        <circle 
                        cx={x} cy={yFlow} 
                        r={isHovered ? 5 : 3} 
                        fill="#1e293b" 
                        stroke="white" strokeWidth="2"
                        className="transition-all duration-200 pointer-events-none"
                        />
                    )}
                    
                    {/* Label Eixo X */}
                    <text 
                      x={x} y={viewBoxHeight - 5} 
                      textAnchor="middle" 
                      className={`text-[12px] font-bold transition-colors duration-200 ${isHovered || isSelected ? 'fill-slate-800' : 'fill-slate-400'}`}
                    >
                      {d.label}
                    </text>
                  </g>
                );
             })}

             {/* HIT AREAS (RetÃ¢ngulos InvisÃ­veis Largos para InteraÃ§Ã£o) */}
             {data.map((_, i) => {
               const x = getX(i);
               const colWidth = stepX;
               return (
                 <rect 
                   key={`hit-${i}`}
                   x={x - colWidth / 2} 
                   y={0} 
                   width={colWidth} 
                   height={viewBoxHeight} 
                   fill="transparent"
                   className="cursor-pointer"
                   onMouseEnter={() => setHoveredIndex(i)}
                   onMouseLeave={() => setHoveredIndex(null)}
                   onClick={() => {
                     setHoveredIndex(i);
                     onMonthClick(i);
                   }}
                 />
               );
             })}
          </svg>

          {/* TOOLTIP FLUTUANTE HTML (Posicionado via style relativo ao container do grÃ¡fico) */}
          {activeData && activeIndex !== null && (
             <div 
               className="absolute z-20 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
               style={{ 
                 // CÃ¡lculo de porcentagem para posicionar o tooltip responsivamente
                 left: `${((getX(activeIndex)) / viewBoxWidth) * 100}%`,
                 top: 0,
                 transform: 'translateX(-50%) translateY(10px)'
               }}
             >
                 <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 min-w-[180px]">
                   <p className="text-sm font-bold text-slate-800 mb-2 border-b border-slate-50 pb-1.5 text-center md:text-base">
                     {activeData.label}
                   </p>
                   
                   <div className="space-y-1.5">
                      {filters.income && (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div>
                                <span className="text-xs font-bold text-slate-500 md:text-sm">Rec.</span>
                            </div>
                              <span className="text-sm font-bold text-slate-700 md:text-base">{formatCurrency(activeData.income)}</span>
                          </div>
                      )}

                      {filters.expense && (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]"></div>
                                <span className="text-xs font-bold text-slate-500 md:text-sm">Desp.</span>
                            </div>
                              <span className="text-sm font-bold text-slate-700 md:text-base">{formatCurrency(activeData.expense)}</span>
                          </div>
                      )}

                      {filters.flow && (
                          <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-slate-50 mt-1">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                                <span className="text-xs font-bold text-slate-500 md:text-sm">Fluxo</span>
                            </div>
                              <span className={`text-sm font-black md:text-base ${(activeData.income - activeData.expense) >= 0 ? 'text-[#059669]' : 'text-rose-500'}`}>
                                {formatCurrency(activeData.income - activeData.expense)}
                            </span>
                          </div>
                      )}
                   </div>
                </div>
                {/* Seta do Tooltip */}
                <div className="w-2.5 h-2.5 bg-white border-r border-b border-slate-100 transform rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1 shadow-sm"></div>
             </div>
          )}
      </div>
    </div>
  );
};

const InsightCard: React.FC<{ text: string; tone: 'success' | 'warning' | 'neutral'; label: string }> = ({ text, tone, label }) => {
  const colors = {
    success: 'border-emerald-100 bg-emerald-50 text-emerald-900',
    warning: 'border-rose-100 bg-rose-50 text-rose-900',
    neutral: 'border-slate-200 bg-white text-slate-800',
  };

  return (
    <div className={`rounded-2xl border p-4 ${colors[tone]} animate-in fade-in slide-in-from-bottom-2`}>
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 md:text-xs">{label}</p>
      <p className="text-base font-semibold leading-relaxed md:text-[17px]">{text}</p>
    </div>
  );
};

const MonthlyBreakdownCard: React.FC<{
  title: string;
  type: 'income' | 'expense';
  categories: CategoryData[];
  total: number;
  onCategoryClick: (cat: CategoryData) => void;
}> = ({ title, type, categories, total, onCategoryClick }) => {
  const isIncome = type === 'income';
  const topCategories = categories.slice(0, 5);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h3 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{title}</h3>
        <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400 md:text-[13px]">{categories.length} categorias no periodo</p>
      </div>

      <div className="grid flex-1 gap-6 px-6 py-6 xl:grid-cols-[minmax(260px,290px)_minmax(0,1fr)] xl:items-start">
        <div className={`flex min-h-[188px] flex-col justify-between overflow-hidden rounded-3xl border p-5 ${isIncome ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 md:text-xs">Total do periodo</p>
          <p className={`mt-3 overflow-hidden text-[clamp(2rem,3.2vw,3.35rem)] font-black leading-none tracking-tight ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(total)}</p>
          <p className="mt-2 text-sm font-semibold text-slate-500 md:text-[15px]">{isIncome ? 'Receitas consolidadas' : 'Gastos consolidados'}</p>
        </div>

        <div className="space-y-3">
          {topCategories.length === 0 ? (
            <div className="flex min-h-[188px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 py-10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Sem lancamentos</p>
            </div>
          ) : (
            topCategories.map((cat) => {
              const pct = total > 0 ? (cat.amount / total) * 100 : 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => onCategoryClick(cat)}
                  className="w-full rounded-2xl border border-transparent bg-white p-4 text-left transition-all hover:border-slate-200 hover:bg-slate-50 focus:border-slate-300 focus:bg-slate-50"
                >
                  <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                        <span className="material-symbols-outlined text-[22px]">{cat.icon ?? 'payments'}</span>
                      </div>
                      <span className="truncate text-lg font-black text-slate-800 md:text-xl">{cat.name}</span>
                    </div>
                    <span className="text-right text-lg font-black text-slate-900 md:text-xl">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: cat.color }} />
                  </div>
                  <p className="mt-2 text-right text-xs font-black text-slate-400 md:text-[13px]">{pct.toFixed(1)}%</p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

const MiniAreaChart: React.FC<{ values: number[]; labels: string[]; color: string }> = ({ values, labels, color }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!values.length) {
    return <div className="flex h-44 items-center justify-center rounded-2xl bg-slate-50 text-xs font-bold text-slate-400">Sem dados</div>;
  }

  const width = 920;
  const height = 360;
  const pad = 24;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);
  const activeIndex = hoveredIndex ?? values.length - 1;

  const points = values.map((v, i) => `${pad + i * step},${y(v)}`).join(' ');
  const area = `${pad},${height - pad} ${points} ${pad + (values.length - 1) * step},${height - pad}`;

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full rounded-2xl bg-slate-50 p-2 md:h-72">
        {[0.25, 0.5, 0.75].map((marker) => {
          const markerY = pad + (height - pad * 2) * marker;
          return <line key={marker} x1={pad} y1={markerY} x2={width - pad} y2={markerY} stroke="#cbd5e1" strokeDasharray="4 6" strokeWidth="1" />;
        })}
        <polygon points={area} fill={color} opacity="0.15" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => (
          <g key={`p-${i}`}>
            <rect
              x={Math.max(0, pad + i * step - Math.max(step, 28) / 2)}
              y={0}
              width={Math.max(step, 28)}
              height={height}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => setHoveredIndex(i)}
            />
            {activeIndex === i && <line x1={pad + i * step} y1={pad} x2={pad + i * step} y2={height - pad} stroke={color} strokeDasharray="4 5" strokeWidth="1.5" opacity="0.45" />}
            <circle
              cx={pad + i * step}
              cy={y(v)}
              r={activeIndex === i ? 6 : 3}
              fill={color}
              stroke="#ffffff"
              strokeWidth="2"
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => setHoveredIndex(i)}
            />
          </g>
        ))}
      </svg>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 md:text-base">
        <span className="truncate">{labels[activeIndex] ?? `Ponto ${activeIndex + 1}`}</span>
        <span className={`${values[activeIndex] >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(values[activeIndex])}</span>
      </div>
      <p className="text-sm font-bold text-slate-400">Passe o mouse ou toque nos pontos para ler cada valor.</p>
    </div>
  );
};

const MiniBarChart: React.FC<{ values: number[]; labels: string[]; color: string }> = ({ values, labels, color }) => {
  const [activeIndex, setActiveIndex] = useState<number>(Math.max(0, values.length - 1));

  if (!values.length) {
    return <div className="flex h-44 items-center justify-center rounded-2xl bg-slate-50 text-xs font-bold text-slate-400">Sem dados</div>;
  }

  const max = Math.max(...values, 1);
  return (
    <div className="space-y-3">
      <div className="flex h-64 items-end gap-2 rounded-2xl bg-slate-50 p-3 md:h-72">
        {values.map((v, i) => {
          const h = Math.max(8, (v / max) * 100);
          return (
            <button
              key={`bar-${i}`}
              type="button"
              onMouseEnter={() => setActiveIndex(i)}
              onFocus={() => setActiveIndex(i)}
              onClick={() => setActiveIndex(i)}
              className="group relative flex-1 rounded-t-md transition-all"
              style={{ height: `${h}%`, backgroundColor: color, opacity: activeIndex === i ? 1 : 0.55 }}
              title={`${labels[i] ?? `Item ${i + 1}`}: ${formatCurrency(v)}`}
            >
              {activeIndex === i && <span className="absolute inset-x-0 -top-2 mx-auto h-2 w-2 rounded-full bg-slate-900" />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 md:text-base">
        <span className="truncate">{labels[activeIndex] ?? `Item ${activeIndex + 1}`}</span>
        <span>{formatCurrency(values[activeIndex] ?? 0)}</span>
      </div>
      <p className="text-sm font-bold text-slate-400">Passe o mouse ou toque nas barras para destacar a semana ou o dia.</p>
    </div>
  );
};

const NetBarsChart: React.FC<{ values: number[]; labels: string[] }> = ({ values, labels }) => {
  const [activeIndex, setActiveIndex] = useState<number>(Math.max(0, values.length - 1));

  if (!values.length) {
    return <div className="flex h-44 items-center justify-center rounded-2xl bg-slate-50 text-xs font-bold text-slate-400">Sem dados</div>;
  }

  const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 1);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="relative flex h-64 items-stretch gap-2 overflow-hidden md:h-72">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-300" />
          {values.map((value, index) => {
            const height = `${Math.max(8, (Math.abs(value) / maxAbs) * 46)}%`;
            const positive = value >= 0;
            const isActive = activeIndex === index;
            return (
              <button
                key={`${labels[index]}-${index}`}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(index)}
                className={`relative flex flex-1 justify-center rounded-xl transition-all ${positive ? 'items-end' : 'items-start'} ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-90'}`}
                title={`${labels[index]}: ${formatCurrency(value)}`}
              >
                <span
                  className={`w-full rounded-xl ${positive ? 'rounded-b-md bg-emerald-500' : 'rounded-t-md bg-rose-500'} shadow-sm transition-transform ${isActive ? 'scale-[1.02]' : ''}`}
                  style={{ height }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 md:text-base">
        <span className="truncate">{labels[activeIndex] ?? `Dia ${activeIndex + 1}`}</span>
        <span className={values[activeIndex] >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(values[activeIndex] ?? 0)}</span>
      </div>
      <div className="flex flex-wrap gap-2 text-sm font-bold text-slate-500">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Dia positivo</span>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Dia pressionado</span>
      </div>
    </div>
  );
};

const ProgressSegments: React.FC<{ segments: { label: string; value: number; color: string }[] }> = ({ segments }) => {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return <div className="flex h-10 items-center justify-center rounded-xl bg-slate-50 text-sm font-bold text-slate-400 md:text-base">Sem dados</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {segments.map((s) => (
          <span key={`legend-${s.label}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 md:text-sm">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}: {formatCurrency(s.value)}
          </span>
        ))}
      </div>
    </div>
  );
};

const AnalysisCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    {subtitle && <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 md:text-xs">{subtitle}</p>}
    <h4 className={`${subtitle ? 'mt-1' : ''} mb-4 text-xl font-black text-slate-800 md:text-2xl`}>{title}</h4>
    {children}
  </article>
);

export const ChartsPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentYearDate, setCurrentYearDate] = useState(new Date());
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedAnnualMonthIndex, setSelectedAnnualMonthIndex] = useState(new Date().getMonth());
  const [analysisRange, setAnalysisRange] = useState<'30d' | '90d' | '180d' | '365d' | 'custom'>('90d');
  const [customStart, setCustomStart] = useState(() => {
    const base = new Date();
    base.setDate(base.getDate() - 89);
    return base.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Dados Anuais (apenas para o grÃ¡fico do topo)
  const { transactions: annualTransactions, loading: loadingTransactions } = useTransactions(currentYearDate, 'year');
  
  // LÃ“GICA DE FILTRAGEM DE ANÃLISE
  const shouldIncludeInAnalysis = (t: Transaction) => {
    if (t.isIgnored) return false;

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const cleanDesc = normalize(t.description);
    const cleanCat = normalize(t.category);

    const isCreditCardPayment = 
        cleanCat.includes('pagamento de cartao') || 
        cleanCat.includes('fatura') ||
        cleanDesc.includes('pagamento de fatura') ||
        (cleanDesc.includes('fatura') && (cleanDesc.includes('cartao') || cleanDesc.includes('card') || cleanDesc.includes('nubank') || cleanDesc.includes('itau')));

    if (isCreditCardPayment) return false;

    return true;
  };
  
  // PreparaÃ§Ã£o de dados Anuais (Filtrados)
  const annualData = useMemo(() => {
    const monthsData = Array(12).fill(0).map(() => ({ income: 0, expense: 0 }));
    annualTransactions.forEach(t => {
      if (!shouldIncludeInAnalysis(t)) return;

      const tDate = new Date(t.date);
      const m = tDate.getMonth();
      if (t.type === 'income') monthsData[m].income += t.amount;
      else monthsData[m].expense += t.amount;
    });
    return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => ({
      label: m,
      income: monthsData[i].income,
      expense: monthsData[i].expense
    }));
  }, [annualTransactions]);

  const annualTotals = useMemo(() => {
    return annualTransactions.reduce(
      (acc, t) => {
        if (!shouldIncludeInAnalysis(t)) return acc;
        if (t.type === 'income') acc.income += t.amount;
        else acc.expense += t.amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );
  }, [annualTransactions]);

  const annualInsight = useMemo(() => {
    const result = annualTotals.income - annualTotals.expense;
    if (annualTotals.income === 0 && annualTotals.expense === 0) {
      return `Sem movimentacoes relevantes em ${currentYearDate.getFullYear()}.`;
    }
    if (result > 0) {
      return `Ano positivo: saldo de ${formatCurrency(result)} e espaco para acelerar metas.`;
    }
    if (result < 0) {
      return `Ano pressionado: deficit de ${formatCurrency(Math.abs(result))}. Priorize ajuste de gastos variaveis.`;
    }
    return `Ano equilibrado em ${currentYearDate.getFullYear()}. Foque agora em crescimento de receita.`;
  }, [annualTotals, currentYearDate]);


  // Handler para clique no grÃ¡fico anual
  const handleMonthClick = (monthIndex: number) => {
    setSelectedAnnualMonthIndex(monthIndex);
  };

  const handleCategoryClick = (category: CategoryData, type: TransactionType) => {
    navigate('/transactions', { 
      state: { 
        category: category.name, 
        type: type 
      } 
    });
  };

  const selectedPeriod = useMemo(() => {
    const endDate = analysisRange === 'custom'
      ? new Date(`${customEnd}T23:59:59`)
      : new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const startDate = new Date(endDate);
    if (analysisRange === 'custom') {
      const parsed = new Date(`${customStart}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) return { start: parsed, end: endDate };
      startDate.setDate(startDate.getDate() - 89);
      return { start: startDate, end: endDate };
    }

    const daysByRange = {
      '30d': 30,
      '90d': 90,
      '180d': 180,
      '365d': 365,
      custom: 90,
    };

    startDate.setDate(startDate.getDate() - (daysByRange[analysisRange] - 1));
    startDate.setHours(0, 0, 0, 0);

    return { start: startDate, end: endDate };
  }, [analysisRange, customStart, customEnd, currentMonthDate]);

  const detailedAnchorDate = useMemo(() => {
    if (analysisRange === 'custom') {
      const parsed = new Date(`${customEnd}T23:59:59`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
  }, [analysisRange, customEnd, currentMonthDate]);

  const { transactions: detailedYearTransactions } = useTransactions(detailedAnchorDate, 'year');
  const { transactions: detailedPreviousYearTransactions } = useTransactions(new Date(detailedAnchorDate.getFullYear() - 1, 0, 1), 'year');

  const allTransactionsForPeriod = useMemo(() => {
    return [...detailedPreviousYearTransactions, ...detailedYearTransactions];
  }, [detailedPreviousYearTransactions, detailedYearTransactions]);

  const periodTransactions = useMemo(() => {
    return allTransactionsForPeriod.filter((t) => {
      if (!shouldIncludeInAnalysis(t)) return false;
      const date = new Date(t.date);
      return date >= selectedPeriod.start && date <= selectedPeriod.end;
    });
  }, [allTransactionsForPeriod, selectedPeriod]);

  const periodStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    const incCats = new Map<string, number>();
    const expCats = new Map<string, number>();

    periodTransactions.forEach(t => {
      if (t.type === 'income') {
         income += t.amount;
         incCats.set(t.category, (incCats.get(t.category) || 0) + t.amount);
      } else {
         expense += t.amount;
         expCats.set(t.category, (expCats.get(t.category) || 0) + t.amount);
      }
    });

    const formatCats = (map: Map<string, number>, type: 'income' | 'expense') => {
        const palette = type === 'income' 
            ? ['#21C25E', '#10B981', '#34D399', '#059669', '#6EE7B7'] 
            : ['#EF4444', '#B91C1C', '#F87171', '#991B1B', '#FCA5A5'];
        
        return Array.from(map.entries()).map(([name, amount], index) => ({
            id: name,
            name,
            amount,
            color: palette[index % palette.length],
            icon: getIconByCategoryName(name)
        })).sort((a, b) => b.amount - a.amount);
    };

    return {
        income,
        expense,
        result: income - expense,
        incomeCats: formatCats(incCats, 'income'),
        expenseCats: formatCats(expCats, 'expense')
    };
  }, [periodTransactions]);

  const localInsights = useMemo(() => {
    const topIncome = periodStats.incomeCats[0];
    const topExpense = periodStats.expenseCats[0];
    const savingsRate = periodStats.income > 0 ? (periodStats.result / periodStats.income) * 100 : 0;

    const income = periodStats.income > 0
      ? `Maior fonte de entrada: ${topIncome?.name ?? 'Diversas'} com ${formatCurrency(topIncome?.amount ?? periodStats.income)}.`
      : 'Sem entradas no periodo. Defina uma acao para gerar receita extra esta semana.';

    const expense = periodStats.expense > 0
      ? `Principal foco de saida: ${topExpense?.name ?? 'Outros'} em ${formatCurrency(topExpense?.amount ?? periodStats.expense)}.`
      : 'Sem saidas relevantes no periodo. Bom controle de gastos.';

    const general = periodStats.result >= 0
      ? `Saldo positivo de ${formatCurrency(periodStats.result)}. Taxa de poupanca aproximada: ${Math.max(0, savingsRate).toFixed(0)}%.`
      : `Saldo negativo de ${formatCurrency(Math.abs(periodStats.result))}. Ajuste as duas maiores categorias no proximo ciclo.`;

    return { income, expense, general };
  }, [periodStats]);

  const periodDates = useMemo(() => {
    const result: Date[] = [];
    const cursor = new Date(selectedPeriod.start);
    while (cursor <= selectedPeriod.end) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [selectedPeriod]);

  const advancedAnalysis = useMemo(() => {
    const expenseTx = periodTransactions.filter((t) => t.type === 'expense');
    const incomeTx = periodTransactions.filter((t) => t.type === 'income');

    const txCount = periodTransactions.length;
    const avgTicket = txCount > 0 ? (periodStats.income + periodStats.expense) / txCount : 0;

    const dayIndex = new Map<string, number>();
    periodDates.forEach((d, i) => dayIndex.set(d.toISOString().split('T')[0], i));

    const dailyNet = Array(periodDates.length).fill(0);
    const dailyExpense = Array(periodDates.length).fill(0);
    const cumulativeNet = Array(periodDates.length).fill(0);
    const dayLabels = periodDates.map((d) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d));

    const weekdayExpense = Array(7).fill(0);
    const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const weekBuckets = Array(Math.max(1, Math.ceil(periodDates.length / 7))).fill(0);
    const weekLabels = weekBuckets.map((_, i) => `Semana ${i + 1}`);

    periodTransactions.forEach((t) => {
      const d = new Date(t.date);
      const key = d.toISOString().split('T')[0];
      const day = dayIndex.get(key);
      if (day === undefined) return;
      const weekday = d.getDay();
      const week = Math.min(weekBuckets.length - 1, Math.floor(day / 7));

      const signed = t.type === 'income' ? t.amount : -t.amount;
      dailyNet[day] += signed;

      if (t.type === 'expense') {
        dailyExpense[day] += t.amount;
        weekdayExpense[weekday] += t.amount;
        weekBuckets[week] += t.amount;
      }
    });

    dailyNet.reduce((acc, v, i) => {
      const next = acc + v;
      cumulativeNet[i] = next;
      return next;
    }, 0);

    const last7Expense = dailyExpense.slice(-7).reduce((s, v) => s + v, 0);
    const prev7Expense = dailyExpense.slice(-14, -7).reduce((s, v) => s + v, 0);
    const last7Trend = prev7Expense > 0 ? ((last7Expense - prev7Expense) / prev7Expense) * 100 : 0;

    const top3Expense = periodStats.expenseCats.slice(0, 3);
    const top3ExpenseTotal = top3Expense.reduce((s, c) => s + c.amount, 0);
    const concentration = periodStats.expense > 0 ? (top3ExpenseTotal / periodStats.expense) * 100 : 0;

    const needsKeywords = ['aluguel', 'mercado', 'supermercado', 'transporte', 'combustivel', 'energia', 'agua', 'internet', 'farmacia', 'saude', 'educacao'];
    const wantsKeywords = ['lazer', 'restaurante', 'delivery', 'streaming', 'compras', 'viagem', 'shopping', 'bar'];

    let needs = 0;
    let wants = 0;
    let other = 0;
    const needsMap = new Map<string, number>();
    const wantsMap = new Map<string, number>();
    const otherMap = new Map<string, number>();

    expenseTx.forEach((t) => {
      const text = `${t.category} ${t.description}`.toLowerCase();
      if (needsKeywords.some((k) => text.includes(k))) {
        needs += t.amount;
        needsMap.set(t.category, (needsMap.get(t.category) || 0) + t.amount);
      } else if (wantsKeywords.some((k) => text.includes(k))) {
        wants += t.amount;
        wantsMap.set(t.category, (wantsMap.get(t.category) || 0) + t.amount);
      } else {
        other += t.amount;
        otherMap.set(t.category, (otherMap.get(t.category) || 0) + t.amount);
      }
    });

    const fixedCandidates = ['aluguel', 'internet', 'assinatura', 'escola', 'condominio', 'plano'];
    const variableCandidates = ['mercado', 'restaurante', 'lazer', 'transporte', 'delivery', 'compras'];
    let fixed = 0;
    let variable = 0;
    const fixedMap = new Map<string, number>();
    const variableMap = new Map<string, number>();

    expenseTx.forEach((t) => {
      const text = `${t.category} ${t.description}`.toLowerCase();
      if (fixedCandidates.some((k) => text.includes(k))) {
        fixed += t.amount;
        fixedMap.set(t.category, (fixedMap.get(t.category) || 0) + t.amount);
      } else if (variableCandidates.some((k) => text.includes(k))) {
        variable += t.amount;
        variableMap.set(t.category, (variableMap.get(t.category) || 0) + t.amount);
      } else {
        variable += t.amount;
        variableMap.set(t.category, (variableMap.get(t.category) || 0) + t.amount);
      }
    });

    const maxExpenseDay = dailyExpense.reduce(
      (best, amount, index) => (amount > best.amount ? { amount, dayIndex: index } : best),
      { amount: 0, dayIndex: 0 },
    );

    const maxWeek = weekBuckets.reduce(
      (best, amount, index) => (amount > best.amount ? { amount, weekIndex: index } : best),
      { amount: 0, weekIndex: 0 },
    );

    const maxWeekday = weekdayExpense.reduce(
      (best, amount, index) => (amount > best.amount ? { amount, weekdayIndex: index } : best),
      { amount: 0, weekdayIndex: 0 },
    );

    const recurringCategoryCount = new Map<string, { count: number; amount: number }>();
    expenseTx.forEach((t) => {
      const current = recurringCategoryCount.get(t.category) || { count: 0, amount: 0 };
      recurringCategoryCount.set(t.category, { count: current.count + 1, amount: current.amount + t.amount });
    });
    const recurringCategories = Array.from(recurringCategoryCount.entries())
      .filter(([, data]) => data.count >= 2)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 3)
      .map(([name, data]) => ({ name, ...data }));

    const maxDayDate = periodDates[maxExpenseDay.dayIndex];
    const maxDayKey = maxDayDate ? maxDayDate.toISOString().split('T')[0] : '';
    const maxDayTransactions = expenseTx
      .filter((t) => new Date(t.date).toISOString().split('T')[0] === maxDayKey)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    const topExpenseOnMaxDay = maxDayTransactions[0];

    const getTopExamples = (map: Map<string, number>) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

    const bestIncome = incomeTx.reduce((best, t) => (t.amount > best.amount ? t : best), { amount: 0, description: '-' } as Transaction);
    const bestExpense = expenseTx.reduce((best, t) => (t.amount > best.amount ? t : best), { amount: 0, description: '-' } as Transaction);

    return {
      txCount,
      avgTicket,
      dailyNet,
      dayLabels,
      cumulativeNet,
      weekBuckets,
      weekLabels,
      weekdayExpense,
      weekdayLabels,
      last7Expense,
      prev7Expense,
      last7Trend,
      concentration,
      top3Expense,
      maxWeek,
      maxWeekday,
      recurringCategories,
      needs,
      wants,
      other,
      needsExamples: getTopExamples(needsMap),
      wantsExamples: getTopExamples(wantsMap),
      otherExamples: getTopExamples(otherMap),
      fixed,
      variable,
      fixedExamples: getTopExamples(fixedMap),
      variableExamples: getTopExamples(variableMap),
      maxExpenseDay,
      maxDayTransactions,
      topExpenseOnMaxDay,
      bestIncome,
      bestExpense,
    };
  }, [periodTransactions, periodStats, periodDates]);

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-200">
      {/* 1. Contexto Anual (Design Novo) */}
      <div className="space-y-4">
         {/* Insight anual automatico */}
         {!!annualInsight && (
          <div className="w-full bg-white p-5 rounded-[28px] shadow-sm border border-slate-100 flex items-center gap-5 relative overflow-hidden">
                {/* Decorativo de fundo sutil */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-[100px] pointer-events-none"></div>

                {/* Icone Avatar */}
                <div className="relative shrink-0">
                  <div className="h-14 w-14 rounded-[20px] bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-2xl text-primary">psychology</span>
                    </div>
                    {/* Badge de notificacao/status */}
                    <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm border border-slate-50">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-primary animate-pulse"></span>
                    </div>
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0 z-10">
                    <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 md:text-xs">Poup+ Intelligence local</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/40"></span>
                    </div>
                    
                    <p className="text-sm font-bold text-slate-700 leading-snug line-clamp-2">
                    {annualInsight}
                    </p>
                </div>

                <div className="shrink-0 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-primary z-10 md:text-sm">
                  Automatico
                </div>
              </div>
         )}

         <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
           <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
             <div>
               <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 md:text-xs">Panorama anual</p>
               <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{currentYearDate.getFullYear()}</h2>
             </div>

             <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-1">
               <button
                 onClick={() => setCurrentYearDate(new Date(currentYearDate.getFullYear() - 1, 0, 1))}
                 className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-white hover:text-slate-700"
                 aria-label="Ano anterior"
               >
                 <span className="material-symbols-outlined">chevron_left</span>
               </button>
               <div className="min-w-[88px] px-2 text-center text-base font-black text-slate-700 md:text-lg">
                 {currentYearDate.getFullYear()}
               </div>
               <button
                 onClick={() => setCurrentYearDate(new Date(currentYearDate.getFullYear() + 1, 0, 1))}
                 className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-white hover:text-slate-700"
                 aria-label="Próximo ano"
               >
                 <span className="material-symbols-outlined">chevron_right</span>
               </button>
             </div>
           </div>

           <div className="p-2 sm:p-3">
             <AnnualMixedChart 
                data={annualData} 
                selectedMonthIndex={selectedAnnualMonthIndex} 
                onMonthClick={handleMonthClick}
             />
           </div>
         </div>
      </div>

      <div className="flex items-center gap-4">
         <div className="h-px bg-slate-200 flex-1"></div>
         <span className="text-sm font-black text-slate-400 uppercase tracking-[0.16em] md:text-base">Analise detalhada</span>
         <div className="h-px bg-slate-200 flex-1"></div>
      </div>

      {/* 2. Filtro de mes + indicador de insights automaticos */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-2 flex flex-col md:flex-row items-center justify-between gap-4">
         <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="bg-white p-1.5 rounded-[20px] shadow-sm border border-slate-100">
              <MonthSelector currentDate={currentMonthDate} onMonthChange={setCurrentMonthDate} />
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
              {([
                { key: '30d', label: '30d' },
                { key: '90d', label: '90d' },
                { key: '180d', label: '180d' },
                { key: '365d', label: '365d' },
                { key: 'custom', label: 'Personalizado' },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setAnalysisRange(option.key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] transition-all md:text-sm ${analysisRange === option.key ? 'bg-primary text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {analysisRange === 'custom' && (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 md:text-base" />
                <span className="text-sm font-black text-slate-400 md:text-base">ate</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 md:text-base" />
              </div>
            )}
         </div>
         
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-emerald-700 md:text-base">
          Insights automaticos ativos
        </div>
      </div>

      {/* 3. Colunas de analise */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
         {/* Receitas */}
        <div className="flex h-full flex-col gap-4">
           <MonthlyBreakdownCard 
                title="Entradas do Periodo" 
                type="income" 
                categories={periodStats.incomeCats} 
                total={periodStats.income} 
                onCategoryClick={(cat) => handleCategoryClick(cat, 'income')}
             />
           <InsightCard text={localInsights.income} tone="success" label="IA sobre entradas" />
         </div>

         {/* Despesas */}
        <div className="flex h-full flex-col gap-4">
             <MonthlyBreakdownCard 
             title="Saidas do Periodo" 
                type="expense" 
             categories={periodStats.expenseCats} 
             total={periodStats.expense}
                onCategoryClick={(cat) => handleCategoryClick(cat, 'expense')} 
             />
             <InsightCard text={localInsights.expense} tone="warning" label="IA sobre saidas" />
         </div>
      </div>

      {/* 4. Resultado geral */}
      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 md:text-xs">Balanco liquido do periodo ({new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(selectedPeriod.start)} - {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(selectedPeriod.end)})</p>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-primary md:text-sm">Veredito automatico</span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700 md:text-xs">Entradas</p>
            <p className="mt-2 text-3xl font-black text-emerald-700 md:text-4xl">{formatCurrency(periodStats.income)}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-700 md:text-xs">Saidas</p>
            <p className="mt-2 text-3xl font-black text-rose-700 md:text-4xl">{formatCurrency(periodStats.expense)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 md:text-xs">Resultado</p>
            <p className={`mt-2 text-3xl font-black md:text-4xl ${periodStats.result >= 0 ? 'text-primary' : 'text-rose-600'}`}>{formatCurrency(periodStats.result)}</p>
          </div>
        </div>

        <div className="mt-4">
          <InsightCard text={localInsights.general} tone="neutral" label="Veredito da IA" />
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-2xl font-black text-slate-900 md:text-3xl">Analises Financeiras por Periodo</h3>
          <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500 md:text-sm">Local e automatico</span>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <AnalysisCard title="Fluxo diario do periodo">
            <NetBarsChart values={advancedAnalysis.dailyNet} labels={advancedAnalysis.dayLabels} />
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 md:text-base">
                Media diaria: <span className="text-slate-900">{formatCurrency((periodStats.result) / Math.max(advancedAnalysis.dailyNet.length, 1))}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 md:text-base">
                Melhor dia: <span className="text-emerald-700">{formatCurrency(Math.max(...advancedAnalysis.dailyNet, 0))}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 md:text-base">
                Pior dia: <span className="text-rose-700">{formatCurrency(Math.min(...advancedAnalysis.dailyNet, 0))}</span>
              </div>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Acumulado diario">
            <MiniAreaChart values={advancedAnalysis.cumulativeNet} labels={advancedAnalysis.dayLabels} color="#2563eb" />
            <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold leading-relaxed text-blue-900 md:text-base">
              Acumulo do saldo liquido (entradas - saidas) ao longo do periodo. Valor final acumulado: {formatCurrency(advancedAnalysis.cumulativeNet[advancedAnalysis.cumulativeNet.length - 1] || 0)}.
            </p>
          </AnalysisCard>

          <AnalysisCard title="Despesas por semana">
            <MiniBarChart values={advancedAnalysis.weekBuckets} labels={advancedAnalysis.weekLabels} color="#dc2626" />
            <div className="mt-3 space-y-2">
              <p className="text-sm font-bold leading-relaxed text-slate-600 md:text-base">
                Semana com maior gasto: <span className="text-rose-700">{advancedAnalysis.weekLabels[advancedAnalysis.maxWeek.weekIndex]}</span> em <span className="text-slate-900">{formatCurrency(advancedAnalysis.maxWeek.amount)}</span>.
              </p>
              {advancedAnalysis.recurringCategories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {advancedAnalysis.recurringCategories.map((item) => (
                    <span key={item.name} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 md:text-sm">
                      {item.name}: {item.count}x ({formatCurrency(item.amount)})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </AnalysisCard>

          <AnalysisCard title="Gastos por dia da semana">
            <MiniBarChart values={advancedAnalysis.weekdayExpense} labels={advancedAnalysis.weekdayLabels} color="#f97316" />
            <div className="mt-2 flex justify-between text-xs font-black text-slate-400 md:text-sm">
              {advancedAnalysis.weekdayLabels.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold leading-relaxed text-amber-900 md:text-base">
              Dia que voce mais gasta: {advancedAnalysis.weekdayLabels[advancedAnalysis.maxWeekday.weekdayIndex]} ({formatCurrency(advancedAnalysis.maxWeekday.amount)} no periodo).
            </p>
          </AnalysisCard>

          <AnalysisCard title="Concentracao Top 3 categorias">
            <div className="space-y-2">
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, advancedAnalysis.concentration)}%` }} />
              </div>
              <p className="text-3xl font-black text-slate-900 md:text-4xl">{advancedAnalysis.concentration.toFixed(1)}%</p>
              <p className="text-sm font-semibold text-slate-500 md:text-base">das saidas estao nas 3 maiores categorias</p>
              <div className="flex flex-wrap gap-2">
                {advancedAnalysis.top3Expense.map((cat) => (
                  <span key={cat.id} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-500 md:text-sm">{cat.name}: {formatCurrency(cat.amount)}</span>
                ))}
              </div>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Necessidades x desejos">
            <ProgressSegments
              segments={[
                { label: 'Necessidades', value: advancedAnalysis.needs, color: '#16a34a' },
                { label: 'Desejos', value: advancedAnalysis.wants, color: '#f97316' },
                { label: 'Outros', value: advancedAnalysis.other, color: '#64748b' },
              ]}
            />
            <div className="mt-3 space-y-2 text-sm font-bold leading-relaxed text-slate-600 md:text-base">
              <p>Classificacao usada:</p>
              <p><span className="text-emerald-700">Necessidades</span> (ex.: aluguel, mercado, transporte, saude): {advancedAnalysis.needsExamples.join(', ') || 'Sem exemplos no periodo'}.</p>
              <p><span className="text-amber-700">Desejos</span> (ex.: lazer, restaurante, delivery, viagens): {advancedAnalysis.wantsExamples.join(', ') || 'Sem exemplos no periodo'}.</p>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Fixas x variaveis">
            <ProgressSegments
              segments={[
                { label: 'Fixas', value: advancedAnalysis.fixed, color: '#4f46e5' },
                { label: 'Variaveis', value: advancedAnalysis.variable, color: '#06b6d4' },
              ]}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm font-bold text-slate-600 md:text-base">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">Fixas: {advancedAnalysis.fixedExamples.join(', ') || 'Sem exemplos no periodo'}</div>
              <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3">Variaveis: {advancedAnalysis.variableExamples.join(', ') || 'Sem exemplos no periodo'}</div>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Tendencia ultimos 7 dias">
            <div className="space-y-1">
              <p className={`text-4xl font-black md:text-5xl ${advancedAnalysis.last7Trend <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {advancedAnalysis.last7Trend > 0 ? '+' : ''}{advancedAnalysis.last7Trend.toFixed(1)}%
              </p>
              <p className="text-sm font-semibold text-slate-500 md:text-base">variacao das despesas vs 7 dias anteriores</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-500 md:text-sm">Atual: {formatCurrency(advancedAnalysis.last7Expense)}</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-500 md:text-sm">Anterior: {formatCurrency(advancedAnalysis.prev7Expense)}</span>
              </div>
              <p className="text-sm font-bold text-slate-600 md:text-base">Leitura rapida: {advancedAnalysis.last7Trend <= 0 ? 'despesas desacelerando' : 'despesas acelerando'}.</p>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Maior dia de gasto">
            <div className="space-y-1">
              <p className="text-4xl font-black text-slate-900 md:text-5xl">{advancedAnalysis.dayLabels[advancedAnalysis.maxExpenseDay.dayIndex] ?? '-'}</p>
              <p className="text-2xl font-black text-rose-600 md:text-3xl">{formatCurrency(advancedAnalysis.maxExpenseDay.amount)}</p>
              <p className="text-sm font-semibold text-slate-500 md:text-base">pico de saida no periodo</p>
              {advancedAnalysis.topExpenseOnMaxDay && (
                <p className="text-sm font-bold leading-relaxed text-slate-700 md:text-base">
                  Principal impacto: {advancedAnalysis.topExpenseOnMaxDay.category} - {advancedAnalysis.topExpenseOnMaxDay.description} ({formatCurrency(advancedAnalysis.topExpenseOnMaxDay.amount)}).
                </p>
              )}
              {advancedAnalysis.maxDayTransactions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {advancedAnalysis.maxDayTransactions.map((tx) => (
                    <span key={tx.id} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-500 md:text-sm">
                      {tx.category}: {formatCurrency(tx.amount)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </AnalysisCard>

          <AnalysisCard title="Intensidade operacional">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 md:text-xs">Lancamentos</p>
                <p className="mt-1 text-3xl font-black text-slate-900 md:text-4xl">{advancedAnalysis.txCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 md:text-xs">Ticket medio</p>
                <p className="mt-1 text-xl font-black text-slate-900 md:text-2xl">{formatCurrency(advancedAnalysis.avgTicket)}</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 md:text-xs">Maior entrada</p>
                <p className="truncate text-base font-black text-emerald-700 md:text-lg">{advancedAnalysis.bestIncome.description} • {formatCurrency(advancedAnalysis.bestIncome.amount)}</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 md:text-xs">Maior saida</p>
                <p className="truncate text-base font-black text-rose-700 md:text-lg">{advancedAnalysis.bestExpense.description} • {formatCurrency(advancedAnalysis.bestExpense.amount)}</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-relaxed text-slate-600 md:text-base">
                Ritmo operacional: media de {formatCurrency(advancedAnalysis.avgTicket)} por lancamento e concentracao de {advancedAnalysis.concentration.toFixed(1)}% nas 3 maiores categorias de despesa.
              </div>
            </div>
          </AnalysisCard>
        </div>
      </section>
    </div>
  );
};
