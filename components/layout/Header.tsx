import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../services/firebase';
import { Button } from '../ui/Button';

export const Header: React.FC = () => {
  const { currentUser } = useAuth();

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <header className="sticky top-0 z-10 w-full border-b border-gray-200 bg-surface px-6 py-4 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-2">
           <span className="material-symbols-outlined text-3xl text-primary">account_balance_wallet</span>
           <h1 className="text-xl font-bold tracking-tight text-slate-800">Poup+</h1>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-secondary md:block">
            {currentUser?.email}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout} icon="logout" title="Sair">
            <span className="sr-only">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
};