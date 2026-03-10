@echo off
chcp 65001 >nul
echo ========================================
echo     POUPE MAIS - DEPLOY SCRIPT
echo ========================================
echo.
echo Iniciando verificacoes...
echo.

:: Verifica se o Node.js está instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado. Por favor, instale o Node.js antes de continuar.
    pause
    exit /b 1
)

:: Verifica se o npm está disponível
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: npm nao encontrado. Por favor, verifique sua instalacao do Node.js.
    pause
    exit /b 1
)

:: Verifica se o Firebase CLI está instalado
where firebase >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Firebase CLI nao encontrado.
    echo Instalando Firebase CLI...
    npm install -g firebase-tools
    if %errorlevel% neq 0 (
        echo ERRO: Falha ao instalar Firebase CLI.
        pause
        exit /b 1
    )
)

echo ========================================
echo Iniciando processo de deploy...
echo ========================================
echo.

echo [1/4] Instalando dependencias...
npm install
if %errorlevel% neq 0 (
    echo ERRO: Falha na instalacao das dependencias.
    pause
    exit /b 1
)

echo.
echo [2/4] Executando build do projeto...
npm run build
if %errorlevel% neq 0 (
    echo ERRO: Falha no build do projeto.
    pause
    exit /b 1
)

echo.
echo [3/4] Verificando se esta logado no Firebase...
firebase projects:list >nul 2>&1
if %errorlevel% neq 0 (
    echo Voce precisa fazer login no Firebase first.
    echo Abrindo processo de login...
    firebase login
    if %errorlevel% neq 0 (
        echo ERRO: Falha no login do Firebase.
        pause
        exit /b 1
    )
)

echo.
echo [4/4] Fazendo deploy para o Firebase...
firebase deploy
if %errorlevel% neq 0 (
    echo ERRO: Falha no deploy do Firebase.
    pause
    exit /b 1
)

echo.
echo ========================================
echo     DEPLOY CONCLUIDO COM SUCESSO!
echo ========================================
echo.
echo O seu projeto foi deployado com sucesso!
echo.
echo 🌐 LINK DO SEU PROJETO:
echo ========================================
echo 📱 URL Principal: https://poupe-mais-6a07f.web.app
echo 🔗 URL Alternativa: https://poupe-mais-6a07f.firebaseapp.com
echo ========================================
echo.
echo TIP: Para deploy automatico via GitHub Actions, 
echo consulte o arquivo DEPLOY_GITHUB_ACTIONS.md
echo.

:: Pergunta se o usuário quer fazer commit e push para GitHub
echo.
set /p gitPush=Deseja fazer commit e push para o GitHub? (s/n): 
if /i "%gitPush%"=="s" (
    echo.
    echo Fazendo commit e push...
    git add .
    set /p commitMsg=Digite a mensagem do commit: 
    if not "%commitMsg%"=="" (
        git commit -m "%commitMsg%"
        git push
        echo.
        echo Comando push executado. Verifique o GitHub Actions para o deploy automatico.
    ) else (
        echo Commit cancelado - mensagem vazia.
    )
)

:: Pergunta se o usuário quer abrir o projeto no browser
echo.
set /p openBrowser=Deseja abrir o projeto no navegador? (s/n): 
if /i "%openBrowser%"=="s" (
    start https://poupe-mais-6a07f.web.app
)

echo.
echo ========================================
echo          DEPLOY FINALIZADO!
echo ========================================
echo Pressione qualquer tecla para sair...
pause >nul