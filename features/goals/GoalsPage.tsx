import React, { useState } from 'react';
import { useGoals } from '../../hooks/useGoals';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { NewGoalModal } from './components/NewGoalModal';
import { AddContributionModal } from './components/AddContributionModal';
import { FinancialGoal } from '../../types';

export const GoalsPage: React.FC = () => {
  const { goals, loading, addGoal, addContribution } = useGoals();
  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);
  const [contributionGoal, setContributionGoal] = useState<FinancialGoal | null>(null);

  const getDaysRemaining = (targetDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getEncouragementMessage = (percentage: number, daysRemaining: number) => {
    if (percentage >= 100) return "Parabens! Voce alcancou sua meta!";
    if (percentage >= 75) return "Quase la! Falta muito pouco!";
    if (percentage >= 50) return "Metade do caminho! Continue assim! ??";
    if (percentage >= 25) return "Um otimo comeco! Mantenha o foco!";
    if (daysRemaining < 30) return "Reta final! Vamos acelerar esses aportes? ?????";
    return "Toda grande jornada comeca com o primeiro passo!";
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Metas Financeiras</h1>
          <p className="text-sm text-slate-500">Acompanhe seus sonhos e objetivos</p>
        </div>
        <Button onClick={() => setIsNewGoalModalOpen(true)} className="bg-primary text-white h-10 px-5 rounded-2xl font-bold text-sm">
          + Nova Meta
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary"></div>
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm">
             <span className="material-symbols-outlined text-4xl">flag</span>
          </div>
          <h3 className="mb-2 text-lg font-bold text-slate-800">Nenhuma meta ainda</h3>
          <p className="mb-6 text-sm text-slate-500 max-w-xs text-center">Crie objetivos para guardar dinheiro e acompanhar seu progresso para aquela viagem, carro ou reserva.</p>
          <Button onClick={() => setIsNewGoalModalOpen(true)} variant="primary">Criar Primeira Meta</Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {goals.map((goal) => {
            const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
            const daysRemaining = getDaysRemaining(goal.targetDate);
            const isCompleted = percentage >= 100;
            const isLate = daysRemaining < 0 && !isCompleted;

            return (
              <div key={goal.id} className="relative overflow-hidden rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
                       <span className="material-symbols-outlined text-2xl">{goal.icon || 'star'}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 leading-tight">{goal.title}</h3>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">
                        {isCompleted ? 'Concluido' : isLate ? `Atrasado ${Math.abs(daysRemaining)} dias` : `Faltam ${daysRemaining} dias`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-bold text-slate-700">{formatCurrency(goal.currentAmount)}</span>
                    <span className="font-bold text-slate-400">de {formatCurrency(goal.targetAmount)}</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${isCompleted ? 'bg-success' : 'bg-primary'}`} 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 mt-2 text-right">{percentage.toFixed(1)}% alcancado</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 mb-5 border border-slate-100">
                    <p className="text-xs text-slate-600 font-medium text-center flex items-center justify-center gap-2">
                        {getEncouragementMessage(percentage, daysRemaining)}
                    </p>
                </div>

                {!isCompleted && (
                  <Button 
                    onClick={() => setContributionGoal(goal)} 
                    className="w-full bg-primary hover:bg-emerald-600 text-white font-bold rounded-xl h-11 transition-all"
                  >
                    + Fazer Aporte
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <NewGoalModal 
        isOpen={isNewGoalModalOpen} 
        onClose={() => setIsNewGoalModalOpen(false)} 
        onSave={addGoal}
      />

      <AddContributionModal 
        isOpen={!!contributionGoal}
        onClose={() => setContributionGoal(null)}
        goal={contributionGoal}
        onSave={addContribution}
      />
    </div>
  );
};
