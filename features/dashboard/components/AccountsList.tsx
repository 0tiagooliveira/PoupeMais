
import React from 'react';
import { Account } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../utils/formatters';

interface AccountsListProps {
  accounts: Account[];
  onAddAccount: () => void;
  onAccountClick: (account: Account) => void;
  onEditAccount: (account: Account) => void;
}

const getBankLogoUrl = (name: string) => {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('nubank')) return 'https://poup-beta.web.app/Icon/Nubank.svg';
  if (lowerName.includes('itaú') || lowerName.includes('itau')) return 'https://poup-beta.web.app/Icon/itau.svg';
  if (lowerName.includes('bradesco')) return 'https://poup-beta.web.app/Icon/bradesco.svg';
  if (lowerName.includes('santander')) return 'https://poup-beta.web.app/Icon/santander.svg';
  if (lowerName.includes('brasil') || lowerName.includes('bb')) return 'https://poup-beta.web.app/Icon/banco-do-brasil.svg';
  if (lowerName.includes('caixa')) return 'https://poup-beta.web.app/Icon/caixa.svg';
  if (lowerName.includes('picpay')) return 'https://poup-beta.web.app/Icon/picpay.svg';
  
  if (lowerName.includes('inter')) return 'https://cdn.jsdelivr.net/gh/Tgentil/Bancos-em-SVG@main/Banco%20Inter%20S.A/inter.svg';
  if (lowerName.includes('c6')) return 'https://cdn.jsdelivr.net/gh/Tgentil/Bancos-em-SVG@main/Banco%20C6%20S.A/c6%20bank.svg';
  
  return null;
};

export const BankLogo = ({ name, color, size = 'md' }: { name: string, color: string, size?: 'sm' | 'md' | 'lg' }) => {
  const logoUrl = getBankLogoUrl(name);
  const sizeClasses = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-11 w-11';

  return (
    <div 
      className={`${sizeClasses} flex items-center justify-center rounded-full overflow-hidden shadow-sm flex-shrink-0 transition-transform group-hover:scale-110 border border-black/5`}
      style={{ backgroundColor: color }}
    >
      {logoUrl ? (
        <img 
          src={logoUrl} 
          alt={name} 
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).parentElement!.style.backgroundColor = color;
          }}
        />
      ) : (
        <span className="material-symbols-outlined text-white text-xl">
          {name.toLowerCase().includes('dinheiro') ? 'payments' : 'account_balance'}
        </span>
      )}
    </div>
  );
};

export const AccountsList: React.FC<AccountsListProps> = ({ accounts, onAddAccount, onAccountClick, onEditAccount }) => {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-5 px-1">
        <h3 className="text-xs font-bold text-slate-400">Minhas contas</h3>
        <button 
          onClick={onAddAccount} 
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-success/10 hover:text-success transition-all active:scale-90"
        >
          <span className="material-symbols-outlined text-lg font-bold">add</span>
        </button>
      </div>
      
      <div className="flex flex-col gap-3">
        {accounts.map((account) => (
          <div 
            key={account.id} 
            onClick={() => onAccountClick(account)}
            className="group flex cursor-pointer items-center justify-between rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-success/30 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <BankLogo name={account.name} color={account.color} />
              <div className="flex flex-col">
                <p className="text-sm font-bold text-slate-800 leading-none mb-1">{account.name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[9px] font-bold text-slate-400">{account.type}</p>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEditAccount(account); }}
                    className="flex h-4 w-4 items-center justify-center rounded bg-slate-50 text-[10px] text-slate-300 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[12px]">settings</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <div className="text-right">
                  <span className="block text-base font-bold text-success tracking-tighter">
                    {formatCurrency(account.balance)}
                  </span>
               </div>
               <span className="material-symbols-outlined text-slate-200 group-hover:text-success transition-colors">chevron_right</span>
            </div>
          </div>
        ))}

        {accounts.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-100 bg-slate-50/50 p-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-200 shadow-sm border border-slate-100">
                <span className="material-symbols-outlined text-3xl">account_balance</span>
            </div>
            <p className="text-xs font-bold text-slate-400 mb-6">Nenhuma conta conectada</p>
            <Button 
                variant="primary" 
                size="md" 
                onClick={onAddAccount}
                className="rounded-2xl font-bold text-xs bg-primary hover:bg-emerald-600 shadow-lg shadow-success/20"
            >
                + Adicionar conta
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
