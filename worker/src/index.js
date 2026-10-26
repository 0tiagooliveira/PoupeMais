// Browser-editor compatible: Firebase RS256 JWT verification using WebCrypto only.
// This file does not import packages; it can be pasted into Cloudflare Quick Edit.
const FIREBASE_KEYS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let cachedKeys = null;
let cacheExpires = 0;

function fromBase64Url(input) {
  if (typeof input !== 'string' || !/^[A-Za-z0-9_-]+$/.test(input)) throw new Error('JWT inválido');
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getFirebaseKeys() {
  if (cachedKeys && Date.now() < cacheExpires) return cachedKeys;
  const response = await fetch(FIREBASE_KEYS, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Não foi possível validar o login Firebase.');
  const body = await response.json();
  if (!Array.isArray(body?.keys) || !body.keys.length) throw new Error('Certificados Firebase inválidos.');
  cachedKeys = body.keys;
  cacheExpires = Date.now() + 30 * 60 * 1000;
  return cachedKeys;
}

async function verifyFirebaseToken(token, projectId) {
  if (!projectId || !token || token.length > 16000) throw new Error('Login inválido.');
  const pieces = token.split('.');
  if (pieces.length !== 3) throw new Error('Token malformado');
  const header = JSON.parse(new TextDecoder().decode(fromBase64Url(pieces[0])));
  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(pieces[1])));
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || !header.kid || payload.aud !== projectId ||
      payload.iss !== 'https://securetoken.google.com/' + projectId ||
      typeof payload.sub !== 'string' || !payload.sub ||
      typeof payload.exp !== 'number' || payload.exp <= now ||
      typeof payload.iat !== 'number' || payload.iat > now ||
      typeof payload.auth_time !== 'number' || payload.auth_time > now) {
    throw new Error('Token Firebase inválido.');
  }
  const jwk = (await getFirebaseKeys()).find((key) => key.kid === header.kid &&
    key.kty === 'RSA' && (!key.alg || key.alg === 'RS256'));
  if (!jwk) throw new Error('Certificado do token Firebase não encontrado.');
  const key = await crypto.subtle.importKey('jwk', jwk, {
    name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256',
  }, false, ['verify']);
  const signatureOk = await crypto.subtle.verify('RSASSA-PKCS1-v1_5',
    key, fromBase64Url(pieces[2]), new TextEncoder().encode(pieces[0] + '.' + pieces[1]));
  if (!signatureOk) throw new Error('Assinatura do token Firebase inválida.');
  return payload;
}

// A chave do Pierre e o UID autorizado ficam apenas nos secrets do Worker.
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
    const payload = await verifyFirebaseToken(header.slice(7), env.FIREBASE_PROJECT_ID);
    if (!payload.sub || payload.sub !== env.PIERRE_OWNER_UID) {
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
  const accountCurrencies = new Map();
  const observed = new Map();
  const issues = { missingId: 0, missingType: 0, unknownCurrency: 0, otherCurrency: 0, invalidBalance: 0 };
  const validAccountIds = new Set();

  // Infer a missing account currency ONLY from unambiguously matched transaction currencies.
  // Never assume BRL merely because the user lives in Brazil.
  for (const tx of transactions) {
    const account = resolveAccount(tx, accounts);
    const currency = String(tx.currency_code ?? tx.currencyCode ?? '').trim().toUpperCase();
    if (!account || !account.accountId || !currency) continue;
    const key = String(account.accountId);
    if (!observed.has(key)) observed.set(key, new Set());
    observed.get(key).add(currency);
  }

  for (const account of accounts) {
    if (!account || account.accountId === null || account.accountId === undefined ||
        String(account.accountId).trim() === '') {
      issues.missingId++;
      continue;
    }
    if (!account.accountType || !String(account.accountType).trim()) {
      issues.missingType++;
      continue;
    }
    const accountId = String(account.accountId);
    const rawCurrency = account.accountCurrencyCode ?? account.currencyCode ?? account.currency_code;
    let currency = rawCurrency == null ? '' : String(rawCurrency).trim().toUpperCase();
    if (!currency && observed.get(accountId)?.size === 1) {
      currency = [...observed.get(accountId)][0];
    }
    if (!currency) {
      issues.unknownCurrency++;
      continue;
    }
    if (currency !== 'BRL') {
      issues.otherCurrency++;
      continue;
    }
    const balanceValue = account.accountBalance;
    const parsedBalance = Number(balanceValue);
    if (balanceValue == null || balanceValue === '' || !Number.isFinite(parsedBalance)) {
      issues.invalidBalance++;
      continue;
    }
    validAccountIds.add(accountId);
    accountCurrencies.set(accountId, currency);
    const isCard = normalized(account.accountType) === 'credit';
    const collection = isCard ? 'credit_cards' : 'accounts';
    const id = idFor(isCard ? 'card' : 'account', accountId);
    const name = String(account.accountMarketingName || account.accountName ||
      (isCard ? 'Cartão Pierre' : 'Conta Pierre')).slice(0, 120);
    const common = { name, color: '#16a34a', source: 'pierre',
      sourceAccountId: accountId, currency, createdAt: now, updatedAt: now };
    const data = isCard
      ? { ...common, limit: Number(account.creditData?.creditLimit) || 0,
        closingDay: dateDay(account.creditData?.balanceCloseDate, 1),
        dueDay: dateDay(account.creditData?.balanceDueDate, 10) }
      : { ...common, type: String(account.accountSubtype || account.accountType),
        balance: parsedBalance, initialBalance: 0 };
    docs.push({ collection, id, data });
  }

  const seen = new Set();
  let skipped = 0;
  for (const transaction of transactions) {
    const account = resolveAccount(transaction, accounts);
    const date = String(transaction.date || '');
    const amount = Number(transaction.amount);
    const accountId = account?.accountId == null ? '' : String(account.accountId);
    const currency = String(
      transaction.currency_code ?? transaction.currencyCode ?? accountCurrencies.get(accountId) ?? ''
    ).trim().toUpperCase();
    if (!account || !validAccountIds.has(accountId) || !transaction.id ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount) || currency !== 'BRL') {
      skipped++;
      continue;
    }
    const id = idFor('transaction', accountId + ':' + String(transaction.id));
    if (id.length > 1000 || seen.has(id)) {
      skipped++;
      continue;
    }
    const card = normalized(account.accountType) === 'credit';
    const description = String(transaction.description || 'Movimentação Pierre').slice(0, 400);
    const category = String(transaction.category || 'Sem categoria').slice(0, 120);
    const kind = normalized(transaction.type);
    if (kind !== 'debit' && kind !== 'credit') {
      skipped++;
      continue;
    }
    seen.add(id);
    const text = normalized(description + ' ' + category);
    docs.push({ collection: 'transactions', id, data: {
      description, category, amount: Math.abs(amount),
      type: kind === 'credit' ? 'income' : 'expense',
      status: normalized(transaction.status) === 'pending' ? 'pending' : 'completed',
      accountId: idFor(card ? 'card' : 'account', accountId),
      accountName: String(account.accountMarketingName || account.accountName || ''),
      date: date + 'T12:00:00.000Z',
      isFixed: false, isRecurring: false,
      isIgnored: !card && text.includes('pagamento') && text.includes('fatura'),
      bankTransactionId: String(transaction.id),
      source: 'pierre', sourceAccountId: accountId,
      createdAt: now, updatedAt: now,
    }});
  }
  const skippedAccounts = Object.values(issues).reduce((total, count) => total + count, 0);
  const counts = {
    accounts: docs.filter((item) => item.collection === 'accounts').length,
    cards: docs.filter((item) => item.collection === 'credit_cards').length,
    transactions: docs.filter((item) => item.collection === 'transactions').length,
    skipped,
    skippedAccounts,
  };
  // Only aggregate validation results leave the Worker. Never log personal transactions, credentials,
  // raw balances, descriptions, account IDs or financial institution names.
  return { counts, accountIssues: issues, documents: docs, fetchedAt: now };
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
