
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
    if (!currentUser) return;
    setLoading(true);

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

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

      const filteredData = rawData.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === currentDate.getMonth() && 
               tDate.getFullYear() === currentDate.getFullYear();
      });

      setTransactions(filteredData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser, currentDate]);

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

        if (instanceStatus === 'completed' && !isNaN(data.amount)) {
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

    // 1. Reverter saldo antigo
    if (oldData.status === 'completed' && oldData.accountId && !isNaN(oldData.amount)) {
        const oldAccountRef = userRef.collection('accounts').doc(oldData.accountId);
        batch.update(oldAccountRef, {
            balance: firebase.firestore.FieldValue.increment(oldData.type === 'income' ? -oldData.amount : oldData.amount)
        });
    }

    // 2. Aplicar novo saldo
    if (newData.status === 'completed' && newData.accountId && !isNaN(newData.amount)) {
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
    if (data.status === 'completed' && data.accountId && !isNaN(data.amount)) {
        const accountRef = userRef.collection('accounts').doc(data.accountId);
        batch.update(accountRef, {
            balance: firebase.firestore.FieldValue.increment(data.type === 'income' ? -data.amount : data.amount)
        });
    }
    await batch.commit();
  };

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction };
};
