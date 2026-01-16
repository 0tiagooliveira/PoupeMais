import React from 'react';
import { Link } from 'react-router-dom';
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
        <div className="flex items-center">
           <Link to="/" className="flex items-center transition-opacity hover:opacity-80">
             <img 
               src="https://poup-beta.web.app/Icon/LogoPoup.svg" 
               alt="Poup+" 
               className="h-7 w-auto md:h-8" 
             />
           </Link>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden text-sm font-semibold text-secondary md:block">
            {currentUser?.email}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout} icon="logout" title="Sair" className="text-slate-400 hover:text-danger">
            <span className="sr-only">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
};