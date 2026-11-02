-- Arise Coaching (server/coach.ts): trainers' listings, client–trainer connections, messages, reviews and
-- each trainer's library. Only the server (service_role) reads or writes these. Safe to run more than once.
create table if not exists public.coach_trainers (
  user_id integer primary key references public.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  paid_until timestamptz,
  stripe_customer text,
  stripe_sub text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coach_trainers_paid_idx on public.coach_trainers(paid_until);

create table if not exists public.coach_links (
  id uuid primary key default gen_random_uuid(),
  trainer_id integer not null references public.users(id) on delete cascade,
  client_id integer not null references public.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'active', 'declined', 'ended')),
  consent jsonb not null default '{}'::jsonb,
  coaching jsonb not null default '{}'::jsonb,
  client_side jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trainer_id, client_id)
);
create index if not exists coach_links_client_idx on public.coach_links(client_id);

create table if not exists public.coach_messages (
  id bigserial primary key,
  link_id uuid not null references public.coach_links(id) on delete cascade,
  sender_id integer not null references public.users(id) on delete cascade,
  body text not null default '',
  img text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists coach_messages_link_idx on public.coach_messages(link_id, id);

create table if not exists public.coach_reviews (
  id uuid primary key default gen_random_uuid(),
  trainer_id integer not null references public.users(id) on delete cascade,
  client_id integer not null references public.users(id) on delete cascade,
  name text not null default '',
  stars integer not null check (stars between 1 and 5),
  text text not null default '',
  reply text,
  created_at timestamptz not null default now(),
  unique (trainer_id, client_id)
);

create table if not exists public.coach_library (
  trainer_id integer primary key references public.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.coach_trainers enable row level security;
alter table public.coach_links enable row level security;
alter table public.coach_messages enable row level security;
alter table public.coach_reviews enable row level security;
alter table public.coach_library enable row level security;
revoke all on table public.coach_trainers, public.coach_links, public.coach_messages, public.coach_reviews, public.coach_library from anon, authenticated;
grant select, insert, update, delete on table public.coach_trainers, public.coach_links, public.coach_messages, public.coach_reviews, public.coach_library to service_role;
grant usage, select on sequence public.coach_messages_id_seq to service_role;
