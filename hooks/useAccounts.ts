
import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Account } from '../types';

export const useAccounts = () => {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[ACCOUNTS] useEffect triggered - checking conditions', {
      hasCurrentUser: !!currentUser,
      uid: currentUser?.uid,
      currentUserKeys: Object.keys(currentUser || {})
    });

    if (!currentUser) {
      console.log('[ACCOUNTS] currentUser is null/undefined');
      return;
    }

    if (!currentUser.uid) {
      console.log('[ACCOUNTS] currentUser exists but uid is missing/undefined', { currentUser });
      return;
    }

    console.log('[ACCOUNTS] Loading accounts for UID:', currentUser.uid);
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
      
      console.log('[ACCOUNTS] Loaded', data.length, 'accounts');
      setAccounts(data);
      setLoading(false);
    }, (error: any) => {
      console.error('[ACCOUNTS] Error fetching accounts:', { uid: currentUser.uid, message: error.message, code: error.code });
      setAccounts([]);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser?.uid]);

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
