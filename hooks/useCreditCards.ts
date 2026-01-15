
import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard } from '../types';

export const useCreditCards = () => {
  const { currentUser } = useAuth();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setCards([]);
      setLoading(false);
      return;
    }

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
      
      setCards(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching credit cards:", error);
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
