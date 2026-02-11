# Bot Settings Compliance

This doc explains how bot settings (leverage, TP/SL, trade amount) are applied and what was fixed so bots follow your configuration.

## How settings flow

1. **UI → DB**: Edit/Create bot saves `tradeAmount`, `stopLoss`, `takeProfit`, `leverage` (and `strategyConfig`). The `bot-management` edge function maps these to DB columns: `trade_amount`, `stop_loss`, `take_profit`, `leverage`, `strategy_config`.

2. **DB → Executor**: When the bot-executor runs, it loads the bot with `.select('*')`, so it gets `trade_amount`, `leverage`, `stop_loss`, `take_profit`, `strategy_config`. It normalizes with `getBotNumber(bot, 'trade_amount', 'tradeAmount', 100)` (and similar) so both snake_case and camelCase are supported.

3. **Execution**:
   - **Leverage**: Used in `calculateTradeSizing` and when setting position leverage on the exchange (Bybit/Bitunix) before placing orders. Now respects your value up to exchange limits (see below).
   - **Trade amount**: Base size comes from `trade_amount`; it can be scaled by `strategy_config.risk_per_trade_pct` (e.g. 0.5% risk → smaller effective size). Min floor is $50 (futures) or $10 (spot).
   - **SL/TP**: Two sources:
     - **Strategy (ATR-based)**: If `strategy_config` has `sl_atr_mult` / `tp1_r` / `tp2_r`, the signal is built with ATR-based SL/TP. Bybit and Bitunix now both use these when the signal includes `stopLoss` and `takeProfit1`.
     - **Bot percentage**: The simple `stop_loss` and `take_profit` % on the bot (e.g. 2% / 4%) are used when no ATR-based values are in the signal (fallback).

## Fixes applied

1. **Bitunix SL/TP**
   - **Before**: Bitunix always used bot `stop_loss` / `take_profit` % and ignored strategy ATR-based SL/TP from the signal.
   - **After**: Bitunix uses `tradeSignal.stopLoss` and `tradeSignal.takeProfit1` when present (same logic as Bybit), otherwise falls back to bot percentage.

2. **Leverage cap (Bybit / OKX / BTCC)**
   - **Before**: User leverage was capped at **10x** for futures, so e.g. 20x in settings became 10x on the exchange.
   - **After**: User leverage is respected up to **100x** (exchange will still enforce per-symbol limits). Bitunix remains capped at 20x as before.

## If the bot still doesn’t match settings

- **Leverage**: Exchange max can be lower than 100x for some symbols; the exchange may reject or reduce leverage.
- **Trade amount**: Check `strategy_config.risk_per_trade_pct`; it scales the nominal trade amount (e.g. 0.5% risk halves effective size vs 1%).
- **SL/TP**: If you use advanced strategy (ATR), SL/TP come from `sl_atr_mult` / `tp1_r` / `tp2_r` in `strategy_config`, not from the simple bot “Stop Loss %” / “Take Profit %” (those are fallbacks when no ATR values are in the signal).
