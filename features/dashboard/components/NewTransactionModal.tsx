import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { TransactionType, Account, Transaction, TransactionStatus, TransactionFrequency } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  accounts: Account[];
  transactionToEdit?: Transaction | null;
  initialType?: TransactionType;
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  accounts,
  transactionToEdit,
  initialType = 'expense'
}) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Outros');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Estados de Configuração
  const [isPaid, setIsPaid] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  
  // Novos estados para recorrência
  const [frequency, setFrequency] = useState<TransactionFrequency>('monthly');
  const [repeatCount, setRepeatCount] = useState('2'); 

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { addNotification } = useNotification();

  useEffect(() => {
    if (isOpen) {
      if (transactionToEdit) {
        setType(transactionToEdit.type);
        setDescription(transactionToEdit.description);
        setAmount(transactionToEdit.amount.toString());
        setCategory(transactionToEdit.category);
        setSelectedAccount(transactionToEdit.accountId);
        setDate(transactionToEdit.date.split('T')[0]);
        setIsPaid(transactionToEdit.status === 'completed');
        setIsRecurring(transactionToEdit.isRecurring || false);
        setIsFixed(transactionToEdit.isFixed || false);
        setFrequency(transactionToEdit.frequency || 'monthly');
        setRepeatCount(transactionToEdit.totalInstallments ? transactionToEdit.totalInstallments.toString() : '2');
      } else {
        // Reset para criação
        setDescription('');
        setAmount('');
        setCategory('Outros');
        setType(initialType);
        setDate(new Date().toISOString().split('T')[0]);
        setIsPaid(true);
        setIsRecurring(false);
        setIsFixed(false);
        setFrequency('monthly');
        setRepeatCount('12');
        if (accounts.length > 0) setSelectedAccount(accounts[0].id);
      }
    }
  }, [isOpen, transactionToEdit, accounts, initialType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!selectedAccount) {
      addNotification('Selecione uma conta.', 'error');
      setLoading(false);
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
        addNotification('Insira um valor válido.', 'warning');
        setLoading(false);
        return;
    }

    try {
      const status: TransactionStatus = isPaid ? 'completed' : 'pending';
      const repetitions = isRecurring && repeatCount ? parseInt(repeatCount) : 1;

      await onSave({
        description,
        amount: parseFloat(amount),
        type,
        category,
        accountId: selectedAccount,
        date: new Date(date).toISOString(),
        status,
        isFixed,
        isRecurring,
        frequency: isRecurring ? frequency : undefined,
        repeatCount: repetitions 
      });
      
      const typeLabel = type === 'income' ? 'Receita' : 'Despesa';
      const action = transactionToEdit ? 'atualizada' : 'salva';
      
      if (isRecurring && !transactionToEdit) {
        addNotification(`${typeLabel} recorrente criada (${repetitions}x) com sucesso!`, 'success');
      } else {
        addNotification(`${typeLabel} ${action} com sucesso!`, 'success');
      }

      onClose();
    } catch (error) {
      console.error(error);
      addNotification('Erro ao salvar transação.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!transactionToEdit || !onDelete) return;
    
    setLoading(true);
    try {
        await onDelete(transactionToEdit.id);
        addNotification('Transação excluída com sucesso.', 'success');
        setShowDeleteConfirm(false);
        onClose();
    } catch (error) {
        console.error(error);
        addNotification('Erro ao excluir transação.', 'error');
    } finally {
        setLoading(false);
    }
  };

  // Funções de toggle mutuamente exclusivas
  const toggleFixed = () => {
      const newState = !isFixed;
      setIsFixed(newState);
      if (newState) setIsRecurring(false); // Desativa o recorrente se ativar o fixo
  };

  const toggleRecurring = () => {
      const newState = !isRecurring;
      setIsRecurring(newState);
      if (newState) setIsFixed(false); // Desativa o fixo se ativar o recorrente
  };

  const categories = [
    { id: 'moradia', name: 'Moradia', icon: 'home' },
    { id: 'alimentacao', name: 'Alimentação', icon: 'restaurant' },
    { id: 'transporte', name: 'Transporte', icon: 'directions_car' },
    { id: 'lazer', name: 'Lazer', icon: 'movie' },
    { id: 'saude', name: 'Saúde', icon: 'medical_services' },
    { id: 'trabalho', name: 'Receita/Salário', icon: 'work' },
    { id: 'educacao', name: 'Educação', icon: 'school' },
    { id: 'compras', name: 'Compras', icon: 'shopping_bag' },
    { id: 'outros', name: 'Outros', icon: 'more_horiz' },
  ];

  const isExpense = type === 'expense';
  const primaryColor = isExpense ? 'text-danger' : 'text-success';
  const bgColor = isExpense ? 'bg-red-50' : 'bg-green-50';

  return (
    <>
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={transactionToEdit ? (isExpense ? "Editar Despesa" : "Editar Receita") : (isExpense ? "Nova Despesa" : "Nova Receita")}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        
        {/* Type Selector Toggle - Só mostra se for Nova Transação */}
        {!transactionToEdit && (
            <div className="flex gap-2 rounded-xl bg-gray-50 p-1">
                <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-200 ${
                    !isExpense 
                        ? 'bg-white text-success shadow-sm scale-[1.02]' 
                        : 'text-secondary hover:bg-gray-100'
                    }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-lg">arrow_upward</span>
                        Receita
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-200 ${
                    isExpense 
                        ? 'bg-white text-danger shadow-sm scale-[1.02]' 
                        : 'text-secondary hover:bg-gray-100'
                    }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-lg">arrow_downward</span>
                        Despesa
                    </span>
                </button>
            </div>
        )}

        {/* Amount Input Big */}
        <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-secondary">Valor</label>
            <div className={`relative flex items-center rounded-2xl border-2 bg-white px-4 py-3 transition-colors ${
                isExpense ? 'focus-within:border-red-200' : 'focus-within:border-green-200'
            } border-gray-100`}>
                <span className={`mr-2 text-lg font-bold ${primaryColor}`}>R$</span>
                <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`w-full bg-transparent text-3xl font-bold outline-none placeholder:text-gray-200 ${primaryColor}`}
                    required
                    autoFocus={!transactionToEdit}
                />
            </div>
        </div>

        {/* Description */}
        <Input
            label="Descrição"
            placeholder={isExpense ? "Ex: Compras no mercado" : "Ex: Salário mensal"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            icon="edit"
        />

        {/* Category Select */}
        <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-secondary">Categoria</label>
            <div className="relative">
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-surface px-4 py-2.5 pl-10 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                </select>
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none">
                    category
                </span>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none">
                    expand_more
                </span>
            </div>
        </div>

        {/* Account and Date Row */}
        <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-secondary">Conta</label>
                <div className="relative">
                    <select
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-gray-200 bg-surface px-4 py-2.5 pl-10 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none">
                        account_balance_wallet
                    </span>
                </div>
            </div>

            <Input
                label="Data"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                icon="calendar_today"
            />
        </div>

        {/* Options Toggles */}
        <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
            {/* Status Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined ${isPaid ? 'text-success' : 'text-gray-400'}`}>
                        {isPaid ? 'check_circle' : 'pending'}
                    </span>
                    <span className="text-sm font-medium text-slate-700">
                        {isExpense ? 'Pago' : 'Recebido'}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => setIsPaid(!isPaid)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${isPaid ? 'bg-success' : 'bg-gray-300'}`}
                >
                    <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${isPaid ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>

            {/* Fixed Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined ${isFixed ? 'text-primary' : 'text-gray-400'}`}>push_pin</span>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">
                            {isExpense ? 'Despesa Fixa' : 'Receita Fixa'}
                        </span>
                        {isFixed && <span className="text-[10px] text-secondary">Recorre mensalmente</span>}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={toggleFixed}
                    className={`relative h-6 w-11 rounded-full transition-colors ${isFixed ? 'bg-primary' : 'bg-gray-300'}`}
                >
                    <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${isFixed ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>

            {/* Recurring Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined ${isRecurring ? 'text-primary' : 'text-gray-400'}`}>update</span>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">Parcelado / Repetir</span>
                        {isRecurring && <span className="text-[10px] text-secondary">Tem fim determinado</span>}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={toggleRecurring}
                    className={`relative h-6 w-11 rounded-full transition-colors ${isRecurring ? 'bg-primary' : 'bg-gray-300'}`}
                >
                    <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${isRecurring ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>

            {/* Recurring Options */}
            {isRecurring && (
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-200 pt-3 animate-slide-in">
                     <div className="flex flex-col gap-1">
                        <label className="text-xs text-secondary">Frequência</label>
                        <select 
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as TransactionFrequency)}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none"
                        >
                            <option value="daily">Diário</option>
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensal</option>
                            <option value="yearly">Anual</option>
                        </select>
                     </div>
                     <div className="flex flex-col gap-1">
                        <label className="text-xs text-secondary">Vezes</label>
                        <input 
                            type="number" 
                            min="2" 
                            max="60"
                            value={repeatCount}
                            onChange={(e) => setRepeatCount(e.target.value)}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none"
                        />
                     </div>
                </div>
            )}
        </div>

        {/* Actions Footer */}
        <div className="flex gap-3 pt-2">
            {transactionToEdit && onDelete && (
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
            
            <Button 
                type="submit" 
                isLoading={loading} 
                className={`flex-1 ${isExpense ? 'bg-danger hover:bg-red-700' : 'bg-success hover:bg-green-700'}`}
            >
                {transactionToEdit ? 'Salvar Alterações' : 'Criar Transação'}
            </Button>
        </div>

      </form>
    </Modal>

    <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Transação"
        message="Tem certeza que deseja apagar esta transação? O saldo da conta será revertido."
        isLoading={loading}
    />
    </>
  );
};