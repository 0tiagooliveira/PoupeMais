
import React, { createContext, useEffect, useState, useContext } from 'react';
import { auth } from '../services/firebase';
import { AuthContextType, UserProfile } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isForcedProUser = (email?: string | null, uid?: string) => {
      const normalizedEmail = (email || '').toLowerCase().trim();
      const normalizedUid = (uid || '').trim();

      const forcedProEmails = new Set([
        'teste@gmail.com',
        'marisa@gmail.com',
        'tiago336699@gmail.com',
        'rhayra83@gmail.com',
      ]);

      const forcedProUids = new Set([
        'rKD63ADh54Nery9jEiDXemo6lzu1',
      ]);

      return forcedProEmails.has(normalizedEmail) || forcedProUids.has(normalizedUid);
    };

    const failSafeTimeout = window.setTimeout(() => {
      setLoading(false);
    }, 6000);

    // Subscribe to auth state changes using v8 syntax
    const unsubscribe = auth.onAuthStateChanged(
      (user) => {
        window.clearTimeout(failSafeTimeout);

        if (user) {
          const userProfile = user as UserProfile;
          const forcedPro = isForcedProUser(userProfile.email, userProfile.uid);

          // Evita depender de mutação no objeto do Firebase; salva no estado já com isPro explícito.
          setCurrentUser({
            ...userProfile,
            isPro: Boolean(userProfile.isPro || forcedPro),
          });
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
