# 🚀 Configuração GitHub Actions + Firebase

Este guia te ajudará a configurar o deploy automático do **Poupe Mais** usando GitHub Actions e Firebase.

## 📋 Pré-requisitos

- Projeto criado no [Firebase Console](https://console.firebase.google.com/)
- Repositório no GitHub
- Firebase CLI instalado: `npm install -g firebase-tools`

## 🔧 Configuração Passo a Passo

### 1. Configurar Firebase Project

```bash
# Login no Firebase
firebase login

# Inicializar projeto (se ainda não fez)
firebase init

# Obter Project ID
firebase projects:list
```

### 2. Criar Service Account do Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Vá em **Configurações do Projeto** > **Contas de Serviço**
3. Clique em **Gerar nova chave privada**
4. Baixe o arquivo JSON (⚠️ **NUNCA commite esse arquivo!**)

### 3. Configurar Secrets no GitHub

No seu repositório GitHub, vá em **Settings** > **Secrets and variables** > **Actions**

Adicione estes secrets:

| Nome do Secret | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Todo o conteúdo do arquivo JSON da service account |
| `FIREBASE_PROJECT_ID` | ID do seu projeto Firebase |

### 4. Como obter as informações:

#### FIREBASE_PROJECT_ID:
```bash
firebase projects:list
```

#### FIREBASE_SERVICE_ACCOUNT:
- Copie **todo** o conteúdo do arquivo JSON baixado
- Cole completo no secret (incluindo as chaves `{}`)

## 🎯 Como Funciona

### Deploy Automático (Branch Main)
- ✅ Push na branch `main` = Deploy para produção
- ✅ Build automático
- ✅ Deploy para Firebase Hosting

### Preview de PRs  
- 🔍 Pull Requests = Preview temporário
- 🔗 URL única para testar mudanças
- 🗑️ Removido automaticamente após merge

## 📦 Comandos Úteis

```bash
# Deploy manual local
npm run build
firebase deploy

# Ver status do projeto
firebase projects:list
firebase hosting:sites:list

# Ver logs do Firebase
firebase functions:log
```

## 🔍 Verificar Deploy

Após fazer push para `main`, você pode:

1. Ver o workflow rodando em: **Actions** tab do GitHub
2. Acessar o site em: `https://[PROJECT-ID].web.app`
3. Ver logs no Firebase Console

## ⚠️ Troubleshooting

### Erro de Permissão
- Verifique se a service account tem permissões de **Editor** ou **Firebase Admin**

### Build Falha
- Verifique se o `npm run build` funciona localmente
- Confirme que todas as dependências estão no `package.json`

### Deploy Falha
- Confirme se o `FIREBASE_PROJECT_ID` está correto
- Verifique se a service account JSON está completa

## 🎉 Pronto!

Agora toda vez que você fizer push para `main`, o deploy será automático! 

Para fazer deploy:
1. `git add .`
2. `git commit -m "sua mensagem"`  
3. `git push origin main`
4. ✨ **Deploy automático happening!**