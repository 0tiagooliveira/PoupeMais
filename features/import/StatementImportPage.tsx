
import React, { useState, useRef, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useAccounts } from '../../hooks/useAccounts';
import { useCreditCards } from '../../hooks/useCreditCards';
import { useProcessing } from '../../contexts/ProcessingContext';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { getIconByCategoryName } from '../../utils/categoryIcons';
import { NewAccountModal } from '../dashboard/components/NewAccountModal';
import { BankLogo } from '../dashboard/components/AccountsList';
import { DetectedTransaction, InputMode } from '../../types';

export const StatementImportPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const { accounts, addAccount } = useAccounts();
  const { cards } = useCreditCards();
  
  const { 
    isProcessing, 
    progressText, 
    results, 
    detectedMetadata, 
    hasResults, 
    startProcessing, 
    clearResults, 
    setResults 
  } = useProcessing();
  
  const [mode, setMode] = useState<InputMode>('file');
  const [files, setFiles] = useState<File[]>([]);
  const [textInput, setTextInput] = useState('');
  
  const [destinationId, setDestinationId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
    // Reset input to allow selecting same files again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartProcessing = () => {
    startProcessing(mode, files, textInput);
  };

  const toggleTransaction = (index: number) => {
    const newTrans = [...results];
    newTrans[index].selected = !newTrans[index].selected;
    setResults(newTrans);
  };

  const toggleSourceType = (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); 
    const newTrans = [...results];
    const current = newTrans[index].sourceType;
    newTrans[index].sourceType = current === 'card' ? 'account' : 'card';
    setResults(newTrans);
  };

  const getBankColor = (bankName: string) => {
    const name = bankName.toLowerCase();
    if (name.includes('nubank') || name.includes('nu pagamentos')) return '#820ad1';
    if (name.includes('itaú') || name.includes('itau')) return '#ec7000';
    if (name.includes('bradesco')) return '#cc092f';
    if (name.includes('inter')) return '#ff7a00';
    if (name.includes('santander')) return '#ec0000';
    return '#21C25E';
  };

  const saveTransactions = async () => {
    const toSave = results.filter(t => t.selected);
    if (toSave.length === 0) return;

    setIsSaving(true);
    try {
      const batch = db.batch();
      const userRef = db.collection('users').doc(currentUser!.uid);
      
      // --- DETECÇÃO DE DUPLICIDADE ---
      const dates = toSave.map(t => new Date(t.date).getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      
      minDate.setDate(minDate.getDate() - 5);
      maxDate.setDate(maxDate.getDate() + 5);

      const existingSnap = await userRef.collection('transactions')
        .where('date', '>=', minDate.toISOString())
        .where('date', '<=', maxDate.toISOString())
        .get();

      const existingSignatures = new Set<string>();
      existingSnap.docs.forEach(doc => {
          const d = doc.data();
          const dateStr = d.date.split('T')[0];
          const desc = d.description.trim().toLowerCase();
          const amount = parseFloat(d.amount).toFixed(2);
          const sig = `${dateStr}|${amount}|${desc}|${d.type}`;
          existingSignatures.add(sig);
      });

      const accountsMap = new Map<string, string>();
      const cardsMap = new Map<string, string>();

      accounts.forEach(acc => accountsMap.set(acc.name.toLowerCase(), acc.id));
      cards.forEach(card => cardsMap.set(card.name.toLowerCase(), card.id));

      let futureInstallmentsCount = 0;
      let duplicatesSkipped = 0;
      let savedCount = 0;

      for (const t of toSave) {
        const tDateStr = t.date.includes('T') ? t.date.split('T')[0] : t.date;
        const tDesc = t.description.trim().toLowerCase();
        const tAmount = t.amount.toFixed(2);
        const tSig = `${tDateStr}|${tAmount}|${tDesc}|${t.type}`;

        if (existingSignatures.has(tSig)) {
            duplicatesSkipped++;
            continue;
        }

        const bankName = t.bankName || detectedMetadata?.bankName || 'Banco Desconhecido';
        const normalizedBankName = bankName.toLowerCase();
        
        let targetId = '';
        let isCard = t.sourceType === 'card';

        if (destinationId) {
            targetId = destinationId;
            const destIsCard = cards.some(c => c.id === destinationId);
            const destIsAccount = accounts.some(a => a.id === destinationId);
            if (destIsCard) isCard = true;
            else if (destIsAccount) isCard = false;
        } else {
            if (isCard) {
                const existingCardName = Array.from(cardsMap.keys()).find(name => name.includes(normalizedBankName) || normalizedBankName.includes(name));
                if (existingCardName) {
                    targetId = cardsMap.get(existingCardName)!;
                } else {
                    const newCardRef = userRef.collection('credit_cards').doc();
                    batch.set(newCardRef, {
                        name: bankName,
                        limit: detectedMetadata?.limit || 1000,
                        closingDay: detectedMetadata?.closingDay || 1,
                        dueDay: detectedMetadata?.dueDay || 10,
                        color: getBankColor(bankName),
                        createdAt: new Date().toISOString()
                    });
                    targetId = newCardRef.id;
                    // ATUALIZA O MAPA IMEDIATAMENTE para evitar duplicatas na mesma importação
                    cardsMap.set(normalizedBankName, targetId);
                    addNotification(`Cartão "${bankName}" criado.`, 'info');
                }
            } else {
                const existingAccountName = Array.from(accountsMap.keys()).find(name => name.includes(normalizedBankName) || normalizedBankName.includes(name));
                if (existingAccountName) {
                    targetId = accountsMap.get(existingAccountName)!;
                } else {
                    const newAccountRef = userRef.collection('accounts').doc();
                    batch.set(newAccountRef, {
                        name: bankName,
                        type: 'Corrente',
                        balance: 0,
                        initialBalance: 0,
                        color: getBankColor(bankName),
                        createdAt: new Date().toISOString()
                    });
                    targetId = newAccountRef.id;
                    // ATUALIZA O MAPA IMEDIATAMENTE para evitar duplicatas na mesma importação
                    accountsMap.set(normalizedBankName, targetId);
                    addNotification(`Conta "${bankName}" criada.`, 'info');
                }
            }
        }

        savedCount++;
        const transRef = userRef.collection('transactions').doc();
        const { selected, sourceType, bankName: bName, installmentNumber, totalInstallments, ...transactionData } = t;
        
        batch.set(transRef, {
          ...transactionData,
          accountId: targetId,
          status: 'completed',
          createdAt: new Date().toISOString(),
          isFixed: false,
          isRecurring: false,
          installmentNumber: installmentNumber ?? null,
          totalInstallments: totalInstallments ?? null
        });
        
        if (!isCard) {
            batch.update(userRef.collection('accounts').doc(targetId), {
                balance: firebase.firestore.FieldValue.increment(t.type === 'income' ? t.amount : -t.amount)
            });
        }

        if (isCard && installmentNumber && totalInstallments && totalInstallments > installmentNumber) {
            const remaining = totalInstallments - installmentNumber;
            const baseDate = new Date(t.date);
            const baseDesc = t.description.replace(/\s?\d{1,2}[\/-]\d{1,2}|\s?\d{1,2}\sde\s\d{1,2}/gi, '').trim();

            for (let i = 1; i <= remaining; i++) {
                const nextInst = installmentNumber + i;
                const nextDate = new Date(baseDate);
                nextDate.setMonth(baseDate.getMonth() + i);
                const futureRef = userRef.collection('transactions').doc();
                batch.set(futureRef, {
                    ...transactionData,
                    description: `${baseDesc} ${nextInst}/${totalInstallments}`, 
                    accountId: targetId,
                    status: 'pending', 
                    date: nextDate.toISOString(),
                    createdAt: new Date().toISOString(),
                    isFixed: false,
                    isRecurring: false,
                    installmentNumber: nextInst,
                    totalInstallments: totalInstallments
                });
                futureInstallmentsCount++;
            }
        }
      }

      if (savedCount > 0) {
          await batch.commit();
          let successMsg = `${savedCount} importados!`;
          if (futureInstallmentsCount > 0) successMsg += ` + ${futureInstallmentsCount} parcelas.`;
          if (duplicatesSkipped > 0) successMsg += ` (${duplicatesSkipped} ignorados)`;
          addNotification(successMsg, "success", 6000);
      } else if (duplicatesSkipped > 0) {
          addNotification(`Todos os ${duplicatesSkipped} itens já existiam.`, "info", 5000);
      } else {
          addNotification("Nenhum lançamento novo para salvar.", "warning");
      }
      
      clearResults();
      setFiles([]);
      setTextInput('');
      setDestinationId('');
    } catch (err) {
      console.error(err);
      addNotification("Erro ao salvar. " + (err instanceof Error ? err.message : ''), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    clearResults();
    setFiles([]);
    setTextInput('');
    setDestinationId('');
  };

  const selectedCount = results.filter(t => t.selected).length;
  const totalAmount = results.filter(t => t.selected).reduce((acc, curr) => acc + (curr.type === 'income' ? curr.amount : -curr.amount), 0);

  // VIEW: PROCESSING STATE
  if (isProcessing) {
    return (
      <div className="mx-auto max-w-3xl min-h-[60vh] flex flex-col items-center justify-center p-8 animate-in fade-in duration-700">
        <div className="relative mb-10">
           <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
           <div className="absolute inset-0 rounded-full bg-primary/10 animate-[pulse_2s_infinite]"></div>
           <div className="relative h-28 w-28 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-slate-50 z-10">
              <span className="material-symbols-outlined text-6xl text-primary animate-pulse">savings</span>
           </div>
           <div className="absolute inset-[-10px] animate-[spin_3s_linear_infinite]">
              <div className="h-4 w-4 bg-primary rounded-full shadow-lg border-2 border-white absolute top-0 left-1/2 -translate-x-1/2"></div>
           </div>
        </div>

        <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2 text-center">
          Processando...
        </h3>
        
        <div className="h-8 mb-4 overflow-hidden relative w-full text-center">
           <p className="text-sm font-bold text-primary uppercase tracking-widest animate-[slideInUp_0.5s_ease-out]">
             {progressText}
           </p>
        </div>

        <div className="w-full max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden mb-8">
           <div className="h-full bg-gradient-to-r from-primary to-emerald-400 animate-[loading_2s_ease-in-out_infinite] w-[30%] rounded-full"></div>
        </div>
      </div>
    );
  }

  // VIEW: REVIEW STATE
  if (hasResults) {
    return (
        <div className="mx-auto max-w-3xl space-y-8 pb-32 animate-in fade-in duration-500">
          <header className="flex items-center gap-4">
            <Button variant="ghost" onClick={handleCancel} className="h-10 w-10 rounded-full p-0"><span className="material-symbols-outlined">close</span></Button>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Revisão em Lote</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Confirme os dados extraídos</p>
            </div>
          </header>

          <div className="bg-white p-6 rounded-[32px] border border-emerald-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Destino dos Lançamentos</label>
                <p className="text-xs text-slate-500 max-w-xs">Selecione para evitar duplicação de cartões (Ex: Nubank)</p>
             </div>
             <select 
                value={destinationId} 
                onChange={(e) => setDestinationId(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 w-full md:w-auto min-w-[250px]"
             >
                <option value="">✨ Automático (Detectar/Criar)</option>
                {cards.length > 0 && (
                    <optgroup label="Seus Cartões de Crédito">
                        {cards.map(card => <option key={card.id} value={card.id}>{card.name}</option>)}
                    </optgroup>
                )}
                {accounts.length > 0 && (
                    <optgroup label="Suas Contas Bancárias">
                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </optgroup>
                )}
             </select>
          </div>

          <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-8 py-5 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identificado ({selectedCount})</span>
                   <span className="text-[9px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">Automático</span>
                </div>
                <span className={`text-sm font-bold tracking-tighter ${totalAmount >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(totalAmount)}
                </span>
            </div>

            <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto custom-scrollbar">
              {results.map((t, i) => (
                <div 
                  key={i} 
                  onClick={() => toggleTransaction(i)}
                  className={`flex items-center justify-between px-6 py-4 cursor-pointer transition-all hover:bg-slate-50 ${!t.selected ? 'opacity-40 grayscale' : ''}`}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-100 shadow-sm text-slate-400 shrink-0">
                      <span className="material-symbols-outlined text-xl">{getIconByCategoryName(t.category)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 leading-none mb-1 truncate">{t.description}</p>
                          {t.installmentNumber && t.totalInstallments && (
                              <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 uppercase whitespace-nowrap">
                                  {t.installmentNumber}/{t.totalInstallments}
                              </span>
                          )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-tight flex-wrap">
                        <span>{new Date(t.date).toLocaleDateString()}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                        
                        <div 
                            onClick={(e) => toggleSourceType(i, e)}
                            className={`flex cursor-pointer items-center gap-1 px-2 py-1 rounded-lg border transition-all hover:brightness-95 active:scale-95 ${t.sourceType === 'card' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}
                        >
                            <span className="material-symbols-outlined text-[14px]">{t.sourceType === 'card' ? 'credit_card' : 'account_balance'}</span>
                            <span className="truncate max-w-[100px] font-bold text-[10px]">{t.bankName}</span>
                        </div>
                        
                        <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                        <span className="text-slate-500">{t.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-2">
                    <span className={`text-sm font-black tracking-tighter whitespace-nowrap ${t.type === 'income' ? 'text-success' : 'text-slate-800'}`}>
                      {t.type === 'income' ? '+' : ''}{formatCurrency(t.amount)}
                    </span>
                    <div className={`h-6 w-6 rounded-lg flex items-center justify-center border-2 transition-all shrink-0 ${t.selected ? 'bg-primary border-primary text-white shadow-sm' : 'border-slate-200 bg-white'}`}>
                      {t.selected && <span className="material-symbols-outlined text-sm font-black">check</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex gap-4">
            <Button 
              variant="secondary" 
              onClick={handleCancel} 
              className="flex-1 py-5 rounded-[24px] font-black text-sm border-slate-200 text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </Button>
            <Button 
              onClick={saveTransactions} 
              isLoading={isSaving} 
              disabled={selectedCount === 0}
              className="flex-[2] py-5 rounded-[24px] bg-success hover:bg-emerald-600 text-white font-black text-sm shadow-xl shadow-success/20"
            >
              Salvar Tudo
            </Button>
          </div>
          
          <NewAccountModal 
            isOpen={isAccountModalOpen} 
            onClose={() => setIsAccountModalOpen(false)} 
            onSave={async (data) => {
              await addAccount(data);
              setIsAccountModalOpen(false);
              addNotification("Conta criada!", "success");
            }} 
          />
        </div>
    );
  }

  // VIEW: INPUT STATE (Step 1)
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-32 animate-in fade-in duration-500">
      <header className="flex items-center gap-4">
        <BackButton className="bg-white border border-slate-100 shadow-sm" />
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Importação Múltipla</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Extratos, Faturas e CSVs</p>
        </div>
      </header>

      <div className="space-y-6">
          <div className="flex p-1 bg-slate-100 rounded-2xl relative">
            <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-white shadow-sm transition-all duration-300 ease-out ${mode === 'text' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`} />
            <button type="button" onClick={() => setMode('file')} className={`flex-1 relative z-10 py-3 text-xs font-black uppercase tracking-widest transition-colors ${mode === 'file' ? 'text-primary' : 'text-slate-400'}`}>
               <span className="flex items-center justify-center gap-2"><span className="material-symbols-outlined text-lg">upload_file</span> Arquivos</span>
            </button>
            <button type="button" onClick={() => setMode('text')} className={`flex-1 relative z-10 py-3 text-xs font-black uppercase tracking-widest transition-colors ${mode === 'text' ? 'text-primary' : 'text-slate-400'}`}>
               <span className="flex items-center justify-center gap-2"><span className="material-symbols-outlined text-lg">chat</span> Texto</span>
            </button>
          </div>

          {mode === 'file' ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`group relative flex flex-col items-center justify-center rounded-[40px] border-2 border-dashed transition-all p-8 text-center cursor-pointer min-h-[300px]
                ${files.length > 0 ? 'border-primary bg-emerald-50/20' : 'border-slate-200 bg-white hover:border-primary hover:bg-slate-50'}`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*,application/pdf,.csv,text/csv" 
                className="hidden" 
                multiple
              />
              
              {files.length > 0 ? (
                <div className="w-full max-w-sm space-y-4 animate-in zoom-in-95">
                   <div className="h-20 w-20 mx-auto bg-white rounded-3xl flex items-center justify-center text-primary shadow-lg relative">
                      <span className="material-symbols-outlined text-4xl">folder_zip</span>
                      <div className="absolute -top-2 -right-2 bg-slate-900 text-white h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 border-white">
                        {files.length}
                      </div>
                   </div>
                   
                   <div className="bg-white rounded-2xl p-2 max-h-[180px] overflow-y-auto custom-scrollbar border border-slate-100 shadow-sm text-left">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl group/item">
                           <div className="flex items-center gap-2 overflow-hidden">
                              <span className="material-symbols-outlined text-slate-400 text-lg">{f.name.endsWith('.csv') ? 'csv' : 'description'}</span>
                              <span className="text-xs font-bold text-slate-700 truncate">{f.name}</span>
                           </div>
                           <button onClick={(e) => removeFile(i, e)} className="text-slate-300 hover:text-danger p-1 rounded-lg"><span className="material-symbols-outlined text-base">close</span></button>
                        </div>
                      ))}
                   </div>
                   
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Clique para adicionar mais</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[32px] bg-slate-50 text-slate-300 group-hover:text-primary transition-colors shadow-sm">
                    <span className="material-symbols-outlined text-5xl">cloud_upload</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Arraste ou selecione arquivos</h3>
                  <p className="text-sm text-slate-400 font-medium max-w-[260px] leading-relaxed">Suportamos múltiplos PDFs, imagens e CSVs de uma só vez.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Cole aqui o conteúdo do PDF ou mensagens..."
                className="w-full h-[300px] rounded-[40px] border border-slate-200 p-8 text-sm font-medium text-slate-700 placeholder:text-slate-300 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all shadow-sm"
              />
              <div className="absolute bottom-6 right-6 flex items-center gap-2 pointer-events-none opacity-40">
                <span className="material-symbols-outlined text-slate-400">auto_awesome</span>
                <span className="text-[10px] font-black uppercase text-slate-400">Detecção Automática</span>
              </div>
            </div>
          )}

          <Button 
            onClick={handleStartProcessing} 
            disabled={(mode === 'file' && files.length === 0) || (mode === 'text' && !textInput.trim())} 
            className="w-full py-5 rounded-[24px] bg-slate-900 hover:bg-slate-800 text-white font-black text-sm shadow-xl shadow-slate-200 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {files.length > 1 ? `Processar ${files.length} Arquivos` : 'Processar com Inteligência Artificial'}
          </Button>
      </div>
    </div>
  );
};
