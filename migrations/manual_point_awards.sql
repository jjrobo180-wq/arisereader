-- Run once in the Supabase SQL editor before deploying the manual points feature.
-- Manual awards are accessible only through the authenticated server API.
create table if not exists public.manual_point_awards (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.users(id),
  awarded_by bigint not null references public.users(id),
  points integer not null check (points between 1 and 1000),
  reason text not null check (char_length(trim(reason)) between 3 and 200),
  earned_on date not null,
  created_at timestamptz not null default now()
);

create index if not exists manual_point_awards_student_date
  on public.manual_point_awards (student_id, earned_on);

alter table public.manual_point_awards enable row level security;
revoke all on public.manual_point_awards from anon, authenticated;

-- The trigger keeps the existing total_points field in sync atomically.
create or replace function public.apply_manual_point_award()
returns trigger language plpgsql as $$
begin
  update public.users
  set total_points = coalesce(total_points, 0) + new.points
  where id = new.student_id and (role = 'student' or role is null) and is_admin = false;
  if not found then
    raise exception 'Manual points can only be awarded to students';
  end if;
  return new;
end;
$$;

drop trigger if exists apply_manual_point_award on public.manual_point_awards;
create trigger apply_manual_point_award
after insert on public.manual_point_awards
for each row execute function public.apply_manual_point_award();
