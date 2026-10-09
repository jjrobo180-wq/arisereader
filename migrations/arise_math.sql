-- Arise Math (/math/): K–12 math practice with points, a class leaderboard, assignments and live review.
-- Accounts are the regular A.R.I.S.E. Reader accounts; these tables hold only Arise Math's own data.
-- Math points live here and are separate from reading points. Safe to run more than once.

-- Each student's progress: points, week and day counts, streak, skill mastery, certificates, history, settings.
-- `data` is the whole profile (see shared/ariseMath.ts); `points` is copied out for sorting and reports.
create table if not exists public.math_profiles (
  user_id integer primary key references public.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  points integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Teachers' class settings: the grade band the class practices and how the leaderboard works.
create table if not exists public.math_class_settings (
  teacher_id integer primary key references public.users(id) on delete cascade,
  band text check (band in ('k2', 'g35', 'g68', 'g912')),
  board_show boolean not null default true,
  board_by text not null default 'points' check (board_by in ('points', 'effort')),
  updated_at timestamptz not null default now()
);

-- Practice assigned by a teacher to their class. Custom questions are kept with the assignment.
create table if not exists public.math_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id integer not null references public.users(id) on delete cascade,
  skill text not null,
  n integer not null check (n in (5, 10)),
  due date not null,
  title text not null,
  band text not null check (band in ('k2', 'g35', 'g68', 'g912')),
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists math_assignments_teacher_idx on public.math_assignments(teacher_id, created_at desc);

create table if not exists public.math_assignment_results (
  assignment_id uuid not null references public.math_assignments(id) on delete cascade,
  user_id integer not null references public.users(id) on delete cascade,
  score integer not null,
  total integer not null,
  finished_at timestamptz not null default now(),
  primary key (assignment_id, user_id)
);

-- One quiz a student is taking. The questions, with their answers, stay on the server.
create table if not exists public.math_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('skill', 'mixed', 'assign')),
  skill text,
  assignment_id uuid references public.math_assignments(id) on delete set null,
  items jsonb not null,
  cur integer not null default 0,
  points integer not null default 0,
  hints_any boolean not null default false,
  rank_before integer,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists math_sessions_user_idx on public.math_sessions(user_id, created_at desc);

-- Live review games: a teacher puts questions on the board and their class answers from their own devices.
create table if not exists public.math_live_games (
  id uuid primary key default gen_random_uuid(),
  teacher_id integer not null references public.users(id) on delete cascade,
  code text not null,
  band text not null check (band in ('k2', 'g35', 'g68', 'g912')),
  phase text not null default 'lobby' check (phase in ('lobby', 'q', 'reveal', 'done', 'ended')),
  qi integer not null default 0,
  question jsonb,
  q_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists math_live_code_idx on public.math_live_games(code, phase);
create index if not exists math_live_teacher_idx on public.math_live_games(teacher_id, phase, created_at desc);

create table if not exists public.math_live_players (
  game_id uuid not null references public.math_live_games(id) on delete cascade,
  user_id integer not null references public.users(id) on delete cascade,
  name text not null,
  score integer not null default 0,
  answer text,
  answered_qi integer not null default 0,
  primary key (game_id, user_id)
);

-- Only the server (service role) reads and writes these tables.
alter table public.math_profiles enable row level security;
alter table public.math_class_settings enable row level security;
alter table public.math_assignments enable row level security;
alter table public.math_assignment_results enable row level security;
alter table public.math_sessions enable row level security;
alter table public.math_live_games enable row level security;
alter table public.math_live_players enable row level security;
revoke all on table public.math_profiles, public.math_class_settings, public.math_assignments, public.math_assignment_results, public.math_sessions, public.math_live_games, public.math_live_players from anon, authenticated;
grant select, insert, update, delete on table public.math_profiles, public.math_class_settings, public.math_assignments, public.math_assignment_results, public.math_sessions, public.math_live_games, public.math_live_players to service_role;
