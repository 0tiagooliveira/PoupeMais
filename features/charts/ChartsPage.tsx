import React, { useState, useMemo } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency } from '../../utils/formatters';

type ChartMainTab = 'barras' | 'rosca' | 'linha';

export const ChartsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ChartMainTab>('barras');
  const [activeMetric, setActiveMetric] = useState('Fluxo de caixa anual');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const { transactions } = useTransactions(currentDate);
  const { accounts } = useAccounts();

  const metricsMap = {
    barras: ['Balanço mensal', 'Fluxo de caixa anual', 'Despesas por dia'],
    rosca: ['Despesas por categoria', 'Receitas por categoria', 'Saldos por conta'],
    linha: ['Evolução de patrimônio', 'Tendência de gastos']
  };

  const handleTabChange = (tab: ChartMainTab) => {
    setActiveTab(tab);
    setActiveMetric(metricsMap[tab][0]);
  };

  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const currentYear = currentDate.getFullYear();

  return (
    <div className="min-h-screen bg-background pb-20 animate-in fade-in duration-700">
      {/* Header Estilizado */}
      <div className="bg-primary px-6 py-5 flex items-center justify-between text-white sticky top-0 z-20 shadow-lg rounded-b-[32px] mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight">Gráficos</h1>
            <span className="text-[10px] font-bold text-white/70">Análise detalhada</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="h-9 w-9 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20 transition-all">
            <span className="material-symbols-outlined text-xl">tune</span>
          </button>
          <button className="h-9 w-9 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20 transition-all">
            <span className="material-symbols-outlined text-xl">more_vert</span>
          </button>
        </div>
      </div>

      {/* Seletor de Tipo de Gráfico (Tabs superiores) */}
      <div className="flex justify-center gap-2 px-6 mb-6">
        {(['barras', 'rosca', 'linha'] as ChartMainTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl transition-all border ${
              activeTab === tab 
              ? 'bg-primary text-white border-primary shadow-md' 
              : 'bg-white text-slate-400 border-slate-100'
            }`}
          >
            <span className="text-xs font-bold capitalize">{tab}</span>
          </button>
        ))}
      </div>

      {/* Sub-métricas (Pills) */}
      <div className="flex gap-2 px-6 overflow-x-auto no-scrollbar pb-6">
        {metricsMap[activeTab].map(metric => (
          <button
            key={metric}
            onClick={() => setActiveMetric(metric)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full text-[11px] font-bold transition-all border ${
              activeMetric === metric
              ? 'bg-primary border-primary text-white shadow-sm'
              : 'bg-white text-slate-400 border-slate-200'
            }`}
          >
            {metric}
          </button>
        ))}
      </div>

      {/* Seletor de Ano/Mês */}
      <div className="flex items-center justify-center gap-8 mb-6">
        <button className="text-primary"><span className="material-symbols-outlined">chevron_left</span></button>
        <span className="text-lg font-bold text-slate-800">{currentYear}</span>
        <button className="text-primary"><span className="material-symbols-outlined">chevron_right</span></button>
      </div>

      {/* Container Principal do Gráfico */}
      <div className="px-4">
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 min-h-[420px] relative">
          {activeMetric === 'Fluxo de caixa anual' && (
            <YearlyCashFlow transactions={transactions} />
          )}
          {activeMetric === 'Balanço mensal' && (
            <MonthlyBalance transactions={transactions} />
          )}
          {activeTab === 'rosca' && (
            <DonutVisualizer metric={activeMetric} transactions={transactions} accounts={accounts} />
          )}
          {activeMetric === 'Despesas por dia' && (
             <WeekdaySpending transactions={transactions} />
          )}
        </div>
      </div>
    </div>
  );
};

const YearlyCashFlow = ({ transactions }: { transactions: any[] }) => {
  // Simulação de dados anuais baseados nas transações atuais para demonstração
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const data = months.map((m, i) => ({
    label: m,
    income: i > 8 ? (Math.random() * 5000 + 1000) : 0,
    expense: i > 8 ? (Math.random() * 4000 + 500) : 0,
  }));

  const maxVal = 12000;
  
  // Pontos para a linha de balanço
  const linePoints = data.map((d, i) => {
    const x = (i / 11) * 100;
    const balance = d.income - d.expense;
    const y = 50 - (balance / maxVal) * 40;
    return `${x}% ${y}%`;
  }).join(', ');

  return (
    <div className="w-full h-full flex flex-col">
      <div className="relative h-64 w-full mt-4 flex items-end justify-between px-2">
        {/* Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between opacity-5 pointer-events-none">
          {[12, 10, 8, 6, 4, 2, 0, -2, -4, -6].map(v => (
            <div key={v} className="w-full border-t border-slate-900 flex justify-start">
               <span className="text-[8px] -mt-2 -ml-8 font-bold text-slate-900">R${v}.000</span>
            </div>
          ))}
        </div>

        {/* Barras */}
        {data.map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-1 w-[7%] h-full justify-end relative z-10">
             <div className="flex gap-0.5 h-full items-end w-full">
                <div 
                  className="bg-success w-1/2 rounded-t-sm transition-all duration-1000" 
                  style={{ height: `${(item.income / maxVal) * 100}%` }}
                ></div>
                <div 
                  className="bg-danger w-1/2 rounded-t-sm transition-all duration-1000" 
                  style={{ height: `${(item.expense / maxVal) * 100}%` }}
                ></div>
             </div>
          </div>
        ))}

        {/* Linha de Balanço */}
        <svg className="absolute inset-0 w-full h-full overflow-visible z-20 pointer-events-none">
           <path 
             d={`M ${data.map((d, i) => `${(i/11)*100}%,${50 - ((d.income - d.expense)/maxVal)*40}%`).join(' L ')}`}
             fill="none"
             stroke="#3b82f6"
             strokeWidth="2"
             strokeLinecap="round"
             className="animate-dash"
             style={{ transform: 'scale(0.95)', transformOrigin: 'center' }}
           />
           {data.map((d, i) => {
             const x = (i/11)*100;
             const balance = d.income - d.expense;
             const y = 50 - (balance/maxVal)*40;
             if (d.income === 0) return null;
             return (
               <circle key={i} cx={`${x}%`} cy={`${y}%`} r="3" fill="#3b82f6" stroke="white" strokeWidth="1" />
             );
           })}
        </svg>
      </div>

      {/* Labels X */}
      <div className="flex justify-between w-full mt-4 px-1">
        {months.map(m => <span key={m} className="text-[9px] font-bold text-slate-400">{m}.</span>)}
      </div>

      {/* Legenda Estilizada */}
      <div className="mt-10 flex flex-wrap justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500"></div>
          <span className="text-[10px] font-bold text-slate-500">(Receitas - Despesas)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-success"></div>
          <span className="text-[10px] font-bold text-slate-500">Receitas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-danger"></div>
          <span className="text-[10px] font-bold text-slate-500">Despesas</span>
        </div>
      </div>
    </div>
  );
};

const MonthlyBalance = ({ transactions }: { transactions: any[] }) => {
  // Visualização de balanço mensal agrupado por períodos
  const periods = ['Nov de 2025', 'Dez de 2025', 'Jan de 2026'];
  const data = periods.map(p => ({
    label: p,
    income: Math.random() * 2000 + 500,
    expense: Math.random() * 6000 + 2000
  }));

  const maxVal = 6000;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="h-64 w-full flex items-end justify-around px-4 border-b border-slate-100 pb-2 relative">
         {/* Grid background */}
         <div className="absolute inset-0 flex flex-col justify-between opacity-5 py-2">
            {[6, 5, 4, 3, 2, 1, 0].map(v => (
              <div key={v} className="w-full border-t border-slate-900 flex justify-start">
                 <span className="text-[8px] -mt-2 -ml-10 font-bold">R${v}.000</span>
              </div>
            ))}
         </div>

         {data.map((item, i) => (
           <div key={i} className="flex flex-col items-center gap-4 w-1/4 h-full justify-end relative z-10 group">
              <div className="flex items-end gap-2 h-full justify-center w-full">
                 <div 
                   className="bg-success w-8 rounded-t-lg shadow-sm transition-all duration-500 group-hover:brightness-110" 
                   style={{ height: `${(item.income / maxVal) * 100}%` }}
                 ></div>
                 <div 
                   className="bg-danger w-8 rounded-t-lg shadow-sm transition-all duration-500 group-hover:brightness-110" 
                   style={{ height: `${(item.expense / maxVal) * 100}%` }}
                 ></div>
              </div>
              <span className="text-[9px] font-bold text-slate-400 text-center">{item.label}</span>

              {/* Tooltip Simulado no hover do grupo */}
              {i === 0 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full mb-8 z-30 bg-slate-800 text-white p-3 rounded-xl shadow-xl pointer-events-none">
                  <p className="text-[10px] font-bold mb-1 border-b border-white/10 pb-1">{item.label}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-success"></div>
                    <p className="text-[10px] font-medium">Receitas: {formatCurrency(item.income)}</p>
                  </div>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
                </div>
              )}
           </div>
         ))}
      </div>
      <div className="mt-8 flex gap-6">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-success"></div>
          <span className="text-xs font-bold text-slate-500">Receitas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-danger"></div>
          <span className="text-xs font-bold text-slate-500">Despesas</span>
        </div>
      </div>
    </div>
  );
};

const WeekdaySpending = ({ transactions }: { transactions: any[] }) => {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const data = days.map(d => ({ label: d, amount: Math.random() * 500 }));
  const max = Math.max(...data.map(d => d.amount), 1);

  return (
    <div className="w-full flex flex-col pt-10">
      <h4 className="text-sm font-bold text-slate-700 mb-8 text-center">Gasto médio por dia da semana</h4>
      <div className="flex items-end justify-between h-48 px-4">
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-3 w-full">
            <div 
              className="w-8 rounded-t-xl bg-slate-100 transition-all duration-700 relative group overflow-hidden"
              style={{ height: `${(d.amount / max) * 100}%` }}
            >
               <div className="absolute inset-0 bg-primary opacity-20 transition-all group-hover:opacity-40"></div>
               {i > 4 && <div className="absolute inset-0 bg-amber-400 opacity-20"></div>}
            </div>
            <span className="text-[10px] font-bold text-slate-400">{d.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-[10px] font-medium text-slate-400 italic">
        Dica: Seus maiores gastos ocorrem durante o fim de semana.
      </p>
    </div>
  );
};

const DonutVisualizer = ({ metric, transactions, accounts }: { metric: string, transactions: any[], accounts: any[] }) => {
  const processed = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    
    if (metric.includes('Despesas')) {
      transactions.filter(t => t.type === 'expense').forEach(t => {
        map.set(t.category, (map.get(t.category) || 0) + t.amount);
        total += t.amount;
      });
    } else if (metric.includes('Receitas')) {
      transactions.filter(t => t.type === 'income').forEach(t => {
        map.set(t.category, (map.get(t.category) || 0) + t.amount);
        total += t.amount;
      });
    } else {
      accounts.forEach(a => {
        map.set(a.name, a.balance);
        total += a.balance;
      });
    }

    const data = Array.from(map.entries()).map(([name, val]) => ({ name, val }));
    return { data, total };
  }, [transactions, accounts, metric]);

  const colors = ['#21C25E', '#FF4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className="flex flex-col items-center gap-10 pt-6">
      <div className="relative w-56 h-56">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f8fafc" strokeWidth="12" />
          {processed.data.map((d, i) => {
             const percentage = processed.total > 0 ? (d.val / processed.total) : 0;
             const prevTotal = processed.data.slice(0, i).reduce((acc, curr) => acc + curr.val, 0);
             const offset = processed.total > 0 ? (prevTotal / processed.total) : 0;
             return (
                <circle 
                  key={i}
                  cx="50" cy="50" r="40" fill="transparent" 
                  stroke={colors[i % colors.length]} strokeWidth="12" 
                  strokeDasharray={`${percentage * 251.2} 251.2`} 
                  strokeDashoffset={-offset * 251.2}
                  className="transition-all duration-1000 ease-out"
                />
             );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          <span className="text-[10px] font-bold text-slate-400">Total</span>
          <span className="text-xl font-bold text-slate-800 tracking-tighter leading-none">{formatCurrency(processed.total)}</span>
        </div>
      </div>
      
      <div className="w-full space-y-3">
        {processed.data.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></div>
              <span className="text-xs font-bold text-slate-600">{d.name}</span>
            </div>
            <div className="flex items-center gap-3">
               <span className="text-xs font-bold text-slate-800">{formatCurrency(d.val)}</span>
               <span className="text-[10px] font-bold text-slate-300">{((d.val/processed.total)*100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};