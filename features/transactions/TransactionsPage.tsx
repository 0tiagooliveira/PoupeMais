
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTransactions } from '../../hooks/useTransactions';
import { Transaction, TransactionType, TransactionStatus } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { MonthSelector } from '../dashboard/components/MonthSelector';
import { useAccounts } from '../../hooks/useAccounts';
import { BackButton } from '../../components/ui/BackButton';
import { NewTransactionModal, incomeCategories, expenseCategories } from '../dashboard/components/NewTransactionModal';
import { AutomationRulesModal } from '../automation/AutomationRulesModal';
import { Button } from '../../components/ui/Button';

interface TransactionsPageProps {
  title: string;
  filterType?: TransactionType | 'credit_card';
}

type SortOrder = 'desc' | 'asc';

export const TransactionsPage: React.FC<TransactionsPageProps> = ({ title: baseTitle, filterType: initialFilterType }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { accountId } = useParams<{ accountId: string }>();
  const [currentDate, setCurrentDate] = useState(new Date());
  const { transactions, loading, addTransaction, updateTransaction, deleteTransaction } = useTransactions(currentDate);
  const { accounts } = useAccounts();
  
  // Estados de Filtro e Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionForRule, setTransactionForRule] = useState<Transaction | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() => {
    return location.state?.category || null;
  });

  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>(() => {
    if (location.state?.type) return location.state.type;
    return initialFilterType && initialFilterType !== 'credit_card' ? initialFilterType : 'all';
  });

  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    if (location.state) {
      window.history.replaceState({}, document.title);
    }
  }, []);

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === accountId);
  }, [accounts, accountId]);

  const displayTitle = useMemo(() => {
    if (selectedCategory) return `${selectedCategory}`;
    if (selectedAccount) return `Extrato: ${selectedAccount.name}`;
    return baseTitle;
  }, [selectedCategory, selectedAccount, baseTitle]);

  const accountsMap = useMemo(() => {
    return accounts.reduce((acc, curr) => {
      acc[curr.id] = curr.name;
      return acc;
    }, {} as Record<string, string>);
  }, [accounts]);

  const isNeutralIncome = (t: Transaction) => {
    if (t.type !== 'income') return false;
    const desc = t.description.toLowerCase();
    const cat = t.category.toLowerCase();
    const isPayment = desc.includes('pagamento de cartão') || desc.includes('fatura') || cat.includes('pagamento de cartão');
    const isRefund = desc.includes('estorno') || cat.includes('estorno') || desc.includes('reembolso') || desc.includes('crédito de');
    return isPayment || isRefund;
  };

  const baseFilteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (accountId && t.accountId !== accountId) return false;
      if (typeFilter !== 'all') {
        if (t.type !== typeFilter) return false;
        if (typeFilter === 'income' && isNeutralIncome(t)) return false;
      }
      return true;
    });
  }, [transactions, accountId, typeFilter, initialFilterType]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    baseFilteredTransactions.forEach(t => cats.add(t.category));
    return Array.from(cats).sort();
  }, [baseFilteredTransactions]);

  const filteredTransactions = useMemo(() => {
    let result = [...baseFilteredTransactions];
    if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter);
    if (selectedCategory) result = result.filter(t => t.category === selectedCategory);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => t.description.toLowerCase().includes(query) || t.category.toLowerCase().includes(query));
    }
    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [baseFilteredTransactions, statusFilter, selectedCategory, searchQuery, sortOrder]);

  const totalBalance = useMemo(() => {
    return filteredTransactions.reduce((acc, curr) => {
      if (curr.isIgnored) return acc;
      if (isNeutralIncome(curr) && !accountId && typeFilter === 'all') return acc;
      return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
    }, 0);
  }, [filteredTransactions, accountId, typeFilter]);

  const getCategoryInfo = (category: string) => {
    const allCategories = [...incomeCategories, ...expenseCategories];
    return allCategories.find(c => c.name === category) || { icon: 'payments', color: '#64748b' };
  };

  const handleTransactionClick = (transaction: Transaction) => {
      setEditingTransaction(transaction);
      setIsModalOpen(true);
  };

  const handleCreateRule = (e: React.MouseEvent | Transaction, transaction?: Transaction) => {
    if ((e as React.MouseEvent).stopPropagation) {
        (e as React.MouseEvent).stopPropagation();
    }
    const targetTransaction = transaction || (e as Transaction);
    setTransactionForRule(targetTransaction);
    setIsRuleModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setStatusFilter('all');
    setTypeFilter(initialFilterType && initialFilterType !== 'credit_card' ? initialFilterType : 'all');
    setSortOrder('desc');
  };

  const isFiltersActive = searchQuery || selectedCategory || statusFilter !== 'all' || (typeFilter !== 'all' && typeFilter !== initialFilterType);

  const cardGradientClass = useMemo(() => {
    if (typeFilter === 'income') return 'bg-gradient-to-br from-[#21C25E] to-[#169646]';
    if (typeFilter === 'expense') return 'bg-gradient-to-br from-[#FF4444] to-[#D63030]';
    return 'bg-gradient-to-br from-slate-700 to-slate-900';
  }, [typeFilter]);

  const activeChipClass = useMemo(() => {
    if (typeFilter === 'expense') return 'bg-danger border-danger text-white shadow-md shadow-red-200';
    return 'bg-success border-success text-white shadow-md shadow-emerald-200';
  }, [typeFilter]);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
            <BackButton className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm" />
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 truncate max-w-[200px] sm:max-w-md">{displayTitle}</h2>
                </div>
                <p className="text-[10px] text-slate-400 font-bold tracking-tight uppercase">
                  {selectedCategory ? `Filtro por Categoria` : selectedAccount ? `Instituição: ${selectedAccount.name}` : 'Histórico Consolidado'}
                </p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <MonthSelector currentDate={currentDate} onMonthChange={setCurrentDate} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-2" />
            <button 
                onClick={() => navigate('/import-statement')}
                className="flex items-center gap-2 px-4 h-10 rounded-2xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-bold text-xs border border-slate-100 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                title="Importação Inteligente"
            >
                <span className="material-symbols-outlined text-lg">cloud_upload</span>
                <span className="hidden sm:inline">Importar</span>
            </button>
            <button 
                onClick={handleAddNew}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success text-white shadow-lg shadow-success/20 active:scale-90 transition-all"
            >
                <span className="material-symbols-outlined font-bold">add</span>
            </button>
        </div>
      </div>

      {/* Card de Resumo */}
      <div className={`relative overflow-hidden rounded-[32px] p-8 text-white shadow-xl transition-all duration-500 ${cardGradientClass}`}>
          <div className="absolute -right-6 -bottom-6 opacity-10">
              <span className="material-symbols-outlined text-[160px] rotate-12">
                {typeFilter === 'income' ? 'trending_up' : typeFilter === 'expense' ? 'trending_down' : 'receipt_long'}
              </span>
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2">Balanço do Período Filtrado</p>
                  <div className="text-5xl font-black tracking-tighter">{formatCurrency(totalBalance)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                  <div className="rounded-2xl bg-white/10 px-5 py-3 backdrop-blur-md border border-white/10">
                      <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">Registros</p>
                      <p className="text-xl font-black">{filteredTransactions.length}</p>
                  </div>
                  {isFiltersActive && (
                    <button onClick={clearFilters} className="rounded-2xl bg-white text-slate-900 px-5 py-3 font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                      <span className="material-symbols-outlined text-sm">filter_alt_off</span> Limpar Filtros
                    </button>
                  )}
              </div>
          </div>
      </div>

      {/* Filtros e Busca */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                <input 
                    type="text" 
                    placeholder="Buscar por descrição ou categoria..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-[22px] border-none bg-white dark:bg-slate-900 py-4 pl-12 pr-4 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                />
            </div>
            <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`flex items-center justify-center gap-2 rounded-[22px] px-6 py-4 text-sm font-bold transition-all ${showAdvancedFilters ? 'bg-slate-800 text-white shadow-lg' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <span className="material-symbols-outlined text-xl">tune</span> Filtros {isFiltersActive && <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>}
            </button>
            <button onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')} className="flex items-center justify-center gap-2 rounded-[22px] bg-white dark:bg-slate-900 px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95">
                <span className="material-symbols-outlined text-xl">{sortOrder === 'desc' ? 'south' : 'north'}</span> {sortOrder === 'desc' ? 'Mais recentes' : 'Mais antigos'}
            </button>
        </div>

        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-[28px] bg-white dark:bg-slate-900 p-6 shadow-md animate-in slide-in-from-top-4 duration-300 border border-slate-100 dark:border-slate-800">
             <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtrar por Status</label>
                <div className="flex gap-2">
                    {['all', 'completed', 'pending'].map((s) => (
                        <button key={s} onClick={() => setStatusFilter(s as any)} className={`flex-1 rounded-xl py-2.5 text-xs font-bold border transition-all ${statusFilter === s ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                            {s === 'all' ? 'Todos' : s === 'completed' ? 'Pagos' : 'Pendentes'}
                        </button>
                    ))}
                </div>
             </div>
             <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtrar por Tipo</label>
                <div className="flex gap-2">
                    {['all', 'income', 'expense'].map((t) => (
                        <button key={t} onClick={() => { setTypeFilter(t as any); setSelectedCategory(null); }} className={`flex-1 rounded-xl py-2.5 text-xs font-bold border transition-all ${typeFilter === t ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                            {t === 'all' ? 'Todos' : t === 'income' ? 'Entradas' : 'Saídas'}
                        </button>
                    ))}
                </div>
             </div>
          </div>
        )}

        {/* Chips de Categoria */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 px-1">
            <button onClick={() => setSelectedCategory(null)} className={`flex-shrink-0 rounded-full px-5 py-2 text-[11px] font-black uppercase tracking-wider transition-all border ${!selectedCategory ? activeChipClass : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                Todas
            </button>
            {availableCategories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)} className={`flex-shrink-0 rounded-full px-5 py-2 text-[11px] font-black uppercase tracking-wider transition-all border ${selectedCategory === cat ? activeChipClass : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                    {cat}
                </button>
            ))}
        </div>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-32 space-y-4">
             <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-primary"></div>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sincronizando registros...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-24 text-center">
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[32px] bg-slate-50 dark:bg-slate-800 text-slate-200 dark:text-slate-600">
                <span className="material-symbols-outlined text-5xl">search_off</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Nenhum lançamento encontrado</h3>
            <p className="mt-2 text-sm text-slate-400 font-medium max-w-xs mx-auto">Tente ajustar seus filtros ou termos de busca para encontrar o que procura.</p>
            {isFiltersActive && <Button onClick={clearFilters} variant="secondary" className="mt-8 rounded-2xl font-bold px-10 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">Limpar todos os filtros</Button>}
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {filteredTransactions.map((transaction) => {
              const itemIsExpense = transaction.type === 'expense';
              const isNeutral = isNeutralIncome(transaction);
              let itemColor, itemBg;
              
              if (transaction.isIgnored) {
                  itemColor = 'text-slate-400 dark:text-slate-500';
                  itemBg = 'bg-slate-50 dark:bg-slate-800';
              } else if (isNeutral) {
                  itemColor = 'text-slate-600 dark:text-slate-300';
                  itemBg = 'bg-slate-100 dark:bg-slate-800';
              } else {
                  itemColor = itemIsExpense ? 'text-danger' : 'text-success';
                  itemBg = itemIsExpense ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20';
              }
              const cat = getCategoryInfo(transaction.category);
              const isParcelado = transaction.totalInstallments && transaction.totalInstallments > 1;
              const isPending = transaction.status === 'pending';
              
              return (
                <div key={transaction.id} onClick={() => handleTransactionClick(transaction)} className={`group flex cursor-pointer items-center justify-between px-6 py-5 transition-all hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${isPending ? 'opacity-60 grayscale-[0.3]' : ''} ${transaction.isIgnored ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] shadow-sm transition-transform group-hover:scale-110 ${itemBg} ${itemColor}`}>
                      <span className="material-symbols-outlined text-2xl">{transaction.isIgnored ? 'visibility_off' : (isNeutral ? 'sync_alt' : cat.icon)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-bold text-sm leading-snug truncate ${transaction.isIgnored ? 'text-slate-500 line-through decoration-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>{transaction.description}</p>
                        {isPending && <span className="text-[8px] font-black bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-widest flex-shrink-0">Pendente</span>}
                        {isParcelado && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg border flex-shrink-0 ${itemIsExpense ? 'bg-red-50 dark:bg-red-900/20 text-danger border-red-100 dark:border-red-900/30' : 'bg-emerald-50 dark:bg-emerald-900/20 text-success border-emerald-100 dark:border-emerald-900/30'}`}>{transaction.installmentNumber}/{transaction.totalInstallments}</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-tight">
                        <span className="text-slate-500 dark:text-slate-400 uppercase flex-shrink-0">{new Date(transaction.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0"></span>
                        <span className="uppercase truncate">{isNeutral ? 'Neutro' : transaction.category}</span>
                        {!accountId && <><span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0"></span><div className="flex items-center gap-1 min-w-0"><span className="material-symbols-outlined text-[12px] opacity-40">account_balance_wallet</span><span className="truncate max-w-[80px]">{accountsMap[transaction.accountId]}</span></div></>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pl-2 flex-shrink-0">
                     <div className="text-right"><span className={`text-base font-black tracking-tighter ${itemColor}`}>{isNeutral ? '' : (itemIsExpense ? '-' : '+')}{formatCurrency(transaction.amount)}</span></div>
                     <button onClick={(e) => handleCreateRule(e, transaction)} className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-400 flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100" title="Criar regra inteligente">
                        <span className="material-symbols-outlined text-base">auto_fix_high</span>
                     </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <NewTransactionModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }} onSave={async (data) => { if (editingTransaction) await updateTransaction(editingTransaction.id, data); else await addTransaction(data); }} onDelete={deleteTransaction} accounts={accounts} transactionToEdit={editingTransaction} initialType={typeFilter !== 'all' ? typeFilter : 'expense'} onCreateRule={(t) => { setIsModalOpen(false); handleCreateRule(t); }} />
      <AutomationRulesModal isOpen={isRuleModalOpen} onClose={() => { setIsRuleModalOpen(false); setTransactionForRule(null); }} baseTransaction={transactionForRule} />
    </div>
  );
};
