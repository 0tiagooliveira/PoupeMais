
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { useNotification } from '../../contexts/NotificationContext';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    emailReports: true,
    billReminders: true,
    smartTips: true,
    securityAlerts: true,
    goalUpdates: false
  });

  useEffect(() => {
    if (isOpen && currentUser) {
      const loadSettings = async () => {
        try {
          const doc = await db.collection('users').doc(currentUser.uid).get();
          const userData = doc.data();
          if (userData && userData.settings && userData.settings.notifications) {
            setPreferences(prev => ({ ...prev, ...userData.settings.notifications }));
          }
        } catch (error) {
          console.error("Failed to load settings", error);
        }
      };
      loadSettings();
    }
  }, [isOpen, currentUser]);

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      await db.collection('users').doc(currentUser.uid).update({
        'settings.notifications': preferences
      });
      addNotification("Preferências de notificação salvas!", "success");
      onClose();
    } catch (error) {
      addNotification("Erro ao salvar preferências.", "error");
    } finally {
      setLoading(false);
    }
  };

  const ToggleItem = ({ label, description, checked, onChange, icon }: any) => (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-4">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${checked ? 'bg-primary/10 text-primary' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{label}</p>
          <p className="text-[10px] font-medium text-slate-400">{description}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
      </label>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Notificações">
      <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/50 mb-2">
           <div className="flex items-center gap-2 mb-1 text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined text-lg">info</span>
              <p className="text-[10px] font-black uppercase tracking-widest">Importante</p>
           </div>
           <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
             As notificações push dependem das configurações do seu navegador e dispositivo.
           </p>
        </div>

        <ToggleItem 
          label="Resumo Semanal" 
          description="Receba um balanço do seu progresso" 
          icon="analytics" 
          checked={preferences.emailReports} 
          onChange={() => handleToggle('emailReports')} 
        />
        
        <ToggleItem 
          label="Lembrete de Contas" 
          description="Avisar 2 dias antes do vencimento" 
          icon="event_available" 
          checked={preferences.billReminders} 
          onChange={() => handleToggle('billReminders')} 
        />

        <ToggleItem 
          label="Dicas Inteligentes" 
          description="Sugestões do Poup+ IA" 
          icon="lightbulb" 
          checked={preferences.smartTips} 
          onChange={() => handleToggle('smartTips')} 
        />

        <ToggleItem 
          label="Alertas de Segurança" 
          description="Login em novos dispositivos" 
          icon="security" 
          checked={preferences.securityAlerts} 
          onChange={() => handleToggle('securityAlerts')} 
        />
        
        <ToggleItem 
          label="Metas Atingidas" 
          description="Celebre suas conquistas" 
          icon="emoji_events" 
          checked={preferences.goalUpdates} 
          onChange={() => handleToggle('goalUpdates')} 
        />
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2 flex gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1 rounded-2xl font-bold">Cancelar</Button>
        <Button onClick={handleSave} isLoading={loading} className="flex-1 rounded-2xl font-bold bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white">Salvar</Button>
      </div>
    </Modal>
  );
};
