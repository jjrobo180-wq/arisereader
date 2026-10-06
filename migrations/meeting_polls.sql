-- Teacher Hub meeting polls: a teacher offers times for an IEP / re-evaluation meeting and asks people to answer.
create table if not exists public.meeting_polls (
  id uuid primary key default gen_random_uuid(),
  teacher_id integer not null references public.users(id) on delete cascade,
  title text not null,
  location text not null default '',
  message text not null default '',
  hub_meeting_id text not null default '',
  options jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'booked')),
  chosen_option text,
  created_at timestamptz not null default now()
);
create index if not exists meeting_polls_teacher_idx on public.meeting_polls(teacher_id, created_at desc);

create table if not exists public.meeting_poll_invitees (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.meeting_polls(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'Other',
  token text not null unique,
  answers jsonb not null default '{}'::jsonb,
  comment text not null default '',
  email_sent boolean not null default false,
  invited_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists meeting_poll_invitees_poll_idx on public.meeting_poll_invitees(poll_id);

alter table public.meeting_polls enable row level security;
alter table public.meeting_poll_invitees enable row level security;
revoke all on table public.meeting_polls, public.meeting_poll_invitees from anon, authenticated;
grant select, insert, update, delete on table public.meeting_polls, public.meeting_poll_invitees to service_role;
