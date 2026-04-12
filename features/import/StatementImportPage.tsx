
import React, { useState, useRef, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useAccounts } from '../../hooks/useAccounts';
import { useCreditCards } from '../../hooks/useCreditCards';
import { useCategories } from '../../hooks/useCategories';
import { useProcessing } from '../../contexts/ProcessingContext';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { BackButton } from '../../components/ui/BackButton';
import { getIconByCategoryName } from '../../utils/categoryIcons';
import { NewAccountModal } from '../dashboard/components/NewAccountModal';
import { NewCreditCardModal } from '../dashboard/components/NewCreditCardModal';
import { AutomationRulesModal } from '../automation/AutomationRulesModal';
import { DetectedTransaction, InputMode, Transaction, AutomationRule } from '../../types';

export const StatementImportPage: React.FC = () => {
  const SUGGESTED_DESTINATION_VALUE = '__suggested_destination__';
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const { accounts, addAccount } = useAccounts();
  const { cards, addCard } = useCreditCards();
  const { allCategories } = useCategories();
  
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
  const [isCreditCardModalOpen, setIsCreditCardModalOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<DetectedTransaction | null>(null);
  const [editAmountInput, setEditAmountInput] = useState('');
  const [isAutomationRuleModalOpen, setIsAutomationRuleModalOpen] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [categoryPickerMode, setCategoryPickerMode] = useState<'row' | 'edit'>('row');
  const [categoryPickerType, setCategoryPickerType] = useState<'income' | 'expense' | 'all'>('expense');
  const [categoryPickerRowIndex, setCategoryPickerRowIndex] = useState<number | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [isDestinationPanelExpanded, setIsDestinationPanelExpanded] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<any>(null);

  useEffect(() => {
    const w = window as any;
    setSpeechSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));

    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
    };
  }, []);

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

  const formatBrlInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    const value = Number(digits) / 100;
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseBrlInput = (value: string) => {
    const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeText = (value: string) => value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const getMostLikelyDestination = () => {
    const sourceTypeCounts = new Map<'account' | 'card', number>();

    results.forEach((transaction) => {
      const sourceType = transaction.sourceType || 'card';
      sourceTypeCounts.set(sourceType, (sourceTypeCounts.get(sourceType) || 0) + 1);
    });

    const suggestedSourceType = (sourceTypeCounts.get('card') || 0) >= (sourceTypeCounts.get('account') || 0)
      ? 'card'
      : 'account';

    const bankName = detectedMetadata?.bankName?.trim() || (() => {
      const bankCounts = new Map<string, { label: string; count: number }>();

      results.forEach((transaction) => {
        const transactionBankName = transaction.bankName?.trim();
        if (!transactionBankName) return;

        const normalized = normalizeText(transactionBankName);
        const existing = bankCounts.get(normalized);
        bankCounts.set(normalized, {
          label: existing?.label || transactionBankName,
          count: (existing?.count || 0) + 1,
        });
      });

      let topBankName = '';
      let topCount = 0;

      bankCounts.forEach((entry) => {
        if (entry.count > topCount) {
          topBankName = entry.label;
          topCount = entry.count;
        }
      });

      return topBankName;
    })();

    if (!bankName) return null;

    return { bankName, sourceType: suggestedSourceType } as const;
  };

  const getMostLikelyBankName = () => {
    const suggestedDestination = getMostLikelyDestination();
    if (suggestedDestination) return suggestedDestination.bankName;

    return '';
  };

  const getMostLikelySourceType = () => {
    const suggestedDestination = getMostLikelyDestination();
    return suggestedDestination?.sourceType || 'card';
  };

  const getSuggestedDestinationLabel = () => {
    if (detectedMetadata?.bankName?.trim()) {
      return detectedMetadata.bankName.trim();
    }
    return getMostLikelyBankName();
  };

  const getSuggestedDestinationId = () => {
    const bankName = getSuggestedDestinationLabel();
    if (!bankName) return '';

    const normalizedBankName = normalizeText(bankName);

    const matchingCard = cards.find((card) => {
      const normalizedCardName = normalizeText(card.name);
      return normalizedCardName.includes(normalizedBankName) || normalizedBankName.includes(normalizedCardName);
    });

    if (matchingCard) {
      return matchingCard.id;
    }

    const matchingAccount = accounts.find((account) => {
      const normalizedAccountName = normalizeText(account.name);
      return normalizedAccountName.includes(normalizedBankName) || normalizedBankName.includes(normalizedAccountName);
    });

    return matchingAccount?.id || '';
  };

  const getCategoryDefinition = (name: string, type?: 'income' | 'expense') => {
    const normalizedName = normalizeText(name);
    return allCategories.find((category) => (type ? category.type === type : true) && normalizeText(category.name) === normalizedName);
  };

  const getCategoryIcon = (name: string, type?: 'income' | 'expense') => {
    const category = getCategoryDefinition(name, type);
    return category?.icon || getIconByCategoryName(name);
  };

  const getCategoryColor = (name: string, type?: 'income' | 'expense') => {
    return getCategoryDefinition(name, type)?.color || '#94A3B8';
  };

  const openCategoryPicker = (mode: 'row' | 'edit', type: 'income' | 'expense' | 'all', rowIndex: number | null = null) => {
    setCategoryPickerMode(mode);
    setCategoryPickerType(type);
    setCategoryPickerRowIndex(rowIndex);
    setCategorySearch('');
    setIsCategoryPickerOpen(true);
  };

  const closeCategoryPicker = () => {
    setIsCategoryPickerOpen(false);
    setCategoryPickerRowIndex(null);
    setCategorySearch('');
  };

  const applyPickedCategory = (categoryName: string) => {
    if (categoryPickerMode === 'row' && categoryPickerRowIndex !== null) {
      setTransactionCategory(categoryPickerRowIndex, categoryName);
    } else {
      setEditDraft(prev => prev ? { ...prev, category: categoryName } : prev);
    }

    closeCategoryPicker();
  };

  const removeInstallmentText = (description: string) => {
    return description
      .replace(/\s*-\s*parcela\s*\d{1,2}\s*\/\s*\d{1,2}/gi, '')
      .replace(/\s+parcela\s*\d{1,2}\s*\/\s*\d{1,2}/gi, '')
      .replace(/\s+\d{1,2}\s*\/\s*\d{1,2}\s*$/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const inferInstallmentInfo = (transaction: Pick<DetectedTransaction, 'description' | 'installmentNumber' | 'totalInstallments'>) => {
    if (transaction.installmentNumber && transaction.totalInstallments) {
      return {
        installmentNumber: transaction.installmentNumber,
        totalInstallments: transaction.totalInstallments,
      };
    }

    const description = transaction.description || '';
    const patterns = [
      /parcela\s*(\d{1,3})\s*[\/-]\s*(\d{1,3})/i,
      /\b(\d{1,3})\s*[\/-]\s*(\d{1,3})\b/i,
      /(\d{1,3})\s+de\s+(\d{1,3})/i,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (!match) continue;

      const current = Number(match[1]);
      const total = Number(match[2]);

      if (!Number.isFinite(current) || !Number.isFinite(total)) continue;
      if (current < 1 || total < 2 || current > total) continue;
      if (total > 120) continue;

      return {
        installmentNumber: current,
        totalInstallments: total,
      };
    }

    return {
      installmentNumber: undefined,
      totalInstallments: undefined,
    };
  };

  const buildTransactionSignature = (params: {
    dateStr: string;
    amount: number;
    description: string;
    type: 'income' | 'expense';
    installmentNumber?: number;
    totalInstallments?: number;
  }) => {
    const baseDescription = removeInstallmentText(params.description).trim().toLowerCase();
    const installmentKey = params.installmentNumber && params.totalInstallments
      ? `${params.installmentNumber}/${params.totalInstallments}`
      : 'single';
    return `${params.dateStr}|${params.amount.toFixed(2)}|${baseDescription}|${params.type}|${installmentKey}`;
  };

  const setTransactionCategory = (index: number, category: string) => {
    const next = [...results];
    next[index] = { ...next[index], category };
    setResults(next);
  };

  const openTransactionEditor = (index: number) => {
    setEditingIndex(index);
    setEditDraft({ ...results[index] });
    setEditAmountInput((results[index].amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const closeTransactionEditor = () => {
    setEditingIndex(null);
    setEditDraft(null);
    setEditAmountInput('');
    setIsAutomationRuleModalOpen(false);
  };

  useEffect(() => {
    if (!hasResults) return;

    const suggestedDestinationId = getSuggestedDestinationId();
    if (!destinationId) {
      setDestinationId(suggestedDestinationId || SUGGESTED_DESTINATION_VALUE);
    }
  }, [hasResults, results, accounts, cards, detectedMetadata, destinationId]);

  useEffect(() => {
    if (!hasResults) {
      setIsDestinationPanelExpanded(true);
      return;
    }

    if (!destinationId) {
      setIsDestinationPanelExpanded(true);
      return;
    }

    setIsDestinationPanelExpanded(false);
  }, [hasResults, destinationId]);

  const getDestinationSummary = () => {
    if (!destinationId || destinationId === SUGGESTED_DESTINATION_VALUE) {
      const label = getSuggestedDestinationLabel() || 'Destino sugerido';
      const typeLabel = getMostLikelySourceType() === 'card' ? 'Cartão' : 'Conta';
      return { label, typeLabel, isSuggested: true };
    }

    const selectedCard = cards.find(card => card.id === destinationId);
    if (selectedCard) {
      return { label: selectedCard.name, typeLabel: 'Cartão', isSuggested: false };
    }

    const selectedAccount = accounts.find(account => account.id === destinationId);
    if (selectedAccount) {
      return { label: selectedAccount.name, typeLabel: 'Conta', isSuggested: false };
    }

    return { label: 'Destino selecionado', typeLabel: 'Manual', isSuggested: false };
  };

  const editDraftAsBaseTransaction = (): Transaction | null => {
    if (!editDraft) return null;

    return {
      id: `import-preview-${editingIndex ?? 0}`,
      description: editDraft.description,
      amount: editDraft.amount,
      type: editDraft.type,
      category: editDraft.category,
      accountId: destinationId || '',
      date: editDraft.date,
      status: 'pending',
      isFixed: false,
      isRecurring: false,
      createdAt: new Date().toISOString(),
      installmentNumber: editDraft.installmentNumber,
      totalInstallments: editDraft.totalInstallments,
    };
  };

  const saveTransactionEditor = () => {
    if (editingIndex === null || !editDraft) return;

    const next = [...results];
    next[editingIndex] = {
      ...next[editingIndex],
      ...editDraft,
      amount: parseBrlInput(editAmountInput) || next[editingIndex].amount,
      description: editDraft.description.trim() || next[editingIndex].description,
      category: editDraft.category.trim() || next[editingIndex].category,
      bankName: editDraft.bankName?.trim() || next[editingIndex].bankName,
      sourceType: editDraft.sourceType || next[editingIndex].sourceType,
    };

    setResults(next);
    closeTransactionEditor();
    addNotification('Lançamento atualizado.', 'success');
  };

  const handleApplyRuleToEditDraft = (updates: Partial<any>) => {
    // Aplica os updates da regra automática ao draft em edição
    if (!editDraft) return;

    const updatedDraft = { ...editDraft };
    
    // Aplicar updates
    if (updates.category) updatedDraft.category = updates.category;
    if (updates.description) updatedDraft.description = updates.description;
    if (updates.isIgnored !== undefined) updatedDraft.isIgnored = updates.isIgnored;

    setEditDraft(updatedDraft);
  };

  const handleRuleCreatedInImportPreview = (rule: Omit<AutomationRule, 'id'>) => {
    const normalize = (value: string) => value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const normalizedCondition = normalize(rule.conditions.descriptionContains || '');
    if (!normalizedCondition) return;

    const applyRule = (item: DetectedTransaction): DetectedTransaction => {
      const normalizedDescription = normalize(item.description || '');
      if (!normalizedDescription.includes(normalizedCondition)) return item;
      if (rule.conditions.amountMin && item.amount < parseFloat(rule.conditions.amountMin)) return item;
      if (rule.conditions.amountMax && item.amount > parseFloat(rule.conditions.amountMax)) return item;

      const updated = { ...item };
      if (rule.actions.categoryId) updated.category = rule.actions.categoryId;
      if (rule.actions.renameTo) updated.description = rule.actions.renameTo;
      return updated;
    };

    setResults(prev => prev.map(applyRule));

    setEditDraft(prev => {
      if (!prev) return prev;
      const updatedDraft = applyRule(prev);
      return { ...prev, ...updatedDraft };
    });
  };

  const toggleSourceType = (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); 
    const newTrans = [...results];
    const current = newTrans[index].sourceType;
    newTrans[index].sourceType = current === 'card' ? 'account' : 'card';
    setResults(newTrans);
  };

  const handleVoiceCapture = () => {
    if (!speechSupported) {
      addNotification('Seu navegador não suporta reconhecimento de voz.', 'warning');
      return;
    }

    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (isRecording) {
      speechRecognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }

      if (finalTranscript.trim()) {
        setTextInput(prev => `${prev.trim()} ${finalTranscript.trim()}`.trim());
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
      addNotification('Falha na captura de voz. Tente novamente.', 'warning');
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    speechRecognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
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

  const applyAutomationRulesToTransactions = async (transactions: DetectedTransaction[]) => {
    try {
      if (!currentUser || !currentUser.uid) {
        console.warn('[AUTOMATION] currentUser ou uid não disponível', { currentUser, uid: currentUser?.uid });
        return transactions;
      }

      console.log('[AUTOMATION] Aplicando regras a', transactions.length, 'transações para UID:', currentUser.uid);

      // Buscar todas as regras do usuário - com tratamento de erro de permissão
      let rules: any[] = [];
      try {
        const rulesSnapshot = await db.collection('users')
          .doc(currentUser.uid)
          .collection('automation_rules')
          .where('isActive', '==', true)
          .get();

        rules = rulesSnapshot.docs.map(doc => doc.data());
        console.log('[AUTOMATION] Regras encontradas:', rules.length);
      } catch (queryError: any) {
        console.error('[AUTOMATION] Erro ao buscar regras com where:', queryError?.code);
        
        // Fallback: buscar todas as regras sem filtro
        try {
          const rulesSnapshot = await db.collection('users')
            .doc(currentUser.uid)
            .collection('automation_rules')
            .get();

          rules = rulesSnapshot.docs
            .map(doc => doc.data())
            .filter(rule => rule.isActive !== false);
          console.log('[AUTOMATION] Regras encontradas (fallback):', rules.length);
        } catch (fallbackError: any) {
          console.error('[AUTOMATION] Erro ao buscar regras (fallback):', { uid: currentUser.uid, code: fallbackError?.code, message: fallbackError?.message });
          return transactions;
        }
      }

      if (rules.length === 0) {
        console.log('[AUTOMATION] Nenhuma regra ativa encontrada');
        return transactions;
      }

      const normalizeText = (value: string) => value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Aplicar regras a cada transação
      const result = transactions.map(trans => {
        let modified = { ...trans };

        for (const rule of rules) {
          const normalizedCondition = normalizeText(rule.conditions?.descriptionContains || '');
          const normalizedDescription = normalizeText(modified.description || '');

          // DEBUG
          console.log('[AUTOMATION] Testando:', {
            original: modified.description,
            normalizado: normalizedDescription,
            condicao: normalizedCondition,
            match: normalizedDescription.includes(normalizedCondition)
          });

          // Verificar se a descrição contém o texto procurado
          if (!normalizedDescription.includes(normalizedCondition)) continue;

          // Verificar condições adicionais
          if (rule.conditions?.amountMin && modified.amount < parseFloat(rule.conditions.amountMin)) {
            console.log('[AUTOMATION] Pulando por amountMin');
            continue;
          }
          if (rule.conditions?.amountMax && modified.amount > parseFloat(rule.conditions.amountMax)) {
            console.log('[AUTOMATION] Pulando por amountMax');
            continue;
          }

          // Aplicar ações
          console.log('[AUTOMATION] ✅ MATCH ENCONTRADO! Aplicando ações...');
          
          if (rule.actions?.categoryId) {
            console.log('[AUTOMATION] Alterando categoria de', modified.category, 'para', rule.actions.categoryId);
            modified.category = rule.actions.categoryId;
          }
          if (rule.actions?.renameTo) {
            console.log('[AUTOMATION] Renomeando de', modified.description, 'para', rule.actions.renameTo);
            modified.description = rule.actions.renameTo;
          }
          if (rule.actions?.isIgnored) {
            console.log('[AUTOMATION] Marcando como ignorada');
            modified.isIgnored = rule.actions.isIgnored;
          }

          // Parar na primeira regra que combinar
          break;
        }

        return modified;
      });

      console.log('[AUTOMATION] Resultado:', result);
      return result;
    } catch (err: any) {
      console.error('[AUTOMATION] Erro ao aplicar regras:', { msg: err?.message, code: err?.code });
      return transactions; // Retorna original se houver erro
    }
  };

  const saveTransactions = async () => {
    let toSave = results.filter(t => t.selected);
    if (toSave.length === 0) return;

    // Aplicar regras de automação antes de salvar
    toSave = await applyAutomationRulesToTransactions(toSave);

    const suggestedDestination = getMostLikelyDestination();
    const forcedDestinationName = destinationId === SUGGESTED_DESTINATION_VALUE ? suggestedDestination?.bankName : '';
    const forcedSourceType = destinationId === SUGGESTED_DESTINATION_VALUE ? suggestedDestination?.sourceType : undefined;

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
          const inferred = inferInstallmentInfo({
            description: d.description || '',
            installmentNumber: d.installmentNumber,
            totalInstallments: d.totalInstallments,
          });
          const sig = buildTransactionSignature({
            dateStr,
            amount: Number(d.amount),
            description: d.description || '',
            type: d.type,
            installmentNumber: inferred.installmentNumber,
            totalInstallments: inferred.totalInstallments,
          });
          existingSignatures.add(sig);
      });

      const accountsMap = new Map<string, string>();
      const cardsMap = new Map<string, string>();

      accounts.forEach(acc => accountsMap.set(acc.name.toLowerCase(), acc.id));
      cards.forEach(card => cardsMap.set(card.name.toLowerCase(), card.id));

      const ensureCardDestination = (name: string) => {
        const normalizedName = name.toLowerCase();
        const existingCardName = Array.from(cardsMap.keys()).find(cardName => cardName.includes(normalizedName) || normalizedName.includes(cardName));
        if (existingCardName) return cardsMap.get(existingCardName)!;

        const newCardRef = userRef.collection('credit_cards').doc();
        batch.set(newCardRef, {
          name,
          limit: detectedMetadata?.limit || 1000,
          closingDay: detectedMetadata?.closingDay || 1,
          dueDay: detectedMetadata?.dueDay || 10,
          color: getBankColor(name),
          createdAt: new Date().toISOString()
        });
        cardsMap.set(normalizedName, newCardRef.id);
        addNotification(`Cartão "${name}" criado.`, 'info');
        return newCardRef.id;
      };

      const ensureAccountDestination = (name: string) => {
        const normalizedName = name.toLowerCase();
        const existingAccountName = Array.from(accountsMap.keys()).find(accountName => accountName.includes(normalizedName) || normalizedName.includes(accountName));
        if (existingAccountName) return accountsMap.get(existingAccountName)!;

        const newAccountRef = userRef.collection('accounts').doc();
        batch.set(newAccountRef, {
          name,
          type: 'Corrente',
          balance: 0,
          initialBalance: 0,
          color: getBankColor(name),
          createdAt: new Date().toISOString()
        });
        accountsMap.set(normalizedName, newAccountRef.id);
        addNotification(`Conta "${name}" criada.`, 'info');
        return newAccountRef.id;
      };

      let futureInstallmentsCount = 0;
      let duplicatesSkipped = 0;
      let savedCount = 0;

      for (const t of toSave) {
        const inferredInstallments = inferInstallmentInfo({
          description: t.description,
          installmentNumber: t.installmentNumber,
          totalInstallments: t.totalInstallments,
        });
        const installmentNumber = inferredInstallments.installmentNumber;
        const totalInstallments = inferredInstallments.totalInstallments;

        const tDateStr = t.date.includes('T') ? t.date.split('T')[0] : t.date;
        const tSig = buildTransactionSignature({
          dateStr: tDateStr,
          amount: t.amount,
          description: t.description,
          type: t.type,
          installmentNumber,
          totalInstallments,
        });

        if (existingSignatures.has(tSig)) {
            duplicatesSkipped++;
            continue;
        }

        existingSignatures.add(tSig);

        const bankName = forcedDestinationName || t.bankName || detectedMetadata?.bankName || 'Banco Desconhecido';
        const normalizedBankName = bankName.toLowerCase();
        
        let targetId = '';
        let isCard = forcedSourceType ? forcedSourceType === 'card' : t.sourceType === 'card';

        if (destinationId) {
            if (destinationId === SUGGESTED_DESTINATION_VALUE) {
              const suggestedCardName = Array.from(cardsMap.keys()).find(name => name.includes(normalizedBankName) || normalizedBankName.includes(name));
              if (suggestedCardName) {
                targetId = cardsMap.get(suggestedCardName)!;
                isCard = true;
              } else {
                const suggestedAccountName = Array.from(accountsMap.keys()).find(name => name.includes(normalizedBankName) || normalizedBankName.includes(name));
                if (suggestedAccountName) {
                  targetId = accountsMap.get(suggestedAccountName)!;
                  isCard = false;
                } else {
                  // Se o destino sugerido não existir, cria automaticamente conforme o tipo inferido.
                  targetId = isCard ? ensureCardDestination(bankName) : ensureAccountDestination(bankName);
                }
              }
            } else {
              targetId = destinationId;
              const destIsCard = cards.some(c => c.id === destinationId);
              const destIsAccount = accounts.some(a => a.id === destinationId);
              if (destIsCard) isCard = true;
              else if (destIsAccount) isCard = false;
            }
        } else {
            if (isCard) {
            targetId = ensureCardDestination(bankName);
            } else {
            targetId = ensureAccountDestination(bankName);
            }
        }

        savedCount++;
        const transRef = userRef.collection('transactions').doc();
        const { selected, sourceType, bankName: bName, ...transactionData } = t;
        const normalizedDescription = (installmentNumber && totalInstallments)
          ? removeInstallmentText(t.description)
          : (t.description || '').trim();
        
        batch.set(transRef, {
          ...transactionData,
          description: normalizedDescription,
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

        if (installmentNumber && totalInstallments && totalInstallments > installmentNumber) {
            const remaining = totalInstallments - installmentNumber;
            const baseDate = new Date(t.date);
            const baseDesc = removeInstallmentText(t.description);

            for (let i = 1; i <= remaining; i++) {
                const nextInst = installmentNumber + i;
                const nextDate = new Date(baseDate);
                nextDate.setMonth(baseDate.getMonth() + i);

                const futureDateStr = nextDate.toISOString().split('T')[0];
                const futureSig = buildTransactionSignature({
                  dateStr: futureDateStr,
                  amount: t.amount,
                  description: baseDesc,
                  type: t.type,
                  installmentNumber: nextInst,
                  totalInstallments: totalInstallments,
                });

                if (existingSignatures.has(futureSig)) {
                  continue;
                }

                existingSignatures.add(futureSig);

                const futureRef = userRef.collection('transactions').doc();
                batch.set(futureRef, {
                    ...transactionData,
                  description: baseDesc,
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
        <div className="mx-auto max-w-3xl space-y-6 pb-32 px-3 sm:px-0 animate-in fade-in duration-500">
          <header className="flex items-start gap-3 sm:items-center sm:gap-4">
            <Button variant="ghost" onClick={handleCancel} className="h-10 w-10 rounded-full p-0"><span className="material-symbols-outlined">close</span></Button>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-tight">Revisão em Lote</h2>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">Confirme os dados extraídos</p>
            </div>
          </header>

          <div className="bg-white p-4 sm:p-6 rounded-[28px] border border-emerald-100 shadow-sm flex flex-col gap-4">
             <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Destino dos Lançamentos</label>
                  {!isDestinationPanelExpanded && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5">
                      <span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
                      <span className="text-[11px] font-black text-emerald-700 truncate max-w-[180px] sm:max-w-none">{getDestinationSummary().label}</span>
                      <span className="text-[10px] font-bold text-emerald-700/80">• {getDestinationSummary().typeLabel}</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsDestinationPanelExpanded(prev => !prev)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors"
                >
                  {isDestinationPanelExpanded ? 'Ocultar' : 'Alterar'}
                  <span className="material-symbols-outlined text-sm">{isDestinationPanelExpanded ? 'expand_less' : 'expand_more'}</span>
                </button>
             </div>

             {isDestinationPanelExpanded && (
               <>
                 <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                   O sistema sugere o destino correto com base na origem detectada. Confirme se estiver correto.
                 </p>

                 <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                   <label className="flex flex-col gap-1">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destino sugerido</span>
                     <select 
                        value={destinationId} 
                        onChange={(e) => setDestinationId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 w-full"
                     >
                        <option value="">Selecionar destino</option>
                        {(getSuggestedDestinationLabel() || getSuggestedDestinationId()) && (
                          <option value={getSuggestedDestinationId() || SUGGESTED_DESTINATION_VALUE}>
                            ✨ {getSuggestedDestinationLabel() || 'Destino sugerido'} (sugerido)
                          </option>
                        )}
                        {cards.length > 0 && (
                            <optgroup label="Seus Cartões de Crédito">
                                {cards.map(card => <option key={card.id} value={card.id}>💳 {card.name}</option>)}
                            </optgroup>
                        )}
                        {accounts.length > 0 && (
                            <optgroup label="Suas Contas Bancárias">
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>🏦 {acc.name}</option>)}
                            </optgroup>
                        )}
                     </select>
                     <p className="text-[11px] font-bold text-primary bg-primary/5 border border-primary/10 rounded-xl px-3 py-2">
                       O sistema entendeu: <span className="font-black">{getSuggestedDestinationLabel() || 'sem sugestão'}</span>
                       {getMostLikelySourceType() === 'card' ? ' • Cartão' : ' • Conta'}
                     </p>
                   </label>

                   <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-2">
                     <Button
                       type="button"
                       variant="secondary"
                       onClick={() => setIsAccountModalOpen(true)}
                       className="rounded-xl px-3 py-3 text-xs font-black whitespace-nowrap w-full"
                     >
                       + Conta
                     </Button>
                     <Button
                       type="button"
                       variant="secondary"
                       onClick={() => setIsCreditCardModalOpen(true)}
                       className="rounded-xl px-3 py-3 text-xs font-black whitespace-nowrap w-full"
                     >
                       + Cartão
                     </Button>
                   </div>
                 </div>

                 {destinationId === SUGGESTED_DESTINATION_VALUE ? (
                   <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                     Sugestão aplicada automaticamente com base na origem detectada.
                   </p>
                 ) : destinationId ? (
                   <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                     Destino fixo aplicado: todos os lançamentos selecionados irão para este destino.
                   </p>
                 ) : (
                   <p className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                     Nenhuma sugestão compatível foi encontrada. Você ainda pode escolher uma conta ou cartão manualmente.
                   </p>
                 )}
               </>
             )}
          </div>

          <section className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identificado ({selectedCount})</span>
                   <span className="text-[9px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">Automático</span>
                </div>
                <span className={`text-sm font-bold tracking-tighter ${totalAmount >= 0 ? 'text-success' : 'text-danger'} sm:self-auto self-start`}>
                  {formatCurrency(totalAmount)}
                </span>
            </div>

            <div className="divide-y divide-slate-50 max-h-[58vh] sm:max-h-[500px] overflow-y-auto custom-scrollbar">
              {results.map((t, i) => (
                <div
                  key={i}
                  className={`group flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 transition-all hover:bg-slate-50 ${!t.selected ? 'opacity-40 grayscale' : ''}`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleTransaction(i)}
                      className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${t.selected ? 'bg-primary border-primary text-white shadow-sm' : 'border-slate-200 bg-white text-transparent'}`}
                      aria-label={t.selected ? 'Desmarcar lançamento' : 'Marcar lançamento'}
                    >
                      <span className="material-symbols-outlined text-sm font-black">check</span>
                    </button>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-100 shadow-sm text-slate-400 shrink-0">
                      <span className="material-symbols-outlined text-xl">{getCategoryIcon(t.category, t.type)}</span>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openTransactionEditor(i)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openTransactionEditor(i);
                        }
                      }}
                      className="min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[15px] sm:text-sm font-black text-slate-800 leading-tight truncate">{removeInstallmentText(t.description)}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-tight">
                            <span>{new Date(t.date).toLocaleDateString()}</span>
                            {t.installmentNumber && t.totalInstallments && (
                              <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[9px] font-black text-indigo-600 whitespace-nowrap">
                                Parcela {t.installmentNumber}/{t.totalInstallments}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-base sm:hidden font-black tracking-tighter whitespace-nowrap ${t.type === 'income' ? 'text-success' : 'text-slate-800'}`}>
                          {t.type === 'income' ? '+' : ''}{formatCurrency(t.amount)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => toggleSourceType(i, e)}
                          className={`flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:bg-slate-100 active:scale-95`}
                          title="Trocar origem"
                        >
                          <span className="material-symbols-outlined text-[14px]">{t.sourceType === 'card' ? 'credit_card' : 'account_balance'}</span>
                          <span className="truncate max-w-[120px] font-bold text-[10px]">{t.bankName?.toLowerCase().startsWith('importado') ? 'Importado' : t.bankName}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCategoryPicker('row', t.type, i);
                          }}
                          className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 hover:bg-slate-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px] text-slate-500">{getCategoryIcon(t.category, t.type)}</span>
                          <span className="text-[10px] font-black text-slate-600">{t.category}</span>
                          <span className="material-symbols-outlined text-[12px] text-slate-500">expand_more</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pl-0 sm:pl-2">
                    <span className={`hidden sm:inline text-base sm:text-sm font-black tracking-tighter whitespace-nowrap ${t.type === 'income' ? 'text-success' : 'text-slate-800'}`}>
                      {t.type === 'income' ? '+' : ''}{formatCurrency(t.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openTransactionEditor(i);
                      }}
                      className="flex h-9 min-w-[84px] items-center justify-center gap-1 rounded-lg border border-slate-100 bg-white px-3 text-slate-500 hover:text-primary hover:border-primary/20 hover:shadow-sm transition-all"
                      aria-label="Editar lançamento"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest">Editar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button 
              variant="secondary" 
              onClick={handleCancel} 
              className="flex-1 py-4 sm:py-5 rounded-[24px] font-black text-sm border-slate-200 text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </Button>
            <Button 
              onClick={saveTransactions} 
              isLoading={isSaving} 
              disabled={selectedCount === 0}
              className="flex-[2] py-4 sm:py-5 rounded-[24px] bg-success hover:bg-emerald-600 text-white font-black text-sm shadow-xl shadow-success/20"
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
              addNotification("Conta criada! Se quiser, selecione no campo de destino.", "success");
            }} 
          />

          <NewCreditCardModal
            isOpen={isCreditCardModalOpen}
            onClose={() => setIsCreditCardModalOpen(false)}
            onSave={async (data) => {
              await addCard(data);
              setIsCreditCardModalOpen(false);
              addNotification("Cartão criado! Se quiser, selecione no campo de destino.", "success");
            }}
          />

          <Modal
            isOpen={editingIndex !== null && !!editDraft}
            onClose={closeTransactionEditor}
            title="Editar Lançamento"
          >
            {editDraft && (
              <div className="space-y-4">
                <Input
                  label="Nome / descrição"
                  value={editDraft.description}
                  onChange={(e) => setEditDraft(prev => prev ? { ...prev, description: e.target.value } : prev)}
                  className="w-full"
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-secondary">Valor</span>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-surface px-4 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                      <span className="text-sm font-bold text-slate-500">R$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editAmountInput}
                        onChange={(e) => setEditAmountInput(formatBrlInput(e.target.value))}
                        className="w-full bg-transparent text-base font-bold text-slate-800 outline-none"
                        placeholder="0,00"
                      />
                    </div>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-secondary">Tipo</span>
                    <select
                      value={editDraft.type}
                      onChange={(e) => setEditDraft(prev => prev ? { ...prev, type: e.target.value as 'income' | 'expense' } : prev)}
                      className="w-full rounded-lg border bg-surface px-4 py-2 outline-none transition-all border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      <option value="expense">Despesa</option>
                      <option value="income">Receita</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-secondary">Origem</span>
                    <select
                      value={editDraft.sourceType || 'account'}
                      onChange={(e) => setEditDraft(prev => prev ? { ...prev, sourceType: e.target.value as 'account' | 'card' } : prev)}
                      className="w-full rounded-lg border bg-surface px-4 py-2 outline-none transition-all border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      <option value="account">Conta bancária</option>
                      <option value="card">Cartão de crédito</option>
                    </select>
                  </label>

                  <Input
                    label="Banco / cartão"
                    value={editDraft.bankName || ''}
                    onChange={(e) => setEditDraft(prev => prev ? { ...prev, bankName: e.target.value } : prev)}
                    className="w-full"
                  />
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-secondary">Categoria</span>
                  <button
                    type="button"
                    onClick={() => openCategoryPicker('edit', editDraft.type)}
                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-surface px-3 py-2"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-lg" style={{ color: getCategoryColor(editDraft.category, editDraft.type) }}>
                        {getCategoryIcon(editDraft.category, editDraft.type)}
                      </span>
                      <span className="text-sm font-bold text-slate-700 truncate">{editDraft.category}</span>
                    </span>
                    <span className="material-symbols-outlined text-slate-400">expand_more</span>
                  </button>
                </label>

                <button
                  type="button"
                  onClick={() => setIsAutomationRuleModalOpen(true)}
                  className="w-full flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="h-10 w-10 rounded-xl bg-white text-amber-600 border border-amber-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">Regra Inteligente</p>
                      <p className="text-xs font-medium text-slate-500">Automatizar lançamentos futuros</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-amber-500">chevron_right</span>
                </button>

                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" onClick={closeTransactionEditor} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={saveTransactionEditor} className="flex-1 bg-success text-white">
                    Salvar edição
                  </Button>
                </div>
              </div>
            )}
          </Modal>

          <Modal
            isOpen={isCategoryPickerOpen}
            onClose={closeCategoryPicker}
            title="Selecionar Categoria"
          >
            <div className="space-y-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Buscar categoria..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="max-h-[48vh] overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 gap-2">
                {(categoryPickerType === 'all'
                  ? allCategories
                  : allCategories.filter(category => category.type === categoryPickerType)
                )
                  .filter(category => category.name.toLowerCase().includes(categorySearch.toLowerCase()))
                  .map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => applyPickedCategory(category.name)}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: category.color }}
                      >
                        <span className="material-symbols-outlined text-base">{category.icon || getIconByCategoryName(category.name)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">{category.name}</p>
                        <p className="text-[10px] font-bold uppercase text-slate-400">{category.type === 'income' ? 'Receita' : 'Despesa'}</p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </Modal>

          <AutomationRulesModal
            isOpen={isAutomationRuleModalOpen}
            onClose={() => setIsAutomationRuleModalOpen(false)}
            baseTransaction={editDraftAsBaseTransaction()}
            onApplyToCurrentTransaction={handleApplyRuleToEditDraft}
            onRuleCreated={handleRuleCreatedInImportPreview}
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
                accept="image/*,audio/*,application/pdf,.csv,text/csv" 
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
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Texto ou Voz</p>
                <Button
                  type="button"
                  onClick={handleVoiceCapture}
                  variant={isRecording ? 'primary' : 'secondary'}
                  className={`rounded-xl px-3 py-2 text-xs font-black ${isRecording ? 'animate-pulse' : ''}`}
                >
                  <span className="material-symbols-outlined text-base mr-1">mic</span>
                  {isRecording ? 'Parar Gravação' : 'Capturar Voz'}
                </Button>
              </div>

              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Cole texto do extrato/fatura ou use Capturar Voz para ditar os lançamentos..."
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
            className="w-full py-5 rounded-[24px] bg-success hover:bg-emerald-600 text-white font-black text-sm shadow-xl shadow-emerald-200 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {files.length > 1 ? `Processar ${files.length} Arquivos` : 'Processar com Inteligência Artificial'}
          </Button>
      </div>

    </div>
  );
};
