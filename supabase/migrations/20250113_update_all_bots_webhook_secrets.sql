-- Update all existing bots to ensure they have webhook secrets
-- This migration ensures all bots have webhook_secret and webhook_trigger_immediate set

-- Ensure pgcrypto extension is available
create extension if not exists pgcrypto;

-- Add columns if they don't exist
alter table trading_bots
  add column if not exists webhook_secret text,
  add column if not exists webhook_trigger_immediate boolean default true;

-- Generate webhook secrets for all bots that don't have one
update trading_bots
set webhook_secret = encode(gen_random_bytes(18), 'hex')
where webhook_secret is null or webhook_secret = '';

-- Ensure webhook_trigger_immediate is set to true for all bots (default behavior)
update trading_bots
set webhook_trigger_immediate = true
where webhook_trigger_immediate is null;

-- Add comments for documentation
comment on column trading_bots.webhook_secret is 'Secret token required when triggering the tradingview webhook for this bot. Auto-generated if missing.';
comment on column trading_bots.webhook_trigger_immediate is 'Whether webhook requests should trigger the bot executor immediately by default. Defaults to true.';

-- Make webhook_secret NOT NULL after ensuring all bots have values
alter table trading_bots
  alter column webhook_secret set not null,
  alter column webhook_trigger_immediate set not null,
  alter column webhook_trigger_immediate set default true;

