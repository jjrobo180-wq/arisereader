-- Arise Social (/social/): a career-discovery network for students, their parents and their teachers.
-- Accounts are the regular A.R.I.S.E. Reader accounts; these tables hold only Arise Social's own data.
-- Safe to run more than once.

-- Each student's progress: XP, streak, careers collected and saved, quest steps, roadmap checks.
create table if not exists public.social_profiles (
  user_id integer primary key references public.users(id) on delete cascade,
  xp integer not null default 0,
  streak integer not null default 0,
  last_active date,
  daily_date date,
  daily_xp integer not null default 0,
  collected jsonb not null default '[]'::jsonb,
  saved jsonb not null default '[]'::jsonb,
  quests jsonb not null default '{}'::jsonb,
  road jsonb not null default '[]'::jsonb,
  spun jsonb,
  -- Set by a linked parent: who can see this student's posts.
  post_scope text not null default 'class' check (post_scope in ('class', 'school')),
  updated_at timestamptz not null default now()
);

-- Posts. A student's post waits for their teacher's OK; a teacher's post is live at once.
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id integer not null references public.users(id) on delete cascade,
  author_role text not null check (author_role in ('student', 'teacher', 'admin')),
  -- The class the post belongs to: the student's teacher, or the teacher who wrote it.
  teacher_id integer references public.users(id) on delete set null,
  school_id integer,
  scope text not null default 'class' check (scope in ('class', 'school')),
  body text not null default '',
  quest_id text,
  career_id text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by integer references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists social_posts_teacher_idx on public.social_posts(teacher_id, status, created_at desc);
create index if not exists social_posts_school_idx on public.social_posts(school_id, status, created_at desc);
create index if not exists social_posts_author_idx on public.social_posts(author_id, created_at desc);

create table if not exists public.social_reactions (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id integer not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('respect', 'same', 'how', 'big')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Events are hosted by teachers for their own class or their whole school.
create table if not exists public.social_events (
  id uuid primary key default gen_random_uuid(),
  host_id integer not null references public.users(id) on delete cascade,
  school_id integer,
  scope text not null default 'class' check (scope in ('class', 'school')),
  title text not null,
  starts_on date not null,
  time_label text not null default '',
  format text not null default '',
  cluster text not null default 'help',
  seats integer not null default 30 check (seats between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists social_events_host_idx on public.social_events(host_id, starts_on);
create index if not exists social_events_school_idx on public.social_events(school_id, starts_on);

-- A K–5 student's RSVP waits for a parent ('requested'); everyone else goes straight to 'going'.
create table if not exists public.social_rsvps (
  event_id uuid not null references public.social_events(id) on delete cascade,
  user_id integer not null references public.users(id) on delete cascade,
  status text not null check (status in ('requested', 'going')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Only the server (service role) reads and writes these tables.
alter table public.social_profiles enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_reactions enable row level security;
alter table public.social_events enable row level security;
alter table public.social_rsvps enable row level security;
revoke all on table public.social_profiles, public.social_posts, public.social_reactions, public.social_events, public.social_rsvps from anon, authenticated;
grant select, insert, update, delete on table public.social_profiles, public.social_posts, public.social_reactions, public.social_events, public.social_rsvps to service_role;
