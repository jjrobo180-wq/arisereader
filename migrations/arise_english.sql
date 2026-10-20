-- English Explorer: the English-language-learner program inside A.R.I.S.E. Reader (server/ariseEnglish.ts,
-- shared/ariseEnglish.ts). A teacher or the administrator turns it on for a student; points earned here are
-- written to manual_point_awards, so they count on the regular A.R.I.S.E. leaderboards.
-- Accounts are the regular A.R.I.S.E. accounts. Safe to run more than once.

-- Who has English Explorer, the level they start at, and their home language.
create table if not exists public.english_learners (
  student_id integer primary key references public.users(id) on delete cascade,
  enabled boolean not null default true,
  start_level integer not null default 1 check (start_level between 1 and 6),
  home_language text,
  help_on boolean not null default true,
  note text not null default '',
  enabled_by integer references public.users(id) on delete set null,
  enabled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Each word a student has practiced, in its spaced-repetition box (1 = tomorrow … 5 = in 16 days).
create table if not exists public.english_words (
  student_id integer not null references public.users(id) on delete cascade,
  word_id text not null,
  box integer not null default 1 check (box between 0 and 5),
  right_count integer not null default 0,
  wrong_count integer not null default 0,
  last_at timestamptz,
  due_at timestamptz,
  primary key (student_id, word_id)
);
create index if not exists english_words_due on public.english_words (student_id, due_at);

-- Each unit a student has played: best stars and score.
create table if not exists public.english_units (
  student_id integer not null references public.users(id) on delete cascade,
  unit_id text not null,
  stars integer not null default 0 check (stars between 0 and 3),
  best integer not null default 0 check (best between 0 and 100),
  plays integer not null default 0,
  first_done_at timestamptz,
  last_at timestamptz,
  primary key (student_id, unit_id)
);

-- Every lesson and review: the questions (with the answer key, which never leaves the server), each
-- answer, the score, the points and how long it took. These are what the teachers' reports are made of.
create table if not exists public.english_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id integer not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('lesson', 'review')),
  unit_id text,
  items jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'done')),
  score integer not null default 0,
  total integer not null default 0,
  points integer not null default 0,
  stars integer not null default 0,
  preview boolean not null default false,
  skills jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists english_sessions_student on public.english_sessions (student_id, started_at desc);

-- Only the server reads and writes these (through the service role).
alter table public.english_learners enable row level security;
alter table public.english_words enable row level security;
alter table public.english_units enable row level security;
alter table public.english_sessions enable row level security;
revoke all on public.english_learners, public.english_words, public.english_units, public.english_sessions from anon, authenticated;
