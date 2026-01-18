
import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Category, TransactionType } from '../types';
import { incomeCategories as systemIncome, expenseCategories as systemExpense } from '../features/dashboard/components/NewTransactionModal';

export const useCategories = () => {
  const { currentUser } = useAuth();
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = db.collection('users')
      .doc(currentUser.uid)
      .collection('custom_categories')
      .onSnapshot((snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isCustom: true
        })) as Category[];
        setCustomCategories(data);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching categories:", error);
        setLoading(false);
      });

    return unsubscribe;
  }, [currentUser]);

  const allCategories = useMemo(() => {
    const system: Category[] = [
      ...systemIncome.map(c => ({ ...c, id: `sys-inc-${c.name}`, type: 'income' as TransactionType, isCustom: false })),
      ...systemExpense.map(c => ({ ...c, id: `sys-exp-${c.name}`, type: 'expense' as TransactionType, isCustom: false }))
    ];
    
    const combined = [...system, ...customCategories];
    
    const uniqueMap = new Map<string, Category>();
    
    combined.forEach(cat => {
      const key = `${cat.name.trim().toLowerCase()}_${cat.type}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, cat);
      } else {
        const existing = uniqueMap.get(key)!;
        if (!existing.isCustom && cat.isCustom) {
            // Mantém o sistema
        } else if (existing.isCustom && !cat.isCustom) {
            uniqueMap.set(key, cat); 
        }
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [customCategories]);

  const addCustomCategory = async (category: Omit<Category, 'id' | 'isCustom'>) => {
    if (!currentUser) return;
    
    const normalizedNew = category.name.trim().toLowerCase();
    const exists = allCategories.some(c => 
      c.type === category.type && 
      c.name.trim().toLowerCase() === normalizedNew
    );

    if (exists) return;

    await db.collection('users')
      .doc(currentUser.uid)
      .collection('custom_categories')
      .add({
        ...category,
        name: category.name.trim()
      });
  };

  const updateCustomCategory = async (id: string, category: Partial<Category>) => {
    if (!currentUser) return;
    await db.collection('users')
      .doc(currentUser.uid)
      .collection('custom_categories')
      .doc(id)
      .update({
        ...category,
        name: category.name?.trim()
      });
  };

  const deleteCustomCategory = async (id: string) => {
    if (!currentUser) return;
    await db.collection('users')
      .doc(currentUser.uid)
      .collection('custom_categories')
      .doc(id)
      .delete();
  };

  return { 
    allCategories, 
    customCategories, 
    loading, 
    addCustomCategory, 
    updateCustomCategory,
    deleteCustomCategory 
  };
};
