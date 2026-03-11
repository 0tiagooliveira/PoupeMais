import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../utils/formatters';

interface NewGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

interface GoalSuggestion {
  id: string;
  title: string;
  amount: number;
  monthsAhead: number;
  icon: string;
  color: string;
  tip: string;
}

const GOAL_SUGGESTIONS: GoalSuggestion[] = [
  {
    id: 'reserva',
    title: 'Reserva de emergencia',
    amount: 12000,
    monthsAhead: 12,
    icon: 'shield',
    color: '#0ea5e9',
    tip: 'Meta recomendada: de 3 a 6 meses do seu custo essencial.'
  },
  {
    id: 'viagem',
    title: 'Viagem dos sonhos',
    amount: 8000,
    monthsAhead: 10,
    icon: 'flight_takeoff',
    color: '#14b8a6',
    tip: 'Defina um teto por categoria para nao comprometer o dia a dia.'
  },
  {
    id: 'carro',
    title: 'Entrada do carro',
    amount: 15000,
    monthsAhead: 14,
    icon: 'directions_car',
    color: '#6366f1',
    tip: 'Centralize os aportes no inicio do mes para manter consistencia.'
  },
  {
    id: 'casa',
    title: 'Reforma da casa',
    amount: 10000,
    monthsAhead: 8,
    icon: 'home',
    color: '#f97316',
    tip: 'Divida a meta em etapas menores para acompanhar melhor o progresso.'
  }
];

const ICON_OPTIONS = [
  'trophy',
  'shield',
  'flight_takeoff',
  'home',
  'directions_car',
  'school',
  'favorite',
  'diamond'
];

const addMonthsAsISODate = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
};

export const NewGoalModal: React.FC<NewGoalModalProps> = ({ isOpen, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [icon, setIcon] = useState('trophy');
  const [color, setColor] = useState('#10B981');
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const amountNumber = Number(targetAmount || 0);
  const monthsRemaining = (() => {
    if (!targetDate) return 0;
    const now = new Date();
    const end = new Date(targetDate);
    const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()) + 1;
    return Math.max(0, months);
  })();
  const monthlyContribution = monthsRemaining > 0 ? amountNumber / monthsRemaining : 0;

  const applySuggestion = (suggestion: GoalSuggestion) => {
    setSelectedSuggestionId(suggestion.id);
    setTitle(suggestion.title);
    setTargetAmount(String(suggestion.amount));
    setTargetDate(addMonthsAsISODate(suggestion.monthsAhead));
    setIcon(suggestion.icon);
    setColor(suggestion.color);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetAmount || !targetDate) return;

    setLoading(true);
    try {
      await onSave({
        title,
        targetAmount: parseFloat(targetAmount),
        currentAmount: 0,
        targetDate,
        icon,
        color
      });
      setTitle('');
      setTargetAmount('');
      setTargetDate('');
      setIcon('trophy');
      setColor('#10B981');
      setSelectedSuggestionId(null);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Criar Nova Meta" maxWidthClassName="max-w-[760px]" bodyClassName="pr-1">
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">auto_awesome</span>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Sugestoes Poup+ IA</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {GOAL_SUGGESTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applySuggestion(item)}
                className={`rounded-xl border p-3 text-left transition-all ${selectedSuggestionId === item.id ? 'border-emerald-300 bg-white shadow-sm' : 'border-emerald-100 bg-white/70 hover:bg-white'}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm" style={{ color: item.color }}>{item.icon}</span>
                  <p className="text-sm font-bold text-slate-800">{item.title}</p>
                </div>
                <p className="text-xs font-semibold text-slate-500">{formatCurrency(item.amount)} em {item.monthsAhead} meses</p>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Input label="Qual o seu objetivo?" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Viagem para Europa" required />
          <Input label="Valor da Meta (R$)" type="number" step="0.01" min="0" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="0,00" required />
          <Input label="Ate quando?" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Simulacao de aporte</p>
            <p className="mt-2 text-lg font-black text-slate-800">
              {monthlyContribution > 0 ? `${formatCurrency(monthlyContribution)} / mes` : 'Preencha valor e data'}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {monthsRemaining > 0 ? `${monthsRemaining} meses restantes para bater a meta.` : 'Defina uma data final para calcular o plano.'}
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Escolha um icone para a meta</p>
          <div className="flex flex-wrap gap-2">
            {ICON_OPTIONS.map((itemIcon) => (
              <button
                key={itemIcon}
                type="button"
                onClick={() => setIcon(itemIcon)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${icon === itemIcon ? 'border-emerald-300 bg-emerald-50 text-primary' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
              >
                <span className="material-symbols-outlined text-lg">{itemIcon}</span>
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-slate-500">
            {selectedSuggestionId ? GOAL_SUGGESTIONS.find((s) => s.id === selectedSuggestionId)?.tip : 'Dica: metas com prazo curto funcionam melhor com aportes semanais automatizados.'}
          </p>
        </section>

        <div className="flex gap-4 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
            {loading ? 'Salvando...' : 'Criar Meta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
