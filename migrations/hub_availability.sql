-- Weekly free times, and linking a meeting-poll invitation to a staff member's own account.
create table if not exists public.hub_availability (
  user_id integer primary key references public.users(id) on delete cascade,
  weekly jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.hub_availability enable row level security;
revoke all on table public.hub_availability from anon, authenticated;
grant select, insert, update, delete on table public.hub_availability to service_role;

alter table public.meeting_poll_invitees add column if not exists user_id integer references public.users(id) on delete set null;
create index if not exists meeting_poll_invitees_user_idx on public.meeting_poll_invitees(user_id);
