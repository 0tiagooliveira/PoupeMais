
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import firebase from 'firebase/compat/app';
import { auth, db } from '../../services/firebase';
import { useNotification } from '../../contexts/NotificationContext';
import { BackButton } from '../../components/ui/BackButton';
import { EditProfileModal } from './EditProfileModal';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import Papa from 'https://esm.sh/papaparse@5.4.1';

const CATEGORY_KEYWORDS: Record<string, string> = {
  'uber': 'Transporte',
  '99app': 'Transporte',
  'posto': 'Transporte',
  'combustivel': 'Transporte',
  'ifood': 'Alimentação',
  'restaurante': 'Alimentação',
  'mercado': 'Mercado',
  'supermercado': 'Mercado',
  'extra': 'Mercado',
  'carrefour': 'Mercado',
  'shopee': 'Compras',
  'shein': 'Compras',
  'aliexpress': 'Compras',
  'mercadolivre': 'Compras',
  'mercado livre': 'Compras',
  'amazon': 'Compras',
  'netflix': 'Assinaturas',
  'spotify': 'Assinaturas',
  'farmacia': 'Saúde',
  'drogaria': 'Saúde',
  'hospital': 'Saúde',
  'academia': 'Bem-estar',
  'aluguel': 'Moradia',
  'condominio': 'Moradia',
  'luz': 'Energia',
  'enel': 'Energia',
  'sabesp': 'Água',
  'internet': 'Assinaturas',
  'vivo': 'Assinaturas',
  'claro': 'Assinaturas',
  'salario': 'Salário',
  'pagamento': 'Salário', // Cuidado: Pagamentos recebidos de empresas geralmente são salários
  'recebimento': 'Receita',
  'pix recebido': 'Receita',
  'pix no credito': 'Transferência',
  'pix no crédito': 'Transferência',
  'estorno': 'Reembolso',
  'reembolso': 'Reembolso',
};

// Palavras-chave que indicam claramente que é uma despesa, mesmo se o valor for positivo no CSV
const KNOWN_EXPENSES = [
  'uber', 'ifood', 'netflix', 'amazon', 'mercado', 'pagamento', 'compra', 'iof', 
  'shopee', 'shein', 'pix no credito', 'pix no crédito'
];

const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
  <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-50 flex items-center gap-2">
    <span className="material-symbols-outlined text-slate-400 text-lg">{icon}</span>
    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
  </div>
);

const SettingItem = ({ 
  icon, 
  label, 
  description, 
  onClick, 
  disabled, 
  danger 
}: { 
  icon: string; 
  label: string; 
  description?: string; 
  onClick?: () => void; 
  disabled?: boolean; 
  danger?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center justify-between p-6 transition-all hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${danger ? 'text-danger' : 'text-slate-700'}`}
  >
    <div className="flex items-center gap-4 text-left">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${danger ? 'bg-red-50' : 'bg-slate-50'} ${icon === 'sync' ? 'animate-spin' : ''}`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <div>
        <p className="text-sm font-bold tracking-tight">{label}</p>
        {description && <p className="text-[10px] font-medium text-slate-400 mt-0.5">{description}</p>}
      </div>
    </div>
    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
  </button>
);

export const SettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = () => auth.signOut();
  const handleImportClick = () => !isImporting && fileInputRef.current?.click();

  const handleResetData = async () => {
    if (!currentUser) return;
    setIsResetting(true);
    addNotification('Limpando seus dados...', 'warning');

    try {
      const userRef = db.collection('users').doc(currentUser.uid);
      const collections = ['transactions', 'accounts', 'credit_cards'];

      for (const colName of collections) {
        const snapshot = await userRef.collection(colName).get();
        const chunks = [];
        const docs = snapshot.docs;
        
        for (let i = 0; i < docs.length; i += 400) {
          chunks.push(docs.slice(i, i + 400));
        }

        for (const chunk of chunks) {
          const batch = db.batch();
          chunk.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      addNotification('Sua conta foi resetada com sucesso.', 'success');
      setTimeout(() => {
         navigate('/');
      }, 1000);
    } catch (error) {
      console.error('Erro ao resetar dados:', error);
      addNotification('Erro ao limpar dados. Tente novamente.', 'error');
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  const mapHeaders = (headers: string[]) => {
    const map: Record<string, string> = {};
    headers.forEach(h => {
      if (!h) return;
      const lower = h.toLowerCase().trim();
      if (lower.includes('data') || lower === 'dt') map.date = h;
      if (lower.includes('desc') || lower.includes('hist') || lower.includes('info') || lower.includes('memo') || lower.includes('title')) map.description = h;
      if (lower === 'valor' || lower.includes('quant') || lower.includes('montante') || lower.includes('amount')) map.amount = h;
      if (lower.includes('cat')) map.category = h;
      if (lower === 'conta' || lower.includes('origem')) map.account = h;
      if (lower.includes('número') || lower.includes('numero') || lower === 'number') map.number = h;
      if (lower.includes('método') || lower.includes('metodo') || lower === 'method') map.method = h;
      if (lower.includes('tip') || lower === 'kind') map.type = h;
    });
    return map;
  };

  const parseValue = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    
    let clean = val.toString().replace(/R\$/g, '').replace(/\s/g, '').trim();
    // Tratamento para formatos brasileiros e americanos misturados
    if (clean.includes(',') && !clean.includes('.')) {
       clean = clean.replace(',', '.');
    } else if (clean.includes('.') && clean.includes(',')) {
       clean = clean.replace(/\./g, '').replace(',', '.');
    }
    
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    try {
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                let year = parseInt(parts[2]);
                if (year < 100) year += 2000;
                
                const d = new Date(year, month, day);
                if (!isNaN(d.getTime())) return d;
            }
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
    } catch (e) {
        return new Date();
    }
  };

  const autoCategorize = (description: string, providedCategory?: string): string => {
    if (providedCategory && providedCategory.toLowerCase() !== 'outros' && providedCategory.trim() !== '') {
      return providedCategory;
    }
    const desc = (description || '').toLowerCase();
    for (const [key, cat] of Object.entries(CATEGORY_KEYWORDS)) {
      if (desc.includes(key)) return cat;
    }
    return 'Outros';
  };

  const processImport = async (data: any[], headers: string[]) => {
    if (!currentUser || data.length === 0) return;
    setIsImporting(true);
    setProgress(0);
    
    const hMap = mapHeaders(headers);
    if (!hMap.date || !hMap.amount) {
      addNotification('Não encontramos colunas de Data ou Valor.', 'error');
      setIsImporting(false);
      return;
    }

    try {
      const userRef = db.collection('users').doc(currentUser.uid);
      
      const accountsSnap = await userRef.collection('accounts').get();
      const accountMap = new Map<string, string>();
      accountsSnap.docs.forEach(doc => accountMap.set(doc.data().name.toLowerCase().trim(), doc.id));

      const cardsSnap = await userRef.collection('credit_cards').get();
      const cardMap = new Map<string, string>();
      cardsSnap.docs.forEach(doc => cardMap.set(doc.data().name.toLowerCase().trim(), doc.id));

      const balanceChanges = new Map<string, number>();
      const totalRows = data.length;
      const CHUNK_SIZE = 400;
      let importedCount = 0;
      let minDate: Date | null = null;
      let maxDate: Date | null = null;

      // --- DETECÇÃO DE CONTEXTO ---
      let useStandardSignConvention = true;
      const hasNegativeValues = data.some(row => parseValue(row[hMap.amount]) < 0);
      
      if (!hasNegativeValues) {
         // Se não tem negativos, verificamos se tem "cara" de fatura de cartão (Uber, iFood positivos, Pix no crédito)
         const seemsLikeCreditCard = data.slice(0, 20).some(row => {
             const val = parseValue(row[hMap.amount]);
             const desc = (row[hMap.description] || '').toLowerCase();
             return val > 0 && KNOWN_EXPENSES.some(k => desc.includes(k));
         });
         if (seemsLikeCreditCard) {
            useStandardSignConvention = false; // Modo Invertido (Nubank Card CSV): Positivo = Despesa
         }
      }

      for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();

        for (const row of chunk) {
          const rawDateStr = row[hMap.date];
          const rawAmount = parseValue(row[hMap.amount]);
          const rawDesc = row[hMap.description] || 'Importado';
          const descLower = rawDesc.toLowerCase();
          
          if (!rawDateStr || isNaN(rawAmount) || rawAmount === 0) continue;

          // --- CORREÇÃO DE DUPLICIDADE (REGRA GLOBAL) ---
          // "Pagamento recebido" no CSV do Nubank é o crédito interno da fatura paga.
          // Isso NUNCA deve ser tratado como receita. Ignoramos completamente.
          if (descLower.includes('pagamento recebido') || descLower.includes('pagamento de fatura')) {
             continue;
          }

          // Detecção de Cartão vs Conta ANTES de processar
          const isCreditCardMethod = row[hMap.method] ? (row[hMap.method].toString().toUpperCase().includes('CREDIT') || row[hMap.method].toString().toUpperCase().includes('CRÉDITO')) : false;
          const isCreditCardContext = !useStandardSignConvention || isCreditCardMethod;

          let finalAmount = Math.abs(rawAmount);
          let type: 'income' | 'expense';

          if (useStandardSignConvention) {
              // Padrão Bancário: Negativo (< 0) é Despesa
              type = rawAmount < 0 ? 'expense' : 'income';
          } else {
              // Padrão Cartão (Nubank CSV): Positivo (> 0) é Despesa
              // Se vier algo negativo aqui, tratamos como estorno (Receita)
              type = rawAmount > 0 ? 'expense' : 'income';
          }

          // REGRA DE SEGURANÇA: Pix no Crédito é sempre despesa
          if (descLower.includes('pix no credito') || descLower.includes('pix no crédito')) {
             type = 'expense';
          }

          let targetId = '';
          const rawNumber = row[hMap.number] ? row[hMap.number].toString().trim() : '';
          const rawAccountName = row[hMap.account] ? row[hMap.account].toString().trim() : 'Nubank';
          
          if (isCreditCardContext) {
             let targetName = `Cartão Nubank ${rawNumber || 'Principal'}`.trim();
             if (rawNumber === '6255') targetName = 'Cartão Físico'; 
             
             const targetNameLower = targetName.toLowerCase();
             targetId = cardMap.get(targetNameLower) || '';

             if (!targetId) {
                const newCardRef = userRef.collection('credit_cards').doc();
                await newCardRef.set({ name: targetName, limit: 0, closingDay: 1, dueDay: 10, color: '#820ad1', createdAt: new Date().toISOString() });
                targetId = newCardRef.id;
                cardMap.set(targetNameLower, targetId);
             }
          } else {
             // Conta Corrente
             let targetName = rawNumber ? `${rawAccountName} ${rawNumber}` : rawAccountName;
             const targetNameLower = targetName.toLowerCase();
             targetId = accountMap.get(targetNameLower) || '';

             if (!targetId) {
                const newAccRef = userRef.collection('accounts').doc();
                await newAccRef.set({ name: targetName, type: 'Corrente', balance: 0, initialBalance: 0, color: '#820ad1', createdAt: new Date().toISOString() });
                targetId = newAccRef.id;
                accountMap.set(targetNameLower, targetId);
             }
          }

          let category = autoCategorize(rawDesc, row[hMap.category]);
          
          // --- CORREÇÃO DE ESTORNOS E REEMBOLSOS ---
          // Se for cartão de crédito e for 'income', é Reembolso (exceto se categorizado explicitamente diferente)
          if (isCreditCardContext && type === 'income') {
              category = 'Reembolso';
          }
          
          // Regra Geral: Se descrição contiver "Estorno" ou "Crédito de" (sem ser salário/resgate), é Reembolso
          if (descLower.includes('estorno') || (descLower.includes('crédito de') && !descLower.includes('salário') && !descLower.includes('salario') && !descLower.includes('resgate') && !descLower.includes('transferência'))) {
              if (type === 'income') {
                  category = 'Reembolso';
              }
          }

          const dateObj = parseDate(rawDateStr);
          
          if (!minDate || dateObj < minDate) minDate = dateObj;
          if (!maxDate || dateObj > maxDate) maxDate = dateObj;

          const transRef = userRef.collection('transactions').doc();
          batch.set(transRef, {
            description: rawDesc,
            amount: finalAmount,
            type: type,
            category: category,
            accountId: targetId,
            date: dateObj.toISOString(),
            status: 'completed',
            isFixed: false,
            isRecurring: false,
            createdAt: new Date().toISOString()
          });

          // Atualiza saldo APENAS se o destino for uma Conta (e não Cartão de Crédito)
          if (!isCreditCardContext) {
             const currentDelta = balanceChanges.get(targetId) || 0;
             balanceChanges.set(targetId, currentDelta + (type === 'income' ? finalAmount : -finalAmount));
          }
          
          importedCount++;
        }

        await batch.commit();
        setProgress(Math.round(((i + chunk.length) / totalRows) * 100));
      }

      if (balanceChanges.size > 0) {
        const accBatch = db.batch();
        balanceChanges.forEach((delta, id) => {
          if (!isNaN(delta) && delta !== 0) {
            accBatch.update(userRef.collection('accounts').doc(id), {
              balance: firebase.firestore.FieldValue.increment(delta)
            });
          }
        });
        await accBatch.commit();
      }

      let dateMsg = "";
      if (minDate && maxDate) {
         const fmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' });
         const d1 = fmt.format(minDate);
         const d2 = fmt.format(maxDate);
         dateMsg = d1 === d2 ? ` de ${d1}` : ` de ${d1} a ${d2}`;
      }

      addNotification(`Organizado! ${importedCount} itens importados${dateMsg}.`, 'success', 8000);

    } catch (err) {
      console.error('Erro na importação:', err);
      addNotification('Erro ao processar o arquivo.', 'error');
    } finally {
      setIsImporting(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!Papa) {
        addNotification("Biblioteca CSV não carregada.", "error");
        return;
    }

    const readFile = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const buffer = e.target?.result as ArrayBuffer;
          const decoderUtf8 = new TextDecoder('utf-8', { fatal: true });
          const decoderIso = new TextDecoder('iso-8859-1');
          let text = '';
          try {
            text = decoderUtf8.decode(buffer);
          } catch (err) {
            console.warn("UTF-8 decoding failed, falling back to ISO-8859-1");
            text = decoderIso.decode(buffer);
          }
          resolve(text);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    };

    readFile(file)
      .then((csvText) => {
         Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
          complete: (results) => processImport(results.data, results.meta.fields || []),
          error: () => addNotification('Erro ao interpretar o conteúdo do CSV.', 'error')
        });
      })
      .catch((err) => {
        console.error("Erro na leitura do arquivo", err);
        addNotification("Não foi possível ler o arquivo.", "error");
      });
  };

  return (
    <div className="mx-auto max-w-xl pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Configurações</h2>
            <p className="text-xs font-bold text-slate-400">Gerencie sua experiência</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-danger transition-all active:scale-95">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>

      {(isImporting || isResetting) && (
        <div className="mb-6 rounded-[24px] bg-white border border-success/20 p-6 shadow-lg animate-pulse">
           <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-success uppercase tracking-widest">
                {isResetting ? 'Limpando conta...' : 'Organizando transações...'}
              </p>
              {!isResetting && <p className="text-xs font-black text-slate-800">{progress}%</p>}
           </div>
           <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${isResetting ? 'bg-danger w-full' : 'bg-success'}`} 
                style={!isResetting ? { width: `${progress}%` } : {}}
              ></div>
           </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
        <SectionHeader title="Perfil" icon="person" />
        <div className="divide-y divide-slate-50">
          <SettingItem icon="edit" label="Editar perfil" onClick={() => setIsEditProfileOpen(true)} />
        </div>

        <SectionHeader title="Dados e Migração" icon="database" />
        <div className="divide-y divide-slate-50">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
          <SettingItem 
            icon={isImporting ? 'sync' : 'upload_file'} 
            label="Importar Nubank/CSV" 
            description="Reconhece cartões físicos e virtuais automaticamente" 
            onClick={handleImportClick}
            disabled={isImporting || isResetting}
          />
          <SettingItem icon="download" label="Exportar Backup" onClick={() => addNotification('Em breve!', 'info')} />
        </div>

        <SectionHeader title="Zona de Perigo" icon="warning" />
        <div className="divide-y divide-slate-50">
          <SettingItem 
            icon="restart_alt" 
            label="Limpar todos os dados" 
            description="Apaga transações, contas e cartões" 
            danger 
            onClick={() => setShowResetConfirm(true)}
            disabled={isImporting || isResetting}
          />
          <SettingItem 
            icon="delete_forever" 
            label="Excluir minha conta" 
            danger 
            onClick={() => addNotification('Funcionalidade disponível via suporte.', 'info')} 
          />
        </div>
      </div>

      <EditProfileModal isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />
      
      <ConfirmationModal 
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetData}
        title="Resetar todos os dados?"
        message="Esta ação é irreversível. Todas as suas transações, contas bancárias conectadas e cartões de crédito serão excluídos permanentemente."
        confirmText="Sim, limpar tudo"
        cancelText="Manter dados"
        isLoading={isResetting}
        variant="danger"
      />
    </div>
  );
};
