-- A teacher's own Gmail or Outlook account, connected so meeting-poll emails can be sent from it.
-- Only the refresh token is kept, encrypted by the server; the site never sees the teacher's password.
create table if not exists public.teacher_mailboxes (
  teacher_id integer primary key references public.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  email text not null,
  display_name text not null default '',
  refresh_token text not null,
  needs_reconnect boolean not null default false,
  connected_at timestamptz not null default now()
);
alter table public.teacher_mailboxes enable row level security;
revoke all on table public.teacher_mailboxes from anon, authenticated;
grant select, insert, update, delete on table public.teacher_mailboxes to service_role;

-- Which way a poll's emails go out.
alter table public.meeting_polls add column if not exists send_via text not null default 'site';
