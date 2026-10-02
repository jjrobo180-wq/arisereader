import { type ArcadeEngine, type Level, type Outcome, type Seat, check, clone, other, pick } from "../core";
import { type ChoiceQuestion, makeQuestions, RESCUE_WORDS } from "../content";

// ─── Quiz duels: both players answer the same question at the same time. ─────
export const QUIZ_ROUNDS = 7;
export type QuizRound = { q: string; options: string[]; correct: string; picks: [string, string]; points: [number, number] };
export type QuizState = {
  kind: string;
  questions: ChoiceQuestion[];
  round: number;
  picks: [string | null, string | null];
  results: QuizRound[];
  scores: [number, number];
  streaks: [number, number];
  winner: Outcome;
};

const ACCURACY: Record<Level, number> = { 1: 0.55, 2: 0.72, 3: 0.9 };

export function makeQuizEngine(id: string): ArcadeEngine<QuizState, { choice: string }> {
  return {
    id,
    init() {
      return { kind: id, questions: makeQuestions(id, QUIZ_ROUNDS), round: 0, picks: [null, null], results: [], scores: [0, 0], streaks: [0, 0], winner: null };
    },
    toAct: (s) => (s.winner !== null ? [] : ([1, 2] as Seat[]).filter((seat) => s.picks[seat - 1] === null)),
    outcome: (s) => s.winner,
    play(state, seat, move) {
      check(state.winner === null, "The game is over.");
      check(state.picks[seat - 1] === null, "You already answered. Waiting for your opponent.");
      const q = state.questions[state.round];
      const choice = String(move?.choice ?? "");
      check(q && q.options.includes(choice), "Choose one of the answers.");
      const s = clone(state);
      s.picks[seat - 1] = choice;
      if (s.picks[0] !== null && s.picks[1] !== null) {
        const points: [number, number] = [0, 0];
        for (const who of [0, 1]) {
          const right = s.picks[who] === q.correct;
          s.streaks[who] = right ? s.streaks[who] + 1 : 0;
          points[who] = right ? 10 + 5 * Math.min(2, s.streaks[who] - 1) : 0;
          s.scores[who] += points[who];
        }
        s.results.push({ ...q, picks: [s.picks[0], s.picks[1]], points });
        s.picks = [null, null];
        s.round++;
        if (s.round >= s.questions.length) s.winner = s.scores[0] === s.scores[1] ? 0 : s.scores[0] > s.scores[1] ? 1 : 2;
      }
      return s;
    },
    view(s, seat) {
      const current = s.winner === null ? s.questions[s.round] : null;
      return {
        kind: s.kind,
        round: s.round,
        total: s.questions.length,
        question: current ? { q: current.q, options: current.options } : null,
        myPick: s.picks[seat - 1],
        theyAnswered: s.picks[other(seat) - 1] !== null,
        results: s.results,
        scores: s.scores,
        streaks: s.streaks,
        winner: s.winner,
      };
    },
    ai(s, _seat, level) {
      const q = s.questions[s.round];
      const right = Math.random() < ACCURACY[level];
      return { choice: right ? q.correct : pick(q.options.filter((o) => o !== q.correct)) };
    },
  };
}

// ─── Word Rescue: take turns guessing letters. A right letter earns another turn. ─
export const RESCUE_MAX_MISSES = 8;
export type RescueState = {
  word: string;
  hint: string;
  guessed: string[];
  misses: number;
  turn: Seat;
  winner: Outcome;
  last: { seat: Seat; letter: string; hit: boolean } | null;
};
const LETTER_ORDER = "EARIOTNSLCUDPMHGBFYWKVXZJQ".split("");

export const wordrescue: ArcadeEngine<RescueState, { letter: string }> = {
  id: "word_rescue",
  init() {
    const p = pick(RESCUE_WORDS);
    return { word: p.word, hint: p.hint, guessed: [], misses: 0, turn: 1, winner: null, last: null };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const letter = String(move?.letter || "").toUpperCase();
    check(/^[A-Z]$/.test(letter), "Pick one letter.");
    check(!state.guessed.includes(letter), "That letter was already picked.");
    const s = clone(state);
    s.guessed.push(letter);
    const hit = s.word.includes(letter);
    s.last = { seat, letter, hit };
    if (!hit) s.misses++;
    if (s.word.split("").every((ch) => s.guessed.includes(ch))) s.winner = seat;
    else if (s.misses >= RESCUE_MAX_MISSES) s.winner = other(seat); // the last miss loses the word
    else if (!hit) s.turn = other(seat);
    return s;
  },
  view(s) {
    const done = s.winner !== null;
    return {
      pattern: s.word.split("").map((ch) => (done || s.guessed.includes(ch) ? ch : null)),
      hint: s.hint,
      guessed: s.guessed,
      misses: s.misses,
      maxMisses: RESCUE_MAX_MISSES,
      turn: s.turn,
      winner: s.winner,
      last: s.last,
      word: done ? s.word : null,
    };
  },
  ai(s, _seat, level) {
    const left = LETTER_ORDER.filter((l) => !s.guessed.includes(l));
    if (level === 1) return { letter: left[Math.min(left.length - 1, Math.floor(Math.random() * 6))] };
    // Use only what is visible: the pattern, wrong letters, and the word list everyone can learn.
    const wrong = s.guessed.filter((l) => !s.word.includes(l));
    const fits = RESCUE_WORDS.map((w) => w.word).filter((w) =>
      w.length === s.word.length &&
      w.split("").every((ch, i) => (s.guessed.includes(s.word[i]) ? ch === s.word[i] : !s.guessed.includes(ch))) &&
      !wrong.some((l) => w.includes(l)));
    if (fits.length && (level === 3 || Math.random() < 0.5)) {
      const counts = new Map<string, number>();
      for (const w of fits) for (const ch of new Set(w.split(""))) if (!s.guessed.includes(ch)) counts.set(ch, (counts.get(ch) || 0) + 1);
      const ranked = left.filter((l) => counts.has(l)).sort((a, b) => (counts.get(b)! - counts.get(a)!));
      if (ranked.length) return { letter: ranked[0] };
    }
    return { letter: left[0] };
  },
};
