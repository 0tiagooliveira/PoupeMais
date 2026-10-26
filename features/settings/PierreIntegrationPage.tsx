import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { BackButton } from '../../components/ui/BackButton';

type IssueCounts = { missingId: number; missingType: number; unknownCurrency: number; otherCurrency: number; invalidBalance: number };
type Doc = { id: string; collection: 'accounts' | 'credit_cards' | 'transactions'; data: Record<string, any> };
type Counts = { accounts: number; cards: number; transactions: number; skipped: number; skippedAccounts: number };
type Monthly = {
  months: number; periodIndex: number; totalPeriods: number; asOf: string; from: string; to: string;
  providerCount: number; documents: Doc[]; counts: Counts; accountIssues: IssueCounts;
};
type ReadyHistory = {
  asOf: string; documents: Doc[]; counts: Counts; issues: IssueCounts;
  periods: Array<{ from: string; to: string; count: number }>;
};
const DEFAULT_WORKER_URL = 'https://poup-mais.tiago336699.workers.dev';
const WORKER_URL = String(import.meta.env.VITE_PIERRE_WORKER_URL || DEFAULT_WORKER_URL).replace(/\/+$/, '');
const configured = /^https:\/\/[a-zA-Z0-9.-]+(?:\/[^?]*)?$/.test(WORKER_URL);
const todayUTC = () => new Date().toISOString().slice(0, 10);
const datePlusOne = (date: string) => {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const twelveMonthsBack = (date: string) => {
  const d = new Date(date + 'T12:00:00Z');
  const year = d.getUTCFullYear() - 1;
  const month = d.getUTCMonth();
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d.getUTCDate(), maxDay))).toISOString().slice(0, 10);
};
const issueFields: Array<keyof IssueCounts> =
  ['missingId', 'missingType', 'unknownCurrency', 'otherCurrency', 'invalidBalance'];
const noIssues = () => ({ missingId: 0, missingType: 0, unknownCurrency: 0, otherCurrency: 0, invalidBalance: 0 });

const Stat = ({label, count}: {label: string; count: number}) =>
  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    <p className="text-3xl font-black text-slate-800 dark:text-white mt-2">{count.toLocaleString('pt-BR')}</p>
  </div>;

export const PierreIntegrationPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [history, setHistory] = useState<ReadyHistory | null>(null);
  const [status, setStatus] = useState<'idle' | 'reading' | 'writing'>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');

  useEffect(() => {
    if (!currentUser?.uid) return;
    return db.collection('users').doc(currentUser.uid).collection('integrations').doc('pierre')
      .onSnapshot(d => setLastSyncAt(d.exists ? String(d.data()?.lastSyncAt || '') : ''),
        () => setLastSyncAt(''));
  }, [currentUser?.uid]);

  const readHistory = async () => {
    if (!auth.currentUser || !currentUser?.uid || !configured || status !== 'idle') return;
    setHistory(null);
    setStatus('reading');
    setError('');
    setSuccess('');
    const asOf = todayUTC();
    try {
      const token = await auth.currentUser.getIdToken();
      const accounts = new Map<string, Doc>();
      const movements = new Map<string, Doc>();
      const periods: ReadyHistory['periods'] = [];
      const issues = noIssues();
      let total: number | null = null;
      let skipped = 0, skippedAccounts = 0, providerCount = 0;
      let lastTo = '';
      for (let index = 0; index < (total ?? 14); index++) {
        setProgress('Conferindo período ' + (index + 1) + ' de ' + (total ?? 'até 14'));
        const response = await fetch(WORKER_URL + '/snapshot', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ months: 12, asOf, periodIndex: index }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || 'Falha na consulta de um período do Pierre.');
        const part = body as Monthly;
        if (!part || !Array.isArray(part.documents) || !part.counts || !part.accountIssues ||
          part.months !== 12 || part.asOf !== asOf || part.periodIndex !== index ||
          !Number.isInteger(part.totalPeriods) || part.totalPeriods < 12 || part.totalPeriods > 14 ||
          !Number.isInteger(part.providerCount) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(part.from) || !/^\d{4}-\d{2}-\d{2}$/.test(part.to) ||
          part.from > part.to) {
          throw new Error('Pierre retornou um período sem os dados de conferência necessários.');
        }
        if (total === null) {
          total = part.totalPeriods;
          if (part.from !== twelveMonthsBack(asOf)) throw new Error('Data inicial divergente dos últimos 12 meses.');
        }
        if (total !== part.totalPeriods || (lastTo && part.from !== datePlusOne(lastTo))) {
          throw new Error('Há uma lacuna ou sobreposição no histórico de 12 meses.');
        }
        lastTo = part.to;
        let transactionsThisMonth = 0;
        for (const doc of part.documents) {
          if (!doc || !['accounts', 'credit_cards', 'transactions'].includes(doc.collection) ||
            typeof doc.id !== 'string' || !doc.id.startsWith('pierre_') || !doc.data) {
            throw new Error('Registro inválido na resposta do Pierre.');
          }
          if (doc.collection === 'transactions') {
            const date = String(doc.data.date || '').slice(0, 10);
            if (movements.has(doc.id) || date < part.from || date > part.to) {
              throw new Error('Transação duplicada ou fora de seu período.');
            }
            movements.set(doc.id, doc);
            transactionsThisMonth++;
          } else {
            accounts.set(doc.collection + ':' + doc.id, doc);
          }
        }
        if (transactionsThisMonth + part.counts.skipped !== part.providerCount ||
            transactionsThisMonth !== part.counts.transactions) {
          throw new Error('Contagem de transações divergente da resposta do Pierre.');
        }
        skipped += part.counts.skipped;
        skippedAccounts = Math.max(skippedAccounts, part.counts.skippedAccounts || 0);
        providerCount += part.providerCount;
        for (const key of issueFields) issues[key] = Math.max(issues[key], part.accountIssues[key] || 0);
        periods.push({ from: part.from, to: part.to, count: transactionsThisMonth });
      }
      if (!total || periods.length !== total || lastTo !== asOf ||
          movements.size + skipped !== providerCount) {
        throw new Error('Não foi possível conferir todos os 12 meses.');
      }
      const docs = [...accounts.values(), ...movements.values()];
      setHistory({
        asOf, periods, documents: docs, issues,
        counts: {
          accounts: docs.filter(d => d.collection === 'accounts').length,
          cards: docs.filter(d => d.collection === 'credit_cards').length,
          transactions: movements.size, skipped, skippedAccounts,
        },
      });
    } catch (err) {
      setHistory(null);
      setError(err instanceof Error ? err.message : 'Falha na consulta ao Pierre.');
    } finally {
      setStatus('idle');
      setProgress('');
    }
  };

  const importHistory = async () => {
    if (!history || status !== 'idle' || history.counts.skipped ||
      history.counts.skippedAccounts || history.periods.length < 12 ||
      history.documents.length > 10000 || !currentUser?.uid ||
      !auth.currentUser || auth.currentUser.uid !== currentUser.uid) return;
    setStatus('writing');
    setError('');
    setSuccess('');
    const user = db.collection('users').doc(currentUser.uid);
    const meta = user.collection('integrations').doc('pierre');
    let saved = 0;
    try {
      await meta.set({
        status: 'importing', expectedMonths: 12, asOf: history.asOf,
        expectedRecords: history.documents.length, startedAt: new Date().toISOString(),
      }, { merge: true });
      let batch = db.batch();
      let count = 0;
      for (const doc of history.documents) {
        if (!doc.id.startsWith('pierre_') || doc.id.length > 1500 ||
          doc.data.source !== 'pierre' ||
          !['accounts', 'credit_cards', 'transactions'].includes(doc.collection)) {
          throw new Error('Registro inválido, gravação interrompida.');
        }
        batch.set(user.collection(doc.collection).doc(doc.id), doc.data, { merge: true });
        count++;
        if (count === 350) {
          await batch.commit();
          saved += count;
          setProgress('Gravados ' + saved + ' de ' + history.documents.length + ' registros.');
          batch = db.batch();
          count = 0;
        }
      }
      if (count) {
        await batch.commit();
        saved += count;
      }
      // Verify every expected document was actually stored. Firestore's single-field
      // 'source' index is enough; no paid backend and no custom composite index needed.
      // This consumes up to one Firestore read per imported document, inside Spark quotas.
      for (const collection of ['accounts', 'credit_cards', 'transactions'] as const) {
        const expectedDocs = history.documents.filter(d => d.collection === collection);
        if (!expectedDocs.length) continue;
        setProgress('Verificando os registros salvos em ' + collection + '...');
        const storedQuery = await user.collection(collection).where('source', '==', 'pierre').get();
        const stored = new Map(storedQuery.docs.map(d => [d.id, d.data()]));
        for (const expected of expectedDocs) {
          const actual = stored.get(expected.id);
          if (!actual || actual.source !== 'pierre') {
            throw new Error('Um lançamento não foi encontrado no Firestore. Importação incompleta.');
          }
          for (const field of ['sourceAccountId', 'amount', 'date', 'bankTransactionId',
            'accountId', 'balance', 'type', 'limit']) {
            if (Object.prototype.hasOwnProperty.call(expected.data, field) &&
                actual[field] !== expected.data[field]) {
              throw new Error('Um lançamento foi salvo com valores divergentes. Importação incompleta.');
            }
          }
        }
      }
      if (saved !== history.documents.length) {
        throw new Error('A quantidade gravada não confere com a prévia.');
      }
      const completedAt = new Date().toISOString();
      await meta.set({
        status: 'completed', importedMonths: 12, sourcePeriods: history.periods.length,
        historyFrom: history.periods[0].from, historyTo: history.asOf,
        importedAccounts: history.counts.accounts + history.counts.cards,
        importedTransactions: history.counts.transactions,
        importedRecords: saved, skipped: 0, periodReports: history.periods,
        lastSyncAt: completedAt,
      }, { merge: true });
      setSuccess('Histórico importado: ' + history.counts.transactions + ' transações, ' +
        history.counts.accounts + ' contas e ' + history.counts.cards +
        ' cartões. Os 12 meses foram consultados e a gravação foi conferida.');
    } catch (err) {
      await meta.set({
        status: 'incomplete', failedAt: new Date().toISOString(),
        committedBeforeError: saved,
      }, { merge: true }).catch(() => undefined);
      setError('Importação incompleta (' + saved + ' registros gravados). ' +
        (err instanceof Error ? err.message : 'Erro inesperado.') +
        ' Você pode repetir a importação sem duplicar os registros.');
    } finally {
      setStatus('idle');
      setProgress('');
    }
  };

  const counts = history?.counts;
  const blocked = !!counts && (counts.skipped > 0 || counts.skippedAccounts > 0);
  const allowed = !!history && !blocked && history.periods.length >= 12 &&
    history.documents.length <= 10000 && history.counts.transactions > 0 &&
    (history.counts.accounts + history.counts.cards) > 0;

  return <div className="mx-auto max-w-2xl pb-28 space-y-6 animate-in fade-in duration-500">
    <div className="flex items-center gap-4">
      <BackButton />
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-white">Integração Pierre</h1>
        <p className="text-xs text-slate-500">Histórico financeiro completo de 12 meses</p>
      </div>
    </div>
    <section className="rounded-[28px] bg-emerald-600 text-white p-6">
      <span className="material-symbols-outlined text-3xl">sync_alt</span>
      <h2 className="font-black text-xl mt-2">Pierre → Poupe Mais</h2>
      <p className="text-sm text-white/85 mt-2">Vamos consultar cada período, conferir a quantidade de registros
        e importar somente os 12 meses completos, sem excluir os dados anteriores.</p>
    </section>
    <section className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
      <h3 className="font-bold text-slate-800 dark:text-white">Verificar os últimos 12 meses</h3>
      <button type="button" onClick={readHistory} disabled={status !== 'idle' || !configured}
        className="w-full rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-400 p-4 font-bold disabled:opacity-50">
        {status === 'reading' ? 'Conferindo histórico...' : 'Consultar e conferir 12 meses'}
      </button>
      {progress && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{progress}</p>}
      {lastSyncAt && <p className="text-xs text-slate-500">
        Última importação registrada: {new Date(lastSyncAt).toLocaleString('pt-BR')}
      </p>}
    </section>
    {history && <section className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Conferidos {history.periods.length} períodos de {history.periods[0].from} a {history.asOf}.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Contas" count={history.counts.accounts}/>
        <Stat label="Cartões" count={history.counts.cards}/>
        <Stat label="Transações" count={history.counts.transactions}/>
        <Stat label="Para revisar" count={history.counts.skipped + history.counts.skippedAccounts}/>
      </div>
      {blocked && <p role="alert" className="text-sm bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-xl p-4">
        Existem registros não validados. Transações: {history.counts.skipped}.
        Contas: {history.counts.skippedAccounts}. Não será possível concluir a importação incompleta.
      </p>}
      {history.documents.length > 10000 && <p role="alert" className="text-sm text-red-600">
        Mais de 10 mil registros: a importação está bloqueada para preservar as cotas gratuitas.
      </p>}
      <button type="button" onClick={importHistory} disabled={!allowed || status !== 'idle'}
        className="w-full bg-emerald-600 text-white font-bold rounded-xl p-4 disabled:opacity-40">
        {status === 'writing' ? 'Gravando os dados...' : 'Importar todos os 12 meses'}
      </button>
    </section>}
    {error && <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-4 text-sm">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-emerald-50 text-emerald-700 p-4 text-sm">{success}</p>}
    <p className="text-xs text-slate-500">Não compartilhe sua chave do Pierre. Ela permanece protegida
      no servidor Cloudflare.</p>
    <Link to="/settings" className="text-emerald-600 font-bold">Voltar às configurações</Link>
  </div>;
};
