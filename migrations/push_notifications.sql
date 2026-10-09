-- Phones and browsers that turned on notifications (Web Push), one row per device.
create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  time_zone text not null default 'UTC',
  sent jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

-- The site's push sign-in keys, made once and kept (unless VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are set).
create table if not exists public.push_settings (
  id integer primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.push_settings enable row level security;
revoke all on table public.push_subscriptions, public.push_settings from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions, public.push_settings to service_role;
grant usage, select on sequence public.push_subscriptions_id_seq to service_role;
