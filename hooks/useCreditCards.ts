
import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard } from '../types';

export const useCreditCards = () => {
  const { currentUser } = useAuth();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[CREDIT_CARDS] useEffect triggered - checking conditions', {
      hasCurrentUser: !!currentUser,
      uid: currentUser?.uid
    });

    if (!currentUser || !currentUser.uid) {
      console.log('[CREDIT_CARDS] Waiting for currentUser or uid', { uid: currentUser?.uid });
      return;
    }

    console.log('[CREDIT_CARDS] Loading credit cards for UID:', currentUser.uid);
    setLoading(true);

    const query = db.collection('users')
      .doc(currentUser.uid)
      .collection('credit_cards')
      .orderBy('createdAt', 'asc');

    const unsubscribe = query.onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CreditCard[];
      
      console.log('[CREDIT_CARDS] Loaded', data.length, 'credit cards');
      setCards(data);
      setLoading(false);
    }, (error: any) => {
      console.error('[CREDIT_CARDS] Error fetching credit cards:', { uid: currentUser.uid, message: error.message, code: error.code });
      setCards([]);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser?.uid]);

  const addCard = async (data: Omit<CreditCard, 'id' | 'createdAt'>) => {
    if (!currentUser) throw new Error("No user logged in");
    
    await db.collection('users')
      .doc(currentUser.uid)
      .collection('credit_cards')
      .add({
        ...data,
        createdAt: new Date().toISOString()
      });
  };

  const updateCard = async (id: string, data: Partial<CreditCard>) => {
    if (!currentUser) throw new Error("No user logged in");
    
    await db.collection('users')
      .doc(currentUser.uid)
      .collection('credit_cards')
      .doc(id)
      .update(data);
  };

  const deleteCard = async (id: string) => {
    if (!currentUser) throw new Error("No user logged in");
    await db.collection('users')
      .doc(currentUser.uid)
      .collection('credit_cards')
      .doc(id)
      .delete();
  };

  return {
    cards,
    loading,
    addCard,
    updateCard,
    deleteCard
  };
};
