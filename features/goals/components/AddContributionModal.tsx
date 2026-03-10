import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { FinancialGoal } from '../../../types';

interface AddContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: FinancialGoal | null;
  onSave: (goalId: string, amount: number) => Promise<void>;
}

export const AddContributionModal: React.FC<AddContributionModalProps> = ({ isOpen, onClose, goal, onSave }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal || !amount) return;

    setLoading(true);
    try {
      await onSave(goal.id, parseFloat(amount));
      setAmount('');
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={goal ? `Aporte: ${goal.title}` : 'Novo Aporte'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500 mb-4">Adicione dinheiro � sua meta para acompanhar o progresso!</p>
        <Input label="Valor do Aporte (R$)" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
        
        <div className="flex gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
            {loading ? 'Salvando...' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
