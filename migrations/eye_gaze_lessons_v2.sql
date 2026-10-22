-- Eye Gazer lessons, redone (October 2026).
-- The lessons are written in shared/eyegaze/lessons.ts. When the server starts it saves them into
-- these tables (storage.syncEyeGazeLessons), matched by lesson_key, and hides the first set of
-- built-in quizzes (the rows with no lesson_key). Nothing is deleted: finished quizzes, scores and
-- points stay. Already applied to the database; safe to run again.

alter table public.eye_gaze_quizzes
  add column if not exists lesson_key text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists learn_cards jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eye_gaze_quizzes_lesson_key_key') then
    alter table public.eye_gaze_quizzes add constraint eye_gaze_quizzes_lesson_key_key unique (lesson_key);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eye_gaze_quizzes_learn_cards_array') then
    alter table public.eye_gaze_quizzes add constraint eye_gaze_quizzes_learn_cards_array check (jsonb_typeof(learn_cards) = 'array');
  end if;
end $$;

-- A picture for each answer, and the question's extra details: what the voice says, how the
-- answers look (pictures / words / both), a count, a word to read, an animal sound.
alter table public.eye_gaze_questions
  add column if not exists option_a_image text,
  add column if not exists option_b_image text,
  add column if not exists option_c_image text,
  add column if not exists option_d_image text,
  add column if not exists extras jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eye_gaze_questions_extras_object') then
    alter table public.eye_gaze_questions add constraint eye_gaze_questions_extras_object check (jsonb_typeof(extras) = 'object');
  end if;
end $$;

-- One row per question number in a quiz (so two server starts saving at once can't double a question).
create unique index if not exists eye_gaze_questions_quiz_order on public.eye_gaze_questions (quiz_id, question_order);
