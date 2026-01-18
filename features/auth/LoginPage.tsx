
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
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google" 
            className="mr-3 h-5 w-5" 
          />
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
                onChange={(e) => setRememberMe(e.target.value)}
                className="h-4 w-4 rounded border-gray-300 text-success focus:ring-success accent-success"
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
