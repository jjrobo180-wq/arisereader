-- Lets a teacher choose the name on a poll's emails and where replies go.
alter table public.meeting_polls add column if not exists sender_name text not null default '';
alter table public.meeting_polls add column if not exists reply_to text not null default '';
