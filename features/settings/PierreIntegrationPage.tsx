import React, { useEffect, useState } from 'react';
import 'firebase/compat/functions';
import { Link } from 'react-router-dom';
import firebaseApp, { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { BackButton } from '../../components/ui/BackButton';

type Summary = {
  accounts: number;
  cards: number;
  transactions: number;
  skipped: number;
  months: number;
  syncedAt?: string;
  message?: string;
};

const friendlyError = (error: unknown): string => {
  const item = error as { message?: string; code?: string };
  const message = String(item?.message || '');
  if (/permission-denied/.test(item?.code || '') || /não está liberada/i.test(message)) {
    return 'Esta integração ainda não está habilitada para a sua conta.';
  }
  if (/failed-precondition/.test(item?.code || '') || /chave|importa|transaç|conta/i.test(message)) {
    return message || 'A integração ainda não está configurada no servidor.';
  }
  return 'Não foi possível consultar o Pierre. Confira a conexão e tente novamente.';
};

const Card: React.FC<{ title: string; value: number; subtitle: string }> = ({ title, value, subtitle }) => (
  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{title}</p>
    <p className="mt-2 text-3xl font-black text-slate-800 dark:text-slate-100">{value.toLocaleString('pt-BR')}</p>
    <p className="text-[11px] mt-1 text-slate-400">{subtitle}</p>
  </div>
);

export const PierreIntegrationPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [months, setMonths] = useState(6);
  const [preview, setPreview] = useState<Summary | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubscribe = db.collection('users').doc(currentUser.uid).collection('integrations').doc('pierre')
      .onSnapshot((snapshot) => {
        setLastSync(snapshot.exists ? String(snapshot.data()?.lastSyncAt || '') || null : null);
      }, () => setLastSync(null));
    return unsubscribe;
  }, [currentUser?.uid]);

  const execute = async (mode: 'preview' | 'import') => {
    if (!currentUser?.uid) return;
    setBusy(mode);
    setError('');
    setSuccess('');
    try {
      const callable = firebaseApp.functions('southamerica-east1').httpsCallable('syncPierre');
      const response = await callable({ mode, months });
      const result = response.data as Summary;
      setPreview(result);
      if (mode === 'import') {
        setLastSync(result.syncedAt || null);
        setSuccess('Importação concluída. Consulte contas, cartões e transações para conferir os valores.');
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const hasPotentialIssues = Boolean(preview?.skipped);
  const canImport = Boolean(preview && preview.transactions > 0 && !hasPotentialIssues);

  return (
    <div className="mx-auto max-w-2xl pb-28 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">Integração Pierre</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Suas finanças, sincronizadas com segurança</p>
        </div>
      </div>

      <div className="rounded-[28px] bg-emerald-600 text-white px-6 py-7 relative overflow-hidden">
        <div className="relative z-10">
          <span className="material-symbols-outlined text-3xl mb-3">sync_alt</span>
          <h2 className="text-xl font-black">Pierre → Poupe Mais</h2>
          <p className="mt-2 text-sm text-white/80 leading-relaxed">
            Suas contas e movimentações serão consultadas pelo servidor.
            Você não precisa inserir a chave da API nesta página.
          </p>
        </div>
      </div>

      <section className="rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Buscar histórico</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Escolha o período. Primeiro confira a prévia, depois importe.
          </p>
        </div>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="pierre-months">
          Período para importação
        </label>
        <select
          id="pierre-months"
          value={months}
          onChange={(event) => { setMonths(Number(event.target.value)); setPreview(null); setSuccess(''); }}
          disabled={busy !== null}
          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700"
        >
          <option value={3}>Últimos 3 meses</option>
          <option value={6}>Últimos 6 meses</option>
          <option value={12}>Últimos 12 meses</option>
        </select>
        <button
          type="button"
          onClick={() => execute('preview')}
          disabled={busy !== null}
          className="w-full rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-400 px-5 py-3 font-bold disabled:opacity-50"
        >
          {busy === 'preview' ? 'Consultando Pierre...' : 'Ver prévia dos dados'}
        </button>
        {lastSync && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Última importação: {new Date(lastSync).toLocaleString('pt-BR')}
          </p>
        )}
      </section>

      {preview && (
        <section className="space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 px-1">
            {preview.syncedAt ? 'Importação realizada' : 'Prévia disponível'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Card title="Contas" value={preview.accounts} subtitle="Disponíveis para importação" />
            <Card title="Cartões" value={preview.cards} subtitle="Encontrados no Pierre" />
            <Card title="Transações" value={preview.transactions} subtitle="Movimentações reconhecidas" />
            <Card title="Não associadas" value={preview.skipped} subtitle="Registros que precisam de revisão" />
          </div>
          {hasPotentialIssues ? (
            <p role="alert" className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
              Algumas transações não foram associadas com segurança. A importação fica bloqueada para evitar um histórico incompleto.
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              A importação preserva lançamentos já existentes. Ela não apaga automaticamente outros dados e evita duplicar IDs do Pierre.
            </p>
          )}
          <button
            type="button"
            onClick={() => execute('import')}
            disabled={!canImport || busy !== null}
            className="w-full rounded-xl bg-emerald-600 text-white px-5 py-4 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy === 'import' ? 'Importando movimentações...' : 'Importar dados do Pierre'}
          </button>
        </section>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 text-sm">{error}</p>}
      {success && <p role="status" className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 p-4 text-sm">{success}</p>}

      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2 px-1">
        <p>Para funcionar, o administrador deve ativar o servidor e cadastrar uma chave nova no Firebase Secret Manager.</p>
        <p>Não coloque sua chave de API no código, no GitHub ou em campos públicos.</p>
        <Link to="/settings" className="text-emerald-600 font-bold inline-block">Voltar às configurações</Link>
      </div>
    </div>
  );
};
