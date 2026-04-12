
import React, { createContext, useEffect, useState, useContext } from 'react';
import { auth } from '../services/firebase';
import { AuthContextType, UserProfile } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const failSafeTimeout = window.setTimeout(() => {
      setLoading(false);
    }, 6000);

    // Subscribe to auth state changes using v8 syntax
    const unsubscribe = auth.onAuthStateChanged(
      (user) => {
        window.clearTimeout(failSafeTimeout);

        if (user) {
          // Fazemos o cast para UserProfile para suportar nossa extensão de tipos
          const userProfile = user as UserProfile;

          // Acesso PRO liberado para usuários específicos.
          const email = user.email?.toLowerCase();
          const uid = user.uid;
          if (
            email === 'teste@gmail.com' ||
            email === 'marisa@gmail.com' ||
            email === 'tiago336699@gmail.com' ||
            email === 'rhayra83@gmail.com' ||
            uid === 'rKD63ADh54Nery9jEiDXemo6lzu1'
          ) {
            userProfile.isPro = true;
          }

          setCurrentUser(userProfile);
        } else {
          setCurrentUser(null);
        }

        setLoading(false);
      },
      () => {
        window.clearTimeout(failSafeTimeout);
        setCurrentUser(null);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      window.clearTimeout(failSafeTimeout);
      unsubscribe();
    };
  }, []);

  const value = {
    currentUser,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
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
