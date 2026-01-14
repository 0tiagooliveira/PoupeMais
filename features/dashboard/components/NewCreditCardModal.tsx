import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useNotification } from '../../../contexts/NotificationContext';

interface NewCreditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

const BANKS_COLORS: Record<string, string> = {
  'nubank': '#820ad1',
  'itaú': '#ec7000',
  'itau': '#ec7000',
  'bradesco': '#cc092f',
  'inter': '#ff7a00',
  'santander': '#ec0000',
  'bb': '#FC0',
  'brasil': '#FC0',
  'caixa': '#005CA9',
  'xp': '#000000'
};

export const NewCreditCardModal: React.FC<NewCreditCardModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [color, setColor] = useState('#64748b');
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotification();

  useEffect(() => {
    const lowerName = name.toLowerCase();
    const foundColor = Object.entries(BANKS_COLORS).find(([key]) => lowerName.includes(key));
    if (foundColor) {
      setColor(foundColor[1]);
    } else if (!name) {
      setColor('#64748b');
    }
  }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSave({
        name,
        limit: parseFloat(limit) || 0,
        closingDay: parseInt(closingDay),
        dueDay: parseInt(dueDay),
        color,
      });
      
      addNotification(`Cartão "${name}" adicionado!`, 'success');
      setName('');
      setLimit('');
      setClosingDay('');
      setDueDay('');
      onClose();
    } catch (error) {
      addNotification('Erro ao adicionar cartão.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Cartão de Crédito">
      {/* Visual Card Preview */}
      <div className="mb-8 flex justify-center perspective-1000">
        <div 
          className="relative h-40 w-full max-w-[280px] rounded-[22px] p-6 text-white shadow-2xl transition-all duration-700"
          style={{ 
            backgroundColor: color,
            backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.1) 100%)'
          }}
        >
          {/* Chip and Logo Container */}
          <div className="flex items-start justify-between mb-6">
            <div className="h-10 w-12 rounded-lg bg-yellow-400/30 border border-yellow-200/20 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
            </div>
            <span className="material-symbols-outlined text-3xl opacity-60">contactless</span>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 leading-none">Instituição</p>
            <p className="text-xl font-bold tracking-tight">{name || 'Seu Cartão'}</p>
          </div>

          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
            <div>
              <p className="text-[8px] font-black uppercase opacity-50 tracking-widest mb-0.5">Limite</p>
              <p className="text-sm font-bold tracking-tighter">
                R$ {parseFloat(limit || '0').toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="flex gap-4">
                <div className="text-right">
                    <p className="text-[7px] font-black uppercase opacity-50 tracking-widest">FECH.</p>
                    <p className="text-xs font-bold leading-none">{closingDay || '00'}</p>
                </div>
                <div className="text-right">
                    <p className="text-[7px] font-black uppercase opacity-50 tracking-widest">VENC.</p>
                    <p className="text-xs font-bold leading-none">{dueDay || '00'}</p>
                </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input 
          label="Nome do Cartão" 
          placeholder="Ex: Nubank, Inter Black" 
          value={name}
          onChange={e => setName(e.target.value)}
          required
          icon="credit_card"
          className="rounded-2xl"
        />

        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">Limite Disponível</label>
            <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-400">R$</span>
                <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0,00" 
                    value={limit}
                    onChange={e => setLimit(e.target.value)}
                    required
                    className="w-full bg-transparent text-3xl font-bold tracking-tighter text-slate-800 outline-none"
                />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
             <label className="text-xs font-bold text-slate-500 ml-1">Dia Fechamento</label>
             <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-lg">event_busy</span>
                <input 
                    type="number" min="1" max="31" value={closingDay} onChange={e => setClosingDay(e.target.value)} required
                    className="w-full rounded-2xl border border-slate-100 bg-surface py-3 pl-10 pr-4 text-sm font-bold outline-none focus:border-primary"
                    placeholder="Ex: 5"
                />
             </div>
          </div>
          <div className="flex flex-col gap-1">
             <label className="text-xs font-bold text-slate-500 ml-1">Dia Vencimento</label>
             <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-lg">event_available</span>
                <input 
                    type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} required
                    className="w-full rounded-2xl border border-slate-100 bg-surface py-3 pl-10 pr-4 text-sm font-bold outline-none focus:border-primary"
                    placeholder="Ex: 12"
                />
             </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1 rounded-2xl font-bold tracking-widest">
            CANCELAR
          </Button>
          <Button type="submit" isLoading={loading} className="flex-1 rounded-2xl font-bold tracking-widest bg-slate-800 hover:bg-slate-900 shadow-xl">
            SALVAR CARTÃO
          </Button>
        </div>
      </form>
    </Modal>
  );
};