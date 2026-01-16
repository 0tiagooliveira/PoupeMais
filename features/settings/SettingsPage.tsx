
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
import { useCategories } from '../../hooks/useCategories';
import { getIconByCategoryName } from '../../utils/categoryIcons';

const CATEGORY_KEYWORDS: Record<string, string> = {
  'transferencia': 'Transferência',
  'pix': 'Transferência',
  'recebida': 'Transferência',
  'enviada': 'Transferência',
  'instituicao': 'Transferência',
  'titularidade': 'Transferência',
  'envio': 'Transferência',
  'recebido': 'Transferência',
  'adiantamento': 'Transferência',
  'rendimento': 'Transferência',
  'supermercado': 'Mercado',
  'mercado': 'Mercado',
  'alimentacao': 'Alimentação',
  'restaurante': 'Alimentação',
  'lanchonete': 'Alimentação',
  'doce': 'Alimentação',
  'padaria': 'Alimentação',
  'farmacia': 'Saúde',
  'saude': 'Saúde',
  'investimento': 'Investimentos',
  'aplicação': 'Investimentos',
  'celular': 'Telefonia',
  'internet': 'Telefonia',
  'eletricidade': 'Energia',
  'luz': 'Energia',
  'gas': 'Gás',
  'veiculo': 'Carro',
  'combustivel': 'Carro',
  'gasolina': 'Carro',
  'vestuario': 'Vestiário',
  'roupa': 'Vestiário',
  'compra': 'Compras',
  'assinatura': 'Assinaturas',
  'servico': 'Assinaturas',
  'lazer': 'Lazer',
  'viagem': 'Viagem',
  'transporte': 'Transporte',
  'uber': 'Transporte',
  'salario': 'Salário',
  'vencimento': 'Salário',
  'cartao': 'Cartão de crédito'
};

const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
  <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-50 flex items-center gap-2">
    <span className="material-symbols-outlined text-slate-400 text-lg">{icon}</span>
    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
  </div>
);

const SettingItem = ({ icon, label, description, onClick, disabled, danger }: { icon: string; label: string; description?: string; onClick?: () => void; disabled?: boolean; danger?: boolean; }) => (
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
  const { allCategories, addCustomCategory } = useCategories();
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
    try {
      const userRef = db.collection('users').doc(currentUser.uid);
      const collections = ['transactions', 'accounts', 'credit_cards', 'custom_categories'];
      for (const colName of collections) {
        const snapshot = await userRef.collection(colName).get();
        let batch = db.batch();
        let count = 0;
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref);
          count++;
          if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
        }
        if (count > 0) await batch.commit();
      }
      addNotification('Todos os seus dados foram apagados.', 'info');
      setShowResetConfirm(false);
      window.location.reload();
    } catch (err) {
      addNotification('Erro ao apagar dados.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const normalizeText = (s: string) => s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

  const getFuzzyVal = (row: any, targets: string[]): string => {
    const keys = Object.keys(row);
    const normalizedTargets = targets.map(t => normalizeText(t));
    for (const key of keys) {
      const kNorm = normalizeText(key);
      if (normalizedTargets.some(t => kNorm.includes(t) || t.includes(kNorm))) {
        return String(row[key]).trim();
      }
    }
    return "";
  };

  const parseValue = (val: string): number => {
    if (!val) return 0;
    let clean = val.replace(/R\$/g, '').replace(/\s/g, '').trim();
    if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(',', '.');
    }
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const normalizeCategory = async (cat: string, type: 'income' | 'expense', sessionCache: Set<string>) => {
    if (!cat) return 'Outros';
    const normInput = cat.trim();
    const lookupKey = `${normInput.toLowerCase()}_${type}`;

    // 1. Verificar Keywords
    for (const key in CATEGORY_KEYWORDS) {
      if (normInput.toLowerCase().includes(key)) {
        const targetName = CATEGORY_KEYWORDS[key];
        return targetName; 
      }
    }

    // 2. Verificar se já existe no banco OU se já pedimos para criar nesta sessão de importação
    const existsInSystem = allCategories.find(c => c.type === type && c.name.toLowerCase() === normInput.toLowerCase());
    
    if (existsInSystem) return existsInSystem.name;
    if (sessionCache.has(lookupKey)) return normInput;

    // 3. Criar nova com detecção inteligente de ícone
    const newColor = type === 'income' ? '#21C25E' : '#EF4444';
    const smartIcon = getIconByCategoryName(normInput);
    
    sessionCache.add(lookupKey);

    await addCustomCategory({
      name: normInput,
      icon: smartIcon,
      color: newColor,
      type: type
    });

    return normInput;
  };

  const processImport = async (data: any[]) => {
    if (!currentUser || data.length === 0) return;
    setIsImporting(true);
    setProgress(1);
    
    const sessionCategoryCache = new Set<string>();
    
    try {
      const userRef = db.collection('users').doc(currentUser.uid);
      const accountsSnap = await userRef.collection('accounts').get();
      const cardsSnap = await userRef.collection('credit_cards').get();
      
      const accountMap = new Map<string, string>();
      accountsSnap.docs.forEach(doc => accountMap.set(doc.data().name.toLowerCase(), doc.id));
      const cardMap = new Map<string, string>();
      cardsSnap.docs.forEach(doc => cardMap.set(doc.data().name.toLowerCase(), doc.id));

      const balanceChanges = new Map<string, number>();
      let importedCount = 0;
      let batch = db.batch();
      let opCount = 0;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rawDate = getFuzzyVal(row, ["Data"]);
        const rawAmount = getFuzzyVal(row, ["Valor", "Montante"]);
        const description = getFuzzyVal(row, ["Descrição", "Descricao"]);
        const categoryCsv = getFuzzyVal(row, ["Categoria"]);
        const bankName = getFuzzyVal(row, ["Conta"]) || "Nubank";
        const accountNumber = getFuzzyVal(row, ["Número da Conta", "NumeroConta"]);
        const method = getFuzzyVal(row, ["Método", "Metodo"]).toUpperCase();

        if (!rawDate || !rawAmount || !description) continue;

        const amountNum = parseValue(rawAmount);
        const absAmount = Math.abs(amountNum);
        const finalType = amountNum > 0 ? 'income' : 'expense';
        const isCredit = method.includes('CREDIT') || method.includes('CARTAO');
        
        let targetId = '';
        const entityName = `${bankName} ${accountNumber}`.trim();
        const entityKey = entityName.toLowerCase();

        if (isCredit) {
          targetId = cardMap.get(entityKey) || '';
          if (!targetId) {
            const newRef = userRef.collection('credit_cards').doc();
            targetId = newRef.id;
            batch.set(newRef, { name: entityName, limit: 2000, closingDay: 1, dueDay: 10, color: '#820ad1', createdAt: new Date().toISOString() });
            cardMap.set(entityKey, targetId);
            opCount++;
          }
        } else {
          targetId = accountMap.get(entityKey) || '';
          if (!targetId) {
            const newRef = userRef.collection('accounts').doc();
            targetId = newRef.id;
            batch.set(newRef, { name: entityName, type: 'Corrente', balance: 0, initialBalance: 0, color: '#21C25E', createdAt: new Date().toISOString() });
            accountMap.set(entityKey, targetId);
            opCount++;
          }
          const currentDelta = balanceChanges.get(targetId) || 0;
          balanceChanges.set(targetId, currentDelta + (finalType === 'income' ? absAmount : -absAmount));
        }

        const normalizedCat = await normalizeCategory(categoryCsv, finalType, sessionCategoryCache);

        const transRef = userRef.collection('transactions').doc();
        batch.set(transRef, {
          description,
          amount: absAmount,
          type: finalType,
          category: normalizedCat,
          accountId: targetId,
          date: new Date(rawDate.split('/').reverse().join('-')).toISOString(),
          status: 'completed',
          isFixed: false,
          isRecurring: false,
          createdAt: new Date().toISOString()
        });
        
        importedCount++;
        opCount++;

        if (opCount >= 400) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
          setProgress(Math.round(((i + 1) / data.length) * 100));
        }
      }

      if (opCount > 0) await batch.commit();
      
      batch = db.batch();
      opCount = 0;
      for (const [id, delta] of balanceChanges.entries()) {
        if (delta !== 0) {
          batch.update(userRef.collection('accounts').doc(id), { balance: firebase.firestore.FieldValue.increment(delta) });
          opCount++;
        }
      }
      if (opCount > 0) await batch.commit();

      setProgress(100);
      addNotification(`${importedCount} transações processadas com sucesso!`, 'success');
      
    } catch (err) {
      addNotification('Erro ao processar arquivo.', 'error');
    } finally {
      setIsImporting(false);
      setProgress(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      Papa.parse(text, { header: true, skipEmptyLines: true, delimiter: ";", complete: (res) => processImport(res.data) });
    };
    reader.readAsText(file, "ISO-8859-1");
  };

  return (
    <div className="mx-auto max-w-xl pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Configurações</h2>
            <p className="text-xs font-bold text-slate-400">Gerencie sua conta</p>
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
                {isResetting ? 'Limpando conta...' : 'Importando...'}
              </p>
              {!isResetting && <p className="text-xs font-black text-slate-800">{progress}%</p>}
           </div>
           <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-300 ${isResetting ? 'bg-danger w-full' : 'bg-success'}`} style={!isResetting ? { width: `${progress}%` } : {}}></div>
           </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
        <SectionHeader title="Perfil" icon="person" />
        <div className="divide-y divide-slate-50">
          <SettingItem icon="edit" label="Editar perfil" onClick={() => setIsEditProfileOpen(true)} />
        </div>

        <SectionHeader title="Dados e Importação" icon="database" />
        <div className="divide-y divide-slate-50">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
          <SettingItem icon={isImporting ? 'sync' : 'upload_file'} label="Importar Extrato (CSV)" description="Unificação automática de categorias de bancos" onClick={handleImportClick} disabled={isImporting || isResetting} />
        </div>

        <SectionHeader title="Segurança" icon="warning" />
        <div className="divide-y divide-slate-50">
          <SettingItem icon="restart_alt" label="Limpar todos os dados" danger onClick={() => setShowResetConfirm(true)} disabled={isImporting || isResetting} />
        </div>
      </div>

      <EditProfileModal isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />
      <ConfirmationModal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} onConfirm={handleResetData} message="Deseja apagar permanentemente todos os seus lançamentos?" confirmText="Sim, limpar tudo" isLoading={isResetting} variant="danger" />
    </div>
  );
};
