
import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useCategories } from '../../hooks/useCategories';
import { useAccounts } from '../../hooks/useAccounts';
import { useNotification } from '../../contexts/NotificationContext';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Transaction, AutomationRule } from '../../types';
import { getIconByCategoryName } from '../../utils/categoryIcons';

interface AutomationRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseTransaction?: Transaction | null;
}

export const AutomationRulesModal: React.FC<AutomationRulesModalProps> = ({ isOpen, onClose, baseTransaction }) => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const { allCategories, addCustomCategory } = useCategories();
  const { accounts } = useAccounts();

  // Estados da Regra
  const [descriptionContains, setDescriptionContains] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  
  const [targetCategory, setTargetCategory] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [shouldRename, setShouldRename] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);
  const [applyToExisting, setApplyToExisting] = useState(true);
  
  const [isCategorySelectorOpen, setIsCategorySelectorOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Inicializa com dados da transação base se houver
  useEffect(() => {
    if (isOpen && baseTransaction) {
      setDescriptionContains(baseTransaction.description);
      // Sugere um range de valor +- 10% ou exato
      // setAmountMin((baseTransaction.amount * 0.9).toFixed(2));
      // setAmountMax((baseTransaction.amount * 1.1).toFixed(2));
      setTargetCategory(baseTransaction.category);
      setRenameTo(baseTransaction.description); // Sugestão inicial
    } else if (isOpen) {
      // Reset
      setDescriptionContains('');
      setAmountMin('');
      setAmountMax('');
      setSelectedAccountId('all');
      setTargetCategory('');
      setRenameTo('');
      setShouldRename(false);
      setShouldHide(false);
      setApplyToExisting(true);
    }
  }, [isOpen, baseTransaction]);

  const filteredCategories = useMemo(() => {
    return allCategories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()));
  }, [allCategories, categorySearch]);

  const selectedCategoryData = useMemo(() => {
    return allCategories.find(c => c.name === targetCategory);
  }, [allCategories, targetCategory]);

  const handleCreateCategory = async () => {
    if (!categorySearch.trim()) return;
    
    const newName = categorySearch.trim();
    // Tenta inferir o tipo com base na transação original, ou assume despesa como padrão para regras
    const type = baseTransaction?.type || 'expense';

    try {
      await addCustomCategory({
        name: newName,
        icon: 'category', // Ícone padrão
        color: '#64748B', // Cor neutra padrão
        type: type
      });
      
      setTargetCategory(newName);
      setCategorySearch('');
      setIsCategorySelectorOpen(false);
      addNotification(`Categoria "${newName}" criada!`, 'success');
    } catch (error) {
      addNotification('Erro ao criar categoria.', 'error');
    }
  };

  const handleSaveRule = async () => {
    if (!currentUser) return;
    if (!descriptionContains.trim()) {
      addNotification("A regra precisa de um texto para buscar.", "warning");
      return;
    }
    if (!targetCategory && !shouldRename && !shouldHide) {
      addNotification("Selecione ao menos uma ação (categorizar, renomear ou ocultar).", "warning");
      return;
    }

    setLoading(true);
    try {
      const rawRule = {
        conditions: {
          descriptionContains: descriptionContains.trim(),
          amountMin: amountMin || undefined,
          amountMax: amountMax || undefined,
          accountId: selectedAccountId === 'all' ? undefined : selectedAccountId
        },
        actions: {
          categoryId: targetCategory || undefined,
          renameTo: shouldRename ? renameTo : undefined,
          isIgnored: shouldHide ? true : undefined
        },
        isActive: true,
        createdAt: new Date().toISOString()
      };

      // IMPORTANTE: Remove chaves com valor 'undefined' recursivamente para o Firestore aceitar
      const newRule = JSON.parse(JSON.stringify(rawRule));

      // Salvar Regra
      await db.collection('users').doc(currentUser.uid).collection('automation_rules').add(newRule);

      // Aplicar Retroativamente (Batch Processing)
      if (applyToExisting) {
        await applyRuleToHistory(newRule);
      }

      addNotification("Regra criada com sucesso!", "success");
      onClose();
    } catch (err) {
      console.error(err);
      addNotification("Erro ao salvar regra.", "error");
    } finally {
      setLoading(false);
    }
  };

  const applyRuleToHistory = async (rule: Omit<AutomationRule, 'id'>) => {
    // Busca as últimas 500 transações para aplicar a regra
    // Firestore não tem 'contains', então buscamos tudo (ou por data) e filtramos no cliente
    const snapshot = await db.collection('users').doc(currentUser!.uid)
      .collection('transactions')
      .orderBy('date', 'desc')
      .limit(500)
      .get();

    const batch = db.batch();
    let updatesCount = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data() as Transaction;
      
      // Valida Condições
      const matchDesc = data.description.toLowerCase().includes(rule.conditions.descriptionContains.toLowerCase());
      if (!matchDesc) return;

      if (rule.conditions.accountId && data.accountId !== rule.conditions.accountId) return;
      if (rule.conditions.amountMin && data.amount < parseFloat(rule.conditions.amountMin)) return;
      if (rule.conditions.amountMax && data.amount > parseFloat(rule.conditions.amountMax)) return;

      // Aplica Ações
      const updates: any = {};
      if (rule.actions.categoryId) updates.category = rule.actions.categoryId;
      if (rule.actions.renameTo) updates.description = rule.actions.renameTo;
      if (rule.actions.isIgnored !== undefined) updates.isIgnored = rule.actions.isIgnored;

      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates);
        updatesCount++;
      }
    });

    if (updatesCount > 0) {
      await batch.commit();
      addNotification(`${updatesCount} transações antigas foram atualizadas.`, "info");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Regra de Categorização">
      <div className="flex flex-col gap-5 pt-2 relative max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
        
        {/* Category Selector Overlay */}
        {isCategorySelectorOpen && (
          <div className="absolute inset-0 z-20 bg-surface flex flex-col animate-in slide-in-from-right duration-300">
             <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-50">
                <button type="button" onClick={() => setIsCategorySelectorOpen(false)} className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600">
                   <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h3 className="text-sm font-bold text-slate-800">Escolha a Categoria</h3>
             </div>
             <div className="mb-4 relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input type="text" placeholder="Buscar..." value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="w-full bg-slate-50 rounded-xl py-3 pl-10 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all" autoFocus />
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar pb-4 pr-1">
                {categorySearch.trim() && (
                    <button
                        type="button"
                        onClick={handleCreateCategory}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl mb-3 bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 transition-colors group active:scale-[0.98]"
                    >
                        <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-emerald-600">add</span>
                        </div>
                        <div className="text-left">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 block mb-0.5">Nova Categoria</span>
                            <p className="text-sm font-bold">Criar "{categorySearch}"</p>
                        </div>
                    </button>
                )}
                
                <div className="grid grid-cols-3 gap-3">
                   {filteredCategories.map(cat => (
                      <button key={cat.id || cat.name} type="button" onClick={() => { setTargetCategory(cat.name); setIsCategorySelectorOpen(false); }} className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all active:scale-95">
                         <div className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm text-white text-xl" style={{ backgroundColor: cat.color }}>
                            <span className="material-symbols-outlined">{cat.icon || getIconByCategoryName(cat.name)}</span>
                         </div>
                         <span className="text-[10px] font-bold text-slate-600 text-center leading-tight line-clamp-2">{cat.name}</span>
                      </button>
                   ))}
                </div>
                
                {filteredCategories.length === 0 && !categorySearch && (
                    <div className="text-center py-10 opacity-50">
                        <span className="material-symbols-outlined text-4xl mb-2">category</span>
                        <p className="text-xs font-bold">Nenhuma categoria encontrada</p>
                    </div>
                )}
             </div>
          </div>
        )}

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Quando a transação...</label>
          
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:border-primary/30 transition-all group">
               <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm">
                     <span className="material-symbols-outlined text-lg">text_fields</span>
                  </div>
                  <span className="text-xs font-bold text-slate-700">Descrição contém</span>
               </div>
               <input 
                 type="text" 
                 placeholder="Ex: Uber, Mercado, Pix..." 
                 value={descriptionContains} 
                 onChange={e => setDescriptionContains(e.target.value)} 
                 className="w-full bg-transparent border-b border-slate-200 py-2 text-sm font-bold text-slate-800 outline-none focus:border-primary placeholder:text-slate-300"
               />
               <p className="text-[9px] text-slate-400 mt-1 font-medium">Busca texto em qualquer parte da descrição</p>
            </div>

            <div className="flex gap-3">
               <div className="flex-1 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <label className="text-[9px] font-bold text-slate-400 mb-1 block">Valor Mín (Opcional)</label>
                  <input type="number" placeholder="0,00" value={amountMin} onChange={e => setAmountMin(e.target.value)} className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none" />
               </div>
               <div className="flex-1 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <label className="text-[9px] font-bold text-slate-400 mb-1 block">Valor Max (Opcional)</label>
                  <input type="number" placeholder="Infinito" value={amountMax} onChange={e => setAmountMax(e.target.value)} className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none" />
               </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center justify-between">
               <span className="text-xs font-bold text-slate-500 ml-1">Conta Específica</span>
               <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="bg-white border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none max-w-[150px]">
                  <option value="all">Todas as contas</option>
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
               </select>
            </div>
          </div>
        </div>

        <div>
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Categorizar como...</label>
           <button type="button" onClick={() => setIsCategorySelectorOpen(true)} className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all active:scale-[0.98] ${targetCategory ? `bg-white border-primary/30 shadow-sm ring-1 ring-primary/10` : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200'}`}>
               <div className="flex items-center gap-3">
                  {targetCategory && selectedCategoryData ? (
                     <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: selectedCategoryData.color }}><span className="material-symbols-outlined">{selectedCategoryData.icon || getIconByCategoryName(targetCategory)}</span></div>
                  ) : (
                     <div className="h-10 w-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400"><span className="material-symbols-outlined">category</span></div>
                  )}
                  <div className="text-left">
                     <span className={`block text-sm font-bold ${targetCategory ? 'text-slate-800' : 'text-slate-400'}`}>{targetCategory || "Selecionar categoria"}</span>
                  </div>
               </div>
               <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
        </div>

        <div>
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Ações Automáticas</label>
           
           <div className={`flex flex-col p-4 rounded-2xl border transition-all mb-3 ${shouldRename ? 'bg-slate-50 border-slate-200' : 'border-slate-100 bg-white'}`}>
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><span className="material-symbols-outlined text-lg">edit</span></div>
                    <span className="text-xs font-bold text-slate-700">Renomear transação</span>
                 </div>
                 <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={shouldRename} onChange={e => setShouldRename(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-800"></div>
                 </label>
              </div>
              {shouldRename && (
                 <input type="text" placeholder="Novo nome..." value={renameTo} onChange={e => setRenameTo(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 animate-in slide-in-from-top-2" />
              )}
           </div>

           <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${shouldHide ? 'bg-slate-50 border-slate-200' : 'border-slate-100 bg-white'}`}>
              <div className="flex items-center gap-3">
                 <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><span className="material-symbols-outlined text-lg">visibility_off</span></div>
                 <div>
                    <span className="text-xs font-bold text-slate-700 block">Ocultar transação</span>
                    <span className="text-[9px] text-slate-400">Não exibir em relatórios</span>
                 </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                 <input type="checkbox" checked={shouldHide} onChange={e => setShouldHide(e.target.checked)} className="sr-only peer" />
                 <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-800"></div>
              </label>
           </div>
        </div>

        <div className="flex items-center gap-2 py-2 px-1">
           <input type="checkbox" id="applyHistory" checked={applyToExisting} onChange={e => setApplyToExisting(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary" />
           <label htmlFor="applyHistory" className="text-xs font-bold text-slate-500 cursor-pointer select-none">Aplicar esta regra a transações passadas</label>
        </div>

        <div className="pt-2 border-t border-slate-50 flex gap-3">
           <Button variant="ghost" onClick={onClose} className="flex-1 rounded-2xl font-bold h-12">Cancelar</Button>
           <Button onClick={handleSaveRule} isLoading={loading} className="flex-1 rounded-2xl font-bold h-12 bg-slate-900 text-white shadow-xl hover:bg-slate-800">Salvar Regra</Button>
        </div>
      </div>
    </Modal>
  );
};
