
import { useState, useEffect, useRef } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, TransactionFrequency } from '../types';

interface AddTransactionData extends Omit<Transaction, 'id' | 'createdAt'> {
  repeatCount?: number;
}

export const useTransactions = (currentDate: Date, viewMode: 'month' | 'year' = 'month') => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const autoFixingIdsRef = useRef<Set<string>>(new Set());
  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth();
  const periodKey = viewMode === 'year' ? `${selectedYear}` : `${selectedYear}-${selectedMonth}`;

  const normalizeText = (value: string) => value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const shouldForceIncomeByDescription = (description: string) => {
    const desc = normalizeText(description || '');

    const hasIncomingSignal =
      desc.includes('transferencia recebida') ||
      desc.includes('pix recebido') ||
      desc.includes('pix recebida') ||
      desc.includes('recebimento pix') ||
      desc.includes('recebido via pix') ||
      desc.includes('recebida via pix') ||
      desc.includes('valor adicionado na conta por cartao de credito') ||
      (desc.includes('valor adicionado') && desc.includes('pix no credito'));

    const hasOutgoingSignal =
      desc.includes('transferencia enviada') ||
      desc.includes('pix enviado') ||
      desc.includes('pagamento') ||
      desc.includes('fatura');

    return hasIncomingSignal && !hasOutgoingSignal;
  };

  // Função para remover campos undefined que o Firebase rejeita
  const sanitize = (obj: any) => {
    const clean = { ...obj };
    Object.keys(clean).forEach(key => {
      if (clean[key] === undefined) {
        delete clean[key];
      }
    });
    return clean;
  };

  useEffect(() => {
    if (!currentUser || !currentUser.uid) {
      console.log('[TRANSACTIONS] Waiting for currentUser...', { currentUser });
      return;
    }
    setLoading(true);
    console.log('[TRANSACTIONS] Loading transactions for UID:', currentUser.uid, 'Period:', periodKey, 'ViewMode:', viewMode);

    let startQueryDate: Date;
    let endQueryDate: Date;

    if (viewMode === 'year') {
      // Começo do ano (Jan 1)
      startQueryDate = new Date(selectedYear, 0, 1);
      startQueryDate.setHours(0, 0, 0, 0);
      
      // Fim do ano (Dec 31)
      endQueryDate = new Date(selectedYear, 11, 31);
      endQueryDate.setHours(23, 59, 59, 999);
    } else {
      // Lógica original mensal
      startQueryDate = new Date(selectedYear, selectedMonth, 1);
      startQueryDate.setHours(0, 0, 0, 0);

      endQueryDate = new Date(selectedYear, selectedMonth + 1, 0);
      endQueryDate.setHours(23, 59, 59, 999);
    }

    // Margem de segurança para timezone
    const queryStart = new Date(startQueryDate);
    queryStart.setDate(queryStart.getDate() - 1);

    const queryEnd = new Date(endQueryDate);
    queryEnd.setDate(queryEnd.getDate() + 1);

    const query = db.collection('users')
      .doc(currentUser.uid)
      .collection('transactions')
      .where('date', '>=', queryStart.toISOString())
      .where('date', '<=', queryEnd.toISOString())
      .orderBy('date', 'desc');

    const unsubscribe = query.onSnapshot((snapshot) => {
      const rawData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];

      // Corrige automaticamente transações importadas como despesa que, pela descrição,
      // são transferências recebidas (receita).
      const misclassifiedIncome = rawData.filter((t) => {
        if (t.type !== 'expense') return false;
        if (!t.description || !shouldForceIncomeByDescription(t.description)) return false;
        if (autoFixingIdsRef.current.has(t.id)) return false;
        return true;
      });

      if (misclassifiedIncome.length > 0) {
        const userRef = db.collection('users').doc(currentUser.uid);

        misclassifiedIncome.forEach((t) => autoFixingIdsRef.current.add(t.id));

        // Executa autocorreção de forma não-bloqueante
        // onSnapshot continuará atualizando a UI após a correção
        Promise.resolve().then(async () => {
          try {
            await Promise.all(misclassifiedIncome.map(async (t) => {
              const transRef = userRef.collection('transactions').doc(t.id);

              await db.runTransaction(async (transaction) => {
                const latestTransDoc = await transaction.get(transRef);
                if (!latestTransDoc.exists) return;

                const latest = latestTransDoc.data() as Transaction;
                if (latest.type !== 'expense') return;
                if (!latest.description || !shouldForceIncomeByDescription(latest.description)) return;

                const amount = Math.abs(Number(latest.amount) || 0);

                transaction.update(transRef, {
                  type: 'income',
                  amount,
                });

                if (latest.status === 'completed' && !latest.isIgnored && latest.accountId && !isNaN(amount)) {
                  const accountRef = userRef.collection('accounts').doc(latest.accountId);
                  const accountDoc = await transaction.get(accountRef);

                  if (accountDoc.exists) {
                    // A transação já impactou como despesa (-X). Para virar receita (+X), ajustamos +2X.
                    transaction.update(accountRef, {
                      balance: firebase.firestore.FieldValue.increment(amount * 2),
                    });
                  }
                }
              });
            }));
          } catch (error) {
            console.error('Erro na autocorreção de receitas recebidas:', error);
          } finally {
            misclassifiedIncome.forEach((t) => autoFixingIdsRef.current.delete(t.id));
          }
        });
      }

      const filteredData = rawData.filter(t => {
        const tDate = new Date(t.date);
        if (viewMode === 'year') {
          return tDate.getFullYear() === selectedYear;
        } else {
          return tDate.getMonth() === selectedMonth && 
              tDate.getFullYear() === selectedYear;
        }
      });

      console.log('[TRANSACTIONS] Loaded', filteredData.length, 'transactions');
      setTransactions(filteredData);
      setLoading(false);
    }, (error: any) => {
      console.error('[TRANSACTIONS] Error fetching transactions:', { uid: currentUser.uid, message: error.message, code: error.code, period: periodKey });
      setTransactions([]);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser?.uid, periodKey, viewMode]);

  const calculateFutureDate = (baseDate: Date, frequency: TransactionFrequency, index: number) => {
    const newDate = new Date(baseDate);
    if (index === 0) return newDate;
    switch (frequency) {
        case 'daily': newDate.setDate(baseDate.getDate() + index); break;
        case 'weekly': newDate.setDate(baseDate.getDate() + (index * 7)); break;
        case 'monthly': newDate.setMonth(baseDate.getMonth() + index); break;
        case 'yearly': newDate.setFullYear(baseDate.getFullYear() + index); break;
    }
    return newDate;
  };

  const addTransaction = async (data: AddTransactionData) => {
    if (!currentUser) throw new Error("No user logged in");
    const userRef = db.collection('users').doc(currentUser.uid);
    const batch = db.batch();
    const isRecurring = data.isRecurring && data.frequency;
    const count = isRecurring ? (data.repeatCount || 1) : 1;
    const safeCount = isNaN(count) ? 1 : Math.min(count, 60); 
    const baseDate = new Date(data.date);

    for (let i = 0; i < safeCount; i++) {
        const newTransRef = userRef.collection('transactions').doc();
        const currentInstanceDate = calculateFutureDate(baseDate, data.frequency || 'monthly', i);
        const instanceStatus = i === 0 ? data.status : 'pending';

        const payload = sanitize({
            ...data,
            date: currentInstanceDate.toISOString(),
            status: instanceStatus,
            createdAt: new Date().toISOString(),
            installmentNumber: isRecurring ? i + 1 : undefined,
            totalInstallments: isRecurring ? safeCount : undefined,
        });
        delete (payload as any).repeatCount;

        batch.set(newTransRef, payload);

        // Só atualiza saldo se não for ignorado
        if (instanceStatus === 'completed' && !isNaN(data.amount) && !data.isIgnored) {
            const accountRef = userRef.collection('accounts').doc(data.accountId);
            // Verifica existência apenas se for uma nova transação simples, mas como é create, assumimos que usuário selecionou conta existente na UI.
            // Para robustez em add, o ideal também seria checar, mas o erro relatado foi em update.
            batch.update(accountRef, {
                balance: firebase.firestore.FieldValue.increment(data.type === 'income' ? data.amount : -data.amount)
            });
        }
    }
    await batch.commit();
  };

  const updateTransaction = async (id: string, newData: AddTransactionData) => {
    if (!currentUser) throw new Error("No user logged in");
    const userRef = db.collection('users').doc(currentUser.uid);
    const transRef = userRef.collection('transactions').doc(id);
    const batch = db.batch();
    
    const oldDoc = await transRef.get();
    if (!oldDoc.exists) throw new Error("Transação não encontrada");
    const oldData = oldDoc.data() as Transaction;

    // 1. Reverter saldo antigo (apenas se não era ignorada)
    if (oldData.status === 'completed' && oldData.accountId && !isNaN(oldData.amount) && !oldData.isIgnored) {
        const oldAccountRef = userRef.collection('accounts').doc(oldData.accountId);
        const oldAccountDoc = await oldAccountRef.get();
        
        // CORREÇÃO: Só tenta atualizar se a conta ainda existir
        if (oldAccountDoc.exists) {
            batch.update(oldAccountRef, {
                balance: firebase.firestore.FieldValue.increment(oldData.type === 'income' ? -oldData.amount : oldData.amount)
            });
        }
    }

    // 2. Aplicar novo saldo (apenas se não for ignorada)
    if (newData.status === 'completed' && newData.accountId && !isNaN(newData.amount) && !newData.isIgnored) {
        const newAccountRef = userRef.collection('accounts').doc(newData.accountId);
        const newAccountDoc = await newAccountRef.get();
        
        // CORREÇÃO: Só tenta atualizar se a conta ainda existir
        if (newAccountDoc.exists) {
            batch.update(newAccountRef, {
                 balance: firebase.firestore.FieldValue.increment(newData.type === 'income' ? newData.amount : -newData.amount)
            });
        }
    }

    const payload = sanitize(newData);
    delete (payload as any).repeatCount;
    batch.update(transRef, payload);
    
    try {
      await batch.commit();
    } catch (error: any) {
      console.error('Erro ao atualizar transação:', error);   
      throw new Error(error?.message || 'Erro ao atualizar transação no Firestore');
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!currentUser) throw new Error("No user logged in");
    const userRef = db.collection('users').doc(currentUser.uid);
    const transRef = userRef.collection('transactions').doc(id);
    const doc = await transRef.get();
    if (!doc.exists) return;
    const data = doc.data() as Transaction;
    const batch = db.batch();
    batch.delete(transRef);

    // Reverter saldo apenas se não era ignorada
    if (data.status === 'completed' && data.accountId && !isNaN(data.amount) && !data.isIgnored) {
        const accountRef = userRef.collection('accounts').doc(data.accountId);
        const accountDoc = await accountRef.get();
        
        // CORREÇÃO: Só tenta atualizar se a conta ainda existir
        if (accountDoc.exists) {
            batch.update(accountRef, {
                balance: firebase.firestore.FieldValue.increment(data.type === 'income' ? -data.amount : data.amount)
            });
        }
    }
    await batch.commit();
  };

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction };
};
