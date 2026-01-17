
import React, { useState, useRef } from 'react';
import firebase from 'firebase/compat/app';
import { GoogleGenAI, Type } from "@google/genai";
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { getIconByCategoryName } from '../../utils/categoryIcons';
import { NewAccountModal } from '../dashboard/components/NewAccountModal';
import { BankLogo } from '../dashboard/components/AccountsList';

interface DetectedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  selected: boolean;
}

export const StatementImportPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const { accounts, addAccount } = useAccounts();
  
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedTransactions, setDetectedTransactions] = useState<DetectedTransaction[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Preview apenas para imagens
      if (selectedFile.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selectedFile));
      } else {
        setPreviewUrl(null);
      }
      setDetectedTransactions([]);
      setStep(1);
    }
  };

  const fileToData = (file: File): Promise<{ base64?: string, text?: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        reader.readAsText(file);
        reader.onload = () => resolve({ text: reader.result as string });
      } else {
        reader.readAsDataURL(file);
        reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1] });
      }
      
      reader.onerror = error => reject(error);
    });
  };

  const processStatement = async () => {
    if (!file || !currentUser) return;
    if (!currentUser.isPro) {
      addNotification("Funcionalidade exclusiva para usuários PRO.", "info");
      return;
    }

    setIsProcessing(true);
    try {
      const { base64, text } = await fileToData(file);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `Analise estes dados financeiros (que podem vir de um CSV, PDF ou Imagem de extrato bancário).
      Se for CSV, identifique as colunas de data, valor e descrição.
      Retorne um array JSON de objetos com: 
      - date (string no formato ISO YYYY-MM-DD)
      - description (string curta e limpa)
      - amount (number positivo, use o valor absoluto)
      - type ('income' para créditos/depósitos, 'expense' para débitos/compras)
      - category (sugestão inteligente baseada na descrição)
      
      Ignore transferências internas entre contas, pagamentos de fatura de cartão (se detectado como entrada duplicada) e taxas bancárias.
      Se o valor for negativo, o tipo é 'expense'. Se for positivo, é 'income'.`;

      const contents: any = [{ parts: [{ text: prompt }] }];

      if (text) {
        contents[0].parts.push({ text: `CONTEÚDO DO ARQUIVO:\n${text}` });
      } else if (base64) {
        contents[0].parts.push({
          inlineData: {
            mimeType: file.type || 'application/pdf',
            data: base64
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                type: { type: Type.STRING },
                category: { type: Type.STRING }
              },
              required: ['date', 'description', 'amount', 'type', 'category']
            }
          }
        }
      });

      const results = JSON.parse(response.text || "[]") as DetectedTransaction[];
      setDetectedTransactions(results.map(t => ({ ...t, selected: true })));
      setStep(2);
      addNotification(`${results.length} transações processadas com sucesso!`, "success");
    } catch (err) {
      console.error("AI processing error:", err);
      addNotification("Não conseguimos ler este arquivo. Tente outro formato.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleTransaction = (index: number) => {
    const newTrans = [...detectedTransactions];
    newTrans[index].selected = !newTrans[index].selected;
    setDetectedTransactions(newTrans);
  };

  const saveTransactions = async () => {
    if (!selectedAccountId) {
      addNotification("Selecione uma conta para destino.", "warning");
      return;
    }

    const toSave = detectedTransactions.filter(t => t.selected);
    if (toSave.length === 0) return;

    setIsSaving(true);
    try {
      const batch = db.batch();
      const userRef = db.collection('users').doc(currentUser!.uid);
      const accountRef = userRef.collection('accounts').doc(selectedAccountId);
      
      let totalIncrement = 0;

      toSave.forEach(t => {
        const transRef = userRef.collection('transactions').doc();
        const { selected, ...transactionData } = t;
        
        batch.set(transRef, {
          ...transactionData,
          accountId: selectedAccountId,
          status: 'completed',
          createdAt: new Date().toISOString(),
          isFixed: false,
          isRecurring: false
        });
        
        totalIncrement += (t.type === 'income' ? t.amount : -t.amount);
      });

      batch.update(accountRef, {
        balance: firebase.firestore.FieldValue.increment(totalIncrement)
      });

      await batch.commit();
      addNotification("Lançamentos importados com sucesso!", "success");
      setDetectedTransactions([]);
      setFile(null);
      setPreviewUrl(null);
      setStep(1);
    } catch (err) {
      addNotification("Erro ao salvar dados no banco.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = detectedTransactions.filter(t => t.selected).length;
  const totalAmount = detectedTransactions.filter(t => t.selected).reduce((acc, curr) => acc + (curr.type === 'income' ? curr.amount : -curr.amount), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-32 animate-in fade-in duration-500">
      <header className="flex items-center gap-4">
        <BackButton className="bg-white border border-slate-100 shadow-sm" />
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Importação Universal</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">IA para CSV, PDF ou Fotos</p>
        </div>
      </header>

      {step === 1 ? (
        <div className="space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`group relative flex flex-col items-center justify-center rounded-[40px] border-2 border-dashed transition-all p-12 text-center cursor-pointer
              ${file ? 'border-primary bg-emerald-50/20' : 'border-slate-200 bg-white hover:border-primary hover:bg-slate-50'}`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*,application/pdf,.csv,text/csv" 
              className="hidden" 
            />
            
            {file ? (
              <div className="flex flex-col items-center">
                 {previewUrl ? (
                   <img src={previewUrl} alt="Preview" className="h-32 w-32 object-cover rounded-2xl mb-4 shadow-md" />
                 ) : (
                   <div className="h-20 w-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 mb-4">
                      <span className="material-symbols-outlined text-4xl">
                        {file.name.endsWith('.csv') ? 'csv' : 'description'}
                      </span>
                   </div>
                 )}
                 <h4 className="text-sm font-bold text-slate-800">{file.name}</h4>
                 <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Clique para trocar o arquivo</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-300 group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Escolha o seu extrato</h3>
                <p className="text-sm text-slate-400 font-medium max-w-[240px]">Envie o CSV do Nubank, um PDF do Bradesco ou uma foto do extrato físico.</p>
              </div>
            )}
          </div>

          <Button 
            onClick={processStatement} 
            disabled={!file || isProcessing} 
            isLoading={isProcessing}
            className="w-full py-5 rounded-[24px] bg-slate-900 text-white font-black text-sm shadow-xl shadow-slate-200"
          >
            {isProcessing ? 'A IA está lendo seu extrato...' : 'Analisar Arquivo'}
          </Button>
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
          
          <section className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Conta para Destino</h3>
              {accounts.length > 0 && (
                 <button onClick={() => setIsAccountModalOpen(true)} className="text-[10px] font-black text-primary uppercase">Nova Conta</button>
              )}
            </div>

            {accounts.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4">
                    <span className="material-symbols-outlined">account_balance</span>
                </div>
                <p className="text-sm text-slate-500 font-bold mb-4">Você ainda não tem contas cadastradas.</p>
                <Button onClick={() => setIsAccountModalOpen(true)} variant="secondary" className="rounded-2xl font-bold px-8">
                  + Criar minha primeira conta
                </Button>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 px-1">
                {accounts.map(acc => {
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <button 
                      key={acc.id} 
                      onClick={() => setSelectedAccountId(acc.id)}
                      className={`flex flex-col items-center gap-2 min-w-[100px] p-4 rounded-[24px] border transition-all
                        ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'}`}
                    >
                      <div className="bg-white rounded-full p-0.5 shadow-sm">
                        <BankLogo name={acc.name} color={acc.color} size="sm" />
                      </div>
                      <span className="text-[11px] font-bold truncate w-full text-center">{acc.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-8 py-5 flex items-center justify-between border-b border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revisar Lançamentos ({selectedCount})</span>
                <span className={`text-sm font-black tracking-tighter ${totalAmount >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(totalAmount)}
                </span>
            </div>

            <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto custom-scrollbar">
              {detectedTransactions.map((t, i) => (
                <div 
                  key={i} 
                  onClick={() => toggleTransaction(i)}
                  className={`flex items-center justify-between px-8 py-5 cursor-pointer transition-all hover:bg-slate-50 ${!t.selected ? 'opacity-40 grayscale' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-100 shadow-sm text-slate-400">
                      <span className="material-symbols-outlined text-xl">{getIconByCategoryName(t.category)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 leading-none mb-1">{t.description}</p>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        <span>{new Date(t.date).toLocaleDateString()}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                        <span>{t.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-black tracking-tighter ${t.type === 'income' ? 'text-success' : 'text-slate-800'}`}>
                      {t.type === 'income' ? '+' : ''}{formatCurrency(t.amount)}
                    </span>
                    <div className={`h-5 w-5 rounded-md flex items-center justify-center border-2 transition-all ${t.selected ? 'bg-primary border-primary text-white' : 'border-slate-200'}`}>
                      {t.selected && <span className="material-symbols-outlined text-xs font-black">check</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex gap-4">
            <Button 
              variant="secondary" 
              onClick={() => setStep(1)} 
              className="flex-1 py-5 rounded-[24px] font-black text-sm"
            >
              Recomeçar
            </Button>
            <Button 
              onClick={saveTransactions} 
              isLoading={isSaving} 
              disabled={selectedCount === 0 || !selectedAccountId}
              className="flex-[2] py-5 rounded-[24px] bg-success text-white font-black text-sm shadow-xl shadow-success/20"
            >
              Confirmar e Salvar
            </Button>
          </div>
        </div>
      )}

      <NewAccountModal 
        isOpen={isAccountModalOpen} 
        onClose={() => setIsAccountModalOpen(false)} 
        onSave={async (data) => {
          await addAccount(data);
          setIsAccountModalOpen(false);
          addNotification("Conta criada! Selecione-a agora.", "success");
        }} 
      />
    </div>
  );
};
