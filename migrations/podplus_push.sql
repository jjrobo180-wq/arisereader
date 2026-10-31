-- Pod+ iPhone notifications (server/podPush.ts): one row per phone, with the shows it follows.
-- Applied to the live database on Oct 30, 2026. Only the server (service role) reads or writes it.
create table if not exists public.podplus_push (
  token text primary key,
  follows text[] not null default '{}',
  seen jsonb not null default '{}'::jsonb,
  time_zone text not null default 'UTC',
  sent_day text not null default '',
  sent_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.podplus_push enable row level security;
revoke all on public.podplus_push from anon, authenticated;
