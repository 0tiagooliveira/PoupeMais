import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/analytics';

// Configuration object
const meta = import.meta as any;
const env = (meta && meta.env) ? meta.env : {};

// Check if using default/fallback credentials which might cause permission errors
const isUsingDefaultConfig = !env.VITE_FIREBASE_API_KEY;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyB8_TagbRuyEZ1puNUrn9UnyptHOOMZong",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "poupe-mais-6a07f.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "poupe-mais-6a07f",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "poupe-mais-6a07f.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "451102060352",
  appId: env.VITE_FIREBASE_APP_ID || "1:451102060352:web:1d9bb2a53494db04f814a5",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-32H9F0KZPS"
};

if (isUsingDefaultConfig) {
  console.warn("⚠️ AVISO: Usando credenciais do Firebase de demonstração. Se você receber erros de permissão, certifique-se de configurar seu próprio .env com as credenciais do seu projeto e atualizar as Regras de Segurança no Console.");
}

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const app = firebase.app();

// Initialize services
export const auth = firebase.auth();
export const db = firebase.firestore();

// Analytics (Safe initialization)
let analytics = null;
if (typeof window !== 'undefined') {
  try {
     analytics = firebase.analytics();
  } catch (e) {
     console.error("Firebase Analytics init failed", e);
  }
}

export { analytics };
export default app;