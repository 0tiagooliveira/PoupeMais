
import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
// Fix: firebase is not a named export of services/firebase, so import it directly from firebase/compat/app
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
  'netflix': 'Assinaturas',
  'spotify': 'Assinaturas',
  'amazon': 'Compras',
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
  'recebimento': 'Receita',
  'pix recebido': 'Receita',
};

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
      setTimeout(() => window.location.reload(), 1500);
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
      const lower = h.toLowerCase().trim();
      if (lower.includes('dat')) map.date = h;
      if (lower.includes('desc') || lower.includes('hist') || lower.includes('info') || lower.includes('memo')) map.description = h;
      if (lower.includes('val') || lower.includes('quant') || lower.includes('montante')) map.amount = h;
      if (lower.includes('cat')) map.category = h;
      if (lower.includes('cont') || lower.includes('metodo') || lower.includes('banco') || lower.includes('origem')) map.account = h;
      if (lower.includes('tip')) map.type = h;
    });
    return map;
  };

  const parseValue = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    
    let clean = val.toString().replace(/R\$/g, '').replace(/\s/g, '').trim();
    
    // Tratamento de formatos brasileiros e americanos
    if (clean.includes('.') && clean.includes(',')) {
      // Formato: 1.234,56
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      // Formato: 1234,56
      clean = clean.replace(',', '.');
    }
    
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const autoCategorize = (description: string, providedCategory?: string): string => {
    if (providedCategory && providedCategory.toLowerCase() !== 'outros' && providedCategory.trim() !== '') {
      return providedCategory;
    }
    const desc = description.toLowerCase();
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
      addNotification('Colunas de Data ou Valor não encontradas na planilha.', 'error');
      setIsImporting(false);
      return;
    }

    try {
      const userRef = db.collection('users').doc(currentUser.uid);
      
      // Carregar contas existentes para o cache
      const accountsSnap = await userRef.collection('accounts').get();
      const accountMap = new Map<string, string>();
      accountsSnap.docs.forEach(doc => accountMap.set(doc.data().name.toLowerCase().trim(), doc.id));

      const balanceChanges = new Map<string, number>();
      const totalRows = data.length;
      const CHUNK_SIZE = 400;
      let importedCount = 0;

      for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();

        for (const row of chunk) {
          const rawDesc = row[hMap.description] || 'Importado';
          const rawAmount = parseValue(row[hMap.amount]);
          const rawAccount = (row[hMap.account] || 'Carteira').toString().trim();
          const rawDate = row[hMap.date];
          
          // Validação básica
          if (!rawDate || isNaN(rawAmount) || rawAmount === 0) continue;

          // Garantir conta existe (Se não estiver no mapa, cria agora)
          const accLower = rawAccount.toLowerCase();
          let accId = accountMap.get(accLower);
          
          if (!accId) {
            const newAccRef = userRef.collection('accounts').doc();
            const accountData = {
              name: rawAccount,
              type: 'Corrente',
              balance: 0,
              initialBalance: 0,
              color: '#21C25E',
              createdAt: new Date().toISOString()
            };
            await newAccRef.set(accountData); // Persistência imediata para evitar problemas no batch
            accId = newAccRef.id;
            accountMap.set(accLower, accId);
          }

          // Determinar Tipo e Valor
          let type: 'income' | 'expense' = row[hMap.type]?.toString().toLowerCase().includes('receita') ? 'income' : 'expense';
          let finalAmount = Math.abs(rawAmount);
          if (rawAmount < 0) type = 'expense';

          const category = autoCategorize(rawDesc, row[hMap.category]);
          const dateObj = new Date(rawDate);
          const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toISOString() : new Date().toISOString();

          const transRef = userRef.collection('transactions').doc();
          batch.set(transRef, {
            description: rawDesc,
            amount: finalAmount,
            type: type,
            category: category,
            accountId: accId,
            date: dateStr,
            status: 'completed',
            isFixed: false,
            isRecurring: false,
            createdAt: new Date().toISOString()
          });

          const currentDelta = balanceChanges.get(accId) || 0;
          balanceChanges.set(accId, currentDelta + (type === 'income' ? finalAmount : -finalAmount));
          importedCount++;
        }

        await batch.commit(); // Salva o bloco de transações
        setProgress(Math.round(((i + chunk.length) / totalRows) * 100));
      }

      // Atualizar saldos das contas em lote final
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

      addNotification(`Sucesso! ${importedCount} transações importadas.`, 'success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      console.error('Erro na importação:', err);
      addNotification('Erro ao salvar dados no banco. Verifique o formato do arquivo.', 'error');
    } finally {
      setIsImporting(false);
      setProgress(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => processImport(results.data, results.meta.fields || []),
      error: () => addNotification('Erro ao ler arquivo CSV.', 'error')
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
                {isResetting ? 'Limpando conta...' : 'Salvando no Banco de Dados...'}
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
            label="Importar Planilha (Excel/CSV)" 
            description="Categorização e Sincronização Automática" 
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
