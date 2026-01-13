import React, { createContext, useContext, useState, useCallback } from 'react';
import { NotificationContextType, NotificationItem, NotificationType } from '../types';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const addNotification = useCallback((message: string, type: NotificationType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: NotificationItem = { id, message, type, duration };
    
    setNotifications((prev) => [...prev, newNotification]);

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ addNotification, removeNotification }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
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
  const icons = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };

  const colors = {
    success: 'bg-white border-l-4 border-success text-slate-800',
    error: 'bg-white border-l-4 border-danger text-slate-800',
    warning: 'bg-white border-l-4 border-yellow-500 text-slate-800',
    info: 'bg-white border-l-4 border-primary text-slate-800'
  };

  const iconColors = {
    success: 'text-success',
    error: 'text-danger',
    warning: 'text-yellow-500',
    info: 'text-primary'
  };

  return (
    <div className={`pointer-events-auto flex w-full min-w-[300px] max-w-sm items-center gap-3 rounded-lg shadow-lg p-4 transition-all duration-300 animate-slide-in ${colors[notification.type]}`}>
      <span className={`material-symbols-outlined text-2xl ${iconColors[notification.type]}`}>
        {icons[notification.type]}
      </span>
      <p className="flex-1 text-sm font-medium">{notification.message}</p>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
        <span className="material-symbols-outlined text-lg">close</span>
      </button>
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