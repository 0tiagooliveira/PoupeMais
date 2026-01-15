
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
      addNotification('Cadastro realizado com sucesso!', 'success');
      navigate('/');
    } catch (err: any) {
      console.error("Google Signup Error:", err);
      setError('Falha ao cadastrar com Google.');
      addNotification('Erro no cadastro com Google.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Informe seu nome.');
    if (password !== confirmPassword) return setError('As senhas não coincidem.');
    if (password.length < 6) return setError('Mínimo 6 caracteres.');
    setLoading(true);
    setError('');
    
    // Clear logout flag when attempting to register
    sessionStorage.removeItem('poup_logout');
    
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      if (user) {
        await user.updateProfile({ displayName: name });
        await initializeUser(user);
      }
      addNotification(`Bem-vindo, ${name}!`, 'success');
      window.location.reload(); 
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao criar conta.');
      addNotification('Erro ao criar conta.', 'error');
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
          <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 font-bold border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Seu nome" type="text" placeholder="João da Silva" value={name} onChange={e => setName(e.target.value)} required icon="person" className="rounded-2xl" />
          <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required icon="mail" className="rounded-2xl" />
          <Input label="Crie uma senha" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required icon="key" className="rounded-2xl" />
          <Input label="Confirme a senha" type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required icon="check_circle" className="rounded-2xl" />

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
