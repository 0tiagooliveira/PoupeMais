# Pierre → Poupe Mais com Firebase Spark gratuito

## Situação

**Código preparado, NÃO implantado.** Esta versão não usa Firebase Functions nem exige upgrade do projeto Firebase.
A ponte roda em **Cloudflare Workers (plano Free)** e utiliza o login Firebase do usuário. A chave do Pierre não vai para o GitHub nem para o navegador.

### Fluxo de dados

1. O usuário faz login no Poupe Mais e abre Configurações → Integração Pierre.
2. O frontend envia seu Firebase ID token para o Worker via HTTPS.
3. O Worker valida a assinatura do JWT com chaves públicas oficiais do Firebase, a audiência, o emissor e o UID autorizado.
4. O Worker usa um segredo privado `PIERRE_API_KEY` para consultar `get-accounts` e `get-transactions` em `format=raw`.
5. O Worker normaliza dados e retorna ao usuário autenticado. Nenhum segredo é retornado.
6. Uma prévia mostra contagens e registros não associados. Após confirmação, o frontend grava dados no Firestore usando o token normal do usuário e as **Firestore Security Rules existentes**.

**Sem limpeza automática.** Não apagar registros antigos antes de conferir que a importação está correta.
IDs gerados têm prefixo `pierre_`, e um segundo processamento grava os mesmos documentos sem duplicações.

## Ativação (uma vez)

1. Criar uma conta grátis em https://dash.cloudflare.com/ e escolher Workers & Pages → Create Worker.
2. A partir de um computador com Node.js e acesso ao repositório nesta branch (a CLI é o caminho recomendado):
    ```sh
    cd worker
    npm install
    npx wrangler login
    npx wrangler secret put PIERRE_API_KEY
    npx wrangler secret put PIERRE_OWNER_UID
    npx wrangler deploy
    ```
   - `PIERRE_API_KEY`: **nova** chave do Pierre, gerada após revogar a antiga chave exposta na conversa.
   - `PIERRE_OWNER_UID`: UID do usuário no Firebase Authentication, localizado em Firebase Console → Authentication → Usuários. **Não confundir com e-mail.**
   - Os valores são inseridos no prompt do Wrangler, não em arquivos rastreados.
3. Copiar a URL HTTPS do Worker publicada, por exemplo `https://<nome>.<conta>.workers.dev`.
4. No frontend configurar `VITE_PIERRE_WORKER_URL` com a URL do Worker; rebuild e deploy SOMENTE do Hosting.
    ```sh
    VITE_PIERRE_WORKER_URL="https://SEU-WORKER.workers.dev" npm run build
    firebase deploy --only hosting --project poupe-mais-6a07f
    ```
5. Conferir a prévia, validar saldos e amostra de transações e **somente então confirmar importação**.

Para ambientes Windows/PowerShell, use um arquivo `.env.local` não versionado com `VITE_PIERRE_WORKER_URL=...` e execute `npm run build` normalmente.

## Segurança e limites

- Worker aceita solicitações apenas de `poupe-mais-6a07f.web.app`, `poupe-mais-6a07f.firebaseapp.com` e `localhost:3000`, mas a autenticação por JWT e a validação do UID são a proteção real.
- Não usar `VITE_PIERRE_API_KEY`, variáveis no frontend ou autenticação apenas por CORS.
- Cloudflare Free atualmente possui limite de 100 mil requests/dia e 10 ms de CPU por requisição. Uma importação grande pode ultrapassar os limites: começar com 3 meses e conferir os resultados.
- O Firebase Spark mantém suas cotas de Firestore. Mais de 10 mil documentos na prévia bloqueiam a importação nesta UI para diminuir risco de consumo excessivo.
- Contas do tipo CREDIT são cartões; BANK, INVESTMENT e LOAN são contas no layout existente.
- A API do Pierre atualmente não apresenta `accountId` para cada transação no exemplo `raw`. Quando o vínculo não é inequívoco, a transação é ignorada na prévia e **a importação inteira é bloqueada**.
- O módulo atual ainda não importa faturas em aberto como entidades próprias, nem cobre investimentos detalhadamente. Conferir débitos de fatura e transferências para evitar dupla contagem.
- O Firebase Hosting usa `dist` e continua no plano Spark; `firebase.json` permanece sem Functions.
- O backend **não foi testado com a chave real** e requer verificação em ambiente de teste antes do deploy final.

Documentação: 
- Pierre API: https://docs.pierre.finance/api-reference/rest/get-accounts e https://docs.pierre.finance/api-reference/rest/get-transactions
- Cloudflare Workers secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Firebase ID token verification: https://firebase.google.com/docs/auth/admin/verify-id-tokens
