@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 > nul

set "ROOT_DIR=%~dp0"
set "SHOULD_EXIT=0"
set "FB_CMD="
set "COMMIT_CREATED=0"
set "CHANGED_FILES="

cd /d "%ROOT_DIR%"

echo.
echo ============================================================
echo   POUPE MAIS - DEPLOY AUTOMATICO (GitHub + Firebase)
echo ============================================================
echo.

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "STAMP=%%i"
set "COMMIT_TITLE=chore-deploy: update %STAMP%"

echo [%time%] Iniciando deploy...
echo.

echo [%time%] Verificando Git...
git --version > nul 2>&1
if errorlevel 1 (
    echo [ERRO] Git nao encontrado. Instale: https://git-scm.com/download/win
    set "SHOULD_EXIT=1"
)
echo.

if "%SHOULD_EXIT%"=="0" (
    echo [%time%] Verificando Firebase CLI...
    where firebase > nul 2>&1
    if errorlevel 1 (
        echo [INFO] Firebase global nao encontrado. Usando npx firebase-tools...
        call npx --yes firebase-tools --version > nul 2>&1
        if errorlevel 1 (
            echo [ERRO] Nao foi possivel iniciar Firebase CLI.
            echo [INFO] Execute: npm install -g firebase-tools
            set "SHOULD_EXIT=1"
        ) else (
            set "FB_CMD=npx --yes firebase-tools"
            echo [OK] Firebase CLI via npx.
        )
    ) else (
        set "FB_CMD=firebase"
        echo [OK] Firebase CLI global.
    )
)
echo.

if "%SHOULD_EXIT%"=="0" (
    echo [%time%] Verificando autenticacao Firebase...
    call !FB_CMD! projects:list --non-interactive > nul 2>&1
    if errorlevel 1 (
        echo [INFO] Login necessario no Firebase. Abrindo autenticacao...
        call !FB_CMD! login
        if errorlevel 1 (
            echo [ERRO] Falha no login Firebase.
            set "SHOULD_EXIT=1"
        ) else (
            echo [OK] Login Firebase concluido.
        )
    ) else (
        echo [OK] Firebase autenticado.
    )
)
echo.

if "%SHOULD_EXIT%"=="0" (
    echo [%time%] Build da aplicacao...
    call npm run build
    if errorlevel 1 (
        echo [ERRO] Build falhou.
        set "SHOULD_EXIT=1"
    ) else (
        echo [OK] Build concluido.
    )
)
echo.

if "%SHOULD_EXIT%"=="0" (
    echo [%time%] Preparando commit automatico...
    git add -A
    if errorlevel 1 (
        echo [ERRO] Falha no git add.
        set "SHOULD_EXIT=1"
    ) else (
        for /f "delims=" %%x in ('powershell -NoProfile -Command "$files = git diff --cached --name-only; if ($files) { ($files -join ', ') }"') do set "CHANGED_FILES=%%x"

        if not defined CHANGED_FILES (
            echo [INFO] Nenhuma alteracao para commit.
        ) else (
            git commit -m "!COMMIT_TITLE!" -m "Arquivos alterados: !CHANGED_FILES!"
            if errorlevel 1 (
                echo [ERRO] Falha ao criar commit.
                set "SHOULD_EXIT=1"
            ) else (
                set "COMMIT_CREATED=1"
                echo [OK] Commit criado: %COMMIT_TITLE%
            )
        )
    )
)
echo.

if "%SHOULD_EXIT%"=="0" (
    echo [%time%] Enviando para GitHub...
    git push origin main
    if errorlevel 1 (
        echo [ERRO] Falha no git push.
        set "SHOULD_EXIT=1"
    ) else (
        echo [OK] Push concluido.
    )
)
echo.

if "%SHOULD_EXIT%"=="0" (
    echo [%time%] Deploy Firebase...
    call !FB_CMD! deploy --project poupe-mais-6a07f --non-interactive
    if errorlevel 1 (
        echo [ERRO] Falha no deploy Firebase.
        set "SHOULD_EXIT=1"
    ) else (
        echo [OK] Deploy Firebase concluido.
    )
)

echo.
echo ============================================================
if "%SHOULD_EXIT%"=="0" (
    echo   STATUS FINAL: SUCESSO
) else (
    echo   STATUS FINAL: FALHOU
)
echo ------------------------------------------------------------
echo   Repositorio GitHub: https://github.com/0tiagooliveira/PoupeMais
echo   Firebase Console : https://console.firebase.google.com/u/0/project/poupe-mais-6a07f/overview?hl=pt-br
echo   Firebase Hosting : https://poupe-mais-6a07f.web.app
echo   GitHub Actions   : https://github.com/0tiagooliveira/PoupeMais/actions
echo ------------------------------------------------------------
if "%COMMIT_CREATED%"=="1" (
    echo   Commit criado: %COMMIT_TITLE%
    echo   Arquivos     : !CHANGED_FILES!
) else (
    echo   Commit criado: nao (sem alteracoes)
)
echo ============================================================
echo.
echo Pressione qualquer tecla para fechar...
pause > nul
exit /b 0

