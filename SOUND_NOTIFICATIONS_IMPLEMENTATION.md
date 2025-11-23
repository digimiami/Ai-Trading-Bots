# 🔔 Sound Notifications for Real Trades - Implementation Guide

## Overview
Added sound notification feature that plays a sound when a real trade is executed. Each bot has an individual on/off toggle for sound notifications.

## Features
- ✅ Per-bot sound notification toggle (on/off)
- ✅ Only plays for real trades (paper trading excluded)
- ✅ Works even when browser tab is in background
- ✅ Pleasant two-tone notification sound
- ✅ Automatic detection of new trades via Supabase realtime + polling fallback

## Files Modified/Created

### 1. Database
- **`ADD_SOUND_NOTIFICATIONS_COLUMN.sql`**: Adds `sound_notifications_enabled` boolean column to `trading_bots` table

### 2. Type Definitions
- **`src/types/trading.ts`**: Added `soundNotificationsEnabled?: boolean` to `TradingBot` interface

### 3. Sound Notification Hook
- **`src/hooks/useSoundNotifications.ts`**: 
  - Listens for new real trades via Supabase realtime subscriptions
  - Polling fallback (every 5 seconds) if realtime doesn't work
  - Uses Web Audio API to generate pleasant notification sound
  - Only triggers for bots with `soundNotificationsEnabled: true` and `paperTrading: false`

### 4. Bot Edit Page
- **`src/pages/edit-bot/page.tsx`**:
  - Added `soundNotificationsEnabled` state
  - Loads setting from bot data
  - Added toggle UI with ON/OFF indicator
  - Includes setting in bot update payload

### 5. Bot Create Page
- **`src/pages/create-bot/page.tsx`**:
  - Added `soundNotificationsEnabled` to formData state (defaults to false)
  - Added toggle UI card (similar to paper trading toggle)
  - Includes setting in bot creation payload

### 6. App Initialization
- **`src/App.tsx`**: 
  - Initializes `useSoundNotifications()` hook globally
  - Ensures sound notifications work across all pages

## How It Works

1. **User enables sound notifications** for a bot via the toggle in edit/create bot page
2. **Setting is saved** to database (`sound_notifications_enabled` column)
3. **Hook listens for new trades**:
   - Primary: Supabase realtime subscription on `trades` table
   - Fallback: Polling every 5 seconds for recent trades
4. **When a real trade is detected**:
   - Checks if trade is from a bot with `soundNotificationsEnabled: true`
   - Checks if trade is NOT paper trading (`paper_trading: false`)
   - Plays notification sound using Web Audio API

## Sound Generation

The notification sound is generated using Web Audio API:
- Two-tone sound: 800Hz → 1000Hz
- Duration: 200ms
- Volume: 70% (configurable, saved in localStorage)
- Smooth fade in/out

## Database Migration

Run the SQL migration to add the column:

```sql
-- Run this in Supabase SQL Editor
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS sound_notifications_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN trading_bots.sound_notifications_enabled IS 'Enable/disable sound notifications for real trades executed by this bot';

UPDATE trading_bots 
SET sound_notifications_enabled = false 
WHERE sound_notifications_enabled IS NULL;
```

## UI Location

### Edit Bot Page
- Located in the "Basic Settings" section
- Toggle with ON/OFF indicator
- Description: "Play a sound notification when this bot executes a real trade (paper trading excluded)"

### Create Bot Page
- Located after the "Paper Trading" toggle
- Blue-themed card with checkbox
- Description: "Play a sound notification when this bot executes a real trade. Paper trading trades are excluded."

## Testing

1. **Enable sound notifications** for a bot:
   - Go to bot edit page
   - Toggle "Sound Notifications" to ON
   - Save bot

2. **Execute a real trade** (not paper trading):
   - The bot should execute a real trade
   - You should hear a notification sound

3. **Verify paper trading exclusion**:
   - Enable paper trading for the bot
   - Execute a paper trade
   - No sound should play

## Browser Compatibility

- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ✅ Safari: Full support (may require user interaction first)
- ⚠️ Note: Some browsers require user interaction before allowing audio playback

## Future Enhancements

Potential improvements:
- Custom sound selection
- Volume control in UI
- Different sounds for buy vs sell
- Sound for trade closures
- Notification preferences page

## Troubleshooting

**Sound not playing?**
1. Check browser console for errors
2. Verify bot has `soundNotificationsEnabled: true`
3. Verify trade is real (not paper trading)
4. Check browser audio permissions
5. Some browsers require user interaction before allowing audio

**Realtime not working?**
- The hook automatically falls back to polling every 5 seconds
- Check Supabase realtime subscription status in console

## Notes

- Sound notifications only work for **real trades**, not paper trading
- Each bot has its own setting (can be enabled/disabled individually)
- Sound plays even if browser tab is in background (if browser allows)
- The hook tracks processed trades to avoid duplicate sounds

