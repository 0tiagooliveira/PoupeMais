import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { BackButton } from '../../components/ui/BackButton';

type Summary = {
  accounts: number;
  cards: number;
  transactions: number;
  skipped: number;
  skippedAccounts?: number;
};

type PierreDocument = {
  collection: 'accounts' | 'credit_cards' | 'transactions';
  id: string;
  data: Record<string, unknown>;
};

type Snapshot = {
  counts: Summary;
  accountIssues?: {
    missingId: number;
    missingType: number;
    unknownCurrency: number;
    otherCurrency: number;
    invalidBalance: number;
  };
  documents: PierreDocument[];
  fetchedAt: string;
  months: number;
};

// Public endpoint of the Worker created for this project. API keys remain server-side.
const DEFAULT_WORKER_URL = 'https://poup-mais.tiago336699.workers.dev';
const WORKER_URL = String(import.meta.env.VITE_PIERRE_WORKER_URL || DEFAULT_WORKER_URL).replace(/\/+$/, '');
const configured = /^https:\/\/[a-zA-Z0-9.-]+(?:\/[^?]*)?$/.test(WORKER_URL);

const ErrorMessage = ({ message }: { message: string }) =>
  <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 text-sm">{message}</p>;

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-2 text-3xl font-black text-slate-800 dark:text-white">{value.toLocaleString('pt-BR')}</p>
  </div>
);

export const PierreIntegrationPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [months, setMonths] = useState(6);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!currentUser?.uid) return;
    return db.collection('users').doc(currentUser.uid).collection('integrations').doc('pierre')
      .onSnapshot((doc) => {
        setLastSync(doc.exists ? (doc.data()?.lastSyncAt || null) : null);
      }, () => setLastSync(null));
  }, [currentUser?.uid]);

  const preview = async () => {
    if (!configured || !currentUser || !auth.currentUser) {
      setError('A ponte gratuita ainda não foi publicada ou configurada.');
      return;
    }
    setBusy('preview');
    setError('');
    setMessage('');
    setSnapshot(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(WORKER_URL + '/snapshot', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ months }),
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(String(body.error || 'Erro ao consultar Pierre.'));
      if (!body?.counts || !Array.isArray(body.documents) || !body.fetchedAt) {
        throw new Error('A ponte retornou um formato de dados inválido.');
      }
      setSnapshot(body as Snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar o Pierre.');
    } finally {
      setBusy(null);
    }
  };

  const importData = async () => {
    if (!snapshot || snapshot.counts.skipped || snapshot.counts.skippedAccounts || !snapshot.counts.transactions || !currentUser?.uid ||
      busy || snapshot.documents.length > 10000) return;
    const user = auth.currentUser;
    if (!user || user.uid !== currentUser.uid) return;
    setBusy('import');
    setError('');
    setMessage('');
    const uid = user.uid;
    let written = 0;
    try {
      const userRef = db.collection('users').doc(uid);
      const cleanDocuments = snapshot.documents;
      let batch = db.batch();
      let batchSize = 0;
      for (const entry of cleanDocuments) {
        if (!['accounts', 'credit_cards', 'transactions'].includes(entry.collection) ||
          typeof entry.id !== 'string' || entry.id.length > 1500 ||
          !entry.id.startsWith('pierre_') || !entry.data || entry.data.source !== 'pierre') {
          throw new Error('Um documento recebido do Pierre é inválido; importação interrompida.');
        }
        batch.set(userRef.collection(entry.collection).doc(entry.id), entry.data, { merge: true });
        batchSize++;
        if (batchSize >= 350) {
          await batch.commit();
          written += batchSize;
          batchSize = 0;
          batch = db.batch();
        }
      }
      if (batchSize) {
        await batch.commit();
        written += batchSize;
      }
      await userRef.collection('integrations').doc('pierre').set({
        provider: 'pierre',
        lastSyncAt: new Date().toISOString(),
        sourceFetchedAt: snapshot.fetchedAt,
        importedAccounts: snapshot.counts.accounts + snapshot.counts.cards,
        importedTransactions: snapshot.counts.transactions,
        skipped: snapshot.counts.skipped,
        months: snapshot.months,
      }, { merge: true });
      setLastSync(new Date().toISOString());
      setMessage('Importação concluída. Confira os saldos e o histórico antes de considerar os números definitivos.');
    } catch (err) {
      setError('Importação interrompida após ' + written + ' registros salvos. ' +
        (err instanceof Error ? err.message : 'Verifique sua conexão.') +
        ' Você pode executar novamente sem criar duplicatas.');
    } finally {
      setBusy(null);
    }
  };

  const counts = snapshot?.counts;
  const canImport = Boolean(counts && counts.transactions > 0 && counts.accounts + counts.cards > 0 &&
    counts.skipped === 0 && (counts.skippedAccounts || 0) === 0 && (snapshot?.documents.length || 0) <= 10000);

  return (
    <div className="mx-auto max-w-2xl pb-28 space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">Integração Pierre</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Firebase gratuito, dados do Pierre com segurança</p>
        </div>
      </header>
      <section className="rounded-[28px] bg-emerald-600 text-white px-6 py-7">
        <span className="material-symbols-outlined text-3xl">sync_alt</span>
        <h2 className="text-xl font-black mt-2">Pierre → Poupe Mais</h2>
        <p className="text-sm text-white/85 mt-2">
          Sua chave fica protegida na ponte Cloudflare. O aplicativo recebe as movimentações
          após validar seu login Firebase e você confirma a importação.
        </p>
      </section>

      {!configured && <ErrorMessage message="A ponte gratuita Cloudflare ainda não está configurada. Nenhum dado será importado até o administrador publicar o Worker e configurar a URL." />}

      <section className="rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h3 className="font-bold text-slate-800 dark:text-white">Conferir dados do Pierre</h3>
        <label htmlFor="pierre-period" className="block text-sm font-medium text-slate-600 dark:text-slate-300">Período</label>
        <select id="pierre-period" value={months}
          onChange={(event) => { setMonths(Number(event.target.value)); setSnapshot(null); setMessage(''); }}
          disabled={busy !== null}
          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700">
          <option value={3}>Últimos 3 meses</option>
          <option value={6}>Últimos 6 meses</option>
          <option value={12}>Últimos 12 meses</option>
        </select>
        <button type="button" onClick={preview} disabled={!configured || busy !== null}
          className="w-full rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-400 px-5 py-3 font-bold disabled:opacity-50">
          {busy === 'preview' ? 'Consultando Pierre...' : 'Ver prévia'}
        </button>
        {lastSync && <p className="text-xs text-slate-500 dark:text-slate-400">
          Última importação: {new Date(lastSync).toLocaleString('pt-BR')}
        </p>}
      </section>

      {counts && <section className="space-y-4">
        <h3 className="font-bold text-slate-800 dark:text-white">Dados localizados</h3>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Contas" value={counts.accounts} />
          <Stat label="Cartões" value={counts.cards} />
          <Stat label="Transações" value={counts.transactions} />
          <Stat label="Transações para revisar" value={counts.skipped} />
          <Stat label="Contas para revisar" value={counts.skippedAccounts || 0} />
        </div>
        {(counts.skipped > 0 || (counts.skippedAccounts || 0) > 0) &&
          <div role="alert" className="rounded-xl p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm space-y-2">
            <p>O Pierre retornou alguns registros incompletos, com moeda diferente ou sem vínculo seguro. A prévia já mostra o que foi encontrado; a importação só será liberada quando os dados estiverem consistentes.</p>
            {snapshot?.accountIssues && <p className="text-xs">Contas: sem identificação {snapshot.accountIssues.missingId}, sem tipo {snapshot.accountIssues.missingType}, sem moeda verificável {snapshot.accountIssues.unknownCurrency}, moeda diferente de BRL {snapshot.accountIssues.otherCurrency}, sem saldo válido {snapshot.accountIssues.invalidBalance}.</p>}
          </div>}
        {snapshot && snapshot.documents.length > 10000 &&
          <ErrorMessage message="Esse período excede 10 mil registros. Selecione um período menor para respeitar a cota gratuita do Firebase." />}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Importar não apaga lançamentos existentes. IDs do Pierre são estáveis para evitar duplicações.
          Confira faturas, transferências e saldos após cada importação.
        </p>
        <button type="button" disabled={!canImport || busy !== null} onClick={importData}
          className="w-full rounded-xl bg-emerald-600 text-white px-5 py-4 font-bold disabled:opacity-40">
          {busy === 'import' ? 'Importando...' : 'Confirmar importação'}
        </button>
      </section>}
      {error && <ErrorMessage message={error} />}
      {message && <p role="status" className="rounded-xl p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 text-sm">{message}</p>}
      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2">
        <p>Não informe a chave de API neste aplicativo. O administrador configura a chave como segredo do Worker.</p>
        <Link to="/settings" className="text-emerald-600 font-bold inline-block">Voltar às configurações</Link>
      </div>
    </div>
  );
};
