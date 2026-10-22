-- A.R.I.S.E. Connect Learning (/social/): career courses and certificates.
-- Adds to the tables in migrations/arise_social.sql; nothing existing is changed or removed. Safe to run more than once.

-- Each student's course progress: { "<courseId>": { "lessons": [true, false, ...], "done": "YYYY-MM-DD" | null } }.
alter table public.social_profiles add column if not exists courses jsonb not null default '{}'::jsonb;

-- A post can show a finished course's certificate. It still waits for the teacher like any student post.
alter table public.social_posts add column if not exists course_id text;
