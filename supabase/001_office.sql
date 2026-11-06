-- Run in a new Supabase project. Idempotent; no sample people or private work links.
create table if not exists public.memberships (
  email text primary key check (email = lower(email)),
  role text not null default 'member' check (role in ('owner','administrator','member')),
  approved boolean not null default false,
  department text not null default 'Team',
  created_at timestamptz not null default now()
);
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  avatar jsonb not null default '{}'::jsonb
);
create table if not exists public.office_config (
  key text primary key,
  value jsonb not null
);
alter table public.memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.office_config enable row level security;
-- All application reads/writes go through the authenticated office server.
-- No browser table access, including for users who authenticate but are unapproved.
revoke all on public.memberships, public.profiles, public.office_config from anon, authenticated;
grant all on public.memberships, public.profiles, public.office_config to service_role;
insert into public.office_config(key,value) values ('links','[]'::jsonb) on conflict (key) do nothing;
