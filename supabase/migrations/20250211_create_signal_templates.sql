create or replace function public.transaction_log_report(
  p_user_id uuid,
  p_symbols text[] default null,
  p_mode text default 'all',
  p_start timestamptz default null,
  p_end timestamptz default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
as $function$
declare
  summary jsonb := null;
  symbol_breakdown jsonb := '[]'::jsonb;
  entry_list jsonb := '[]'::jsonb;
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;

  with filtered as (
    select *
    from public.transaction_log_entries
    where user_id = p_user_id
      and (p_symbols is null or symbol = any(p_symbols))
      and (
        p_mode = 'all'
        or (p_mode = 'real' and mode = 'real')
        or (p_mode = 'paper' and mode = 'paper')
      )
      and (p_start is null or created_at >= p_start)
      and (p_end is null or created_at <= p_end)
  ),
  aggregates as (
    select
      count(*) as total_trades,
      count(*) filter (where lower(side) in ('buy', 'long')) as long_trades,
      count(*) filter (where lower(side) in ('sell', 'short')) as short_trades,
      count(*) filter (where pnl > 0) as wins,
      count(*) filter (where pnl < 0) as losses,
      coalesce(sum(pnl), 0) as gross_pnl,
      coalesce(sum(fees), 0) as total_fees
    from filtered
  ),
  grouped as (
    select
      symbol,
      mode,
      count(*) as trades,
      coalesce(sum(pnl), 0) as pnl,
      coalesce(sum(fees), 0) as fees
    from filtered
    group by symbol, mode
    order by trades desc
  )
  select jsonb_build_object(
    'totalTrades', coalesce(total_trades, 0),
    'longTrades', coalesce(long_trades, 0),
    'shortTrades', coalesce(short_trades, 0),
    'wins', coalesce(wins, 0),
    'losses', coalesce(losses, 0),
    'winRate', case when coalesce(total_trades, 0) > 0 then coalesce(wins, 0)::numeric / total_trades else 0 end,
    'grossPnl', coalesce(gross_pnl, 0),
    'fees', coalesce(total_fees, 0),
    'netPnl', coalesce(gross_pnl, 0) - coalesce(total_fees, 0)
  )
  into summary
  from aggregates;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'symbol', symbol,
      'mode', mode,
      'trades', trades,
      'pnl', pnl,
      'fees', fees
    )
  ), '[]'::jsonb)
  into symbol_breakdown
  from grouped;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'botId', bot_id,
    'botName', bot_name,
    'symbol', symbol,
    'side', side,
    'status', status,
    'pnl', pnl,
    'fees', fees,
    'mode', mode,
    'createdAt', created_at,
    'closedAt', closed_at
  )), '[]'::jsonb)
  into entry_list
  from (
    select *
    from filtered
    order by created_at desc
    limit p_limit
    offset p_offset
  ) sub;

  summary := coalesce(summary, jsonb_build_object(
    'totalTrades', 0,
    'longTrades', 0,
    'shortTrades', 0,
    'wins', 0,
    'losses', 0,
    'winRate', 0,
    'grossPnl', 0,
    'fees', 0,
    'netPnl', 0
  ));

  return jsonb_build_object(
    'summary', summary,
    'breakdown', jsonb_build_object('bySymbol', symbol_breakdown),
    'entries', entry_list
  );
end;
$function$;
-- Migration: Create signal templates and events for TradingView webhook integration
create extension if not exists "pgcrypto";

create table if not exists public.signal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  exchange text not null,
  trading_type text not null check (trading_type in ('spot', 'futures')),
  default_symbol text not null,
  leverage numeric,
  trade_amount numeric,
  mode text not null default 'real' check (mode in ('real', 'paper')),
  strategy_config jsonb default '{}'::jsonb,
  linked_bot_id uuid references trading_bots(id) on delete set null,
  signal_token text not null unique,
  metadata jsonb default '{}'::jsonb,
  active boolean not null default true,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signal_events (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references signal_templates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_payload jsonb not null,
  action text,
  amount numeric,
  mode text not null default 'real' check (mode in ('real', 'paper')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'ignored')),
  error text,
  linked_signal_id uuid references manual_trade_signals(id) on delete set null,
  notes jsonb default '{}'::jsonb,
  inserted_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_signal_templates_user on public.signal_templates(user_id);
create index if not exists idx_signal_events_template on public.signal_events(template_id);
create index if not exists idx_signal_events_status on public.signal_events(status);
create index if not exists idx_signal_events_user on public.signal_events(user_id);

comment on table public.signal_templates is 'Reusable TradingView signal templates that drive bot executions';
comment on table public.signal_events is 'Audit log for TradingView signal payloads processed by webhook';

alter table public.manual_trade_signals
  add column if not exists metadata jsonb default '{}'::jsonb;

create or replace view public.transaction_log_entries as
select
  t.id,
  t.bot_id,
  b.user_id,
  b.name as bot_name,
  t.symbol,
  t.side,
  t.status,
  t.pnl,
  coalesce(t.fee, 0) as fees,
  t.created_at,
  t.closed_at,
  'real'::text as mode
from public.trades t
join public.trading_bots b on b.id = t.bot_id

union all

select
  pt.id,
  pt.bot_id,
  b.user_id,
  b.name as bot_name,
  pt.symbol,
  pt.side,
  pt.status,
  pt.pnl,
  coalesce(pt.fees, 0) as fees,
  pt.created_at,
  pt.closed_at,
  'paper'::text as mode
from public.paper_trading_trades pt
join public.trading_bots b on b.id = pt.bot_id;

comment on view public.transaction_log_entries is 'Unified view of real and paper trades for transaction reporting';

do $$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'set_current_timestamp_updated_at'
      and pg_function_is_visible(oid)
  ) then
    create or replace function public.set_current_timestamp_updated_at()
    returns trigger
    language plpgsql
    as $function$
    begin
      new.updated_at = now();
      return new;
    end;
    $function$;
  end if;
end;
$$;

create trigger signal_templates_set_timestamp
before update on public.signal_templates
for each row
execute procedure public.set_current_timestamp_updated_at();

