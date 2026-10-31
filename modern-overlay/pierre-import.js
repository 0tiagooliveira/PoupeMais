import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js';
import { getFirestore, doc, writeBatch, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js';

const cfg = Object.freeze({
  apiKey: 'AIzaSyB8_TagbRuyEZ1puNUrn9UnyptHOOMZong',
  authDomain: 'poupe-mais-6a07f.firebaseapp.com',
  projectId: 'poupe-mais-6a07f',
  appId: '1:451102060352:web:1d9bb2a53494db04f814a5',
});
const WORKER = 'https://poup-mais.tiago336699.workers.dev';
const app = getApps()[0] || initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);
const el = id => document.getElementById(id);
const zeroCounts = () => ({accounts:0,cards:0,transactions:0,skipped:0,skippedAccounts:0});
const issues = ['missingId','missingType','unknownCurrency','otherCurrency','invalidBalance'];
let currentUser = null;
let busy = false;
let ready = null;
const status = text => { el('progress').textContent = text || ''; };
function alertMessage(text, success=false){
  const node=el('message');node.textContent=text;node.className='show'+(success?' success':'');
}
function clearMessage(){el('message').className='';el('message').textContent='';}
function dayAfter(iso){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
function monthsBefore(iso){const date=new Date(iso+'T12:00:00Z');const y=date.getUTCFullYear()-1,m=date.getUTCMonth();const max=new Date(Date.UTC(y,m+1,0)).getUTCDate();return new Date(Date.UTC(y,m,Math.min(date.getUTCDate(),max))).toISOString().slice(0,10);}
function expectedRecord(doc){return doc&&['accounts','credit_cards','transactions'].includes(doc.collection)&&typeof doc.id==='string'&&doc.id.startsWith('pierre_')&&doc.id.length<=1500&&doc.data?.source==='pierre';}
function datesValid(item,from,to){const d=String(item.data?.date||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=from&&d<=to;}

onAuthStateChanged(auth, user => {
  currentUser=user;
  el('loginState').textContent=user?'Conectado com '+(user.email||'Firebase'):'Entre com sua conta do Poupe Mais para consultar o Pierre.';
  el('logIn').hidden=!!user;
  el('read').disabled=!user||busy;
});
el('signIn').addEventListener('click',async()=>{
  clearMessage();
  try { await signInWithPopup(auth,new GoogleAuthProvider()); }
  catch (error) {
    if (['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(error?.code)) {
      await signInWithRedirect(auth,new GoogleAuthProvider());
    } else alertMessage('Não foi possível entrar com Google: '+(error?.code||'erro de login'));
  }
});

el('read').addEventListener('click',async()=>{
  if(busy||!currentUser)return;
  busy=true;ready=null;el('read').disabled=true;el('previewPanel').hidden=true;clearMessage();
  const asOf=new Date().toISOString().slice(0,10);
  const accountDocs=new Map(), txDocs=new Map(), periods=[];
  const issueCounts=Object.fromEntries(issues.map(k=>[k,0]));
  let total=null,lastTo='',rejected=0,rejectedAccounts=0,providerCount=0;
  try {
    const token=await currentUser.getIdToken();
    for(let i=0;i<(total??13);i++){
      status('Consultando período '+(i+1)+' de '+(total??13)+'...');
      const response=await fetch(WORKER+'/snapshot',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({months:12,asOf,periodIndex:i})});
      const part=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(part?.error||'A ponte Pierre não está atualizada ou a consulta falhou.');
      if(!part||!Array.isArray(part.documents)||!part.counts||!part.accountIssues||part.months!==12||part.asOf!==asOf||part.periodIndex!==i||
        !Number.isInteger(part.totalPeriods)||part.totalPeriods!==13||!Number.isInteger(part.providerCount)||
        !/^\d{4}-\d{2}-\d{2}$/.test(part.from)||!/^\d{4}-\d{2}-\d{2}$/.test(part.to)||part.from>part.to)
        throw new Error('Uma consulta mensal retornou um formato incompleto ou incompatível.');
      if(total===null){total=part.totalPeriods;if(part.from!==monthsBefore(asOf))throw new Error('O histórico não começa 12 meses atrás.');}
      if(total!==part.totalPeriods||(lastTo&&part.from!==dayAfter(lastTo)))throw new Error('Encontrada lacuna ou sobreposição entre os períodos.');
      lastTo=part.to;
      let number=0;
      for(const item of part.documents){
        if(!expectedRecord(item))throw new Error('Um registro não pôde ser validado.');
        if(item.collection==='transactions'){
          if(txDocs.has(item.id)||!datesValid(item,part.from,part.to))throw new Error('Transação repetida ou fora do mês solicitado.');
          txDocs.set(item.id,item);number++;
        }else accountDocs.set(item.collection+':'+item.id,item);
      }
      if(number+part.counts.skipped!==part.providerCount||number!==part.counts.transactions)throw new Error('Contagem de transações divergente do Pierre.');
      rejected+=part.counts.skipped;rejectedAccounts=Math.max(rejectedAccounts,part.counts.skippedAccounts||0);providerCount+=part.providerCount;
      for(const key of issues)issueCounts[key]=Math.max(issueCounts[key],part.accountIssues[key]||0);
      periods.push({from:part.from,to:part.to,count:number});
    }
    if(!total||total!==periods.length||lastTo!==asOf||txDocs.size+rejected!==providerCount)
      throw new Error('Os 12 meses não foram verificados integralmente.');
    const docs=[...accountDocs.values(),...txDocs.values()];
    const counts={...zeroCounts(), accounts:docs.filter(d=>d.collection==='accounts').length,cards:docs.filter(d=>d.collection==='credit_cards').length,transactions:txDocs.size,skipped:rejected,skippedAccounts:rejectedAccounts};
    ready={uid:currentUser.uid,asOf,docs,counts,periods,issues:issueCounts};
    renderPreview(ready);
    status('Períodos consultados: '+periods.length+'. Histórico preparado para conferência.');
  }catch(error){ready=null;status('Consulta interrompida.');alertMessage(error?.message||'Falha ao consultar o Pierre.');}
  finally{busy=false;el('read').disabled=!currentUser;}
});
function renderPreview(result){
  el('previewPanel').hidden=false;
  el('counts').replaceChildren();
  for(const [label,value] of [['Contas',result.counts.accounts],['Cartões',result.counts.cards],['Transações',result.counts.transactions],['Para revisar',result.counts.skipped+result.counts.skippedAccounts]]){
    const card=document.createElement('div');card.className='stat';const small=document.createElement('small'),strong=document.createElement('strong');
    small.textContent=label;strong.textContent=String(value);card.append(small,strong);el('counts').append(card);
  }
  el('periodRows').replaceChildren();
  for(const period of result.periods){const tr=document.createElement('tr'),date=document.createElement('td'),count=document.createElement('td');date.textContent=period.from+' a '+period.to;count.textContent=period.count+' registros';tr.append(date,count);el('periodRows').append(tr);}
  const invalid=result.counts.skipped||result.counts.skippedAccounts||!result.counts.transactions||!result.counts.accounts&&!result.counts.cards||result.docs.length>10000;
  el('warnings').textContent=invalid?'Existem registros não validados, valores ausentes ou limite de segurança excedido. Nada será importado.':'Todos os períodos foram consultados. Confira os totais do Pierre antes de importar.';
  el('import').disabled=!!invalid;
}

el('import').addEventListener('click',async()=>{
  if(busy||!ready||!currentUser||currentUser.uid!==ready.uid||el('import').disabled)return;
  busy=true;el('import').disabled=true;el('read').disabled=true;clearMessage();
  const user=doc(db,'users',currentUser.uid),meta=doc(user,'integrations','pierre');
  let committed=0;
  try{
    await setDoc(meta,{status:'importing',expectedMonths:12,asOf:ready.asOf,expectedRecords:ready.docs.length,startedAt:new Date().toISOString()},{merge:true});
    for(let i=0;i<ready.docs.length;i+=350){
      const batch=writeBatch(db);
      for(const item of ready.docs.slice(i,i+350)){
        if(!expectedRecord(item))throw new Error('Registro inválido; importação interrompida.');
        batch.set(doc(user,item.collection,item.id),item.data,{merge:true});
      }
      await batch.commit();committed+=Math.min(350,ready.docs.length-i);
      status('Gravados '+committed+' de '+ready.docs.length+' registros.');
    }
    for(let i=0;i<ready.docs.length;i++){
      const wanted=ready.docs[i],snap=await getDoc(doc(user,wanted.collection,wanted.id));
      if(!snap.exists())throw new Error('Registro não encontrado no Firestore após gravação.');
      const got=snap.data();
      for(const field of ['source','sourceAccountId','bankTransactionId','amount','date','balance','type','limit','accountId']){
        if(Object.prototype.hasOwnProperty.call(wanted.data,field)&&got[field]!==wanted.data[field])throw new Error('Valor divergente na verificação do Firestore.');
      }
      if(i%25===0)status('Verificando registros '+(i+1)+' de '+ready.docs.length+'...');
    }
    const completedAt=new Date().toISOString();
    await setDoc(meta,{status:'completed',importedMonths:12,sourcePeriods:ready.periods.length,historyFrom:ready.periods[0].from,historyTo:ready.asOf,
      importedAccounts:ready.counts.accounts+ready.counts.cards,importedTransactions:ready.counts.transactions,
      importedRecords:committed,skipped:0,periodReports:ready.periods,lastSyncAt:completedAt},{merge:true});
    status('Conferência concluída.');
    alertMessage('Importação concluída: '+ready.counts.transactions+' transações de 12 meses verificadas. Volte ao Poupe Mais para consultar o extrato.',true);
  }catch(error){
    await setDoc(meta,{status:'incomplete',failedAt:new Date().toISOString(),committedBeforeError:committed},{merge:true}).catch(()=>{});
    status('Importação interrompida.');alertMessage('A importação não foi concluída: '+(error?.message||'erro de gravação')+'. Registros já gravados podem ser conferidos e a operação pode ser repetida.');
  }finally{busy=false;el('read').disabled=!currentUser;}
});
