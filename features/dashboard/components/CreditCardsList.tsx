
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Transaction } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { formatCurrency } from '../../../utils/formatters';
import { BankLogo } from './AccountsList';

interface CreditCardsListProps {
  cards: CreditCard[];
  transactions?: Transaction[];
  onAddCard: () => void;
  onDeleteCard: (id: string) => void;
}

export const CreditCardsList: React.FC<CreditCardsListProps> = ({ cards, transactions = [], onAddCard, onDeleteCard }) => {
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const navigate = useNavigate();

  // Cálculo de Balanços (Fatura e Disponível)
  const cardStats = useMemo(() => {
    const stats: Record<string, { currentInvoice: number, usedLimit: number, available: number, percentage: number }> = {};
    const today = new Date();
    
    cards.forEach(card => {
      const closingDay = card.closingDay || 1;
      
      // 1. Cálculo da Fatura Atual (Ciclo do mês vigente)
      let cycleStart = new Date(today.getFullYear(), today.getMonth(), closingDay);
      if (today.getDate() < closingDay) {
        cycleStart.setMonth(cycleStart.getMonth() - 1);
      }
      
      const invoiceTransactions = transactions.filter(t => 
        t.accountId === card.id && 
        new Date(t.date) >= cycleStart
      );

      const currentInvoice = invoiceTransactions.reduce((acc, t) => 
        acc + (t.type === 'expense' ? t.amount : -t.amount), 0
      );

      // 2. Limite Utilizado (Dívida Total acumulada no cartão)
      // Representa tudo o que foi gasto e ainda não foi "anulado" por um pagamento (income)
      const allCardTransactions = transactions.filter(t => t.accountId === card.id);
      
      const netBalance = allCardTransactions.reduce((acc, t) => 
        acc + (t.type === 'expense' ? t.amount : -t.amount), 0
      );

      // Se o saldo for positivo, é o que você usou do limite. 
      // Se for negativo, você tem "crédito" (pagou a mais), então o uso é 0.
      const usedLimit = Math.max(0, netBalance);
      const available = Math.max(0, card.limit - usedLimit);
      const percentage = Math.min(100, (usedLimit / card.limit) * 100);

      stats[card.id] = {
        currentInvoice: Math.max(0, currentInvoice),
        usedLimit,
        available,
        percentage
      };
    });
    
    return stats;
  }, [cards, transactions]);

  const handleDeleteConfirm = () => {
    if (cardToDelete) {
      onDeleteCard(cardToDelete);
      setCardToDelete(null);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="mb-5 flex items-center justify-between px-1">
        <h3 className="text-xl font-bold text-slate-800 tracking-tight">Cartões de crédito</h3>
        {cards.length > 0 && (
          <button 
            onClick={() => navigate('/credit-cards')}
            className="text-xs font-bold text-success hover:opacity-80 transition-opacity"
          >
            Ver todos
          </button>
        )}
      </div>
      
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[32px] border border-slate-100 bg-white p-10 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/5 text-success/40">
             <span className="material-symbols-outlined text-3xl">credit_card</span>
          </div>
          <h4 className="mb-2 text-sm font-bold text-slate-800 tracking-tight">Nenhum cartão cadastrado</h4>
          <Button 
            onClick={onAddCard}
            className="bg-primary hover:bg-emerald-600 text-white font-bold text-xs px-8 rounded-2xl h-11 shadow-lg shadow-success/20"
          >
            + Adicionar cartão
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {cards.map((card) => {
            const stat = cardStats[card.id] || { currentInvoice: 0, usedLimit: 0, available: card.limit, percentage: 0 };
            const barColor = stat.percentage > 85 ? 'bg-danger' : stat.percentage > 60 ? 'bg-amber-400' : 'bg-success';

            return (
              <div 
                key={card.id}
                onClick={() => navigate('/credit-cards')} 
                className="group relative overflow-hidden rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:scale-[1.01] cursor-pointer"
              >
                {/* Lateral Accent */}
                <div className="absolute top-0 left-0 h-full w-2" style={{ backgroundColor: card.color }}></div>
                
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-5">
                    <BankLogo name={card.name} color={card.color} size="md" />
                    <div>
                      <p className="text-lg font-bold text-slate-800 leading-none mb-1">{card.name}</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Vence dia {card.dueDay}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCardToDelete(card.id); }}
                    className="text-slate-200 hover:text-danger transition-colors p-2 rounded-xl hover:bg-red-50"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>

                {/* Grid de Informações de Limite */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Limite Utilizado</span>
                    <p className={`text-lg font-black tracking-tight ${stat.usedLimit > card.limit ? 'text-danger' : 'text-slate-800'}`}>
                      {formatCurrency(stat.usedLimit)}
                    </p>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Disponível</span>
                    <p className="text-lg font-black text-success tracking-tight">
                      {formatCurrency(stat.available)}
                    </p>
                  </div>
                </div>

                {/* Barra de Progresso do Uso */}
                <div className="mb-6 space-y-1.5">
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-50">
                        <div 
                            className={`h-full transition-all duration-1000 ease-out rounded-full shadow-sm ${barColor}`}
                            style={{ width: `${stat.percentage}%` }}
                        />
                    </div>
                    <div className="flex justify-between items-center px-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                          {stat.percentage.toFixed(1)}% do limite comprometido
                        </span>
                    </div>
                </div>

                <div className="flex items-end justify-between border-t border-slate-50 pt-5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-tighter">Limite Total</span>
                    <span className="text-base font-bold text-slate-500 tracking-tighter">
                      {formatCurrency(card.limit)}
                    </span>
                  </div>
                  <div className="text-right space-y-1">
                     <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-tighter">Fatura Atual</span>
                     <span className="text-xl font-bold tracking-tighter block text-slate-800">
                       {formatCurrency(stat.currentInvoice)}
                     </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!cardToDelete}
        onClose={() => setCardToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir cartão"
        message="Deseja remover este cartão? As transações vinculadas a ele não serão apagadas."
      />
    </div>
  );
};
