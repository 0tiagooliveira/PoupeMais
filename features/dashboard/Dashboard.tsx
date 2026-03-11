
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
  const [startOcrOnOpen, setStartOcrOnOpen] = useState(false);
  
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
  const dashboardMetrics = useMemo(() => {
    const net = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : 0;
    const avgIncomeTicket = recentIncomes.length > 0 ? recentIncomes.reduce((sum, transaction) => sum + transaction.amount, 0) / recentIncomes.length : 0;
    const avgExpenseTicket = recentExpenses.length > 0 ? recentExpenses.reduce((sum, transaction) => sum + transaction.amount, 0) / recentExpenses.length : 0;
    const topIncomeCategory = incomeCategoriesData[0] ?? null;
    const topExpenseCategory = expenseCategoriesData[0] ?? null;

    return {
      net,
      savingsRate,
      avgIncomeTicket,
      avgExpenseTicket,
      topIncomeCategory,
      topExpenseCategory,
    };
  }, [totalIncome, totalExpenses, recentIncomes, recentExpenses, incomeCategoriesData, expenseCategoriesData]);

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
    setStartOcrOnOpen(false);
    setIsTransModalOpen(true);
    setQuickAction(prev => ({ ...prev, isOpen: false }));
  };

  const openTransactionModalForOcr = () => {
    setTransModalType('expense');
    setInitialCategory('');
    setTransactionToEdit(null);
    setStartOcrOnOpen(true);
    setIsTransModalOpen(true);
  };

  const handleCreateRule = (transaction: Transaction) => {
    setTransactionForRule(transaction);
    setIsRuleModalOpen(true);
    setQuickAction(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 pb-20 md:space-y-8 md:pb-24">
      <div className="flex items-center justify-between bg-white border border-slate-50 p-4 rounded-[28px] shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
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

      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-300 stagger-1 md:space-y-6">
        <div className="flex justify-center"><MonthSelector currentDate={currentDate} onMonthChange={setCurrentDate} className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100" /></div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Acoes rapidas</h3>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-300">Dashboard</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <button
              onClick={() => { setAccountToEdit(null); setIsAccountModalOpen(true); }}
              className="group rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left transition-all hover:bg-emerald-100"
            >
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                <span className="material-symbols-outlined">account_balance</span>
              </div>
              <p className="text-sm font-black text-emerald-900">Criar conta</p>
              <p className="mt-1 text-[11px] font-semibold text-emerald-800">Cadastre banco, carteira ou conta digital.</p>
            </button>

            <button
              onClick={() => openTransactionModal('income')}
              className="group rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-left transition-all hover:bg-cyan-100"
            >
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm">
                <span className="material-symbols-outlined">trending_up</span>
              </div>
              <p className="text-sm font-black text-cyan-900">Lancar receita</p>
              <p className="mt-1 text-[11px] font-semibold text-cyan-800">Registre salario, venda, cashback e outras entradas.</p>
            </button>

            <button
              onClick={() => openTransactionModal('expense')}
              className="group rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left transition-all hover:bg-rose-100"
            >
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-rose-700 shadow-sm">
                <span className="material-symbols-outlined">trending_down</span>
              </div>
              <p className="text-sm font-black text-rose-900">Lancar despesa</p>
              <p className="mt-1 text-[11px] font-semibold text-rose-800">Adicione gastos para manter o fluxo atualizado.</p>
            </button>
          </div>
        </div>

        <BalanceCard balance={globalBalance} />
        <div className="grid grid-cols-2 gap-3">
            <StatCard type="income" value={totalIncome} onClick={() => handleStatClick('income')} />
            <StatCard type="expense" value={totalExpenses} onClick={() => handleStatClick('expense')} />
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Saldo do mês</p>
            <p className={`mt-3 text-[1.9rem] font-black tracking-tight ${dashboardMetrics.net >= 0 ? 'text-primary' : 'text-danger'}`}>
              {formatCurrency(dashboardMetrics.net)}
            </p>
            <p className="mt-2 hidden text-xs font-semibold text-slate-500 lg:block">Resultado entre receitas e despesas do periodo atual.</p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Taxa de poupança</p>
            <p className={`mt-3 text-[1.9rem] font-black tracking-tight ${dashboardMetrics.savingsRate >= 0 ? 'text-primary' : 'text-danger'}`}>
              {dashboardMetrics.savingsRate.toFixed(1)}%
            </p>
            <p className="mt-2 hidden text-xs font-semibold text-slate-500 lg:block">Quanto da sua receita sobrou depois dos gastos.</p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Maior gasto</p>
            <p className="mt-3 truncate text-lg font-black tracking-tight text-slate-900">
              {dashboardMetrics.topExpenseCategory?.name || 'Sem despesas'}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {dashboardMetrics.topExpenseCategory ? formatCurrency(dashboardMetrics.topExpenseCategory.amount) : 'R$ 0,00'}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Maior receita</p>
            <p className="mt-3 truncate text-lg font-black tracking-tight text-slate-900">
              {dashboardMetrics.topIncomeCategory?.name || 'Sem receitas'}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {dashboardMetrics.topIncomeCategory ? formatCurrency(dashboardMetrics.topIncomeCategory.amount) : 'R$ 0,00'}
            </p>
          </div>
        </div>

        <div className="hidden grid-cols-1 gap-4 xl:grid xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">Pulso financeiro</h3>
                <p className="mt-1 text-lg font-black tracking-tight text-slate-900">Leitura rápida do seu mês</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Resumo executivo</span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">Ticket médio receita</p>
                <p className="mt-2 text-xl font-black tracking-tight text-primary">{formatCurrency(dashboardMetrics.avgIncomeTicket)}</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-rose-700">Ticket médio despesa</p>
                <p className="mt-2 text-xl font-black tracking-tight text-danger">{formatCurrency(dashboardMetrics.avgExpenseTicket)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Categorias monitoradas</p>
                <p className="mt-2 text-xl font-black tracking-tight text-slate-900">{incomeCategoriesData.length + expenseCategoriesData.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">Alertas rápidos</h3>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-900">{dashboardMetrics.net >= 0 ? 'Fluxo positivo no mês' : 'Fluxo pressionado no mês'}</p>
                <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                  {dashboardMetrics.net >= 0
                    ? 'Seu caixa fechou acima de zero. Aproveite para direcionar o excedente para metas ou reserva.'
                    : 'As saídas passaram das entradas. Vale revisar as maiores categorias antes do fechamento do mês.'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-900">Foco principal</p>
                <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                  {dashboardMetrics.topExpenseCategory
                    ? `${dashboardMetrics.topExpenseCategory.name} é sua maior categoria de gasto neste recorte.`
                    : 'Ainda não há gastos suficientes para destacar uma categoria principal.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insight & OCR Scanner Widgets */}
        <div className="grid grid-cols-2 gap-3 md:gap-4">
            <button 
            onClick={() => navigate('/ai-analysis')}
          className="w-full bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-3 transition-all hover:shadow-md hover:border-primary/20 group text-left relative overflow-hidden md:gap-5 md:p-5 md:rounded-[28px]"
            >
                {/* Decorativo de fundo sutil */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-[100px] pointer-events-none transition-transform group-hover:scale-110"></div>

                {/* Icone Avatar */}
                <div className="relative shrink-0">
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform md:h-14 md:w-14 md:rounded-[20px]">
                      <span className={`material-symbols-outlined text-xl text-primary md:text-2xl ${loadingInsight ? 'animate-spin' : ''}`}>
                            {loadingInsight ? 'smart_toy' : 'savings'}
                        </span>
                    </div>
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0 z-10 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 md:text-[10px]">Poup+ IA</span>
                    </div>
                      <p className="text-xs font-bold text-slate-700 leading-snug line-clamp-2 md:text-sm">
                        {loadingInsight 
                            ? "Analisando..." 
                            : (dailyInsight || "Consultoria ativa")}
                    </p>
                </div>
            </button>

            <button 
            onClick={openTransactionModalForOcr}
            className="w-full bg-emerald-50 p-4 rounded-[24px] shadow-sm border border-emerald-100/50 flex items-center gap-3 transition-all hover:shadow-md hover:border-emerald-300 group text-left relative overflow-hidden md:gap-5 md:p-5 md:rounded-[28px]"
            >
                {/* Decorativo de fundo sutil */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-bl-[100px] pointer-events-none transition-transform group-hover:scale-110"></div>

                {/* Icone Avatar */}
                <div className="relative shrink-0">
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-100 to-white border border-emerald-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform md:h-14 md:w-14 md:rounded-[20px]">
                      <span className="material-symbols-outlined text-xl text-emerald-600 md:text-2xl">
                            document_scanner
                        </span>
                    </div>
                    {/* Badge Novo */}
                    <div className="absolute -top-2 -right-3 hidden px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest shadow-sm md:block">
                        Novo
                    </div>
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0 z-10 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 md:text-[10px]">Scanner IA</span>
                    </div>
                    
                      <p className="text-xs font-bold text-emerald-900 leading-snug line-clamp-2 md:text-sm">
                        Escanear recibo ou nota com IA
                    </p>
                </div>
            </button>
        </div>
      </div>
      
<div className="flex flex-col gap-6 pt-2 animate-in fade-in slide-in-from-bottom-12 duration-300 stagger-2">
        
        {/* Contas e Cartões Ocupando a Largura Toda em suas Linhas */}
        <AccountsList 
            accounts={accounts} 
            onAddAccount={() => { setAccountToEdit(null); setIsAccountModalOpen(true); }} 
            onAccountClick={(acc) => navigate(`/transactions/account/${acc.id}`)} 
            onEditAccount={(acc) => { setAccountToEdit(acc); setIsAccountModalOpen(true); }} 
        />
        
        <CreditCardsList 
            cards={cards} 
            transactions={transactions} 
            onAddCard={() => setIsCreditCardModalOpen(true)} 
            onDeleteCard={deleteCard} 
        />

        {/* Resumo de Transações Lado a Lado (PC) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
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

        {/* Mapas de Categorias */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            <CategoryChartCard 
                title="Receitas por categoria" 
                type="income" 
                categories={incomeCategoriesData} 
                total={totalIncome} 
                onCategoryClick={(cat) => handleCategoryClick(cat, 'income')} 
            />
            <CategoryChartCard 
                title="Gastos por categoria" 
                type="expense" 
                categories={expenseCategoriesData} 
                total={totalExpenses} 
                onCategoryClick={(cat) => handleCategoryClick(cat, 'expense')} 
            />
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
        onClose={() => { 
          setIsTransModalOpen(false); 
          setInitialCategory(''); 
          setTransactionToEdit(null); 
          setStartOcrOnOpen(false);
        }}
        startOcrOnOpen={startOcrOnOpen}
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
