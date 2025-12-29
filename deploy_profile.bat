@echo off
echo 🚀 DEPLOYING PROFILE MANAGEMENT FUNCTION
echo ======================================

REM Change to workspace directory
set "WORKSPACE_DIR=%~dp0"
cd /d "%WORKSPACE_DIR%"
echo 📂 Changed to workspace directory: %CD%

echo.
echo Step 1: Checking Supabase CLI...
npx supabase --version
if %errorlevel% neq 0 (
    echo ❌ Supabase CLI not found. Please install it first.
    echo Run: npm install -g supabase
    pause
    exit /b 1
)

echo.
echo Step 2: Deploying profile-management function...
npx supabase functions deploy profile-management
if %errorlevel% neq 0 (
    echo ❌ Function deployment failed.
    echo Please check your Supabase project link and try again.
    echo Run: npx supabase link
    pause
    exit /b 1
)

echo.
echo Step 3: Running database migration...
echo Please run the SQL from profile_schema_update.sql in your Supabase SQL Editor
echo.

echo ✅ DEPLOYMENT COMPLETE!
echo.
echo Next steps:
echo 1. Go to Supabase Dashboard
echo 2. Run SQL from profile_schema_update.sql
echo 3. Test the profile editing functionality
echo.
pause

