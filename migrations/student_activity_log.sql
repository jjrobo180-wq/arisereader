-- Sign-ins and other things students do, for the admin's student activity view.
-- Written only by the server (service role); never readable from the browser.
create table if not exists public.student_activity_log (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  kind text not null,
  detail text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists student_activity_log_user_time
  on public.student_activity_log (user_id, created_at desc);

alter table public.student_activity_log enable row level security;
revoke all on public.student_activity_log from anon, authenticated;
