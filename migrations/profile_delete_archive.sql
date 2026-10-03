-- Deleting a profile used to fail when it had live-quiz plays, quiz review
-- requests, reading retake requests, notifications or other rows pointing at
-- it. Rows that belong to the person now go with them. Points a teacher gave a
-- student stay with the student, and a teacher's growth-check assignments stay
-- with their students.
alter table public.live_players
  drop constraint if exists live_players_user_id_fkey,
  add constraint live_players_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;
alter table public.live_quizzes
  drop constraint if exists live_quizzes_teacher_id_fkey,
  add constraint live_quizzes_teacher_id_fkey foreign key (teacher_id) references public.users(id) on delete cascade;
alter table public.live_sessions
  drop constraint if exists live_sessions_teacher_id_fkey,
  add constraint live_sessions_teacher_id_fkey foreign key (teacher_id) references public.users(id) on delete cascade,
  drop constraint if exists live_sessions_quiz_id_fkey,
  add constraint live_sessions_quiz_id_fkey foreign key (quiz_id) references public.live_quizzes(id) on delete cascade;
alter table public.growth_check_assignments
  drop constraint if exists growth_check_assignments_teacher_id_fkey,
  add constraint growth_check_assignments_teacher_id_fkey foreign key (teacher_id) references public.users(id) on delete set null;
alter table public.manual_point_awards alter column awarded_by drop not null;
alter table public.manual_point_awards
  drop constraint if exists manual_point_awards_awarded_by_fkey,
  add constraint manual_point_awards_awarded_by_fkey foreign key (awarded_by) references public.users(id) on delete set null,
  drop constraint if exists manual_point_awards_student_id_fkey,
  add constraint manual_point_awards_student_id_fkey foreign key (student_id) references public.users(id) on delete cascade;
alter table public.notifications
  drop constraint if exists notifications_user_id_fkey,
  add constraint notifications_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;
alter table public.quiz_requests
  drop constraint if exists quiz_requests_user_id_fkey,
  add constraint quiz_requests_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;
alter table public.quiz_review_requests
  drop constraint if exists quiz_review_requests_user_id_fkey,
  add constraint quiz_review_requests_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade,
  drop constraint if exists quiz_review_requests_attempt_id_fkey,
  add constraint quiz_review_requests_attempt_id_fkey foreign key (attempt_id) references public.attempts(id) on delete cascade;
alter table public.reading_retake_requests
  drop constraint if exists reading_retake_requests_user_id_fkey,
  add constraint reading_retake_requests_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;

-- Archiving a profile: it can't sign in and is hidden from lists, rosters and
-- leaderboards, but nothing is deleted and the admin can restore it.
alter table public.users add column if not exists archived_at timestamptz;
alter table public.users add column if not exists archived_by integer references public.users(id) on delete set null;
