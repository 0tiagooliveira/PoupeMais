
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/analytics';

// Configuration object
const meta = import.meta as any;
const env = (meta && meta.env) ? meta.env : {};

// Check if using default/fallback credentials
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
  console.warn("⚠️ AVISO: Usando credenciais do Firebase de demonstração.");
}

// Initialize Firebase
if (!firebase.apps.length) {
  try {
    firebase.initializeApp(firebaseConfig);
    console.log("🔥 Firebase inicializado com sucesso.");
  } catch (error) {
    console.error("❌ Erro ao inicializar o Firebase:", error);
  }
}

const app = firebase.app();

// Initialize services
export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();

// Habilita persistência de dados offline no Firestore (Opcional, mas melhora UX)
try {
  db.enablePersistence().catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Múltiplas abas abertas, persistência desabilitada.");
    } else if (err.code === 'unimplemented') {
      console.warn("O navegador não suporta persistência.");
    }
  });
} catch (e) {}

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
