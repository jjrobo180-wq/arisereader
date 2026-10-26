-- Creators for Pod+ (Podscroll) and Earshot (LifeHub): email sign-in for Pod+ creators, listening
-- stats for episodes people made, LivePod sessions, and the Pod+ Rise waitlist. Adds to
-- migrations/podcast_social.sql and podcast_social_v2.sql; nothing is removed.
-- Only the server's service role may use these tables.

-- Pod+ has no accounts for listening. Creators sign in with an email code; the account keeps the
-- device id their profile was made on, so their profile, posts and followers come with them.
create table if not exists public.podcast_accounts (
  id bigserial primary key,
  email text not null unique check (char_length(email) between 3 and 254),
  device text not null check (char_length(device) between 16 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.podcast_account_sessions (
  token_hash text primary key,
  account_id bigint not null references public.podcast_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create index if not exists podcast_account_sessions_account on public.podcast_account_sessions (account_id);

create table if not exists public.podcast_account_codes (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  tries int not null default 0,
  sent_day date not null default current_date,
  sent_today int not null default 0,
  sent_at timestamptz not null default now()
);

-- Listening to episodes people made, one row per episode, listener and day.
create table if not exists public.podcast_listens (
  post_id bigint not null references public.podcast_posts(id) on delete cascade,
  voter text not null check (char_length(voter) between 2 and 60),
  day date not null default current_date,
  secs int not null default 0 check (secs >= 0),
  source text not null default 'other' check (source in ('openmic', 'foryou', 'social', 'profile', 'other')),
  updated_at timestamptz not null default now(),
  primary key (post_id, voter, day)
);
create index if not exists podcast_listens_post_day on public.podcast_listens (post_id, day);

-- LivePods that have ended, for the creator's Studio.
create table if not exists public.podcast_live_sessions (
  id bigserial primary key,
  voter text not null references public.podcast_profiles(voter) on delete cascade,
  title text not null default '' check (char_length(title) <= 100),
  started_at timestamptz not null,
  ended_at timestamptz not null default now(),
  peak int not null default 0,
  listeners int not null default 0,
  comments int not null default 0,
  cheers int not null default 0,
  cheer_points int not null default 0,
  likes int not null default 0,
  shares int not null default 0
);
create index if not exists podcast_live_sessions_voter on public.podcast_live_sessions (voter, started_at desc);

create table if not exists public.podcast_rise_waitlist (
  voter text primary key references public.podcast_profiles(voter) on delete cascade,
  created_at timestamptz not null default now()
);

-- Followers hear about new episodes.
alter table public.podcast_notifications drop constraint if exists podcast_notifications_kind_check;
alter table public.podcast_notifications add constraint podcast_notifications_kind_check
  check (kind in ('like', 'comment', 'reply', 'follow', 'repost', 'comment_like', 'episode'));

do $$ declare t text; begin
  foreach t in array array['podcast_accounts','podcast_account_sessions','podcast_account_codes','podcast_listens','podcast_live_sessions','podcast_rise_waitlist'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('drop policy if exists "server manages %s" on public.%I', t, t);
    execute format('create policy "server manages %s" on public.%I for all to service_role using (true) with check (true)', t, t);
  end loop;
end $$;
grant usage, select on sequence public.podcast_accounts_id_seq to service_role;
grant usage, select on sequence public.podcast_live_sessions_id_seq to service_role;
