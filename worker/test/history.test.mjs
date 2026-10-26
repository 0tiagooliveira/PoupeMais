import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSnapshot, periodWindows } from '../src/index.js';

test('rolling year has no uncovered days or duplicate days', () => {
  const dates = [new Date().toISOString().slice(0,10)];
  for (const asOf of dates) {
    const windows = periodWindows(asOf);
    assert.ok(windows);
    assert.ok(windows.length >= 12 && windows.length <= 14);
    assert.equal(windows[windows.length - 1].to, asOf);
    for (let i = 1; i < windows.length; i++) {
      const before = new Date(windows[i - 1].to + 'T12:00:00Z');
      before.setUTCDate(before.getUTCDate() + 1);
      assert.equal(windows[i].from, before.toISOString().slice(0, 10));
    }
  }
});

test('valid bank account and card can be normalized with BRL', () => {
  const accounts = [
    {accountId:'account-1',accountType:'BANK',accountName:'Corrente',accountMarketingName:'Conta X',
     accountBalance:1250.50,accountCurrencyCode:'BRL'},
    {accountId:'card-1',accountType:'CREDIT',accountName:'Crédito',accountMarketingName:'Cartão Y',
     accountCurrencyCode:'BRL',creditData:{creditLimit:5000}}
  ];
  const transactions = [
    {id:'txn-1',account_type:'BANK',account_name:'Corrente',account_marketing_name:'Conta X',
     amount:-50,date:'2026-01-15',type:'DEBIT',currency_code:'BRL'},
    {id:'txn-2',account_type:'CREDIT',account_name:'Crédito',account_marketing_name:'Cartão Y',
     amount:-79,date:'2026-01-16',type:'DEBIT',currency_code:'BRL'}
  ];
  const snapshot = buildSnapshot(accounts, transactions);
  assert.equal(snapshot.counts.accounts,1);
  assert.equal(snapshot.counts.cards,1);
  assert.equal(snapshot.counts.transactions,2);
  assert.equal(snapshot.counts.skipped,0);
  assert.equal(snapshot.counts.skippedAccounts,0);
  assert.equal(snapshot.documents.find(x=>x.collection==='accounts').data.balance,1250.50);
});

test('unverified currencies never silently become BRL', () => {
  const accounts = [{accountId:'1',accountType:'BANK',accountName:'Banco',accountBalance:100}];
  const result = buildSnapshot(accounts,[]);
  assert.equal(result.counts.accounts,0);
  assert.equal(result.counts.skippedAccounts,1);
  assert.equal(result.accountIssues.unknownCurrency,1);
});

test('ambiguous transaction account link blocks unverified record', () => {
  const accounts = [
    {accountId:'1',accountType:'BANK',accountName:'Corrente',accountMarketingName:'Mesmo nome',accountBalance:100,accountCurrencyCode:'BRL'},
    {accountId:'2',accountType:'BANK',accountName:'Corrente',accountMarketingName:'Mesmo nome',accountBalance:200,accountCurrencyCode:'BRL'},
  ];
  const tx = [{id:'x',account_type:'BANK',account_name:'Corrente',
    account_marketing_name:'Mesmo nome',currency_code:'BRL',
    date:'2026-02-15',amount:-10,type:'DEBIT'}];
  const snapshot=buildSnapshot(accounts,tx);
  assert.equal(snapshot.counts.skipped,1);
  assert.equal(snapshot.counts.transactions,0);
});
