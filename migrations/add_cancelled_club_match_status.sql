alter table public.club_arise_matches
  drop constraint if exists club_arise_matches_status_check;

alter table public.club_arise_matches
  add constraint club_arise_matches_status_check
  check (status in ('waiting','active','finished','cancelled'));
