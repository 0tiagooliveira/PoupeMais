
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
  
  if (lowerName.includes('nubank') || lowerName.includes('nubak')) return 'https://logodownload.org/wp-content/uploads/2019/08/nubank-logo-4-1.png';
  if (lowerName.includes('itaú') || lowerName.includes('itau')) return 'https://play-lh.googleusercontent.com/gRcutACE4XkEHmxcbUdOehxpTbp_LjmwJ6qIEbqfD34oh9feTNhTnlDgf97HEZ9eGKY';
  if (lowerName.includes('bradesco')) return 'https://img.icons8.com/color/1200/bradesco.jpg';
  if (lowerName.includes('santander')) return 'https://play-lh.googleusercontent.com/g_QDzrOlw8Belx8qb47fUu0MPL6AVFzDdbOz_NJZYQDNLveHYxwiUoe09Wvkxf-_548q=w480-h960-rw';
  if (lowerName.includes('brasil') || lowerName.includes('bb')) return 'https://play-lh.googleusercontent.com/1-aNhsSPNqiVluwNGZar_7F5PbQ4u1zteuJ1jumnArhe8bfYHHaVwu4aVOF5-NAmLaA=w480-h960-rw';
  if (lowerName.includes('caixa')) return 'https://play-lh.googleusercontent.com/ubV0x2kGJIEe10shxuFnH9Cy21OgHARwVUZ89nyE0YOZN9c25ov_dyHdk1rMgbPvoDI=w480-h960-rw';
  if (lowerName.includes('picpay')) return 'https://play-lh.googleusercontent.com/pTvc9kCumx_24eJDwGUpvcBwljcIBkrsL3qHwhBW2NalMQ-XxTtHRV9YAJanBxkV0Rw=w480-h960-rw';
  if (lowerName.includes('pagbank')) return 'https://play-lh.googleusercontent.com/O9GpqGB-9aE8Qt79JM1VXoVA5rRQjLb4LVk7yVwd2cuWeAi0ML6uVbc7aXZEOeyYwg=w480-h960-rw';
  if (lowerName.includes('pan')) return 'https://play-lh.googleusercontent.com/KVoKo2vX9E3ZjwfOL7eXvMWrmqMVAPLz96ePKd3QhKFDABTtPY9laAwTzJELzy7-fqKp=w480-h960-rw';
  if (lowerName.includes('next')) return 'https://play-lh.googleusercontent.com/H10aAKl4vs91sow3buRJk85cEN58T7onVyNqVQPnWnEpRQmelArjGLdUx05imRQePjCD=w480-h960-rw';
  if (lowerName.includes('btg')) return 'https://play-lh.googleusercontent.com/O5Z9jsv79WTfdd37TFPyIwAQjNotIZTTEC6sOXaD3_2IXrMjtOI2ZnqReOicI3TgmqI';
  
  if (lowerName.includes('inter')) return 'https://play-lh.googleusercontent.com/DABQ3z4xA93QNsK9wqR2LdnamoDHkaKc-h1AueqJrVE7pP9GkIvZqf_URfxOIiNbFyzK=w480-h960-rw';
  if (lowerName.includes('c6')) return 'https://play-lh.googleusercontent.com/qYXhGgBxFLr5xgnv0AGhqW9v7tyedb_i5AVoebI6pow5pWPNZH1qEHnslmSHNkVpB-g=w240-h480-rw';
  
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Minhas contas</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Toque em uma conta para ver extrato ou saldo detalhado.</p>
        </div>
        <button
          onClick={onAddAccount}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700 transition-all hover:bg-emerald-100 active:scale-95"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Nova conta
        </button>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {accounts.map((account) => (
          <div 
            key={account.id} 
            onClick={() => onAccountClick(account)}
            className="group relative flex min-h-[112px] w-full cursor-pointer flex-col gap-5 overflow-hidden rounded-[28px] border border-slate-100 bg-white px-5 py-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-success/30 hover:shadow-md active:scale-[0.98] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-300 to-emerald-500 opacity-70" />

            <div className="flex min-w-0 items-center gap-4">
              <BankLogo name={account.name} color={account.color} />
              <div className="flex min-w-0 flex-col">
                <p className="mb-1 truncate text-base font-black leading-none text-slate-800 sm:text-lg">{account.name}</p>
                <div className="flex items-center gap-2">
                  <p className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{account.type}</p>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEditAccount(account); }}
                    className="flex h-5 w-5 items-center justify-center rounded bg-slate-50 text-[10px] text-slate-300 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[12px]">settings</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
              <div className="text-left sm:text-right">
                <span className="block text-[1.85rem] font-black text-success tracking-tighter sm:text-3xl">
                    {formatCurrency(account.balance)}
                  </span>
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Saldo atual</span>
               </div>
               <span className="material-symbols-outlined text-slate-300 group-hover:text-success transition-colors">chevron_right</span>
            </div>
          </div>
        ))}

        {accounts.length === 0 && (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-100 bg-slate-50/50 p-12 text-center">
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
