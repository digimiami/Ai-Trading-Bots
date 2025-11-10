create extension if not exists pgcrypto;

-- Add per-bot webhook secret and trigger configuration
alter table trading_bots
  add column if not exists webhook_secret text default encode(gen_random_bytes(18), 'hex') not null,
  add column if not exists webhook_trigger_immediate boolean default true not null;

comment on column trading_bots.webhook_secret is 'Secret token required when triggering the tradingview webhook for this bot.';
comment on column trading_bots.webhook_trigger_immediate is 'Whether webhook requests should trigger the bot executor immediately by default.';

-- Ensure existing bot rows get a secret value
update trading_bots
set webhook_secret = encode(gen_random_bytes(18), 'hex')
where webhook_secret is null;

