# 🔗 Tracking Redirect Edge Function URL

## Edge Function Endpoint

The tracking redirect Edge Function should be accessed at:

```
https://[YOUR-PROJECT-REF].supabase.co/functions/v1/tracking-redirect/[shortCode]
```

### Example:
If your Supabase project reference is `dkawxgwdqiirgmmjbvhc`, the URL would be:

```
https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/tracking-redirect/7jmCI9O0
```

## Current Setup Issue

Currently, you're using the React page route:
- `https://pablobots.com/t/7jmCI900` → Goes to React page component

The Edge Function route would be:
- `https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/tracking-redirect/7jmCI9O0` → Goes directly to Edge Function

## Solutions

### Option 1: Use Edge Function URL Directly
Use the Edge Function URL in your campaigns:
```
https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/tracking-redirect/[shortCode]
```

### Option 2: Configure Proxy/Rewrite (Recommended for Custom Domain)
Configure your hosting provider (Vercel/Netlify/etc.) to proxy `/t/*` requests to the Edge Function:

**For Vercel (`vercel.json`):**
```json
{
  "rewrites": [
    {
      "source": "/t/:shortCode",
      "destination": "https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/tracking-redirect/:shortCode"
    }
  ]
}
```

**For Netlify (`netlify.toml`):**
```toml
[[redirects]]
  from = "/t/*"
  to = "https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/tracking-redirect/:splat"
  status = 200
  force = true
```

### Option 3: Fix the React Page Route (Current Implementation)
The React page route should work, but there might be an issue with the case-insensitive lookup. The Edge Function is more reliable for redirects.

## Which Option to Use?

- **Option 1** (Edge Function URL): Quick fix, but URLs won't use your custom domain
- **Option 2** (Proxy/Rewrite): Best for SEO and branding, uses your custom domain
- **Option 3** (Fix React Route): Keep current setup but might have edge cases

## Find Your Supabase Project Reference

1. Go to your Supabase Dashboard
2. Go to Project Settings → API
3. Look for "Project URL" - the project reference is in the URL:
   - Example: `https://dkawxgwdqiirgmmjbvhc.supabase.co`
   - Project ref: `dkawxgwdqiirgmmjbvhc`

