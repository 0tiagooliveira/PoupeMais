
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../../components/ui/Modal';
import { TransactionType, CategoryData, Transaction } from '../../../types';
import { formatCurrency } from '../../../utils/formatters';
import { getIconByCategoryName } from '../../../utils/categoryIcons';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: TransactionType;
  category?: CategoryData;
  transaction?: Transaction;
  onAddTransaction: (type: TransactionType, categoryName?: string, transaction?: Transaction) => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  type, 
  category,
  transaction,
  onAddTransaction
}) => {
  const navigate = useNavigate();

  const handleFilterView = () => {
    const route = type === 'income' ? '/incomes' : '/expenses';
    navigate(route);
    onClose();
  };

  const handleAIAnalysis = () => {
    navigate('/ai-analysis');
    onClose();
  };

  const actions = transaction ? [
    {
      label: 'Editar Lançamento',
      description: 'Alterar valor, data ou categoria deste registro',
      icon: 'edit',
      color: 'text-indigo-600 bg-indigo-50',
      onClick: () => {
        onAddTransaction(transaction.type, transaction.category, transaction);
        onClose();
      }
    },
    {
      label: `Ver Categoria: ${transaction.category}`,
      description: 'Filtrar extrato por esta categoria',
      icon: 'category',
      color: 'text-slate-600 bg-slate-50',
      onClick: handleFilterView
    },
    {
      label: 'Análise de IA do Lançamento',
      description: 'O que a IA sugere sobre este tipo de gasto?',
      icon: 'psychology',
      color: 'text-purple-600 bg-purple-50',
      onClick: handleAIAnalysis
    }
  ] : [
    {
      label: `Adicionar nova ${type === 'income' ? 'receita' : 'despesa'}`,
      description: category ? `Registrar lançamento em ${category.name}` : `Registrar novo fluxo de ${type === 'income' ? 'entrada' : 'saída'}`,
      icon: 'add_circle',
      color: type === 'income' ? 'text-success bg-emerald-50' : 'text-danger bg-red-50',
      onClick: () => onAddTransaction(type, category?.name)
    },
    {
      label: category ? `Ver transações de ${category.name}` : `Ver todas as ${type === 'income' ? 'receitas' : 'despesas'}`,
      description: 'Acessar o extrato detalhado deste período',
      icon: 'receipt_long',
      color: 'text-slate-600 bg-slate-50',
      onClick: handleFilterView
    },
    {
      label: 'Análise Inteligente',
      description: category ? `O que a IA diz sobre seus gastos em ${category.name}?` : `Insight da IA sobre suas ${type === 'income' ? 'entradas' : 'saídas'}`,
      icon: 'psychology',
      color: 'text-indigo-600 bg-indigo-50',
      onClick: handleAIAnalysis
    }
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={category || transaction ? `Opções: ${title}` : title}>
      <div className="flex flex-col gap-3 py-2">
        {/* Header Visual para Categoria */}
        {category && (
            <div className="flex items-center gap-4 p-4 mb-2 rounded-2xl bg-slate-50/50 border border-slate-100">
               <div className="h-12 w-12 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: category.color, color: '#fff' }}>
                  <span className="material-symbols-outlined text-2xl">{category.icon}</span>
               </div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo da Categoria</p>
                  <p className="text-lg font-black text-slate-800 tracking-tighter">
                    {formatCurrency(category.amount)}
                  </p>
               </div>
            </div>
        )}

        {/* Header Visual para Transação Individual */}
        {transaction && (
            <div className="flex items-center gap-4 p-4 mb-2 rounded-2xl bg-slate-50/50 border border-slate-100">
               <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm ${transaction.type === 'income' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
                  <span className="material-symbols-outlined text-2xl">{getIconByCategoryName(transaction.category)}</span>
               </div>
               <div className="flex-1 overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{transaction.category}</p>
                  <p className="text-lg font-black text-slate-800 tracking-tighter">
                    {formatCurrency(transaction.amount)}
                  </p>
               </div>
            </div>
        )}

        {actions.map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            className="group flex items-start gap-4 p-4 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-slate-50 hover:shadow-sm transition-all text-left active:scale-[0.98]"
          >
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${action.color}`}>
              <span className="material-symbols-outlined">{action.icon}</span>
            </div>
            <div>
               <p className="text-sm font-bold text-slate-800 leading-tight mb-0.5">{action.label}</p>
               <p className="text-[10px] font-medium text-slate-400 leading-snug">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
};
