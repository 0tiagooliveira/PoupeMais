
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
import { Account, TransactionType } from '../../types';

// Função para tentar adivinhar ícone de categorias antigas ou importadas
const getIconForLegacy = (name: string) => {
  const lower = name.toLowerCase();
  
  // Categorias de Despesas
  if (lower.includes('comida') || lower.includes('lanche') || lower.includes('food') || lower.includes('restaurante') || lower.includes('ifood') || lower.includes('alimentação')) return 'restaurant';
  if (lower.includes('mercado') || lower.includes('supermercado')) return 'shopping_cart';
  if (lower.includes('compra') || lower.includes('shopping') || lower.includes('loja') || lower.includes('online') || lower.includes('shein') || lower.includes('amazon')) return 'shopping_bag';
  if (lower.includes('transporte') || lower.includes('uber') || lower.includes('99') || lower.includes('taxi')) return 'directions_car';
  if (lower.includes('carro') || lower.includes('posto') || lower.includes('combustível') || lower.includes('gasolina')) return 'local_gas_station';
  if (lower.includes('casa') || lower.includes('aluguel') || lower.includes('condominio') || lower.includes('moradia')) return 'home';
  if (lower.includes('saude') || lower.includes('medico') || lower.includes('farmacia') || lower.includes('drogaria')) return 'medical_services';
  if (lower.includes('educação') || lower.includes('curso') || lower.includes('escola') || lower.includes('faculdade')) return 'school';
  if (lower.includes('lazer') || lower.includes('jogo') || lower.includes('cinema') || lower.includes('diversão')) return 'sports_esports';
  if (lower.includes('viagem') || lower.includes('férias') || lower.includes('passagem')) return 'flight';
  if (lower.includes('assinatura') || lower.includes('netflix') || lower.includes('spotify') || lower.includes('stream')) return 'subscriptions';
  if (lower.includes('imposto') || lower.includes('taxa') || lower.includes('tributo')) return 'gavel';
  if (lower.includes('presente')) return 'card_giftcard';
  if (lower.includes('pet') || lower.includes('veterinário') || lower.includes('cachorro') || lower.includes('gato')) return 'pets';
  if (lower.includes('manutenção') || lower.includes('conserto') || lower.includes('reparo')) return 'build';
  if (lower.includes('telefone') || lower.includes('celular') || lower.includes('internet')) return 'smartphone';
  if (lower.includes('energia') || lower.includes('luz') || lower.includes('eletricidade')) return 'bolt';
  if (lower.includes('água') || lower.includes('esgoto')) return 'water_drop';
  if (lower.includes('gás')) return 'propane';
  if (lower.includes('bem-estar') || lower.includes('academia') || lower.includes('beleza') || lower.includes('cabelo')) return 'spa';
  if (lower.includes('empréstimo') || lower.includes('divida')) return 'handshake';
  if (lower.includes('vestiário') || lower.includes('roupa') || lower.includes('moda')) return 'checkroom';
  if (lower.includes('beleza') || lower.includes('estetica')) return 'face';
  
  // Categorias de Receitas
  if (lower.includes('salario') || lower.includes('pagamento')) return 'payments';
  if (lower.includes('freelance') || lower.includes('extra')) return 'computer';
  if (lower.includes('bônus') || lower.includes('bonus')) return 'stars';
  if (lower.includes('invest') || lower.includes('aplicação')) return 'show_chart';
  if (lower.includes('dividendo')) return 'pie_chart';
  if (lower.includes('juros')) return 'percent';
  if (lower.includes('cashback')) return 'currency_exchange';
  if (lower.includes('reembolso') || lower.includes('estorno')) return 'undo';
  if (lower.includes('transfer') || lower.includes('pix')) return 'sync_alt';
  if (lower.includes('poupança') || lower.includes('reserva')) return 'savings';
  if (lower.includes('décimo') || lower.includes('13')) return 'calendar_month';
  if (lower.includes('resgate')) return 'move_to_inbox';

  return 'category'; // Padrão
};

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification, history, clearHistory, markAllAsRead } = useNotification();
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  const handleIncomeClick = () => {
    console.log('Navigating to /incomes');
    navigate('/incomes');
  };

  const handleExpenseClick = () => {
    console.log('Navigating to /expenses');
    navigate('/expenses');
  };
  
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [transModalType, setTransModalType] = useState<TransactionType>('expense');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCreditCardModalOpen, setIsCreditCardModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

  const { transactions, addTransaction, deleteTransaction } = useTransactions(currentDate);
  const { accounts, addAccount, updateAccount, deleteAccount } = useAccounts();
  const { cards, addCard, deleteCard } = useCreditCards();

  const { totalIncome, totalExpenses, incomeCategoriesData, expenseCategoriesData, recentIncomes, recentExpenses } = useMemo(() => {
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

    const mapToCategories = (map: Map<string, number>, type: 'income' | 'expense') => {
      const refCategories = type === 'income' ? incomeCategories : expenseCategories;
      
      // Paleta de verdes para o gráfico de Receitas
      const incomePalette = [
        '#21C25E', '#10B981', '#34D399', '#059669', '#6EE7B7', '#047857', '#A7F3D0',
      ];

      // Paleta de vermelhos para o gráfico de Despesas (Monocromático)
      const expensePalette = [
        '#EF4444', // Red 500
        '#B91C1C', // Red 700
        '#F87171', // Red 400
        '#991B1B', // Red 800
        '#FCA5A5', // Red 300
        '#7F1D1D', // Red 900
        '#FECACA', // Red 200
      ];

      return Array.from(map.entries()).map(([name, amount], index) => {
        // 1. Tenta achar na lista oficial para pegar ícone correto
        const ref = refCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
        
        let color: string;
        let icon: string;

        if (type === 'income') {
            color = incomePalette[index % incomePalette.length];
        } else {
            color = expensePalette[index % expensePalette.length];
        }

        // Garante que o ícone seja o correto da categoria, ou tenta adivinhar pelo nome
        icon = ref ? ref.icon : getIconForLegacy(name);

        return {
          id: `cat-${name}-${index}`,
          name,
          amount,
          color,
          icon
        };
      }).sort((a, b) => b.amount - a.amount);
    };

    return {
      totalIncome: income,
      totalExpenses: expenses,
      incomeCategoriesData: mapToCategories(incCatMap, 'income'),
      expenseCategoriesData: mapToCategories(expCatMap, 'expense'),
      recentIncomes: sortedTrans.filter(t => t.type === 'income').slice(0, 4),
      recentExpenses: sortedTrans.filter(t => t.type === 'expense').slice(0, 4)
    };
  }, [transactions]);

  const globalBalance = useMemo(() => {
    // Agora podemos usar a soma real, pois o hook useAccounts já garante que a conta Nubank vale 752.87
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
      {/* Header Animado */}
      <div className="flex items-center justify-between bg-white border border-slate-50 p-4 rounded-[28px] shadow-sm animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-4">
           <div className="h-14 w-14 rounded-full border-2 border-success p-0.5 overflow-hidden flex-shrink-0 shadow-sm transition-transform hover:scale-110">
             <img 
               src={currentUser?.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
               alt="Perfil" 
               className="h-full w-full rounded-full object-cover"
             />
           </div>
           
           <div className="flex flex-col">
              <span className="text-sm font-medium text-secondary">Bem-vindo de volta,</span>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
               {currentUser?.displayName || 'Usuário'}
              </h2>
           </div>
        </div>
        
        <button 
           onClick={() => { setIsNotificationsOpen(true); markAllAsRead(); }}
           className="relative flex h-12 w-12 items-center justify-center text-slate-400 hover:text-primary transition-all rounded-full hover:bg-success/5 active:scale-90"
        >
          <span className="material-symbols-outlined text-3xl">notifications</span>
          {unreadCount > 0 && (
             <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-white shadow-md animate-bounce">
               {unreadCount > 99 ? '99+' : unreadCount}
             </span>
          )}
        </button>
      </div>

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 stagger-1">
        {/* Month Selector Outside Cards */}
        <div className="flex justify-center">
            <MonthSelector 
                currentDate={currentDate} 
                onMonthChange={setCurrentDate} 
                className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100" 
            />
        </div>

        {/* Saldo Geral */}
        <BalanceCard balance={globalBalance} />
        
        {/* Grid de Receitas e Despesas - Apenas 2 colunas agora */}
        <div className="grid grid-cols-2 gap-3">
            <StatCard type="income" value={totalIncome} onClick={handleIncomeClick} />
            <StatCard type="expense" value={totalExpenses} onClick={handleExpenseClick} />
        </div>
      </div>
      
      <div className="grid gap-8 lg:grid-cols-2 pt-2 animate-in fade-in slide-in-from-bottom-12 duration-1000 stagger-2">
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
            categories={incomeCategoriesData} 
            total={totalIncome} 
          />
          
          <CategoryChartCard 
            title="Gastos por categoria" 
            type="expense" 
            categories={expenseCategoriesData} 
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
