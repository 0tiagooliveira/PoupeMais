#!/usr/bin/env python3
"""Patch Firebase Hosting without rebuilding/deleting the deployed modern frontend.

Default operation is READ-ONLY. --publish is an explicit opt-in action. Never touches
Firestore, authentication, Cloudflare secrets, or the user's financial records.
Uses the Firebase Hosting REST API's version-file hashes to preserve all existing files.
"""
import argparse
import gzip
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

SITE='poupe-mais-6a07f'
API='https://firebasehosting.googleapis.com/v1beta1'
WEB='https://'+SITE+'.web.app'
HERE=pathlib.Path(__file__).resolve().parent

class APIError(Exception): pass

def access_token():
    try:
        p=subprocess.run(['gcloud','auth','print-access-token'],text=True,capture_output=True,timeout=20,check=True)
    except Exception as e:
        raise APIError('Cloud Shell não autenticado: confira gcloud auth e o projeto Firebase.') from e
    token=p.stdout.strip()
    if not token:raise APIError('Token de acesso vazio')
    return token

def call(token, method, path, payload=None, binary=None):
    if path.startswith('http://') or path.startswith('https://'):
        url=path
    else:url=API+path
    headers={'Authorization':'Bearer '+token,'User-Agent':'PoupeMaisPierreSafePatch/1.0'}
    data=None
    if payload is not None:
        data=json.dumps(payload).encode('utf-8')
        headers['Content-Type']='application/json'
    if binary is not None:
        data=binary;headers['Content-Type']='application/octet-stream'
    if method in ('POST','PATCH') and data is None:data=b''
    req=urllib.request.Request(url,data=data,method=method,headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=35) as response:
            raw=response.read(5000000)
    except urllib.error.HTTPError as e:
        # Do not print response bodies, which may include credentials or project details.
        raise APIError(f'Firebase API recusou {method} {urllib.parse.urlparse(url).path}: HTTP {e.code}') from None
    except Exception as e:
        raise APIError(f'Falha de conexão ao Firebase: {type(e).__name__}') from e
    if raw and ('/files/' not in url or 'upload' not in url):
        try:return json.loads(raw)
        except json.JSONDecodeError:raise APIError('Resposta não JSON da Firebase API')
    return {}

def public(path):
    url=WEB+path
    req=urllib.request.Request(url,headers={'User-Agent':'PoupeMaisSafePatch/1.0','Cache-Control':'no-cache'})
    try:
        with urllib.request.urlopen(req,timeout=25) as r:
            data=r.read(1000000)
            ct=r.headers.get('content-type','')
    except Exception as e:
        raise APIError('Não foi possível consultar o arquivo público '+path) from e
    if 'text/html' in ct.lower() and path!='/index.html':
        raise APIError('Arquivo público esperado retornou HTML: '+path)
    return data

def replace_once(data, before, after, label):
    if data.count(before)!=1:
        raise APIError('Assinatura inesperada no site moderno: '+label)
    return data.replace(before,after,1)

def clean_existing_page_scripts(index):
    """Keep modern navigation singular and remove an obsolete duplicate only if bytes match."""
    nav_count = len(re.findall(r'<script\\b[^>]*\\bsrc=["\\\']/?pierre-nav\\.js["\\\']', index, re.I))
    if nav_count > 1:
        raise APIError('A versão atual já tem scripts de navegação duplicados; revisar antes de publicar.')
    if nav_count == 0:
        index = replace_once(index, '</body>',
                             '<script defer src="/pierre-nav.js"></script></body>', 'HTML principal')
    old = 'pierre-insights.js?v=20261030-4'
    new = 'pierre-insights.js?v=20261030-5'
    if old in index and new in index:
        if public('/pierre-insights.js?v=20261030-4') != public('/pierre-insights.js?v=20261030-5'):
            raise APIError('As duas versões de insights diferem. Não remover o script antigo automaticamente.')
        pattern = r'<script\\b[^>]*\\bsrc=["\\\']/?pierre-insights\\.js\\?v=20261030-4["\\\'][^>]*>\\s*</script>'
        index, removed = re.subn(pattern, '', index, flags=re.I)
        if removed != 1:
            raise APIError('Não foi possível remover com segurança o script de insights duplicado.')
    return index


def changes():
    index=public('/index.html').decode('utf-8')
    script=public('/assets/app.js?v=20260913-5').decode('utf-8')
    transactions=public('/assets/chunks/chunk-ZRRIDQRF.js').decode('utf-8')
    modern_firebase=public('/assets/chunks/chunk-GX4UVSAK.js').decode('utf-8')
    if '/assets/app.js?v=20260913-5' not in index or 'Poup+' not in index:
        raise APIError('O site público não é a versão moderna esperada. Abortando.')
    index=clean_existing_page_scripts(index)
    script=replace_once(script,
        'y=i.docs.map(d=>{let S=d.data(),p={id:d.id,...S},z=',
        'y=i.docs.map(d=>{let S=d.data();if(S.source==="pierre")return{doc:d,transaction:{id:d.id,...S},patch:null};let p={id:d.id,...S},z=',
        'revisão automática de saldos')
    transactions=replace_once(transactions,
        's=u.filter(r=>!(r.type!=="expense"||!r.description||!x(r.description)||N.current.has(r.id)));',
        's=u.filter(r=>!(r.source==="pierre"||r.type!=="expense"||!r.description||!x(r.description)||N.current.has(r.id)));',
        'classificação de transações')
    transactions=replace_once(transactions,
        'if(g.type!=="expense"||!g.description||!x(g.description))return;',
        'if(g.source==="pierre"||g.type!=="expense"||!g.description||!x(g.description))return;',
        'proteção de saldo de conta')
    # The restored modern UI used a different Firebase project as its bundled default.
    # Repoint it to the owner's known Poupe Mais Firebase project. We change no data;
    # this prevents the Pierre import from going to an unrelated database.
    firebase_swaps = [
        ('AIzaSyCnDH_HX1Z7MRPuVITRF-4zEeoUP7i-CPY', 'AIzaSyB8_TagbRuyEZ1puNUrn9UnyptHOOMZong', 1),
        ('gen-lang-client-0689136674', 'poupe-mais-6a07f', 3),
        ('54360289428', '451102060352', 2),
        ('1:54360289428:web:39dc880705c77a9de90481', '1:451102060352:web:1d9bb2a53494db04f814a5', 1),
    ]
    # Replace the appId first so that the messaging sender replacement does not change its signature.
    for original, updated, count in [firebase_swaps[3], firebase_swaps[0], firebase_swaps[1],
                                     ('messagingSenderId:Ra.VITE_FIREBASE_MESSAGING_SENDER_ID||"54360289428"',
                                      'messagingSenderId:Ra.VITE_FIREBASE_MESSAGING_SENDER_ID||"451102060352"', 1)]:
        if modern_firebase.count(original) != count:
            raise APIError('O frontend público usa uma configuração Firebase inesperada. Não publicar.')
        modern_firebase=modern_firebase.replace(original,updated)
    navigation=r'''(()=>{function mount(){const path=location.hash||'';let link=document.getElementById('pierre-action-link');const show=/^#\/(?:settings|connected-banks)(?:\/|$|\?)/.test(path);if(!show){link?.remove();return}if(!link){link=document.createElement('a');link.id='pierre-action-link';link.href='/pierre.html';link.textContent='Importar Pierre';link.setAttribute('aria-label','Importar 12 meses do Pierre');Object.assign(link.style,{position:'fixed',right:'16px',bottom:'92px',padding:'12px 16px',borderRadius:'15px',background:'var(--primary,#16a34a)',color:'var(--on-primary,#fff)',font:'700 13px system-ui',zIndex:'110',boxShadow:'0 6px 24px #0002',textDecoration:'none'});document.body.appendChild(link)}}window.addEventListener('hashchange',mount);document.addEventListener('DOMContentLoaded',mount);mount()})();'''
    return {
        '/index.html':index.encode(),
        '/assets/app.js':script.encode(),
        '/assets/chunks/chunk-ZRRIDQRF.js':transactions.encode(),
        '/assets/chunks/chunk-GX4UVSAK.js':modern_firebase.encode(),
        '/pierre.html':(HERE/'pierre.html').read_bytes(),
        '/pierre-import.js':(HERE/'pierre-import.js').read_bytes(),
        '/pierre-nav.js':navigation.encode(),
    }

def list_files(token, version):
    paths={}; page=None
    while True:
        query='?pageSize=1000&status=ACTIVE'+('&pageToken='+urllib.parse.quote(page) if page else '')
        response=call(token,'GET','/'+version+'/files'+query)
        for f in response.get('files',[]):
            path=f.get('path'); digest=f.get('hash')
            if path and digest:paths[path]=digest
        page=response.get('nextPageToken')
        if not page:break
    return paths

def main():
    p=argparse.ArgumentParser(description='Poup+ Pierre patch preserving all existing hosting files')
    p.add_argument('--publish',action='store_true',help='Create and release new Hosting version (performs write)')
    args=p.parse_args()
    print('Projeto:',SITE,'| Modo:',('PUBLICAÇÃO' if args.publish else 'LEITURA/APURAÇÃO'))
    token=access_token()
    releases=call(token,'GET',f'/sites/{SITE}/releases?pageSize=2').get('releases',[])
    if not releases:raise APIError('Nenhuma versão publicada no Firebase Hosting')
    version=releases[0].get('version',{}).get('name','')
    if not version.startswith(f'sites/{SITE}/versions/'):
        raise APIError('O Firebase retornou uma versão desconhecida')
    original=call(token,'GET','/'+version)
    files=list_files(token,version)
    if len(files)<200 or '/index.html' not in files or '/assets/app.js' not in files:
        raise APIError('A versão atual não preserva os 222 arquivos do design moderno. Abortando.')
    patch=changes()
    compressed={}
    updated=dict(files)
    for name,source in patch.items():
        blob=gzip.compress(source,compresslevel=9,mtime=0)
        digest=hashlib.sha256(blob).hexdigest()
        updated[name]=digest
        compressed[digest]=blob
    print('Versão base:',version,'| Arquivos preservados:',len(files),'| Arquivos adicionados/modificados:',len(patch))
    print('Resultado:',len(updated),'arquivos; nenhuma informação bancária acessada.')
    if not args.publish:
        print('DIAGNÓSTICO concluído. Nenhum deploy foi feito. Para publicar, execute novamente com --publish após conferir a versão.')
        return
    # Fail closed if the live version changed during the review.
    again=call(token,'GET',f'/sites/{SITE}/releases?pageSize=1').get('releases',[])
    if not again or again[0].get('version',{}).get('name')!=version:
        raise APIError('A versão do site mudou durante a operação. Não publicar.')
    conf=original.get('config')
    if not isinstance(conf,dict):raise APIError('Configuração de Hosting ausente; abortando.')
    new=call(token,'POST',f'/sites/{SITE}/versions',{'config':conf})
    newname=new.get('name','')
    if not newname.startswith(f'sites/{SITE}/versions/'):
        raise APIError('Nova versão não retornou identificação válida')
    response=call(token,'POST','/'+newname+':populateFiles',{'files':updated})
    needed=response.get('uploadRequiredHashes',[])
    if any(digest not in compressed for digest in needed):
        raise APIError('O Firebase exige um arquivo antigo não disponível. Nova versão não será lançada.')
    upload=response.get('uploadUrl','')
    if not upload.startswith('https://upload-firebasehosting.googleapis.com/'):
        raise APIError('URL de upload inesperada; abortando.')
    for idx,digest in enumerate(needed):
        print('Enviando arquivo alterado',idx+1,'de',len(needed))
        call(token,'POST',upload+'/'+digest,binary=compressed[digest])
    call(token,'PATCH','/'+newname+'?update_mask=status',{'status':'FINALIZED'})
    call(token,'POST',f'/sites/{SITE}/releases?versionName='+urllib.parse.quote(newname,safe=''))
    print('Publicação concluída sem substituir o design: https://'+SITE+'.web.app/pierre.html')

if __name__=='__main__':
    try:main()
    except APIError as e:
        print('ERRO:',e,file=sys.stderr)
        sys.exit(1)