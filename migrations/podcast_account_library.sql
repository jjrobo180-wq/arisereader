-- Podster: a signed-in account's listening library (shows followed, saved, liked, Pod Modes, resume
-- spots), saved by the phone so the Apple TV app and other signed-in devices can show it
-- (server/podcastAccounts.ts /api/podscroll/account/library). Goes with the account.
create table if not exists public.podcast_account_library (
  account_id bigint primary key references public.podcast_accounts(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.podcast_account_library enable row level security;
revoke all on public.podcast_account_library from anon, authenticated;
grant select, insert, update, delete on public.podcast_account_library to service_role;
drop policy if exists "server manages podcast_account_library" on public.podcast_account_library;
create policy "server manages podcast_account_library" on public.podcast_account_library for all to service_role using (true) with check (true);
