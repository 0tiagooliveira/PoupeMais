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

export const CreditCardsList: React.FC<CreditCardsListProps> = ({ cards, onAddCard, onDeleteCard }) => {
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  
  const getBankColor = (name: string, defaultColor: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('nubank')) return '#820ad1';
    if (lowerName.includes('bradesco')) return '#cc092f';
    if (lowerName.includes('itaú') || lowerName.includes('itau')) return '#ec7000';
    if (lowerName.includes('inter')) return '#ff7a00';
    if (lowerName.includes('santander')) return '#ec0000';
    if (lowerName.includes('xp')) return '#000000';
    return defaultColor || '#64748b';
  };

  const handleDeleteConfirm = () => {
    if (cardToDelete) {
      onDeleteCard(cardToDelete);
      setCardToDelete(null);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">Cartões de Crédito</h3>
        {cards.length > 0 && (
          <button className="text-sm font-medium text-success hover:text-green-700 hover:underline">
            Ver todos
          </button>
        )}
      </div>
      
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-surface p-8 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-secondary">
             <span className="material-symbols-outlined text-3xl text-gray-400">credit_card</span>
          </div>
          <h4 className="mb-2 text-lg font-bold text-slate-800">Nenhum cartão cadastrado</h4>
          <p className="mb-6 max-w-sm text-sm text-secondary">
            Adicione seus cartões de crédito para ter um controle completo das suas finanças
          </p>
          <Button 
            onClick={onAddCard}
            className="bg-[#10b981] hover:bg-[#059669] text-white font-medium px-6"
            icon="add"
          >
            Adicionar cartão
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {cards.map((card) => {
            const color = getBankColor(card.name, card.color);
            return (
              <div 
                key={card.id} 
                className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="absolute top-0 left-0 h-full w-2" style={{ backgroundColor: color }}></div>
                
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm"
                      style={{ backgroundColor: color }}
                    >
                      <span className="material-symbols-outlined text-xl">credit_card</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{card.name}</p>
                      <p className="text-xs text-secondary">Vence dia {card.dueDay}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setCardToDelete(card.id)}
                    className="text-gray-300 hover:text-danger transition-colors"
                    title="Excluir cartão"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>

                <div className="mt-4 flex items-end justify-between border-t border-gray-50 pt-3">
                  <div>
                    <span className="text-xs text-secondary block">Limite</span>
                    <span className="font-semibold text-slate-700">{formatCurrency(card.limit)}</span>
                  </div>
                  <div className="text-right">
                     <span className="text-xs text-secondary block">Fatura Atual</span>
                     <span className="font-bold text-primary text-lg">R$ 0,00</span>
                  </div>
                </div>
              </div>
            );
          })}
          
           <div className="mt-2 flex justify-center">
            <Button 
              onClick={onAddCard} 
              variant="ghost"
              className="text-primary hover:bg-blue-50"
            >
              + Adicionar outro cartão
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      <ConfirmationModal
        isOpen={!!cardToDelete}
        onClose={() => setCardToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Cartão"
        message="Tem certeza que deseja remover este cartão? O histórico de faturas pode ser perdido."
      />
    </div>
  );
};