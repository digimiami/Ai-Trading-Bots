-- ============================================
-- Analyze Transaction Log for PnL Patterns
-- Use this to understand current performance
-- ============================================

-- Note: This is a template query. You'll need to import the CSV data
-- or manually analyze the transaction log

-- Key Metrics to Calculate:
-- 1. Total trades
-- 2. Winning vs losing trades
-- 3. Average PnL per trade
-- 4. Total fees paid
-- 5. Net PnL (after fees)
-- 6. Win rate
-- 7. Average win vs average loss
-- 8. Best and worst trades

-- Example Analysis (if data was in database):
/*
SELECT 
    COUNT(*) as total_trades,
    SUM(CASE WHEN "Change" > 0 THEN 1 ELSE 0 END) as winning_trades,
    SUM(CASE WHEN "Change" < 0 THEN 1 ELSE 0 END) as losing_trades,
    SUM(CASE WHEN "Change" = 0 THEN 1 ELSE 0 END) as breakeven_trades,
    SUM("Change") as total_pnl,
    SUM("Fee Paid") as total_fees,
    SUM("Change") - SUM("Fee Paid") as net_pnl,
    ROUND(AVG(CASE WHEN "Change" > 0 THEN "Change" END), 4) as avg_win,
    ROUND(AVG(CASE WHEN "Change" < 0 THEN "Change" END), 4) as avg_loss,
    ROUND(MAX("Change"), 4) as best_trade,
    ROUND(MIN("Change"), 4) as worst_trade,
    ROUND(SUM(CASE WHEN "Change" > 0 THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 2) as win_rate_pct
FROM transaction_log
WHERE "Contract" = 'BTCUSDT'
  AND "Type" = 'TRADE'
  AND "Action" IN ('OPEN', 'CLOSE');
*/

-- Manual Analysis Guide:
-- 1. Count total OPEN actions (entry trades)
-- 2. Count total CLOSE actions (exit trades)
-- 3. Sum all "Change" values (PnL)
-- 4. Sum all "Fee Paid" values
-- 5. Calculate net PnL = Total Change - Total Fees
-- 6. Calculate win rate = (Winning trades / Total trades) * 100

-- Key Findings from CSV Analysis:
-- - Many small trades (0.001-0.006 BTC)
-- - High frequency (400+ trades in period)
-- - Fees are significant portion of profits
-- - Need to reduce frequency and increase position size

