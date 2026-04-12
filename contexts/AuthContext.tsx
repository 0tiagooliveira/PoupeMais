
import React, { createContext, useEffect, useState, useContext } from 'react';
import { auth, db } from '../services/firebase';
import { AuthContextType, UserProfile } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const buildUserProfile = (
    user: UserProfile,
    forcedPro: boolean,
    displayNameOverride?: string
  ): UserProfile => ({
    ...user,
    // Campos do Firebase Auth podem ser nao-enumeraveis; forca serializacao explicita.
    uid: user.uid,
    email: user.email ?? null,
    displayName: displayNameOverride ?? user.displayName ?? '',
    photoURL: user.photoURL ?? null,
    isPro: Boolean(user.isPro || forcedPro),
  } as UserProfile);

  const initializeUserWorkspace = async (uid: string, email: string, displayName: string) => {
    try {
      const userDocRef = db.collection('users').doc(uid);
      const userDocSnap = await userDocRef.get();
      
      if (!userDocSnap.exists) {
        console.log('[AUTH] Initializing workspace for UID:', uid);
        await userDocRef.set({
          displayName: displayName || '',
          email: email,
          createdAt: new Date().toISOString(),
          settings: { currency: 'BRL', theme: 'light' }
        });
        console.log('[AUTH] Workspace initialized successfully');
      } else {
        console.log('[AUTH] Workspace already exists for UID:', uid);
      }
    } catch (error) {
      console.error('[AUTH] Error initializing workspace:', error);
    }
  };

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
      console.warn('[AUTH] Fail-safe timeout reached - loading state forced to false');
      setLoading(false);
    }, 8000);

    // Subscribe to auth state changes using v8 syntax
    const unsubscribe = auth.onAuthStateChanged(
      async (user) => {
        window.clearTimeout(failSafeTimeout);

        if (user) {
          const userProfile = user as UserProfile;
          const forcedPro = isForcedProUser(userProfile.email, userProfile.uid);

          console.log('[AUTH] User loaded:', { uid: userProfile.uid, email: userProfile.email, displayName: userProfile.displayName, hasUid: !!userProfile.uid });

          // Inicializa espaço de trabalho se necessário (silenciosamente em background)
          if (userProfile.uid) {
            initializeUserWorkspace(userProfile.uid, userProfile.email || '', userProfile.displayName || '');
          }

          // Se não tiver displayName no Firebase Auth, tenta carregar do Firestore
          if (!userProfile.displayName) {
            console.log('[AUTH] No displayName in Firebase Auth, fetching from Firestore...');
            db.collection('users').doc(userProfile.uid).get().then((doc) => {
              if (doc.exists) {
                const firestoreData = doc.data();
                const displayNameFromFirestore = firestoreData?.displayName || '';
                console.log('[AUTH] displayName from Firestore:', displayNameFromFirestore);

                setCurrentUser(buildUserProfile(userProfile, forcedPro, displayNameFromFirestore));
              } else {
                console.log('[AUTH] Firestore user document not found');
                setCurrentUser(buildUserProfile(userProfile, forcedPro));
              }
              setLoading(false);
            }).catch((error) => {
              console.error('[AUTH] Error fetching from Firestore:', error);
              setCurrentUser(buildUserProfile(userProfile, forcedPro));
              setLoading(false);
            });
          } else {
            // Evita depender de mutação no objeto do Firebase; salva no estado já com isPro explícito.
            setCurrentUser(buildUserProfile(userProfile, forcedPro));
            setLoading(false);
          }
        } else {
          console.log('[AUTH] No user logged in');
          setCurrentUser(null);
          setLoading(false);
        }
      },
      (error) => {
        window.clearTimeout(failSafeTimeout);
        console.error('[AUTH] Auth error:', error);
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
