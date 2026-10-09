-- Teacher Hub: before the first change of each day, a copy of the teacher's Hub is kept (the last 14 days),
-- so a mistake can be taken back. Safe to run more than once.
create table if not exists public.teacher_hub_backups (
  teacher_id integer not null references public.users(id) on delete cascade,
  day date not null,
  kind text not null default 'daily',
  workspace jsonb not null,
  students integer not null default 0,
  saved_at timestamptz not null default now(),
  primary key (teacher_id, day, kind),
  constraint teacher_hub_backup_kind check (kind in ('daily', 'restore'))
);
alter table public.teacher_hub_backups enable row level security;
revoke all on table public.teacher_hub_backups from anon, authenticated;
grant select, insert, update, delete on table public.teacher_hub_backups to service_role;
