import React from 'react';
import { Button } from '../../../components/ui/Button';
import { formatMonth } from '../../../utils/formatters';

interface MonthSelectorProps {
  currentDate: Date;
  onMonthChange: (date: Date) => void;
  className?: string;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({ currentDate, onMonthChange, className = '' }) => {
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onMonthChange(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onMonthChange(newDate);
  };

  return (
    <div className={`flex items-center justify-center gap-4 ${className}`}>
      <Button variant="ghost" size="sm" onClick={handlePrev} icon="chevron_left" className="h-8 w-8 rounded-full p-0 text-slate-400 hover:text-slate-600">
        <span className="sr-only">Mês anterior</span>
      </Button>
      
      <span className="min-w-[120px] text-center text-lg font-medium capitalize text-slate-800">
        {formatMonth(currentDate)}
      </span>

      <Button variant="ghost" size="sm" onClick={handleNext} icon="chevron_right" className="h-8 w-8 rounded-full p-0 text-slate-400 hover:text-slate-600">
        <span className="sr-only">Próximo mês</span>
      </Button>
    </div>
  );
};