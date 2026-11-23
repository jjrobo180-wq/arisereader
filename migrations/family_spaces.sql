-- FamilyHub: one shared Arise To Duo hub for a whole family, beside each person's own LifeHub and WorkHub.
-- The person who starts it owns it; others join with its code. Everyone in it reads and saves the same workspace.
create table if not exists public.family_spaces (
  owner_id integer primary key references public.users(id) on delete cascade,
  name text not null default 'Family',
  code text not null unique,
  workspace jsonb,
  updated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint family_space_object check (workspace is null or jsonb_typeof(workspace) = 'object'),
  constraint family_space_limit check (workspace is null or pg_column_size(workspace) <= 2000000)
);
create table if not exists public.family_space_members (
  user_id integer primary key references public.users(id) on delete cascade,
  owner_id integer not null references public.family_spaces(owner_id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists family_space_members_owner_idx on public.family_space_members(owner_id);
alter table public.family_spaces enable row level security;
alter table public.family_space_members enable row level security;
revoke all on table public.family_spaces, public.family_space_members from anon, authenticated;
grant select, insert, update, delete on table public.family_spaces, public.family_space_members to service_role;
