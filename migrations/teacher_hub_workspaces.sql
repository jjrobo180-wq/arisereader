create table if not exists public.teacher_hub_workspaces (
  teacher_id integer primary key references public.users(id) on delete cascade,
  workspace jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_hub_workspace_is_object check (jsonb_typeof(workspace) = 'object')
);

alter table public.teacher_hub_workspaces enable row level security;

revoke all on table public.teacher_hub_workspaces from anon, authenticated;
grant select, insert, update, delete on table public.teacher_hub_workspaces to service_role;

create index if not exists teacher_hub_workspaces_updated_at_idx
  on public.teacher_hub_workspaces(updated_at desc);
