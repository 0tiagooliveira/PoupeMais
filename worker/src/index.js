import { createRemoteJWKSet, jwtVerify } from 'jose';

// A chave do Pierre e o UID autorizado ficam apenas nos secrets do Worker.
const JWKS = createRemoteJWKSet(new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
));
const PIERRE = 'https://www.pierre.finance/tools/api';
const ORIGINS = new Set([
  'https://poupe-mais-6a07f.web.app',
  'https://poupe-mais-6a07f.firebaseapp.com',
  'http://localhost:3000',
]);
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
const normalized = (value) =>
  String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const idFor = (prefix, raw) =>
  'pierre_' + prefix + '_' + encodeURIComponent(String(raw)).replace(/\./g, '%2E');
const fmt = (date) => date.toISOString().slice(0, 10);
const dateDay = (value, fallback) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
  ? Number(String(value).slice(8, 10))
  : fallback;

function resolveAccount(transaction, accounts) {
  if (transaction.account_id || transaction.accountId) {
    const match = accounts.find((account) =>
      String(account.accountId) === String(transaction.account_id || transaction.accountId));
    if (match) return match;
  }
  const candidates = accounts.filter((account) =>
    normalized(account.accountType) === normalized(transaction.account_type));
  let matches = candidates.filter((account) =>
    normalized(account.accountName) === normalized(transaction.account_name) &&
    normalized(account.accountMarketingName) === normalized(transaction.account_marketing_name));
  if (matches.length === 1) return matches[0];
  if (transaction.account_marketing_name) {
    matches = candidates.filter((account) =>
      normalized(account.accountMarketingName) === normalized(transaction.account_marketing_name));
    if (matches.length === 1) return matches[0];
  }
  if (transaction.account_name) {
    matches = candidates.filter((account) =>
      normalized(account.accountName) === normalized(transaction.account_name));
    if (matches.length === 1) return matches[0];
  }
  return null;
}

async function getPierre(env, endpoint, params = {}) {
  const url = new URL(PIERRE + '/' + endpoint);
  for (const [key, val] of Object.entries(params)) url.searchParams.set(key, String(val));
  let response;
  try {
    response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + env.PIERRE_API_KEY, Accept: 'application/json' },
      signal: AbortSignal.timeout(45000),
    });
  } catch (_) {
    throw new Error('Não foi possível consultar o Pierre.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('Pierre recusou a chave. Confira sua validade e assinatura.');
  }
  if (response.status === 429) throw new Error('Pierre limitou temporariamente as consultas.');
  if (!response.ok) throw new Error('Pierre indisponível no momento.');
  const body = await response.json().catch(() => null);
  if (!body || body.success !== true || !Array.isArray(body.data)) {
    throw new Error('Pierre retornou dados em um formato inesperado.');
  }
  return body.data;
}

async function authorize(request, env) {
  if (!env.PIERRE_OWNER_UID || !env.PIERRE_API_KEY) {
    throw Object.assign(new Error('Segredos do Worker ainda não configurados.'), { status: 503 });
  }
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) {
    throw Object.assign(new Error('Faça login no Poupe Mais.'), { status: 401 });
  }
  try {
    const { payload, protectedHeader } = await jwtVerify(header.slice(7), JWKS, {
      algorithms: ['RS256'],
      audience: env.FIREBASE_PROJECT_ID,
      issuer: 'https://securetoken.google.com/' + env.FIREBASE_PROJECT_ID,
    });
    if (protectedHeader.alg !== 'RS256' || !payload.sub || payload.sub !== env.PIERRE_OWNER_UID) {
      throw new Error('Conta não autorizada');
    }
    const authTime = Number(payload.auth_time);
    if (!Number.isFinite(authTime) || authTime > Math.floor(Date.now() / 1000)) {
      throw new Error('Token Firebase inválido');
    }
  } catch (_) {
    throw Object.assign(new Error('Conta não autorizada para esta integração.'), { status: 403 });
  }
}

function buildSnapshot(accounts, transactions) {
  const now = new Date().toISOString();
  const docs = [];
  for (const account of accounts) {
    if (!account.accountId || !account.accountType || account.accountCurrencyCode !== 'BRL') {
      throw new Error('O Pierre retornou uma conta incompleta ou em outra moeda.');
    }
    const isCard = normalized(account.accountType) === 'credit';
    const collection = isCard ? 'credit_cards' : 'accounts';
    const id = idFor(isCard ? 'card' : 'account', account.accountId);
    const name = String(account.accountMarketingName || account.accountName || 'Conta Pierre').slice(0, 120);
    const common = { name, color: '#16a34a', source: 'pierre',
      sourceAccountId: String(account.accountId), createdAt: now, updatedAt: now };
    const data = isCard
      ? { ...common, limit: Number(account.creditData?.creditLimit) || 0,
        closingDay: dateDay(account.creditData?.balanceCloseDate, 1),
        dueDay: dateDay(account.creditData?.balanceDueDate, 10) }
      : { ...common, type: String(account.accountSubtype || account.accountType),
        balance: Number(account.accountBalance) || 0, initialBalance: 0 };
    docs.push({ collection, id, data });
  }

  const seen = new Set();
  let skipped = 0;
  for (const transaction of transactions) {
    const account = resolveAccount(transaction, accounts);
    const date = String(transaction.date || '');
    const amount = Number(transaction.amount);
    const currency = String(transaction.currency_code || '');
    if (!account || !transaction.id || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(amount) || currency !== 'BRL') {
      skipped++;
      continue;
    }
    const id = idFor('transaction', String(account.accountId) + ':' + String(transaction.id));
    if (id.length > 1000 || seen.has(id)) {
      skipped++;
      continue;
    }
    seen.add(id);
    const card = normalized(account.accountType) === 'credit';
    const description = String(transaction.description || 'Movimentação Pierre').slice(0, 400);
    const category = String(transaction.category || 'Sem categoria').slice(0, 120);
    const kind = normalized(transaction.type);
    if (kind !== 'debit' && kind !== 'credit') {
      skipped++;
      continue;
    }
    const text = normalized(description + ' ' + category);
    docs.push({ collection: 'transactions', id, data: {
      description, category, amount: Math.abs(amount),
      type: kind === 'credit' ? 'income' : 'expense',
      status: normalized(transaction.status) === 'pending' ? 'pending' : 'completed',
      accountId: idFor(card ? 'card' : 'account', account.accountId),
      accountName: String(account.accountMarketingName || account.accountName || ''),
      date: date + 'T12:00:00.000Z',
      isFixed: false, isRecurring: false,
      isIgnored: !card && text.includes('pagamento') && text.includes('fatura'),
      bankTransactionId: String(transaction.id),
      source: 'pierre', sourceAccountId: String(account.accountId),
      createdAt: now, updatedAt: now,
    }});
  }
  const counts = {
    accounts: docs.filter((item) => item.collection === 'accounts').length,
    cards: docs.filter((item) => item.collection === 'credit_cards').length,
    transactions: docs.filter((item) => item.collection === 'transactions').length,
    skipped,
  };
  return { counts, documents: docs, fetchedAt: now };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = origin && ORIGINS.has(origin);
    const cors = allowed ? {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    } : {};
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/snapshot') {
      return json({ error: 'Endpoint não encontrado.' }, 404, cors);
    }
    if (!allowed) return json({ error: 'Origem não autorizada.' }, 403, cors);
    try {
      await authorize(request, env);
      const payload = await request.json().catch(() => ({}));
      const months = Number(payload.months);
      if (![3, 6, 12].includes(months)) return json({ error: 'Período inválido.' }, 400, cors);
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
      const [accounts, transactions] = await Promise.all([
        getPierre(env, 'get-accounts'),
        getPierre(env, 'get-transactions', { startDate: fmt(start), endDate: fmt(now), format: 'raw' }),
      ]);
      if (!accounts.length) throw new Error('O Pierre não retornou contas válidas.');
      if (transactions.length > 15000) throw new Error('Histórico muito grande para esta importação. Selecione um período menor.');
      return json({ ...buildSnapshot(accounts, transactions), months }, 200, cors);
    } catch (error) {
      return json({ error: error?.message || 'Não foi possível obter os dados do Pierre.' },
        error?.status || 502, cors);
    }
  },
};
