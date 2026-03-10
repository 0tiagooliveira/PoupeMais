import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';

interface NewGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export const NewGoalModal: React.FC<NewGoalModalProps> = ({ isOpen, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetAmount || !targetDate) return;

    setLoading(true);
    try {
      await onSave({
        title,
        targetAmount: parseFloat(targetAmount),
        currentAmount: 0,
        targetDate,
        icon: 'trophy',
        color: '#10B981'
      });
      setTitle('');
      setTargetAmount('');
      setTargetDate('');
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Criar Nova Meta">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Qual o seu objetivo?" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Viagem para Europa" required />
        <Input label="Valor da Meta (R$)" type="number" step="0.01" min="0" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="0,00" required />
        <Input label="Até quando?" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
        
        <div className="flex gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
            {loading ? 'Salvando...' : 'Criar Meta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
