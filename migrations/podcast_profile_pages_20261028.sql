-- Pod+ profile pages (MySpace style): each listener's page design and guestbook.
alter table public.podcast_profiles add column if not exists page jsonb, add column if not exists guestbook jsonb not null default '[]'::jsonb;
alter table public.podcast_notifications drop constraint if exists podcast_notifications_kind_check;
alter table public.podcast_notifications add constraint podcast_notifications_kind_check check (kind = any (array['like','comment','reply','follow','repost','comment_like','episode','guestbook']));
