-- Disable PIEVERSEUSDT bot on Bitunix - symbol doesn't exist on this exchange
-- Bot ID: e92e051c-9c25-4970-9638-221ac938c922

UPDATE trading_bots
SET
    status = 'stopped',
    updated_at = NOW(),
    next_execution_at = NULL
WHERE id = 'e92e051c-9c25-4970-9638-221ac938c922';

-- Log the reason for disabling
INSERT INTO bot_activity_logs (bot_id, level, category, message, details, created_at)
VALUES (
    'e92e051c-9c25-4970-9638-221ac938c922',
    'error',
    'system',
    '🚨 Bot disabled: Symbol PIEVERSEUSDT is not available on Bitunix exchange',
    jsonb_build_object(
        'symbol', 'PIEVERSEUSDT',
        'exchange', 'bitunix',
        'error_type', 'non_existent_symbol',
        'error_code', 2,
        'action_taken', 'bot_disabled',
        'reason', 'Symbol PIEVERSEUSDT does not exist on Bitunix. All order attempts returned Code 2 (System error)',
        'recommended_action', 'Change symbol to one available on Bitunix (BTCUSDT, ETHUSDT, etc.) or switch exchange'
    ),
    NOW()
);

-- Verify the bot is disabled
SELECT
    id,
    name,
    symbol,
    exchange,
    status,
    updated_at
FROM trading_bots
WHERE id = 'e92e051c-9c25-4970-9638-221ac938c922';
