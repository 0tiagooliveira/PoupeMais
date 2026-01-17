
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { TransactionType, Account, Transaction, TransactionStatus, TransactionFrequency, Category } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { useCategories } from '../../../hooks/useCategories';
import { getIconByCategoryName } from '../../../utils/categoryIcons';
import { BankLogo } from './AccountsList';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  accounts: Account[];
  transactionToEdit?: Transaction | null;
  initialType?: TransactionType;
  initialCategory?: string;
}

export const incomeCategories = [
  { name: 'Salário', icon: 'payments', color: '#21C25E' },
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
  { name: 'Loteria', icon: 'casino', color: '#21C25E' },
  { name: 'Transferência', icon: 'sync_alt', color: '#94A3B8' },
  { name: 'Décimo terceiro', icon: 'calendar_month', color: '#059669' },
  { name: 'Resgate', icon: 'move_to_inbox', color: '#0D9488' },
  { name: 'Lucros', icon: 'query_stats', color: '#4ADE80' },
  { name: 'Outros', icon: 'more_horiz', color: '#CBD5E1' }
];

export const expenseCategories = [
  { name: 'Alimentação', icon: 'restaurant', color: '#FF4444' },
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
  { name: 'Bem-estar', icon: 'spa', color: '#21C25E' },
  { name: 'Empréstimos', icon: 'handshake', color: '#991B1B' },
  { name: 'Poupança', icon: 'savings', color: '#21C25E' },
  { name: 'Vestiário', icon: 'checkroom', color: '#DB2777' },
  { name: 'Beleza', icon: 'face', color: '#F472B6' },
  { name: 'Carro', icon: 'local_gas_station', color: '#1E40AF' },
  { name: 'Serviços', icon: 'miscellaneous_services', color: '#94A3B8' },
  { name: 'Outros', icon: 'more_horiz', color: '#94A3B8' }
];

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  accounts,
  transactionToEdit,
  initialType = 'expense',
  initialCategory = ''
}) => {
  const { allCategories } = useCategories();
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<TransactionStatus>('completed');
  const [isFixed, setIsFixed] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isIgnored, setIsIgnored] = useState(false);
  const [frequency, setFrequency] = useState<TransactionFrequency>('monthly');
  const [repeatCount, setRepeatCount] = useState('12');
  
  const [isCategorySelectorOpen, setIsCategorySelectorOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotification();

  useEffect(() => {
    if (isOpen) {
      if (transactionToEdit) {
        setType(transactionToEdit.type);
        setAmount(transactionToEdit.amount.toString());
        setDescription(transactionToEdit.description);
        setCategory(transactionToEdit.category);
        setAccountId(transactionToEdit.accountId);
        setDate(transactionToEdit.date.split('T')[0]);
        setStatus(transactionToEdit.status);
        setIsFixed(transactionToEdit.isFixed);
        setIsRecurring(transactionToEdit.isRecurring);
        setIsIgnored(!!transactionToEdit.isIgnored);
        setFrequency(transactionToEdit.frequency || 'monthly');
      } else {
        setType(initialType);
        setAmount('');
        setDescription('');
        setCategory(initialCategory);
        setAccountId(accounts.length > 0 ? accounts[0].id : '');
        setDate(new Date().toISOString().split('T')[0]);
        setStatus('completed');
        setIsFixed(false);
        setIsRecurring(false);
        setIsIgnored(false);
        setFrequency('monthly');
        setRepeatCount('12');
      }
      setIsCategorySelectorOpen(false);
      setCategorySearch('');
    }
  }, [isOpen, transactionToEdit, accounts, initialType, initialCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !accountId || !category) {
      addNotification('Preencha valor, descrição, conta e categoria.', 'warning');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        type,
        amount: parseFloat(amount),
        description,
        category,
        accountId,
        date: new Date(date).toISOString(),
        status,
        isFixed,
        isRecurring,
        frequency: isRecurring ? frequency : undefined,
        repeatCount: isRecurring ? parseInt(repeatCount) : undefined,
        isIgnored
      });
      addNotification(transactionToEdit ? 'Lançamento atualizado!' : 'Lançamento adicionado!', 'success');
      onClose();
    } catch (error) {
      addNotification('Erro ao salvar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!transactionToEdit || !onDelete) return;
    setLoading(true);
    try {
      await onDelete(transactionToEdit.id);
      addNotification('Lançamento removido.', 'info');
      setIsDeleteModalOpen(false);
      onClose();
    } catch (error) {
      addNotification('Erro ao excluir.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = useMemo(() => {
    return allCategories
      .filter(c => c.type === type)
      .filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()));
  }, [allCategories, type, categorySearch]);

  const selectedCategoryData = useMemo(() => {
    return allCategories.find(c => c.name === category && c.type === type);
  }, [allCategories, category, type]);

  const themeColor = type === 'expense' ? 'text-danger' : 'text-success';
  const themeBorder = type === 'expense' ? 'border-red-200' : 'border-emerald-200';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={transactionToEdit ? 'Editar Lançamento' : 'Novo Lançamento'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 pt-2 relative">
        {isCategorySelectorOpen && (
          <div className="absolute inset-0 z-20 bg-surface flex flex-col animate-in slide-in-from-right duration-300">
             <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-50">
                <button type="button" onClick={() => setIsCategorySelectorOpen(false)} className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600">
                   <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h3 className="text-sm font-bold text-slate-800">Selecione uma Categoria</h3>
             </div>
             <div className="mb-4 relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input type="text" placeholder="Buscar categoria..." value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="w-full bg-slate-50 rounded-xl py-3 pl-10 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all" autoFocus />
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar pb-4 pr-1">
                <div className="grid grid-cols-3 gap-3">
                   {filteredCategories.map(cat => (
                      <button key={cat.id || cat.name} type="button" onClick={() => { setCategory(cat.name); setIsCategorySelectorOpen(false); }} className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all active:scale-95">
                         <div className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm text-white text-xl" style={{ backgroundColor: cat.color }}>
                            <span className="material-symbols-outlined">{cat.icon || getIconByCategoryName(cat.name)}</span>
                         </div>
                         <span className="text-[10px] font-bold text-slate-600 text-center leading-tight line-clamp-2">{cat.name}</span>
                      </button>
                   ))}
                </div>
             </div>
          </div>
        )}

        <div className="flex p-1 bg-slate-100 rounded-2xl relative">
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-white shadow-sm transition-all duration-300 ease-out ${type === 'income' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`} />
          <button type="button" onClick={() => { setType('expense'); setCategory(''); }} className={`flex-1 relative z-10 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${type === 'expense' ? 'text-danger' : 'text-slate-400'}`}>Despesa</button>
          <button type="button" onClick={() => { setType('income'); setCategory(''); }} className={`flex-1 relative z-10 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${type === 'income' ? 'text-success' : 'text-slate-400'}`}>Receita</button>
        </div>

        <div className="text-center">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Valor da transação</label>
            <div className="relative inline-flex items-center justify-center">
                <span className={`text-3xl font-bold mr-2 ${themeColor} opacity-60`}>R$</span>
                <input type="number" step="0.01" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} required autoFocus={!transactionToEdit} className={`w-full max-w-[240px] bg-transparent text-5xl font-black tracking-tighter outline-none text-center placeholder:text-slate-200 ${themeColor}`} />
            </div>
        </div>

        <div className="relative">
             <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><span className="material-symbols-outlined text-slate-400">edit</span></div>
             <input type="text" placeholder="Descrição (ex: Mercado, Salário)" value={description} onChange={e => setDescription(e.target.value)} required className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-slate-700 outline-none border border-transparent focus:bg-white focus:border-slate-200 focus:shadow-sm transition-all placeholder:text-slate-400" />
        </div>

        <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Categoria</label>
            <button type="button" onClick={() => setIsCategorySelectorOpen(true)} className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all active:scale-[0.98] ${category ? `bg-white ${themeBorder} shadow-sm` : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200'}`}>
               <div className="flex items-center gap-3">
                  {category && selectedCategoryData ? (
                     <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: selectedCategoryData.color }}><span className="material-symbols-outlined">{selectedCategoryData.icon || getIconByCategoryName(category)}</span></div>
                  ) : (
                     <div className="h-10 w-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400"><span className="material-symbols-outlined">category</span></div>
                  )}
                  <div className="text-left">
                     <span className={`block text-sm font-bold ${category ? 'text-slate-800' : 'text-slate-400'}`}>{category || "Selecionar categoria"}</span>
                     {category && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Toque para alterar</span>}
                  </div>
               </div>
               <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
        </div>

        <div className="space-y-4">
             <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-1">Conta / Cartão</label>
                <div className="flex gap-3 overflow-x-auto pb-2 px-1 no-scrollbar">
                    {accounts.map(acc => {
                        const isSelected = accountId === acc.id;
                        return (
                            <button key={acc.id} type="button" onClick={() => setAccountId(acc.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap ${isSelected ? `bg-slate-800 border-slate-800 text-white shadow-md` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                                <div className="bg-white rounded-full p-0.5"><BankLogo name={acc.name} color={acc.color} size="sm" /></div>
                                <span className="text-xs font-bold">{acc.name}</span>
                            </button>
                        )
                    })}
                </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-2xl p-2 border border-slate-100">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-2">Data</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-transparent font-bold text-slate-700 outline-none px-2 text-sm" />
                </div>
                <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                    <button type="button" onClick={() => setStatus('completed')} className={`flex-1 rounded-xl flex items-center justify-center transition-all ${status === 'completed' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}><span className="material-symbols-outlined text-lg">check_circle</span></button>
                    <button type="button" onClick={() => setStatus('pending')} className={`flex-1 rounded-xl flex items-center justify-center transition-all ${status === 'pending' ? 'bg-white shadow-sm text-amber-500' : 'text-slate-400'}`}><span className="material-symbols-outlined text-lg">schedule</span></button>
                </div>
             </div>
        </div>

        <div className="space-y-3 pt-2">
             <div className={`flex items-center justify-between p-3 rounded-2xl border ${isIgnored ? 'border-slate-200 bg-slate-50' : 'border-transparent hover:bg-slate-50'} transition-all`}>
                <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isIgnored ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'}`}><span className="material-symbols-outlined text-lg">visibility_off</span></div>
                    <div><span className="text-xs font-bold text-slate-700 block">Ignorar lançamento</span><span className="text-[10px] text-slate-400 block">Não contabilizar em saldos ou relatórios</span></div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={isIgnored} onChange={e => setIsIgnored(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-800"></div>
                </label>
             </div>
             <div className={`flex flex-col rounded-2xl border transition-all ${isRecurring ? 'border-indigo-100 bg-indigo-50/30' : 'border-transparent hover:bg-slate-50'}`}>
                <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isRecurring ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}><span className="material-symbols-outlined text-lg">update</span></div>
                        <div><span className="text-xs font-bold text-slate-700 block">Repetir lançamento</span></div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                </div>
                {isRecurring && (
                     <div className="px-3 pb-3 flex items-center gap-3 animate-in slide-in-from-top-2">
                        <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className="flex-1 bg-white border border-indigo-100 text-xs font-bold text-indigo-700 rounded-xl py-2 px-3 outline-none">
                            <option value="daily">Diariamente</option>
                            <option value="weekly">Semanalmente</option>
                            <option value="monthly">Mensalmente</option>
                            <option value="yearly">Anualmente</option>
                        </select>
                        <div className="flex items-center gap-2 bg-white border border-indigo-100 rounded-xl px-3 py-1">
                            <span className="text-xs font-bold text-indigo-400">x</span>
                            <input type="number" value={repeatCount} onChange={e => setRepeatCount(e.target.value)} className="w-8 text-center font-bold text-indigo-700 outline-none text-sm" min="2" max="360" />
                        </div>
                     </div>
                 )}
             </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-50 mt-2">
          {transactionToEdit && (
             <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="w-12 h-12 flex items-center justify-center rounded-2xl border border-slate-100 text-slate-400 hover:text-danger hover:bg-red-50 transition-all"><span className="material-symbols-outlined">delete</span></button>
          )}
          <Button type="submit" isLoading={loading} className={`flex-1 rounded-2xl font-bold h-12 text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all ${type === 'expense' ? 'bg-danger shadow-red-200' : 'bg-success shadow-emerald-200'}`}>{transactionToEdit ? 'Salvar Alterações' : 'Confirmar Lançamento'}</Button>
        </div>
      </form>
      <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDelete} title="Excluir Lançamento" message="Tem certeza que deseja remover este lançamento? O saldo da conta será atualizado." confirmText="Sim, excluir" variant="danger" isLoading={loading} />
    </Modal>
  );
};
