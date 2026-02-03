# Smart Exit & Take Profit verification

## Take profit (e.g. 10% TP) vs Smart Exit

- **Take profit (TP)**: When price **reaches or passes** your configured TP level (e.g. +10%), the position is closed.  
  - **Live**: We set TP on the exchange and, every sync, we also check `current price >= TP` (long) or `current price <= TP` (short). If the exchange didn’t close (e.g. mark vs last price), we close at market and record as `taken_profit`. So 10% TP is honored even if the exchange TP didn’t fire.
  - **Paper**: Exit Strategy loop checks price vs TP and closes (full or partial TP1/TP2).
- **Early take profit (%)**: Optional. When **unrealized profit** reaches X% (e.g. 5% or 10%), we close at market **sooner** so profit is locked in before a retrace.  
  - **Live**: Every sync we compute profit % from entry (long: (current−entry)/entry×100; short: (entry−current)/entry×100). If `early_take_profit_pct` is set (e.g. 5 or 10) and profit % ≥ that, we close at market.  
  - Set **Take profit sooner** in bot advanced settings (Edit/Create bot → Advanced → “Profit target (%)”). Use 0 to disable, or 5/10 to lock in at 5% or 10% profit.
- **Smart Exit**: Closes when price **retraces** from the best level (high for long, low for short) by at least your threshold (e.g. 2%).  
  - If price goes up 10% and **stays there**, retracement is 0% → Smart Exit does **not** trigger.  
  - If price goes up 10% then **drops** 2% from that high → Smart Exit triggers and we close at market.

So: “10% TP” = **Take profit** (or **Early take profit** at 10%). “Lock in at 5–10% profit before retrace” = **Early take profit**. “Lock in when price pulls back” = **Smart Exit**.

---

## Smart Exit verification

Smart Exit closes a position at market when price **retraces** from its best level by at least the configured percentage.

## Where it runs

- **Live trading**: Every minute during position sync (`syncPositionsFromExchange` → `applyAdvancedExitAndTrailingLivePosition`). Supported for **Bybit** and **BTCC**. Bitunix logs a warning and does not close.
- **Paper trading**: In the Exit Strategy loop when evaluating paper positions (status is stored as `closed` in DB; reason is logged as smart exit).

## How to verify it’s working

### 1. Confirm the check is running (live)

In **Supabase** → **Edge Functions** → **bot-executor** (or **bot-scheduler** if sync is triggered from there) → **Logs**, look for:

- **`[SMART EXIT CHECK]`** – Smart Exit is enabled and is evaluated every sync. You’ll see:
  - `retracement=X%` (current retracement from high/low)
  - `threshold=Y%` (your `smart_exit_retracement_pct`)
  - `high`, `low`, `current` prices

If you see this line for your symbol/side, Smart Exit is active and running.

### 2. Confirm an actual exit (live)

When retracement crosses the threshold, you should see:

- **`🚨 [LIVE SMART EXIT]`** in function logs
- A **bot log** entry with message like:  
  `🚨 Smart Exit (LIVE): SYMBOL side retraced X% → market close`
- Position closed on the exchange and in `trading_positions` / `trades` with close reason reflected in your tracking

### 3. Bot Activity page

On the **Bot Activity** page, “Smart Exit” events are derived from bot logs whose message contains “smart exit”. After a Smart Exit, you should see a corresponding event and count there.

### 4. Requirements

- **Bot config**: `smart_exit_enabled: true` and optionally `smart_exit_retracement_pct` (default 2.0) in `strategy_config` (or on the bot).
- **Live**: Position must be open and synced (scheduler runs sync every minute). High/low are stored in position `metadata` and updated each sync.
- **Paper**: Exit Strategy job must be running; paper positions use the same retracement logic and then set status to `closed`.

## Quick checklist

| Step | What to do |
|------|------------|
| 1 | Enable “Smart Exit” (and set retracement %) in the bot’s advanced/exit settings. |
| 2 | Deploy the latest `bot-executor` (and scheduler if you use it for sync). |
| 3 | Open a live position (or use paper) and wait for at least one sync. |
| 4 | In function logs, confirm **`[SMART EXIT CHECK]`** for that position. |
| 5 | When price retraces by at least the threshold, confirm **`🚨 [LIVE SMART EXIT]`** (or paper equivalent) and position close. |

If `[SMART EXIT CHECK]` never appears, Smart Exit is either disabled for that bot or the sync path for that position is not running (e.g. no open position, or paper bot not in Exit Strategy).
