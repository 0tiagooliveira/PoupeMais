# Poupe Mais moderno + Pierre (12 meses)

**Status: código preparado; produção NÃO atualizada. Não confundir com dados já importados.**

## Por que esta abordagem

A página moderna publicada em setembro é um bundle diferente do frontend React da branch `main`.
Publicar novamente `npm run build` dessa branch provocou regressão visual. Uma reversão no Firebase restaurou os 222 arquivos originais.

O bundle moderno continha configuração padrão de um segundo projeto Firebase, `gen-lang-client-0689136674`. A integração Pierre foi autorizada para `poupe-mais-6a07f`. O patch abaixo altera **somente** o Firebase utilizado pelo bundle moderno para o projeto esperado, e adiciona uma página isolada para importar; não apaga nenhuma coleção.

## Arquivos

- `pierre.html` e `pierre-import.js`: UI autônoma para conferir e importar os 12 meses no Firestore, com login e leitura de volta de todos os documentos.
- `deploy-modern-pierre-rest.py`: script para Cloud Shell que usa a REST API do Firebase Hosting, lê os hashes de **todos** os arquivos da versão atual e os reaproveita. Só adiciona/atualiza 7 arquivos: index.html, app.js, dois chunks, página, JS e link de navegação.
- `../worker/src/index.js`: implementação mais recente da ponte Cloudflare que consulta o Pierre por períodos mensais.

## Ordem obrigatória

1. **Não executar** `scripts/deploy-pierre-hosting.sh` nem publicar o frontend React antigo: o comando está desabilitado por regressão de design.
2. Atualizar manualmente o código do Worker `poup-mais` na Cloudflare a partir de `worker/src/index.js`, mantendo as variáveis Secret atuais. Não inserir nenhuma chave em código ou chat.
3. Testar o Worker autenticado e confirmar que responde às chamadas com `months:12`, `asOf` e `periodIndex` com contagens por mês.
4. No Firebase Cloud Shell autenticado (e somente quando as etapas anteriores forem verificadas):
   ```sh
   git clone --depth 1 --branch feature/pierre-financial-sync-20261025 https://github.com/0tiagooliveira/PoupeMais.git pierre-poupe-recovery
   cd pierre-poupe-recovery
   python3 modern-overlay/deploy-modern-pierre-rest.py
   ```
   O primeiro comando Python é **somente diagnóstico**, sem publicação. Confirme que a versão encontrada contém pelo menos 200 arquivos, que o projeto é `poupe-mais-6a07f` e que a alteração contém exatamente sete arquivos.
5. Para publicar, somente após validação:
   ```sh
   python3 modern-overlay/deploy-modern-pierre-rest.py --publish
   ```
   O script usa a API Hosting (com token temporário do Cloud Shell), preserva o restante da versão publicada e não manipula Firestore.
6. Abrir `https://poupe-mais-6a07f.web.app/pierre.html`, autenticar na conta correta, conferir os 12 meses e executar a importação. Verificar em `/#/transactions`, `/#/credit-cards` e nas contas do painel. O status só será `completed` quando todos os documentos forem lidos de volta.

## Critérios para dizer "concluído"

- Todos os intervalos cobrindo 12 meses foram consultados no Pierre, sem sobreposição ou lacuna.
- Contagem do Pierre coincide com os documentos validados em cada período.
- Nenhuma conta/transação fica sem associação confiável ou com moeda inconclusiva.
- Os documentos são gravados com IDs estáveis e conferidos no Firestore.
- O extrato e as contas/cartões são exibidos no frontend moderno, sem erro visual ou de autenticação.
- **Se algum item falhar, a integração continua pendente.**

## Limites

A pontuação de crédito, saldos, faturas e transferências dependem do retorno real do Pierre; a API não pode fornecer dados anteriores à disponibilidade do banco. Os testes automatizados foram feitos com registros fictícios, não com suas finanças. A Cloudflare ainda exige publicação do código novo. A importação não está concluída nem executada.

## Fontes técnicas
- https://docs.pierre.finance/api-reference/rest/get-transactions
- https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.versions.files/list
- https://firebase.google.com/docs/hosting/api-deploy
