-- No-proctor quizzes: a student can take a book quiz on their own while the
-- camera takes snapshots. One session per try, plus a log of what happened.
create table if not exists public.quiz_integrity_sessions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  student_id integer not null references public.users(id) on delete cascade,
  quiz_kind text not null default 'book' check (quiz_kind in ('book')),
  quiz_id integer not null,
  status text not null default 'active' check (status in ('active', 'submitted', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  restarts integer not null default 0,
  last_snapshot_at timestamptz,
  attempt_id integer references public.attempts(id) on delete set null,
  score integer,
  total integer,
  points_awarded numeric not null default 0,
  duration_ms integer,
  leaves integer not null default 0,
  away_ms integer not null default 0,
  copy_attempts integer not null default 0,
  camera_off integer not null default 0,
  snapshot_count integer not null default 0,
  auto_submitted boolean not null default false,
  answer_times jsonb,
  flag text not null default 'clear' check (flag in ('clear', 'review', 'high')),
  flag_reasons jsonb not null default '[]'::jsonb,
  voided boolean not null default false,
  voided_at timestamptz,
  voided_by integer references public.users(id) on delete set null,
  void_reason text,
  snapshots_purged boolean not null default false
);
create index if not exists quiz_integrity_sessions_student_idx on public.quiz_integrity_sessions (student_id, created_at desc);
create index if not exists quiz_integrity_sessions_created_idx on public.quiz_integrity_sessions (created_at desc);

create table if not exists public.quiz_integrity_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.quiz_integrity_sessions(id) on delete cascade,
  at timestamptz not null default now(),
  type text not null,
  detail jsonb
);
create index if not exists quiz_integrity_events_session_idx on public.quiz_integrity_events (session_id, at);

-- Only the server (service role) reads and writes these, like the other tables.
alter table public.quiz_integrity_sessions enable row level security;
alter table public.quiz_integrity_events enable row level security;

-- Private bucket for the camera snapshots (deleted after 30 days by the server).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-integrity', 'quiz-integrity', false, 204800, array['image/jpeg'])
on conflict (id) do nothing;
