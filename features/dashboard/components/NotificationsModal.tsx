import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { NotificationItem } from '../../../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: NotificationItem[];
  onClear: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose, history, onClear }) => {
  const icons = {
    success: 'check_circle',
    error: 'cancel',
    warning: 'error',
    info: 'info'
  };

  const colors = {
    success: 'bg-green-50 text-green-600',
    error: 'bg-red-50 text-red-600',
    warning: 'bg-amber-50 text-amber-600',
    info: 'bg-blue-50 text-blue-600'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Centro de Notificações">
      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar py-2">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50 text-slate-300">
               <span className="material-symbols-outlined text-5xl">notifications_off</span>
            </div>
            <p className="font-bold text-slate-400">Tudo limpo por aqui!</p>
            <p className="text-xs text-slate-400 max-w-[200px] mt-1">Você não tem novas mensagens ou alertas no momento.</p>
          </div>
        ) : (
          history.map((n) => (
            <div 
                key={n.id} 
                className={`group flex items-start gap-4 p-4 rounded-2xl border transition-all hover:shadow-sm ${n.read ? 'bg-white border-gray-100 opacity-70' : 'bg-blue-50/20 border-blue-100 shadow-sm'}`}
            >
              <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${colors[n.type]}`}>
                <span className="material-symbols-outlined text-2xl">
                    {icons[n.type]}
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className={`text-sm leading-snug break-words ${n.read ? 'text-slate-600 font-medium' : 'text-slate-900 font-bold'}`}>
                    {n.message}
                </p>
                <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-gray-50 px-2 py-0.5 rounded">
                        {n.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-4">
        {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear} className="text-xs text-secondary hover:text-danger hover:bg-red-50 py-3 rounded-xl border border-dashed border-gray-200">
                <span className="material-symbols-outlined text-lg mr-2">delete_sweep</span>
                Limpar todas as notificações
            </Button>
        )}
        <Button variant="primary" size="md" onClick={onClose} className="rounded-2xl font-bold">
            Entendido
        </Button>
      </div>
    </Modal>
  );
};