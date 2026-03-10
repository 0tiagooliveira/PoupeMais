
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { incomeCategories, expenseCategories } from '../dashboard/components/NewTransactionModal';
import { Button } from '../../components/ui/Button';
import { GoogleGenAI, Type } from "@google/genai";
import { getIconByCategoryName } from '../../utils/categoryIcons';
import { MonthSelector } from '../dashboard/components/MonthSelector';
import { CategoryChartCard } from '../dashboard/components/CategoryChartCard';
import { Transaction, CategoryData, TransactionType } from '../../types';
import { useNavigate } from 'react-router-dom';

// --- GRÁFICO ANUAL COM INTERATIVIDADE E FILTROS ---
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

  // Configurações do SVG
  const viewBoxWidth = 1000;
  const viewBoxHeight = 350;
  const paddingX = 50; 
  const paddingY = 30;
  const topPadding = 40;

  const chartHeight = viewBoxHeight - paddingY - topPadding;
  const chartWidth = viewBoxWidth - paddingX * 2;

  // Escalas
  const activeValues: number[] = [0];
  if (filters.income) activeValues.push(...data.map(d => d.income));
  if (filters.expense) activeValues.push(...data.map(d => d.expense));
  if (filters.flow) activeValues.push(...data.map(d => d.income - d.expense));
  
  let maxVal = Math.max(...activeValues);
  let minVal = Math.min(...activeValues); 

  if (maxVal === 0 && minVal === 0) maxVal = 1000;
  maxVal = maxVal * 1.1; 
  if (minVal < 0) minVal = minVal * 1.2;

  const range = maxVal - minVal;
  
  const getY = (val: number) => {
    if (range === 0) return topPadding + chartHeight;
    const percentage = (val - minVal) / range; 
    return topPadding + (chartHeight * (1 - percentage));
  };

  const zeroY = getY(0);
  const stepX = chartWidth / (data.length - 1 || 1);
  const getX = (i: number) => paddingX + (i * stepX);
  const barWidth = 16;

  // Grid Lines
  const gridLines = [];
  const gridCount = 5;
  for (let i = 0; i <= gridCount; i++) {
    const val = minVal + (range * (i / gridCount));
    gridLines.push(val);
  }

  // Linha de Fluxo
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

  const activeIndex = hoveredIndex;
  const activeData = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div ref={containerRef} className="w-full bg-white dark:bg-slate-900 rounded-[32px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative group select-none transition-colors">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
         <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Panorama Anual</h3>
         <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl overflow-x-auto max-w-full">
            <button onClick={() => setFilters({ income: true, expense: true, flow: true })} className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-600 hover:bg-slate-50">Tudo</button>
            <button onClick={() => toggleFilter('income')} className={`px-3 py-1.5 flex items-center gap-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${filters.income ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-600' : 'text-slate-400 opacity-60 hover:opacity-100'}`}><span className={`w-2 h-2 rounded-full ${filters.income ? 'bg-[#10B981]' : 'bg-slate-300'}`}></span> Receitas</button>
            <button onClick={() => toggleFilter('expense')} className={`px-3 py-1.5 flex items-center gap-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${filters.expense ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-600' : 'text-slate-400 opacity-60 hover:opacity-100'}`}><span className={`w-2 h-2 rounded-full ${filters.expense ? 'bg-[#F43F5E]' : 'bg-slate-300'}`}></span> Despesas</button>
            <button onClick={() => toggleFilter('flow')} className={`px-3 py-1.5 flex items-center gap-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${filters.flow ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-600' : 'text-slate-400 opacity-60 hover:opacity-100'}`}><span className={`w-2 h-2 rounded-full ${filters.flow ? 'bg-slate-800 dark:bg-slate-400' : 'bg-slate-300'}`}></span> Fluxo</button>
         </div>
      </div>

      <div className="w-full relative">
        <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto overflow-visible touch-pan-x">
             <g className="grid-lines">
               {gridLines.map((val, i) => {
                 const y = getY(val);
                 return (
                   <g key={`grid-${i}`}>
                     <line x1={paddingX} y1={y} x2={viewBoxWidth - 20} y2={y} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" strokeDasharray="4 4" />
                     <text x={paddingX - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-medium">{formatCurrency(val).replace(',00', '')}</text>
                   </g>
                 );
               })}
             </g>
             <line x1={paddingX} y1={zeroY} x2={viewBoxWidth - 20} y2={zeroY} stroke="currentColor" className="text-slate-400 dark:text-slate-500" strokeWidth="1" />
             {data.map((d, i) => {
               const x = getX(i);
               const yIncome = getY(d.income);
               const yExpense = getY(d.expense);
               const isHovered = hoveredIndex === i;
               const isSelected = selectedMonthIndex === i;
               const incomeColor = isHovered || isSelected ? '#10B981' : '#A7F3D0';
               const expenseColor = isHovered || isSelected ? '#F43F5E' : '#FECACA';
               const opacity = (hoveredIndex !== null && !isHovered) ? 0.6 : 1;
               return (
                 <g key={`bars-${i}`} style={{ opacity, transition: 'opacity 0.2s' }}>
                    {filters.expense && <rect x={x - barWidth - 2} y={yExpense} width={barWidth} height={Math.max(0, zeroY - yExpense)} fill={expenseColor} rx="3" ry="3" className="transition-colors duration-200" />}
                    {filters.income && <rect x={x + 2} y={yIncome} width={barWidth} height={Math.max(0, zeroY - yIncome)} fill={incomeColor} rx="3" ry="3" className="transition-colors duration-200" />}
                 </g>
               );
             })}
             {filters.flow && <path d={pathD} fill="none" stroke="currentColor" className="text-slate-800 dark:text-slate-400" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />}
             {data.map((d, i) => {
                const x = getX(i);
                const yFlow = getY(d.income - d.expense);
                const isHovered = hoveredIndex === i;
                const isSelected = selectedMonthIndex === i;
                return (
                  <g key={`points-${i}`}>
                    {isHovered && <line x1={x} y1={topPadding} x2={x} y2={viewBoxHeight - paddingY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" className="pointer-events-none" />}
                    {filters.flow && <circle cx={x} cy={yFlow} r={isHovered ? 5 : 3} fill="currentColor" className="text-slate-800 dark:text-slate-400" stroke="white" strokeWidth="2" style={{ transition: 'all 0.2s', pointerEvents: 'none' }} />}
                    <text x={x} y={viewBoxHeight - 5} textAnchor="middle" className={`text-[12px] font-bold transition-colors duration-200 ${isHovered || isSelected ? 'fill-slate-800 dark:fill-slate-200' : 'fill-slate-400'}`}>{d.label}</text>
                  </g>
                );
             })}
             {data.map((_, i) => {
               const x = getX(i);
               return <rect key={`hit-${i}`} x={x - stepX / 2} y={0} width={stepX} height={viewBoxHeight} fill="transparent" className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} onClick={() => { setHoveredIndex(i); onMonthClick(i); }} />;
             })}
          </svg>
          {activeData && activeIndex !== null && (
             <div className="absolute z-20 pointer-events-none animate-in fade-in zoom-in-95 duration-150" style={{ left: `${((getX(activeIndex)) / viewBoxWidth) * 100}%`, top: 0, transform: 'translateX(-50%) translateY(10px)' }}>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 min-w-[140px]">
                   <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 border-b border-slate-50 dark:border-slate-700 pb-1.5 text-center">{activeData.label}</p>
                   <div className="space-y-1.5">
                      {filters.income && <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Rec.</span></div><span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{formatCurrency(activeData.income)}</span></div>}
                      {filters.expense && <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]"></div><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Desp.</span></div><span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{formatCurrency(activeData.expense)}</span></div>}
                      {filters.flow && <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-slate-50 dark:border-slate-700 mt-1"><div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-slate-400"></div><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Fluxo</span></div><span className={`text-[11px] font-black ${(activeData.income - activeData.expense) >= 0 ? 'text-[#059669]' : 'text-rose-500'}`}>{formatCurrency(activeData.income - activeData.expense)}</span></div>}
                   </div>
                </div>
                <div className="w-2.5 h-2.5 bg-white dark:bg-slate-800 border-r border-b border-slate-100 dark:border-slate-700 transform rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1 shadow-sm"></div>
             </div>
          )}
      </div>
    </div>
  );
};

const AICommentBubble: React.FC<{ text?: string, loading?: boolean, type?: 'success' | 'warning' | 'neutral', label: string }> = ({ text, loading, type = 'neutral', label }) => {
  if (!text && !loading) return null;
  const colors = { success: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800', warning: 'bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300 border-rose-100 dark:border-rose-800', neutral: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800' };
  return (
    <div className={`mt-4 p-4 rounded-2xl border ${colors[type]} relative animate-in fade-in slide-in-from-bottom-2`}>
        <div className="absolute -top-3 left-4 bg-white dark:bg-slate-900 rounded-full px-2 py-0.5 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-1"><span className="material-symbols-outlined text-xs bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">auto_awesome</span><span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">{label}</span></div>
        {loading ? <div className="flex gap-1 h-5 items-center justify-center py-2"><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></div><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></div></div> : <p className="text-xs font-medium leading-relaxed">"{text}"</p>}
    </div>
  );
};

export const ChartsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [currentYearDate, setCurrentYearDate] = useState(new Date());
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [annualInsight, setAnnualInsight] = useState('');
  const [loadingAnnualInsight, setLoadingAnnualInsight] = useState(false);
  const { transactions: annualTransactions, loading: loadingTransactions } = useTransactions(currentYearDate, 'year');
  
  const shouldIncludeInAnalysis = (t: Transaction) => {
    if (t.isIgnored) return false;
    const cleanDesc = t.description.toLowerCase();
    const cleanCat = t.category.toLowerCase();
    const isCreditCardPayment = cleanCat.includes('pagamento de cartão') || cleanCat.includes('fatura') || cleanDesc.includes('pagamento de fatura') || (cleanDesc.includes('fatura') && (cleanDesc.includes('cartão') || cleanDesc.includes('card') || cleanDesc.includes('nubank') || cleanDesc.includes('itau')));
    if (isCreditCardPayment) return false;
    return true;
  };
  
  const monthlyTransactions = useMemo(() => {
    return annualTransactions.filter(t => {
       const tDate = new Date(t.date);
       return tDate.getMonth() === currentMonthDate.getMonth() && tDate.getFullYear() === currentMonthDate.getFullYear();
    });
  }, [annualTransactions, currentMonthDate]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiComments, setAiComments] = useState<{ general?: string; income?: string; expense?: string; }>({});

  useEffect(() => { setAiComments({}); }, [currentMonthDate]);

  const annualData = useMemo(() => {
    const monthsData = Array(12).fill(0).map(() => ({ income: 0, expense: 0 }));
    annualTransactions.forEach(t => {
      if (!shouldIncludeInAnalysis(t)) return;
      const tDate = new Date(t.date);
      const m = tDate.getMonth();
      if (t.type === 'income') monthsData[m].income += t.amount;
      else monthsData[m].expense += t.amount;
    });
    return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => ({ label: m, income: monthsData[i].income, expense: monthsData[i].expense }));
  }, [annualTransactions]);

  useEffect(() => {
    if (loadingTransactions || !currentUser?.isPro || annualTransactions.length === 0) return;
    const totalInc = annualTransactions.reduce((acc, t) => shouldIncludeInAnalysis(t) && t.type === 'income' ? acc + t.amount : acc, 0);
    const totalExp = annualTransactions.reduce((acc, t) => shouldIncludeInAnalysis(t) && t.type === 'expense' ? acc + t.amount : acc, 0);
    if (totalInc === 0 && totalExp === 0) return;
    const fetchAnnualInsight = async () => {
        setLoadingAnnualInsight(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Atue como o Poup+, um consultor financeiro pessoal. Dados do ano de ${currentYearDate.getFullYear()}: Receitas Totais: R$ ${totalInc.toFixed(2)}, Despesas Totais: R$ ${totalExp.toFixed(2)}. Gere uma frase de impacto (máximo 15 palavras) resumindo o desempenho anual.`;
            const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ parts: [{ text: prompt }] }] });
            setAnnualInsight(response.text?.trim() || `Análise de ${currentYearDate.getFullYear()} pronta.`);
        } catch (error) { console.error("Erro IA Insight Anual:", error); } finally { setLoadingAnnualInsight(false); }
    };
    const timer = setTimeout(fetchAnnualInsight, 1000);
    return () => clearTimeout(timer);
  }, [annualTransactions, currentYearDate, currentUser, loadingTransactions]);

  const handleMonthClick = (monthIndex: number) => {
    const newDate = new Date(currentYearDate.getFullYear(), monthIndex, 1);
    setCurrentMonthDate(newDate);
  };

  const handleCategoryClick = (category: CategoryData, type: TransactionType) => {
    navigate('/transactions', { state: { category: category.name, type: type } });
  };

  const monthStats = useMemo(() => {
    let income = 0; let expense = 0; const incCats = new Map<string, number>(); const expCats = new Map<string, number>();
    monthlyTransactions.forEach(t => {
      if (!shouldIncludeInAnalysis(t)) return;
      if (t.type === 'income') { income += t.amount; incCats.set(t.category, (incCats.get(t.category) || 0) + t.amount); } else { expense += t.amount; expCats.set(t.category, (expCats.get(t.category) || 0) + t.amount); }
    });
    const formatCats = (map: Map<string, number>, type: 'income' | 'expense') => {
        const palette = type === 'income' ? ['#21C25E', '#10B981', '#34D399', '#059669', '#6EE7B7'] : ['#EF4444', '#B91C1C', '#F87171', '#991B1B', '#FCA5A5'];
        return Array.from(map.entries()).map(([name, amount], index) => ({ id: name, name, amount, color: palette[index % palette.length], icon: getIconByCategoryName(name) })).sort((a, b) => b.amount - a.amount);
    };
    return { income, expense, result: income - expense, incomeCats: formatCats(incCats, 'income'), expenseCats: formatCats(expCats, 'expense') };
  }, [monthlyTransactions]);

  const handleAnalyze = async () => {
    if (!currentUser?.isPro) return;
    setIsAnalyzing(true); setAiComments({});
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Você é a IA do Poup+. Analise: 1. Rec: R$ ${monthStats.income.toFixed(2)} 2. Desp: R$ ${monthStats.expense.toFixed(2)} 3. Balanço: R$ ${monthStats.result.toFixed(2)}. JSON com keys: income, expense, general. Comentários curtos (1 frase).`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ parts: [{ text: prompt }] }], config: { responseMimeType: "application/json" } });
        setAiComments(JSON.parse(response.text || "{}"));
    } catch (error) { console.error("Erro IA:", error); } finally { setIsAnalyzing(false); }
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="space-y-4">
         <div className="flex justify-between items-center px-4 py-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
            <button onClick={() => setCurrentYearDate(new Date(currentYearDate.getFullYear()-1, 0, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors group"><span className="material-symbols-outlined text-slate-400 group-hover:text-primary">arrow_back</span></button>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter cursor-default">{currentYearDate.getFullYear()}</h2>
            <button onClick={() => setCurrentYearDate(new Date(currentYearDate.getFullYear()+1, 0, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors group"><span className="material-symbols-outlined text-slate-400 group-hover:text-primary">arrow_forward</span></button>
         </div>

         {(annualInsight || loadingAnnualInsight) && currentUser?.isPro && (
            <button onClick={() => navigate('/ai-analysis')} className="w-full bg-white dark:bg-slate-900 p-5 rounded-[28px] shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-5 transition-all hover:shadow-md hover:border-primary/20 group text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-[100px] pointer-events-none transition-transform group-hover:scale-110"></div>
                <div className="relative shrink-0">
                    <div className="h-14 w-14 rounded-[20px] bg-gradient-to-br from-emerald-50 to-white dark:from-slate-800 dark:to-slate-700 border border-emerald-100 dark:border-slate-600 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"><span className={`material-symbols-outlined text-2xl text-primary ${loadingAnnualInsight ? 'animate-bounce' : ''}`}>savings</span></div>
                    <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-50 dark:border-slate-700"><span className="flex h-2.5 w-2.5 rounded-full bg-primary animate-pulse"></span></div>
                </div>
                <div className="flex-1 min-w-0 z-10">
                    <div className="flex items-center gap-2 mb-1"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Poup+ Intelligence</span>{!loadingAnnualInsight && annualInsight && <span className="h-1.5 w-1.5 rounded-full bg-primary/40"></span>}</div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-snug line-clamp-2">{loadingAnnualInsight ? `Analisando seu ano de ${currentYearDate.getFullYear()}...` : annualInsight}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shrink-0 z-10"><span className="material-symbols-outlined text-xl">arrow_forward</span></div>
            </button>
         )}

         <AnnualMixedChart data={annualData} selectedMonthIndex={currentMonthDate.getMonth()} onMonthClick={handleMonthClick} />
      </div>

      <div className="flex items-center gap-4"><div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div><span className="text-xs font-black text-slate-400 uppercase tracking-widest">Análise Detalhada</span><div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div></div>

      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-2 flex flex-col md:flex-row items-center justify-between gap-4">
         <div className="bg-white dark:bg-slate-900 p-1.5 rounded-[20px] shadow-sm border border-slate-100 dark:border-slate-800"><MonthSelector currentDate={currentMonthDate} onMonthChange={setCurrentMonthDate} /></div>
         <Button onClick={handleAnalyze} disabled={isAnalyzing || !currentUser?.isPro} className={`rounded-2xl font-bold shadow-lg transition-all ${currentUser?.isPro ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:scale-105' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
            {isAnalyzing ? <span className="flex items-center gap-2"><span className="material-symbols-outlined animate-spin">sync</span> Analisando...</span> : <span className="flex items-center gap-2"><span className="material-symbols-outlined">auto_awesome</span> Comentar Mês com IA</span>}
         </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="space-y-4"><CategoryChartCard title="Entradas do Mês" type="income" categories={monthStats.incomeCats} total={monthStats.income} onCategoryClick={(cat) => handleCategoryClick(cat, 'income')} /><AICommentBubble text={aiComments.income} loading={isAnalyzing} type="success" label="IA sobre Entradas" /></div>
         <div className="space-y-4"><CategoryChartCard title="Saídas do Mês" type="expense" categories={monthStats.expenseCats} total={monthStats.expense} onCategoryClick={(cat) => handleCategoryClick(cat, 'expense')} /><AICommentBubble text={aiComments.expense} loading={isAnalyzing} type="warning" label="IA sobre Saídas" /></div>
      </div>

      <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden">
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Balanço Líquido ({new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(currentMonthDate)})</p>
                <div className="flex items-baseline gap-2"><span className={`text-4xl font-black tracking-tighter ${monthStats.result >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(monthStats.result)}</span>{monthStats.income > 0 && <span className="text-xs font-bold bg-white/10 px-2 py-1 rounded-lg text-white/80">{((monthStats.result / monthStats.income) * 100).toFixed(0)}% poupado</span>}</div>
            </div>
            {(aiComments.general || isAnalyzing) && (<div className="md:max-w-xs bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10"><div className="flex items-center gap-2 mb-2"><span className="material-symbols-outlined text-xs text-indigo-300">savings</span><span className="text-[9px] font-bold text-indigo-200 uppercase">Veredito da IA</span></div>{isAnalyzing ? <div className="h-4 w-24 bg-white/10 rounded animate-pulse"></div> : <p className="text-xs font-medium leading-relaxed text-indigo-50">"{aiComments.general}"</p>}</div>)}
         </div>
         <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-white/5 text-[150px] rotate-12">account_balance_wallet</span>
      </div>
    </div>
  );
};
