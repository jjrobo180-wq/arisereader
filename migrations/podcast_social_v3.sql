-- Pod+ Social v3: a full social app. Profile photos and covers, photo/video posts, polls, hashtags,
-- saved posts, blocks, direct messages (with message requests) and 24-hour stories.
-- Service role only, like the rest of podcast social (the server is the only one that touches these).

-- Profiles: a real photo and cover, a website and a place.
alter table public.podcast_profiles
  add column if not exists photo text, add column if not exists cover text,
  add column if not exists website text, add column if not exists location text,
  add column if not exists verified boolean not null default false;

-- Posts: photos and videos, a poll, and the hashtags in them (for search and trending).
alter table public.podcast_posts
  add column if not exists media jsonb, add column if not exists poll jsonb, add column if not exists tags text[];
alter table public.podcast_posts drop constraint if exists podcast_posts_caption_check;
alter table public.podcast_posts add constraint podcast_posts_caption_check check (char_length(caption) <= 500);
create index if not exists podcast_posts_tags_idx on public.podcast_posts using gin (tags);
create index if not exists podcast_posts_created_idx on public.podcast_posts (created_at desc);
create index if not exists podcast_posts_voter_idx on public.podcast_posts (voter, created_at desc);

create table if not exists public.podcast_poll_votes (
  post_id bigint not null, voter text not null, choice smallint not null check (choice between 0 and 3),
  created_at timestamptz not null default now(), primary key (post_id, voter));
create table if not exists public.podcast_post_saves (
  post_id bigint not null, voter text not null, created_at timestamptz not null default now(), primary key (post_id, voter));
create table if not exists public.podcast_blocks (
  blocker text not null, blocked text not null, created_at timestamptz not null default now(), primary key (blocker, blocked));

-- Direct messages. a < b (the two people, in order), so a pair has one conversation. A conversation
-- from someone you don't follow waits in Requests until you accept it or reply.
create table if not exists public.podcast_dm_threads (
  id bigserial primary key, a text not null, b text not null, started_by text not null,
  accepted boolean not null default false, created_at timestamptz not null default now(),
  last_at timestamptz not null default now(), last_text text not null default '', last_from text,
  a_read_at timestamptz, b_read_at timestamptz, a_hidden boolean not null default false, b_hidden boolean not null default false,
  unique (a, b), check (a < b));
create index if not exists podcast_dm_threads_a_idx on public.podcast_dm_threads (a, last_at desc);
create index if not exists podcast_dm_threads_b_idx on public.podcast_dm_threads (b, last_at desc);
create table if not exists public.podcast_dm_messages (
  id bigserial primary key, thread_id bigint not null references public.podcast_dm_threads(id) on delete cascade,
  sender text not null, body text not null default '' check (char_length(body) <= 2000), media jsonb, post_id bigint,
  created_at timestamptz not null default now());
create index if not exists podcast_dm_messages_thread_idx on public.podcast_dm_messages (thread_id, id);

-- Stories: a photo, video or words on a color (or an episode), gone after 24 hours.
create table if not exists public.podcast_stories (
  id bigserial primary key, voter text not null, media jsonb, body text not null default '' check (char_length(body) <= 200),
  bg text, episode jsonb, created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours', hidden boolean not null default false, reports integer not null default 0);
create index if not exists podcast_stories_voter_idx on public.podcast_stories (voter, expires_at desc);
create table if not exists public.podcast_story_views (
  story_id bigint not null references public.podcast_stories(id) on delete cascade, voter text not null,
  created_at timestamptz not null default now(), primary key (story_id, voter));

do $$ declare t text; begin
  foreach t in array array['podcast_poll_votes','podcast_post_saves','podcast_blocks','podcast_dm_threads','podcast_dm_messages','podcast_stories','podcast_story_views'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'server manages ' || t) then
      execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', 'server manages ' || t, t);
    end if;
  end loop;
end $$;

-- Notifications: mentions too.
alter table public.podcast_notifications drop constraint if exists podcast_notifications_kind_check;
alter table public.podcast_notifications add constraint podcast_notifications_kind_check
  check (kind = any (array['like','comment','reply','follow','repost','comment_like','episode','guestbook','mention','story_like']));

-- Uploads: photos (with GIFs) and videos.
update storage.buckets set allowed_mime_types = array[
  'audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/m4a','audio/aac','audio/webm','audio/ogg','audio/wav','audio/x-wav',
  'image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
where id = 'podcast-uploads';
