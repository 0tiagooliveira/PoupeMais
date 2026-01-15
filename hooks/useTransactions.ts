
import { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, TransactionFrequency } from '../types';

interface AddTransactionData extends Omit<Transaction, 'id' | 'createdAt'> {
  repeatCount?: number;
}

export const useTransactions = (currentDate: Date) => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (!currentUser) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Define o início e fim do mês local usando valores primitivos para evitar referências instáveis
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const startOfMonth = new Date(year, month, 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(year, month + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // AMPLIAÇÃO DE SEGURANÇA PARA FUSO HORÁRIO:
    // Subtraímos 1 dia do início e somamos 1 dia ao fim para a query do Firestore.
    // Isso garante que se uma transação foi salva como UTC meia-noite (que seria dia anterior no Brasil),
    // ou vice-versa, ela seja baixada. Depois filtramos com precisão na memória.
    const queryStart = new Date(startOfMonth);
    queryStart.setDate(queryStart.getDate() - 1);

    const queryEnd = new Date(endOfMonth);
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

      // Filtro preciso em memória baseado no Mês/Ano selecionado visualmente
      const filteredData = rawData.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === month && 
               tDate.getFullYear() === year;
      });

      setTransactions(filteredData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setTransactions([]);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser?.uid, currentDate.getFullYear(), currentDate.getMonth()]);

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
    const safeCount = Math.min(count, 60); 
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

        if (instanceStatus === 'completed') {
            const accountRef = userRef.collection('accounts').doc(data.accountId);
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

    if (oldData.status === 'completed' && oldData.accountId) {
        const oldAccountRef = userRef.collection('accounts').doc(oldData.accountId);
        batch.update(oldAccountRef, {
            balance: firebase.firestore.FieldValue.increment(oldData.type === 'income' ? -oldData.amount : oldData.amount)
        });
    }

    if (newData.status === 'completed' && newData.accountId) {
        const newAccountRef = userRef.collection('accounts').doc(newData.accountId);
        batch.update(newAccountRef, {
             balance: firebase.firestore.FieldValue.increment(newData.type === 'income' ? newData.amount : -newData.amount)
        });
    }

    const payload = sanitize(newData);
    delete (payload as any).repeatCount;
    batch.update(transRef, payload);
    await batch.commit();
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
    if (data.status === 'completed' && data.accountId) {
        const accountRef = userRef.collection('accounts').doc(data.accountId);
        batch.update(accountRef, {
            balance: firebase.firestore.FieldValue.increment(data.type === 'income' ? -data.amount : data.amount)
        });
    }
    await batch.commit();
  };

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction };
};
