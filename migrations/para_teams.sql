-- Para Team (Arise WorkHub): a shared space for a teacher and their paras and 1:1s.
-- A teacher makes a team and sends an invite link; anyone who opens it and signs in joins as a para.
-- Everything the team shares (messages, calendar, to-dos, schedule, students, data, lessons, links,
-- files, team notes) is one row in para_team_items, read only through the server. Safe to run twice.
create table if not exists public.para_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id integer not null references public.users(id) on delete cascade,
  name text not null,
  invite_code text not null unique,
  invite_on boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists para_teams_owner_idx on public.para_teams(owner_id);

create table if not exists public.para_team_members (
  team_id uuid not null references public.para_teams(id) on delete cascade,
  user_id integer not null references public.users(id) on delete cascade,
  role text not null default 'para' check (role in ('lead', 'para')),
  title text not null default '',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists para_team_members_user_idx on public.para_team_members(user_id);

create table if not exists public.para_team_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.para_teams(id) on delete cascade,
  kind text not null check (kind in ('message', 'event', 'task', 'schedule', 'student', 'log', 'lesson', 'link', 'file', 'note')),
  data jsonb not null default '{}'::jsonb,
  created_by integer references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint para_team_item_is_object check (jsonb_typeof(data) = 'object')
);
create index if not exists para_team_items_team_idx on public.para_team_items(team_id, kind, created_at desc);
create index if not exists para_team_items_updated_idx on public.para_team_items(team_id, updated_at desc);

alter table public.para_teams enable row level security;
alter table public.para_team_members enable row level security;
alter table public.para_team_items enable row level security;
revoke all on table public.para_teams, public.para_team_members, public.para_team_items from anon, authenticated;
grant select, insert, update, delete on table public.para_teams, public.para_team_members, public.para_team_items to service_role;
