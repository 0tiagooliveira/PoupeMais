import React, { useState } from 'react';
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
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Define a persistência antes do login
      await auth.setPersistence(
        rememberMe 
          ? firebase.auth.Auth.Persistence.LOCAL 
          : firebase.auth.Auth.Persistence.SESSION
      );

      await auth.signInWithEmailAndPassword(email, password);
      
      addNotification('Login realizado com sucesso!', 'success');
      navigate('/');
    } catch (err: any) {
      console.error("Login Error:", err);
      
      let errorMessage = 'Falha ao fazer login. Verifique suas credenciais.';
      
      // Tratamento de erros específicos do Firebase
      switch (err.code) {
        case 'auth/invalid-credential':
          errorMessage = 'E-mail não encontrado ou senha incorreta. Se não tiver conta, cadastre-se.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'Usuário não encontrado. Verifique o e-mail ou crie uma conta.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Senha incorreta. Tente novamente.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'O formato do e-mail é inválido.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Esta conta foi desativada pelo administrador.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Muitas tentativas falhas. Aguarde alguns minutos e tente novamente.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Erro de conexão. Verifique sua internet.';
          break;
        default:
          errorMessage = 'Ocorreu um erro inesperado. Tente novamente.';
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
      // Para Google Login, também aplicamos a persistência
      await auth.setPersistence(
        rememberMe 
          ? firebase.auth.Auth.Persistence.LOCAL 
          : firebase.auth.Auth.Persistence.SESSION
      );

      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      const user = result.user;

      if (user) {
        const userDocRef = db.collection('users').doc(user.uid);
        const userDocSnap = await userDocRef.get();

        if (!userDocSnap.exists) {
          await userDocRef.set({
            email: user.email,
            createdAt: new Date().toISOString(),
            settings: {
              currency: 'BRL',
              theme: 'light'
            }
          });
        }
      }

      addNotification('Login com Google realizado com sucesso!', 'success');
      navigate('/');
    } catch (err: any) {
      console.error("Google Login Error:", err);
      
      let googleErrorMsg = 'Falha ao entrar com Google.';

      if (err.code === 'auth/operation-not-supported-in-this-environment') {
        googleErrorMsg = 'Ambiente não suportado (HTTP). Use HTTPS ou localhost.';
      } else if (err.code === 'auth/unauthorized-domain') {
        googleErrorMsg = `Domínio não autorizado: "${window.location.hostname}".`;
      } else if (err.code === 'auth/popup-closed-by-user') {
        googleErrorMsg = 'O login foi cancelado.';
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        googleErrorMsg = 'Já existe uma conta com este e-mail usando outro método de login.';
      }
      
      setError(googleErrorMsg);
      addNotification(googleErrorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-surface p-8 shadow-xl">
        <div className="mb-8 text-center">
          <span className="material-symbols-outlined mb-4 text-5xl text-primary">lock</span>
          <h2 className="text-2xl font-bold text-slate-800">Bem-vindo de volta</h2>
          <p className="text-secondary">Acesse sua conta Poup+</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-danger flex items-center gap-2">
            <span className="material-symbols-outlined text-lg flex-shrink-0">error</span>
            <span className="break-words w-full">{error}</span>
          </div>
        )}

        <div className="mb-6 flex flex-col gap-3">
          <Button 
            type="button" 
            variant="secondary" 
            onClick={handleGoogleLogin} 
            disabled={loading}
            className="relative"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Entrar com Google
          </Button>
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="mx-4 flex-shrink text-xs text-secondary">ou com e-mail</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            icon="mail"
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            icon="key"
          />

          {/* Checkbox Manter Conectado */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="rememberMe" className="text-sm text-secondary select-none cursor-pointer">
              Manter conectado
            </label>
          </div>

          <div className="mt-2">
            <Button type="submit" className="w-full" isLoading={loading}>
              Entrar
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-secondary">
          Não tem uma conta?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Crie agora
          </Link>
        </div>
      </div>
    </div>
  );
};