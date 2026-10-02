-- Aurora Racers progression (coins, karts, upgrades, best times) for each student.
-- The application authenticates players through its own sessions, so only the
-- server's service role may access this table through Supabase's Data API.
create table if not exists public.racing_saves (
  user_id bigint primary key references public.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint racing_saves_data_object check (jsonb_typeof(data) = 'object')
);

alter table public.racing_saves enable row level security;
revoke all on public.racing_saves from anon, authenticated;
grant select, insert, update, delete on public.racing_saves to service_role;

drop policy if exists "server manages racing saves" on public.racing_saves;
create policy "server manages racing saves"
  on public.racing_saves for all to service_role
  using (true) with check (true);
