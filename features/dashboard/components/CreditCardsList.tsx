
import React, { useState } from 'react';
import { CreditCard } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { formatCurrency } from '../../../utils/formatters';

interface CreditCardsListProps {
  cards: CreditCard[];
  onAddCard: () => void;
  onDeleteCard: (id: string) => void;
}

const getBankInfo = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('nubank')) return { color: '#820ad1', logo: 'https://poup-beta.web.app/Icon/Nubank.svg' };
  if (lowerName.includes('bradesco')) return { color: '#cc092f', logo: 'https://poup-beta.web.app/Icon/bradesco.svg' };
  if (lowerName.includes('itaú') || lowerName.includes('itau')) return { color: '#ec7000', logo: 'https://poup-beta.web.app/Icon/itau.svg' };
  if (lowerName.includes('inter')) return { color: '#ff7a00', logo: 'https://cdn.jsdelivr.net/gh/Tgentil/Bancos-em-SVG@main/Banco%20Inter%20S.A/inter.svg' };
  if (lowerName.includes('santander')) return { color: '#ec0000', logo: 'https://poup-beta.web.app/Icon/santander.svg' };
  return { color: '#64748b', logo: null };
};

export const CreditCardsList: React.FC<CreditCardsListProps> = ({ cards, onAddCard, onDeleteCard }) => {
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

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
          <button className="text-xs font-bold text-success hover:opacity-80 transition-opacity">
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
          <p className="mb-6 max-w-[220px] text-xs font-bold text-slate-400">
            Adicione seus cartões para controlar seus limites e faturas de forma inteligente.
          </p>
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
            const info = getBankInfo(card.name);
            return (
              <div 
                key={card.id} 
                className="group relative overflow-hidden rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:scale-[1.01]"
              >
                {/* Lateral Accent */}
                <div className="absolute top-0 left-0 h-full w-2" style={{ backgroundColor: info.color }}></div>
                
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-5">
                    <div 
                      className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md relative overflow-hidden"
                      style={{ backgroundColor: info.color }}
                    >
                      <div className="absolute inset-0 bg-white/5 pointer-events-none"></div>
                      <span className="material-symbols-outlined text-3xl">credit_card</span>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-800 leading-none mb-1">{card.name}</p>
                      <p className="text-[11px] font-bold text-slate-400 tracking-tight">Vencimento dia {card.dueDay}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setCardToDelete(card.id)}
                    className="text-slate-200 hover:text-danger transition-colors p-2 rounded-xl hover:bg-red-50"
                    title="Excluir cartão"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>

                <div className="mt-8 flex items-end justify-between border-t border-slate-50 pt-5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block">Limite</span>
                    <span className="text-xl font-bold text-slate-800 tracking-tighter">
                      {formatCurrency(card.limit)}
                    </span>
                  </div>
                  <div className="text-right space-y-1">
                     <span className="text-[10px] font-bold text-slate-400 block">Fatura atual</span>
                     <span className="text-2xl font-bold text-success tracking-tighter block">
                       R$ 0,00
                     </span>
                  </div>
                </div>
              </div>
            );
          })}
          
           <div className="mt-2 flex justify-center">
            <button 
              onClick={onAddCard} 
              className="flex items-center gap-2 text-[11px] font-bold text-success hover:opacity-80 transition-opacity"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Adicionar outro cartão
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!cardToDelete}
        onClose={() => setCardToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir cartão"
        message="Deseja remover este cartão? Isso não apagará as despesas já registradas vinculadas a ele."
      />
    </div>
  );
};
