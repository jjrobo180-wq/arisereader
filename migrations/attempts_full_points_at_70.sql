-- ALREADY IN THE DATABASE. Nothing to run. This file records a rule that lives in
-- Supabase itself, so that code written against the attempts table knows about it.
--
-- Whenever a quiz row (attempts) is added, or its score, total, book or points
-- are changed, the database sets its points itself: a passed quiz (70% or
-- higher) is worth its book's CURRENT points_value, anything else is worth 0.
-- Whatever number the site sent for points_earned is ignored.
--
-- What that means for the site's code:
--   * To change what a book's quizzes are worth, change the book first and the
--     quizzes second. A quiz changed while its book still has the old value is
--     put straight back to the old value. (server/bookPoints.ts does this.)
--   * A passed quiz can't be given 0 points, or any other number, by updating
--     points_earned; the rule puts the book's points back.
--   * users.total_points is NOT kept by this rule. The site adds and subtracts
--     from it itself.

create or replace function public.enforce_full_book_quiz_points()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_points numeric;
begin
  select coalesce(points_value, 0) into v_points from public.books where id = new.book_id;
  if coalesce(new.total, 0) > 0 and (new.score::numeric / new.total::numeric) >= 0.70 then
    new.points_earned := v_points;
  else
    new.points_earned := 0;
  end if;
  return new;
end;
$function$;

drop trigger if exists attempts_full_points_at_70 on public.attempts;
create trigger attempts_full_points_at_70
  before insert or update of score, total, book_id, points_earned on public.attempts
  for each row execute function enforce_full_book_quiz_points();
