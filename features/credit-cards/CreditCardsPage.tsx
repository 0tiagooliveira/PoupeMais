
import React, { useState, useMemo, useEffect } from 'react';
import { useCreditCards } from '../../hooks/useCreditCards';
import { formatCurrency } from '../../utils/formatters';
import { BackButton } from '../../components/ui/BackButton';
import { BankLogo } from '../dashboard/components/AccountsList';
import { NewCreditCardModal } from '../dashboard/components/NewCreditCardModal';
import { incomeCategories, expenseCategories } from '../dashboard/components/NewTransactionModal';
import { db } from '../../services/firebase';
import { Transaction, CreditCard } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

type ViewMode = 'faturas' | 'consolidado';

// Componente Interno de Gráfico para a Visão Consolidada
const SplineAreaChart: React.FC<{ data: { label: string, value: number }[], height?: number }> = ({ data, height = 300 }) => {
  if (!data || data.length === 0) return null;

  const width = 1000;
  const paddingX = 60;
  const paddingY = 40;
  
  const maxValue = Math.max(...data.map(d => d.value), 1000) * 1.2;
  
  const getX = (index: number) => (index / (data.length - 1)) * (width - paddingX * 2) + paddingX;
  const getY = (value: number) => height - paddingY - (value / maxValue) * (height - paddingY * 2);

  // Gera os pontos e as curvas de Bezier para suavidade (Spline)
  const points = data.map((d, i) => ({ x: getX(i), y: getY(d.value) }));
  
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    pathD += ` C ${cp1x} ${p0.y}, ${cp1x} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  return (
    <div className="w-full overflow-x-auto no-scrollbar pb-6">
      <div className="min-w-[800px] relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="purpleGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Eixos Y (Linhas de grade) */}
          {[0, 0.25, 0.5, 0.75, 1].map((level, i) => {
             const val = Math.round((maxValue * level) / 100) * 100;
             const y = getY(val);
             return (
               <g key={i}>
                 <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                 <text x={paddingX - 10} y={y + 4} textAnchor="end" className="text-[14px] fill-slate-400 font-medium">
                   {val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                 </text>
               </g>
             );
          })}

          {/* Área Preenchida */}
          <path d={areaD} fill="url(#purpleGradient)" />
          
          {/* Linha do Gráfico */}
          <path d={pathD} fill="none" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Eixo X (Labels com rotação) */}
          {data.map((d, i) => {
            const x = getX(i);
            // Mostrar labels apenas de 2 em 2 ou se for o primeiro/último para não poluir
            if (i % 2 !== 0 && i !== data.length - 1) return null;
            return (
              <g key={i} transform={`translate(${x}, ${height - paddingY + 20}) rotate(45)`}>
                <text x="0" y="0" textAnchor="start" className="text-[14px] fill-slate-500 font-medium">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export const CreditCardsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { cards, loading: loadingCards, addCard, updateCard } = useCreditCards();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loadingTrans, setLoadingTrans] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('faturas');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<CreditCard | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setLoadingTrans(true);
    // Busca transações recentes e futuras para projeção
    const unsubscribe = db.collection('users')
      .doc(currentUser.uid)
      .collection('transactions')
      .orderBy('date', 'desc')
      .onSnapshot(snapshot => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];
        setAllTransactions(data);
        setLoadingTrans(false);
      }, err => {
        setLoadingTrans(false);
      });
    return unsubscribe;
  }, [currentUser]);

  const activeCard = useMemo(() => {
    if (cards.length === 0) return null;
    return cards.find(c => c.id === selectedCardId) || cards[0];
  }, [cards, selectedCardId]);

  // Projeção Consolidada (Geral)
  const consolidatedProjection = useMemo(() => {
    const projection = [];
    const startDate = new Date();
    startDate.setDate(1); // Começa no dia 1 do mês atual

    for (let i = 0; i < 21; i++) {
      const currentMonth = new Date(startDate);
      currentMonth.setMonth(currentMonth.getMonth() + i);
      
      const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(currentMonth);
      
      // Soma faturas de TODOS os cartões para este mês
      let totalValue = 0;
      cards.forEach(card => {
        const closingDay = card.closingDay || 1;
        const cycleStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, closingDay);
        const cycleEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), closingDay);

        const cardTrans = allTransactions.filter(t => 
          t.accountId === card.id && 
          !t.isIgnored && // Ignora transações marcadas
          new Date(t.date) >= cycleStart && 
          new Date(t.date) < cycleEnd
        );

        totalValue += cardTrans.reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : -t.amount), 0);
      });

      projection.push({ 
        label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1).replace('.', ''), 
        value: Math.max(0, totalValue) 
      });
    }
    return projection;
  }, [cards, allTransactions]);

  // Projeção apenas de Compras Parceladas
  const installmentProjection = useMemo(() => {
    const projection = [];
    const startDate = new Date();
    startDate.setDate(1);

    for (let i = 0; i < 21; i++) {
      const currentMonth = new Date(startDate);
      currentMonth.setMonth(currentMonth.getMonth() + i);
      const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(currentMonth);

      let totalInstallments = 0;
      allTransactions.forEach(t => {
        if (t.isIgnored) return; // Ignora se marcado

        const isCardTrans = cards.some(c => c.id === t.accountId);
        if (!isCardTrans) return;

        const isParcelado = t.totalInstallments && t.totalInstallments > 1;
        if (!isParcelado) return;

        const tDate = new Date(t.date);
        if (tDate.getMonth() === currentMonth.getMonth() && tDate.getFullYear() === currentMonth.getFullYear()) {
          totalInstallments += t.amount;
        }
      });

      projection.push({ 
        label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1).replace('.', ''), 
        value: totalInstallments 
      });
    }
    return projection;
  }, [cards, allTransactions]);

  const invoicesData = useMemo(() => {
    if (!activeCard) return [];
    const closingDay = activeCard.closingDay || 1;
    const dueDay = activeCard.dueDay || 10;
    const today = new Date();
    let currentCycleRef = new Date(today);
    if (today.getDate() >= closingDay) currentCycleRef.setMonth(currentCycleRef.getMonth() + 1);
    currentCycleRef.setDate(closingDay);

    const invoices = [];
    for (let i = 0; i < 4; i++) {
        const targetDate = new Date(currentCycleRef);
        targetDate.setMonth(targetDate.getMonth() - i);
        const month = targetDate.getMonth();
        const year = targetDate.getFullYear();
        const cycleStartDate = new Date(year, month - 1, closingDay);
        const cycleCutoffDate = new Date(year, month, closingDay);
        const dueDateObj = new Date(year, month, dueDay);

        const invTransactions = allTransactions.filter(t => 
          t.accountId === activeCard.id && 
          !t.isIgnored && // Filtra ignoradas
          new Date(t.date) >= cycleStartDate && 
          new Date(t.date) < cycleCutoffDate
        );

        const total = invTransactions.reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : -t.amount), 0);
        const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(targetDate).toUpperCase();
        
        invoices.push({
            id: `inv-${i}`,
            label: monthLabel,
            total: Math.max(0, total),
            transactions: invTransactions,
            dueDate: dueDateObj.toLocaleDateString('pt-BR'),
            cycleRange: `${cycleStartDate.getDate()}/${cycleStartDate.getMonth()+1} a ${cycleCutoffDate.getDate() - 1}/${cycleCutoffDate.getMonth()+1}`,
            isCurrent: i === 0,
            status: i === 0 ? 'Aberta' : (today > dueDateObj ? 'Paga' : 'Fechada')
        });
    }
    return invoices;
  }, [activeCard, allTransactions]);

  const [selectedInvoiceIndex, setSelectedInvoiceIndex] = useState(0);
  const activeInvoice = invoicesData[selectedInvoiceIndex];

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      <header className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <BackButton className="bg-white shadow-sm border border-slate-100" />
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Cartões de Crédito</h2>
        </div>
      </header>

      <div className="flex gap-8 border-b border-slate-100 px-2">
        <button onClick={() => setViewMode('faturas')} className={`pb-4 text-sm font-bold transition-all relative ${viewMode === 'faturas' ? 'text-primary' : 'text-slate-400'}`}>
          <div className="flex items-center gap-2"><span className="material-symbols-outlined text-xl">payments</span> Faturas</div>
          {viewMode === 'faturas' && <div className="absolute bottom-0 left-0 h-1 w-full bg-primary rounded-full" />}
        </button>
        <button onClick={() => setViewMode('consolidado')} className={`pb-4 text-sm font-bold transition-all relative ${viewMode === 'consolidado' ? 'text-primary' : 'text-slate-400'}`}>
          <div className="flex items-center gap-2"><span className="material-symbols-outlined text-xl">leaderboard</span> Consolidado</div>
          {viewMode === 'consolidado' && <div className="absolute bottom-0 left-0 h-1 w-full bg-primary rounded-full" />}
        </button>
      </div>

      {viewMode === 'faturas' ? (
        <div className="space-y-8">
          <div className="overflow-x-auto no-scrollbar flex gap-4 px-1 py-2">
            {cards.map(card => (
              <button key={card.id} onClick={() => setSelectedCardId(card.id)} className={`relative min-w-[300px] h-[180px] rounded-[32px] p-6 text-white transition-all shadow-xl hover:scale-[1.02] active:scale-95 overflow-hidden border border-white/10 ${selectedCardId === card.id || (!selectedCardId && cards[0]?.id === card.id) ? 'ring-4 ring-primary ring-offset-4 ring-offset-background' : 'opacity-80'}`} style={{ backgroundColor: card.color || '#1e293b' }}>
                <div className="absolute top-0 right-0 p-6 opacity-20"><span className="material-symbols-outlined text-[100px] rotate-12">credit_card</span></div>
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div><p className="text-lg font-black tracking-tight">{card.name}</p><p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Fecha dia {card.closingDay} • Vence dia {card.dueDay}</p></div>
                    <div className="bg-white/95 p-1 rounded-full"><BankLogo name={card.name} color={card.color} size="sm" /></div>
                  </div>
                  <div className="flex items-end justify-between">
                     <div><div className="w-10 h-7 bg-gradient-to-br from-amber-300 to-amber-500 rounded-md shadow-inner mb-4 opacity-80"></div><p className="text-sm font-bold tracking-[0.2em] opacity-80">•••• ••••</p></div>
                     <div onClick={(e) => { e.stopPropagation(); setCardToEdit(card); setIsModalOpen(true); }} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-colors backdrop-blur-sm"><span className="material-symbols-outlined text-lg">edit</span></div>
                  </div>
                </div>
              </button>
            ))}
            <button onClick={() => { setCardToEdit(null); setIsModalOpen(true); }} className="min-w-[60px] h-[180px] rounded-[32px] border-2 border-dashed border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"><span className="material-symbols-outlined text-slate-300">add</span></button>
          </div>

          <div className="flex flex-row-reverse gap-3 overflow-x-auto no-scrollbar py-2 px-1 justify-end">
             {invoicesData.map((inv, idx) => (
               <button key={inv.id} onClick={() => setSelectedInvoiceIndex(idx)} className={`min-w-[140px] p-4 rounded-[24px] border transition-all text-left flex flex-col justify-between ${selectedInvoiceIndex === idx ? 'bg-white border-primary shadow-lg ring-1 ring-primary' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`}>
                 <div className="flex justify-between items-center mb-3"><span className={`text-[11px] font-black uppercase ${selectedInvoiceIndex === idx ? 'text-primary' : 'text-slate-500'}`}>{inv.label}</span>{inv.isCurrent && <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>}</div>
                 <p className="text-lg font-black text-slate-800 mb-1">{formatCurrency(inv.total)}</p>
                 <div className="mt-auto pt-2 border-t border-slate-100 w-full"><p className="text-[9px] font-bold text-slate-400">{inv.status}</p></div>
               </button>
             ))}
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden min-h-[200px]">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Extrato da Fatura</span>
                <span className="text-[10px] font-bold text-slate-500 italic">{activeInvoice?.cycleRange}</span>
            </div>
            {activeInvoice?.transactions.length === 0 ? (
              <div className="p-12 text-center text-slate-300 italic flex flex-col items-center justify-center"><span className="material-symbols-outlined text-4xl mb-2 opacity-20">credit_card_off</span><p className="text-xs font-bold uppercase tracking-widest">Fatura Zerada</p></div>
            ) : (
              <div className="divide-y divide-slate-50">
                {activeInvoice?.transactions.map((t) => {
                  const cat = [...incomeCategories, ...expenseCategories].find(c => c.name === t.category) || { icon: 'shopping_cart', color: '#94a3b8' };
                  return (
                    <div key={t.id} className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
                       <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-sm ${t.type === 'income' ? 'bg-success/10 text-success' : 'bg-slate-50 text-slate-500'}`}><span className="material-symbols-outlined text-xl">{t.type === 'income' ? 'undo' : cat.icon}</span></div>
                          <div><p className="text-sm font-bold text-slate-800 leading-none mb-1 line-clamp-1">{t.description}</p><p className="text-[10px] font-bold text-slate-400">{new Date(t.date).toLocaleDateString()} • {t.category}</p></div>
                       </div>
                       <span className={`text-sm font-black ${t.type === 'income' ? 'text-success' : 'text-slate-800'}`}>{t.type === 'income' ? '-' : ''}{formatCurrency(t.amount)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CONSOLIDATED VIEW - IDENTICAL TO SCREENSHOTS */
        <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-700">
          {/* Gráfico 1: Visão Consolidada - Faturas Mensais */}
          <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm overflow-hidden">
            <header className="mb-6">
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Visão Consolidada - Faturas Mensais</h3>
              <p className="text-sm font-medium text-slate-400 mt-1">Total consolidado de faturas de todos os cartões, mês a mês</p>
            </header>
            
            <div className="mt-8">
              <SplineAreaChart data={consolidatedProjection} height={350} />
            </div>
          </div>

          {/* Gráfico 2: Projeção de Compras Parceladas */}
          <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm overflow-hidden">
            <header className="mb-6">
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Projeção de Compras Parceladas</h3>
              <p className="text-sm font-medium text-slate-400 mt-1">Total de parcelas projetadas para os próximos meses por cartão</p>
            </header>
            
            <div className="mt-8">
              <SplineAreaChart data={installmentProjection} height={350} />
            </div>
          </div>
        </div>
      )}

      <NewCreditCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={async (data) => { if (cardToEdit) await updateCard(cardToEdit.id, data); else await addCard(data); }} cardToEdit={cardToEdit} />
    </div>
  );
};
