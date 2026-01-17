# Test ML Monitoring Function

## Quick Test

### Step 1: Get Your Access Token

1. Open your browser console (F12)
2. Go to your app (logged in)
3. Run this in console:
```javascript
const token = JSON.parse(localStorage.getItem('supabase.auth.token')).currentSession.access_token;
console.log('Token:', token);
```

### Step 2: Test via Browser Console

Run this in your browser console (while on your app):

```javascript
const token = JSON.parse(localStorage.getItem('supabase.auth.token')).currentSession.access_token;

fetch('https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/ml-monitoring?action=dashboard', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
})
.then(r => r.json())
.then(data => console.log('ML Monitoring Data:', data))
.catch(err => console.error('Error:', err));
```

### Step 3: Check Logs

After running the test, check Supabase Dashboard → Edge Functions → ml-monitoring → Logs

You should see:
- `📥 ML Monitoring function called`
- `✅ User authenticated`
- `🎯 Action: dashboard`

## If You Want to Integrate It

The function needs to be called from your frontend. I can help you:
1. Add it to the AI/ML Activity Modal
2. Create a dedicated monitoring dashboard
3. Add it to the bots page

Let me know which you prefer!
