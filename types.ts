import React from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

export interface UserProfile extends firebase.User {
  uid: string;
  email: string | null;
  displayName: string | null;
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
  frequency?: TransactionFrequency;
  installmentNumber?: number; 
  totalInstallments?: number; 
  createdAt: string;
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
  addToHistory?: boolean; // Se false, não aparece na modal de notificações
}

export interface NotificationContextType {
  notifications: NotificationItem[];
  history: NotificationItem[];
  addNotification: (message: string, type: NotificationType, duration?: number, addToHistory?: boolean) => void;
  removeNotification: (id: string) => void;
  clearHistory: () => void;
  markAllAsRead: () => void;
}