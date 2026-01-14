
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTransactions } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { useCreditCards } from '../../hooks/useCreditCards';
import { useNotification } from '../../contexts/NotificationContext';
import { BalanceCard } from './components/BalanceCard';
import { AccountsList } from './components/AccountsList';
import { CreditCardsList } from './components/CreditCardsList';
import { CategoryChartCard } from './components/CategoryChartCard';
import { TransactionSummaryCard } from './components/TransactionSummaryCard';
import { StatCard } from './components/StatCard';
import { NewTransactionModal } from './components/NewTransactionModal';
import { NewAccountModal } from './components/NewAccountModal';
import { NewCreditCardModal } from './components/NewCreditCardModal';
import { NotificationsModal } from './components/NotificationsModal';
import { Account, TransactionType } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification, history, clearHistory, markAllAsRead } = useNotification();
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();
  
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [transModalType, setTransModalType] = useState<TransactionType>('expense');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCreditCardModalOpen, setIsCreditCardModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

  const { transactions, addTransaction, deleteTransaction } = useTransactions(currentDate);
  const { accounts, addAccount, updateAccount, deleteAccount } = useAccounts();
  const { cards, addCard, deleteCard } = useCreditCards();

  useEffect(() => {
    if (transactions.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const next3Days = new Date();
      next3Days.setDate(today.getDate() + 3);

      const upcomingBills = transactions.filter(t => 
        t.type === 'expense' && 
        t.status === 'pending' && 
        new Date(t.date) >= today && 
        new Date(t.date) <= next3Days
      );

      if (upcomingBills.length > 0) {
        upcomingBills.forEach(bill => {
          const billDate = new Date(bill.date);
          const daysLeft = Math.ceil((billDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          const message = daysLeft === 0 
            ? `Vence hoje: "${bill.description}" (${formatCurrency(bill.amount)})`
            : `Vence em ${daysLeft} dias: "${bill.description}" (${formatCurrency(bill.amount)})`;
          
          const alreadyNotified = history.some(h => h.message === message);
          if (!alreadyNotified) {
            addNotification(message, 'finance', 8000, true);
          }
        });
      }
    }
  }, [transactions.length, history, addNotification]);

  const { totalIncome, totalExpenses, incomeCategories, expenseCategories, recentIncomes, recentExpenses } = useMemo(() => {
    let income = 0;
    let expenses = 0;
    const incCatMap = new Map<string, number>();
    const expCatMap = new Map<string, number>();
    
    const sortedTrans = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sortedTrans.forEach(t => {
      if (t.type === 'income') {
        income += t.amount;
        incCatMap.set(t.category, (incCatMap.get(t.category) || 0) + t.amount);
      } else {
        expenses += t.amount;
        expCatMap.set(t.category, (expCatMap.get(t.category) || 0) + t.amount);
      }
    });

    const incomeColors = ['#21C25E', '#2BDC6F', '#45E883', '#6DF2A1', '#9FF9C5'];
    const expenseColors = ['#FF4444', '#FF6666', '#FF8888', '#FFAAAA', '#FFCCCC'];

    const mapToCategories = (map: Map<string, number>, colors: string[]) => 
      Array.from(map.entries()).map(([name, amount], index) => ({
        id: `cat-${name}-${index}`,
        name,
        amount,
        color: colors[index % colors.length],
        icon: 'pie_chart'
      })).sort((a, b) => b.amount - a.amount);

    return {
      totalIncome: income,
      totalExpenses: expenses,
      incomeCategories: mapToCategories(incCatMap, incomeColors),
      expenseCategories: mapToCategories(expCatMap, expenseColors),
      recentIncomes: sortedTrans.filter(t => t.type === 'income').slice(0, 4),
      recentExpenses: sortedTrans.filter(t => t.type === 'expense').slice(0, 4)
    };
  }, [transactions]);

  const globalBalance = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + curr.balance, 0);
  }, [accounts]);

  const unreadCount = useMemo(() => {
    return history.filter(n => !n.read).length;
  }, [history]);

  const handleAccountClick = (account: Account) => {
    navigate(`/transactions/account/${account.id}`);
  };

  const handleEditAccount = (account: Account) => {
    setAccountToEdit(account);
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async (data: any) => {
    try {
      if (accountToEdit) {
          await updateAccount(accountToEdit.id, data);
          addNotification(`Conta "${data.name}" atualizada com sucesso.`, 'success', 3000, true);
      } else {
          await addAccount(data);
          addNotification(`Nova conta conectada: "${data.name}"`, 'finance', 5000, true);
      }
      setIsAccountModalOpen(false);
    } catch (error) {
      addNotification("Erro ao processar conta.", "error");
    }
  };

  const openTransactionModal = (type: TransactionType = 'expense') => {
      setTransModalType(type);
      setIsTransModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      {/* Header Estilizado conforme Referência */}
      <div className="flex items-center justify-between bg-white border border-slate-50 p-4 rounded-[28px] shadow-sm">
        <div className="flex items-center gap-4">
           {/* Avatar com Borda Sucesso */}
           <div className="h-14 w-14 rounded-full border-2 border-success p-0.5 overflow-hidden flex-shrink-0 shadow-sm">
             <img 
               src={currentUser?.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
               alt="Perfil" 
               className="h-full w-full rounded-full object-cover"
             />
           </div>
           
           <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-400">Bem-vindo de volta,</span>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
               {currentUser?.displayName || 'Usuário'}
              </h2>
           </div>
        </div>
        
        {/* Notificações no lado oposto */}
        <button 
           onClick={() => { setIsNotificationsOpen(true); markAllAsRead(); }}
           className="relative flex h-12 w-12 items-center justify-center text-slate-400 hover:text-slate-600 transition-all rounded-full hover:bg-slate-50 active:scale-90"
        >
          <span className="material-symbols-outlined text-3xl">notifications</span>
          {unreadCount > 0 && (
             <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-white shadow-md">
               {unreadCount > 99 ? '99+' : unreadCount}
             </span>
          )}
        </button>
      </div>

      <div className="space-y-4">
        <BalanceCard 
          balance={globalBalance} 
          previousBalance={globalBalance} 
          currentDate={currentDate}
          onMonthChange={setCurrentDate}
        />
        
        <div className="grid grid-cols-2 gap-4">
            <StatCard type="income" value={totalIncome} onClick={() => navigate('/incomes')} />
            <StatCard type="expense" value={totalExpenses} onClick={() => navigate('/expenses')} />
        </div>
      </div>
      
      <div className="grid gap-8 lg:grid-cols-2 pt-2">
        <div className="flex flex-col gap-8">
          <AccountsList 
            accounts={accounts} 
            onAddAccount={() => { setAccountToEdit(null); setIsAccountModalOpen(true); }}
            onAccountClick={handleAccountClick}
            onEditAccount={handleEditAccount}
          />

          <CreditCardsList
            cards={cards}
            onAddCard={() => setIsCreditCardModalOpen(true)}
            onDeleteCard={deleteCard}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6">
             <TransactionSummaryCard 
                type="income" 
                total={totalIncome} 
                transactions={recentIncomes} 
                onViewAll={() => navigate('/incomes')}
                onAdd={() => openTransactionModal('income')}
             />
             <TransactionSummaryCard 
                type="expense" 
                total={totalExpenses} 
                transactions={recentExpenses} 
                onViewAll={() => navigate('/expenses')}
                onAdd={() => openTransactionModal('expense')}
             />
          </div>

          <CategoryChartCard 
            title="Receitas por categoria" 
            type="income" 
            categories={incomeCategories} 
            total={totalIncome} 
          />
          
          <CategoryChartCard 
            title="Gastos por categoria" 
            type="expense" 
            categories={expenseCategories} 
            total={totalExpenses} 
          />
        </div>
      </div>

      <NewTransactionModal 
        isOpen={isTransModalOpen} 
        onClose={() => setIsTransModalOpen(false)} 
        onSave={addTransaction}
        onDelete={deleteTransaction}
        accounts={accounts}
        initialType={transModalType}
      />

      <NewAccountModal 
        isOpen={isAccountModalOpen} 
        onClose={() => setIsAccountModalOpen(false)} 
        onSave={handleSaveAccount}
        onDelete={deleteAccount}
        accountToEdit={accountToEdit}
      />

      <NewCreditCardModal 
        isOpen={isCreditCardModalOpen} 
        onClose={() => setIsCreditCardModalOpen(false)} 
        onSave={addCard}
      />

      <NotificationsModal 
        isOpen={isNotificationsOpen} 
        onClose={() => setIsNotificationsOpen(false)} 
        history={history}
        onClear={clearHistory}
      />
    </div>
  );
};
