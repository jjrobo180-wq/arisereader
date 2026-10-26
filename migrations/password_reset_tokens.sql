-- Single-use links for "Forgot your username or password?" (server/accountRecovery.ts).
-- Only a SHA-256 hash of each link's token is stored; links expire after an hour.
create table if not exists public.password_reset_tokens (
  token_hash text primary key,
  user_id integer not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists password_reset_tokens_user_idx on public.password_reset_tokens (user_id);
alter table public.password_reset_tokens enable row level security;
