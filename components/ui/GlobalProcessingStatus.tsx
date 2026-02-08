
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

  // STATUS: CONCLUÍDO (Aguardando Revisão)
  if (!isProcessing && hasResults) {
    return (
      <div 
        onClick={() => navigate('/import-statement')}
        className="fixed bottom-24 right-4 z-[100] cursor-pointer animate-in slide-in-from-bottom-10 fade-in duration-500 md:bottom-8"
      >
        <div className="bg-slate-900 text-white pl-5 pr-6 py-4 rounded-[24px] shadow-2xl shadow-slate-900/20 flex items-center gap-4 border border-white/10 hover:scale-105 transition-transform active:scale-95 group">
           <div className="relative">
              <div className="h-10 w-10 bg-emerald-500 rounded-full flex items-center justify-center text-slate-900 shadow-lg shadow-emerald-500/30">
                <span className="material-symbols-outlined text-2xl font-bold">check</span>
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
              </span>
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Análise Finalizada</p>
              <p className="text-sm font-bold leading-none text-white group-hover:text-emerald-300 transition-colors">Revisar lançamentos</p>
           </div>
           <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 group-hover:bg-white group-hover:text-slate-900 transition-all">
             <span className="material-symbols-outlined text-lg">arrow_forward</span>
           </div>
        </div>
      </div>
    );
  }

  // STATUS: PROCESSANDO (IA Trabalhando)
  return (
    <div className="fixed top-24 right-4 z-[99] animate-in slide-in-from-right fade-in duration-500 w-[calc(100%-32px)] max-w-[320px] md:top-28 md:right-8">
      <div className="bg-white/95 backdrop-blur-xl rounded-[28px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50 flex flex-col gap-4 relative overflow-hidden ring-1 ring-black/5">
         
         {/* Barra de Progresso Superior Animada */}
         <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
            <div className="h-full bg-gradient-to-r from-primary via-emerald-400 to-primary animate-[loading_1.5s_linear_infinite] w-full origin-left"></div>
         </div>
         
         <div className="flex items-start gap-4">
            {/* Ícone Animado */}
            <div className="relative flex-shrink-0 pt-1">
               <div className="h-12 w-12 bg-gradient-to-br from-emerald-50 to-white rounded-2xl flex items-center justify-center shadow-sm border border-emerald-100/50">
                  <span className="material-symbols-outlined text-primary text-2xl animate-[bounce_2s_infinite]">savings</span>
               </div>
               <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-sm">
                  <div className="h-3 w-3 bg-emerald-500 rounded-full animate-ping"></div>
               </div>
            </div>

            {/* Texto Descritivo */}
            <div className="flex-1 min-w-0">
               <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">IA em ação</span>
                  <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
               </div>
               <p className="text-xs font-bold text-slate-700 leading-snug animate-[fadeIn_0.3s_ease-out]">
                  {progressText}
               </p>
            </div>
         </div>
         
         {/* Barra de progresso visual simulada (Steps) */}
         <div className="flex gap-1">
            <div className="h-1 flex-1 rounded-full bg-primary animate-pulse"></div>
            <div className="h-1 flex-1 rounded-full bg-primary/40 animate-pulse delay-75"></div>
            <div className="h-1 flex-1 rounded-full bg-primary/20 animate-pulse delay-150"></div>
         </div>
      </div>
    </div>
  );
};
