
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../services/firebase';

export const Header: React.FC = () => {
  const { currentUser } = useAuth();

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 px-6 py-2.5 backdrop-blur-xl md:hidden border-b border-slate-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center">
           <Link to="/" className="flex items-center transition-opacity hover:opacity-80">
             <img 
               src="https://poup-beta.web.app/Icon/LogoPoup.svg" 
               alt="Poup+" 
               className="h-6 w-auto" 
             />
           </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
             <img 
                src={currentUser?.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                className="h-7 w-7 rounded-full border border-slate-100 shadow-sm object-cover"
                alt="Avatar"
             />
          </div>
          <button 
            onClick={handleLogout}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:text-danger nav-transition"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
