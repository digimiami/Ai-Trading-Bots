@echo off
echo ====================================
echo Deploy Admin Management Function
echo ====================================
echo.
echo This script will help you deploy the admin-management-enhanced function
echo.
echo IMPORTANT: You need to deploy this function via Supabase Dashboard
echo.
echo Steps:
echo 1. Go to https://supabase.com/dashboard
echo 2. Select your project: dkawxgwdqiirgmmjbvhc
echo 3. Click "Edge Functions" in the sidebar
echo 4. Click "Create a new function"
echo 5. Name it: admin-management-enhanced
echo 6. Copy the contents of supabase/functions/admin-management-enhanced/index.ts
echo 7. Paste into the editor
echo 8. Click "Deploy"
echo.
echo OR if you have Supabase CLI installed:
echo.
echo   supabase login
echo   supabase link --project-ref dkawxgwdqiirgmmjbvhc
echo   supabase functions deploy admin-management-enhanced
echo.
echo ====================================
echo See DEPLOY_ADMIN_FUNCTION.md for detailed instructions
echo ====================================
pause

