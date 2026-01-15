
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency } from '../../utils/formatters';
import { BackButton } from '../../components/ui/BackButton';
import { MonthSelector } from '../dashboard/components/MonthSelector';
import { incomeCategories, expenseCategories } from '../dashboard/components/NewTransactionModal';

type ChartTab = 'categories' | 'performance' | 'radar' | 'projection';
type AccumulationType = 'income' | 'expense';

// Função para tentar adivinhar ícone de categorias antigas ou importadas
const getIconForLegacy = (name: string) => {
  const lower = name.toLowerCase();
  
  // Categorias de Despesas
  if (lower.includes('comida') || lower.includes('lanche') || lower.includes('food') || lower.includes('restaurante') || lower.includes('ifood') || lower.includes('alimentação')) return 'restaurant';
  if (lower.includes('mercado') || lower.includes('supermercado')) return 'shopping_cart';
  if (lower.includes('compra') || lower.includes('shopping') || lower.includes('loja') || lower.includes('online') || lower.includes('shein') || lower.includes('amazon')) return 'shopping_bag';
  if (lower.includes('transporte') || lower.includes('uber') || lower.includes('99') || lower.includes('taxi')) return 'directions_car';
  if (lower.includes('carro') || lower.includes('posto') || lower.includes('combustível') || lower.includes('gasolina')) return 'local_gas_station';
  if (lower.includes('casa') || lower.includes('aluguel') || lower.includes('condominio') || lower.includes('moradia')) return 'home';
  if (lower.includes('saude') || lower.includes('medico') || lower.includes('farmacia') || lower.includes('drogaria')) return 'medical_services';
  if (lower.includes('educação') || lower.includes('curso') || lower.includes('escola') || lower.includes('faculdade')) return 'school';
  if (lower.includes('lazer') || lower.includes('jogo') || lower.includes('cinema') || lower.includes('diversão')) return 'sports_esports';
  if (lower.includes('viagem') || lower.includes('férias') || lower.includes('passagem')) return 'flight';
  if (lower.includes('assinatura') || lower.includes('netflix') || lower.includes('spotify') || lower.includes('stream')) return 'subscriptions';
  if (lower.includes('imposto') || lower.includes('taxa') || lower.includes('tributo')) return 'gavel';
  if (lower.includes('presente')) return 'card_giftcard';
  if (lower.includes('pet') || lower.includes('veterinário') || lower.includes('cachorro') || lower.includes('gato')) return 'pets';
  if (lower.includes('manutenção') || lower.includes('conserto') || lower.includes('reparo')) return 'build';
  if (lower.includes('telefone') || lower.includes('celular') || lower.includes('internet')) return 'smartphone';
  if (lower.includes('energia') || lower.includes('luz') || lower.includes('eletricidade')) return 'bolt';
  if (lower.includes('água') || lower.includes('esgoto')) return 'water_drop';
  if (lower.includes('gás')) return 'propane';
  if (lower.includes('bem-estar') || lower.includes('academia') || lower.includes('beleza') || lower.includes('cabelo')) return 'spa';
  if (lower.includes('empréstimo') || lower.includes('divida')) return 'handshake';
  if (lower.includes('vestiário') || lower.includes('roupa') || lower.includes('moda')) return 'checkroom';
  if (lower.includes('beleza') || lower.includes('estetica')) return 'face';
  
  // Categorias de Receitas
  if (lower.includes('salario') || lower.includes('pagamento')) return 'payments';
  if (lower.includes('freelance') || lower.includes('extra')) return 'computer';
  if (lower.includes('bônus') || lower.includes('bonus')) return 'stars';
  if (lower.includes('invest') || lower.includes('aplicação')) return 'show_chart';
  if (lower.includes('dividendo')) return 'pie_chart';
  if (lower.includes('juros')) return 'percent';
  if (lower.includes('cashback')) return 'currency_exchange';
  if (lower.includes('reembolso') || lower.includes('estorno')) return 'undo';
  if (lower.includes('transfer') || lower.includes('pix')) return 'sync_alt';
  if (lower.includes('poupança') || lower.includes('reserva')) return 'savings';
  if (lower.includes('décimo') || lower.includes('13')) return 'calendar_month';
  if (lower.includes('resgate')) return 'move_to_inbox';

  return 'category'; // Padrão
};

interface DonutChartProps {
  data: any[];
  total: number;
  selectedName: string | null;
  onSelect: (name: string | null) => void;
}

const DonutChart: React.FC<DonutChartProps> = ({ data, total, selectedName, onSelect }) => {
  const size = 200;
  const strokeWidth = 20;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full transform -rotate-90">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={strokeWidth}
      />
      {total > 0 && data.map((cat, i) => {
        const percentage = Math.max(0, cat.amount / total);
        const strokeDasharray = `${percentage * circumference} ${circumference}`;
        const strokeDashoffset = -currentOffset;
        currentOffset += percentage * circumference;

        if (percentage < 0.005) return null;

        const isSelected = selectedName === cat.name;

        return (
          <circle
            key={cat.name}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={cat.color}
            strokeWidth={strokeWidth + (isSelected ? 6 : 0)}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`transition-all duration-300 cursor-pointer ${isSelected ? 'opacity-100' : (selectedName ? 'opacity-30' : 'opacity-100')}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(isSelected ? null : cat.name);
            }}
          />
        );
      })}
    </svg>
  );
};

interface FlowLineChartProps {
  data: any[];
  type: 'income' | 'expense';
  onFocus: (item: any) => void;
}

const FlowLineChart: React.FC<FlowLineChartProps> = ({ data, type, onFocus }) => {
  if (!data || data.length === 0) return null;
  
  const width = 1000;
  const height = 300;
  const padding = 20;
  const maxValue = Math.max(...data.map(d => d.value), 100);
  
  const getX = (i: number) => {
    if (data.length <= 1) return width / 2;
    return (i / (data.length - 1)) * (width - 2 * padding) + padding;
  };

  const points = data.map((d, i) => {
    const x = getX(i);
    const y = height - ((d.value / maxValue) * (height - 2 * padding)) - padding;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${points} ${width - padding},${height} ${padding},${height}`;
  const color = type === 'income' ? '#10B981' : '#EF4444';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`gradient-${type}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {data.length > 1 && (
         <polygon points={areaPoints} fill={`url(#gradient-${type})`} />
      )}
      
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Invisible interaction layer */}
      {data.map((d, i) => {
        const x = getX(i);
        const y = height - ((d.value / maxValue) * (height - 2 * padding)) - padding;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="12"
            fill="transparent"
            className="cursor-pointer"
            onClick={() => onFocus(d)}
          />
        );
      })}
    </svg>
  );
};

interface RadarChartWithLabelsProps {
  data: any[];
}

const RadarChartWithLabels: React.FC<RadarChartWithLabelsProps> = ({ data }) => {
  const size = 300;
  const center = size / 2;
  const radius = 100;
  const angleSlice = (Math.PI * 2) / data.length;

  const getCoordinates = (percent: number, i: number) => {
    const angle = i * angleSlice - Math.PI / 2;
    const r = (percent / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return [x, y];
  };

  const pathPoints = data.map((d, i) => getCoordinates(d.percent, i)).map(p => p.join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
      {[25, 50, 75, 100].map(level => {
        const pts = data.map((_, i) => getCoordinates(level, i)).map(p => p.join(',')).join(' ');
        return <polygon key={level} points={pts} fill="none" stroke="#e2e8f0" strokeWidth="1" />;
      })}
      
      {data.map((_, i) => {
        const [x, y] = getCoordinates(100, i);
        return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
      })}
      
      <polygon points={pathPoints} fill="rgba(16, 185, 129, 0.2)" stroke="#10B981" strokeWidth="2" />
      
      {data.map((d, i) => {
        const [x, y] = getCoordinates(115, i);
        return (
          <foreignObject key={i} x={x - 12} y={y - 12} width="24" height="24">
            <div className="flex items-center justify-center w-full h-full text-slate-400">
              <span className="material-symbols-outlined text-sm">{d.icon}</span>
            </div>
          </foreignObject>
        );
      })}
    </svg>
  );
};

export const ChartsPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<ChartTab>('categories');
  const [accType, setAccType] = useState<AccumulationType>('expense');
  const [focusedItem, setFocusedItem] = useState<any>(null);
  
  // Drill-down State
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { transactions, loading } = useTransactions(currentDate);

  const analytics = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const balance = income - expense;

    // Radar Data
    const radarData = [
      { axis: 'Essenciais', value: 0, icon: 'home', desc: 'Contas fixas' },
      { axis: 'Lazer', value: 0, icon: 'local_activity', desc: 'Diversão' },
      { axis: 'Futuro', value: 0, icon: 'trending_up', desc: 'Investimentos' },
      { axis: 'Educação', value: 0, icon: 'school', desc: 'Cursos' },
      { axis: 'Imprevistos', value: 0, icon: 'medical_services', desc: 'Saúde/Outros' }
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

    // History (Accumulated Logic - Single Line)
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    let accumulatedValue = 0;
    
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayTrans = transactions.filter(t => new Date(t.date).getDate() === day && t.type === accType);
      const dayTotal = dayTrans.reduce((acc, t) => acc + t.amount, 0);
      
      accumulatedValue += dayTotal;

      return { 
        day, 
        value: accumulatedValue,
        dayTotal
      };
    });

    // Paleta de vermelhos para o gráfico de Despesas (igual ao Dashboard)
    const expensePalette = [
        '#EF4444', '#B91C1C', '#F87171', '#991B1B', '#FCA5A5', '#7F1D1D', '#FECACA',
    ];

    const sortedCategories = Array.from(
      transactions.reduce((acc, t) => {
        if (t.type === 'expense') {
          // Store amount and count/transactions for drill down
          if (!acc.has(t.category)) {
             acc.set(t.category, { amount: 0, transactions: [] });
          }
          const catData = acc.get(t.category)!;
          catData.amount += t.amount;
          catData.transactions.push(t);
        }
        return acc;
      }, new Map<string, { amount: number, transactions: any[] }>())
    ).map(([name, data], index) => {
      // Logic to find exact icon
      const ref = expenseCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
      
      // Use Red Palette for expense chart
      const color = expensePalette[index % expensePalette.length];
      
      // Use Correct Icon
      const icon = ref ? ref.icon : getIconForLegacy(name);

      return { 
        name, 
        amount: data.amount,
        transactions: data.transactions,
        color,
        icon
      };
    }).sort((a, b) => b.amount - a.amount);

    return { income, expense, balance, normalizedRadar, dailyData, sortedCategories };
  }, [transactions, currentDate, accType]);

  useEffect(() => {
    setFocusedItem(null);
    setSelectedCategory(null); // Reset selection on tab/date switch
  }, [activeTab, accType, currentDate]);

  const selectedCategoryData = useMemo(() => {
     if (!selectedCategory) return null;
     return analytics.sortedCategories.find(c => c.name === selectedCategory);
  }, [selectedCategory, analytics.sortedCategories]);

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
          { id: 'performance', label: 'Acumulado', icon: 'trending_up' },
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
                <header className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Para onde vai seu dinheiro?</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       {selectedCategory ? 'Detalhamento da categoria' : 'Distribuição por categorias'}
                    </p>
                  </div>
                  {selectedCategory && (
                      <button 
                        onClick={() => setSelectedCategory(null)}
                        className="text-xs font-bold text-primary hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-colors"
                      >
                        Limpar seleção
                      </button>
                  )}
                </header>

                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="w-full max-w-[240px] aspect-square relative flex-shrink-0">
                    <DonutChart 
                        data={analytics.sortedCategories} 
                        total={analytics.expense} 
                        selectedName={selectedCategory}
                        onSelect={setSelectedCategory}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                       {selectedCategoryData ? (
                           <>
                             <div className="h-8 w-8 rounded-full flex items-center justify-center mb-1" style={{ backgroundColor: `${selectedCategoryData.color}20`, color: selectedCategoryData.color }}>
                                <span className="material-symbols-outlined text-lg">{selectedCategoryData.icon}</span>
                             </div>
                             <p className="text-[10px] font-black uppercase text-slate-400 max-w-[100px] truncate">{selectedCategoryData.name}</p>
                             <p className="text-xl font-black text-slate-800" style={{ color: selectedCategoryData.color }}>{formatCurrency(selectedCategoryData.amount)}</p>
                             <p className="text-[9px] font-bold text-slate-300 mt-0.5">
                                {((selectedCategoryData.amount / analytics.expense) * 100).toFixed(1)}% do total
                             </p>
                           </>
                       ) : (
                           <>
                             <p className="text-[9px] font-black text-slate-400 uppercase">Total Saídas</p>
                             <p className="text-xl font-black text-slate-800">{formatCurrency(analytics.expense)}</p>
                           </>
                       )}
                    </div>
                  </div>

                  {/* Legends or Transactions List */}
                  <div className="flex-1 w-full space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                    {analytics.sortedCategories.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-slate-50 text-center text-xs font-bold text-slate-400">
                            Nenhuma despesa registrada neste mês.
                        </div>
                    ) : selectedCategoryData ? (
                        // Drill-down View: Show transactions for this category
                        <div className="space-y-2 animate-in slide-in-from-right-2 duration-300">
                            <p className="text-xs font-bold text-slate-400 px-1 mb-2">Transações recentes</p>
                            {selectedCategoryData.transactions.map((t: any) => (
                                <div key={t.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-white text-slate-400 shadow-sm text-xs font-bold">
                                            {new Date(t.date).getDate()}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-700">{t.description}</p>
                                            <p className="text-[9px] font-bold text-slate-400">{new Date(t.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black text-slate-800">{formatCurrency(t.amount)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Default View: Show category list with Colors and Icons
                        analytics.sortedCategories.map((cat, i) => (
                        <button 
                            key={i} 
                            onClick={() => setSelectedCategory(cat.name)}
                            className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:scale-[1.01] transition-all active:scale-95 text-left group"
                        >
                            <div className="flex items-center gap-3">
                                <div 
                                    className="h-10 w-10 rounded-full flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105" 
                                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                                >
                                    <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                                </div>
                                <div>
                                    <span className="text-xs font-black text-slate-700 block">{cat.name}</span>
                                    <div className="h-1.5 w-16 rounded-full bg-slate-200 mt-1 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${(cat.amount / analytics.expense) * 100}%`, backgroundColor: cat.color }}></div>
                                    </div>
                                </div>
                            </div>
                            <span className="text-xs font-black text-slate-800">{formatCurrency(cat.amount)}</span>
                        </button>
                        ))
                    )}
                  </div>
                </div>

                {!selectedCategory && (
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
                )}
              </div>
            )}

            {activeTab === 'performance' && (
              <div className="flex-1 flex flex-col space-y-4 animate-in slide-in-from-right-4 duration-500">
                <header className="flex justify-between items-start">
                   <div>
                    <h3 className="text-lg font-black text-slate-800">
                        {formatCurrency(accType === 'expense' ? analytics.expense : analytics.income)}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Total acumulado ({accType === 'expense' ? 'Saídas' : 'Entradas'})
                    </p>
                   </div>
                   <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button 
                        onClick={() => setAccType('expense')} 
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${accType === 'expense' ? 'bg-white text-danger shadow-sm' : 'text-slate-400'}`}
                      >
                        Despesa
                      </button>
                      <button 
                        onClick={() => setAccType('income')} 
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${accType === 'income' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}
                      >
                        Receita
                      </button>
                   </div>
                </header>
                
                <div className="flex-1 min-h-[220px] max-h-[300px] w-full pt-4 relative">
                  <FlowLineChart data={analytics.dailyData} type={accType} onFocus={setFocusedItem} />
                </div>

                <div className="min-h-[70px] bg-slate-50 rounded-2xl p-4 flex items-center justify-center border border-slate-100">
                  {focusedItem ? (
                    <div className="w-full flex justify-between items-center animate-in fade-in">
                       <p className="text-xs font-black text-slate-400">Dia {focusedItem.day}</p>
                       <div className="flex flex-col items-end">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Acumulado até o dia</p>
                         <p className={`text-lg font-black ${accType === 'expense' ? 'text-danger' : 'text-primary'}`}>
                            {formatCurrency(focusedItem.value)}
                         </p>
                       </div>
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold text-slate-300 uppercase italic">Toque no gráfico para ver detalhes do dia</p>
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
