
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../services/firebase';

interface ProfileActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEditProfile: () => void;
}

export const ProfileActionsModal: React.FC<ProfileActionsModalProps> = ({ isOpen, onClose, onOpenEditProfile }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Editar Perfil',
      description: 'Alterar nome e foto de exibição',
      icon: 'person_edit',
      color: 'text-blue-600 bg-blue-50',
      onClick: () => {
        onOpenEditProfile();
        onClose();
      }
    },
    {
      label: 'Meu Plano PRO',
      description: currentUser?.isPro ? 'Você é um membro Premium' : 'Conheça os benefícios do PRO',
      icon: 'verified',
      color: 'text-amber-600 bg-amber-50',
      onClick: () => {
        navigate('/pricing');
        onClose();
      }
    },
    {
      label: 'Configurações',
      description: 'Importação, exportação e dados',
      icon: 'settings',
      color: 'text-slate-600 bg-slate-50',
      onClick: () => {
        navigate('/settings');
        onClose();
      }
    },
    {
      label: 'Sair da Conta',
      description: 'Encerrar sessão no dispositivo',
      icon: 'logout',
      color: 'text-red-600 bg-red-50',
      onClick: () => {
        auth.signOut();
        onClose();
      }
    }
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Minha Conta">
      <div className="flex flex-col gap-3 py-2">
        <div className="flex items-center gap-4 p-4 mb-2 rounded-2xl bg-slate-50/50 border border-slate-100">
           <div className="h-14 w-14 rounded-full border-2 border-white overflow-hidden shadow-sm">
             <img src={currentUser?.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} alt="Perfil" className="h-full w-full object-cover" />
           </div>
           <div>
              <p className="text-base font-black text-slate-800 tracking-tight leading-none mb-1">{currentUser?.displayName || 'Usuário'}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {currentUser?.isPro ? 'Membro PRO' : 'Plano Gratuito'}
              </p>
           </div>
        </div>

        {actions.map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            className="group flex items-start gap-4 p-4 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-slate-50 hover:shadow-sm transition-all text-left active:scale-[0.98]"
          >
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${action.color}`}>
              <span className="material-symbols-outlined">{action.icon}</span>
            </div>
            <div>
               <p className="text-sm font-bold text-slate-800 leading-tight mb-0.5">{action.label}</p>
               <p className="text-[10px] font-medium text-slate-400 leading-snug">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
};
