-- Social for Earshot (LifeHub) and Podscroll, shared by both: profiles, posts (shared episodes,
-- bookmarks, and episodes people made themselves), likes, follows between people, and uploads.
-- People are "u<Arise user id>" or "d<Podscroll device id>". Only the server's service role may use
-- these tables; uploads go to the public "podcast-uploads" bucket through signed upload links.
create table if not exists public.podcast_profiles (
  voter text primary key check (char_length(voter) between 2 and 60),
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  name text not null check (char_length(name) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar text not null default '🎧' check (char_length(avatar) <= 16),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.podcast_posts (
  id bigserial primary key,
  voter text not null references public.podcast_profiles(voter) on delete cascade,
  kind text not null check (kind in ('share', 'bookmark', 'own')),
  episode_id text not null check (episode_id ~ '^[0-9]{1,20}$'),
  episode jsonb not null,
  caption text not null default '' check (char_length(caption) <= 280),
  reports int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists podcast_posts_recent on public.podcast_posts (created_at desc) where not hidden;
create index if not exists podcast_posts_voter on public.podcast_posts (voter, created_at desc);
create unique index if not exists podcast_posts_one_bookmark on public.podcast_posts (voter, episode_id) where kind = 'bookmark';

create table if not exists public.podcast_post_likes (
  post_id bigint not null references public.podcast_posts(id) on delete cascade,
  voter text not null check (char_length(voter) between 2 and 60),
  created_at timestamptz not null default now(),
  primary key (post_id, voter)
);

create table if not exists public.podcast_post_reports (
  post_id bigint not null references public.podcast_posts(id) on delete cascade,
  voter text not null check (char_length(voter) between 2 and 60),
  created_at timestamptz not null default now(),
  primary key (post_id, voter)
);

create table if not exists public.podcast_people_follows (
  follower text not null check (char_length(follower) between 2 and 60),
  followee text not null references public.podcast_profiles(voter) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee)
);
create index if not exists podcast_people_follows_followee on public.podcast_people_follows (followee);

do $$ declare t text; begin
  foreach t in array array['podcast_profiles','podcast_posts','podcast_post_likes','podcast_post_reports','podcast_people_follows'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('drop policy if exists "server manages %s" on public.%I', t, t);
    execute format('create policy "server manages %s" on public.%I for all to service_role using (true) with check (true)', t, t);
  end loop;
end $$;
grant usage, select on sequence public.podcast_posts_id_seq to service_role;

-- Episodes people upload (and their cover art): public to listen to, written only through signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('podcast-uploads', 'podcast-uploads', true, 104857600,
  array['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/m4a','audio/aac','audio/webm','audio/ogg','audio/wav','audio/x-wav','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
