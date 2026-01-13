import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useNotification } from '../../../contexts/NotificationContext';

interface NewCreditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export const NewCreditCardModal: React.FC<NewCreditCardModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSave({
        name,
        limit: parseFloat(limit) || 0,
        closingDay: parseInt(closingDay),
        dueDay: parseInt(dueDay),
        color: '#64748b', // Default
      });
      
      addNotification(`Cartão "${name}" adicionado com sucesso!`, 'success');

      // Reset
      setName('');
      setLimit('');
      setClosingDay('');
      setDueDay('');
      onClose();
    } catch (error) {
      console.error(error);
      addNotification('Erro ao adicionar cartão.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Cartão de Crédito">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        <Input 
          label="Nome do Cartão" 
          placeholder="Ex: Nubank, Inter Black" 
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />

        <Input 
          label="Limite (R$)" 
          type="number" 
          step="0.01" 
          placeholder="0,00" 
          value={limit}
          onChange={e => setLimit(e.target.value)}
          className="font-mono"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Dia Fechamento" 
            type="number" 
            min="1" 
            max="31"
            placeholder="Ex: 5" 
            value={closingDay}
            onChange={e => setClosingDay(e.target.value)}
            required
          />
          <Input 
            label="Dia Vencimento" 
            type="number" 
            min="1" 
            max="31"
            placeholder="Ex: 12" 
            value={dueDay}
            onChange={e => setDueDay(e.target.value)}
            required
          />
        </div>

        <div className="mt-4 flex gap-3">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" isLoading={loading} className="flex-1">
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
};