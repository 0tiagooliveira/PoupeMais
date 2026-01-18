
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { incomeCategories, expenseCategories } from '../dashboard/components/NewTransactionModal';
import { Button } from '../../components/ui/Button';
import { GoogleGenAI } from "@google/genai";
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

  // Configurações do SVG (ViewBox Fixo, mas renderizado responsivamente via CSS)
  const viewBoxWidth = 1000;
  const viewBoxHeight = 350;
  const paddingX = 50; 
  const paddingY = 30;
  const topPadding = 40;

  const chartHeight = viewBoxHeight - paddingY - topPadding;
  const chartWidth = viewBoxWidth - paddingX * 2;

  // 1. Calcular Escalas dinâmicas baseadas nos filtros ativos
  const activeValues: number[] = [0]; // Inicializa com 0 para evitar erros se tudo estiver desmarcado
  if (filters.income) activeValues.push(...data.map(d => d.income));
  if (filters.expense) activeValues.push(...data.map(d => d.expense));
  if (filters.flow) activeValues.push(...data.map(d => d.income - d.expense));
  
  // Definir limites (Max e Min) para o eixo Y
  let maxVal = Math.max(...activeValues);
  let minVal = Math.min(...activeValues); 

  // Ajustes de margem para o gráfico não tocar nas bordas
  if (maxVal === 0 && minVal === 0) maxVal = 1000; // Valor padrão se vazio
  maxVal = maxVal * 1.1; 
  if (minVal < 0) minVal = minVal * 1.2;

  const range = maxVal - minVal;
  
  // Função Y: Valor -> Pixel
  const getY = (val: number) => {
    if (range === 0) return topPadding + chartHeight;
    const percentage = (val - minVal) / range; 
    return topPadding + (chartHeight * (1 - percentage));
  };

  const zeroY = getY(0);

  // Função X: Índice -> Pixel
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
      {/* Cabeçalho / Legenda Interativa */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
         <h3 className="text-sm font-bold text-slate-700">Panorama Anual</h3>
         
         {/* Botões de Filtro */}
         <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl overflow-x-auto max-w-full">
            <button 
                onClick={() => setFilters({ income: true, expense: true, flow: true })}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap bg-white shadow-sm text-slate-800 border border-slate-100 hover:bg-slate-50"
            >
              Tudo
            </button>
            <button 
                onClick={() => toggleFilter('income')}
                className={`px-3 py-1.5 flex items-center gap-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${filters.income ? 'bg-white shadow-sm text-slate-700 border border-slate-100' : 'text-slate-400 opacity-60 hover:opacity-100'}`}
            >
              <span className={`w-2 h-2 rounded-full ${filters.income ? 'bg-[#10B981]' : 'bg-slate-300'}`}></span> Receitas
            </button>
            <button 
                onClick={() => toggleFilter('expense')}
                className={`px-3 py-1.5 flex items-center gap-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${filters.expense ? 'bg-white shadow-sm text-slate-700 border border-slate-100' : 'text-slate-400 opacity-60 hover:opacity-100'}`}
            >
              <span className={`w-2 h-2 rounded-full ${filters.expense ? 'bg-[#F43F5E]' : 'bg-slate-300'}`}></span> Despesas
            </button>
            <button 
                onClick={() => toggleFilter('flow')}
                className={`px-3 py-1.5 flex items-center gap-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${filters.flow ? 'bg-white shadow-sm text-slate-700 border border-slate-100' : 'text-slate-400 opacity-60 hover:opacity-100'}`}
            >
              <span className={`w-2 h-2 rounded-full ${filters.flow ? 'bg-slate-800' : 'bg-slate-300'}`}></span> Fluxo
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

             {/* HIT AREAS (Retângulos Invisíveis Largos para Interação) */}
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

          {/* TOOLTIP FLUTUANTE HTML (Posicionado via style relativo ao container do gráfico) */}
          {activeData && activeIndex !== null && (
             <div 
               className="absolute z-20 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
               style={{ 
                 // Cálculo de porcentagem para posicionar o tooltip responsivamente
                 left: `${((getX(activeIndex)) / viewBoxWidth) * 100}%`,
                 top: 0,
                 transform: 'translateX(-50%) translateY(10px)'
               }}
             >
                <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-100 min-w-[140px]">
                   <p className="text-xs font-bold text-slate-800 mb-2 border-b border-slate-50 pb-1.5 text-center">
                     {activeData.label}
                   </p>
                   
                   <div className="space-y-1.5">
                      {filters.income && (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div>
                                <span className="text-[10px] font-bold text-slate-500">Rec.</span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-700">{formatCurrency(activeData.income)}</span>
                          </div>
                      )}

                      {filters.expense && (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]"></div>
                                <span className="text-[10px] font-bold text-slate-500">Desp.</span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-700">{formatCurrency(activeData.expense)}</span>
                          </div>
                      )}

                      {filters.flow && (
                          <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-slate-50 mt-1">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                                <span className="text-[10px] font-bold text-slate-500">Fluxo</span>
                            </div>
                            <span className={`text-[11px] font-black ${(activeData.income - activeData.expense) >= 0 ? 'text-[#059669]' : 'text-rose-500'}`}>
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

// --- BALÃO DE COMENTÁRIO DA IA (Mantido Igual) ---
const AICommentBubble: React.FC<{ text?: string, loading?: boolean, type?: 'success' | 'warning' | 'neutral', label: string }> = ({ text, loading, type = 'neutral', label }) => {
  if (!text && !loading) return null;

  const colors = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    warning: 'bg-rose-50 text-rose-800 border-rose-100',
    neutral: 'bg-indigo-50 text-indigo-800 border-indigo-100'
  };

  return (
    <div className={`mt-4 p-4 rounded-2xl border ${colors[type]} relative animate-in fade-in slide-in-from-bottom-2`}>
        <div className="absolute -top-3 left-4 bg-white rounded-full px-2 py-0.5 shadow-sm border border-slate-100 flex items-center gap-1">
             <span className="material-symbols-outlined text-xs bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">auto_awesome</span>
             <span className="text-[9px] font-bold text-slate-500 uppercase">{label}</span>
        </div>
        {loading ? (
             <div className="flex gap-1 h-5 items-center justify-center py-2">
                 <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></div>
                 <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></div>
                 <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></div>
             </div>
        ) : (
             <p className="text-xs font-medium leading-relaxed">
                 "{text}"
             </p>
        )}
    </div>
  );
};

export const ChartsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [currentYearDate, setCurrentYearDate] = useState(new Date());
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  
  // Dados Anuais (apenas para o gráfico do topo)
  const { transactions: annualTransactions } = useTransactions(currentYearDate, 'year');
  
  // LÓGICA DE FILTRAGEM DE ANÁLISE
  const shouldIncludeInAnalysis = (t: Transaction) => {
    if (t.isIgnored) return false;

    const cleanDesc = t.description.toLowerCase();
    const cleanCat = t.category.toLowerCase();

    const isCreditCardPayment = 
        cleanCat.includes('pagamento de cartão') || 
        cleanCat.includes('fatura') ||
        cleanDesc.includes('pagamento de fatura') ||
        (cleanDesc.includes('fatura') && (cleanDesc.includes('cartão') || cleanDesc.includes('card') || cleanDesc.includes('nubank') || cleanDesc.includes('itau')));

    if (isCreditCardPayment) return false;

    return true;
  };
  
  // Dados Mensais para análise focada
  const monthlyTransactions = useMemo(() => {
    return annualTransactions.filter(t => {
       const tDate = new Date(t.date);
       return tDate.getMonth() === currentMonthDate.getMonth() && 
              tDate.getFullYear() === currentMonthDate.getFullYear();
    });
  }, [annualTransactions, currentMonthDate]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiComments, setAiComments] = useState<{
    general?: string;
    income?: string;
    expense?: string;
  }>({});

  // Efeito para limpar comentários ao trocar o mês
  useEffect(() => {
    setAiComments({});
  }, [currentMonthDate]);

  // Preparação de dados Anuais (Filtrados)
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

  // Handler para clique no gráfico anual
  const handleMonthClick = (monthIndex: number) => {
    const newDate = new Date(currentYearDate.getFullYear(), monthIndex, 1);
    setCurrentMonthDate(newDate);
  };

  const handleCategoryClick = (category: CategoryData, type: TransactionType) => {
    navigate('/transactions', { 
      state: { 
        category: category.name, 
        type: type 
      } 
    });
  };

  // Preparação de dados Mensais (Filtrados)
  const monthStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    const incCats = new Map<string, number>();
    const expCats = new Map<string, number>();

    monthlyTransactions.forEach(t => {
      if (!shouldIncludeInAnalysis(t)) return;

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
  }, [monthlyTransactions]);

  const handleAnalyze = async () => {
    if (!currentUser?.isPro) return;
    setIsAnalyzing(true);
    setAiComments({}); 

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `
            Você é a IA do Poup+. Analise APENAS os dados deste mês de ${new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(currentMonthDate)}:
            
            1. Receitas Totais: R$ ${monthStats.income.toFixed(2)}
               Principais Fontes: ${monthStats.incomeCats.slice(0,3).map(c => `${c.name} (${c.amount})`).join(', ')}
            
            2. Despesas Totais: R$ ${monthStats.expense.toFixed(2)}
               Maiores Gastos: ${monthStats.expenseCats.slice(0,3).map(c => `${c.name} (${c.amount})`).join(', ')}
            
            3. Balanço Final: R$ ${monthStats.result.toFixed(2)}

            Gere um JSON com 3 comentários curtos (máximo 1 frase cada) e diretos para o usuário:
            {
                "income": "Comentário sobre as receitas (elogie se for bom, ou sugira diversificação)",
                "expense": "Comentário sobre os gastos (alerte sobre a categoria mais alta se necessário)",
                "general": "Comentário final sobre o resultado do mês (saldo positivo/negativo)"
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });

        const text = response.text || "{}";
        const json = JSON.parse(text.replace(/```json|```/g, '').trim());
        setAiComments(json);

    } catch (error) {
        console.error("Erro IA:", error);
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500">
      {/* 1. Contexto Anual (Design Novo) */}
      <div className="space-y-4">
         <div className="flex justify-between items-center px-2">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">{currentYearDate.getFullYear()}</h2>
            <div className="flex gap-2">
                <button onClick={() => setCurrentYearDate(new Date(currentYearDate.getFullYear()-1, 0, 1))} className="p-1 hover:bg-slate-50 rounded-full"><span className="material-symbols-outlined text-slate-400">chevron_left</span></button>
                <button onClick={() => setCurrentYearDate(new Date(currentYearDate.getFullYear()+1, 0, 1))} className="p-1 hover:bg-slate-50 rounded-full"><span className="material-symbols-outlined text-slate-400">chevron_right</span></button>
            </div>
         </div>
         <AnnualMixedChart 
            data={annualData} 
            selectedMonthIndex={currentMonthDate.getMonth()} 
            onMonthClick={handleMonthClick}
         />
      </div>

      <div className="flex items-center gap-4">
         <div className="h-px bg-slate-200 flex-1"></div>
         <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Análise Detalhada</span>
         <div className="h-px bg-slate-200 flex-1"></div>
      </div>

      {/* 2. Filtro de Mês + Botão de Análise IA */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-2 flex flex-col md:flex-row items-center justify-between gap-4">
         <div className="bg-white p-1.5 rounded-[20px] shadow-sm border border-slate-100">
            <MonthSelector currentDate={currentMonthDate} onMonthChange={setCurrentMonthDate} />
         </div>
         
         <Button 
            onClick={handleAnalyze}
            disabled={isAnalyzing || !currentUser?.isPro}
            className={`rounded-2xl font-bold shadow-lg transition-all ${currentUser?.isPro ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:scale-105' : 'bg-slate-100 text-slate-400'}`}
         >
            {isAnalyzing ? (
                <span className="flex items-center gap-2"><span className="material-symbols-outlined animate-spin">sync</span> Analisando dados...</span>
            ) : (
                <span className="flex items-center gap-2"><span className="material-symbols-outlined">auto_awesome</span> Comentar Mês com IA</span>
            )}
         </Button>
      </div>

      {/* 3. Colunas de Análise (Rosquinhas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Receitas */}
         <div className="space-y-4">
             <CategoryChartCard 
                title="Entradas do Mês" 
                type="income" 
                categories={monthStats.incomeCats} 
                total={monthStats.income} 
                onCategoryClick={(cat) => handleCategoryClick(cat, 'income')}
             />
             <AICommentBubble text={aiComments.income} loading={isAnalyzing} type="success" label="IA sobre Entradas" />
         </div>

         {/* Despesas */}
         <div className="space-y-4">
             <CategoryChartCard 
                title="Saídas do Mês" 
                type="expense" 
                categories={monthStats.expenseCats} 
                total={monthStats.expense}
                onCategoryClick={(cat) => handleCategoryClick(cat, 'expense')} 
             />
             <AICommentBubble text={aiComments.expense} loading={isAnalyzing} type="warning" label="IA sobre Saídas" />
         </div>
      </div>

      {/* 4. Resultado Geral */}
      <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden">
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Balanço Líquido ({new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(currentMonthDate)})</p>
                <div className="flex items-baseline gap-2">
                    <span className={`text-4xl font-black tracking-tighter ${monthStats.result >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(monthStats.result)}
                    </span>
                    {monthStats.income > 0 && (
                        <span className="text-xs font-bold bg-white/10 px-2 py-1 rounded-lg text-white/80">
                            {((monthStats.result / monthStats.income) * 100).toFixed(0)}% poupado
                        </span>
                    )}
                </div>
            </div>
            {/* Balão de comentário geral da IA integrado */}
            {(aiComments.general || isAnalyzing) && (
                <div className="md:max-w-xs bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                   <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-xs text-indigo-300">savings</span>
                      <span className="text-[9px] font-bold text-indigo-200 uppercase">Veredito da IA</span>
                   </div>
                   {isAnalyzing ? (
                       <div className="h-4 w-24 bg-white/10 rounded animate-pulse"></div>
                   ) : (
                       <p className="text-xs font-medium leading-relaxed text-indigo-50">"{aiComments.general}"</p>
                   )}
                </div>
            )}
         </div>
         <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-white/5 text-[150px] rotate-12">account_balance_wallet</span>
      </div>
    </div>
  );
};
