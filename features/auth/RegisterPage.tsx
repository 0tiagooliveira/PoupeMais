
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth, db } from '../../services/firebase';
import { useNotification } from '../../contexts/NotificationContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const getFriendlyErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Este e-mail já está sendo usado por outra conta. Tente fazer login ou recupere sua senha.';
      case 'auth/invalid-email':
        return 'O endereço de e-mail informado não é válido.';
      case 'auth/operation-not-allowed':
        return 'O cadastro com e-mail e senha não está disponível.';
      case 'auth/weak-password':
        return 'Sua senha deve ter pelo menos 6 caracteres.';
      case 'auth/network-request-failed':
        return 'Não conseguimos conectar ao servidor. Verifique sua conexão.';
      default:
        return 'Não foi possível concluir seu cadastro agora. Tente novamente.';
    }
  };

  const initializeUser = async (user: firebase.User) => {
    const userDocRef = db.collection('users').doc(user.uid);
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
      await userDocRef.set({
        displayName: name || user.displayName || '',
        email: user.email,
        createdAt: new Date().toISOString(),
        settings: { currency: 'BRL', theme: 'light' }
      });
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      const user = result.user;
      if (user) await initializeUser(user);
      addNotification('Seja bem-vindo ao Poup+!', 'success', 3000, false);
      navigate('/');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        const msg = 'Houve um problema ao criar conta com o Google.';
        setError(msg);
        addNotification(msg, 'error', 5000, false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Por favor, informe seu nome.');
    if (password !== confirmPassword) return setError('As senhas digitadas não são iguais.');
    if (password.length < 6) return setError('A senha deve ter no mínimo 6 caracteres.');
    
    setLoading(true);
    setError('');
    
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email.trim(), password);
      const user = userCredential.user;
      if (user) {
        await user.updateProfile({ displayName: name });
        await initializeUser(user);
      }
      addNotification(`Tudo pronto! Bem-vindo, ${name}!`, 'success', 5000, false);
      navigate('/');
    } catch (err: any) {
      const errorMessage = getFriendlyErrorMessage(err.code);
      setError(errorMessage);
      addNotification(errorMessage, 'error', 6000, false);
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
            className="mx-auto mb-6 h-14 w-auto" 
          />
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Junte-se ao Poup+</h2>
          <p className="text-secondary font-medium text-sm mt-1">Sua jornada para o sucesso financeiro.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 font-bold border border-red-100 animate-shake">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-lg">info</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        <Button 
          type="button" 
          variant="secondary" 
          onClick={handleGoogleLogin} 
          disabled={loading}
          className="w-full mb-6 py-4 rounded-2xl border-gray-100 font-bold text-sm"
        >
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google" 
            className="mr-3 h-5 w-5" 
          />
          Cadastrar com Google
        </Button>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Seu nome" type="text" placeholder="João da Silva" value={name} onChange={e => setName(e.target.value)} required icon="person" className="rounded-2xl" />
          <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required icon="mail" className="rounded-2xl" />
          <Input label="Crie uma senha" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} required icon="key" className="rounded-2xl" />
          <Input label="Confirme a senha" type="password" placeholder="Repita a senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required icon="check_circle" className="rounded-2xl" />

          <Button type="submit" className="w-full py-5 rounded-[22px] bg-primary hover:bg-emerald-600 shadow-xl shadow-success/20 mt-4 font-bold text-sm tracking-tight text-white" isLoading={loading}>
            Finalizar cadastro
          </Button>
        </form>

        <div className="mt-8 text-center text-xs font-bold text-slate-400">
          Já tem conta?{' '}
          <Link to="/login" className="font-bold text-success hover:underline tracking-tight">
            Fazer login
          </Link>
        </div>
      </div>
    </div>
  );
};
