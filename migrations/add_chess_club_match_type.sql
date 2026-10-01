-- Allow Ultimate Chess to use the existing Club A.R.I.S.E. match table.
alter table public.club_arise_matches
drop constraint if exists club_arise_matches_game_type_check;

alter table public.club_arise_matches
add constraint club_arise_matches_game_type_check
check (game_type = any (array[
  'four'::text,
  'word_tiles'::text,
  'word_rescue'::text,
  'math_duel'::text,
  'synonym_sprint'::text,
  'pattern_power'::text,
  'sentence_fix'::text,
  'fact_dash'::text,
  'chess'::text
]));
