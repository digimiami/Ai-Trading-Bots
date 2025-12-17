# Fix: Add apikey Header to Cron Job

## The Problem

Supabase's Edge Function gateway is rejecting requests with `{"code":401,"message":"Missing authorization header"}` **before** the request reaches our function code. This happens because Supabase requires either:
- An `Authorization` header (for user calls), OR
- An `apikey` header (for internal/Supabase calls)

## The Solution

Add the `apikey` header to your cron job configuration. The `apikey` should be your **Supabase Anon Key** (not the service role key).

## Step-by-Step Instructions

### Step 1: Get Your Supabase Anon Key

1. Go to **Supabase Dashboard** → **Project Settings** → **API**
2. Find the **anon/public** key under **Project API keys**
3. Copy this key (it starts with `eyJ...`)

### Step 2: Update Cron Job Configuration

1. Go to **Supabase Dashboard** → **Database** → **Schedules** (or **Edge Functions** → **position-sync** → **Schedules**)
2. Find the `position-sync-schedule` cron job
3. Click **Edit**
4. In the **HTTP Headers** section, add **TWO** headers:

   **Header 1:**
   - **Key**: `apikey`
   - **Value**: `[Your Supabase Anon Key]` (paste the anon key from Step 1)

   **Header 2:**
   - **Key**: `x-cron-secret`
   - **Value**: `XOGLwBqy3lKb4uA5vxPTUhrzemEc20C6`

5. Click **Save cron job**

### Step 3: Verify Configuration

Your cron job should now have:
- **Method**: `POST`
- **URL**: `https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/position-sync`
- **Headers**:
  - `apikey`: `[Your Supabase Anon Key]`
  - `x-cron-secret`: `XOGLwBqy3lKb4uA5vxPTUhrzemEc20C6`
- **Timeout**: `5000` ms (or higher)

### Step 4: Test

Wait for the next cron run (or trigger it manually if possible) and check:
1. **Invocations tab**: Should show `200` instead of `401`
2. **Logs tab**: Should now show the authentication logs

## Alternative: Test with curl

You can test manually with curl (from your VPS):

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/position-sync \
  -H "apikey: [YOUR_SUPABASE_ANON_KEY]" \
  -H "x-cron-secret: XOGLwBqy3lKb4uA5vxPTUhrzemEc20C6" \
  -H "Content-Type: application/json"
```

Replace `[YOUR_SUPABASE_ANON_KEY]` with your actual anon key.

## Why This Works

- The `apikey` header tells Supabase's gateway that this is an internal call
- Supabase's gateway will allow the request through to our function
- Our function then checks the `x-cron-secret` header for additional security
- This is the standard pattern for Supabase cron jobs calling Edge Functions

## Important Notes

- **Use the Anon Key**, not the Service Role Key (for security)
- The `apikey` header is required by Supabase's gateway
- The `x-cron-secret` header is our custom security check
- Both headers are needed for the cron job to work

## After Adding the Header

Once you add the `apikey` header:
1. The gateway will allow the request through
2. Our function will check the `x-cron-secret` header
3. If both match, authentication succeeds
4. The function will sync positions for all running bots
