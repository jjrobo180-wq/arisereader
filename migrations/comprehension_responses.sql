-- Reading comprehension: a student's three written answers sent with a book quiz
-- (only when a parent or teacher typed the proctor code). The teacher grades them
-- for up to 10 extra points, which are saved as a manual point award.
create table if not exists public.comprehension_responses (
  id bigint generated always as identity primary key,
  student_id integer not null references public.users(id) on delete cascade,
  book_id integer not null references public.books(id) on delete cascade,
  attempt_id integer references public.attempts(id) on delete set null,
  answers jsonb not null,
  proctor_type text not null check (proctor_type in ('parent', 'teacher')),
  proctor_name text,
  status text not null default 'pending' check (status in ('pending', 'graded')),
  points integer check (points between 0 and 10),
  teacher_note text check (teacher_note is null or char_length(teacher_note) <= 500),
  graded_by integer references public.users(id) on delete set null,
  graded_at timestamptz,
  award_id bigint references public.manual_point_awards(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, book_id)
);
create index if not exists comprehension_responses_status_idx on public.comprehension_responses (status, created_at desc);
create index if not exists comprehension_responses_student_idx on public.comprehension_responses (student_id, created_at desc);
create index if not exists comprehension_responses_award_idx on public.comprehension_responses (award_id);

-- Only the server (service role) reads and writes this, like the other tables.
alter table public.comprehension_responses enable row level security;
revoke all on public.comprehension_responses from anon, authenticated;
