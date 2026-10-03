import type { ArcadeEngine } from "./core";
import { tictactoe, fifteen } from "./games/tictactoe";
import { connectfour } from "./games/connectfour";
import { checkers } from "./games/checkers";
import { reversi } from "./games/reversi";
import { dots } from "./games/dots";
import { mancala } from "./games/mancala";
import { gomoku } from "./games/gomoku";
import { ultimate } from "./games/ultimate";
import { gobble } from "./games/gobble";
import { seabattle } from "./games/seabattle";
import { crazyeights, gofish } from "./games/cards";
import { memory, pig, rps } from "./games/party";
import { nim, codebreaker } from "./games/logic";
import { makeQuizEngine, wordrescue } from "./games/learning";

const QUIZ_IDS = ["word_tiles", "math_duel", "synonym_sprint", "pattern_power", "sentence_fix", "fact_dash", "spelling", "geography", "letter_forge", "context_clues", "roots_affixes", "syllable_smash", "parts_speech", "figurative_language", "reading_detective", "sequence_story", "analogy_arena", "homophone_hunt", "multiplication_mayhem", "fraction_frenzy", "decimal_dash", "geometry_grid", "money_math", "time_trial", "estimation_station", "science_lab", "states_capitals", "history_hustle"];

export const ENGINES: Record<string, ArcadeEngine> = Object.fromEntries([
  connectfour, tictactoe, ultimate, checkers, reversi, dots, mancala, gomoku, gobble, seabattle,
  crazyeights, gofish, memory, pig, rps, nim, codebreaker, fifteen, wordrescue,
  ...QUIZ_IDS.map(makeQuizEngine),
].map((engine) => [engine.id, engine]));

export const GAME_IDS = Object.keys(ENGINES);
export const isGameId = (id: unknown): id is string => typeof id === "string" && Object.prototype.hasOwnProperty.call(ENGINES, id);
