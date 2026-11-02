-- Help tickets from the sign-in screen: people who can't get into their account messaging the admin.
-- They have no account to attach to, so the ticket holds what they typed. Only the server reads this.
create table if not exists public.student_help_tickets (
  id bigserial primary key,
  first_name text not null check (char_length(first_name) <= 60),
  last_name text not null check (char_length(last_name) <= 60),
  school text not null check (char_length(school) <= 160),
  grade text not null check (char_length(grade) <= 4),
  advisory text not null check (char_length(advisory) <= 120),
  issue text not null check (char_length(issue) <= 1500),
  email text check (email is null or char_length(email) <= 254),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by integer references public.users(id) on delete set null
);
create index if not exists student_help_tickets_open_idx on public.student_help_tickets (created_at desc) where done_at is null;

alter table public.student_help_tickets enable row level security;
revoke all on table public.student_help_tickets from anon, authenticated;
grant select, insert, update, delete on table public.student_help_tickets to service_role;
grant usage, select on sequence public.student_help_tickets_id_seq to service_role;
