import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTransactions } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { useCreditCards } from '../../hooks/useCreditCards';
import { useNotification } from '../../contexts/NotificationContext';
import { BalanceCard } from './components/BalanceCard';
import { AccountsList } from './components/AccountsList';
import { CreditCardsList } from './components/CreditCardsList';
import { CategoryList } from './components/CategoryList';
import { TransactionSummaryCard } from './components/TransactionSummaryCard';
import { StatCard } from './components/StatCard';
import { NewTransactionModal } from './components/NewTransactionModal';
import { NewAccountModal } from './components/NewAccountModal';
import { NewCreditCardModal } from './components/NewCreditCardModal';
import { CategoryData, Account, TransactionType } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [welcomeShown, setWelcomeShown] = useState(false);
  const navigate = useNavigate();
  
  // Modals state
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [transModalType, setTransModalType] = useState<TransactionType>('expense'); // Controla qual aba abre

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCreditCardModalOpen, setIsCreditCardModalOpen] = useState(false);
  
  // State para edição de conta
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

  // Real Data Hooks
  const { transactions, addTransaction, deleteTransaction } = useTransactions(currentDate);
  const { accounts, addAccount, updateAccount, deleteAccount } = useAccounts();
  const { cards, addCard, deleteCard } = useCreditCards();

  // Welcome Notification logic
  useEffect(() => {
    const hasSeenWelcome = sessionStorage.getItem('hasSeenWelcome');
    if (currentUser && !hasSeenWelcome && !welcomeShown) {
      addNotification(`Olá, ${currentUser.displayName || 'Usuário'}! Seus dados estão sincronizados.`, 'info');
      sessionStorage.setItem('hasSeenWelcome', 'true');
      setWelcomeShown(true);
    }
  }, [currentUser, addNotification, welcomeShown]);

  // Due Date Notification Logic
  useEffect(() => {
    if (transactions.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    transactions.forEach(t => {
        if (t.type === 'income') return;

        const tDate = new Date(t.date);
        const tDateString = t.date.split('T')[0];
        const todayString = today.toISOString().split('T')[0];
        const tomorrowString = tomorrow.toISOString().split('T')[0];

        const alertKey = `alert_${t.id}_${todayString}`;
        if (sessionStorage.getItem(alertKey)) return;

        if (tDateString === todayString) {
            addNotification(`Vencimento Hoje: ${t.description} - ${formatCurrency(t.amount)}`, 'warning', 6000);
            sessionStorage.setItem(alertKey, 'true');
        } else if (tDateString === tomorrowString) {
            addNotification(`Vence Amanhã: ${t.description} - ${formatCurrency(t.amount)}`, 'info', 5000);
            sessionStorage.setItem(alertKey, 'true');
        }
    });
  }, [transactions, addNotification]);

  // Derived Calculations
  const { totalIncome, totalExpenses, monthlyBalance, categoryData, recentIncomes, recentExpenses } = useMemo(() => {
    let income = 0;
    let expenses = 0;
    const catMap = new Map<string, number>();
    
    // Sort transactions by date desc
    const sortedTrans = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sortedTrans.forEach(t => {
      if (t.type === 'income') {
        income += t.amount;
      } else {
        expenses += t.amount;
        const current = catMap.get(t.category) || 0;
        catMap.set(t.category, current + t.amount);
      }
    });

    const getColor = (name: string) => {
      const colors: Record<string, string> = {
        'Moradia': '#2563eb',
        'Alimentação': '#16a34a',
        'Transporte': '#f59e0b',
        'Lazer': '#dc2626',
        'Saúde': '#06b6d4',
        'Outros': '#64748b'
      };
      return colors[name] || '#64748b';
    };

    const categories: CategoryData[] = Array.from(catMap.entries()).map(([name, amount], index) => ({
      id: `cat-${index}`,
      name,
      amount,
      color: getColor(name),
      icon: 'pie_chart'
    })).sort((a, b) => b.amount - a.amount);

    return {
      totalIncome: income,
      totalExpenses: expenses,
      monthlyBalance: income - expenses,
      categoryData: categories,
      recentIncomes: sortedTrans.filter(t => t.type === 'income').slice(0, 4),
      recentExpenses: sortedTrans.filter(t => t.type === 'expense').slice(0, 4)
    };
  }, [transactions]);

  const globalBalance = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + curr.balance, 0);
  }, [accounts]);

  // Handlers
  const handleEditAccount = (account: Account) => {
    setAccountToEdit(account);
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async (data: any) => {
      if (accountToEdit) {
          await updateAccount(accountToEdit.id, data);
      } else {
          await addAccount(data);
      }
  };

  const handleCloseAccountModal = () => {
      setIsAccountModalOpen(false);
      setAccountToEdit(null);
  };

  const openTransactionModal = (type: TransactionType = 'expense') => {
      setTransModalType(type);
      setIsTransModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
           <div className="text-sm text-secondary">Bem-vindo de volta,</div>
           <h2 className="text-xl font-bold text-slate-800">
            {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuário'}
           </h2>
        </div>
        
        <div className="flex items-center gap-4">
           <button className="relative rounded-full p-2 text-secondary transition-colors hover:bg-gray-100 hover:text-slate-800">
             <span className="material-symbols-outlined text-2xl">notifications</span>
             <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white shadow-sm">
               3
             </span>
           </button>
        </div>
      </div>

      {/* Main Stats Area (Topo) */}
      <div className="space-y-4">
        <BalanceCard 
          balance={globalBalance} 
          previousBalance={globalBalance} 
          currentDate={currentDate}
          onMonthChange={setCurrentDate}
        />
        
        {/* Simple Summary Cards Row */}
        <div className="grid grid-cols-2 gap-4">
            <StatCard 
                type="income" 
                value={totalIncome} 
                onClick={() => navigate('/incomes')} 
            />
            <StatCard 
                type="expense" 
                value={totalExpenses} 
                onClick={() => navigate('/expenses')} 
            />
        </div>
      </div>
      
      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-20 right-6 z-20 md:bottom-6">
        <button 
          onClick={() => openTransactionModal('expense')}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-transform"
          title="Nova Transação"
        >
          <span className="material-symbols-outlined text-2xl">add</span>
        </button>
      </div>

      {/* Detailed Lists */}
      <div className="grid gap-8 lg:grid-cols-2 pt-2">
        {/* Coluna da Esquerda: Contas e Cartões + Novos Widgets Detalhados */}
        <div className="flex flex-col gap-8">
          <AccountsList 
            accounts={accounts} 
            onAddAccount={() => {
                setAccountToEdit(null);
                setIsAccountModalOpen(true);
            }}
            onEditAccount={handleEditAccount}
          />

          <CreditCardsList
            cards={cards}
            onAddCard={() => setIsCreditCardModalOpen(true)}
            onDeleteCard={deleteCard}
          />

          {/* Widgets de Resumo Detalhado (Abaixo dos Cartões) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>

        {/* Coluna da Direita: Gráfico de Categorias */}
        <div className="flex flex-col gap-6">
          {categoryData.length > 0 ? (
            <CategoryList categories={categoryData} totalExpense={totalExpenses} />
          ) : (
            <div className="flex flex-col gap-4">
                 <div className="flex h-40 items-center justify-center rounded-2xl border border-gray-100 bg-surface text-secondary">
                  Nenhuma despesa registrada este mês.
                </div>
            </div>
          )}
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
        onClose={handleCloseAccountModal}
        onSave={handleSaveAccount}
        onDelete={deleteAccount}
        accountToEdit={accountToEdit}
      />

      <NewCreditCardModal
        isOpen={isCreditCardModalOpen}
        onClose={() => setIsCreditCardModalOpen(false)}
        onSave={addCard}
      />
    </div>
  );
};