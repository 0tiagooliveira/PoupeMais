
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTransactions } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { useCreditCards } from '../../hooks/useCreditCards';
import { useNotification } from '../../contexts/NotificationContext';
import { BalanceCard } from './components/BalanceCard';
import { MonthSelector } from './components/MonthSelector';
import { AccountsList } from './components/AccountsList';
import { CreditCardsList } from './components/CreditCardsList';
import { CategoryChartCard } from './components/CategoryChartCard';
import { TransactionSummaryCard } from './components/TransactionSummaryCard';
import { StatCard } from './components/StatCard';
import { NewTransactionModal, incomeCategories, expenseCategories } from './components/NewTransactionModal';
import { NewAccountModal } from './components/NewAccountModal';
import { NewCreditCardModal } from './components/NewCreditCardModal';
import { NotificationsModal } from './components/NotificationsModal';
import { QuickActionModal } from './components/QuickActionModal';
import { ProfileActionsModal } from '../../components/layout/ProfileActionsModal';
import { EditProfileModal } from '../settings/EditProfileModal';
import { Account, TransactionType, Transaction, CategoryData } from '../../types';
import { getIconByCategoryName } from '../../utils/categoryIcons';

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification, history, clearHistory, markAllAsRead } = useNotification();
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();
  
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [transModalType, setTransModalType] = useState<TransactionType>('expense');
  const [initialCategory, setInitialCategory] = useState<string>('');
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCreditCardModalOpen, setIsCreditCardModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileActionsOpen, setIsProfileActionsOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

  // Estados para o Menu de Ações Rápidas
  const [quickAction, setQuickAction] = useState<{
    isOpen: boolean;
    title: string;
    type: TransactionType;
    category?: CategoryData;
    transaction?: Transaction;
  }>({ isOpen: false, title: '', type: 'expense' });

  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useTransactions(currentDate);
  const { accounts, addAccount, updateAccount, deleteAccount } = useAccounts();
  const { cards, addCard, deleteCard } = useCreditCards();

  const isNeutralIncome = (t: Transaction) => {
    if (t.type !== 'income') return false;
    const desc = t.description.toLowerCase();
    const cat = t.category.toLowerCase();
    return desc.includes('pagamento de cartão') || desc.includes('fatura') || cat.includes('pagamento de cartão') || desc.includes('estorno') || cat.includes('estorno');
  };

  const { totalIncome, totalExpenses, incomeCategoriesData, expenseCategoriesData, recentIncomes, recentExpenses } = useMemo(() => {
    let income = 0;
    let expenses = 0;
    const incCatMap = new Map<string, number>();
    const expCatMap = new Map<string, number>();
    const sortedTrans = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sortedTrans.forEach(t => {
      if (t.isIgnored) return;
      if (t.type === 'income') {
        if (!isNeutralIncome(t)) {
            income += t.amount;
            incCatMap.set(t.category, (incCatMap.get(t.category) || 0) + t.amount);
        }
      } else {
        expenses += t.amount;
        expCatMap.set(t.category, (expCatMap.get(t.category) || 0) + t.amount);
      }
    });

    const mapToCategories = (map: Map<string, number>, type: 'income' | 'expense') => {
      const incomePalette = ['#21C25E', '#10B981', '#34D399', '#059669', '#6EE7B7'];
      const expensePalette = ['#EF4444', '#B91C1C', '#F87171', '#991B1B', '#FCA5A5'];
      return Array.from(map.entries()).map(([name, amount], index) => ({
        id: `cat-${name}-${index}`,
        name,
        amount,
        color: type === 'income' ? incomePalette[index % incomePalette.length] : expensePalette[index % expensePalette.length],
        icon: getIconByCategoryName(name)
      })).sort((a, b) => b.amount - a.amount);
    };

    return {
      totalIncome: income,
      totalExpenses: expenses,
      incomeCategoriesData: mapToCategories(incCatMap, 'income'),
      expenseCategoriesData: mapToCategories(expCatMap, 'expense'),
      recentIncomes: sortedTrans.filter(t => t.type === 'income' && !isNeutralIncome(t)).slice(0, 4),
      recentExpenses: sortedTrans.filter(t => t.type === 'expense').slice(0, 4)
    };
  }, [transactions]);

  const globalBalance = useMemo(() => accounts.reduce((acc, curr) => acc + curr.balance, 0), [accounts]);
  const unreadCount = useMemo(() => history.filter(n => !n.read).length, [history]);

  const handleStatClick = (type: TransactionType) => {
    setQuickAction({
      isOpen: true,
      title: type === 'income' ? 'Opções de Receitas' : 'Opções de Despesas',
      type
    });
  };

  const handleCategoryClick = (category: CategoryData, type: TransactionType) => {
    setQuickAction({
      isOpen: true,
      title: category.name,
      type,
      category
    });
  };

  const handleTransactionItemClick = (transaction: Transaction) => {
    setQuickAction({
      isOpen: true,
      title: transaction.description,
      type: transaction.type,
      transaction: transaction
    });
  };

  const openTransactionModal = (type: TransactionType, categoryName: string = '', transaction?: Transaction) => {
    setTransModalType(type);
    setInitialCategory(categoryName);
    setTransactionToEdit(transaction || null);
    setIsTransModalOpen(true);
    setQuickAction(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      <div className="flex items-center justify-between bg-white border border-slate-50 p-4 rounded-[28px] shadow-sm animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsProfileActionsOpen(true)}
             className="h-14 w-14 rounded-full border-2 border-success p-0.5 overflow-hidden flex-shrink-0 shadow-sm transition-transform hover:scale-110 active:scale-95"
           >
             <img src={currentUser?.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} alt="Perfil" className="h-full w-full rounded-full object-cover" />
           </button>
           <div className="flex flex-col text-left">
              <span className="text-sm font-medium text-secondary">Bem-vindo de volta,</span>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">{currentUser?.displayName || 'Usuário'}</h2>
           </div>
        </div>
        <button onClick={() => { setIsNotificationsOpen(true); markAllAsRead(); }} className="relative flex h-12 w-12 items-center justify-center text-slate-400 hover:text-primary transition-all rounded-full hover:bg-success/5 active:scale-90">
          <span className="material-symbols-outlined text-3xl">notifications</span>
          {unreadCount > 0 && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-white shadow-md animate-bounce">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
      </div>

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 stagger-1">
        <div className="flex justify-center"><MonthSelector currentDate={currentDate} onMonthChange={setCurrentDate} className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100" /></div>
        <BalanceCard balance={globalBalance} />
        <div className="grid grid-cols-2 gap-3">
            <StatCard type="income" value={totalIncome} onClick={() => handleStatClick('income')} />
            <StatCard type="expense" value={totalExpenses} onClick={() => handleStatClick('expense')} />
        </div>
      </div>
      
      <div className="grid gap-8 lg:grid-cols-2 pt-2 animate-in fade-in slide-in-from-bottom-12 duration-1000 stagger-2">
        <div className="flex flex-col gap-8">
          <AccountsList accounts={accounts} onAddAccount={() => { setAccountToEdit(null); setIsAccountModalOpen(true); }} onAccountClick={(acc) => navigate(`/transactions/account/${acc.id}`)} onEditAccount={(acc) => { setAccountToEdit(acc); setIsAccountModalOpen(true); }} />
          <CreditCardsList cards={cards} transactions={transactions} onAddCard={() => setIsCreditCardModalOpen(true)} onDeleteCard={deleteCard} />
        </div>

        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6">
             <TransactionSummaryCard 
                type="income" 
                total={totalIncome} 
                transactions={recentIncomes} 
                onViewAll={() => navigate('/incomes')} 
                onAdd={() => openTransactionModal('income')} 
                onItemClick={handleTransactionItemClick}
             />
             <TransactionSummaryCard 
                type="expense" 
                total={totalExpenses} 
                transactions={recentExpenses} 
                onViewAll={() => navigate('/expenses')} 
                onAdd={() => openTransactionModal('expense')} 
                onItemClick={handleTransactionItemClick}
             />
          </div>
          <CategoryChartCard title="Receitas por categoria" type="income" categories={incomeCategoriesData} total={totalIncome} onCategoryClick={(cat) => handleCategoryClick(cat, 'income')} />
          <CategoryChartCard title="Gastos por categoria" type="expense" categories={expenseCategoriesData} total={totalExpenses} onCategoryClick={(cat) => handleCategoryClick(cat, 'expense')} />
        </div>
      </div>

      <QuickActionModal 
        isOpen={quickAction.isOpen}
        onClose={() => setQuickAction(prev => ({ ...prev, isOpen: false }))}
        title={quickAction.title}
        type={quickAction.type}
        category={quickAction.category}
        transaction={quickAction.transaction}
        onAddTransaction={openTransactionModal}
      />

      <ProfileActionsModal 
        isOpen={isProfileActionsOpen}
        onClose={() => setIsProfileActionsOpen(false)}
        onOpenEditProfile={() => setIsEditProfileOpen(true)}
      />

      <EditProfileModal 
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />

      <NewTransactionModal 
        isOpen={isTransModalOpen} 
        onClose={() => { setIsTransModalOpen(false); setInitialCategory(''); setTransactionToEdit(null); }} 
        onSave={async (data) => { if (transactionToEdit) await updateTransaction(transactionToEdit.id, data); else await addTransaction(data); }}
        onDelete={deleteTransaction}
        accounts={accounts}
        transactionToEdit={transactionToEdit}
        initialType={transModalType}
        initialCategory={initialCategory}
      />
      <NewAccountModal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} onSave={async (data) => { if (accountToEdit) await updateAccount(accountToEdit.id, data); else await addAccount(data); setIsAccountModalOpen(false); }} onDelete={deleteAccount} accountToEdit={accountToEdit} />
      <NewCreditCardModal isOpen={isCreditCardModalOpen} onClose={() => setIsCreditCardModalOpen(false)} onSave={addCard} />
      <NotificationsModal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} history={history} onClear={clearHistory} />
    </div>
  );
};
