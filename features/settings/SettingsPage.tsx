
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import firebase from 'firebase/compat/app';
import { auth, db } from '../../services/firebase';
import { useNotification } from '../../contexts/NotificationContext';
import { BackButton } from '../../components/ui/BackButton';
import { EditProfileModal } from './EditProfileModal';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { useCategories } from '../../hooks/useCategories';

const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
  <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-50 flex items-center gap-2">
    <span className="material-symbols-outlined text-slate-400 text-lg">{icon}</span>
    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
  </div>
);

const SettingItem = ({ icon, label, description, onClick, disabled, danger, pro }: { icon: string; label: string; description?: string; onClick?: () => void; disabled?: boolean; danger?: boolean; pro?: boolean; }) => (
  <button onClick={onClick} disabled={disabled} className={`w-full flex items-center justify-between p-6 transition-all hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${danger ? 'text-danger' : 'text-slate-700'}`}>
    <div className="flex items-center gap-4 text-left">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${danger ? 'bg-red-50' : 'bg-slate-50'}`}><span className="material-symbols-outlined text-xl leading-none">{icon}</span></div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold tracking-tight">{label}</p>
          {pro && <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase">PRO</span>}
        </div>
        {description && <p className="text-[10px] font-medium text-slate-400 mt-0.5">{description}</p>}
      </div>
    </div>
    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
  </button>
);

export const SettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleLogout = () => auth.signOut();

  const handleResetData = async () => {
    if (!currentUser) return;
    setIsResetting(true);
    try {
      const userRef = db.collection('users').doc(currentUser.uid);
      const collections = ['transactions', 'accounts', 'credit_cards', 'custom_categories', 'ai_analysis'];
      for (const colName of collections) {
        const snapshot = await userRef.collection(colName).get();
        let batch = db.batch();
        let count = 0;
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref);
          count++;
          if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
        }
        if (count > 0) await batch.commit();
      }
      addNotification('Todos os seus dados foram apagados.', 'info');
      setShowResetConfirm(false);
      navigate('/');
    } catch (err) {
      addNotification('Erro ao apagar dados.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <BackButton />
          <div><h2 className="text-xl font-bold text-slate-800 tracking-tight">Configurações</h2><p className="text-xs font-bold text-slate-400">Gerencie sua conta</p></div>
        </div>
        <button onClick={handleLogout} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-danger transition-all active:scale-95"><span className="material-symbols-outlined">logout</span></button>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
        <SectionHeader title="Perfil" icon="person" />
        <div className="divide-y divide-slate-50">
          <SettingItem icon="edit" label="Editar perfil" onClick={() => setIsEditProfileOpen(true)} />
        </div>

        <SectionHeader title="Importação Inteligente" icon="auto_awesome" />
        <div className="divide-y divide-slate-50">
          <SettingItem 
            icon="document_scanner" 
            label="Escanear Extrato (Bradesco)" 
            description="Use a IA para importar fotos ou PDFs" 
            onClick={() => navigate('/import-statement')} 
            pro
          />
        </div>

        <SectionHeader title="Zona de Perigo" icon="warning" />
        <div className="divide-y divide-slate-50">
          <SettingItem icon="restart_alt" label="Limpar todos os dados" danger onClick={() => setShowResetConfirm(true)} disabled={isResetting} />
        </div>
      </div>

      <EditProfileModal isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />
      <ConfirmationModal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} onConfirm={handleResetData} message="Deseja apagar permanentemente todos os seus lançamentos?" confirmText="Sim, limpar tudo" isLoading={isResetting} variant="danger" />
    </div>
  );
};
