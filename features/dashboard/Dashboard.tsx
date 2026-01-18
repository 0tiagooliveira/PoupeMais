
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";
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
import { AutomationRulesModal } from '../automation/AutomationRulesModal';
import { Account, TransactionType, Transaction, CategoryData } from '../../types';
import { getIconByCategoryName } from '../../utils/categoryIcons';
import { formatCurrency } from '../../utils/formatters';

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
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [transactionForRule, setTransactionForRule] = useState<Transaction | null>(null);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

  // Estados da IA do Dashboard
  const [dailyInsight, setDailyInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Estados para o Menu de Ações Rápidas
  const [quickAction, setQuickAction] = useState<{
    isOpen: boolean;
    title: string;
    type: TransactionType;
    category?: CategoryData;
    transaction?: Transaction;
  }>({ isOpen: false, title: '', type: 'expense' });

  const { transactions, addTransaction, updateTransaction, deleteTransaction, loading: loadingTrans } = useTransactions(currentDate);
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

  // Efeito para gerar Insight Rápido da IA
  useEffect(() => {
    // Só roda se tiver carregado as transações, tiver usuário PRO, e ainda não tiver insight
    if (loadingTrans || !currentUser?.isPro || dailyInsight || (totalIncome === 0 && totalExpenses === 0)) return;

    const fetchDailyInsight = async () => {
        setLoadingInsight(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
                Atue como o Poup+, um porquinho consultor financeiro inteligente, simpático e breve.
                Dados do usuário neste mês:
                - Saldo Total em Contas: R$ ${globalBalance.toFixed(2)}
                - Receitas do Mês: R$ ${totalIncome.toFixed(2)}
                - Despesas do Mês: R$ ${totalExpenses.toFixed(2)}
                
                Gere uma frase de impacto (máximo 15 palavras) comentando a situação atual.
                Exemplos de tom: "Uau, você está poupando bem!", "Cuidado, gastos subindo!", "Ótimo equilíbrio hoje.".
                Não use formatação markdown. Seja direto.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [{ parts: [{ text: prompt }] }],
            });
            
            setDailyInsight(response.text?.trim() || "Olá! Vamos cuidar das suas finanças hoje?");
        } catch (error) {
            console.error("Erro IA Insight:", error);
            setDailyInsight("Toque para fazer uma análise completa das suas finanças.");
        } finally {
            setLoadingInsight(false);
        }
    };

    // Pequeno delay para garantir que a UI montou
    const timer = setTimeout(fetchDailyInsight, 1500);
    return () => clearTimeout(timer);
  }, [totalIncome, totalExpenses, globalBalance, currentUser, loadingTrans, dailyInsight]);


  const handleStatClick = (type: TransactionType) => {
    setQuickAction({
      isOpen: true,
      title: type === 'income' ? 'Opções de Receitas' : 'Opções de Despesas',
      type
    });
  };

  const handleCategoryClick = (category: CategoryData, type: TransactionType) => {
    // Navegação direta para a lista de transações com filtro
    navigate('/transactions', { 
      state: { 
        category: category.name, 
        type: type 
      } 
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

  const handleCreateRule = (transaction: Transaction) => {
    setTransactionForRule(transaction);
    setIsRuleModalOpen(true);
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

        {/* AI Insight Access Widget - CLEANER DESIGN */}
        <button 
          onClick={() => navigate('/ai-analysis')}
          className="w-full bg-white p-5 rounded-[28px] shadow-sm border border-slate-100 flex items-center gap-5 transition-all hover:shadow-md hover:border-primary/20 group text-left relative overflow-hidden"
        >
            {/* Decorativo de fundo sutil */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-[100px] pointer-events-none transition-transform group-hover:scale-110"></div>

            {/* Icone Avatar */}
            <div className="relative shrink-0">
                <div className="h-14 w-14 rounded-[20px] bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <span className={`material-symbols-outlined text-2xl text-primary ${loadingInsight ? 'animate-spin' : ''}`}>
                        {loadingInsight ? 'smart_toy' : 'savings'}
                    </span>
                </div>
                {/* Badge de notificação/status */}
                <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm border border-slate-50">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-primary animate-pulse"></span>
                </div>
            </div>

            {/* Texto */}
            <div className="flex-1 min-w-0 z-10">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Poup+ Intelligence</span>
                    {!loadingInsight && dailyInsight && <span className="h-1.5 w-1.5 rounded-full bg-primary/40"></span>}
                </div>
                
                <p className="text-sm font-bold text-slate-700 leading-snug line-clamp-2">
                    {loadingInsight 
                        ? "Analisando suas finanças..." 
                        : (dailyInsight || "Toque para ativar sua consultoria financeira diária.")}
                </p>
            </div>

            {/* Seta */}
            <div className="h-10 w-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shrink-0 z-10">
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </div>
        </button>
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
        onCreateRule={handleCreateRule}
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
        onCreateRule={(transaction) => {
            setIsTransModalOpen(false);
            handleCreateRule(transaction);
        }}
      />
      <NewAccountModal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} onSave={async (data) => { if (accountToEdit) await updateAccount(accountToEdit.id, data); else await addAccount(data); setIsAccountModalOpen(false); }} onDelete={deleteAccount} accountToEdit={accountToEdit} />
      <NewCreditCardModal isOpen={isCreditCardModalOpen} onClose={() => setIsCreditCardModalOpen(false)} onSave={addCard} />
      <NotificationsModal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} history={history} onClear={clearHistory} />
      <AutomationRulesModal isOpen={isRuleModalOpen} onClose={() => { setIsRuleModalOpen(false); setTransactionForRule(null); }} baseTransaction={transactionForRule} />
    </div>
  );
};
