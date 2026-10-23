-- Oct 23, 2026: a student must never be able to take the same book's quiz twice, even through a
-- second copy of the book. Enforced by the database itself, the moment it happens:
--  1. a book can exist only once (same title, ignoring "The/A/An", spacing and punctuation, by an
--     author with the same last name — the same rule as shared/bookIdentity.ts bookKey());
--  2. a quiz attempt is refused when the student already has one on any copy of that book.

create or replace function public.arise_book_key(t text, a text) returns text
language sql immutable parallel safe as $$
  select case when tk = '' then null else tk || '|' || ak end from (
    select
      lower(regexp_replace(regexp_replace(btrim(regexp_replace(normalize(coalesce(t, ''), NFKD), '[̀-ͯ]', '', 'g')), '^(the|a|an)\s+', '', 'i'), '[^a-zA-Z0-9]+', '', 'g')) as tk,
      lower(regexp_replace(regexp_replace(btrim(regexp_replace(normalize(coalesce(a, ''), NFKD), '[̀-ͯ]', '', 'g')), '^.*\s', ''), '[^a-zA-Z]+', '', 'g')) as ak
  ) s
$$;

create unique index if not exists books_one_copy_per_book
  on public.books (public.arise_book_key(title, author))
  where public.arise_book_key(title, author) is not null;

create or replace function public.arise_block_repeat_book_quiz() returns trigger
language plpgsql as $$
declare k text;
begin
  select public.arise_book_key(b.title, b.author) into k from public.books b where b.id = new.book_id;
  if k is not null and exists (
    select 1 from public.attempts a join public.books b on b.id = a.book_id
    where a.user_id = new.user_id and a.id <> new.id and a.book_id <> new.book_id and public.arise_book_key(b.title, b.author) = k
  ) then
    raise exception 'already_taken_this_book: this student already took a quiz for this book' using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists attempts_one_per_book on public.attempts;
create trigger attempts_one_per_book before insert or update of book_id, user_id on public.attempts
  for each row execute function public.arise_block_repeat_book_quiz();
