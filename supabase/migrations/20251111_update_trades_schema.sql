-- Align trades table schema with runtime expectations and enrich transaction log view
begin;

alter table public.trades
  add column if not exists amount numeric(18,8),
  add column if not exists price numeric(18,8),
  add column if not exists fee numeric(18,8),
  add column if not exists executed_at timestamptz,
  add column if not exists exchange_order_id text,
  add column if not exists order_type text;

-- Backfill newly added columns from legacy fields where possible
update public.trades
set
  amount = coalesce(amount, size),
  price = coalesce(price, entry_price),
  executed_at = coalesce(executed_at, created_at)
where amount is distinct from coalesce(size, amount)
   or price is distinct from coalesce(entry_price, price)
   or executed_at is distinct from coalesce(created_at, executed_at);

-- Relax side/status constraints so we can safely record BUY/SELL and exchange statuses
alter table public.trades
  drop constraint if exists trades_side_check;

alter table public.trades
  add constraint trades_side_check
  check (lower(side) in ('long', 'short', 'buy', 'sell'));

alter table public.trades
  drop constraint if exists trades_status_check;

alter table public.trades
  add constraint trades_status_check
  check (lower(status) in ('open', 'closed', 'filled', 'completed', 'failed', 'cancelled', 'canceled', 'pending', 'partial'));

-- Ensure trigger keeps updated_at fresh
drop trigger if exists trades_set_timestamp on public.trades;

create trigger trades_set_timestamp
before update on public.trades
for each row
execute procedure public.set_current_timestamp_updated_at();

-- Refresh transaction log view so new columns are exposed consistently
create or replace view public.transaction_log_entries as
select
  t.id,
  t.bot_id,
  b.user_id,
  b.name as bot_name,
  t.symbol,
  t.side,
  t.status,
  coalesce(t.pnl, 0) as pnl,
  coalesce(t.fee, 0) as fees,
  coalesce(t.amount, t.size, 0) as amount,
  coalesce(t.price, t.entry_price) as price,
  coalesce(t.exchange, b.exchange) as exchange,
  coalesce(t.executed_at, t.created_at) as executed_at,
  t.created_at,
  t.updated_at,
  null::timestamptz as closed_at,
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
  coalesce(pt.pnl, 0) as pnl,
  coalesce(pt.fees, 0) as fees,
  coalesce(pt.quantity, 0) as amount,
  pt.entry_price as price,
  coalesce(pt.exchange, b.exchange) as exchange,
  coalesce(pt.executed_at, pt.created_at) as executed_at,
  pt.created_at,
  pt.updated_at,
  null::timestamptz as closed_at,
  'paper'::text as mode
from public.paper_trading_trades pt
join public.trading_bots b on b.id = pt.bot_id;

comment on view public.transaction_log_entries is 'Unified view of real and paper trades for transaction reporting';

-- Refresh transaction log report helper to surface new fields
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
  )
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
    'amount', amount,
    'price', price,
    'exchange', exchange,
    'executedAt', executed_at,
    'createdAt', created_at,
    'updatedAt', updated_at,
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

commit;

