# Deploy API Keys Fix - UTF-8 Encoding Support

## Issue Fixed
The `api-keys` Edge Function was failing with the error:
```
"Cannot encode string: string contains characters outside of the Latin1 range"
```

This occurred when saving API keys (especially Bitunix) that contained non-Latin1 characters.

## Solution
Updated the `encrypt()` and `decrypt()` functions to properly handle UTF-8 characters using `TextEncoder` and `TextDecoder`.

## Manual Deployment Steps

### Option 1: Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions

2. **Find the `api-keys` function**
   - Click on `api-keys` in the functions list

3. **Update the function code**
   - Click "Edit" or "Deploy new version"
   - Copy the entire contents of `supabase/functions/api-keys/index.ts`
   - Paste it into the editor
   - Click "Deploy" or "Save"

4. **Verify deployment**
   - Check that the function shows as "Active"
   - Test by trying to save a Bitunix API key again

### Option 2: Using Supabase CLI (if installed)

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref dkawxgwdqiirgmmjbvhc

# Deploy the function
supabase functions deploy api-keys
```

## What Changed

### Before (Broken):
```typescript
function encrypt(text: string): string {
  return btoa(text) // ❌ Only works with Latin1
}
```

### After (Fixed):
```typescript
function encrypt(text: string): string {
  // Convert string to UTF-8 bytes, then to base64
  const utf8Bytes = new TextEncoder().encode(text);
  const binaryString = String.fromCharCode(...utf8Bytes);
  return btoa(binaryString);
}
```

## Testing

After deployment, test by:
1. Go to Settings → Exchange Connections
2. Enter Bitunix API Key and Secret
3. Click "Save Settings"
4. Should now save successfully without encoding errors

## Files Changed
- `supabase/functions/api-keys/index.ts` - Updated encrypt/decrypt functions

