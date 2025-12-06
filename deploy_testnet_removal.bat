@echo off
REM Deployment Script: Testnet Removal Update (Windows)
REM This script deploys the updated functions after testnet removal

echo.
echo ========================================
echo  Testnet Removal Deployment
echo ========================================
echo.

REM Check if Supabase CLI is installed
where supabase >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Supabase CLI is not installed
    echo Install it with: npm install -g supabase
    pause
    exit /b 1
)

echo [OK] Supabase CLI found
echo.

REM Deploy bot-executor function
echo [DEPLOY] Deploying bot-executor function...
call supabase functions deploy bot-executor
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to deploy bot-executor
    pause
    exit /b 1
)
echo [OK] bot-executor deployed successfully
echo.

REM Deploy api-keys function
echo [DEPLOY] Deploying api-keys function...
call supabase functions deploy api-keys
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to deploy api-keys
    pause
    exit /b 1
)
echo [OK] api-keys deployed successfully
echo.

echo ========================================
echo  Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Run fix_bots_not_trading.sql in Supabase SQL Editor
echo 2. Verify function logs: supabase functions logs bot-executor
echo 3. Test API key management in Settings page
echo 4. Check bot execution logs for any errors
echo.
pause

