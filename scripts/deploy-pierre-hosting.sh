#!/usr/bin/env bash
# Publica SOMENTE o frontend no Firebase Hosting gratuito (sem Functions).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT="poupe-mais-6a07f"
EXPECTED_BRANCH="feature/pierre-financial-sync-20261025"
BRANCH="$(git branch --show-current)"

if [[ "$BRANCH" != "$EXPECTED_BRANCH" ]]; then
  echo "ERRO: a branch atual é '$BRANCH'; esperada '$EXPECTED_BRANCH'. Nada foi publicado." >&2
  exit 1
fi
if [[ ! -f firebase.json || ! -f features/settings/PierreIntegrationPage.tsx ]]; then
  echo "ERRO: projeto incompleto. Nada foi publicado." >&2
  exit 1
fi
if ! grep -q "poup-mais.tiago336699.workers.dev" features/settings/PierreIntegrationPage.tsx; then
  echo "ERRO: URL da ponte não configurada. Nada foi publicado." >&2
  exit 1
fi
if ! command -v npm >/dev/null || ! command -v node >/dev/null; then
  echo "ERRO: Node/npm indisponível. Nada foi publicado." >&2
  exit 1
fi

echo "Preparando compilação do Poupe Mais..."
npm ci
npm run build
if [[ ! -f dist/index.html ]]; then
  echo "ERRO: build não gerou dist/index.html. Nada foi publicado." >&2
  exit 1
fi

if command -v firebase >/dev/null; then
  FIREBASE=(firebase)
else
  FIREBASE=(npx --yes firebase-tools)
fi

echo "Conferindo autorização do Firebase para $PROJECT..."
if ! "${FIREBASE[@]}" projects:list --non-interactive >/dev/null 2>&1; then
  echo "Autenticação Firebase necessária. Siga as instruções abaixo."
  "${FIREBASE[@]}" login --no-localhost
fi

echo "Publicando SOMENTE hosting no Firebase Spark: $PROJECT"
"${FIREBASE[@]}" deploy --only hosting --project "$PROJECT" --non-interactive
echo "Publicação concluída: https://poupe-mais-6a07f.web.app/#/settings/pierre"
echo "ATENÇÃO: os dados financeiros ainda precisam ser importados e conferidos no aplicativo."
