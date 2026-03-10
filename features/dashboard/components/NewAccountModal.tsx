
import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useNotification } from '../../../contexts/NotificationContext';
import { Account } from '../../../types';
import { BankLogo } from './AccountsList';

interface NewAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  accountToEdit?: Account | null;
}

const BANKS = [
  { name: 'Nubank', color: '#820ad1', code: '260', url: 'https://poup-beta.web.app/Icon/Nubank.svg' },
  { name: 'Itaú', color: '#ec7000', code: '341', url: 'https://poup-beta.web.app/Icon/itau.svg' },
  { name: 'Bradesco', color: '#cc092f', code: '237', url: 'https://poup-beta.web.app/Icon/bradesco.svg' },
  { name: 'Inter', color: '#ff7a00', code: '077', url: 'https://cdn.jsdelivr.net/gh/Tgentil/Bancos-em-SVG@main/Banco%20Inter%20S.A/inter.svg' },
  { name: 'Santander', color: '#ec0000', code: '033', url: 'https://poup-beta.web.app/Icon/santander.svg' },
  { name: 'Banco do Brasil', color: '#fcf800', code: '001', url: 'https://poup-beta.web.app/Icon/banco-do-brasil.svg' },
  { name: 'Caixa', color: '#005ca9', code: '104', url: 'https://poup-beta.web.app/Icon/caixa.svg' },
  { name: 'PicPay', color: '#21C25E', code: '380', url: 'https://poup-beta.web.app/Icon/picpay.svg' },
  { name: 'C6 Bank', color: '#000000', code: '336', url: 'https://cdn.jsdelivr.net/gh/Tgentil/Bancos-em-SVG@main/Banco%20C6%20S.A/c6%20bank.svg' },
];

const ACCOUNT_TYPES = ['Corrente', 'Poupança', 'Investimentos', 'Dinheiro'];

export const NewAccountModal: React.FC<NewAccountModalProps> = ({ isOpen, onClose, onSave, onDelete, accountToEdit }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('Corrente');
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState('#21C25E');
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotification();

  useEffect(() => {
    if (accountToEdit) {
      setName(accountToEdit.name);
      setType(accountToEdit.type);
      setBalance(accountToEdit.balance.toString());
      setColor(accountToEdit.color);
    } else {
      setName('');
      setType('Corrente');
      setBalance('');
      setColor('#21C25E');
    }
  }, [accountToEdit, isOpen]);

  const handleBankSelect = (bank: typeof BANKS[0]) => {
    setName(bank.name);
    setColor(bank.color);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        name,
        type,
        balance: parseFloat(balance) || 0,
        initialBalance: parseFloat(balance) || 0,
        color,
      });
      onClose();
    } catch (error) {
      addNotification('Erro ao salvar conta.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={accountToEdit ? "Editar conta" : "Conectar instituição"}>
      {/* Visual Preview */}
      <div className="mb-8 flex flex-col items-center px-1">
        <div 
          className="w-full rounded-[36px] p-6 shadow-2xl transition-all duration-500 flex items-center justify-between overflow-hidden relative border border-white/20"
          style={{ 
            background: `linear-gradient(135deg, ${color} 0%, ${color}DD 100%)`,
            color: (color === '#fcf800' || color === '#FC0') ? '#1e293b' : '#fff'
          }}
        >
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-white/95 rounded-full p-0.5 shadow-lg border border-white/20">
              <BankLogo name={name} color={color} size="lg" />
            </div>
            <div className="drop-shadow-sm">
               <p className="text-sm font-bold leading-none mb-1">{name || 'Minha conta'}</p>
               <p className="text-[10px] font-bold opacity-70 tracking-tight">{type}</p>
            </div>
          </div>
          <div className="text-right relative z-10 drop-shadow-sm">
             <span className="block text-xl font-bold tracking-tighter">
               R$ {parseFloat(balance || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
             </span>
          </div>
          <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
             <span className="material-symbols-outlined text-[140px] rotate-12">account_balance</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="text-xs font-bold text-slate-400 mb-5 block px-1">Selecione o seu banco</label>
          <div className="grid grid-cols-4 gap-y-6 gap-x-2">
            {BANKS.map(bank => (
              <button
                key={bank.name}
                type="button"
                onClick={() => handleBankSelect(bank)}
                className="group flex flex-col items-center gap-2 transition-all active:scale-90"
              >
                <div className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${name === bank.name ? 'ring-[3px] ring-primary ring-offset-2 scale-110 shadow-lg' : 'ring-1 ring-slate-100 hover:ring-slate-300'}`}>
                    <BankLogo name={bank.name} color={bank.color} size="md" />
                    {name === bank.name && (
                        <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full h-5 w-5 flex items-center justify-center shadow-md border-2 border-white z-20">
                            <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-center text-center mt-1">
                    <span className={`text-[10px] font-bold leading-tight ${name === bank.name ? 'text-slate-800' : 'text-slate-500'}`}>{bank.name}</span>
                    <span className="text-[8px] font-bold text-slate-400 tracking-tighter">Banco {bank.code}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <Input 
          label="Nome da conta" 
          placeholder="Ex: Nubank pessoal, carteira..." 
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="rounded-2xl font-bold"
        />

        <div>
          <label className="text-xs font-bold text-slate-400 mb-2 block">Tipo</label>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-xl px-4 py-2.5 text-xs font-bold tracking-tight transition-all ${
                    type === t 
                    ? 'bg-primary text-white shadow-lg shadow-success/20' 
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-slate-50 p-6 border border-slate-100">
            <label className="text-xs font-bold text-slate-400 mb-2 block">Saldo disponível</label>
            <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-slate-300">R$</span>
                <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0,00" 
                    value={balance}
                    onChange={e => setBalance(e.target.value)}
                    required
                    className="w-full bg-transparent text-4xl font-bold tracking-tighter text-slate-800 outline-none placeholder:text-slate-100"
                />
            </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1 rounded-2xl font-bold text-sm py-4">
            Cancelar
          </Button>
          <Button 
            type="submit" 
            isLoading={loading} 
            className="flex-1 rounded-2xl font-bold text-sm shadow-2xl py-4 bg-primary hover:bg-emerald-600 text-white"
          >
            {accountToEdit ? 'Atualizar' : 'Concluir'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
