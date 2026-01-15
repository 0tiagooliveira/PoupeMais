
import React, { useState, useMemo, useEffect } from 'react';
import { useCreditCards } from '../../hooks/useCreditCards';
import { formatCurrency } from '../../utils/formatters';
import { BackButton } from '../../components/ui/BackButton';
import { BankLogo } from '../dashboard/components/AccountsList';
import { NewCreditCardModal } from '../dashboard/components/NewCreditCardModal';
import { incomeCategories, expenseCategories } from '../dashboard/components/NewTransactionModal';
import { db, auth } from '../../services/firebase';
import { Transaction, CreditCard } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

type ViewMode = 'faturas' | 'consolidado';

export const CreditCardsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { cards, loading: loadingCards, addCard, updateCard } = useCreditCards();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loadingTrans, setLoadingTrans] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('faturas');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<CreditCard | null>(null);

  // Busca transações com margem de segurança (últimos 4 meses)
  useEffect(() => {
    if (!currentUser) return;
    setLoadingTrans(true);

    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 130); 

    const unsubscribe = db.collection('users')
      .doc(currentUser.uid)
      .collection('transactions')
      .where('date', '>=', pastDate.toISOString())
      .orderBy('date', 'desc')
      .onSnapshot(snapshot => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];
        setAllTransactions(data);
        setLoadingTrans(false);
      }, err => {
        console.error("Erro ao buscar transações de cartão", err);
        setLoadingTrans(false);
      });

    return unsubscribe;
  }, [currentUser]);

  const activeCard = useMemo(() => {
    if (cards.length === 0) return null;
    return cards.find(c => c.id === selectedCardId) || cards[0];
  }, [cards, selectedCardId]);

  // Lógica de Ciclo de Fatura (Cutoff Date)
  const invoicesData = useMemo(() => {
    if (!activeCard) return [];
    
    const closingDay = activeCard.closingDay || 1;
    const dueDay = activeCard.dueDay || 10;
    const today = new Date();
    
    let currentCycleRef = new Date(today);
    
    if (today.getDate() >= closingDay) {
        currentCycleRef.setMonth(currentCycleRef.getMonth() + 1);
    }
    currentCycleRef.setDate(closingDay);

    const invoices = [];
    
    for (let i = 0; i < 4; i++) {
        const targetDate = new Date(currentCycleRef);
        targetDate.setMonth(targetDate.getMonth() - i);
        
        const month = targetDate.getMonth();
        const year = targetDate.getFullYear();

        const cycleStartDate = new Date(year, month - 1, closingDay);
        cycleStartDate.setHours(0, 0, 0, 0);

        const cycleCutoffDate = new Date(year, month, closingDay);
        cycleCutoffDate.setHours(0, 0, 0, 0);

        const dueDateObj = new Date(year, month, dueDay);

        const invTransactions = allTransactions.filter(t => {
            if (t.accountId !== activeCard.id) return false;
            const tDate = new Date(t.date);
            return tDate >= cycleStartDate && tDate < cycleCutoffDate;
        });

        const total = invTransactions.reduce((acc, t) => {
             if (t.type === 'expense') return acc + t.amount;
             if (t.type === 'income') return acc - t.amount;
             return acc;
        }, 0);

        const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(targetDate).toUpperCase();
        const fullLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(targetDate);
        
        let status = 'Fechada';
        if (i === 0) status = 'Aberta';
        if (i > 0 && today > dueDateObj) status = 'Paga'; 

        const rangeEndDisplay = new Date(cycleCutoffDate);
        rangeEndDisplay.setDate(rangeEndDisplay.getDate() - 1); 

        invoices.push({
            id: `inv-${i}`,
            label: monthLabel,
            fullLabel: fullLabel.charAt(0).toUpperCase() + fullLabel.slice(1),
            total: Math.max(0, total), 
            transactions: invTransactions,
            dueDate: dueDateObj.toLocaleDateString('pt-BR'),
            closingDate: rangeEndDisplay.toLocaleDateString('pt-BR'),
            cycleRange: `${cycleStartDate.getDate()}/${cycleStartDate.getMonth()+1} a ${rangeEndDisplay.getDate()}/${rangeEndDisplay.getMonth()+1}`,
            isCurrent: i === 0,
            status
        });
    }

    return invoices; 
    
  }, [activeCard, allTransactions]);

  const [selectedInvoiceIndex, setSelectedInvoiceIndex] = useState(0);
  const activeInvoice = invoicesData[selectedInvoiceIndex];

  const handleEditCard = (e: React.MouseEvent, card: CreditCard) => {
    e.stopPropagation();
    setCardToEdit(card);
    setIsModalOpen(true);
  };

  const handleAddCard = () => {
    setCardToEdit(null);
    setIsModalOpen(true);
  };

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
          {/* Card Selector */}
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
                      <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">
                        Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                      </p>
                    </div>
                    <div className="bg-white/95 p-1 rounded-full">
                       <BankLogo name={card.name} color={card.color} size="sm" />
                    </div>
                  </div>
                  
                  <div className="flex items-end justify-between">
                     <div>
                        <div className="w-10 h-7 bg-gradient-to-br from-amber-300 to-amber-500 rounded-md shadow-inner mb-4 opacity-80"></div>
                        <p className="text-sm font-bold tracking-[0.2em] opacity-80">•••• ••••</p>
                     </div>
                     <div 
                        onClick={(e) => handleEditCard(e, card)}
                        className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-colors backdrop-blur-sm"
                        title="Editar cartão"
                     >
                        <span className="material-symbols-outlined text-lg">edit</span>
                     </div>
                  </div>
                </div>
              </button>
            ))}
            
            <button 
              onClick={handleAddCard}
              className="min-w-[60px] h-[180px] rounded-[32px] border-2 border-dashed border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
            >
                <span className="material-symbols-outlined text-slate-300">add</span>
            </button>
          </div>

          {/* Invoices Timeline */}
          <div className="space-y-4">
            <div className="flex justify-between items-end px-1">
                <div>
                    <h3 className="text-lg font-black text-slate-800">Linha do Tempo</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                    Selecione um mês para ver os detalhes.
                    </p>
                </div>
            </div>
            
            <div className="flex flex-row-reverse gap-3 overflow-x-auto no-scrollbar py-2 px-1 justify-end md:justify-start">
               {invoicesData.map((inv, idx) => (
                 <button 
                  key={inv.id}
                  onClick={() => setSelectedInvoiceIndex(idx)}
                  className={`min-w-[140px] p-4 rounded-[24px] border transition-all text-left flex flex-col justify-between ${selectedInvoiceIndex === idx ? 'bg-white border-primary shadow-lg ring-1 ring-primary' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`}
                 >
                   <div className="flex justify-between items-center mb-3">
                      <span className={`text-[11px] font-black uppercase ${selectedInvoiceIndex === idx ? 'text-primary' : 'text-slate-500'}`}>{inv.label}</span>
                      {inv.isCurrent && <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>}
                   </div>
                   
                   <p className="text-lg font-black text-slate-800 mb-1">{formatCurrency(inv.total)}</p>
                   
                   <div className="mt-auto pt-2 border-t border-slate-100 w-full">
                      <p className="text-[9px] font-bold text-slate-400">
                        {inv.status}
                      </p>
                   </div>
                 </button>
               ))}
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-4">
             <div className="flex items-center justify-between px-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                    <h3 className="text-sm font-black text-slate-800">Extrato de {activeInvoice?.label}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        Compras de {activeInvoice?.cycleRange}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Vencimento</p>
                    <p className="text-sm font-black text-slate-800">{activeInvoice?.dueDate}</p>
                </div>
             </div>
             
             <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden min-h-[200px]">
                {activeInvoice?.transactions.length === 0 ? (
                  <div className="p-12 text-center text-slate-300 italic flex flex-col items-center justify-center h-full">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-20">credit_card_off</span>
                    <p className="text-xs font-bold uppercase tracking-widest">Fatura Zerada</p>
                    <p className="text-[10px] mt-1 opacity-60">Nenhuma compra processada neste período.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {activeInvoice?.transactions.map((t) => {
                      const cat = [...incomeCategories, ...expenseCategories].find(c => c.name === t.category) || { icon: 'shopping_cart', color: '#94a3b8' };
                      const tDate = new Date(t.date);
                      const isRefund = t.type === 'income';
                      
                      return (
                        <div key={t.id} className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors group">
                           <div className="flex items-center gap-4">
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-sm ${isRefund ? 'bg-success/10 text-success' : 'bg-slate-50 text-slate-500'}`}>
                                 <span className="material-symbols-outlined text-xl">{isRefund ? 'undo' : cat.icon}</span>
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-slate-800 leading-none mb-1 line-clamp-1">{t.description}</p>
                                 <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                   {tDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} 
                                   <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                                   {isRefund ? 'Estorno/Crédito' : t.category}
                                 </p>
                              </div>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className={`text-sm font-black ${isRefund ? 'text-success' : 'text-slate-800'}`}>
                                {isRefund ? '-' : ''}{formatCurrency(t.amount)}
                              </span>
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
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Limite Total Combinado</p>
               <h4 className="text-3xl font-black text-slate-800 tracking-tighter">
                 {formatCurrency(cards.reduce((acc, c) => acc + (c.limit || 0), 0))}
               </h4>
               <div className="mt-6 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: '45%' }}></div>
               </div>
               <p className="mt-3 text-[10px] font-bold text-slate-400">Gerencie seus limites com sabedoria.</p>
            </div>
            
            <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl shadow-slate-200">
               <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Agenda de Vencimentos</p>
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
        </div>
      )}

      <NewCreditCardModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={async (data) => {
            if (cardToEdit) await updateCard(cardToEdit.id, data);
            else await addCard(data);
        }}
        cardToEdit={cardToEdit}
      />
    </div>
  );
};
