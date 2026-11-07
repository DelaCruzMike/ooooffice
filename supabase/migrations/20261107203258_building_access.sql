-- Additive building protocol 5 migration. Apply only during coordinated release.
-- Existing approval/roles and room keys are preserved.
begin;
alter table public.memberships add column if not exists floors text[];
update public.memberships set floors = case when approved then array['3']::text[] else array[]::text[] end where floors is null;
alter table public.memberships alter column floors set default array[]::text[];
alter table public.memberships alter column floors set not null;
alter table public.memberships add column if not exists managed_floors text[] not null default array[]::text[];
alter table public.memberships add column if not exists access_requested boolean not null default false;
alter table public.memberships add constraint memberships_valid_floors check (floors <@ array['1','2','3','4']::text[]);
alter table public.memberships add constraint memberships_valid_managed_floors check (managed_floors <@ array['1','2','3','4']::text[]);
alter table public.memberships enable row level security;
alter table public.office_config enable row level security;
revoke all on public.memberships, public.office_config from anon, authenticated;
grant all on public.memberships, public.office_config to service_role;
insert into public.office_config(key,value) values ('it:inventory','""'::jsonb) on conflict (key) do nothing;
commit;
