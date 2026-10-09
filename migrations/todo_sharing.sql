-- A.R.I.S.E. To-Do share links: a private link to one part of a family's To-Do (a poll, a list,
-- the calendar, bills, a trip, chores, goals, one person's food & fitness) that family can open
-- without an account. Votes from the link are kept here, beside the To-Do, never inside it.
create table if not exists public.todo_shares (
  token text primary key,
  user_id integer not null references public.users(id) on delete cascade,
  target text not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists todo_shares_user_idx on public.todo_shares(user_id);

create table if not exists public.todo_share_votes (
  id bigserial primary key,
  token text not null references public.todo_shares(token) on delete cascade,
  voter_key text not null,
  voter_name text not null,
  option_id text not null,
  updated_at timestamptz not null default now(),
  unique (token, voter_key)
);

alter table public.todo_shares enable row level security;
alter table public.todo_share_votes enable row level security;
revoke all on table public.todo_shares, public.todo_share_votes from anon, authenticated;
grant select, insert, update, delete on table public.todo_shares, public.todo_share_votes to service_role;
grant usage, select on sequence public.todo_share_votes_id_seq to service_role;

-- Phone notifications: which reminders each device turned on. Devices saved before this were all Teacher Hub ones.
alter table public.push_subscriptions add column if not exists hub boolean not null default true;
alter table public.push_subscriptions add column if not exists todo boolean not null default false;
