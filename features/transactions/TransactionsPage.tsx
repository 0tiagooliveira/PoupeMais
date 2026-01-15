
import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTransactions } from '../../hooks/useTransactions';
import { Transaction, TransactionType } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { MonthSelector } from '../dashboard/components/MonthSelector';
import { useAccounts } from '../../hooks/useAccounts';
import { BackButton } from '../../components/ui/BackButton';
import { NewTransactionModal, incomeCategories, expenseCategories } from '../dashboard/components/NewTransactionModal';
import { Button } from '../../components/ui/Button';

interface TransactionsPageProps {
  title: string;
  filterType?: TransactionType | 'credit_card';
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({ title: baseTitle, filterType }) => {
  const { accountId } = useParams<{ accountId: string }>();
  const [currentDate, setCurrentDate] = useState(new Date());
  const { transactions, loading, addTransaction, updateTransaction, deleteTransaction } = useTransactions(currentDate);
  const { accounts } = useAccounts();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === accountId);
  }, [accounts, accountId]);

  const displayTitle = useMemo(() => {
    if (selectedAccount) return `Extrato: ${selectedAccount.name}`;
    return baseTitle;
  }, [selectedAccount, baseTitle]);

  const isIncome = filterType === 'income';
  const isExpense = filterType === 'expense';
  
  const theme = {
    primary: isIncome ? 'text-success' : (isExpense ? 'text-danger' : 'text-primary'),
    bg: isIncome ? 'bg-success/10' : (isExpense ? 'bg-danger/10' : 'bg-slate-50'),
    gradient: selectedAccount 
      ? `bg-gradient-to-br from-emerald-600 to-emerald-900` // Estilo premium verde para conta única
      : isIncome 
        ? 'bg-gradient-to-br from-success to-[#1AA851]' 
        : (isExpense ? 'bg-gradient-to-br from-danger to-[#D63A3A]' : 'bg-gradient-to-br from-emerald-500 to-emerald-700'),
    icon: selectedAccount ? 'account_balance' : (isIncome ? 'trending_up' : (isExpense ? 'trending_down' : 'receipt_long'))
  };

  const accountsMap = useMemo(() => {
    return accounts.reduce((acc, curr) => {
      acc[curr.id] = curr.name;
      return acc;
    }, {} as Record<string, string>);
  }, [accounts]);

  const filteredTransactions = useMemo(() => {
    let result = transactions;
    
    if (accountId) {
      result = result.filter(t => t.accountId === accountId);
    }
    
    if (filterType) {
      if (filterType === 'credit_card') return []; 
      result = result.filter(t => t.type === filterType);
    }
    
    return result;
  }, [transactions, filterType, accountId]);

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((acc, curr) => {
      if (curr.type === 'income') return acc + curr.amount;
      return acc - curr.amount;
    }, 0);
  }, [filteredTransactions]);

  const displayBalance = useMemo(() => {
    // Retorna o saldo real da conta (que já vem corrigido do useAccounts)
    if (selectedAccount) return selectedAccount.balance;
    return totalAmount;
  }, [selectedAccount, totalAmount]);

  const getCategoryInfo = (category: string) => {
    const allCategories = [...incomeCategories, ...expenseCategories];
    return allCategories.find(c => c.name === category) || { icon: 'payments', color: '#64748b' };
  };

  const handleTransactionClick = (transaction: Transaction) => {
      setEditingTransaction(transaction);
      setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
            <BackButton className="bg-white border border-slate-100 shadow-sm" />
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-slate-800">{displayTitle}</h2>
                    <button 
                        onClick={handleAddNew}
                        className={`flex h-6 w-6 items-center justify-center rounded-full transition-transform active:scale-90 ${theme.bg} ${theme.primary}`}
                    >
                        <span className="material-symbols-outlined text-sm font-bold">add</span>
                    </button>
                </div>
                <p className="text-[10px] text-slate-400 font-bold tracking-tight">
                  {selectedAccount ? `Conta ${selectedAccount.type}` : 'Visão geral do mês'}
                </p>
            </div>
        </div>
        <MonthSelector currentDate={currentDate} onMonthChange={setCurrentDate} />
      </div>

      <div className={`relative overflow-hidden rounded-[28px] p-8 text-white shadow-lg ${theme.gradient}`}>
          <div className="absolute -right-4 -bottom-4 opacity-10">
              <span className="material-symbols-outlined text-[140px] rotate-12">{theme.icon}</span>
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                  <div className="flex items-center gap-2 text-white/70 text-[11px] font-bold tracking-tight mb-3">
                      <span className="material-symbols-outlined text-sm">{theme.icon}</span>
                      {selectedAccount ? 'Saldo projetado' : 'Balanço total'}
                  </div>
                  <div className="text-5xl font-bold tracking-tighter">
                      {formatCurrency(displayBalance)}
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  <div className="rounded-2xl bg-white/10 px-4 py-2 backdrop-blur-md border border-white/10">
                      <p className="text-[10px] font-bold text-white/60 tracking-tight mb-0.5">Lançamentos</p>
                      <p className="text-lg font-bold">{filteredTransactions.length}</p>
                  </div>
              </div>
          </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between bg-slate-50/50 px-6 py-4 border-b border-slate-50">
            <h3 className="text-[10px] font-bold text-slate-400 tracking-tight">Histórico detalhado</h3>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 space-y-4">
             <div className="relative">
                <div className="h-10 w-10 rounded-full border-2 border-slate-100"></div>
                <div className="absolute top-0 h-10 w-10 animate-spin rounded-full border-t-2 border-primary"></div>
             </div>
             <p className="text-[10px] font-bold text-slate-400 tracking-tight">Sincronizando...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-center">
            <div className={`mb-6 flex h-20 w-20 items-center justify-center rounded-3xl ${theme.bg} text-opacity-40`}>
                <span className={`material-symbols-outlined text-4xl ${theme.primary} opacity-30`}>{theme.icon}</span>
            </div>
            <p className="text-lg font-bold text-slate-800">Nada por aqui ainda</p>
            <p className="mt-1 text-xs text-slate-400 font-medium">Não encontramos registros para este período nesta conta.</p>
            <Button 
                onClick={handleAddNew} 
                className={`mt-6 rounded-2xl font-bold px-8 py-3 text-sm tracking-tight ${theme.primary.replace('text', 'bg')} text-white hover:opacity-90 shadow-lg shadow-success/20`}
            >
                Adicionar lançamento
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredTransactions.map((transaction) => {
              const itemIsExpense = transaction.type === 'expense';
              const itemColor = itemIsExpense ? 'text-danger' : 'text-success';
              const itemBg = itemIsExpense ? 'bg-danger/10' : 'bg-success/10';
              const cat = getCategoryInfo(transaction.category);
              const isParcelado = transaction.totalInstallments && transaction.totalInstallments > 1;
              
              return (
                <div 
                    key={transaction.id} 
                    onClick={() => handleTransactionClick(transaction)}
                    className="group flex cursor-pointer items-center justify-between px-6 py-4 transition-all hover:bg-slate-50/50"
                >
                  <div className="flex items-center gap-4">
                    <div 
                        className={`flex h-11 w-11 items-center justify-center rounded-[14px] shadow-sm ring-1 ring-inset ring-slate-100/50 transition-all group-hover:scale-110 ${itemBg} ${itemColor}`}
                    >
                      <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-slate-700 text-sm leading-snug">{transaction.description}</p>
                        {isParcelado && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${itemIsExpense ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                            {transaction.installmentNumber}/{transaction.totalInstallments}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-400 tracking-tight">
                        <span className="text-slate-300">{new Date(transaction.date).toLocaleDateString('pt-BR')}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                        <span>{transaction.category}</span>
                        {!accountId && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                            <div className="flex items-center gap-1 opacity-60">
                                <span className="material-symbols-outlined text-[12px]">account_balance_wallet</span>
                                {accountsMap[transaction.accountId]}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                      <span className={`text-base font-bold tracking-tight ${itemColor}`}>
                        {itemIsExpense ? '-' : '+'}{formatCurrency(transaction.amount)}
                      </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NewTransactionModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
        onSave={async (data) => {
            if (editingTransaction) await updateTransaction(editingTransaction.id, data);
            else await addTransaction(data);
        }}
        onDelete={deleteTransaction}
        accounts={accounts}
        transactionToEdit={editingTransaction}
        initialType={filterType === 'credit_card' ? 'expense' : (filterType as TransactionType)}
      />
    </div>
  );
};
