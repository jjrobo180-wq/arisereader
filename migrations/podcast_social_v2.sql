-- Social v2 for Earshot (LifeHub) and Podscroll: text posts, audio clips and reposts, comments with
-- replies and likes, and notifications. Adds to migrations/podcast_social.sql; nothing is removed.
-- Only the server's service role may use these tables. Clip audio is kept in the "podcast-uploads"
-- bucket under clips/ (and Explore previews under moments/).

-- Posts: plain text, a clip (a moment of an episode, its audio cut and kept), and reposts.
alter table public.podcast_posts drop constraint if exists podcast_posts_kind_check;
alter table public.podcast_posts add constraint podcast_posts_kind_check check (kind in ('share', 'bookmark', 'own', 'text', 'clip', 'repost'));
alter table public.podcast_posts add column if not exists clip jsonb;
alter table public.podcast_posts add column if not exists repost_of bigint references public.podcast_posts(id) on delete cascade;
create index if not exists podcast_posts_clips on public.podcast_posts (created_at desc) where kind = 'clip' and not hidden;
create index if not exists podcast_posts_reposts on public.podcast_posts (repost_of) where repost_of is not null;
create unique index if not exists podcast_posts_one_plain_repost on public.podcast_posts (voter, repost_of) where kind = 'repost' and caption = '';

create table if not exists public.podcast_comments (
  id bigserial primary key,
  post_id bigint not null references public.podcast_posts(id) on delete cascade,
  voter text not null references public.podcast_profiles(voter) on delete cascade,
  parent_id bigint references public.podcast_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  reports int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists podcast_comments_post on public.podcast_comments (post_id, created_at);

create table if not exists public.podcast_comment_likes (
  comment_id bigint not null references public.podcast_comments(id) on delete cascade,
  voter text not null check (char_length(voter) between 2 and 60),
  created_at timestamptz not null default now(),
  primary key (comment_id, voter)
);

create table if not exists public.podcast_notifications (
  id bigserial primary key,
  voter text not null check (char_length(voter) between 2 and 60),
  actor text not null check (char_length(actor) between 2 and 60),
  kind text not null check (kind in ('like', 'comment', 'reply', 'follow', 'repost', 'comment_like')),
  post_id bigint references public.podcast_posts(id) on delete cascade,
  comment_id bigint references public.podcast_comments(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists podcast_notifications_voter on public.podcast_notifications (voter, created_at desc);

do $$ declare t text; begin
  foreach t in array array['podcast_comments','podcast_comment_likes','podcast_notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('drop policy if exists "server manages %s" on public.%I', t, t);
    execute format('create policy "server manages %s" on public.%I for all to service_role using (true) with check (true)', t, t);
  end loop;
end $$;
grant usage, select on sequence public.podcast_comments_id_seq to service_role;
grant usage, select on sequence public.podcast_notifications_id_seq to service_role;
