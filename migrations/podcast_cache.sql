-- Earshot and Podscroll: the podcast directory's saved answers (Apple Podcasts lookups, genre pools,
-- RSS transcript links, and transcripts with their ads), so the apps start fast after a restart and
-- each transcript is only made once. Only the server's service role may use it.
create table if not exists public.podcast_cache (
  key text primary key check (char_length(key) between 1 and 200),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.podcast_cache enable row level security;
revoke all on public.podcast_cache from anon, authenticated;
grant select, insert, update, delete on public.podcast_cache to service_role;
drop policy if exists "server manages podcast cache" on public.podcast_cache;
create policy "server manages podcast cache" on public.podcast_cache for all to service_role using (true) with check (true);
