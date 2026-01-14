
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { NotificationContextType, NotificationItem, NotificationType } from '../types';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [history, setHistory] = useState<NotificationItem[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const markAllAsRead = useCallback(() => {
    setHistory(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const addNotification = useCallback((message: string, type: NotificationType = 'info', duration = 5000, addToHistory = true) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: NotificationItem = { 
      id, 
      message, 
      type, 
      duration, 
      timestamp: new Date(),
      read: false,
      addToHistory
    };
    
    setNotifications((prev) => [...prev, newNotification]);
    
    if (addToHistory) {
      setHistory((prev) => [newNotification, ...prev]);
    }

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      history, 
      addNotification, 
      removeNotification, 
      clearHistory,
      markAllAsRead
    }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-[350px]">
        {notifications.map((notification) => (
          <Toast 
            key={notification.id} 
            notification={notification} 
            onClose={() => removeNotification(notification.id)} 
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

const Toast: React.FC<{ notification: NotificationItem; onClose: () => void }> = ({ notification, onClose }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification.duration) return;
    const startTime = Date.now();
    const endTime = startTime + notification.duration;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const percentage = (remaining / notification.duration!) * 100;
      setProgress(percentage);
      if (percentage <= 0) clearInterval(interval);
    }, 10);

    return () => clearInterval(interval);
  }, [notification.duration]);

  const icons = {
    success: 'check_circle',
    error: 'cancel',
    warning: 'error',
    info: 'info',
    finance: 'account_balance_wallet'
  };

  const theme = {
    success: 'border-green-100 bg-white/95 text-green-800 shadow-green-100',
    error: 'border-red-100 bg-white/95 text-red-800 shadow-red-100',
    warning: 'border-amber-100 bg-white/95 text-amber-800 shadow-amber-100',
    info: 'border-emerald-100 bg-white/95 text-emerald-800 shadow-emerald-100',
    finance: 'border-emerald-100 bg-white/95 text-emerald-800 shadow-emerald-100'
  };

  const iconColors = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-amber-500',
    info: 'text-emerald-500',
    finance: 'text-emerald-500'
  };

  const barColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-emerald-500',
    finance: 'bg-emerald-500'
  };

  return (
    <div className={`pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300 animate-[slideInRight_0.3s_ease-out] ${theme[notification.type]}`}>
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ${iconColors[notification.type]}`}>
        <span className="material-symbols-outlined text-2xl">{icons[notification.type]}</span>
      </div>
      
      <div className="flex-1">
        <p className="text-sm font-bold leading-tight">{notification.message}</p>
      </div>

      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600">
        <span className="material-symbols-outlined text-lg">close</span>
      </button>

      {notification.duration && (
        <div className="absolute bottom-0 left-0 h-1 w-full bg-gray-100/50">
          <div 
            className={`h-full transition-all duration-[10ms] linear ${barColors[notification.type]}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
