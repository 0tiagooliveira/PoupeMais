
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProcessing } from '../../contexts/ProcessingContext';

export const GlobalProcessingStatus: React.FC = () => {
  const { isProcessing, progressText, hasResults } = useProcessing();
  const navigate = useNavigate();
  const location = useLocation();

  // Se não estiver processando e não tiver resultados pendentes (ou se já estivermos na página de importação), não mostra nada
  if ((!isProcessing && !hasResults) || location.pathname === '/import-statement') {
    return null;
  }

  // Se tiver resultados pendentes, mostra um alerta para o usuário voltar e revisar
  if (!isProcessing && hasResults) {
    return (
      <div 
        onClick={() => navigate('/import-statement')}
        className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[100] cursor-pointer animate-in slide-in-from-bottom-10 fade-in duration-500"
      >
        <div className="bg-slate-900 text-white pl-4 pr-5 py-3 rounded-full shadow-2xl flex items-center gap-4 border border-white/10 hover:scale-105 transition-transform active:scale-95">
           <div className="relative">
              <span className="material-symbols-outlined text-2xl text-emerald-400">check_circle</span>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
           </div>
           <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Importação Concluída</p>
              <p className="text-sm font-bold leading-none">Revisar lançamentos</p>
           </div>
           <span className="material-symbols-outlined text-slate-400 text-sm">arrow_forward</span>
        </div>
      </div>
    );
  }

  // Se estiver processando, mostra a barra de progresso flutuante
  return (
    <div className="fixed top-20 right-4 z-[99] animate-in slide-in-from-right fade-in duration-500 max-w-[280px]">
      <div className="bg-white/95 backdrop-blur-md rounded-[20px] p-4 shadow-xl border border-primary/20 flex flex-col gap-3 relative overflow-hidden">
         {/* Background Pulse */}
         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-emerald-400 to-primary animate-[loading_2s_linear_infinite]"></div>
         
         <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center relative">
               <span className="material-symbols-outlined text-primary text-xl animate-pulse">smart_toy</span>
               <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-white rounded-full flex items-center justify-center">
                  <div className="h-2 w-2 bg-primary rounded-full animate-ping"></div>
               </div>
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Poup+ IA</p>
               <p className="text-xs font-bold text-slate-800 leading-tight">Processando...</p>
            </div>
         </div>
         
         <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
            <p className="text-[10px] font-medium text-slate-500 text-center animate-[pulse_3s_infinite]">
               {progressText}
            </p>
         </div>
      </div>
    </div>
  );
};
