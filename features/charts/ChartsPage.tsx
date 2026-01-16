
import React, { useState, useMemo, useRef } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency } from '../../utils/formatters';
import { BackButton } from '../../components/ui/BackButton';
import { incomeCategories, expenseCategories } from '../dashboard/components/NewTransactionModal';
import { Transaction } from '../../types';

type AnalysisView = 'tudo' | 'receitas' | 'despesas' | 'fluxo';
type BreakdownType = 'grupos' | 'categorias';

// --- COMPONENTE DE GRÁFICO HÍBRIDO INTERATIVO ---
const AnnualMixedChart: React.FC<{ 
  data: any[], 
  view: AnalysisView,
  selectedMonthIndex: number 
}> = ({ data, view, selectedMonthIndex }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  
  const width = 1000;
  const height = 400;
  const paddingX = 70;
  const paddingY = 50;
  
  // Encontrar limites para escala
  const allVals = data.flatMap(d => [d.income, d.expense, d.flow]);
  const maxVal = Math.max(...allVals, 8000) * 1.1;
  const minVal = Math.min(...allVals, -3000) * 1.2;
  const totalRange = maxVal - minVal;

  const getX = (i: number) => (i / 11) * (width - paddingX * 2) + paddingX;
  const getY = (val: number) => {
    const zeroPos = height - paddingY - (Math.abs(minVal) / totalRange) * (height - paddingY * 2);
    return zeroPos - (val / totalRange) * (height - paddingY * 2);
  };

  const zeroY = getY(0);

  // Pontos para a linha de fluxo
  const flowPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.flow) }));
  let lineD = `M ${flowPoints[0].x} ${flowPoints[0].y}`;
  for (let i = 0; i < flowPoints.length - 1; i++) {
    const p0 = flowPoints[i];
    const p1 = flowPoints[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    lineD += ` C ${cp1x} ${p0.y}, ${cp1x} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  // Geração das linhas de grade (Y-Axis)
  const gridLines = [];
  const step = 2000;
  for (let v = Math.floor(minVal / step) * step; v <= maxVal; v += step) {
    gridLines.push(v);
  }

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredIndex(index);
    setTooltipPos({
      x: e.clientX,
      y: e.clientY
    });
  };

  return (
    <div className="relative w-full overflow-hidden">
      {/* Título do Gráfico */}
      <div className="mb-6 px-2">
        <h3 className="text-lg font-black text-slate-800 tracking-tight">Desempenho Anual de Caixa</h3>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Comparativo de entradas, saídas e saldo líquido</p>
      </div>

      {/* Legenda Customizada */}
      <div className="flex flex-wrap gap-5 mb-8 px-2">
        <div className="flex items-center gap-2">
           <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm" />
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Receitas</span>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-3 h-3 rounded-full bg-rose-400 shadow-sm" />
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Despesas</span>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-6 h-0.5 bg-slate-900 rounded-full" />
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Fluxo de Caixa</span>
        </div>
      </div>

      <div className="w-full overflow-x-auto no-scrollbar">
        <div className="min-w-[900px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
            {/* Linhas de Grade e Eixo Y */}
            {gridLines.map((val, i) => (
              <g key={i}>
                <line 
                  x1={paddingX} y1={getY(val)} 
                  x2={width - paddingX} y2={getY(val)} 
                  stroke={val === 0 ? "#cbd5e1" : "#f1f5f9"} 
                  strokeWidth={val === 0 ? "1.5" : "1"} 
                  strokeDasharray={val === 0 ? "0" : "4 4"} 
                />
                <text 
                  x={paddingX - 12} y={getY(val) + 4} 
                  textAnchor="end" 
                  className={`text-[11px] font-black ${val === 0 ? 'fill-slate-500' : 'fill-slate-300'}`}
                >
                  {val === 0 ? 'R$ 0' : `R$ ${val >= 1000 || val <= -1000 ? `${(val/1000).toFixed(0)}k` : val}`}
                </text>
              </g>
            ))}

            {/* Colunas e Interação */}
            {data.map((d, i) => {
              const xBase = getX(i);
              const barWidth = 22;
              const isSelected = i === selectedMonthIndex;
              const isHovered = i === hoveredIndex;
              
              return (
                <g 
                  key={i} 
                  onMouseMove={(e) => handleMouseMove(e, i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onTouchStart={(e) => {
                    setHoveredIndex(i);
                    const touch = e.touches[0];
                    setTooltipPos({ x: touch.clientX, y: touch.clientY });
                  }}
                  className="cursor-pointer"
                >
                  {/* Área de interação invisível maior */}
                  <rect 
                    x={xBase - 40} y={0} width={80} height={height} 
                    fill="transparent" 
                  />

                  {/* Barra de Despesa */}
                  {(view === 'tudo' || view === 'despesas') && (
                    <rect
                      x={xBase - barWidth - 3}
                      y={getY(d.expense)}
                      width={barWidth}
                      height={zeroY - getY(d.expense)}
                      rx="6"
                      fill={isHovered ? '#f43f5e' : (isSelected ? '#f87171' : '#fecaca')}
                      className="transition-all duration-300 shadow-sm"
                    />
                  )}
                  {/* Barra de Receita */}
                  {(view === 'tudo' || view === 'receitas') && (
                    <rect
                      x={xBase + 3}
                      y={getY(d.income)}
                      width={barWidth}
                      height={zeroY - getY(d.income)}
                      rx="6"
                      fill={isHovered ? '#10b981' : (isSelected ? '#34d399' : '#a7f3d0')}
                      className="transition-all duration-300 shadow-sm"
                    />
                  )}
                  {/* Label Meses */}
                  <text 
                    x={xBase} y={height - 15} 
                    textAnchor="middle" 
                    className={`text-[12px] font-black transition-colors ${isHovered || isSelected ? 'fill-slate-800' : 'fill-slate-300'}`}
                  >
                    {d.label}
                  </text>

                  {/* Destaque de Hover no Fundo */}
                  {isHovered && (
                    <rect 
                        x={xBase - 40} y={paddingY} width={80} height={height - paddingY*2} 
                        fill="rgba(0,0,0,0.02)" rx="20"
                    />
                  )}
                </g>
              );
            })}

            {/* Linha de Fluxo (Spline) */}
            {(view === 'tudo' || view === 'fluxo') && (
              <g pointerEvents="none">
                <path 
                    d={lineD} fill="none" 
                    stroke="#0f172a" strokeWidth="3" 
                    strokeLinecap="round" strokeLinejoin="round"
                    className="animate-dash"
                />
                {flowPoints.map((p, i) => (
                  <circle 
                    key={i} cx={p.x} cy={p.y} r="5" 
                    fill="#0f172a" stroke="#fff" strokeWidth="2.5" 
                    className="shadow-xl"
                  />
                ))}
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* TOOLTIP FLUTUANTE */}
      {hoveredIndex !== null && (
        <div 
          className="fixed z-[100] pointer-events-none transform -translate-x-1/2 -translate-y-[120%] animate-in fade-in zoom-in-95 duration-200"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-3xl shadow-2xl border border-white/10 min-w-[160px]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">
               Resumo de {data[hoveredIndex].label}
            </p>
            <div className="space-y-2">
               <div className="flex justify-between items-center gap-4">
                  <span className="text-[10px] font-bold text-white/60">Receitas</span>
                  <span className="text-xs font-black text-emerald-400">{formatCurrency(data[hoveredIndex].income)}</span>
               </div>
               <div className="flex justify-between items-center gap-4">
                  <span className="text-[10px] font-bold text-white/60">Despesas</span>
                  <span className="text-xs font-black text-rose-400">{formatCurrency(data[hoveredIndex].expense)}</span>
               </div>
               <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center gap-4">
                  <span className="text-[10px] font-black text-white/40 uppercase">Fluxo Líquido</span>
                  <span className={`text-sm font-black ${data[hoveredIndex].flow >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(data[hoveredIndex].flow)}
                  </span>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE DE ITEM DE LISTA COM BARRA DE PROGRESSO ---
const BreakdownItem: React.FC<{ 
  item: { name: string, amount: number, icon: string, color: string, percentage: number },
  type: 'income' | 'expense'
}> = ({ item, type }) => {
  const isIncome = type === 'income';

  return (
    <div className="relative group overflow-hidden rounded-[24px] border border-slate-50 bg-white p-4 mb-2 transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer">
      {/* Barra de Progresso de Fundo */}
      <div 
        className={`absolute left-0 top-0 h-full transition-all duration-1000 ease-out opacity-10 ${isIncome ? 'bg-emerald-500' : 'bg-rose-500'}`}
        style={{ width: `${item.percentage}%` }}
      />
      
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div 
            className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:rotate-12"
            style={{ backgroundColor: `${item.color}20`, color: item.color }}
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-700 leading-tight">{item.name}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.percentage.toFixed(1)}% do total</p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm font-black text-slate-800">
            {formatCurrency(item.amount)}
          </p>
        </div>
      </div>
    </div>
  );
};

export const ChartsPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeView, setActiveView] = useState<AnalysisView>('tudo');
  const [incomeBreakdown, setIncomeBreakdown] = useState<BreakdownType>('categorias');
  const [expenseBreakdown, setExpenseBreakdown] = useState<BreakdownType>('categorias');

  const { transactions } = useTransactions(currentDate);

  const annualData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months.map((m, i) => {
      if (i === currentDate.getMonth()) {
        const inc = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const exp = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        return { label: m, income: inc, expense: exp, flow: inc - exp };
      }
      const mockInc = 3500 + Math.random() * 2500;
      const mockExp = 2500 + Math.random() * 3000;
      return { label: m, income: mockInc, expense: mockExp, flow: mockInc - mockExp };
    });
  }, [transactions, currentDate]);

  const stats = useMemo(() => {
    const current = annualData[currentDate.getMonth()];
    const saved = current.income > 0 ? (current.flow / current.income) * 100 : 0;
    return { ...current, saved };
  }, [annualData, currentDate]);

  const getBreakdown = (type: 'income' | 'expense') => {
    const dataMap = new Map<string, number>();
    const trans = transactions.filter(t => t.type === type);
    const total = trans.reduce((acc, t) => acc + t.amount, 0);

    trans.forEach(t => dataMap.set(t.category, (dataMap.get(t.category) || 0) + t.amount));

    const refCats = type === 'income' ? incomeCategories : expenseCategories;
    
    return Array.from(dataMap.entries()).map(([name, amount]) => {
      const ref = refCats.find(c => c.name === name);
      return {
        name,
        amount,
        icon: ref ? ref.icon : 'category',
        color: ref ? ref.color : '#94a3b8',
        percentage: total > 0 ? (amount / total) * 100 : 0
      };
    }).sort((a, b) => b.amount - a.amount);
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* HEADER E NAVEGAÇÃO */}
      <div className="bg-white rounded-[40px] p-8 border border-slate-50 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
             <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-800 transition-all active:scale-90">
               <span className="material-symbols-outlined">chevron_left</span>
             </button>
             <div className="text-center">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight capitalize leading-none mb-1">
                  {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(currentDate)}
                </h2>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{currentDate.getFullYear()}</p>
             </div>
             <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-800 transition-all active:scale-90">
               <span className="material-symbols-outlined">chevron_right</span>
             </button>
          </div>

          <div className="hidden sm:flex gap-2">
             <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Análise Ativa</span>
             </div>
          </div>
        </div>

        {/* FILTROS E GRÁFICO */}
        <div className="flex flex-col gap-10">
          <div className="flex justify-center">
            <div className="inline-flex items-center bg-slate-100/50 p-1.5 rounded-[24px] border border-slate-100">
              {[
                { id: 'tudo', label: 'Visão Geral' },
                { id: 'receitas', label: 'Ganhos', color: '#10b981' },
                { id: 'despesas', label: 'Gastos', color: '#f43f5e' },
                { id: 'fluxo', label: 'Liquidez', color: '#0f172a' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as AnalysisView)}
                  className={`px-6 py-3 rounded-2xl text-[11px] font-black transition-all flex items-center gap-2 ${
                    activeView === tab.id ? 'bg-white shadow-lg text-slate-800 scale-105' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tab.color }} />}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <AnnualMixedChart 
            data={annualData} 
            view={activeView} 
            selectedMonthIndex={currentDate.getMonth()} 
          />
        </div>
      </div>

      {/* MÉTRICAS DE IMPACTO */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Entradas', value: stats.income, color: 'text-emerald-500', icon: 'trending_up', bg: 'bg-emerald-50' },
          { label: 'Saídas', value: stats.expense, color: 'text-rose-500', icon: 'trending_down', bg: 'bg-rose-50' },
          { label: 'Resultado', value: stats.flow, color: stats.flow >= 0 ? 'text-emerald-600' : 'text-rose-600', icon: 'account_balance', bg: 'bg-slate-50' },
          { label: 'Poupança', value: `${stats.saved.toFixed(0)}%`, color: 'text-slate-900', icon: 'savings', bg: 'bg-indigo-50', isPercentage: true }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm transition-all hover:shadow-md">
             <div className={`w-10 h-10 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4`}>
                <span className="material-symbols-outlined text-xl">{stat.icon}</span>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
             <p className={`text-xl font-black tracking-tighter ${stat.color}`}>
                {stat.isPercentage ? stat.value : formatCurrency(stat.value as number).replace(',00', '')}
             </p>
          </div>
        ))}
      </div>

      {/* DETALHAMENTO POR CATEGORIA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-black text-slate-800">Distribuição de Receitas</h3>
            <div className="flex bg-slate-50 p-1 rounded-xl">
               <button onClick={() => setIncomeBreakdown('categorias')} className="px-4 py-1.5 rounded-lg text-[10px] font-black bg-white shadow-sm text-emerald-600">Mensal</button>
            </div>
          </div>
          <div className="space-y-1">
            {getBreakdown('income').map((item, i) => (
              <BreakdownItem key={i} item={item} type="income" />
            ))}
            {getBreakdown('income').length === 0 && (
                <div className="py-20 text-center rounded-[32px] border-2 border-dashed border-slate-100">
                    <span className="material-symbols-outlined text-slate-200 text-4xl mb-2">payments</span>
                    <p className="text-xs font-bold text-slate-300">Sem receitas neste mês</p>
                </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-black text-slate-800">Principais Gastos</h3>
            <div className="flex bg-slate-50 p-1 rounded-xl">
               <button onClick={() => setExpenseBreakdown('categorias')} className="px-4 py-1.5 rounded-lg text-[10px] font-black bg-white shadow-sm text-rose-600">Mensal</button>
            </div>
          </div>
          <div className="space-y-1">
            {getBreakdown('expense').map((item, i) => (
              <BreakdownItem key={i} item={item} type="expense" />
            ))}
            {getBreakdown('expense').length === 0 && (
                <div className="py-20 text-center rounded-[32px] border-2 border-dashed border-slate-100">
                    <span className="material-symbols-outlined text-slate-200 text-4xl mb-2">shopping_bag</span>
                    <p className="text-xs font-bold text-slate-300">Sem despesas registradas</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
