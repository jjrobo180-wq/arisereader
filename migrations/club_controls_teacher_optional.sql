-- Applied 2026-10-14. A student without a teacher (signed up by a parent or on their own) can
-- still have Club Arise controls set by their parent, so the teacher on a controls row is optional.
alter table public.club_arise_controls alter column teacher_id drop not null;
