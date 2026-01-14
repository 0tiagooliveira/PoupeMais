import React, { useState, useEffect, useMemo } from 'react';
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

export const incomeCategories = [
  { name: 'Salário', icon: 'attach_money', color: '#21C25E' },
  { name: 'Freelance', icon: 'work', color: '#2BDC6F' },
  { name: 'Bônus', icon: 'card_giftcard', color: '#45E883' },
  { name: 'Comissões', icon: 'trending_up', color: '#21C25E' },
  { name: 'Aluguel recebido', icon: 'home', color: '#047857' },
  { name: 'Investimentos', icon: 'show_chart', color: '#065f46' },
  { name: 'Dividendos', icon: 'account_balance_wallet', color: '#21C25E' },
  { name: 'Juros recebidos', icon: 'percent', color: '#2BDC6F' },
  { name: 'Cashback', icon: 'credit_card', color: '#21C25E' },
  { name: 'Venda de produtos', icon: 'shopping_cart', color: '#21C25E' },
  { name: 'Venda de serviços', icon: 'handshake', color: '#2BDC6F' },
  { name: 'Reembolso', icon: 'receipt', color: '#45E883' },
  { name: 'Restituição', icon: 'account_balance', color: '#047857' },
  { name: 'Premiações', icon: 'emoji_events', color: '#fbbf24' },
  { name: 'Herança', icon: 'family_restroom', color: '#6366f1' },
  { name: 'Aposentadoria', icon: 'elderly', color: '#64748b' },
  { name: 'Pensão', icon: 'child_care', color: '#ec4899' },
  { name: 'Doações', icon: 'volunteer_activism', color: '#f43f5e' },
  { name: 'Loteria', icon: 'casino', color: '#fbbf24' },
  { name: 'Transferência', icon: 'swap_horiz', color: '#94a3b8' },
  { name: 'Décimo terceiro', icon: 'calendar_month', color: '#21C25E' },
  { name: 'Resgate', icon: 'savings', color: '#2BDC6F' },
  { name: 'Lucros', icon: 'business', color: '#21C25E' },
  { name: 'Outros', icon: 'more_horiz', color: '#94a3b8' }
];

export const expenseCategories = [
  { name: 'Alimentação', icon: 'restaurant', color: '#FF4444' },
  { name: 'Transporte', icon: 'directions_car', color: '#3b82f6' },
  { name: 'Moradia', icon: 'home', color: '#6366f1' },
  { name: 'Mercado', icon: 'shopping_cart', color: '#f59e0b' },
  { name: 'Compras', icon: 'local_mall', color: '#ec4899' },
  { name: 'Saúde', icon: 'local_hospital', color: '#21C25E' },
  { name: 'Educação', icon: 'school', color: '#8b5cf6' },
  { name: 'Lazer', icon: 'sports_soccer', color: '#f97316' },
  { name: 'Viagem', icon: 'flight', color: '#06b6d4' },
  { name: 'Assinaturas', icon: 'subscriptions', color: '#FF4444' },
  { name: 'Cartão de crédito', icon: 'credit_card', color: '#475569' },
  { name: 'Impostos', icon: 'paid', color: '#FF4444' },
  { name: 'Presentes', icon: 'emoji_events', color: '#fbbf24' },
  { name: 'Pets', icon: 'pets', color: '#f59e0b' },
  { name: 'Manutenção', icon: 'build', color: '#64748b' },
  { name: 'Telefonia', icon: 'phone_iphone', color: '#3b82f6' },
  { name: 'Energia', icon: 'bolt', color: '#fbbf24' },
  { name: 'Água', icon: 'water_drop', color: '#0ea5e9' },
  { name: 'Gás', icon: 'local_fire_department', color: '#f97316' },
  { name: 'Bem-estar', icon: 'self_improvement', color: '#ec4899' },
  { name: 'Empréstimos', icon: 'attach_money', color: '#FF4444' },
  { name: 'Poupança', icon: 'savings', color: '#21C25E' },
  { name: 'Outros', icon: 'more_horiz', color: '#94a3b8' }
];

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
  const [isPaid, setIsPaid] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  const [frequency, setFrequency] = useState<TransactionFrequency>('monthly');
  const [repeatCount, setRepeatCount] = useState('2'); 

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { addNotification } = useNotification();

  const currentCategories = type === 'income' ? incomeCategories : expenseCategories;
  const activeCategory = useMemo(() => currentCategories.find(c => c.name === category) || currentCategories[currentCategories.length - 1], [category, currentCategories]);

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
      await onSave({
        description,
        amount: parseFloat(amount),
        type,
        category,
        accountId: selectedAccount,
        date: new Date(date).toISOString(),
        status: isPaid ? 'completed' : 'pending',
        isFixed,
        isRecurring,
        frequency: isRecurring ? frequency : undefined,
        repeatCount: isRecurring ? parseInt(repeatCount) : 1
      });
      
      const successMsg = transactionToEdit 
        ? 'Lançamento atualizado com sucesso!' 
        : (type === 'income' ? 'Receita adicionada!' : 'Despesa registrada!');
      
      addNotification(successMsg, 'finance', 4000, true);
      onClose();
    } catch (error) {
      addNotification('Erro ao salvar lançamento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isExpense = type === 'expense';
  const primaryColor = isExpense ? 'text-danger' : 'text-success';

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={transactionToEdit ? "Editar lançamento" : "Novo lançamento"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!transactionToEdit && (
            <div className="flex gap-1 rounded-2xl bg-gray-50 p-1.5">
                <button type="button" onClick={() => { setType('income'); setCategory('Outros'); }} className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${type === 'income' ? 'bg-white text-success shadow-md' : 'text-secondary'}`}>Receita</button>
                <button type="button" onClick={() => { setType('expense'); setCategory('Outros'); }} className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${type === 'expense' ? 'bg-white text-danger shadow-md' : 'text-secondary'}`}>Despesa</button>
            </div>
        )}

        <div className="rounded-2xl bg-gray-50/50 p-3 text-center border border-gray-100">
            <label className="mb-1 block text-[10px] font-bold text-secondary/50">Valor</label>
            <div className="flex items-center justify-center gap-1">
                <span className={`text-xl font-bold ${primaryColor}`}>R$</span>
                <input type="number" step="0.01" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className={`w-full max-w-[180px] bg-transparent text-4xl font-bold outline-none text-center ${primaryColor}`} required />
            </div>
        </div>

        <Input label="Descrição" placeholder="Ex: Mercado" value={description} onChange={(e) => setDescription(e.target.value)} required icon="edit" className="text-sm" />

        <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 ml-1">Categoria</label>
            <button type="button" onClick={() => setIsPickerOpen(true)} className="flex items-center justify-between w-full rounded-2xl border border-gray-100 bg-surface px-4 py-3 text-sm hover:bg-gray-50 active:scale-[0.98]">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full shadow-sm" style={{ backgroundColor: `${activeCategory.color}20`, color: activeCategory.color }}>
                        <span className="material-symbols-outlined text-2xl">{activeCategory.icon}</span>
                    </div>
                    <span className="font-bold text-slate-700">{category}</span>
                </div>
                <span className="material-symbols-outlined text-secondary">expand_more</span>
            </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 ml-1">Conta</label>
                <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="w-full appearance-none rounded-2xl border border-gray-100 bg-surface px-4 py-3 text-sm font-bold text-slate-700 outline-none">
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
            </div>
            <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required icon="calendar_today" className="text-sm font-bold text-slate-700" />
        </div>

        <div className="space-y-3 rounded-3xl border border-gray-100 bg-gray-50/50 p-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">{isExpense ? 'Pago' : 'Recebido'}</span>
                <button type="button" onClick={() => setIsPaid(!isPaid)} className={`relative h-6 w-11 rounded-full transition-colors ${isPaid ? 'bg-success' : 'bg-gray-300'}`}>
                    <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${isPaid ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Fixo</span>
                <button type="button" onClick={() => { setIsFixed(!isFixed); if(!isFixed) setIsRecurring(false); }} className={`relative h-6 w-11 rounded-full transition-colors ${isFixed ? 'bg-primary' : 'bg-gray-300'}`}>
                    <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${isFixed ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Parcelado</span>
                <button type="button" onClick={() => { setIsRecurring(!isRecurring); if(!isRecurring) setIsFixed(false); }} className={`relative h-6 w-11 rounded-full transition-colors ${isRecurring ? 'bg-primary' : 'bg-gray-300'}`}>
                    <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${isRecurring ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>
            {isRecurring && (
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                     <select value={frequency} onChange={(e) => setFrequency(e.target.value as TransactionFrequency)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold outline-none">
                        <option value="monthly">Mensal</option>
                        <option value="weekly">Semanal</option>
                        <option value="yearly">Anual</option>
                    </select>
                    <input type="number" min="2" placeholder="Parcelas" value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold outline-none" />
                </div>
            )}
        </div>

        <div className="flex gap-2 pt-2">
            {transactionToEdit && onDelete && (
                <button type="button" onClick={() => setShowDeleteConfirm(true)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-red-50 text-danger"><span className="material-symbols-outlined">delete</span></button>
            )}
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 font-bold h-12 rounded-2xl">Cancelar</Button>
            <Button type="submit" isLoading={loading} className={`flex-1 font-bold h-12 rounded-2xl shadow-lg ${isExpense ? 'bg-danger' : 'bg-success'}`}>Salvar</Button>
        </div>
      </form>
    </Modal>

    <Modal isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} title="Escolha a categoria">
        <div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto p-1 custom-scrollbar">
            {currentCategories.map((cat) => (
                <button 
                    key={cat.name} 
                    type="button" 
                    onClick={() => { setCategory(cat.name); setIsPickerOpen(false); }} 
                    className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all duration-200 active:scale-95 ${
                        category === cat.name 
                        ? 'bg-slate-800 text-white shadow-lg' 
                        : 'bg-slate-50 border border-transparent hover:bg-slate-100'
                    }`}
                >
                    <div 
                        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                            category === cat.name ? 'bg-white/20' : ''
                        }`} 
                        style={{ 
                            backgroundColor: category === cat.name ? undefined : `${cat.color}15`, 
                            color: category === cat.name ? '#fff' : cat.color 
                        }}
                    >
                        <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                    </div>
                    <span className={`text-[10px] font-bold text-center leading-tight ${
                        category === cat.name ? 'text-white' : 'text-slate-500'
                    }`}>
                        {cat.name}
                    </span>
                </button>
            ))}
        </div>
        <Button 
            onClick={() => setIsPickerOpen(false)} 
            variant="ghost" 
            className="mt-6 w-full rounded-2xl font-bold text-xs text-slate-400"
        >
            Fechar
        </Button>
    </Modal>

    <ConfirmationModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={async () => { if (transactionToEdit && onDelete) { setLoading(true); await onDelete(transactionToEdit.id); setLoading(false); setShowDeleteConfirm(false); onClose(); } }} title="Excluir" message="Deseja realmente apagar este registro?" />
    </>
  );
};