// The chess competition standings (rules and dates live in shared/chessCompetition.ts).
// The database is handed in, so the tests can run this against a pretend one.
import {
  CLASH_BOARD_SIZE, clashPhase, clashStandings, currentClash,
  type ChessCompetition, type ClashGame, type ClashLast, type ClashStanding, type ClashTable, type ClashView,
} from "../shared/chessCompetition";

/** The part of the Supabase client this file uses. */
export type ClashDb = { from: (table: string) => any };

const TABLE = "club_arise_matches";
const PAGE = 1000;
/** Stops a runaway read: 60 pages is 60,000 finished games. */
const MAX_PAGES = 60;
/**
 * Only the parts of a saved game the standings need (a whole game state is large).
 * Each part of `state` comes back under its own name: winner, result, computer, computerLevel, moveHistory.
 */
const LEAN = "id,player1_id,player2_id,updated_at,state->winner,state->>result,state->computer,state->computerLevel,state->moveHistory";
const FULL = "id,player1_id,player2_id,updated_at,state";
/** The board is rebuilt at most this often while games are being played. */
const LIVE_CACHE_MS = 10_000;
const ENDED_CACHE_MS = 5 * 60_000;
/** A reader who just finished a game may skip a cache older than this. */
const FRESH_CACHE_MS = 2_000;

/** After a failed lean read, whole games are read until this moment. */
let leanRetryAt = 0;
const LEAN_RETRY_MS = 10 * 60_000;

/** Turns a saved match row (lean or whole) into what the standings count. null when it cannot count. */
export function toClashGame(row: any): ClashGame | null {
  // A whole row keeps these under `state`; a lean row has them beside the ids.
  const state = row?.state && typeof row.state === "object" ? row.state : row;
  const rawWinner = state?.winner;
  if (rawWinner === null || rawWinner === undefined) return null;
  const winner = Number(rawWinner);
  if (winner !== 0 && winner !== 1 && winner !== 2) return null;
  const p1 = Number(row.player1_id || 0);
  const finishedAt = Date.parse(String(row.updated_at || ""));
  if (!p1 || !Number.isFinite(finishedAt)) return null;
  const computer = !!state.computer;
  const p2 = computer ? null : Number(row.player2_id || 0) || null;
  if (!computer && (!p2 || p2 === p1)) return null;
  const moves = state.moveHistory, result = state.result;
  return {
    id: String(row.id), p1, p2, winner, computer,
    result: result === null || result === undefined ? null : String(result),
    level: Number(state.computerLevel) || 2,
    plies: Array.isArray(moves) ? moves.length : 0,
    finishedAt,
  };
}

async function readGames(db: ClashDb, c: ChessCompetition): Promise<ClashGame[]> {
  const from = new Date(Date.parse(c.startsAt)).toISOString(), to = new Date(Date.parse(c.endsAt)).toISOString();
  const read = async (columns: string) => {
    const out: any[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await db.from(TABLE).select(columns)
        .eq("game_type", "chess").eq("status", "finished").gte("updated_at", from).lt("updated_at", to)
        .order("updated_at", { ascending: true }).order("id", { ascending: true })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    return out;
  };
  let rows: any[] | null = null;
  if (Date.now() >= leanRetryAt) {
    try {
      rows = await read(LEAN);
    } catch (error: any) {
      // If the lean question cannot be answered, whole games always can. Ask that way for a while before trying again.
      console.warn("[chess] competition lean read failed, reading whole games:", error?.message);
      leanRetryAt = Date.now() + LEAN_RETRY_MS;
    }
  }
  if (!rows) rows = await read(FULL);
  return rows.map(toClashGame).filter((g): g is ClashGame => !!g);
}

type Person = { name: string; counts: boolean };
async function readPeople(db: ClashDb, ids: number[]): Promise<Map<number, Person>> {
  const people = new Map<number, Person>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await db.from("users").select("id,display_name,username,is_admin,role").in("id", ids.slice(i, i + 300));
    if (error) throw error;
    for (const u of data || []) {
      const username = String(u.username || "");
      people.set(Number(u.id), {
        name: String(u.display_name || username || "Reader"),
        // Sample (demo) and admin accounts never take a place on the board.
        counts: !u.is_admin && u.role !== "admin" && !username.startsWith("sample"),
      });
    }
  }
  return people;
}

type Board = {
  id: string;
  /** When the games were read, by this server's clock: how old the board is. */
  at: number;
  /** The moment the board was built for: a board from before the end is never the final one. */
  asOf: number;
  table: ClashTable; names: Map<number, string>; last: Map<number, ClashLast>;
};
let cache: Board | null = null;
let building: { id: string; live: boolean; promise: Promise<Board> } | null = null;
/** Goes up whenever a game finishes; a read that started before then is not kept. */
let generation = 0;

/** Call when a chess game finishes, so the next look at the board includes it. */
export function forgetClashBoard() { generation++; cache = null; building = null; }

async function buildBoard(db: ClashDb, c: ChessCompetition, now: number): Promise<Board> {
  const startedAt = Date.now();
  const all = await readGames(db, c);
  const people = await readPeople(db, [...new Set(all.flatMap((g) => (g.p2 ? [g.p1, g.p2] : [g.p1])))]);
  // A game with a demo or admin account on either side does not count for anyone.
  const games = all.filter((g) => people.get(g.p1)?.counts && (!g.p2 || people.get(g.p2)?.counts));
  const table = clashStandings(games);
  const last = new Map<number, ClashLast>();
  for (const g of games) { // oldest first, so the newest game wins
    const entry = table.scores.get(g.id);
    if (!entry) continue;
    for (const seat of [1, 2] as const) {
      const userId = seat === 1 ? g.p1 : g.p2;
      if (userId) last.set(userId, { matchId: g.id, ...entry[seat] });
    }
  }
  const names = new Map([...people].map(([id, p]) => [id, p.name]));
  return { id: c.id, at: startedAt, asOf: now, table, names, last };
}

async function board(db: ClashDb, c: ChessCompetition, now: number, maxAgeMs: number): Promise<Board> {
  const final = now >= Date.parse(c.endsAt);
  const usable = (b: Board) => b.id === c.id && (!final || b.asOf >= Date.parse(c.endsAt));
  if (cache && usable(cache) && Date.now() - cache.at < maxAgeMs) return cache;
  if (building && !final !== building.live) building = null; // a read from before the end cannot serve the final board
  // Many readers asking at once share one read of the games.
  if (!building || building.id !== c.id) {
    const mine = generation;
    const promise: Promise<Board> = buildBoard(db, c, now)
      .then((b) => { if (mine === generation) cache = b; return b; })
      .finally(() => { if (building?.promise === promise) building = null; });
    building = { id: c.id, live: !final, promise };
  }
  return building.promise;
}

/** What one reader sees: the competition, the top of the board, and their own place on it. */
export async function clashView(db: ClashDb, userId: number, now = Date.now(), fresh = false): Promise<ClashView> {
  const competition = currentClash(now);
  const empty: ClashView = { competition, phase: competition ? clashPhase(competition, now) : null, now, standings: [], players: 0, games: 0, me: null, last: null };
  if (!competition || empty.phase === "soon") return empty;
  const b = await board(db, competition, now, fresh ? FRESH_CACHE_MS : empty.phase === "ended" ? ENDED_CACHE_MS : LIVE_CACHE_MS);
  const name = (id: number) => b.names.get(id) || "Reader";
  const standing = (r: ClashTable["rows"][number]): ClashStanding => ({
    rank: r.rank, userId: r.userId, displayName: name(r.userId), points: r.points, wins: r.wins, draws: r.draws, losses: r.losses, games: r.games,
  });
  const mine = b.table.rows.find((r) => r.userId === userId);
  const ahead = mine && mine.rank > 1 ? b.table.rows[mine.rank - 2] : null;
  return {
    ...empty,
    standings: b.table.rows.slice(0, CLASH_BOARD_SIZE).map(standing),
    players: b.table.rows.length,
    games: b.table.counted,
    me: mine ? { ...standing(mine), ahead: ahead ? { displayName: name(ahead.userId), points: ahead.points } : null } : null,
    last: b.last.get(userId) || null,
  };
}
