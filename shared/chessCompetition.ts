// Chess competitions: a set stretch of days when finished Ultimate Chess games
// earn competition points and readers race for the top of one board.
//
// A.R.I.S.E. gives no prizes itself. The reward is the crown on the standings;
// a teacher or parent can put up a prize of their own (shared/prizes.ts).
import { clubDay } from "./clubPlay";

export type ChessCompetition = {
  id: string;
  name: string;
  tagline: string;
  /** The first moment a finished game counts. */
  startsAt: string;
  /** A game must finish before this moment to count. */
  endsAt: string;
};

/**
 * Every competition, oldest first. To run another one, add it to the end.
 * Times are Mountain Time, like the rest of the site's days.
 */
export const CHESS_COMPETITIONS: ChessCompetition[] = [
  {
    id: "crown-clash-2026-10",
    name: "Crown Clash",
    tagline: "Two weeks. One crown.",
    // Monday Oct 5 through the end of Monday Oct 19, 2026.
    startsAt: "2026-10-05T00:00:00-06:00",
    endsAt: "2026-10-20T00:00:00-06:00",
  },
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A competition is announced this long before it starts. */
export const CLASH_ANNOUNCE_MS = 7 * DAY;
/** The final results stay on the chess page this long after it ends. */
export const CLASH_RESULTS_STAY_MS = 14 * DAY;

export type ClashPhase = "soon" | "live" | "ended";

export function clashPhase(c: ChessCompetition, now: number): ClashPhase {
  if (now < Date.parse(c.startsAt)) return "soon";
  return now < Date.parse(c.endsAt) ? "live" : "ended";
}

/** The competition to show right now: one that is on, else one about to start, else one that just ended. */
export function currentClash(now: number, list: ChessCompetition[] = CHESS_COMPETITIONS): ChessCompetition | null {
  const live = list.find((c) => clashPhase(c, now) === "live");
  if (live) return live;
  const soon = list
    .filter((c) => clashPhase(c, now) === "soon" && Date.parse(c.startsAt) - now <= CLASH_ANNOUNCE_MS)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  if (soon) return soon;
  const ended = list
    .filter((c) => clashPhase(c, now) === "ended" && now - Date.parse(c.endsAt) < CLASH_RESULTS_STAY_MS)
    .sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt))[0];
  return ended || null;
}

/** The moment the countdown is counting to: the start before it begins, the end while it is on. */
export function clashTarget(c: ChessCompetition, now: number): number {
  return clashPhase(c, now) === "soon" ? Date.parse(c.startsAt) : Date.parse(c.endsAt);
}

export type ClashClock = { days: number; hours: number; minutes: number; seconds: number };

export function clashClock(msLeft: number): ClashClock {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return { days: Math.floor(s / 86_400), hours: Math.floor(s / 3600) % 24, minutes: Math.floor(s / 60) % 60, seconds: s % 60 };
}

/** How close the end is: the last day and the last hour get their own look. */
export type ClashHeat = "hour" | "day" | null;
export function clashHeat(c: ChessCompetition, now: number): ClashHeat {
  if (clashPhase(c, now) !== "live") return null;
  const left = Date.parse(c.endsAt) - now;
  return left <= HOUR ? "hour" : left <= DAY ? "day" : null;
}

const shortDay = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" });
const longDay = (ms: number) => new Date(ms).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Denver" });

/** "Oct 5 – Oct 19": the first and the last day games count. */
export function clashDates(c: ChessCompetition): string {
  return `${shortDay(Date.parse(c.startsAt))} – ${shortDay(Date.parse(c.endsAt) - 1)}`;
}
/** "Monday, Oct 19": the last day games count. */
export function clashLastDay(c: ChessCompetition): string {
  return longDay(Date.parse(c.endsAt) - 1);
}
/** "Monday, Oct 5": the first day games count. */
export function clashFirstDay(c: ChessCompetition): string {
  return longDay(Date.parse(c.startsAt));
}

// ─── Points ─────────────────────────────────────────────────────────────────

/** Competition points for one game. The harder the opponent, the more a win is worth. */
export const CLASH_POINTS = {
  /** Beating another reader in a live match. */
  reader: 5,
  /** Beating the computer: Rookie, Challenger, Master, Titan. */
  computer: [2, 3, 4, 5],
  draw: 1,
} as const;
export const CLASH_LEVEL_NAMES = ["Rookie", "Challenger", "Master", "Titan"] as const;

/**
 * A game with fewer half-moves than this counts only if it ended in checkmate
 * (16 is 8 moves each). It keeps two readers from trading instant resignations.
 */
export const CLASH_MIN_PLIES = 16;
/** Games against the same reader that count in one day. */
export const CLASH_SAME_READER_PER_DAY = 3;

export type ClashGame = {
  id: string;
  p1: number;
  /** null when the opponent was the computer. */
  p2: number | null;
  /** 1 or 2 for the winning seat, 0 for a draw. */
  winner: 0 | 1 | 2;
  /** How it ended: "checkmate", "resignation", "timeout", "stalemate"… */
  result: string | null;
  computer: boolean;
  /** Computer strength, 1 to 4. */
  level: number;
  /** Half-moves played. */
  plies: number;
  finishedAt: number;
};

/** Why a finished game earned nothing for anyone. */
export type ClashWhy = "short" | "repeat";
export type ClashOutcome = "win" | "draw" | "loss";
export type ClashScore = { points: number; outcome: ClashOutcome; counted: boolean; why: ClashWhy | null };

/** Points a seat earns from one game, before the same-reader limit is applied. */
export function clashGamePoints(game: ClashGame, seat: 1 | 2): number {
  if (game.winner === 0) return CLASH_POINTS.draw;
  if (game.winner !== seat) return 0;
  if (!game.computer) return CLASH_POINTS.reader;
  const level = Math.max(1, Math.min(4, Math.floor(Number(game.level) || 2)));
  return CLASH_POINTS.computer[level - 1];
}

/** True when a game is long enough to count, or ended in checkmate. */
export function clashLongEnough(game: Pick<ClashGame, "plies" | "result">): boolean {
  return game.result === "checkmate" || game.plies >= CLASH_MIN_PLIES;
}

export type ClashRow = {
  userId: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  games: number;
  /** When this reader last earned points; the first to reach a score ranks higher. */
  reachedAt: number;
  rank: number;
};

export type ClashTable = {
  /** Everyone with a game that counted, best first. */
  rows: ClashRow[];
  /** What each seat earned in each game: scores.get(gameId)[seat]. */
  scores: Map<string, Record<1 | 2, ClashScore>>;
  /** Games that counted. */
  counted: number;
};

/**
 * Builds the standings from every finished game in the competition.
 * `dayOf` names the site's day for a moment, so "3 games a day against the same reader" has a day to count in.
 */
export function clashStandings(games: ClashGame[], dayOf: (ms: number) => string = clubDay): ClashTable {
  const rows = new Map<number, ClashRow>();
  const scores: ClashTable["scores"] = new Map();
  const meetings = new Map<string, number>();
  const row = (userId: number) => {
    let r = rows.get(userId);
    if (!r) { r = { userId, points: 0, wins: 0, draws: 0, losses: 0, games: 0, reachedAt: 0, rank: 0 }; rows.set(userId, r); }
    return r;
  };
  let counted = 0;

  for (const game of [...games].sort((a, b) => a.finishedAt - b.finishedAt || a.id.localeCompare(b.id))) {
    const seats: (1 | 2)[] = game.p2 ? [1, 2] : [1];
    let why: ClashWhy | null = null;
    if (!clashLongEnough(game)) why = "short";
    else if (game.p2) {
      const key = `${Math.min(game.p1, game.p2)}-${Math.max(game.p1, game.p2)}|${dayOf(game.finishedAt)}`;
      const met = meetings.get(key) || 0;
      if (met >= CLASH_SAME_READER_PER_DAY) why = "repeat";
      else meetings.set(key, met + 1);
    }
    const outcomeFor = (seat: 1 | 2): ClashOutcome => (game.winner === 0 ? "draw" : game.winner === seat ? "win" : "loss");
    const entry = {} as Record<1 | 2, ClashScore>;
    for (const seat of [1, 2] as const) {
      entry[seat] = { points: why ? 0 : clashGamePoints(game, seat), outcome: outcomeFor(seat), counted: !why, why };
    }
    scores.set(game.id, entry);
    if (why) continue;
    counted++;
    for (const seat of seats) {
      const r = row(seat === 1 ? game.p1 : (game.p2 as number));
      const s = entry[seat];
      r.games++;
      if (s.outcome === "win") r.wins++; else if (s.outcome === "draw") r.draws++; else r.losses++;
      if (s.points > 0) { r.points += s.points; r.reachedAt = game.finishedAt; }
    }
  }

  const sorted = [...rows.values()].sort((a, b) =>
    b.points - a.points || b.wins - a.wins || a.losses - b.losses || a.reachedAt - b.reachedAt || a.userId - b.userId);
  sorted.forEach((r, i) => { r.rank = i + 1; });
  return { rows: sorted, scores, counted };
}

// ─── What the chess page is sent ────────────────────────────────────────────

export type ClashStanding = {
  rank: number;
  userId: number;
  displayName: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  games: number;
};

export type ClashMe = ClashStanding & {
  /** The reader one place above, to chase. null in first place. */
  ahead: { displayName: string; points: number } | null;
};

/** The reader's newest finished game in the competition, for the result screen. */
export type ClashLast = { matchId: string; points: number; outcome: ClashOutcome; counted: boolean; why: ClashWhy | null };

export type ClashView = {
  competition: ChessCompetition | null;
  phase: ClashPhase | null;
  /** The server's clock, so a school computer with the wrong time still counts down correctly. */
  now: number;
  /** The top of the board. */
  standings: ClashStanding[];
  /** Readers on the board. */
  players: number;
  /** Games that counted. */
  games: number;
  /** null until the reader has a game that counted. */
  me: ClashMe | null;
  last: ClashLast | null;
};

/** How many places the board shows. */
export const CLASH_BOARD_SIZE = 50;

/** One short line for a game that earned nothing. */
export function clashWhyText(why: ClashWhy | null): string {
  if (why === "short") return "Too short to count. Play at least 8 moves each, or win by checkmate.";
  if (why === "repeat") return `You two already played ${CLASH_SAME_READER_PER_DAY} counted games today. Find a new challenger!`;
  return "";
}
