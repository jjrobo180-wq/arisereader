import type { ComponentType } from "react";
import type { BoardProps } from "./types";
import { FifteenBoard, GobbleBoard, GomokuBoard, TicTacToeBoard, UltimateBoard } from "./grids";
import { CheckersBoard, ConnectFourBoard, DotsBoard, MancalaBoard, ReversiBoard } from "./classic";
import { CrazyEightsBoard, GoFishBoard, MemoryBoard } from "./cards";
import { CodeBreakerBoard, NimBoard, PigBoard, RpsBoard, SeaBattleBoard } from "./party";
import { QuizBoard, WordRescueBoard } from "./learning";

export type BoardMeta = {
  Board: ComponentType<BoardProps>;
  /** Scores indexed by seat ([seat 1, seat 2]), shown in the player strip. */
  scores?: (view: any, seat: 1 | 2) => [number, number];
  scoreLabel?: string;
  colors?: [string, string];
  labels?: [string, string];
  /** Boards that need to scroll on short screens instead of shrinking to fit. */
  scroll?: boolean;
};

const count = (cells: number[], test: (v: number) => boolean) => cells.filter(test).length;
/** Turns "mine / theirs" numbers into [seat 1, seat 2]. */
const bySeat = (seat: 1 | 2, mine: number, theirs: number): [number, number] => (seat === 1 ? [mine, theirs] : [theirs, mine]);
const quiz: BoardMeta = { Board: QuizBoard, scores: (v) => v.scores, scoreLabel: "points", scroll: true };

export const BOARDS: Record<string, BoardMeta> = {
  four: { Board: ConnectFourBoard, labels: ["Yellow", "Pink"] },
  tictactoe: { Board: TicTacToeBoard, labels: ["X", "O"] },
  ultimate: { Board: UltimateBoard, labels: ["X", "O"], scores: (v) => [count(v.small, (x) => x === 1), count(v.small, (x) => x === 2)], scoreLabel: "boards" },
  checkers: { Board: CheckersBoard, colors: ["#e2403d", "#26242f"], labels: ["Red", "Black"], scores: (v) => [count(v.board, (x) => x === 1 || x === 3), count(v.board, (x) => x === 2 || x === 4)], scoreLabel: "pieces" },
  reversi: { Board: ReversiBoard, colors: ["#16161d", "#f4f4f6"], labels: ["Black", "White"], scores: (v) => v.counts, scoreLabel: "discs" },
  dots: { Board: DotsBoard, scores: (v) => v.scores, scoreLabel: "boxes" },
  mancala: { Board: MancalaBoard, scores: (v) => [v.pits[6], v.pits[13]], scoreLabel: "in store" },
  gomoku: { Board: GomokuBoard, colors: ["#16161d", "#f4f4f6"], labels: ["Black", "White"] },
  gobble: { Board: GobbleBoard },
  seabattle: { Board: SeaBattleBoard, scroll: true, scoreLabel: "ships", scores: (v, seat) => bySeat(seat, v.myShipsLeft, v.theirShipsLeft) },
  eights: { Board: CrazyEightsBoard, scroll: true, scoreLabel: "cards", scores: (v, seat) => bySeat(seat, v.hand.length, v.theirCount) },
  gofish: { Board: GoFishBoard, scores: (v) => [v.books[0].length, v.books[1].length], scoreLabel: "books", scroll: true },
  memory: { Board: MemoryBoard, scores: (v) => v.scores, scoreLabel: "pairs" },
  pig: { Board: PigBoard, scores: (v) => v.scores, scoreLabel: "points", scroll: true },
  rps: { Board: RpsBoard, scores: (v) => v.wins, scoreLabel: "wins", scroll: true },
  nim: { Board: NimBoard, scroll: true },
  codebreaker: { Board: CodeBreakerBoard, scroll: true },
  fifteen: { Board: FifteenBoard, scroll: true },
  word_rescue: { Board: WordRescueBoard, scroll: true },
  word_tiles: quiz, math_duel: quiz, synonym_sprint: quiz, pattern_power: quiz, sentence_fix: quiz, fact_dash: quiz, spelling: quiz, geography: quiz,
  letter_forge: quiz, context_clues: quiz, roots_affixes: quiz, syllable_smash: quiz, parts_speech: quiz, figurative_language: quiz, reading_detective: quiz, sequence_story: quiz, analogy_arena: quiz, homophone_hunt: quiz,
  multiplication_mayhem: quiz, fraction_frenzy: quiz, decimal_dash: quiz, geometry_grid: quiz, money_math: quiz, time_trial: quiz, estimation_station: quiz, science_lab: quiz, states_capitals: quiz, history_hustle: quiz,
};
