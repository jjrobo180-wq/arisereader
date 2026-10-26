-- Podscroll (the Earshot podcast app as its own website, podscroll.onrender.com): likes, comments
-- and share counts. Podscroll has no accounts, so people are an anonymous device id (user_id text)
-- that each browser makes for itself. Only the server's service role may use these tables.

create table if not exists public.podscroll_likes (
  user_id text not null check (user_id ~ '^[A-Za-z0-9_-]{16,40}$'),
  episode_id text not null check (episode_id ~ '^[0-9]{1,20}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);
create index if not exists podscroll_likes_episode on public.podscroll_likes (episode_id);

create table if not exists public.podscroll_comments (
  id bigserial primary key,
  episode_id text not null check (episode_id ~ '^[0-9]{1,20}$'),
  show_id text not null default '' check (show_id ~ '^[0-9]{0,20}$'),
  user_id text not null check (user_id ~ '^[A-Za-z0-9_-]{16,40}$'),
  author text not null check (char_length(author) between 1 and 40),
  body text not null check (char_length(body) between 1 and 280),
  reports integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists podscroll_comments_episode on public.podscroll_comments (episode_id, created_at desc);
create index if not exists podscroll_comments_user on public.podscroll_comments (user_id);

create table if not exists public.podscroll_comment_reports (
  comment_id bigint not null references public.podscroll_comments(id) on delete cascade,
  user_id text not null check (user_id ~ '^[A-Za-z0-9_-]{16,40}$'),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.podscroll_shares (
  episode_id text primary key check (episode_id ~ '^[0-9]{1,20}$'),
  shares integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.podscroll_likes enable row level security;
alter table public.podscroll_comments enable row level security;
alter table public.podscroll_comment_reports enable row level security;
alter table public.podscroll_shares enable row level security;
revoke all on public.podscroll_likes, public.podscroll_comments, public.podscroll_comment_reports, public.podscroll_shares from anon, authenticated;
grant select, insert, update, delete on public.podscroll_likes, public.podscroll_comments, public.podscroll_comment_reports, public.podscroll_shares to service_role;
grant usage, select on sequence public.podscroll_comments_id_seq to service_role;

drop policy if exists "server manages podscroll likes" on public.podscroll_likes;
create policy "server manages podscroll likes" on public.podscroll_likes for all to service_role using (true) with check (true);
drop policy if exists "server manages podscroll comments" on public.podscroll_comments;
create policy "server manages podscroll comments" on public.podscroll_comments for all to service_role using (true) with check (true);
drop policy if exists "server manages podscroll reports" on public.podscroll_comment_reports;
create policy "server manages podscroll reports" on public.podscroll_comment_reports for all to service_role using (true) with check (true);
drop policy if exists "server manages podscroll shares" on public.podscroll_shares;
create policy "server manages podscroll shares" on public.podscroll_shares for all to service_role using (true) with check (true);

-- Likes, visible comments and shares for up to 40 episodes at once.
create or replace function public.podscroll_counts(p_episodes text[])
returns table (episode_id text, likes bigint, comments bigint, shares integer)
language sql stable set search_path = public as $$
  select e,
    (select count(*) from public.podscroll_likes l where l.episode_id = e),
    (select count(*) from public.podscroll_comments c where c.episode_id = e and not c.hidden),
    coalesce((select s.shares from public.podscroll_shares s where s.episode_id = e), 0)
  from unnest(p_episodes[1:40]) as e;
$$;

create or replace function public.podscroll_add_share(p_episode text)
returns integer language sql set search_path = public as $$
  insert into public.podscroll_shares (episode_id, shares) values (p_episode, 1)
  on conflict (episode_id) do update set shares = public.podscroll_shares.shares + 1, updated_at = now()
  returning shares;
$$;

-- One report per person; three reports hide a comment until an admin looks at it.
create or replace function public.podscroll_report_comment(p_comment bigint, p_user text)
returns void language plpgsql set search_path = public as $$
declare n integer;
begin
  insert into public.podscroll_comment_reports (comment_id, user_id) values (p_comment, p_user) on conflict do nothing;
  select count(*) into n from public.podscroll_comment_reports where comment_id = p_comment;
  update public.podscroll_comments set reports = n, hidden = hidden or n >= 3 where id = p_comment;
end;
$$;

revoke all on function public.podscroll_counts(text[]) from public, anon, authenticated;
revoke all on function public.podscroll_add_share(text) from public, anon, authenticated;
revoke all on function public.podscroll_report_comment(bigint, text) from public, anon, authenticated;
grant execute on function public.podscroll_counts(text[]) to service_role;
grant execute on function public.podscroll_add_share(text) to service_role;
grant execute on function public.podscroll_report_comment(bigint, text) to service_role;
