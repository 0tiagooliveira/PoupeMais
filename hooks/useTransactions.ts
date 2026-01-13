import { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, TransactionFrequency } from '../types';

interface AddTransactionData extends Omit<Transaction, 'id' | 'createdAt'> {
  repeatCount?: number; // Campo opcional para controle interno do loop
}

export const useTransactions = (currentDate: Date) => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

    const query = db.collection('users')
      .doc(currentUser.uid)
      .collection('transactions')
      .where('date', '>=', startOfMonth.toISOString())
      .where('date', '<=', endOfMonth.toISOString())
      .orderBy('date', 'desc');

    const unsubscribe = query.onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      
      setTransactions(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser, currentDate]);

  // Função auxiliar para calcular data futura
  const calculateFutureDate = (baseDate: Date, frequency: TransactionFrequency, index: number) => {
    const newDate = new Date(baseDate);
    if (index === 0) return newDate;

    switch (frequency) {
        case 'daily':
            newDate.setDate(baseDate.getDate() + index);
            break;
        case 'weekly':
            newDate.setDate(baseDate.getDate() + (index * 7));
            break;
        case 'monthly':
            newDate.setMonth(baseDate.getMonth() + index);
            break;
        case 'yearly':
            newDate.setFullYear(baseDate.getFullYear() + index);
            break;
    }
    return newDate;
  };

  const addTransaction = async (data: AddTransactionData) => {
    if (!currentUser) throw new Error("No user logged in");
    if (!data.accountId) throw new Error("Transaction must be linked to an account");
    
    const userRef = db.collection('users').doc(currentUser.uid);
    const batch = db.batch();

    const isRecurring = data.isRecurring && data.frequency;
    const count = isRecurring ? (data.repeatCount || 1) : 1;
    const safeCount = Math.min(count, 60); 

    let baseDate = new Date(data.date);

    for (let i = 0; i < safeCount; i++) {
        const newTransRef = userRef.collection('transactions').doc();
        const currentInstanceDate = calculateFutureDate(baseDate, data.frequency || 'monthly', i);
        
        const instanceStatus = i === 0 ? data.status : 'pending';

        // Prepara objeto da transação
        const transactionPayload = {
            ...data,
            date: currentInstanceDate.toISOString(),
            status: instanceStatus,
            createdAt: new Date().toISOString(),
            installmentNumber: isRecurring ? i + 1 : undefined,
            totalInstallments: isRecurring ? safeCount : undefined,
        };
        
        // Remove campos temporários
        delete (transactionPayload as any).repeatCount;

        batch.set(newTransRef, transactionPayload);

        // Atualiza saldo APENAS se esta instância estiver concluída
        if (instanceStatus === 'completed') {
            const accountRef = userRef.collection('accounts').doc(data.accountId);
            const amountChange = data.type === 'income' ? data.amount : -data.amount;
            
            batch.update(accountRef, {
                balance: firebase.firestore.FieldValue.increment(amountChange)
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
    if (oldData.status === 'completed' && oldData.accountId) {
        const oldAccountRef = userRef.collection('accounts').doc(oldData.accountId);
        const oldAccountDoc = await oldAccountRef.get();
        if (oldAccountDoc.exists) {
            const reversalAmount = oldData.type === 'income' ? -oldData.amount : oldData.amount;
            batch.update(oldAccountRef, {
                balance: firebase.firestore.FieldValue.increment(reversalAmount)
            });
        }
    }

    // 2. Aplicar novo saldo (na transação atual sendo editada)
    if (newData.status === 'completed' && newData.accountId) {
        const newAccountRef = userRef.collection('accounts').doc(newData.accountId);
        const newAccountDoc = await newAccountRef.get();
        if (newAccountDoc.exists) {
             const newAmountChange = newData.type === 'income' ? newData.amount : -newData.amount;
             batch.update(newAccountRef, {
                 balance: firebase.firestore.FieldValue.increment(newAmountChange)
             });
        }
    }

    // 3. Lógica Especial: Se virou recorrente durante a edição
    // Se o usuário editou e ligou "Recorrente" + definiu "Vezes", geramos as futuras
    if (newData.isRecurring && newData.frequency && newData.repeatCount && newData.repeatCount > 1) {
        const count = newData.repeatCount;
        const safeCount = Math.min(count, 60);
        const baseDate = new Date(newData.date);

        // Atualiza a transação atual para ser a parcela 1
        const currentPayload = {
            ...newData,
            installmentNumber: 1,
            totalInstallments: safeCount,
        };
        delete (currentPayload as any).repeatCount;
        batch.update(transRef, currentPayload);

        // Gera as parcelas futuras (começa do i=1)
        for (let i = 1; i < safeCount; i++) {
            const newTransRef = userRef.collection('transactions').doc();
            const currentInstanceDate = calculateFutureDate(baseDate, newData.frequency, i);
            
            const transactionPayload = {
                ...newData,
                date: currentInstanceDate.toISOString(),
                status: 'pending', // Futuras nascem pendentes
                createdAt: new Date().toISOString(),
                installmentNumber: i + 1,
                totalInstallments: safeCount,
            };
            delete (transactionPayload as any).repeatCount;
            batch.set(newTransRef, transactionPayload);
        }

    } else {
        // Atualização simples normal
        const simplePayload = { ...newData };
        delete (simplePayload as any).repeatCount;
        batch.update(transRef, simplePayload);
    }

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
        const accountDoc = await accountRef.get();
        if (accountDoc.exists) {
            const amountChange = data.type === 'income' ? -data.amount : data.amount;
            batch.update(accountRef, {
                balance: firebase.firestore.FieldValue.increment(amountChange)
            });
        }
    }

    await batch.commit();
  };

  return {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction
  };
};