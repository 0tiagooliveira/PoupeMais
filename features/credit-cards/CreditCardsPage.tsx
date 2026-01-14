
import React, { useState, useMemo } from 'react';
import { useCreditCards } from '../../hooks/useCreditCards';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency } from '../../utils/formatters';
import { BackButton } from '../../components/ui/BackButton';
import { BankLogo } from '../dashboard/components/AccountsList';
import { incomeCategories, expenseCategories } from '../dashboard/components/NewTransactionModal';

type ViewMode = 'faturas' | 'consolidado';

export const CreditCardsPage: React.FC = () => {
  const { cards, loading: loadingCards } = useCreditCards();
  const [currentDate, setCurrentDate] = useState(new Date());
  const { transactions, loading: loadingTrans } = useTransactions(currentDate);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('faturas');

  const activeCard = useMemo(() => {
    if (cards.length === 0) return null;
    return cards.find(c => c.id === selectedCardId) || cards[0];
  }, [cards, selectedCardId]);

  // Agrupa transações por fatura baseado no dia de fechamento
  const invoicesData = useMemo(() => {
    if (!activeCard) return [];
    
    // Simulação de faturas para os últimos 4 meses
    const months = [0, -1, -2, -3].map(offset => {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() + offset);
      return {
        month: d.getMonth(),
        year: d.getFullYear(),
        label: new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(d).toUpperCase(),
        isCurrent: offset === 0
      };
    });

    return months.map(m => {
      // Aqui em um app real filtraríamos transações cujo vencimento cai nesta fatura
      // Para o demo, filtramos apenas por mês de ocorrência
      const monthTrans = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === m.month && tDate.getFullYear() === m.year && t.accountId === activeCard.id;
      });

      const total = monthTrans.reduce((acc, t) => acc + t.amount, 0);
      
      return {
        ...m,
        total,
        transactions: monthTrans,
        dueDate: `14/${(m.month + 1).toString().padStart(2, '0')}/${m.year}`,
        closingDate: `08/${(m.month + 2).toString().padStart(2, '0')}/${m.year}`
      };
    });
  }, [activeCard, transactions, currentDate]);

  const [selectedInvoiceIndex, setSelectedInvoiceIndex] = useState(0);
  const activeInvoice = invoicesData[selectedInvoiceIndex];

  if (loadingCards) return <div className="p-10 text-center animate-pulse text-slate-400 font-bold">Carregando cartões...</div>;

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      <header className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <BackButton className="bg-white shadow-sm border border-slate-100" />
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Cartões de Crédito</h2>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-slate-100 px-2">
        <button 
          onClick={() => setViewMode('faturas')}
          className={`pb-4 text-sm font-bold transition-all relative ${viewMode === 'faturas' ? 'text-primary' : 'text-slate-400'}`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">payments</span> Faturas
          </div>
          {viewMode === 'faturas' && <div className="absolute bottom-0 left-0 h-1 w-full bg-primary rounded-full" />}
        </button>
        <button 
          onClick={() => setViewMode('consolidado')}
          className={`pb-4 text-sm font-bold transition-all relative ${viewMode === 'consolidado' ? 'text-primary' : 'text-slate-400'}`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">leaderboard</span> Consolidado
          </div>
          {viewMode === 'consolidado' && <div className="absolute bottom-0 left-0 h-1 w-full bg-primary rounded-full" />}
        </button>
      </div>

      {viewMode === 'faturas' ? (
        <div className="space-y-8">
          {/* Card Display */}
          <div className="overflow-x-auto no-scrollbar flex gap-4 px-1 py-2">
            {cards.map(card => (
              <button 
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                className={`relative min-w-[300px] h-[180px] rounded-[32px] p-6 text-white transition-all shadow-xl hover:scale-[1.02] active:scale-95 overflow-hidden border border-white/10 ${selectedCardId === card.id || (!selectedCardId && cards[0].id === card.id) ? 'ring-4 ring-primary ring-offset-4 ring-offset-background' : 'opacity-80'}`}
                style={{ backgroundColor: card.color || '#1e293b' }}
              >
                <div className="absolute top-0 right-0 p-6 opacity-20">
                   <span className="material-symbols-outlined text-[100px] rotate-12">credit_card</span>
                </div>
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-lg font-black tracking-tight">{card.name}</p>
                      <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Platinum</p>
                    </div>
                    <div className="bg-white/95 p-1 rounded-full">
                       <BankLogo name={card.name} color={card.color} size="sm" />
                    </div>
                  </div>
                  
                  <div className="flex items-end justify-between">
                     <div>
                        <div className="w-10 h-7 bg-gradient-to-br from-amber-300 to-amber-500 rounded-md shadow-inner mb-4 opacity-80"></div>
                        <p className="text-sm font-bold tracking-[0.2em] opacity-80">•••• 6255</p>
                     </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Invoices Timeline */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-slate-800 px-1">Faturas</h3>
            <p className="text-xs text-slate-400 px-1 leading-relaxed">
              As seguintes faturas estão disponíveis para o seu cartão. Acompanhe seus gastos e datas de fechamento.
            </p>
            
            <div className="flex gap-4 overflow-x-auto no-scrollbar py-2 px-1">
               {invoicesData.map((inv, idx) => (
                 <button 
                  key={idx}
                  onClick={() => setSelectedInvoiceIndex(idx)}
                  className={`min-w-[200px] p-5 rounded-[24px] border transition-all text-left ${selectedInvoiceIndex === idx ? 'bg-white border-primary shadow-lg ring-1 ring-primary' : 'bg-slate-50 border-slate-100'}`}
                 >
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black text-slate-400">{inv.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${inv.isCurrent ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500'}`}>
                        {inv.isCurrent ? 'Atual' : 'Fechada'}
                      </span>
                   </div>
                   <p className="text-xl font-black text-slate-800 mb-4">{formatCurrency(inv.total)}</p>
                   <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400">Vencimento: <span className="text-slate-600">{inv.dueDate}</span></p>
                      {inv.isCurrent && <p className="text-[9px] font-bold text-slate-400">Fechamento: <span className="text-slate-600">{inv.closingDate}</span></p>}
                   </div>
                 </button>
               ))}
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-4">
             <div className="flex items-center justify-between px-1">
                <h3 className="text-lg font-black text-slate-800">Transações - {activeInvoice?.label}</h3>
                <span className="material-symbols-outlined text-slate-300">expand_more</span>
             </div>
             
             <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                {activeInvoice?.transactions.length === 0 ? (
                  <div className="p-12 text-center text-slate-300 italic flex flex-col items-center">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-20">history_toggle_off</span>
                    <p className="text-xs font-bold uppercase tracking-widest">Nenhuma transação nesta fatura</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {activeInvoice.transactions.map((t, i) => {
                      const cat = [...incomeCategories, ...expenseCategories].find(c => c.name === t.category) || { icon: 'shopping_cart', color: '#94a3b8' };
                      return (
                        <div key={t.id} className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors group">
                           <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-sm" style={{ color: cat.color }}>
                                 <span className="material-symbols-outlined">{cat.icon}</span>
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-slate-800 leading-none mb-1">{t.description}</p>
                                 <p className="text-[10px] font-bold text-slate-400">
                                   {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • {t.category}
                                 </p>
                              </div>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className="text-sm font-black text-slate-800">{formatCurrency(t.amount)}</span>
                              <span className="material-symbols-outlined text-slate-200 text-sm">chevron_right</span>
                           </div>
                        </div>
                      )
                    })}
                  </div>
                )}
             </div>
          </div>
        </div>
      ) : (
        /* Consolidated View */
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Limite Total</p>
               <h4 className="text-3xl font-black text-slate-800 tracking-tighter">
                 {formatCurrency(cards.reduce((acc, c) => acc + (c.limit || 0), 0))}
               </h4>
               <div className="mt-6 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: '45%' }}></div>
               </div>
               <p className="mt-3 text-[10px] font-bold text-slate-400">Você já utilizou 45% do seu limite global.</p>
            </div>
            
            <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl shadow-slate-200">
               <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Próximos Vencimentos</p>
               <div className="space-y-4 mt-4">
                 {cards.map(c => (
                   <div key={c.id} className="flex justify-between items-center border-b border-white/10 pb-3 last:border-0">
                      <div className="flex items-center gap-3">
                         <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }}></div>
                         <span className="text-xs font-bold">{c.name}</span>
                      </div>
                      <span className="text-xs font-black text-primary">Dia {c.dueDay}</span>
                   </div>
                 ))}
               </div>
            </div>
          </div>

          <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
             <h3 className="text-lg font-black text-slate-800 mb-6">Concentração por Cartão</h3>
             <div className="space-y-6">
                {cards.map(c => {
                  const used = Math.random() * c.limit; // Mock
                  const perc = (used / (c.limit || 1)) * 100;
                  return (
                    <div key={c.id}>
                       <div className="flex justify-between items-end mb-2">
                          <div>
                            <p className="text-sm font-black text-slate-700">{c.name}</p>
                            <p className="text-[9px] font-bold text-slate-400">Limite: {formatCurrency(c.limit)}</p>
                          </div>
                          <p className="text-sm font-black text-slate-800">{perc.toFixed(0)}%</p>
                       </div>
                       <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                          <div className="h-full transition-all duration-1000" style={{ width: `${perc}%`, backgroundColor: c.color }}></div>
                       </div>
                    </div>
                  )
                })}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
