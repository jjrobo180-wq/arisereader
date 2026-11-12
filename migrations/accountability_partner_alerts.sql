-- Accountability notifications (server/accountability.ts): each member's own settings for which
-- alerts they get, per space, and a record of one-time partner alerts (a missed deadline) so the
-- minute-by-minute pass sends each just once. Applied to Supabase project swsyalnajzizfwazqwpd.
alter table public.acct_members add column if not exists notify jsonb not null default '{}'::jsonb;
create table if not exists public.acct_alerts (
  task_id text not null,
  day text not null,
  kind text not null,
  at timestamptz not null default now(),
  primary key (task_id, day, kind)
);
alter table public.acct_alerts enable row level security;
create index if not exists acct_alerts_at on public.acct_alerts (at);
