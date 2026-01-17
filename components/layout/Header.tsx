
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ProfileActionsModal } from './ProfileActionsModal';
import { EditProfileModal } from '../../features/settings/EditProfileModal';

export const Header: React.FC = () => {
  const { currentUser } = useAuth();
  const [isProfileActionsOpen, setIsProfileActionsOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  return (
    <>
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
            <button 
              onClick={() => setIsProfileActionsOpen(true)}
              className="flex items-center gap-2 active:scale-95 transition-transform"
            >
               <img 
                  src={currentUser?.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                  className="h-8 w-8 rounded-full border border-slate-100 shadow-sm object-cover"
                  alt="Avatar"
               />
            </button>
          </div>
        </div>
      </header>

      <ProfileActionsModal 
        isOpen={isProfileActionsOpen}
        onClose={() => setIsProfileActionsOpen(false)}
        onOpenEditProfile={() => setIsEditProfileOpen(true)}
      />

      <EditProfileModal 
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
    </>
  );
};
