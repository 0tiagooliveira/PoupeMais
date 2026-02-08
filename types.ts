
import React from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

export interface UserProfile extends firebase.User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isPro?: boolean; // Campo para identificar se o usuário é PRO
}

export interface AuthContextType {
  currentUser: UserProfile | null;
  loading: boolean;
}

export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'pending' | 'completed'; 
export type TransactionFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  accountId: string;
  accountName?: string;
  date: string;
  status: TransactionStatus;
  isFixed: boolean;
  isRecurring: boolean;
  isIgnored?: boolean; // Nova propriedade para ignorar transação nos cálculos
  frequency?: TransactionFrequency;
  installmentNumber?: number; 
  totalInstallments?: number; 
  bankTransactionId?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  isCustom?: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
  initialBalance: number;
}

export interface CreditCard {
  id: string;
  name: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  color: string;
  createdAt: string;
}

export interface CategoryData {
  id: string;
  name: string;
  amount: number;
  color: string;
  icon: string;
}

export type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'finance';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
  timestamp: Date;
  read: boolean;
  addToHistory?: boolean; 
}

export interface NotificationContextType {
  notifications: NotificationItem[];
  history: NotificationItem[];
  addNotification: (message: string, type: NotificationType, duration?: number, addToHistory?: boolean) => void;
  removeNotification: (id: string) => void;
  clearHistory: () => void;
  markAllAsRead: () => void;
}

export interface AutomationRule {
  id: string;
  conditions: {
    descriptionContains: string;
    amountMin?: string;
    amountMax?: string;
    accountId?: string;
  };
  actions: {
    categoryId?: string;
    renameTo?: string;
    isIgnored?: boolean;
  };
  createdAt: string;
  isActive: boolean;
}

export interface DetectedMetadata {
  limit?: number;
  closingDay?: number;
  dueDay?: number;
  bankName?: string;
}

export interface DetectedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  selected: boolean;
  sourceType?: 'account' | 'card'; // Identifica se é Conta ou Cartão
  bankName?: string; // Ex: Nubank, Itaú
  installmentNumber?: number;
  totalInstallments?: number;
}

export type InputMode = 'file' | 'text';
