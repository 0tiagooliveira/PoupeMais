
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { TransactionType, Account, Transaction, TransactionStatus, TransactionFrequency, Category } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { useCategories } from '../../../hooks/useCategories';

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
  { name: 'Salário', icon: 'payments', color: '#10B981' },
  { name: 'Freelance', icon: 'computer', color: '#0EA5E9' },
  { name: 'Bônus', icon: 'stars', color: '#F59E0B' },
  { name: 'Comissões', icon: 'trending_up', color: '#8B5CF6' },
  { name: 'Aluguel recebido', icon: 'real_estate_agent', color: '#6366F1' },
  { name: 'Investimentos', icon: 'show_chart', color: '#14B8A6' },
  { name: 'Dividendos', icon: 'pie_chart', color: '#22C55E' },
  { name: 'Juros recebidos', icon: 'percent', color: '#84CC16' },
  { name: 'Cashback', icon: 'currency_exchange', color: '#EC4899' },
  { name: 'Venda de produtos', icon: 'storefront', color: '#F97316' },
  { name: 'Venda de serviços', icon: 'design_services', color: '#06B6D4' },
  { name: 'Reembolso', icon: 'undo', color: '#64748B' },
  { name: 'Restituição', icon: 'account_balance', color: '#3B82F6' },
  { name: 'Premiações', icon: 'emoji_events', color: '#EAB308' },
  { name: 'Herança', icon: 'diversity_3', color: '#A855F7' },
  { name: 'Aposentadoria', icon: 'elderly', color: '#475569' },
  { name: 'Pensão', icon: 'child_friendly', color: '#FB7185' },
  { name: 'Doações', icon: 'volunteer_activism', color: '#F43F5E' },
  { name: 'Loteria', icon: 'casino', color: '#10B981' },
  { name: 'Transferência', icon: 'sync_alt', color: '#94A3B8' },
  { name: 'Décimo terceiro', icon: 'calendar_month', color: '#059669' },
  { name: 'Resgate', icon: 'move_to_inbox', color: '#0D9488' },
  { name: 'Lucros', icon: 'query_stats', color: '#4ADE80' },
  { name: 'Outros', icon: 'more_horiz', color: '#CBD5E1' }
];

export const expenseCategories = [
  { name: 'Alimentação', icon: 'restaurant', color: '#EF4444' },
  { name: 'Transporte', icon: 'directions_car', color: '#3B82F6' },
  { name: 'Moradia', icon: 'home', color: '#6366F1' },
  { name: 'Mercado', icon: 'shopping_cart', color: '#F59E0B' },
  { name: 'Compras', icon: 'shopping_bag', color: '#EC4899' },
  { name: 'Saúde', icon: 'medical_services', color: '#14B8A6' },
  { name: 'Educação', icon: 'school', color: '#8B5CF6' },
  { name: 'Lazer', icon: 'sports_esports', color: '#F97316' },
  { name: 'Viagem', icon: 'flight', color: '#0EA5E9' },
  { name: 'Assinaturas', icon: 'subscriptions', color: '#D946EF' },
  { name: 'Cartão de crédito', icon: 'credit_card', color: '#475569' },
  { name: 'Impostos', icon: 'gavel', color: '#B91C1C' },
  { name: 'Presentes', icon: 'card_giftcard', color: '#EAB308' },
  { name: 'Pets', icon: 'pets', color: '#A855F7' },
  { name: 'Manutenção', icon: 'build', color: '#64748B' },
  { name: 'Telefonia', icon: 'smartphone', color: '#2563EB' },
  { name: 'Energia', icon: 'bolt', color: '#FBBF24' },
  { name: 'Água', icon: 'water_drop', color: '#06B6D4' },
  { name: 'Gás', icon: 'propane', color: '#FB923C' },
  { name: 'Bem-estar', icon: 'spa', color: '#10B981' },
  { name: 'Empréstimos', icon: 'handshake', color: '#991B1B' },
  { name: 'Poupança', icon: 'savings', color: '#22C55E' },
  { name: 'Vestiário', icon: 'checkroom', color: '#DB2777' },
  { name: 'Beleza', icon: 'face', color: '#F472B6' },
  { name: 'Carro', icon: 'local_gas_station', color: '#1E40AF' },
  { name: 'Outros', icon: 'more_horiz', color: '#94A3B8' }
];

const AVAILABLE_ICONS = [
  'payments', 'shopping_cart', 'restaurant', 'directions_car', 'home', 
  'medical_services', 'school', 'sports_esports', 'flight', 'subscriptions',
  'credit_card', 'gavel', 'card_giftcard', 'pets', 'build', 'smartphone',
  'bolt', 'water_drop', 'propane', 'spa', 'handshake', 'savings', 'checkroom',
  'face', 'local_gas_station', 'more_horiz', 'computer', 'stars', 'trending_up',
  'real_estate_agent', 'show_chart', 'pie_chart', 'percent', 'currency_exchange',
  'storefront', 'design_services', 'undo', 'account_balance', 'emoji_events',
  'diversity_3', 'elderly', 'child_friendly', 'volunteer_activism', 'casino',
  'sync_alt', 'calendar_month', 'move_to_inbox', 'query_stats'
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
  const { allCategories, addCustomCategory } = useCategories();
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
  const [isNewCategoryOpen, setIsNewCategoryOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('category');
  const [newCatColor, setNewCatColor] = useState('#21C25E');

  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { addNotification } = useNotification();

  const currentCategories = useMemo(() => 
    allCategories.filter(c => c.type === type), 
  [allCategories, type]);

  const activeCategory = useMemo(() => 
    currentCategories.find(c => c.name === category) || { name: 'Outros', icon: 'more_horiz', color: '#94A3B8' }, 
  [category, currentCategories]);

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
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        addNotification('Insira um valor válido.', 'warning');
        setLoading(false);
        return;
    }

    const parsedRepeat = parseInt(repeatCount);
    const finalRepeat = isNaN(parsedRepeat) ? 1 : Math.max(1, parsedRepeat);

    try {
      await onSave({
        description,
        amount: parsedAmount,
        type,
        category,
        accountId: selectedAccount,
        date: new Date(date).toISOString(),
        status: isPaid ? 'completed' : 'pending',
        isFixed,
        isRecurring,
        frequency: isRecurring ? frequency : undefined,
        repeatCount: isRecurring ? finalRepeat : 1
      });
      
      const successMsg = transactionToEdit 
        ? 'Lançamento atualizado com sucesso!' 
        : (type === 'income' ? 'Receita adicionada!' : 'Despesa registrada!');
      
      addNotification(successMsg, 'finance', 4000, true);
      onClose();
    } catch (error) {
      console.error("Save error:", error);
      addNotification('Erro ao salvar lançamento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await addCustomCategory({
        name: newCatName,
        icon: newCatIcon,
        color: newCatColor,
        type: type
      });
      setCategory(newCatName);
      setIsNewCategoryOpen(false);
      setIsPickerOpen(false);
      setNewCatName('');
      addNotification(`Categoria "${newCatName}" criada!`, 'success');
    } catch (error) {
      addNotification('Erro ao criar categoria.', 'error');
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
                    <input type="number" min="1" placeholder="Parcelas" value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold outline-none" />
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
        <div className="mb-4">
            <button 
                onClick={() => setIsNewCategoryOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-xs font-bold text-slate-400 hover:border-primary hover:text-primary transition-all"
            >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Criar Nova Categoria
            </button>
        </div>
        <div className="grid grid-cols-3 gap-3 max-h-[40vh] overflow-y-auto p-1 custom-scrollbar">
            {currentCategories.map((cat) => (
                <button 
                    key={cat.id || cat.name} 
                    type="button" 
                    onClick={() => { setCategory(cat.name); setIsPickerOpen(false); }} 
                    className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all duration-200 active:scale-95 ${
                        category === cat.name 
                        ? 'bg-primary text-white shadow-lg' 
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

    <Modal isOpen={isNewCategoryOpen} onClose={() => setIsNewCategoryOpen(false)} title="Nova Categoria">
        <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4">
                <div 
                    className="h-16 w-16 rounded-full flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: `${newCatColor}20`, color: newCatColor }}
                >
                    <span className="material-symbols-outlined text-3xl">{newCatIcon}</span>
                </div>
                <Input 
                    label="Nome da categoria" 
                    placeholder="Ex: Jogos, Doações..." 
                    value={newCatName} 
                    onChange={e => setNewCatName(e.target.value)} 
                    className="w-full"
                />
            </div>

            <div>
                <label className="text-xs font-bold text-slate-400 mb-3 block">Escolha um ícone</label>
                <div className="grid grid-cols-6 gap-2 max-h-[150px] overflow-y-auto p-1 custom-scrollbar">
                    {AVAILABLE_ICONS.map(icon => (
                        <button 
                            key={icon}
                            onClick={() => setNewCatIcon(icon)}
                            className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${newCatIcon === icon ? 'bg-primary text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                            <span className="material-symbols-outlined text-lg">{icon}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="text-xs font-bold text-slate-400 mb-3 block">Cor</label>
                <div className="flex flex-wrap gap-2">
                    {['#21C25E', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#0EA5E9', '#14B8A6'].map(color => (
                        <button 
                            key={color}
                            onClick={() => setNewCatColor(color)}
                            className={`h-8 w-8 rounded-full border-2 transition-all ${newCatColor === color ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                    <input 
                        type="color" 
                        value={newCatColor} 
                        onChange={e => setNewCatColor(e.target.value)}
                        className="h-8 w-8 rounded-full bg-transparent overflow-hidden cursor-pointer"
                    />
                </div>
            </div>

            <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsNewCategoryOpen(false)} className="flex-1 rounded-2xl font-bold">Cancelar</Button>
                <Button onClick={handleCreateCategory} className="flex-1 rounded-2xl font-bold bg-primary text-white">Criar</Button>
            </div>
        </div>
    </Modal>

    <ConfirmationModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={async () => { if (transactionToEdit && onDelete) { setLoading(true); await onDelete(transactionToEdit.id); setLoading(false); setShowDeleteConfirm(false); onClose(); } }} title="Excluir" message="Deseja realmente apagar este registro?" />
    </>
  );
};
