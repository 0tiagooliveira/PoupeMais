import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { useNotification } from '../../../contexts/NotificationContext';
import { Account } from '../../../types';

interface NewAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  accountToEdit?: Account | null;
}

export const NewAccountModal: React.FC<NewAccountModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    onDelete, 
    accountToEdit 
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('Conta corrente');
  const [initialBalance, setInitialBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { addNotification } = useNotification();

  useEffect(() => {
    if (isOpen) {
        if (accountToEdit) {
            setName(accountToEdit.name);
            setType(accountToEdit.type);
            setInitialBalance(accountToEdit.balance.toString());
        } else {
            setName('');
            setType('Conta corrente');
            setInitialBalance('');
        }
    }
  }, [isOpen, accountToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSave({
        name,
        type,
        initialBalance: parseFloat(initialBalance) || 0,
        balance: parseFloat(initialBalance) || 0,
        color: '#64748b', 
      });
      
      const action = accountToEdit ? 'atualizada' : 'criada';
      addNotification(`Conta "${name}" ${action} com sucesso!`, 'success');

      onClose();
    } catch (error) {
      console.error(error);
      addNotification('Erro ao salvar conta.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!accountToEdit || !onDelete) return;
    
    setLoading(true);
    try {
        await onDelete(accountToEdit.id);
        addNotification('Conta excluída.', 'success');
        setShowDeleteConfirm(false);
        onClose();
    } catch (error) {
        console.error(error);
        addNotification('Erro ao excluir conta.', 'error');
    } finally {
        setLoading(false);
    }
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={accountToEdit ? "Editar Conta" : "Nova Conta"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        <Input 
          label="Nome da Conta" 
          placeholder="Ex: Nubank, Bradesco, Carteira" 
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-secondary">Tipo de Conta</label>
          <select 
            className="w-full rounded-lg border border-gray-200 bg-surface px-4 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            value={type}
            onChange={e => setType(e.target.value)}
          >
            <option value="Conta corrente">Conta corrente</option>
            <option value="Poupança">Poupança</option>
            <option value="Investimentos">Investimentos</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Outros">Outros</option>
          </select>
        </div>

        <Input 
          label={accountToEdit ? "Saldo Atual (R$)" : "Saldo Inicial (R$)"}
          type="number" 
          step="0.01" 
          placeholder="0,00" 
          value={initialBalance}
          onChange={e => setInitialBalance(e.target.value)}
          className="font-mono"
        />

        <div className="mt-4 flex gap-3">
          {accountToEdit && onDelete && (
                <Button 
                    type="button" 
                    variant="danger" 
                    onClick={() => setShowDeleteConfirm(true)} 
                    isLoading={loading}
                    className="w-12 px-0 flex items-center justify-center"
                    title="Excluir"
                >
                    <span className="material-symbols-outlined text-xl">delete</span>
                </Button>
            )}

          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" isLoading={loading} className="flex-1">
            {accountToEdit ? 'Atualizar' : 'Criar Conta'}
          </Button>
        </div>
      </form>
    </Modal>

    <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Conta Bancária"
        message={`Tem certeza que deseja apagar a conta "${name}"? Todas as transações vinculadas poderão ficar sem referência.`}
        isLoading={loading}
    />
    </>
  );
};