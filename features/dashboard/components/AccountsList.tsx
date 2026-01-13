import React from 'react';
import { Account } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../utils/formatters';

interface AccountsListProps {
  accounts: Account[];
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
}

export const AccountsList: React.FC<AccountsListProps> = ({ accounts, onAddAccount, onEditAccount }) => {
  
  // Helper to determine icon style based on bank name
  const getBankVisuals = (name: string, defaultColor: string) => {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('nubank')) return { color: '#820ad1', icon: 'account_balance' };
    if (lowerName.includes('bradesco')) return { color: '#cc092f', icon: 'account_balance' };
    if (lowerName.includes('itaú') || lowerName.includes('itau')) return { color: '#ec7000', icon: 'account_balance' };
    if (lowerName.includes('inter')) return { color: '#ff7a00', icon: 'account_balance' };
    if (lowerName.includes('santander')) return { color: '#ec0000', icon: 'account_balance' };
    if (lowerName.includes('carteira') || lowerName.includes('dinheiro')) return { color: '#16a34a', icon: 'payments' };
    
    return { color: defaultColor || '#64748b', icon: 'account_balance' };
  };

  return (
    <div className="flex flex-col">
      <h3 className="mb-4 text-lg font-bold text-slate-800">Contas</h3>
      
      <div className="flex flex-col gap-4">
        {accounts.map((account) => {
          const visuals = getBankVisuals(account.name, account.color);
          
          return (
            <div 
              key={account.id} 
              onClick={() => onEditAccount(account)}
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              title="Clique para editar"
            >
              <div className="flex items-center gap-4">
                <div 
                  className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm"
                  style={{ backgroundColor: visuals.color }}
                >
                  <span className="material-symbols-outlined text-2xl">
                    {nameIsBank(account.name) ? 'account_balance' : visuals.icon}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-slate-900">{account.name}</p>
                  <p className="text-sm text-secondary">{account.type}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                 <span className="font-bold text-success text-lg">
                  {formatCurrency(account.balance)}
                </span>
                <span className="material-symbols-outlined text-gray-300">chevron_right</span>
              </div>
            </div>
          );
        })}

        {accounts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-secondary">
            Nenhuma conta cadastrada.
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <Button 
          onClick={onAddAccount} 
          className="bg-[#10b981] hover:bg-[#059669] text-white px-6 py-3 rounded-xl font-semibold shadow-md shadow-green-500/20"
        >
          + Nova Conta
        </Button>
      </div>
    </div>
  );
};

// Helper to decide if we show a generic bank icon
const nameIsBank = (name: string) => {
    const banks = ['nubank', 'bradesco', 'itau', 'inter', 'c6', 'santander', 'caixa', 'banco'];
    return banks.some(b => name.toLowerCase().includes(b));
};