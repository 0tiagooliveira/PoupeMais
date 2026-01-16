
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
    const saved = localStorage.getItem('poup_remember_me');
    // Por padrão, deixamos como 'true' para evitar logins chatos
    return saved !== null ? saved === 'true' : true; 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  useEffect(() => {
    localStorage.setItem('poup_remember_me', String(rememberMe));
  }, [rememberMe]);

  const getFriendlyErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/invalid-email':
        return 'O formato do e-mail digitado não é válido.';
      case 'auth/user-disabled':
        return 'Esta conta de usuário foi desativada.';
      case 'auth/user-not-found':
        return 'Não encontramos nenhuma conta com este e-mail.';
      case 'auth/wrong-password':
        return 'A senha digitada está incorreta. Tente novamente.';
      case 'auth/invalid-credential':
        return 'E-mail ou senha incorretos. Por favor, verifique seus dados.';
      case 'auth/network-request-failed':
        return 'Falha na conexão. Verifique sua internet e tente novamente.';
      case 'auth/too-many-requests':
        return 'Acesso bloqueado temporariamente por muitas tentativas. Tente em alguns minutos.';
      default:
        return 'Ocorreu um erro ao entrar. Verifique seus dados.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // PERSISTÊNCIA: LOCAL mantém o usuário logado mesmo após fechar o navegador.
      // SESSION desloga ao fechar a aba.
      const persistence = rememberMe 
        ? firebase.auth.Auth.Persistence.LOCAL 
        : firebase.auth.Auth.Persistence.SESSION;
        
      await auth.setPersistence(persistence);
      await auth.signInWithEmailAndPassword(email.trim(), password);
      
      addNotification('Que bom ter você de volta!', 'success', 3000, false);
      navigate('/');
    } catch (err: any) {
      const errorMessage = getFriendlyErrorMessage(err.code);
      setError(errorMessage);
      addNotification(errorMessage, 'error', 5000, false);
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
      addNotification('Acesso autorizado!', 'success', 3000, false);
      navigate('/');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Falha ao autenticar com Google.');
      }
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
          <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 font-bold border border-red-100">
            {error}
          </div>
        )}

        <Button 
          type="button" 
          variant="secondary" 
          onClick={handleGoogleLogin} 
          disabled={loading}
          className="w-full mb-8 py-4 rounded-2xl border-gray-100 font-bold text-sm"
        >
          <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Entrar com Google
        </Button>
        
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

          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-xs font-bold text-slate-500 group-hover:text-slate-800 transition-colors">
                Manter conectado
              </span>
            </label>
          </div>

          <Button 
            type="submit" 
            className="w-full py-5 rounded-[22px] shadow-xl shadow-success/20 mt-2 bg-success font-bold text-sm tracking-tight text-white" 
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
