import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../services/firebase';
import { useNotification } from '../../contexts/NotificationContext';
import { BackButton } from '../../components/ui/BackButton';
import { EditProfileModal } from './EditProfileModal';

interface SettingItemProps {
  icon: string;
  label: string;
  description?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  danger?: boolean;
  badge?: string;
  isLink?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({ 
  icon, label, description, toggle, toggleValue, danger, badge, isLink, onClick, disabled 
}) => {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between p-4 transition-all hover:bg-slate-50 border-none outline-none ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${danger ? 'bg-red-50 text-danger' : 'bg-slate-100 text-slate-500'}`}>
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
        <div className="text-left">
          <p className={`text-sm font-bold tracking-tight ${danger ? 'text-danger' : 'text-slate-800'}`}>{label}</p>
          {description && <p className="text-[10px] font-bold text-slate-400 tracking-tighter">{description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {badge && <span className="rounded-md bg-success/10 px-2 py-0.5 text-[8px] font-bold text-success">{badge}</span>}
        {toggle ? (
          <div className={`relative h-6 w-11 rounded-full transition-colors ${toggleValue ? 'bg-success/40' : 'bg-slate-200'}`}>
            <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${toggleValue ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        ) : (
          isLink ? <span className="material-symbols-outlined text-slate-300 text-lg">open_in_new</span> : <span className="material-symbols-outlined text-slate-200">chevron_right</span>
        )}
      </div>
    </button>
  );
};

// Fixed syntax error here: removed "SectionHeader" from inside the parenthesis
const SectionHeader = ({ title, icon }: { title: string, icon?: string }) => (
  <div className="px-5 py-3 mt-4 flex items-center gap-2">
    {icon && <span className="material-symbols-outlined text-slate-400 text-sm">{icon}</span>}
    <h3 className="text-xs font-bold text-slate-400">{title}</h3>
  </div>
);

export const SettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  const handleLogout = () => {
    auth.signOut();
  };

  const handleUnderConstruction = () => {
    addNotification('Funcionalidade em desenvolvimento.', 'info');
  };

  return (
    <div className="mx-auto max-w-xl pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Configurações</h2>
            <p className="text-xs font-bold text-slate-400">Gerencie sua experiência</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-danger hover:bg-red-100 transition-all active:scale-90"
          title="Sair"
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
        <SectionHeader title="Perfil" icon="person" />
        <div className="divide-y divide-slate-50">
          <SettingItem 
            icon="edit" 
            label="Editar perfil" 
            description="Nome e foto de exibição" 
            onClick={() => setIsEditProfileOpen(true)}
          />
          <SettingItem 
            icon="lock" 
            label="Alterar senha" 
            description="Atualizar sua senha de acesso" 
            onClick={handleUnderConstruction}
          />
        </div>

        <SectionHeader title="Aplicativo" icon="settings" />
        <div className="divide-y divide-slate-50">
          <SettingItem 
            icon="dark_mode" 
            label="Modo escuro" 
            description="Ativar tema escuro" 
            toggle 
            toggleValue={false} 
            onClick={handleUnderConstruction}
          />
          <SettingItem 
            icon="notifications" 
            label="Notificações" 
            description="Receber alertas e lembretes" 
            toggle 
            toggleValue={true} 
            onClick={handleUnderConstruction}
          />
          <SettingItem 
            icon="attach_money" 
            label="Moeda" 
            description="Real brasileiro (R$)" 
            badge="BRL"
            onClick={handleUnderConstruction}
          />
        </div>

        <SectionHeader title="Privacidade" icon="security" />
        <div className="divide-y divide-slate-50">
          <SettingItem 
            icon="download" 
            label="Exportar dados" 
            description="Baixar suas informações" 
            onClick={handleUnderConstruction}
          />
          <SettingItem 
            icon="delete" 
            label="Excluir conta" 
            description="Remover permanentemente sua conta" 
            danger 
            onClick={handleUnderConstruction}
          />
        </div>

        <SectionHeader title="Suporte" icon="help" />
        <div className="divide-y divide-slate-50">
          <SettingItem 
            icon="info" 
            label="Sobre o Poup+" 
            description="Versão e informações do app" 
            onClick={handleUnderConstruction}
          />
          <SettingItem 
            icon="email" 
            label="Contato" 
            description="Fale conosco" 
            isLink
            onClick={handleUnderConstruction}
          />
        </div>
      </div>

      <div className="mt-10 text-center">
        <p className="text-[10px] font-bold text-slate-300">Poup+ © 2024 • Inteligência financeira</p>
      </div>

      <EditProfileModal 
        isOpen={isEditProfileOpen} 
        onClose={() => setIsEditProfileOpen(false)} 
      />
    </div>
  );
};