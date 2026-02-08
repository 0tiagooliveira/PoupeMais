
import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { useTheme } from '../../contexts/ThemeContext';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppearanceModal: React.FC<AppearanceModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme } = useTheme();

  const ThemeOption = ({ value, label, icon }: { value: 'light' | 'dark' | 'system', label: string, icon: string }) => {
    const isSelected = theme === value;
    return (
      <button 
        onClick={() => setTheme(value)}
        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all w-full ${isSelected ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
      >
        <div className={`h-12 w-12 rounded-full flex items-center justify-center text-2xl transition-colors ${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
           <span className="material-symbols-outlined">{icon}</span>
        </div>
        <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      </button>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Aparência">
      <div className="flex flex-col gap-6 py-4">
        <div className="grid grid-cols-3 gap-3">
           <ThemeOption value="light" label="Claro" icon="light_mode" />
           <ThemeOption value="dark" label="Escuro" icon="dark_mode" />
           <ThemeOption value="system" label="Sistema" icon="contrast" />
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 text-center transition-colors">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Preview</p>
           
           <div className="flex items-center justify-center gap-4">
              <div className="w-24 h-16 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col p-2 gap-2">
                 <div className="h-2 w-12 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                 <div className="flex gap-1">
                    <div className="h-6 w-6 rounded-lg bg-primary/20"></div>
                    <div className="flex-1 space-y-1">
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full"></div>
                        <div className="h-1.5 w-2/3 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
                    </div>
                 </div>
              </div>
           </div>
           <p className="mt-4 text-xs font-bold text-slate-600 dark:text-slate-300">
             O tema será aplicado em toda a aplicação.
           </p>
        </div>
      </div>
    </Modal>
  );
};
