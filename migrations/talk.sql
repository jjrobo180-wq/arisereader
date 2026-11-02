-- Arise Talk (server/talk.ts): each person's backed-up boards, phrases and settings, and Premium.
-- Only the server (service_role) reads or writes it. Safe to run more than once.
create table if not exists public.talk_users (
  user_id integer primary key references public.users(id) on delete cascade,
  data jsonb,
  premium_until timestamptz,
  plan text check (plan in ('month', 'year')),
  stripe_customer text,
  stripe_sub text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.talk_users enable row level security;
