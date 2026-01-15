
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth, db } from '../../services/firebase';
import { useNotification } from '../../contexts/NotificationContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('poup_remember_me') !== 'false';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  useEffect(() => {
    localStorage.setItem('poup_remember_me', String(rememberMe));
  }, [rememberMe]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Clear logout flag when attempting to login
    sessionStorage.removeItem('poup_logout');

    try {
      const persistence = rememberMe 
        ? firebase.auth.Auth.Persistence.LOCAL 
        : firebase.auth.Auth.Persistence.SESSION;
        
      await auth.setPersistence(persistence);
      await auth.signInWithEmailAndPassword(email, password);
      
      addNotification('Bem-vindo de volta ao Poup+!', 'success');
      navigate('/');
    } catch (err: any) {
      console.error("Login Error:", err);
      let errorMessage = 'Falha ao fazer login.';
      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          errorMessage = 'E-mail ou senha incorretos.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Muitas tentativas. Tente mais tarde.';
          break;
        default:
          errorMessage = 'Erro ao acessar conta. Verifique sua conexão.';
      }
      setError(errorMessage);
      addNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const persistence = rememberMe 
        ? firebase.auth.Auth.Persistence.LOCAL 
        : firebase.auth.Auth.Persistence.SESSION;
      await auth.setPersistence(persistence);
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      const user = result.user;
      if (user) {
        const userDocRef = db.collection('users').doc(user.uid);
        const userDocSnap = await userDocRef.get();
        if (!userDocSnap.exists) {
          await userDocRef.set({
            displayName: user.displayName,
            email: user.email,
            createdAt: new Date().toISOString(),
            settings: { currency: 'BRL', theme: 'light' }
          });
        }
      }
      addNotification('Login realizado com sucesso!', 'success');
      navigate('/');
    } catch (err: any) {
      console.error("Google Login Error:", err);
      setError('Erro ao entrar com Google.');
      addNotification('Erro ao entrar com Google.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-[40px] border border-gray-100 bg-surface p-10 shadow-2xl">
        <div className="mb-10 text-center">
          <img 
            src="https://poup-beta.web.app/Icon/LogoPoup.svg" 
            alt="Poup+" 
            className="mx-auto mb-6 h-16 w-auto" 
          />
          <p className="text-secondary font-medium tracking-tight">Sua liberdade financeira começa aqui.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 flex items-center gap-3 border border-red-100 animate-shake">
            <span className="material-symbols-outlined text-xl font-bold">error</span>
            <span className="font-bold">{error}</span>
          </div>
        )}

        <Button 
          type="button" 
          variant="secondary" 
          onClick={handleGoogleLogin} 
          disabled={loading}
          className="w-full mb-8 py-4 rounded-2xl border-gray-100 hover:border-success/30 hover:bg-success/5 transition-all font-bold text-sm tracking-tight"
        >
          <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Entrar com Google
        </Button>
        
        <div className="relative flex items-center mb-8">
          <div className="flex-grow border-t border-gray-100"></div>
          <span className="mx-4 flex-shrink text-[10px] font-bold tracking-tight text-slate-300">ou e-mail</span>
          <div className="flex-grow border-t border-gray-100"></div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            icon="alternate_email"
            className="rounded-2xl"
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            icon="lock"
            className="rounded-2xl"
          />

          <div className="flex items-center justify-between px-1 mb-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border-2 border-gray-100 transition-all checked:bg-success checked:border-success"
                />
                <span className="material-symbols-outlined absolute text-white text-[12px] font-bold opacity-0 peer-checked:opacity-100 pointer-events-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    check
                </span>
              </div>
              <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors tracking-tight">
                Manter conectado
              </span>
            </label>
            
            <Link to="/register" className="text-[10px] font-bold text-success hover:underline tracking-tight">
                Esqueci a senha
            </Link>
          </div>

          <Button 
            type="submit" 
            className="w-full py-5 rounded-[22px] shadow-xl shadow-success/20 mt-2 bg-success hover:bg-emerald-600 font-bold text-sm tracking-tight text-white" 
            isLoading={loading}
          >
            Acessar plataforma
          </Button>
        </form>

        <p className="mt-10 text-center text-xs font-bold text-slate-400">
          Novo por aqui?{' '}
          <Link to="/register" className="font-bold text-success hover:underline tracking-tight">
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
};
