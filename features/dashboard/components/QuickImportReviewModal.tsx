
import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { DetectedTransaction, Account } from '../../../types';
import { formatCurrency } from '../../../utils/formatters';
import { getIconByCategoryName } from '../../../utils/categoryIcons';
import { BankLogo } from './AccountsList';
import { db } from '../../../services/firebase';
import firebase from 'firebase/compat/app';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotification } from '../../../contexts/NotificationContext';

interface QuickImportReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: DetectedTransaction[];
  accounts: Account[];
}

export const QuickImportReviewModal: React.FC<QuickImportReviewModalProps> = ({ isOpen, onClose, results: initialResults, accounts }) => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const [results, setResults] = useState<DetectedTransaction[]>(initialResults);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setResults(initialResults);
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [initialResults, accounts]);

  const toggleTransaction = (index: number) => {
    const copy = [...results];
    copy[index].selected = !copy[index].selected;
    setResults(copy);
  };

  const handleSave = async () => {
    if (!selectedAccountId) {
      addNotification("Selecione uma conta de destino.", "warning");
      return;
    }

    const toSave = results.filter(r => r.selected);
    if (toSave.length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const batch = db.batch();
      const userRef = db.collection('users').doc(currentUser!.uid);
      const accountRef = userRef.collection('accounts').doc(selectedAccountId);
      
      let totalFlow = 0;

      toSave.forEach(t => {
        const transRef = userRef.collection('transactions').doc();
        const { selected, ...data } = t;
        
        batch.set(transRef, {
          ...data,
          accountId: selectedAccountId,
          status: 'completed',
          createdAt: new Date().toISOString(),
          isFixed: false,
          isRecurring: false
        });
        
        totalFlow += (t.type === 'income' ? t.amount : -t.amount);
      });

      batch.update(accountRef, {
        balance: firebase.firestore.FieldValue.increment(totalFlow)
      });

      await batch.commit();
      addNotification(`${toSave.length} lançamentos salvos com sucesso!`, "success");
      onClose();
    } catch (e) {
      addNotification("Erro ao salvar lançamentos.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = results.filter(t => t.selected).length;
  const totalAmount = results.filter(t => t.selected).reduce((acc, curr) => acc + (curr.type === 'income' ? curr.amount : -curr.amount), 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lançamento Inteligente">
      <div className="flex flex-col gap-6 pt-2">
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100/50 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
             <span className="material-symbols-outlined">auto_awesome</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">IA Extraiu com Sucesso</p>
            <p className="text-xs font-bold text-emerald-800 leading-tight">Revise os dados abaixo antes de confirmar.</p>
          </div>
        </div>

        <section>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-1">Conta de Destino</label>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {accounts.map(acc => {
              const isSelected = selectedAccountId === acc.id;
              return (
                <button 
                  key={acc.id} 
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`flex flex-col items-center gap-2 min-w-[90px] p-3 rounded-2xl border transition-all ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                >
                  <div className="bg-white rounded-full p-0.5"><BankLogo name={acc.name} color={acc.color} size="sm" /></div>
                  <span className="text-[9px] font-bold truncate w-full text-center">{acc.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
          <div className="space-y-3">
            {results.map((t, i) => (
              <div 
                key={i} 
                onClick={() => toggleTransaction(i)}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${t.selected ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-40'}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                    <span className="material-symbols-outlined text-lg">{getIconByCategoryName(t.category)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{t.description}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{t.category} • {new Date(t.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-black ${t.type === 'income' ? 'text-success' : 'text-slate-800'}`}>
                    {t.type === 'income' ? '+' : ''}{formatCurrency(t.amount)}
                  </span>
                  <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all ${t.selected ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'}`}>
                    {t.selected && <span className="material-symbols-outlined text-[14px] font-black">check</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-50">
           <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total selecionado</span>
              <span className={`text-lg font-black tracking-tighter ${totalAmount >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(totalAmount)}
              </span>
           </div>
           <Button 
            onClick={handleSave} 
            isLoading={isSaving} 
            disabled={selectedCount === 0 || !selectedAccountId}
            className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-sm uppercase tracking-widest shadow-xl"
           >
             Confirmar {selectedCount} Lançamento{selectedCount > 1 ? 's' : ''}
           </Button>
        </div>
      </div>
    </Modal>
  );
};
