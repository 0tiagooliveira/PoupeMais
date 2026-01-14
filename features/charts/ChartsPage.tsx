
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency } from '../../utils/formatters';
import { BackButton } from '../../components/ui/BackButton';
import { MonthSelector } from '../dashboard/components/MonthSelector';
import { incomeCategories, expenseCategories } from '../dashboard/components/NewTransactionModal';

type ChartTab = 'categories' | 'performance' | 'radar' | 'projection';

export const ChartsPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<ChartTab>('categories');
  const [focusedItem, setFocusedItem] = useState<any>(null);
  const { transactions, loading } = useTransactions(currentDate);

  const analytics = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const balance = income - expense;

    // Radar Data - Pilares de Vida Financeira
    const radarData = [
      { axis: 'Essenciais', value: 0, icon: 'home', desc: 'Contas fixas e sobrevivência' },
      { axis: 'Lazer', value: 0, icon: 'local_activity', desc: 'Estilo de vida e diversão' },
      { axis: 'Futuro', value: 0, icon: 'trending_up', desc: 'Investimentos e reserva' },
      { axis: 'Educação', value: 0, icon: 'school', desc: 'Cursos e crescimento' },
      { axis: 'Imprevistos', value: 0, icon: 'medical_services', desc: 'Gastos não planejados' }
    ];

    transactions.forEach(t => {
      if (t.type === 'expense') {
        const cat = t.category;
        if (['Moradia', 'Mercado', 'Transporte', 'Saúde', 'Energia', 'Água', 'Gás'].includes(cat)) radarData[0].value += t.amount;
        else if (['Lazer', 'Viagem', 'Compras', 'Bem-estar'].includes(cat)) radarData[1].value += t.amount;
        else if (['Poupança', 'Investimentos'].includes(cat)) radarData[2].value += t.amount;
        else if (['Educação'].includes(cat)) radarData[3].value += t.amount;
        else radarData[4].value += t.amount;
      }
    });

    const maxRadar = Math.max(...radarData.map(d => d.value), 1);
    const normalizedRadar = radarData.map(d => ({ ...d, percent: (d.value / maxRadar) * 100 }));

    // History
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayTrans = transactions.filter(t => new Date(t.date).getDate() === day);
      const inc = dayTrans.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const exp = dayTrans.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      return { day, income: inc, expense: exp, balance: inc - exp };
    });

    const sortedCategories = Array.from(
      transactions.reduce((acc, t) => {
        if (t.type === 'expense') {
          acc.set(t.category, (acc.get(t.category) || 0) + t.amount);
        }
        return acc;
      }, new Map<string, number>())
    ).map(([name, amount]) => ({ 
      name, 
      amount, 
      color: expenseCategories.find(c => c.name === name)?.color || '#94a3b8' 
    })).sort((a, b) => b.amount - a.amount);

    return { income, expense, balance, normalizedRadar, dailyData, sortedCategories };
  }, [transactions, currentDate]);

  useEffect(() => setFocusedItem(null), [activeTab]);

  return (
    <div className="min-h-screen bg-[#FCFCFD] space-y-4 pb-32 px-2 md:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 py-4 animate-in fade-in duration-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton className="bg-white shadow-sm border border-slate-100" />
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Analytics</h2>
          </div>
          <MonthSelector currentDate={currentDate} onMonthChange={setCurrentDate} className="bg-white p-1 rounded-2xl shadow-sm border border-slate-50" />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {[
          { id: 'categories', label: 'Gastos', icon: 'pie_chart' },
          { id: 'performance', label: 'Histórico', icon: 'query_stats' },
          { id: 'radar', label: 'Equilíbrio', icon: 'radar' },
          { id: 'projection', label: 'Futuro', icon: 'auto_graph' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ChartTab)}
            className={`flex-shrink-0 flex items-center gap-2 py-3 px-5 rounded-2xl text-[11px] font-black transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-lg shadow-success/20'
                : 'bg-white text-slate-400 border border-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stage */}
      <div className="bg-white rounded-[40px] p-6 md:p-10 shadow-xl shadow-slate-200/40 border border-slate-50 min-h-[520px]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 z-10 rounded-[inherit]">
            <div className="h-10 w-10 rounded-full border-4 border-slate-100 border-t-primary animate-spin"></div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {activeTab === 'categories' && (
              <div className="flex-1 flex flex-col space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <header>
                  <h3 className="text-lg font-black text-slate-800">Para onde vai seu dinheiro?</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distribuição por categorias</p>
                </header>

                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="w-full max-w-[240px] aspect-square relative">
                    <DonutChart data={analytics.sortedCategories} total={analytics.expense} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                       <p className="text-[9px] font-black text-slate-400 uppercase">Total Saídas</p>
                       <p className="text-xl font-black text-slate-800">{formatCurrency(analytics.expense)}</p>
                    </div>
                  </div>

                  {/* Legends */}
                  <div className="flex-1 w-full space-y-3">
                    {analytics.sortedCategories.slice(0, 4).map((cat, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                          <span className="text-xs font-black text-slate-700">{cat.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-800">{formatCurrency(cat.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Insight de Economia */}
                <div className="mt-4 p-5 rounded-3xl bg-amber-50 border border-amber-100 flex items-start gap-4">
                   <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                      <span className="material-symbols-outlined">lightbulb</span>
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Dica de Economia</p>
                      <p className="text-xs font-bold text-slate-700 leading-snug">
                        {analytics.sortedCategories[0] 
                          ? `Seus gastos em "${analytics.sortedCategories[0].name}" representam a maior fatia. Tente reduzir 10% nesta categoria para poupar ${formatCurrency(analytics.sortedCategories[0].amount * 0.1)} este mês.`
                          : "Adicione despesas para receber dicas personalizadas."}
                      </p>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'performance' && (
              <div className="flex-1 flex flex-col space-y-6 animate-in slide-in-from-right-4 duration-500">
                <header className="flex justify-between items-end">
                   <div>
                    <h3 className="text-lg font-black text-slate-800">Fluxo de Caixa</h3>
                    <div className="flex gap-4 mt-1">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-primary uppercase"><div className="h-2 w-2 rounded-full bg-primary"></div> Ganhos</div>
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-danger uppercase"><div className="h-2 w-2 rounded-full bg-danger"></div> Gastos</div>
                    </div>
                   </div>
                </header>
                <div className="flex-1 min-h-[250px] pt-4">
                  <FlowLineChart data={analytics.dailyData} onFocus={setFocusedItem} />
                </div>
                <div className="min-h-[70px] bg-slate-50 rounded-2xl p-4 flex items-center justify-center border border-slate-100">
                  {focusedItem ? (
                    <div className="w-full flex justify-between items-center animate-in fade-in">
                       <p className="text-xs font-black text-slate-400">Dia {focusedItem.day}</p>
                       <p className={`text-sm font-black ${focusedItem.balance >= 0 ? 'text-primary' : 'text-danger'}`}>
                         Net: {formatCurrency(focusedItem.balance)}
                       </p>
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold text-slate-300 uppercase italic">Deslize para ver detalhes diários</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'radar' && (
              <div className="flex-1 flex flex-col items-center animate-in zoom-in-95 duration-500 space-y-8 pt-4">
                <div className="text-center">
                  <h3 className="text-lg font-black text-slate-800">Equilíbrio Financeiro</h3>
                  <p className="text-xs font-bold text-slate-400">Como você distribui seu patrimônio</p>
                </div>
                
                <div className="w-full max-w-[320px] aspect-square">
                  <RadarChartWithLabels data={analytics.normalizedRadar} />
                </div>

                <div className="w-full grid grid-cols-1 gap-2">
                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 px-2">Legenda dos Pilares</p>
                   {analytics.normalizedRadar.map((d, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50/50 rounded-xl">
                         <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-slate-400">{d.icon}</span>
                            <span className="text-[11px] font-bold text-slate-600">{d.axis}</span>
                         </div>
                         <span className="text-[10px] font-black text-slate-400 italic truncate ml-4">{d.desc}</span>
                      </div>
                   ))}
                </div>
              </div>
            )}

            {activeTab === 'projection' && (
              <div className="flex-1 flex flex-col items-center justify-center py-10 animate-in fade-in">
                 <div className="h-24 w-24 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-5xl">auto_graph</span>
                 </div>
                 <h3 className="text-lg font-black text-slate-800">Simulador de Futuro</h3>
                 <p className="text-xs font-medium text-slate-400 text-center max-w-[240px] mt-2">
                    Esta funcionalidade está sendo recalibrada para oferecer previsões baseadas em seu comportamento real. 
                 </p>
                 <button className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest">Avisar quando pronto</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- COMPONENTES GRÁFICOS COM LEGENDAS ---

const DonutChart = ({ data, total }: any) => {
  let currentAngle = -Math.PI / 2;
  const radius = 40;
  const center = 50;
  
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full transform-gpu transition-transform hover:scale-105 duration-500">
      {data.map((cat: any, i: number) => {
        const sliceAngle = (cat.amount / (total || 1)) * 2 * Math.PI;
        const x1 = center + radius * Math.cos(currentAngle);
        const y1 = center + radius * Math.sin(currentAngle);
        currentAngle += sliceAngle;
        const x2 = center + radius * Math.cos(currentAngle);
        const y2 = center + radius * Math.sin(currentAngle);
        
        const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
        const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
        
        return (
          <path 
            key={i} 
            d={pathData} 
            fill="none" 
            stroke={cat.color} 
            strokeWidth="12" 
            className="animate-dash"
            style={{ strokeDasharray: '252', strokeDashoffset: '252', animation: `dash 1.5s ease-out ${i * 0.1}s forwards` }}
          />
        );
      })}
    </svg>
  );
};

const RadarChartWithLabels = ({ data }: any) => {
  const points = data.map((d: any, i: number) => {
    const angle = (i * 2 * Math.PI) / data.length - Math.PI / 2;
    const r = d.percent * 0.35;
    const x = 50 + r * Math.cos(angle);
    const y = 50 + r * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
      {[25, 50, 75, 100].map(r => (
        <circle key={r} cx="50" cy="50" r={r * 0.35} fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
      ))}
      {data.map((d: any, i: number) => {
        const angle = (i * 2 * Math.PI) / data.length - Math.PI / 2;
        const xAxis = 50 + 42 * Math.cos(angle);
        const yAxis = 50 + 42 * Math.sin(angle);
        return (
          <g key={i}>
            <line x1="50" y1="50" x2={xAxis} y2={yAxis} stroke="#f1f5f9" strokeWidth="0.5" />
            <text 
              x={50 + 46 * Math.cos(angle)} 
              y={50 + 46 * Math.sin(angle)} 
              fontSize="3.5" 
              fontWeight="900" 
              textAnchor="middle" 
              fill="#94a3b8"
              alignmentBaseline="middle"
              className="uppercase"
            >
              {d.axis}
            </text>
          </g>
        );
      })}
      <polygon 
        points={points} 
        fill="rgba(33, 194, 94, 0.2)" 
        stroke="#21C25E" 
        strokeWidth="1.5" 
        className="animate-dash"
      />
    </svg>
  );
};

const FlowLineChart = ({ data, onFocus }: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const max = Math.max(...data.map((d: any) => Math.max(d.income, d.expense)), 100);

  const handleInteraction = (e: any) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const idx = Math.round((x / rect.width) * (data.length - 1));
    const item = data[Math.max(0, Math.min(data.length - 1, idx))];
    if (item) onFocus(item);
  };

  const getPath = (key: string) => data.map((d: any, i: number) => 
    `${(i / (data.length - 1)) * 100},${100 - (d[key] / max) * 100}`
  ).join(' L ');

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full touch-none"
      onMouseMove={handleInteraction}
      onTouchMove={handleInteraction}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        <path d={`M 0,100 L ${getPath('income')}`} fill="none" stroke="#21C25E" strokeWidth="2.5" strokeLinecap="round" className="animate-dash" />
        <path d={`M 0,100 L ${getPath('expense')}`} fill="none" stroke="#FF4444" strokeWidth="2.5" strokeLinecap="round" className="animate-dash" />
        
        {/* Day Markers */}
        {[0, 10, 20, 30].map(d => (
           <text key={d} x={(d/30)*100} y="110" fontSize="4" fontWeight="bold" fill="#cbd5e1" textAnchor="middle">{d || 1}</text>
        ))}
      </svg>
    </div>
  );
};
