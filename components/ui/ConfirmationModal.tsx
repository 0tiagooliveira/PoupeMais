
import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  variant?: 'danger' | 'primary';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Tem certeza?",
  message,
  confirmText = "Sim, excluir",
  cancelText = "Cancelar",
  isLoading = false,
  variant = 'danger'
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className={`rounded-full p-3 ${variant === 'danger' ? 'bg-red-50 text-danger' : 'bg-success/10 text-success'}`}>
            <span className="material-symbols-outlined text-3xl">
              {variant === 'danger' ? 'warning' : 'info'}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-slate-600 leading-relaxed text-sm">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading} className="text-xs">
            {cancelText}
          </Button>
          <Button 
            variant={variant} 
            onClick={onConfirm} 
            isLoading={isLoading}
            className="text-xs px-6"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
