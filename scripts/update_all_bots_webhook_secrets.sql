-- Script to update all existing bots with webhook secrets
-- Run this in your Supabase SQL Editor or via psql

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

-- Ensure webhook_trigger_immediate is set to true for all bots
update trading_bots
set webhook_trigger_immediate = true
where webhook_trigger_immediate is null;

-- Show summary of updated bots
select 
  count(*) as total_bots,
  count(webhook_secret) as bots_with_secret,
  count(case when webhook_trigger_immediate then 1 end) as bots_with_immediate_trigger
from trading_bots;

