import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

export interface UserProfile extends firebase.User {
  uid: string;
  email: string | null;
}

export interface AuthContextType {
  currentUser: UserProfile | null;
  loading: boolean;
}

export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Data Models
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
  date: string; // ISO String
  status: TransactionStatus;
  isFixed: boolean;
  isRecurring: boolean;
  frequency?: TransactionFrequency;
  installmentNumber?: number; // Novo: Número da parcela atual (ex: 1)
  totalInstallments?: number; // Novo: Total de parcelas (ex: 12)
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

// Notification System
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

export interface NotificationContextType {
  addNotification: (message: string, type: NotificationType, duration?: number) => void;
  removeNotification: (id: string) => void;
}