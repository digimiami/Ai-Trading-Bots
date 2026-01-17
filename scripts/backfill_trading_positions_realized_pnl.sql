-- One-time backfill: compute realized_pnl for closed positions
-- Only updates rows missing realized_pnl and having exit_price

UPDATE trading_positions
SET
  realized_pnl = CASE
    WHEN lower(side) IN ('short', 'sell')
      THEN ((entry_price - exit_price) * quantity) - COALESCE(fees, 0)
    ELSE
      ((exit_price - entry_price) * quantity) - COALESCE(fees, 0)
  END,
  updated_at = NOW()
WHERE status IN ('closed', 'stopped', 'taken_profit', 'manual_close', 'liquidated')
  AND realized_pnl IS NULL
  AND exit_price IS NOT NULL
  AND entry_price IS NOT NULL
  AND quantity IS NOT NULL;
