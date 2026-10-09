-- A.R.I.S.E. To-Do: Apple Health sync for the Food & fitness diary.
-- An iPhone Shortcut posts the day's steps, active calories and weight with a private key.
-- Only a SHA-256 hash of the key is stored. Read and written only by the server (service role).
create table if not exists public.arise_health_links (
  token_hash text primary key,
  user_id integer not null references public.users(id) on delete cascade,
  member_id text not null check (char_length(member_id) between 1 and 100),
  created_at timestamptz not null default now(),
  last_sync_at timestamptz,
  unique (user_id, member_id)
);

create table if not exists public.arise_health_sync (
  user_id integer not null references public.users(id) on delete cascade,
  member_id text not null check (char_length(member_id) between 1 and 100),
  day date not null,
  steps integer check (steps between 0 and 200000),
  active_calories integer check (active_calories between 0 and 20000),
  weight_lb numeric(6,1) check (weight_lb between 20 and 1500),
  updated_at timestamptz not null default now(),
  primary key (user_id, member_id, day)
);

alter table public.arise_health_links enable row level security;
alter table public.arise_health_sync enable row level security;
revoke all on table public.arise_health_links from anon, authenticated;
revoke all on table public.arise_health_sync from anon, authenticated;
grant select, insert, update, delete on table public.arise_health_links to service_role;
grant select, insert, update, delete on table public.arise_health_sync to service_role;
