-- AriseScholar (server/scholar.ts): academic points teachers give (work completed, participation, focused).
-- Safe to run more than once.
create table if not exists public.scholar_points (
  id uuid primary key default gen_random_uuid(),
  teacher_id integer not null references public.users(id) on delete cascade,
  student_id integer not null references public.users(id) on delete cascade,
  school_id integer not null,
  category text not null check (category in ('work', 'participation', 'focused')),
  points integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists scholar_points_school_idx on public.scholar_points(school_id, created_at);
create index if not exists scholar_points_teacher_idx on public.scholar_points(teacher_id, created_at);
create index if not exists scholar_points_student_idx on public.scholar_points(student_id, created_at);
alter table public.scholar_points enable row level security;
revoke all on table public.scholar_points from anon, authenticated;
grant select, insert, update, delete on table public.scholar_points to service_role;
