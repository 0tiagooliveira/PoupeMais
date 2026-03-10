
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { auth, db } from '../../services/firebase';
import { useNotification } from '../../contexts/NotificationContext';
import { BackButton } from '../../components/ui/BackButton';
import { EditProfileModal } from './EditProfileModal';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { AppearanceModal } from './AppearanceModal';

const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
  <div className="bg-slate-50/50 dark:bg-slate-800/30 px-6 py-4 border-b border-slate-50 dark:border-slate-800 flex items-center gap-2">
    <span className="material-symbols-outlined text-slate-400 text-lg">{icon}</span>
    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
  </div>
);

const SettingItem = ({ icon, label, description, onClick, disabled, danger, pro }: { icon: string; label: string; description?: string; onClick?: () => void; disabled?: boolean; danger?: boolean; pro?: boolean; }) => (
  <button onClick={onClick} disabled={disabled} className={`w-full flex items-center justify-between p-6 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${danger ? 'text-danger' : 'text-slate-700 dark:text-slate-200'}`}>
    <div className="flex items-center gap-4 text-left">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${danger ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}><span className="material-symbols-outlined text-xl leading-none">{icon}</span></div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold tracking-tight">{label}</p>
          {pro && <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase">PRO</span>}
        </div>
        {description && <p className="text-[10px] font-medium text-slate-400 mt-0.5">{description}</p>}
      </div>
    </div>
    <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">chevron_right</span>
  </button>
);

export const SettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleLogout = () => auth.signOut();

  const handleExportData = async () => {
    if (!currentUser) return;
    try {
      addNotification('Gerando relatório...', 'info');
      const snapshot = await db.collection('users').doc(currentUser.uid).collection('transactions').orderBy('date', 'desc').get();
      const transactions = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
              date: new Date(data.date).toLocaleDateString('pt-BR'),
              description: data.description,
              amount: data.amount,
              type: data.type === 'income' ? 'Entrada' : 'Saída',
              category: data.category,
              account: data.accountId 
          };
      });
      
      const headers = ['Data', 'Descrição', 'Valor', 'Tipo', 'Categoria', 'Conta ID'];
      const csvContent = [
        headers.join(','),
        ...transactions.map((t) => [
          t.date,
          `"${t.description.replace(/"/g, '""')}"`, 
          t.amount.toString().replace('.', ','), 
          t.type,
          t.category,
          t.account
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `poup_relatorio_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addNotification('Relatório exportado com sucesso!', 'success');
    } catch (error) {
      console.error(error);
      addNotification('Erro ao exportar dados.', 'error');
    }
  };

  const handleResetData = async () => {
    if (!currentUser) return;
    setIsResetting(true);
    try {
      const userRef = db.collection('users').doc(currentUser.uid);
      const collections = ['transactions', 'accounts', 'credit_cards', 'custom_categories', 'ai_analysis', 'automation_rules'];
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
    <div className="mx-auto max-w-xl pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <BackButton />
          <div><h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Configurações</h2><p className="text-xs font-bold text-slate-400">Personalize sua experiência</p></div>
        </div>
        <button onClick={handleLogout} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20 text-danger transition-all active:scale-95"><span className="material-symbols-outlined">logout</span></button>
      </div>

      <div className="space-y-6">
        <div className="overflow-hidden rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
            <SectionHeader title="Sua Conta" icon="manage_accounts" />
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                <SettingItem icon="edit" label="Editar perfil" description="Nome e foto de exibição" onClick={() => setIsEditProfileOpen(true)} />
                <SettingItem icon="verified" label="Plano & Assinatura" description={currentUser?.isPro ? "Gerenciar Poup+ PRO" : "Faça upgrade agora"} onClick={() => navigate('/pricing')} />
            </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
            <SectionHeader title="Preferências" icon="tune" />
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                <SettingItem icon="category" label="Categorias" description="Gerenciar suas etiquetas" onClick={() => navigate('/categories')} />
                <SettingItem icon="notifications" label="Notificações" description="Alertas e lembretes" onClick={() => setIsNotificationsOpen(true)} />
                <SettingItem icon="palette" label="Aparência" description="Modo claro, escuro ou sistema" onClick={() => setIsAppearanceOpen(true)} />
            </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
            <SectionHeader title="Dados Inteligentes" icon="database" />
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                <SettingItem 
                    icon="document_scanner" 
                    label="Importação Universal" 
                    description="Processar extratos e fotos com IA" 
                    onClick={() => navigate('/import-statement')} 
                    pro
                />
                <SettingItem icon="download" label="Exportar Relatório" description="Baixar histórico em CSV" onClick={handleExportData} />
            </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
            <SectionHeader title="Zona de Perigo" icon="warning" />
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                <SettingItem icon="restart_alt" label="Limpar todos os dados" danger onClick={() => setShowResetConfirm(true)} disabled={isResetting} />
                <SettingItem icon="delete_forever" label="Excluir conta" danger onClick={() => addNotification('Para excluir sua conta, entre em contato com o suporte.', 'info')} />
            </div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Poup+ v1.3.0 (Beta)</p>
        <p className="text-[9px] font-medium text-slate-300 dark:text-slate-600 mt-1">Feito com ❤️ para suas finanças</p>
      </div>

      <EditProfileModal isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />
      <NotificationSettingsModal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
      <AppearanceModal isOpen={isAppearanceOpen} onClose={() => setIsAppearanceOpen(false)} />
      
      <ConfirmationModal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} onConfirm={handleResetData} message="Deseja apagar permanentemente todos os seus lançamentos, contas e cartões? Esta ação não pode ser desfeita." confirmText="Sim, limpar tudo" isLoading={isResetting} variant="danger" />
    </div>
  );
};
