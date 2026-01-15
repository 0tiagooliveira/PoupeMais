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
      console.log('Auth state changed:', user ? user.email : 'No user');
      
      if (user) {
        // Real user from Firebase - always use this
        console.log('Using real Firebase user:', user.email);
        setCurrentUser(user as UserProfile);
      } else {
        // No Firebase user - check if we should show mock user
        const hasLoggedOut = sessionStorage.getItem('poup_logout');
        if (!hasLoggedOut) {
          console.log('No Firebase user, using mock user');
          setCurrentUser({
            uid: 'test-user-123',
            email: 'teste@poup.com',
            displayName: 'Usuário Teste',
            photoURL: null,
          } as UserProfile);
        } else {
          console.log('User logged out, no user set');
          setCurrentUser(null);
        }
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