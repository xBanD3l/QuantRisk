-- Quant Committee AI: profiles, user data, usage analytics with RLS

create extension if not exists "pgcrypto";

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, last_login)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    last_login = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Saved analyses
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text not null,
  horizon integer not null,
  created_at timestamptz not null default now(),
  committee_summary jsonb default '[]'::jsonb,
  model_outputs jsonb default '[]'::jsonb,
  consensus jsonb default '{}'::jsonb,
  analysis_id text
);

create index if not exists analyses_user_id_created_at_idx
  on public.analyses (user_id, created_at desc);

alter table public.analyses enable row level security;

create policy "Users manage own analyses"
  on public.analyses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Saved portfolios
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  holdings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists portfolios_user_id_created_at_idx
  on public.portfolios (user_id, created_at desc);

alter table public.portfolios enable row level security;

create policy "Users manage own portfolios"
  on public.portfolios for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Generated reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_url text not null,
  ticker text,
  analysis_id text,
  created_at timestamptz not null default now()
);

create index if not exists reports_user_id_created_at_idx
  on public.reports (user_id, created_at desc);

alter table public.reports enable row level security;

create policy "Users manage own reports"
  on public.reports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Aggregate usage analytics (minimal PII)
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_event_name_idx on public.usage_events (event_name);
create index if not exists usage_events_created_at_idx on public.usage_events (created_at desc);

alter table public.usage_events enable row level security;

create policy "Authenticated users insert own usage events"
  on public.usage_events for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "Users read own usage events"
  on public.usage_events for select
  using (auth.uid() = user_id);
