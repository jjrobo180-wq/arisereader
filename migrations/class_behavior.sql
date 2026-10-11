-- Class behavior (WorkHub's Behavior tab): points for behaviors, hall passes, and each teacher's settings.
-- Safe to run more than once.
create table if not exists public.behavior_settings (
  teacher_id integer primary key references public.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.behavior_events (
  id uuid primary key default gen_random_uuid(),
  teacher_id integer not null references public.users(id) on delete cascade,
  student_id integer not null references public.users(id) on delete cascade,
  points integer not null default 0,
  label text not null default '',
  note text not null default '',
  share boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists behavior_events_teacher_idx on public.behavior_events(teacher_id, created_at desc);
create index if not exists behavior_events_student_idx on public.behavior_events(student_id, created_at desc);
create table if not exists public.hall_passes (
  id uuid primary key default gen_random_uuid(),
  teacher_id integer not null references public.users(id) on delete cascade,
  student_id integer not null references public.users(id) on delete cascade,
  place text not null,
  status text not null default 'asked' check (status in ('asked', 'out', 'back', 'denied')),
  limit_min integer not null default 5,
  asked_at timestamptz not null default now(),
  out_at timestamptz,
  back_at timestamptz
);
create index if not exists hall_passes_teacher_idx on public.hall_passes(teacher_id, asked_at desc);
create index if not exists hall_passes_student_idx on public.hall_passes(student_id, asked_at desc);
alter table public.behavior_settings enable row level security;
alter table public.behavior_events enable row level security;
alter table public.hall_passes enable row level security;
revoke all on table public.behavior_settings, public.behavior_events, public.hall_passes from anon, authenticated;
grant select, insert, update, delete on table public.behavior_settings, public.behavior_events, public.hall_passes to service_role;
