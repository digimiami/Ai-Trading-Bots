# Fix ML Monitoring Edge Function - No Logs Showing

## Problem
The `ml-monitoring` Edge Function is not showing logs, which means it's likely not being called.

## Root Cause Analysis

### 1. Function Design
The `ml-monitoring` function is designed to be **called on-demand from the frontend**, not scheduled. It requires:
- User authentication (must be logged in)
- Frontend to make HTTP requests to it
- No automatic scheduling (unlike `ml-auto-retrain`)

### 2. Current Status
- ✅ Function is deployed
- ✅ Function has logging code
- ❌ **Function is not being called from frontend**
- ❌ No frontend components found that call it

## Solutions

### Option 1: Call from Frontend (Recommended)

The function needs to be called from a React component. Here's how to add it:

#### Step 1: Create a Hook or Service

Create `src/services/mlMonitoring.ts`:

```typescript
import { supabase } from '../lib/supabase';

export interface MLDashboardData {
  overall_accuracy: number;
  total_predictions: number;
  predictions_with_outcome: number;
  correct_predictions: number;
  performance_by_bot: any[];
  recent_predictions: any[];
  alerts: any[];
}

export async function getMLDashboard(): Promise<MLDashboardData> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-monitoring?action=dashboard`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`ML Monitoring failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.dashboard;
}

export async function getMLAlerts() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-monitoring?action=alerts`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`ML Alerts failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.alerts;
}
```

#### Step 2: Use in a Component

Add to `src/components/bot/AiMlActivityModal.tsx` or create a new monitoring component:

```typescript
import { useEffect, useState } from 'react';
import { getMLDashboard, getMLAlerts } from '../../services/mlMonitoring';

export function MLMonitoring() {
  const [dashboard, setDashboard] = useState(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const dashboardData = await getMLDashboard();
        const alertsData = await getMLAlerts();
        setDashboard(dashboardData);
        setAlerts(alertsData);
      } catch (error) {
        console.error('Failed to load ML monitoring data:', error);
      }
    }
    loadData();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // ... render component
}
```

### Option 2: Set Up Scheduled Monitoring (Alternative)

If you want automatic monitoring, create a scheduled cron job similar to `ml-auto-retrain`:

#### Create SQL Script: `setup_ml_monitoring_cron.sql`

```sql
-- Create function to call ml-monitoring
CREATE OR REPLACE FUNCTION trigger_ml_monitoring()
RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  response_id BIGINT;
BEGIN
  supabase_url := current_setting('app.supabase_url', true);
  service_role_key := current_setting('app.service_role_key', true);
  
  IF supabase_url IS NULL THEN
    supabase_url := 'https://dkawxgwdqiirgmmjbvhc.supabase.co';
  END IF;
  
  IF service_role_key IS NULL THEN
    service_role_key := 'YOUR_SERVICE_ROLE_KEY';
  END IF;
  
  -- Note: ml-monitoring requires user authentication
  -- This approach won't work directly - need to call for each user
  -- Better to use frontend approach
  
  RAISE NOTICE 'ML monitoring check triggered';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger ML monitoring: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Note:** This won't work well because `ml-monitoring` requires user authentication. The frontend approach is better.

### Option 3: Test Manually

Test the function directly to see if it works:

#### Using curl:

```bash
# Get your access token from browser console:
# localStorage.getItem('supabase.auth.token')

curl -X GET \
  "https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/ml-monitoring?action=dashboard" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

#### Using Supabase Dashboard:

1. Go to **Edge Functions** → **ml-monitoring** → **Invoke**
2. Set method to `GET`
3. Add query parameter: `action=dashboard`
4. Add Authorization header with your user token
5. Click **Invoke**

## Verify the View Exists

The function queries `ml_performance_summary` view. Check if it exists:

```sql
-- Check if view exists
SELECT * FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name = 'ml_performance_summary';

-- If it doesn't exist, run the migration:
-- supabase/migrations/20250126_enhance_ml_performance_tracking.sql
```

## Summary

**The function is working correctly, but it's not being called.** 

To see logs:
1. ✅ **Best option:** Add frontend code to call it (Option 1)
2. ✅ **Quick test:** Call it manually via curl or Supabase Dashboard (Option 3)
3. ⚠️ **Not recommended:** Scheduled cron (requires per-user calls)

The function will show logs once it's actually being called from the frontend or manually.
