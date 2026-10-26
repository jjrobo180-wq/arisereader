-- Earshot (LifeHub podcast app): likes, comments and share counts shared between everyone on Arise.
-- Episode ids are Apple Podcasts track ids (digits only). The application authenticates people
-- through its own sessions, so only the server's service role may use these tables and functions.

create table if not exists public.earshot_likes (
  user_id bigint not null references public.users(id) on delete cascade,
  episode_id text not null check (episode_id ~ '^[0-9]{1,20}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);
create index if not exists earshot_likes_episode on public.earshot_likes (episode_id);

create table if not exists public.earshot_comments (
  id bigserial primary key,
  episode_id text not null check (episode_id ~ '^[0-9]{1,20}$'),
  show_id text not null default '' check (show_id ~ '^[0-9]{0,20}$'),
  user_id bigint not null references public.users(id) on delete cascade,
  author text not null check (char_length(author) between 1 and 40),
  body text not null check (char_length(body) between 1 and 280),
  reports integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists earshot_comments_episode on public.earshot_comments (episode_id, created_at desc);
create index if not exists earshot_comments_user on public.earshot_comments (user_id);

create table if not exists public.earshot_comment_reports (
  comment_id bigint not null references public.earshot_comments(id) on delete cascade,
  user_id bigint not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.earshot_shares (
  episode_id text primary key check (episode_id ~ '^[0-9]{1,20}$'),
  shares integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.earshot_likes enable row level security;
alter table public.earshot_comments enable row level security;
alter table public.earshot_comment_reports enable row level security;
alter table public.earshot_shares enable row level security;
revoke all on public.earshot_likes, public.earshot_comments, public.earshot_comment_reports, public.earshot_shares from anon, authenticated;
grant select, insert, update, delete on public.earshot_likes, public.earshot_comments, public.earshot_comment_reports, public.earshot_shares to service_role;
grant usage, select on sequence public.earshot_comments_id_seq to service_role;

drop policy if exists "server manages earshot likes" on public.earshot_likes;
create policy "server manages earshot likes" on public.earshot_likes for all to service_role using (true) with check (true);
drop policy if exists "server manages earshot comments" on public.earshot_comments;
create policy "server manages earshot comments" on public.earshot_comments for all to service_role using (true) with check (true);
drop policy if exists "server manages earshot reports" on public.earshot_comment_reports;
create policy "server manages earshot reports" on public.earshot_comment_reports for all to service_role using (true) with check (true);
drop policy if exists "server manages earshot shares" on public.earshot_shares;
create policy "server manages earshot shares" on public.earshot_shares for all to service_role using (true) with check (true);

-- Likes, visible comments and shares for up to 40 episodes at once.
create or replace function public.earshot_counts(p_episodes text[])
returns table (episode_id text, likes bigint, comments bigint, shares integer)
language sql stable set search_path = public as $$
  select e,
    (select count(*) from public.earshot_likes l where l.episode_id = e),
    (select count(*) from public.earshot_comments c where c.episode_id = e and not c.hidden),
    coalesce((select s.shares from public.earshot_shares s where s.episode_id = e), 0)
  from unnest(p_episodes[1:40]) as e;
$$;

create or replace function public.earshot_add_share(p_episode text)
returns integer language sql set search_path = public as $$
  insert into public.earshot_shares (episode_id, shares) values (p_episode, 1)
  on conflict (episode_id) do update set shares = public.earshot_shares.shares + 1, updated_at = now()
  returning shares;
$$;

-- One report per person; three reports hide a comment until an admin looks at it.
create or replace function public.earshot_report_comment(p_comment bigint, p_user bigint)
returns void language plpgsql set search_path = public as $$
declare n integer;
begin
  insert into public.earshot_comment_reports (comment_id, user_id) values (p_comment, p_user) on conflict do nothing;
  select count(*) into n from public.earshot_comment_reports where comment_id = p_comment;
  update public.earshot_comments set reports = n, hidden = hidden or n >= 3 where id = p_comment;
end;
$$;

revoke all on function public.earshot_counts(text[]) from public, anon, authenticated;
revoke all on function public.earshot_add_share(text) from public, anon, authenticated;
revoke all on function public.earshot_report_comment(bigint, bigint) from public, anon, authenticated;
grant execute on function public.earshot_counts(text[]) to service_role;
grant execute on function public.earshot_add_share(text) to service_role;
grant execute on function public.earshot_report_comment(bigint, bigint) to service_role;
