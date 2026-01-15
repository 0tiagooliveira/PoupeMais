
import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useNotification } from '../../../contexts/NotificationContext';
import { BankLogo } from './AccountsList';
import { CreditCard } from '../../../types';

interface NewCreditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  cardToEdit?: CreditCard | null;
}

const POPULAR_BANKS = [
  { name: 'Nubank', color: '#820ad1' },
  { name: 'Itaú', color: '#ec7000' },
  { name: 'Bradesco', color: '#cc092f' },
  { name: 'Inter', color: '#ff7a00' },
  { name: 'Santander', color: '#ec0000' },
  { name: 'BB', color: '#fcf800' },
  { name: 'Caixa', color: '#005ca9' },
  { name: 'C6 Bank', color: '#000000' },
  { name: 'Outro', color: '#64748b' },
];

export const NewCreditCardModal: React.FC<NewCreditCardModalProps> = ({ isOpen, onClose, onSave, cardToEdit }) => {
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [color, setColor] = useState('#64748b');
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotification();

  useEffect(() => {
    if (isOpen) {
        if (cardToEdit) {
            setName(cardToEdit.name);
            setLimit(cardToEdit.limit.toString());
            setClosingDay(cardToEdit.closingDay.toString());
            setDueDay(cardToEdit.dueDay.toString());
            setColor(cardToEdit.color);
            // Tenta identificar o banco pelo nome para selecionar visualmente
            const bank = POPULAR_BANKS.find(b => cardToEdit.name.toLowerCase().includes(b.name.toLowerCase()));
            if (bank) setSelectedBank(bank.name);
        } else {
            setName('');
            setLimit('');
            setClosingDay('');
            setDueDay('');
            setColor('#64748b');
            setSelectedBank(null);
        }
    }
  }, [isOpen, cardToEdit]);

  const handleBankSelect = (bank: typeof POPULAR_BANKS[0]) => {
    setSelectedBank(bank.name);
    setName(bank.name === 'Outro' ? '' : bank.name);
    setColor(bank.color);
  };

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
      addNotification(cardToEdit ? `Cartão atualizado!` : `Cartão "${name}" salvo!`, 'success');
      onClose();
    } catch (error) {
      addNotification('Erro ao salvar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isLightColor = color === '#fcf800' || color === '#FC0';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={cardToEdit ? "Editar cartão" : "Novo cartão"}>
      {/* Card Preview */}
      <div className="mb-6 flex justify-center px-1">
        <div 
          className="relative h-36 w-full max-w-[280px] rounded-[24px] p-5 text-white shadow-xl transition-all duration-500 overflow-hidden border border-white/5"
          style={{ 
            backgroundColor: color,
            backgroundImage: 'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.05) 100%)'
          }}
        >
          <div className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] bg-gradient-to-br from-white/10 to-transparent pointer-events-none rotate-12"></div>
          
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="h-8 w-11 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-inner opacity-80 border border-yellow-200/20"></div>
            <div className="flex flex-col items-end">
                <div className="bg-white/95 p-0.5 rounded-full shadow h-7 w-7 flex items-center justify-center">
                    <BankLogo name={name || 'Card'} color={color} size="sm" />
                </div>
            </div>
          </div>

          <div className="space-y-0.5 relative z-10">
            <p className={`text-[8px] font-bold opacity-40 ${isLightColor ? 'text-slate-900' : 'text-white'}`}>Instituição</p>
            <p className={`text-base font-bold tracking-tight ${isLightColor ? 'text-slate-900' : 'text-white'}`}>{name || 'Seu cartão'}</p>
          </div>

          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between z-10">
            <div className="leading-none">
              <p className={`text-[8px] font-bold opacity-40 mb-0.5 ${isLightColor ? 'text-slate-900' : 'text-white'}`}>Limite</p>
              <p className={`text-sm font-bold tracking-tighter ${isLightColor ? 'text-slate-900' : 'text-white'}`}>
                R$ {parseFloat(limit || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex gap-3 text-[8px] font-bold opacity-40">
                <div className="text-right">
                    <p className={isLightColor ? 'text-slate-900' : 'text-white'}>Fech. {closingDay || '00'}</p>
                </div>
                <div className="text-right">
                    <p className={isLightColor ? 'text-slate-900' : 'text-white'}>Venc. {dueDay || '00'}</p>
                </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-5 gap-2 px-1">
          {POPULAR_BANKS.map(bank => (
            <button
              key={bank.name}
              type="button"
              onClick={() => handleBankSelect(bank)}
              className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all border ${
                  selectedBank === bank.name 
                  ? 'border-primary bg-success/5 shadow-sm' 
                  : 'border-slate-50 bg-white hover:bg-slate-50'
              }`}
            >
              <BankLogo name={bank.name} color={bank.color} size="sm" />
              <span className={`text-[8px] font-bold mt-1 truncate w-full text-center ${selectedBank === bank.name ? 'text-primary' : 'text-slate-400'}`}>
                  {bank.name}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-3 px-1">
            <Input 
              label="Nome do cartão" 
              placeholder="Ex: Nubank Platinum" 
              value={name}
              onChange={e => { setName(e.target.value); setSelectedBank(null); }}
              required
              icon="credit_card"
              className="text-sm font-bold"
            />

            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <label className="text-xs font-bold text-slate-400 mb-1 block">Limite total</label>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-400">R$</span>
                    <input 
                        type="number" step="0.01" placeholder="0,00" value={limit}
                        onChange={e => setLimit(e.target.value)} required
                        className="w-full bg-transparent text-2xl font-bold tracking-tighter text-slate-800 outline-none"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 ml-1">Fechamento</label>
                    <input 
                        type="number" min="1" max="31" value={closingDay} onChange={e => setClosingDay(e.target.value)} required
                        className="w-full rounded-xl border border-slate-100 bg-white py-2.5 px-4 text-sm font-bold text-slate-700 outline-none"
                        placeholder="Dia"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 ml-1">Vencimento</label>
                    <input 
                        type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} required
                        className="w-full rounded-xl border border-slate-100 bg-white py-2.5 px-4 text-sm font-bold text-slate-700 outline-none"
                        placeholder="Dia"
                    />
                </div>
            </div>
        </div>

        <div className="mt-2 flex gap-3 px-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1 rounded-2xl font-bold text-sm h-12">
            Cancelar
          </Button>
          <Button 
            type="submit" 
            isLoading={loading} 
            className="flex-1 rounded-2xl font-bold text-sm bg-primary hover:bg-emerald-600 shadow-xl shadow-success/20 text-white h-12"
          >
            {cardToEdit ? 'Salvar alterações' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
