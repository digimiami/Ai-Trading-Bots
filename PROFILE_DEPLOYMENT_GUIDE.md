# 🚀 PROFILE MANAGEMENT DEPLOYMENT GUIDE

## ✅ DEPLOYMENT INSTRUCTIONS

### **Step 1: Deploy Backend Function**

1. **Go to Supabase Dashboard**:
   - Visit: https://supabase.com/dashboard
   - Select your Pablo AI Trading project

2. **Navigate to Edge Functions**:
   - Go to "Edge Functions" in the left sidebar
   - Click "Create a new function"

3. **Create Profile Management Function**:
   - **Function Name**: `profile-management`
   - **Copy the code** from `supabase/functions/profile-management/index.ts`
   - **Paste it** into the function editor
   - **Click "Deploy"**

### **Step 2: Run Database Migration**

1. **Go to SQL Editor**:
   - In Supabase Dashboard, go to "SQL Editor"
   - Click "New Query"

2. **Run Profile Schema Update**:
   - **Copy the SQL** from `profile_schema_update.sql`
   - **Paste it** into the SQL editor
   - **Click "Run"**

### **Step 3: Verify Deployment**

1. **Test Profile Function**:
   ```javascript
   // Test in browser console or API client
   const response = await fetch('https://your-project.supabase.co/functions/v1/profile-management', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer YOUR_ANON_KEY',
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       action: 'getProfile'
     })
   });
   ```

2. **Check Database Schema**:
   ```sql
   -- Run this in SQL Editor to verify columns were added
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'users' 
     AND column_name IN ('bio', 'location', 'website', 'profile_picture_url');
   ```

3. **Check Storage Bucket**:
   ```sql
   -- Verify storage bucket exists
   SELECT id, name, public 
   FROM storage.buckets 
   WHERE id = 'profile-images';
   ```

## 🎯 WHAT'S BEING DEPLOYED

### **Backend Function Features**:
- ✅ Profile data retrieval and updates
- ✅ Image upload to Supabase Storage
- ✅ Base64 to file conversion
- ✅ Automatic user creation
- ✅ Error handling and validation

### **Database Schema Updates**:
- ✅ `bio` column for personal description
- ✅ `location` column for city/country
- ✅ `website` column for personal links
- ✅ `profile_picture_url` column for image URLs

### **Storage Setup**:
- ✅ `profile-images` bucket creation
- ✅ Public access policies
- ✅ User-specific upload permissions

## 🔧 ALTERNATIVE DEPLOYMENT METHODS

### **Method 1: Supabase CLI (if you have it linked)**
```bash
# If you have Supabase CLI linked to your project
npx supabase functions deploy profile-management
```

### **Method 2: Manual Upload**
1. Go to Edge Functions in Supabase Dashboard
2. Create new function named `profile-management`
3. Copy code from `supabase/functions/profile-management/index.ts`
4. Deploy the function

### **Method 3: Git Integration**
1. Connect your GitHub repo to Supabase
2. Enable automatic deployments
3. Push changes to trigger deployment

## 📋 POST-DEPLOYMENT CHECKLIST

- [ ] Function deployed successfully
- [ ] Database migration completed
- [ ] Storage bucket created
- [ ] Test profile retrieval works
- [ ] Test profile update works
- [ ] Test image upload works
- [ ] Verify image storage permissions

## 🚨 TROUBLESHOOTING

### **If Function Deployment Fails**:
1. Check function name is exactly `profile-management`
2. Verify all imports are correct
3. Check for syntax errors in the code
4. Ensure Supabase project is active

### **If Database Migration Fails**:
1. Check if columns already exist
2. Verify user permissions
3. Run migration in parts if needed
4. Check for foreign key constraints

### **If Storage Issues Occur**:
1. Verify bucket policies are correct
2. Check RLS policies on storage.objects
3. Ensure public access is enabled
4. Test with different file types

## 🎉 SUCCESS INDICATORS

Once deployed successfully, you should see:
- ✅ Profile editing modal opens
- ✅ Image upload shows preview
- ✅ Profile data saves to database
- ✅ Images appear in storage bucket
- ✅ Profile updates persist across sessions

The profile management system will be fully functional! 🚀

