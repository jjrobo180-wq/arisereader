-- Each student's Advisory teacher and Literature teacher, typed in by the student in a pop-up after
-- they sign in (client/src/components/ClassTeachersPopup.tsx). Every teacher at the student's school
-- sees the list on the Reader page's "Advisory & Lit" tab (server/classTeachers.ts).
--
-- One row per student per school year, so the pop-up asks again each new year (July 1, Mountain Time).
-- A teacher picked from the school's list is linked by id, so renaming them shows the new name; a
-- teacher who isn't on A.R.I.S.E. yet is kept as the name the student typed (teacher id empty).
create table if not exists public.student_class_teachers (
  student_id integer not null references public.users(id) on delete cascade,
  school_year text not null check (school_year ~ '^[0-9]{4}-[0-9]{2}$'),
  school_id integer not null references public.schools(id) on delete cascade,
  advisory_teacher_id integer references public.users(id) on delete set null,
  advisory_teacher_name text not null check (char_length(advisory_teacher_name) = 0 or char_length(advisory_teacher_name) between 2 and 60),
  lit_teacher_id integer references public.users(id) on delete set null,
  lit_teacher_name text not null check (char_length(lit_teacher_name) = 0 or char_length(lit_teacher_name) between 2 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, school_year)
);

alter table public.student_class_teachers enable row level security;
revoke all on table public.student_class_teachers from anon, authenticated;
grant select, insert, update, delete on table public.student_class_teachers to service_role;

create index if not exists student_class_teachers_school_year_idx
  on public.student_class_teachers(school_id, school_year);

-- October 2026: a student placed in an advisory at upload has no ELA teacher yet (and the reverse),
-- so either name may be empty. Applied to the live database on 2026-10-19.
alter table student_class_teachers drop constraint if exists student_class_teachers_lit_teacher_name_check;
alter table student_class_teachers add constraint student_class_teachers_lit_teacher_name_check check (char_length(lit_teacher_name) = 0 or char_length(lit_teacher_name) between 2 and 60);
alter table student_class_teachers drop constraint if exists student_class_teachers_advisory_teacher_name_check;
alter table student_class_teachers add constraint student_class_teachers_advisory_teacher_name_check check (char_length(advisory_teacher_name) = 0 or char_length(advisory_teacher_name) between 2 and 60);
