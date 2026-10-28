-- Timestamped comments for Earshot and Pod+: the moment in the episode a comment is about (seconds).
-- Null means the comment is about the whole episode. Safe to run more than once.
alter table public.earshot_comments add column if not exists at_sec integer;
alter table public.podscroll_comments add column if not exists at_sec integer;
create index if not exists earshot_comments_moment on public.earshot_comments (episode_id, at_sec) where at_sec is not null;
create index if not exists podscroll_comments_moment on public.podscroll_comments (episode_id, at_sec) where at_sec is not null;
