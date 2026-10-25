'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');

initializeApp();
const db = getFirestore();
const pierreKey = defineSecret('PIERRE_API_KEY');
const pierreOwnerUid = defineSecret('PIERRE_OWNER_UID');
const BASE_URL = 'https://www.pierre.finance/tools/api';
const COLLECTIONS = ['transactions', 'accounts', 'credit_cards'];
const REGION = 'southamerica-east1';

const norm = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const stableId = (kind, id) =>
  'pierre_' + createHash('sha256').update(kind + ':' + String(id)).digest('hex').slice(0, 40);
const dayOfMonth = (date) => /^\d{4}-\d{2}-(\d{2})/.test(String(date || ''))
  ? Number(String(date).slice(8, 10))
  : null;

function assertOwner(request) {
  const owner = pierreOwnerUid.value();
  if (!request.auth || !owner || request.auth.uid !== owner) {
    throw new HttpsError('permission-denied', 'Esta integração não está liberada para esta conta.');
  }
}

async function fetchPierre(path, params = {}) {
  const key = pierreKey.value();
  if (!key) throw new HttpsError('failed-precondition', 'A chave do Pierre ainda não foi configurada no servidor.');
  const url = new URL(BASE_URL + '/' + path);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
  }
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
  } catch (_) {
    throw new HttpsError('unavailable', 'Não foi possível consultar o Pierre. Tente novamente.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new HttpsError('failed-precondition', 'O Pierre recusou o acesso. Verifique a chave e o plano.');
  }
  if (response.status === 429) throw new HttpsError('resource-exhausted', 'Limite de consultas do Pierre atingido.');
  if (!response.ok) throw new HttpsError('unavailable', 'O Pierre retornou um erro na consulta.');
  let json;
  try { json = await response.json(); } catch (_) {
    throw new HttpsError('data-loss', 'O Pierre retornou uma resposta inválida.');
  }
  if (!json || json.success !== true || !Array.isArray(json.data)) {
    throw new HttpsError('data-loss', 'Os dados do Pierre não têm o formato esperado.');
  }
  return json.data;
}

function monthsWindow(months) {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - months + 1, 1));
  const dates = [];
  for (let i = 0; i < months; i++) {
    const from = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const till = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0));
    const iso = (d) => d.toISOString().slice(0, 10);
    dates.push({ startDate: iso(from), endDate: iso(till > end ? end : till) });
  }
  return dates;
}

function matchAccount(tx, accounts) {
  const directId = tx.account_id || tx.accountId;
  if (directId) {
    const direct = accounts.find((account) => account.accountId === directId);
    if (direct) return direct;
  }
  const type = norm(tx.account_type);
  const byType = accounts.filter((account) => norm(account.accountType) === type);
  const full = byType.filter((account) =>
    norm(account.accountMarketingName) === norm(tx.account_marketing_name) &&
    norm(account.accountName) === norm(tx.account_name)
  );
  if (full.length === 1) return full[0];
  const byMarketing = byType.filter((account) =>
    tx.account_marketing_name && norm(account.accountMarketingName) === norm(tx.account_marketing_name));
  if (byMarketing.length === 1) return byMarketing[0];
  const byName = byType.filter((account) =>
    tx.account_name && norm(account.accountName) === norm(tx.account_name));
  return byName.length === 1 ? byName[0] : null;
}

function normalizeAccount(account, now) {
  const common = {
    name: String(account.accountMarketingName || account.accountName || 'Conta Pierre').slice(0, 120),
    color: '#16a34a',
    source: 'pierre',
    sourceAccountId: String(account.accountId),
    updatedAt: now,
    createdAt: now,
  };
  if (norm(account.accountType) === 'credit') {
    return { collection: 'credit_cards', id: stableId('card', account.accountId), data: {
      ...common,
      limit: Number(account.creditData?.creditLimit) || 0,
      closingDay: dayOfMonth(account.creditData?.balanceCloseDate) || 1,
      dueDay: dayOfMonth(account.creditData?.balanceDueDate) || 10,
      sourceDatesEstimated: !account.creditData?.balanceDueDate || !account.creditData?.balanceCloseDate,
    }};
  }
  return { collection: 'accounts', id: stableId('account', account.accountId), data: {
    ...common,
    type: String(account.accountSubtype || account.accountType || 'BANK'),
    balance: Number(account.accountBalance) || 0,
    initialBalance: 0,
  }};
}

function normalizeTransaction(tx, accounts, now) {
  const account = matchAccount(tx, accounts);
  if (!account || !tx.id || !/^\d{4}-\d{2}-\d{2}$/.test(String(tx.date))) return null;
  if (tx.currency_code && tx.currency_code !== 'BRL') return null;
  const amountSigned = Number(tx.amount);
  if (!Number.isFinite(amountSigned)) return null;
  const isCard = norm(account.accountType) === 'credit';
  const desc = String(tx.description || 'Movimentação Pierre').slice(0, 400);
  const category = String(tx.category || 'Sem categoria').slice(0, 120);
  const paymentText = norm(desc + ' ' + category);
  const isCardPayment = !isCard && paymentText.includes('fatura') && paymentText.includes('pagamento');
  const linkedAccountId = stableId(isCard ? 'card' : 'account', account.accountId);
  return { id: stableId('transaction', account.accountId + ':' + tx.id), data: {
    description: desc,
    amount: Math.abs(amountSigned),
    type: norm(tx.type) === 'credit' || (norm(tx.type) !== 'debit' && amountSigned > 0) ? 'income' : 'expense',
    category,
    accountId: linkedAccountId,
    accountName: String(account.accountMarketingName || account.accountName || ''),
    date: tx.date + 'T12:00:00.000Z',
    status: norm(tx.status) === 'pending' ? 'pending' : 'completed',
    isFixed: false,
    isRecurring: false,
    isIgnored: isCardPayment,
    bankTransactionId: String(tx.id),
    source: 'pierre',
    sourceAccountId: String(account.accountId),
    createdAt: now,
    updatedAt: now,
  }};
}

async function writeInChunks(entries) {
  let batch = db.batch();
  let count = 0;
  for (const {ref, data} of entries) {
    batch.set(ref, data, { merge: true });
    count++;
    if (count === 350) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count) await batch.commit();
}

async function deleteLegacy(userRef) {
  let deleted = 0;
  for (const collectionName of COLLECTIONS) {
    const snapshot = await userRef.collection(collectionName).get();
    let batch = db.batch();
    let operations = 0;
    for (const doc of snapshot.docs) {
      if (doc.data().source === 'pierre') continue;
      batch.delete(doc.ref);
      deleted++;
      operations++;
      if (operations === 350) {
        await batch.commit();
        batch = db.batch();
        operations = 0;
      }
    }
    if (operations) await batch.commit();
  }
  return deleted;
}

exports.syncPierre = onCall({
  region: REGION,
  secrets: [pierreKey, pierreOwnerUid],
  memory: '256MiB',
  timeoutSeconds: 540,
  maxInstances: 1,
}, async (request) => {
  assertOwner(request);
  const mode = request.data?.mode;
  if (!['preview', 'import', 'cleanup'].includes(mode)) {
    throw new HttpsError('invalid-argument', 'Operação não reconhecida.');
  }
  const userRef = db.collection('users').doc(request.auth.uid);
  const integrationRef = userRef.collection('integrations').doc('pierre');

  if (mode === 'cleanup') {
    const last = (await integrationRef.get()).data();
    if (!last?.lastSyncAt || !(last.importedTransactions > 0 && last.importedAccounts > 0)) {
      throw new HttpsError('failed-precondition', 'Importe e valide os dados do Pierre antes de limpar o histórico anterior.');
    }
    if (Date.now() - Date.parse(last.lastSyncAt) > 24 * 60 * 60 * 1000) {
      throw new HttpsError('failed-precondition', 'A última importação é antiga. Sincronize novamente.');
    }
    const deleted = await deleteLegacy(userRef);
    await integrationRef.set({ lastCleanupAt: new Date().toISOString(), deletedLegacyRecords: deleted }, { merge: true });
    return { deleted, message: 'Dados anteriores removidos; somente registros de origem Pierre foram preservados.' };
  }

  const monthsInput = Number(request.data?.months);
  const months = Number.isInteger(monthsInput) ? Math.min(12, Math.max(1, monthsInput)) : 6;
  const accounts = await fetchPierre('get-accounts');
  if (!accounts.length || accounts.some((account) => !account.accountId || !account.accountType)) {
    throw new HttpsError('failed-precondition', 'Não há contas válidas disponíveis no Pierre. Nada foi alterado.');
  }

  const txById = new Map();
  for (const window of monthsWindow(months)) {
    const rows = await fetchPierre('get-transactions', { ...window, format: 'raw' });
    for (const tx of rows) {
      if (tx.id) txById.set(String(tx.id) + ':' + String(tx.account_name || '') + ':' + String(tx.account_marketing_name || ''), tx);
    }
  }
  const now = new Date().toISOString();
  const mappedAccounts = accounts.map((account) => normalizeAccount(account, now));
  const mappedTransactions = [...txById.values()].map((tx) => normalizeTransaction(tx, accounts, now));
  const transactions = mappedTransactions.filter(Boolean);
  const skipped = mappedTransactions.length - transactions.length;
  const preview = {
    accounts: mappedAccounts.filter((item) => item.collection === 'accounts').length,
    cards: mappedAccounts.filter((item) => item.collection === 'credit_cards').length,
    transactions: transactions.length,
    skipped,
    months,
  };
  if (mode === 'preview') return preview;
  if (!transactions.length) {
    throw new HttpsError('failed-precondition', 'Nenhuma transação válida encontrada. Os dados antigos foram preservados.');
  }

  // Contas recebem saldo informado pelo Pierre, nunca incrementos calculados da importação.
  await writeInChunks(mappedAccounts.map((item) => ({
    ref: userRef.collection(item.collection).doc(item.id),
    data: item.data,
  })));
  await writeInChunks(transactions.map((item) => ({
    ref: userRef.collection('transactions').doc(item.id),
    data: item.data,
  })));
  await integrationRef.set({
    provider: 'pierre',
    lastSyncAt: now,
    importedTransactions: transactions.length,
    importedAccounts: mappedAccounts.length,
    skipped,
    months,
  }, { merge: true });
  return { ...preview, syncedAt: now, message: 'Dados do Pierre importados. Confira antes de limpar os anteriores.' };
});
