import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Account } from '../types';

export const useAccounts = () => {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);

    const query = db.collection('users')
      .doc(currentUser.uid)
      .collection('accounts')
      .orderBy('createdAt', 'asc'); // Keep consistent order

    const unsubscribe = query.onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Account[];
      
      setAccounts(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching accounts:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  const addAccount = async (data: Omit<Account, 'id'>) => {
    if (!currentUser) throw new Error("No user logged in");
    
    await db.collection('users')
      .doc(currentUser.uid)
      .collection('accounts')
      .add({
        ...data,
        createdAt: new Date().toISOString()
      });
  };

  const updateAccount = async (id: string, data: Partial<Account>) => {
    if (!currentUser) throw new Error("No user logged in");
    
    // Nota: Atualizar o saldo aqui manualmente pode ser perigoso se não sincronizado com transações.
    // Geralmente atualizamos apenas nome/tipo/cor.
    await db.collection('users')
      .doc(currentUser.uid)
      .collection('accounts')
      .doc(id)
      .update(data);
  };

  const deleteAccount = async (id: string) => {
    if (!currentUser) throw new Error("No user logged in");
    await db.collection('users')
      .doc(currentUser.uid)
      .collection('accounts')
      .doc(id)
      .delete();
  };

  return {
    accounts,
    loading,
    addAccount,
    updateAccount,
    deleteAccount
  };
};