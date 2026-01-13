import React, { useState, useMemo } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { Transaction, TransactionType } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { MonthSelector } from '../dashboard/components/MonthSelector';
import { Card } from '../../components/ui/Card';
import { useAccounts } from '../../hooks/useAccounts';
import { BackButton } from '../../components/ui/BackButton';
import { NewTransactionModal } from '../dashboard/components/NewTransactionModal';

interface TransactionsPageProps {
  title: string;
  filterType?: TransactionType | 'credit_card';
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({ title, filterType }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { transactions, loading, updateTransaction, deleteTransaction } = useTransactions(currentDate);
  const { accounts } = useAccounts();
  
  // States para Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Mapa para pegar o nome da conta rapidamente
  const accountsMap = useMemo(() => {
    return accounts.reduce((acc, curr) => {
      acc[curr.id] = curr.name;
      return acc;
    }, {} as Record<string, string>);
  }, [accounts]);

  const filteredTransactions = useMemo(() => {
    if (!filterType) return transactions;
    
    if (filterType === 'credit_card') {
        return transactions.filter(t => false); 
    }

    return transactions.filter(t => t.type === filterType);
  }, [transactions, filterType]);

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredTransactions]);

  const getIcon = (category: string) => {
    const map: Record<string, string> = {
      'Moradia': 'home',
      'Alimentação': 'restaurant',
      'Transporte': 'directions_car',
      'Lazer': 'movie',
      'Saúde': 'medical_services',
      'Receita/Salário': 'work',
      'Outros': 'more_horiz'
    };
    return map[category] || 'receipt';
  };

  const handleTransactionClick = (transaction: Transaction) => {
      setEditingTransaction(transaction);
      setIsModalOpen(true);
  };

  const handleSave = async (data: any) => {
      if (editingTransaction) {
          await updateTransaction(editingTransaction.id, data);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
            <BackButton className="md:hidden" />
            <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
        </div>
        <MonthSelector currentDate={currentDate} onMonthChange={setCurrentDate} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-1 bg-gradient-to-br from-slate-800 to-slate-900 text-white border-none">
            <div className="text-slate-300 text-sm mb-1">Total em {title}</div>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
            <div className="text-xs text-slate-400 mt-2">{filteredTransactions.length} lançamentos</div>
        </Card>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-surface shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-secondary">Carregando transações...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-gray-300">receipt_long</span>
            <p className="text-lg font-medium text-slate-600">Nenhum lançamento encontrado</p>
            <p className="text-sm text-secondary">Não há registros para este mês nesta categoria.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredTransactions.map((transaction) => {
              const isExpense = transaction.type === 'expense';
              return (
                <div 
                    key={transaction.id} 
                    onClick={() => handleTransactionClick(transaction)}
                    className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        isExpense ? 'bg-red-50 text-danger' : 'bg-green-50 text-success'
                    }`}>
                      <span className="material-symbols-outlined text-xl">{getIcon(transaction.category)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 flex items-center gap-2">
                        {transaction.installmentNumber && transaction.totalInstallments && (
                            <span className="text-xs font-bold text-secondary bg-gray-100 px-1.5 py-0.5 rounded">
                                {transaction.installmentNumber}/{transaction.totalInstallments}
                            </span>
                        )}
                        {transaction.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-secondary">
                        <span>{new Date(transaction.date).toLocaleDateString('pt-BR')}</span>
                        <span>•</span>
                        <span>{transaction.category}</span>
                        <span>•</span>
                        <span className="font-medium text-slate-600">
                          {accountsMap[transaction.accountId] || 'Conta Excluída'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`font-semibold ${isExpense ? 'text-danger' : 'text-success'}`}>
                    {isExpense ? '-' : '+'}{formatCurrency(transaction.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingTransaction && (
          <NewTransactionModal
            isOpen={isModalOpen}
            onClose={() => {
                setIsModalOpen(false);
                setEditingTransaction(null);
            }}
            onSave={handleSave}
            onDelete={deleteTransaction}
            accounts={accounts}
            transactionToEdit={editingTransaction}
          />
      )}
    </div>
  );
};