
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
  onRecoverCards?: () => void;
  recoveringCards?: boolean;
}

export const CreditCardsList: React.FC<CreditCardsListProps> = ({
  cards,
  transactions = [],
  onAddCard,
  onDeleteCard,
  onRecoverCards,
  recoveringCards = false,
}) => {
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const navigate = useNavigate();

  const cardLikeTransactionsCount = useMemo(() => {
    return transactions.filter((t) => {
      const data = t as any;
      const sourceType = String(data?.sourceType || '').toLowerCase();
      const description = String(t.description || '').toLowerCase();
      const category = String(t.category || '').toLowerCase();
      const bankName = String(data?.bankName || '').toLowerCase();

      return (
        sourceType === 'card' ||
        description.includes('fatura') ||
        description.includes('cartao') ||
        description.includes('cartão') ||
        category.includes('cartão') ||
        category.includes('cartao') ||
        bankName.includes('nubank') ||
        bankName.includes('visa') ||
        bankName.includes('mastercard')
      );
    }).length;
  }, [transactions]);

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
    <div className="flex flex-col h-full">
      <div className="mb-5 flex items-center justify-between px-1">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Cartões de crédito</h3>
        <div className="flex items-center gap-2">
          {cards.length > 0 && (
            <button
              onClick={() => navigate('/credit-cards')}
              className="text-xs font-bold text-success hover:opacity-80 transition-opacity"
            >
              Ver todos
            </button>
          )}
          <button
            onClick={onAddCard}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-success/10 hover:text-success transition-all active:scale-90"
            title="Adicionar cartão"
          >
            <span className="material-symbols-outlined text-lg font-bold">add</span>
          </button>
        </div>
      </div>
      
      {cards.length === 0 ? (
        <div className="group flex items-center justify-between rounded-[24px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success/5 text-success/40 border border-black/5">
              <span className="material-symbols-outlined text-xl">credit_card</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                {cardLikeTransactionsCount > 0 ? 'Lançamentos de cartão detectados' : 'Nenhum cartão cadastrado'}
              </h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {cardLikeTransactionsCount > 0
                  ? `${cardLikeTransactionsCount} lançamentos encontrados sem cartão cadastrado`
                  : 'Adicione para acompanhar limite'}
              </p>
            </div>
          </div>

          {cardLikeTransactionsCount > 0 && onRecoverCards ? (
            <Button onClick={onRecoverCards} isLoading={recoveringCards} className="rounded-2xl h-10 px-5 text-xs font-bold">
              Recuperar cartões
            </Button>
          ) : (
            <Button onClick={onAddCard} className="rounded-2xl h-10 px-5 text-xs font-bold">
              + Adicionar cartão
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((card) => {
            const stat = cardStats[card.id] || { currentInvoice: 0, usedLimit: 0, available: card.limit, percentage: 0 };
            const barColor = stat.percentage > 85 ? 'bg-danger' : stat.percentage > 60 ? 'bg-amber-400' : 'bg-success';

            return (
              <div 
                key={card.id}
                onClick={() => navigate('/credit-cards')} 
                className="group cursor-pointer rounded-[24px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all hover:border-success/30 hover:shadow-md active:scale-[0.98]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <BankLogo name={card.name} color={card.color} size="md" />
                    <div>
                      <p className="text-base font-bold text-slate-800 dark:text-slate-100 leading-none mb-1 truncate">{card.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vence dia {card.dueDay}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fatura atual</p>
                      <p className={`text-[clamp(1.05rem,2.5vw,1.5rem)] font-black tracking-tight ${stat.currentInvoice > 0 ? 'text-danger' : 'text-slate-700 dark:text-slate-300'}`}>
                        {formatCurrency(stat.currentInvoice)}
                      </p>
                    </div>
                    <button 
                    onClick={(e) => { e.stopPropagation(); setCardToDelete(card.id); }}
                      className="text-slate-200 dark:text-slate-700 hover:text-danger dark:hover:text-red-400 transition-colors p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Limite utilizado</span>
                    <p className={`text-base font-black tracking-tight ${stat.usedLimit > card.limit ? 'text-danger' : 'text-slate-800 dark:text-slate-100'}`}>
                      {formatCurrency(stat.usedLimit)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-right">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Disponível</span>
                    <p className="text-base font-black text-success tracking-tight">
                      {formatCurrency(stat.available)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-50 dark:border-slate-700">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out rounded-full ${barColor}`}
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center px-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                      {stat.percentage.toFixed(1)}% do limite comprometido
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                      Limite total {formatCurrency(card.limit)}
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
