import { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FinancialGoal, GoalContribution } from '../types';

export const useGoals = () => {
  const { currentUser } = useAuth();
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);

  // Remove undefined fields
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

    const unsubscribe = db
      .collection('goals')
      .where('userId', '==', currentUser.uid)
      .onSnapshot((snapshot) => {
        const goalsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as FinancialGoal[];
        
        // Sorting locally (e.g. by targetDate)
        goalsData.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
        
        setGoals(goalsData);
        setLoading(false);
      }, (error) => {
        console.error('Error loading goals:', error);
        setGoals([]);
        setLoading(false);
      });

    return () => unsubscribe();
  }, [currentUser]);

  const addGoal = async (data: Omit<FinancialGoal, 'id' | 'userId' | 'createdAt' | 'contributions'>) => {
    if (!currentUser) return;
    try {
      const newGoal = sanitize({
        ...data,
        userId: currentUser.uid,
        contributions: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('goals').add(newGoal);
    } catch (error) {
      console.error('Error adding goal:', error);
      throw error;
    }
  };

  const updateGoal = async (id: string, data: Partial<FinancialGoal>) => {
    if (!currentUser) return;
    try {
      await db.collection('goals').doc(id).update(sanitize(data));
    } catch (error) {
      console.error('Error updating goal:', error);
      throw error;
    }
  };

  const deleteGoal = async (id: string) => {
    if (!currentUser) return;
    try {
      await db.collection('goals').doc(id).delete();
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw error;
    }
  };

  const addContribution = async (goalId: string, amount: number) => {
    if (!currentUser) return;
    try {
      const goalRef = db.collection('goals').doc(goalId);
      const goalDoc = await goalRef.get();
      if (goalDoc.exists) {
        const goalData = goalDoc.data() as FinancialGoal;
        
        const newContribution: GoalContribution = {
          id: Date.now().toString(),
          amount,
          date: new Date().toISOString()
        };

        const contributions = goalData.contributions || [];
        const newCurrentAmount = (goalData.currentAmount || 0) + amount;

        await goalRef.update({
          contributions: [...contributions, newContribution],
          currentAmount: newCurrentAmount
        });
      }
    } catch (error) {
      console.error('Error adding contribution:', error);
      throw error;
    }
  };

  return {
    goals,
    loading,
    addGoal,
    updateGoal,
    deleteGoal,
    addContribution
  };
};
