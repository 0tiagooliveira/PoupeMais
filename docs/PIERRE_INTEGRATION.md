# Integração Pierre → Poupe Mais

Status: **implementação preparada em branch de desenvolvimento; NÃO implantada**.

A função `syncPierre` é uma Firebase callable Function em `southamerica-east1`.
O frontend fica em `Configurações > Integração Pierre` na conta autorizada.
A chave do Pierre **nunca deve ir para o frontend, variáveis VITE_, Firestore ou GitHub**.

## Dados e comportamento

- `preview`: consulta contas e até 12 meses de transações, não altera o Firestore.
- `import`: grava contas, cartões e transações com IDs estáveis; não apaga automaticamente lançamentos antigos.
- `cleanup`: disponível somente no backend, exige uma importação recente concluída; elimina registros sem `source: pierre` apenas das coleções `transactions`, `accounts` e `credit_cards`. **Não usar sem backup.**
- A conta de login Firebase Auth não é eliminada nem modificada.
- Saldos das contas vêm de `accountBalance` da API, sem incrementos na importação.
- Pagamentos de fatura identificados são marcados como ignorados nos relatórios para reduzir dupla contagem. Conferir manualmente.
- Transações sem associação inequívoca de conta, sem ID, em moedas diferentes de BRL ou com dados inválidos bloqueiam a importação.
- Os dados do Pierre podem demorar a refletir mudanças nos bancos; o timestamp da importação não representa o momento de atualização do banco.

## Preparação para implantação (administrador)

1. **Revogar** qualquer chave previamente compartilhada, gerar uma nova no Pierre e não colá-la em chats ou repositórios.
2. Confirmar o UID Firebase Auth correto da conta autorizada; o e-mail sozinho não serve como identificador estável.
3. Confirmar que o projeto Firebase `poupe-mais-6a07f` tem funções habilitadas, permissões IAM e plano necessário para deploy.
4. Na máquina/ambiente de implantação com Firebase CLI autenticado, dentro do projeto correto:
   ```bash
   firebase use poupe-mais-6a07f
   firebase functions:secrets:set PIERRE_API_KEY
   firebase functions:secrets:set PIERRE_OWNER_UID
   npm --prefix functions install
   npm install
   npm run build
   firebase deploy --only functions:syncPierre,hosting --project poupe-mais-6a07f
   ```
   Os comandos de `secrets:set` solicitam valores no terminal; nunca incluí-los em texto do comando, histórico do shell ou logs.
5. Testar a prévia, comparar 5-10 transações, conferir nomes/saldos das contas, cartão e faturas, **antes** de importar. Fazer backup do Firestore antes de qualquer limpeza.
6. Somente após validação end-to-end considerar a branch pronta para a `main` e o deploy em produção.

## Cuidados para revisão

- Esta integração assume o schema publicado em `https://docs.pierre.finance/api-reference/rest/get-accounts` e `.../get-transactions`. Não foi testada com dados reais.
- A API de transações `raw` não fornece `accountId` no exemplo; o vínculo exige correspondência inequívoca por tipo e nome. Alguns lançamentos podem ser bloqueados.
- Não trata investimentos como uma tela específica nem importa faturas parceladas com fidelidade completa. Esses módulos exigem implementação e validação adicionais.
- O `firebase.json` passou a incluir o diretório `functions`, enquanto `hosting` e regras existentes foram preservados.
- O deploy das Functions geralmente requer faturamento habilitado (plano Blaze).
- O projeto ainda possui chamadas de IA a partir do frontend (escopo distinto); auditar exposição de credenciais antes de publicar uma revisão geral.

Documentação do provedor: https://docs.pierre.finance/api-reference/introduction
