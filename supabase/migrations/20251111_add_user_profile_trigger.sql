-- Ensure every auth user has a matching row in public.users
create or replace function public.ensure_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, role, status, status_updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_app_meta_data->>'role', 'user'),
    'active',
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(excluded.name, public.users.name),
        status_updated_at = now();

  return new;
end;
$$;

drop trigger if exists ensure_user_profile on auth.users;

create trigger ensure_user_profile
after insert on auth.users
for each row execute procedure public.ensure_user_profile();

-- Grant admins full access to trading_bots regardless of owner
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = current_schema()
      and tablename = 'trading_bots'
      and polname = 'Admins can manage bots'
  ) then
    create policy "Admins can manage bots"
      on trading_bots
      for all
      using (
        exists (
          select 1 from public.users
          where id = auth.uid()
            and role = 'admin'
        )
      )
      with check (
        exists (
          select 1 from public.users
          where id = auth.uid()
            and role = 'admin'
        )
      );
  end if;
end;
$$;

