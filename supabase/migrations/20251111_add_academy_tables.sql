-- =============================================
-- Pablo AI Trading - Academy schema
-- =============================================

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  audience text,
  summary text,
  media_url text,
  duration_minutes integer default 0,
  order_index integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.module_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  slug text not null,
  type text not null check (type in ('video','guide','quiz')),
  content_md text,
  media_url text,
  order_index integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, slug)
);

create table if not exists public.user_course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  module_id uuid not null references public.course_modules(id) on delete cascade,
  lesson_id uuid references public.module_lessons(id) on delete cascade,
  status text not null check (status in ('not_started','in_progress','completed')),
  completed_at timestamptz,
  quiz_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_course_progress_lesson_idx
  on public.user_course_progress (user_id, lesson_id)
  where lesson_id is not null;

create unique index if not exists user_course_progress_module_idx
  on public.user_course_progress (user_id, module_id)
  where lesson_id is null;

create or replace function public.set_timestamp_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_course_modules_updated on public.course_modules;
create trigger trg_course_modules_updated
before update on public.course_modules
for each row execute procedure public.set_timestamp_updated();

drop trigger if exists trg_module_lessons_updated on public.module_lessons;
create trigger trg_module_lessons_updated
before update on public.module_lessons
for each row execute procedure public.set_timestamp_updated();

drop trigger if exists trg_user_course_progress_updated on public.user_course_progress;
create trigger trg_user_course_progress_updated
before update on public.user_course_progress
for each row execute procedure public.set_timestamp_updated();

-- Seed initial modules -------------------------------------------------
insert into public.course_modules (title, slug, audience, summary, media_url, duration_minutes, order_index)
values
  ('Orientation & Setup', 'orientation-setup', 'New traders onboarding', 'Get acquainted with Pablo''s workspace, connect exchanges, and configure guardrails.', 'https://cdn.pablobots.net/academy/module1/hero.mp4', 25, 1),
  ('Platform Deep Dive', 'platform-deep-dive', 'Intermediate operators', 'Explore automation mesh, observability, and governance controls.', 'https://cdn.pablobots.net/academy/module2/hero.mp4', 40, 2),
  ('Crypto Foundations', 'crypto-foundations', 'All traders', 'Refresh core concepts for trading digital assets—volatility, liquidity, and risk.', 'https://cdn.pablobots.net/academy/module3/hero.mp4', 35, 3)
on conflict (slug) do nothing;

with module_ids as (
  select slug, id from public.course_modules where slug in ('orientation-setup','platform-deep-dive','crypto-foundations')
)
insert into public.module_lessons (module_id, title, slug, type, content_md, media_url, order_index)
select m.id,
       l.title,
       l.slug,
       l.type,
       l.content_md,
       l.media_url,
       l.order_index
from module_ids m
join (
  values
    ('orientation-setup','Welcome to Pablo','welcome','video','# Welcome to Pablo\n\nMeet the control center for your AI-powered strategies.','https://cdn.pablobots.net/academy/module1/lesson1.mp4',1),
    ('orientation-setup','Security & Accounts','security','guide','## Secure Onboarding\n\n1. Activate MFA\n2. Create API keys with read/write as needed\n3. Store credentials safely.','https://cdn.pablobots.net/academy/module1/lesson2.pdf',2),
    ('orientation-setup','First Automation Run','first-automation','guide','### Launch your first bot\n\nThis walkthrough uses a paper account so you can experiment safely.','https://cdn.pablobots.net/academy/module1/lesson3.md',3),

    ('platform-deep-dive','Workflow Automations','workflow','video','## Workflow Automations\n\nWatch how Pablo chains signals, risk, and execution.','https://cdn.pablobots.net/academy/module2/lesson1.mp4',1),
    ('platform-deep-dive','Monitoring & Alerts','monitoring','guide','### Observability Stack\n\nCustomize dashboards, create alert routes, and set guardrails.','https://cdn.pablobots.net/academy/module2/lesson2.md',2),
    ('platform-deep-dive','Knowledge Check','knowledge-check','quiz','{"questions":[{"question":"Which service orchestrates drawdown guardrails?","options":["Automation Mesh","Risk Engine","Signal Router","Monitoring Core"],"correctIndex":1},{"question":"Where do you configure alert channels?","options":["Monitoring & Alerts","Governance Center","Automation Mesh","Strategy Studio"],"correctIndex":0}]}',null,3),

    ('crypto-foundations','Market Microstructure','microstructure','video','## Market Microstructure\n\nUnderstand order books, liquidity pockets, and execution considerations.','https://cdn.pablobots.net/academy/module3/lesson1.mp4',1),
    ('crypto-foundations','Risk & Position Sizing','risk-position','guide','### Position Sizing Basics\n\nUse ATR, volatility buckets, and capital allocation frameworks.','https://cdn.pablobots.net/academy/module3/lesson2.md',2),
    ('crypto-foundations','Trading Psychology','psychology','guide','### Mindset Essentials\n\nDiscipline beats emotion. Set routines to review performance and adapt.',null,3)
) as l(module_slug,title,slug,type,content_md,media_url,order_index)
  on m.slug = l.module_slug
on conflict (module_id, slug) do nothing;

-- Summary view --------------------------------------------------------
create or replace view public.user_academy_summary as
with lesson_totals as (
  select
    cm.id as module_id,
    cm.order_index,
    count(ml.id) as total_lessons
  from public.course_modules cm
  left join public.module_lessons ml on ml.module_id = cm.id
  group by cm.id
),
lesson_progress as (
  select
    ucp.user_id,
    ucp.module_id,
    count(*) filter (where ucp.status = 'completed' and ucp.lesson_id is not null) as lessons_completed
  from public.user_course_progress ucp
  group by ucp.user_id, ucp.module_id
)
select
  u.id as user_id,
  coalesce(sum(case when lt.total_lessons > 0 and lp.lessons_completed >= lt.total_lessons then 1 else 0 end), 0) as modules_completed,
  (select count(*) from public.course_modules) as modules_available,
  coalesce(sum(lp.lessons_completed), 0) as lessons_completed,
  (coalesce(sum(case when lt.total_lessons > 0 and lp.lessons_completed >= lt.total_lessons then 1 else 0 end), 0) >= 3) as badge_foundation_finisher,
  u.status as current_status
from public.users u
left join lesson_totals lt on true
left join lesson_progress lp on lp.user_id = u.id and lp.module_id = lt.module_id
group by u.id;

-- Row level security --------------------------------------------------
alter table public.course_modules enable row level security;
alter table public.module_lessons enable row level security;
alter table public.user_course_progress enable row level security;

drop policy if exists "Modules readable by everyone" on public.course_modules;
create policy "Modules readable by everyone"
  on public.course_modules
  for select using (true);

drop policy if exists "Lessons readable by everyone" on public.module_lessons;
create policy "Lessons readable by everyone"
  on public.module_lessons
  for select using (true);

drop policy if exists "Progress selectable by owner" on public.user_course_progress;
create policy "Progress selectable by owner"
  on public.user_course_progress
  for select using (auth.uid() = user_id);

drop policy if exists "Progress insert by owner" on public.user_course_progress;
create policy "Progress insert by owner"
  on public.user_course_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "Progress update by owner" on public.user_course_progress;
create policy "Progress update by owner"
  on public.user_course_progress
  for update using (auth.uid() = user_id);

-- RPC helper ----------------------------------------------------------
create or replace function public.record_lesson_progress(
  p_module_slug text,
  p_lesson_slug text,
  p_status text,
  p_quiz_score numeric default null
) returns public.user_course_progress
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_module_id uuid;
  v_lesson_id uuid;
  v_status text := coalesce(p_status, 'in_progress');
  v_progress public.user_course_progress;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_module_id from public.course_modules where slug = p_module_slug;
  if v_module_id is null then
    raise exception 'Module not found';
  end if;

  if p_lesson_slug is not null then
    select id into v_lesson_id from public.module_lessons where module_id = v_module_id and slug = p_lesson_slug;
    if v_lesson_id is null then
      raise exception 'Lesson not found';
    end if;
  end if;

  if v_status not in ('not_started','in_progress','completed') then
    raise exception 'Invalid status';
  end if;

  if v_lesson_id is not null then
    insert into public.user_course_progress (user_id, module_id, lesson_id, status, completed_at, quiz_score)
    values (v_user_id, v_module_id, v_lesson_id, v_status, case when v_status = 'completed' then now() else null end, p_quiz_score)
    on conflict (user_id, lesson_id)
    do update set
      status = excluded.status,
      completed_at = case when excluded.status = 'completed' then now() else user_course_progress.completed_at end,
      quiz_score = excluded.quiz_score,
      updated_at = now()
    returning * into v_progress;
  else
    insert into public.user_course_progress (user_id, module_id, lesson_id, status, completed_at, quiz_score)
    values (v_user_id, v_module_id, null, v_status, case when v_status = 'completed' then now() else null end, p_quiz_score)
    on conflict (user_id, module_id)
    do update set
      status = excluded.status,
      completed_at = case when excluded.status = 'completed' then now() else user_course_progress.completed_at end,
      quiz_score = excluded.quiz_score,
      updated_at = now()
    returning * into v_progress;
  end if;

  return v_progress;
end;
$$;

grant execute on function public.record_lesson_progress(text, text, text, numeric) to authenticated;

grant select on public.course_modules, public.module_lessons, public.user_academy_summary to authenticated;
grant select on public.course_modules, public.module_lessons to anon;

grant select, insert, update on public.user_course_progress to authenticated;
