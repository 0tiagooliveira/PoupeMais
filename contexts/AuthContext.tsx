
import React, { createContext, useEffect, useState, useContext } from 'react';
import { auth } from '../services/firebase';
import { AuthContextType, UserProfile } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes using v8 syntax
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // Fazemos o cast para UserProfile para suportar nossa extensão de tipos
        const userProfile = user as UserProfile;
        
        // HACK DE ACESSO TOTAL: 
        // Se o usuário logado for um dos e-mails de teste solicitados, 
        // forçamos o status PRO para liberar todas as funcionalidades da IA e do SaaS.
        const email = user.email?.toLowerCase();
        if (email === 'teste@gmail.com' || email === 'marisa@gmail.com' || email === 'tiago336699@gmail.com') {
          userProfile.isPro = true;
        }
        
        setCurrentUser(userProfile);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Custom Hook for using Auth
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
