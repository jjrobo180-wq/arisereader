-- Lets the arcade store every game name in club_arise_matches.game_type.
-- Optional: without it, new games are saved under "four" and the real game
-- name is kept in state.game, so everything still works.
alter table public.club_arise_matches
  drop constraint if exists club_arise_matches_game_type_check;

alter table public.club_arise_matches
  add constraint club_arise_matches_game_type_check
  check (game_type = any (array[
    'four'::text,
    'tictactoe'::text,
    'ultimate'::text,
    'checkers'::text,
    'reversi'::text,
    'dots'::text,
    'mancala'::text,
    'gomoku'::text,
    'gobble'::text,
    'seabattle'::text,
    'eights'::text,
    'gofish'::text,
    'memory'::text,
    'pig'::text,
    'rps'::text,
    'nim'::text,
    'codebreaker'::text,
    'fifteen'::text,
    'word_rescue'::text,
    'word_tiles'::text,
    'math_duel'::text,
    'synonym_sprint'::text,
    'pattern_power'::text,
    'sentence_fix'::text,
    'fact_dash'::text,
    'spelling'::text,
    'geography'::text,
    'chess'::text
  ]));

-- Speeds up the open-tables lookup.
create index if not exists club_arise_matches_waiting_idx
  on public.club_arise_matches (status, created_at desc);
