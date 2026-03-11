
import React, { createContext, useEffect, useState, useContext } from 'react';
import { auth } from '../services/firebase';
import { AuthContextType, UserProfile } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const privilegedEmails = new Set([
  'teste@gmail.com',
  'marisa@gmail.com',
  'tiago336699@gmail.com',
]);

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
        // E-mails privilegiados recebem acesso PRO automaticamente.
        const email = user.email?.toLowerCase();
        if (email && privilegedEmails.has(email)) {
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
