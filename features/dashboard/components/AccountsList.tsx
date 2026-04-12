
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

export const BankLogo = ({
  name,
  color,
  size = 'md',
  logoUrl,
  useImage = false,
}: {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  logoUrl?: string;
  useImage?: boolean;
}) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  const sizeClasses = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-11 w-11';
  const lowerName = String(name || '').toLowerCase();
  const label =
    lowerName.includes('nubank') ? 'nu' :
    lowerName.includes('itaú') || lowerName.includes('itau') ? 'it' :
    lowerName.includes('inter') ? 'in' :
    lowerName.includes('santander') ? 'sa' :
    lowerName.includes('bradesco') ? 'br' :
    lowerName.includes('brasil') || lowerName.includes('bb') ? 'bb' :
    lowerName.includes('caixa') ? 'cx' :
    lowerName.includes('picpay') ? 'pp' :
    lowerName.includes('c6') ? 'c6' :
    lowerName.includes('dinheiro') ? '$' :
    'bk';

  return (
    <div 
      className={`${sizeClasses} flex items-center justify-center rounded-full overflow-hidden shadow-sm flex-shrink-0 transition-transform group-hover:scale-110 border border-black/5`}
      style={{ backgroundColor: color }}
    >
      {useImage && logoUrl && !imgFailed ? (
        <img
          src={logoUrl}
          alt={name}
          className="h-full w-full object-cover"
          onError={(e) => {
            setImgFailed(true);
          }}
        />
      ) : null}
      <span className={`text-white text-[11px] font-black uppercase tracking-wider select-none ${(useImage && logoUrl && !imgFailed) ? 'hidden' : ''}`}>
        {label}
      </span>
    </div>
  );
};

export const AccountsList: React.FC<AccountsListProps> = ({ accounts, onAddAccount, onAccountClick, onEditAccount }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-5 px-1">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Minhas contas</h3>
        <button 
          onClick={onAddAccount} 
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-success/10 hover:text-success transition-all active:scale-90"
        >
          <span className="material-symbols-outlined text-lg font-bold">add</span>
        </button>
      </div>
      
      <div className="flex flex-col gap-3">
        {accounts.map((account) => (
          <div 
            key={account.id} 
            onClick={() => onAccountClick(account)}
            className="group flex cursor-pointer items-center justify-between rounded-[24px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all hover:border-success/30 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <BankLogo name={account.name} color={account.color} />
              <div className="flex flex-col">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-none mb-1">{account.name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[9px] font-bold text-slate-400">{account.type}</p>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEditAccount(account); }}
                    className="flex h-4 w-4 items-center justify-center rounded bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-300 hover:text-primary transition-colors"
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
               <span className="material-symbols-outlined text-slate-200 dark:text-slate-700 group-hover:text-success transition-colors">chevron_right</span>
            </div>
          </div>
        ))}

        {accounts.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/5 text-success/40">
               <span className="material-symbols-outlined text-3xl">account_balance</span>
            </div>
            <h4 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">Nenhuma conta conectada</h4>
            <Button 
              onClick={onAddAccount}
              className="bg-primary hover:bg-emerald-600 text-white font-bold text-xs px-8 rounded-2xl h-11 shadow-lg shadow-success/20"
            >
              + Adicionar conta
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
