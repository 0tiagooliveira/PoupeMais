
import React, { useState, useMemo } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency } from '../../utils/formatters';
import { BackButton } from '../../components/ui/BackButton';
import { incomeCategories, expenseCategories } from '../dashboard/components/NewTransactionModal';
import { Transaction } from '../../types';

type AnalysisView = 'tudo' | 'receitas' | 'despesas' | 'fluxo';
type BreakdownType = 'grupos' | 'categorias';

// --- COMPONENTE DE GRÁFICO HÍBRIDO (BARRAS + LINHA) ---
const AnnualMixedChart: React.FC<{ 
  data: any[], 
  view: AnalysisView,
  selectedMonthIndex: number 
}> = ({ data, view, selectedMonthIndex }) => {
  const width = 1000;
  const height = 350;
  const paddingX = 60;
  const paddingY = 40;
  
  // Encontrar o maior valor absoluto para escala
  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 5000) * 1.1;
  const minVal = Math.min(...data.map(d => d.flow), 0) * 1.2;
  const totalRange = maxVal - minVal;

  const getX = (i: number) => (i / 11) * (width - paddingX * 2) + paddingX;
  const getY = (val: number) => {
    // Escala que posiciona o R$ 0 de forma inteligente
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

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-4">
      <div className="min-w-[800px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Linhas de Grade e Eixo Y */}
          {[9000, 6000, 3000, 0, -3000].map((val, i) => (
            <g key={i}>
              <line x1={paddingX} y1={getY(val)} x2={width - paddingX} y2={getY(val)} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <text x={paddingX - 10} y={getY(val) + 4} textAnchor="end" className="text-[12px] fill-slate-400 font-bold">
                R$ {val >= 1000 || val <= -1000 ? `${(val/1000).toFixed(0)}k` : val}
              </text>
            </g>
          ))}

          {/* Barras de Receita (Verde) e Despesa (Rosa) */}
          {data.map((d, i) => {
            const xBase = getX(i);
            const barWidth = 24;
            const isSelected = i === selectedMonthIndex;
            
            return (
              <g key={i}>
                {/* Barra de Despesa (Esquerda) */}
                {(view === 'tudo' || view === 'despesas') && (
                  <rect
                    x={xBase - barWidth - 2}
                    y={getY(d.expense)}
                    width={barWidth}
                    height={zeroY - getY(d.expense)}
                    rx="4"
                    fill={isSelected ? '#f43f5e' : '#fecaca'}
                    className="transition-all duration-500"
                  />
                )}
                {/* Barra de Receita (Direita) */}
                {(view === 'tudo' || view === 'receitas') && (
                  <rect
                    x={xBase + 2}
                    y={getY(d.income)}
                    width={barWidth}
                    height={zeroY - getY(d.income)}
                    rx="4"
                    fill={isSelected ? '#10b981' : '#a7f3d0'}
                    className="transition-all duration-500"
                  />
                )}
                {/* Label Meses */}
                <text x={xBase} y={height - 10} textAnchor="middle" className={`text-[12px] font-bold ${isSelected ? 'fill-slate-800' : 'fill-slate-400'}`}>
                  {d.label}
                </text>
              </g>
            );
          })}

          {/* Linha de Fluxo (Spline Preta) */}
          {(view === 'tudo' || view === 'fluxo') && (
            <g>
              <path d={lineD} fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
              {flowPoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="5" fill="#000" stroke="#fff" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

// --- COMPONENTE DE ITEM DE LISTA COM BARRA DE PROGRESSO ---
const BreakdownItem: React.FC<{ 
  item: { name: string, amount: number, icon: string, color: string, percentage: number },
  type: 'income' | 'expense'
}> = ({ item, type }) => {
  const isIncome = type === 'income';
  const accentColor = isIncome ? '#10b981' : '#f43f5e';
  const bgColor = isIncome ? 'bg-emerald-50' : 'bg-rose-50';

  return (
    <div className="relative group overflow-hidden rounded-2xl border border-slate-50 bg-white p-4 mb-2 transition-all hover:shadow-md">
      {/* Barra de Progresso de Fundo */}
      <div 
        className={`absolute left-0 top-0 h-full transition-all duration-700 opacity-20 ${isIncome ? 'bg-emerald-200' : 'bg-rose-200'}`}
        style={{ width: `${item.percentage}%` }}
      />
      
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bgColor} text-slate-600 shadow-sm`}>
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
          </div>
          <p className="text-sm font-bold text-slate-700">{item.name}</p>
        </div>
        
        <div className="text-right">
          <p className="text-sm font-black text-slate-800" style={{ color: item.percentage > 50 ? '#000' : 'inherit' }}>
            {formatCurrency(item.amount)}
          </p>
          <p className="text-[10px] font-bold text-slate-400">({item.percentage.toFixed(1)}%)</p>
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

  // Processa dados anuais para o gráfico
  const annualData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months.map((m, i) => {
      // Aqui simulamos dados para meses que não são o atual para preencher o gráfico
      // Na vida real, você buscaria transações de todo o ano
      if (i === currentDate.getMonth()) {
        const inc = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const exp = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        return { label: m, income: inc, expense: exp, flow: inc - exp };
      }
      // Mock para visualização fiel ao print
      const mockInc = 3000 + Math.random() * 3000;
      const mockExp = 2000 + Math.random() * 4000;
      return { label: m, income: mockInc, expense: mockExp, flow: mockInc - mockExp };
    });
  }, [transactions, currentDate]);

  const stats = useMemo(() => {
    const income = annualData[currentDate.getMonth()].income;
    const expense = annualData[currentDate.getMonth()].expense;
    const flow = income - expense;
    const saved = income > 0 ? (flow / income) * 100 : 0;
    return { income, expense, flow, saved };
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

  const handlePrevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* HEADER E NAVEGAÇÃO DE DATA */}
      <div className="bg-white rounded-[32px] p-6 border border-slate-50 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
             <button onClick={handlePrevMonth} className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
               <span className="material-symbols-outlined">chevron_left</span>
             </button>
             <h2 className="text-2xl font-black text-slate-800 tracking-tight">
               {new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(currentDate).replace('.', '')}
               <span className="text-slate-300 font-bold ml-2">{currentDate.getFullYear()}</span>
             </h2>
             <button onClick={handleNextMonth} className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
               <span className="material-symbols-outlined">chevron_right</span>
             </button>
          </div>

          <div className="flex gap-2">
            <div className="flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 text-[10px] font-black text-slate-400">
              {new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(currentDate).replace('.', '')} <span className="material-symbols-outlined text-[14px]">close</span>
            </div>
            <div className="bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Acumulado
            </div>
          </div>
        </div>

        {/* FILTROS DO GRÁFICO */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center bg-slate-50 p-1 rounded-2xl border border-slate-100">
            {[
              { id: 'tudo', label: 'Tudo' },
              { id: 'receitas', label: 'Receitas', color: '#10b981' },
              { id: 'despesas', label: 'Despesas', color: '#f43f5e' },
              { id: 'fluxo', label: 'Fluxo', color: '#000' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as AnalysisView)}
                className={`px-5 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-2 ${
                  activeView === tab.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tab.color }} />}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* GRÁFICO ANUAL */}
        <AnnualMixedChart 
          data={annualData} 
          view={activeView} 
          selectedMonthIndex={currentDate.getMonth()} 
        />
      </div>

      {/* CARDS DE RESUMO DO MÊS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'RECEITA', value: formatCurrency(stats.income).replace(',00', ''), color: 'text-primary' },
          { label: 'DESPESAS', value: formatCurrency(stats.expense).replace(',00', ''), color: 'text-rose-500' },
          { label: 'FLUXO', value: formatCurrency(stats.flow).replace(',00', ''), color: 'text-emerald-500' },
          { label: '% SALVO', value: `${stats.saved.toFixed(0)}%`, color: 'text-slate-800' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm text-center">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
             <p className={`text-xl font-black tracking-tighter ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* LISTAS DE RECEITAS E DESPESAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* COLUNA RECEITAS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-black text-slate-800">Receitas</h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">
               <button onClick={() => setIncomeBreakdown('grupos')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${incomeBreakdown === 'grupos' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Grupos</button>
               <button onClick={() => setIncomeBreakdown('categorias')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${incomeBreakdown === 'categorias' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Categorias</button>
            </div>
          </div>
          <div className="space-y-2">
            {getBreakdown('income').map((item, i) => (
              <BreakdownItem key={i} item={item} type="income" />
            ))}
            {getBreakdown('income').length === 0 && <p className="text-center py-10 text-xs font-bold text-slate-300">Nenhuma receita registrada.</p>}
          </div>
        </div>

        {/* COLUNA DESPESAS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-black text-slate-800">Despesas</h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">
               <button onClick={() => setExpenseBreakdown('grupos')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${expenseBreakdown === 'grupos' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Grupos</button>
               <button onClick={() => setExpenseBreakdown('categorias')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${expenseBreakdown === 'categorias' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Categorias</button>
            </div>
          </div>
          <div className="space-y-2">
            {getBreakdown('expense').map((item, i) => (
              <BreakdownItem key={i} item={item} type="expense" />
            ))}
            {getBreakdown('expense').length === 0 && <p className="text-center py-10 text-xs font-bold text-slate-300">Nenhuma despesa registrada.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
