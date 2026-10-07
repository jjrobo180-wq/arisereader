-- Meeting polls: send the links yourself, and text people who have a phone number.
alter table public.meeting_polls add column if not exists send_via text not null default 'site';
alter table public.meeting_polls add column if not exists send_text boolean not null default false;
alter table public.meeting_poll_invitees add column if not exists phone text not null default '';
