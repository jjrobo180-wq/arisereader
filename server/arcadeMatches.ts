import { logActivity } from "./studentActivity";
import { GAMES } from "../shared/arcade/catalog";
import type { Express, RequestHandler } from "express";
import { getAdminSupabase } from "./supabase";
import { clubDay } from "../shared/clubPlay";
import { ENGINES, isGameId } from "../shared/arcade/registry";
import { MoveError, type Level, type Outcome, type Seat } from "../shared/arcade/core";
import { runComputer } from "./computerGovernor";
import { GAME_INFO, LEVEL_NAMES } from "../shared/arcade/catalog";

// ─── Reward rules (easy to change) ───────────────────────────────────────────
// Every finished arcade game gives Reader Coins and a win adds leaderboard
// points, but only up to these daily caps so quick games cannot be farmed.
export const DAILY_REWARDED_GAMES = 20;
export const DAILY_LEADERBOARD_WINS = 3;
export const WIN_LEADERBOARD_POINTS = 10;

const TABLE = "club_arise_matches";
// Older databases only allow the original game names in `game_type`. If a new
// game name is rejected, the match is stored under this name instead. The real
// game id always lives in state.game (migrations/arcade_more_games.sql allows every name).
const FALLBACK_GAME_TYPE = "four";
const WAITING_MINUTES = 15;
const AWAY_MS = 25_000;
const CLAIM_MS = 45_000;

type Access = { allowed: boolean; locked?: boolean; dailyRemaining?: number | null };
type Deps = {
  isStudent: (user: any) => boolean;
  getClubAccess: (userId: number, unrestricted?: boolean) => Promise<Access>;
};
export type Rewards = Record<string, { coins: boolean; points: boolean }>;

export type StoredState = {
  fw: 2;
  game: string; // game id (a lowercase key so the database can filter on it)
  v: number; // version, bumped on every save
  computer: boolean;
  level: Level;
  g: any; // the engine's own state
  winner: Outcome; // mirrored here for older readers of this table
  result?: "forfeit" | null;
  invitee?: number | null;
  declined?: boolean;
  rewards?: Rewards;
  adminPreview?: boolean;
  opponentName?: string;
  createdAt: number;
};

// ─── Presence for open tables and disconnects (single server process) ────────
const seen = new Map<string, { 1?: number; 2?: number }>();
function markSeen(matchId: string, seat: Seat) {
  const row = seen.get(matchId) || {};
  row[seat] = Date.now();
  seen.set(matchId, row);
}
/** Milliseconds since `seat` was last seen. Unknown seats start their clock now (safe after a restart). */
function awayFor(matchId: string, seat: Seat): number {
  const row = seen.get(matchId) || {};
  if (!row[seat]) { row[seat] = Date.now(); seen.set(matchId, row); }
  return Date.now() - (row[seat] as number);
}
const cleanup = setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  seen.forEach((row, id) => { if (Math.max(row[1] || 0, row[2] || 0) < cutoff) seen.delete(id); });
}, 10 * 60 * 1000);
(cleanup as any).unref?.();

/** Lets the computer (always seat 2) act until it is the human's turn again. */
function computerActs(state: StoredState): void {
  const engine = ENGINES[state.game];
  for (let guard = 0; guard < 200; guard++) {
    if (engine.outcome(state.g) !== null || !engine.toAct(state.g).includes(2)) break;
    try {
      const move = runComputer(() => engine.ai(state.g, 2, state.level));
      state.g = engine.play(state.g, 2, move);
    } catch (error: any) {
      console.error("[arcade] computer move failed", state.game, error?.message);
      break;
    }
  }
  state.winner = engine.outcome(state.g);
}

function freshState(gameId: string, computer: boolean, level: Level, extra: Partial<StoredState> = {}): StoredState {
  const state: StoredState = {
    fw: 2, game: gameId, v: 1, computer, level,
    g: ENGINES[gameId].init({ level, vsComputer: computer }),
    winner: null, createdAt: Date.now(),
    ...extra,
  };
  if (computer) {
    state.opponentName = "Computer";
    computerActs(state);
  }
  return state;
}

const isFramework = (state: any): state is StoredState => !!state && state.fw === 2 && isGameId(state.game);
const seatOf = (row: any, userId: number): Seat | 0 => (row.player1_id === userId ? 1 : row.player2_id === userId ? 2 : 0);

async function namesFor(ids: number[]): Promise<Map<number, string>> {
  const clean = Array.from(new Set(ids.filter((id) => Number(id) > 0)));
  if (!clean.length) return new Map();
  const { data } = await getAdminSupabase().from("users").select("id,display_name,username").in("id", clean);
  return new Map((data || []).map((u: any) => [u.id, String(u.display_name || u.username || "Reader")]));
}

function toClient(row: any, userId: number, names: Map<number, string>, extra: Record<string, unknown> = {}) {
  const state = row.state;
  if (!isFramework(state)) {
    return { id: row.id, gameId: String(row.game_type || ""), status: "cancelled", seat: 1, players: [], toAct: [], yourTurn: false, winner: null, view: null, legacy: true };
  }
  const engine = ENGINES[state.game];
  const seat = (seatOf(row, userId) || 1) as Seat;
  const other: Seat = seat === 1 ? 2 : 1;
  const toAct = row.status === "active" ? engine.toAct(state.g) : [];
  const away = !state.computer && row.status === "active" ? awayFor(row.id, other) : 0;
  const levelName = LEVEL_NAMES[state.level] || "Medium";
  return {
    id: row.id,
    gameId: state.game,
    status: row.status,
    seat,
    computer: state.computer,
    level: state.level,
    v: state.v,
    players: [
      { seat: 1, userId: row.player1_id, name: names.get(row.player1_id) || "Reader", computer: false },
      state.computer
        ? { seat: 2, userId: null, name: `Computer · ${levelName}`, computer: true }
        : { seat: 2, userId: row.player2_id, name: row.player2_id ? names.get(row.player2_id) || "Reader" : "Waiting…", computer: false },
    ],
    toAct,
    yourTurn: toAct.includes(seat),
    winner: state.winner,
    result: state.result || null,
    view: engine.view(state.g, seat),
    invitee: state.invitee ? { userId: state.invitee, name: names.get(state.invitee) || "Reader" } : null,
    declined: !!state.declined,
    opponentAway: away >= AWAY_MS,
    canClaim: away >= CLAIM_MS,
    reward: state.rewards?.[String(seat)] || null,
    ...extra,
  };
}

async function clientFor(row: any, userId: number, extra?: Record<string, unknown>) {
  const st = row.state as StoredState | undefined;
  const ids = [row.player1_id, row.player2_id, st?.invitee].filter(Boolean) as number[];
  return toClient(row, userId, await namesFor(ids), extra);
}

function isCheckViolation(error: any) {
  return error?.code === "23514" || /game_type_check|violates check constraint/i.test(String(error?.message || ""));
}
async function insertMatch(input: Record<string, unknown>) {
  const db = getAdminSupabase();
  const row = { ...input, updated_at: new Date().toISOString() };
  let result = await db.from(TABLE).insert(row).select("*").single();
  if (result.error && isCheckViolation(result.error)) {
    result = await db.from(TABLE).insert({ ...row, game_type: FALLBACK_GAME_TYPE }).select("*").single();
  }
  if (result.error) throw result.error;
  return result.data;
}

/** Saves a new state only if nobody changed the match (version and status) first. Returns null on a conflict. */
async function saveIfUnchanged(row: any, state: StoredState, patch: Record<string, unknown> = {}) {
  const prevV = (row.state as StoredState).v;
  const next = { ...state, v: prevV + 1 };
  const { data, error } = await getAdminSupabase().from(TABLE)
    .update({ state: next, updated_at: new Date().toISOString(), ...patch })
    .eq("id", row.id).eq("status", row.status).eq("state->>v", String(prevV))
    .select("*");
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

/** Decides who earns coins / leaderboard points for a finished match (daily caps). Chess uses it too. */
export async function decideRewards(row: any, state: { winner: number | null; result?: string | null; adminPreview?: boolean }): Promise<Rewards> {
  const out: Rewards = {};
  const today = clubDay(Date.now());
  const since = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  for (const seat of [1, 2] as Seat[]) {
    const userId = seat === 1 ? row.player1_id : row.player2_id;
    if (!userId) continue;
    if (state.adminPreview) { out[seat] = { coins: false, points: false }; continue; }
    const { data } = await getAdminSupabase().from(TABLE)
      .select("player1_id,player2_id,state,updated_at")
      .eq("status", "finished").gte("updated_at", since)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);
    let games = 0, pointWins = 0;
    for (const m of data || []) {
      if (clubDay(new Date(m.updated_at).getTime()) !== today) continue;
      const mySeat = m.player1_id === userId ? "1" : "2";
      const flags = (m.state as StoredState | undefined)?.rewards?.[mySeat];
      if (!flags || flags.coins !== false) games++;
      if (flags?.points) pointWins++;
    }
    out[seat] = {
      coins: games < DAILY_REWARDED_GAMES,
      points: state.winner === seat && state.result !== "forfeit" && pointWins < DAILY_LEADERBOARD_WINS,
    };
  }
  return out;
}

/** Adds leaderboard points once per match (the rewards_awarded flag is flipped atomically first). */
export async function awardPoints(row: any) {
  const state = row.state as StoredState;
  const db = getAdminSupabase();
  const { data: claimed } = await db.from(TABLE).update({ rewards_awarded: true }).eq("id", row.id).eq("rewards_awarded", false).select("id");
  if (!claimed?.length) return;
  for (const seat of [1, 2] as Seat[]) {
    if (!state.rewards?.[seat]?.points) continue;
    const userId = seat === 1 ? row.player1_id : row.player2_id;
    if (!userId) continue;
    const { data: user } = await db.from("users").select("total_points,username,is_admin,role").eq("id", userId).single();
    if (!user || user.is_admin || user.role === "admin" || String(user.username || "").startsWith("sample")) continue;
    await db.from("users").update({ total_points: Math.round((Number(user.total_points || 0) + WIN_LEADERBOARD_POINTS) * 10) / 10 }).eq("id", userId);
  }
}

/** Finishes a match with its rewards decided. A player who walked out earns no coins for it. */
async function finishMatch(row: any, state: StoredState, leaverSeat: Seat | 0 = 0) {
  const rewards = await decideRewards(row, state);
  if (leaverSeat && rewards[leaverSeat]) rewards[leaverSeat].coins = false;
  const finished: StoredState = { ...state, rewards };
  const winnerUserId = state.winner === 1 ? row.player1_id : state.winner === 2 ? row.player2_id : null;
  const saved = await saveIfUnchanged(row, finished, { status: "finished", winner_id: winnerUserId });
  if (saved) await awardPoints(saved);
  return saved;
}

async function loadMatch(id: string) {
  const { data, error } = await getAdminSupabase().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export function registerArcadeMatchRoutes(app: Express, authMiddleware: RequestHandler, deps: Deps) {
  const db = () => getAdminSupabase();
  const studentOnly = (req: any, res: any) => {
    if (deps.isStudent(req.user)) return true;
    res.status(403).json({ message: "The arcade is for student accounts." });
    return false;
  };
  const accessMessage = (access: Access) => access.locked
    ? "Your teacher has locked arcade games."
    : access.dailyRemaining === 0 ? "You reached today's arcade game limit." : "Pass another book quiz to unlock more arcade games.";

  /** Leaving: waiting or computer games are cancelled; leaving a live reader match forfeits it. */
  async function leaveMatch(row: any, userId: number) {
    const state = row.state as StoredState;
    const seat = seatOf(row, userId);
    if (!seat) return;
    if (row.status === "waiting" || (row.status === "active" && (state.computer || !row.player2_id))) {
      await db().from(TABLE).update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", row.id).in("status", ["waiting", "active"]);
      return;
    }
    if (row.status !== "active") return;
    await finishMatch(row, { ...state, winner: seat === 1 ? 2 : 1, result: "forfeit" }, seat);
  }

  /** Clears a player's own unfinished arcade matches before a new one starts (chess keeps its own rules). */
  async function clearOpenMatches(userId: number) {
    const { data } = await db().from(TABLE).select("*")
      .in("status", ["waiting", "active"]).neq("game_type", "chess")
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);
    for (const row of data || []) {
      if (isFramework(row.state)) await leaveMatch(row, userId);
      else await db().from(TABLE).update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", row.id);
    }
  }

  app.post("/api/club-arise/matches/join", authMiddleware, async (req: any, res) => {
    try {
      if (!studentOnly(req, res)) return;
      const userId = Number(req.user.id);
      const gameId = String(req.body?.gameType || req.body?.gameId || "");
      if (!isGameId(gameId)) return res.status(400).json({ message: "Unknown game." });
      const computer = !!req.body?.computer;
      const level = ([1, 2, 3].includes(Number(req.body?.level)) ? Number(req.body.level) : 2) as Level;
      const tableId = req.body?.matchId ? String(req.body.matchId) : "";
      const inviteUserId = Number(req.body?.inviteUserId) || 0;
      const adminPreview = req.adminPreview === "regular";
      const access = await deps.getClubAccess(userId, adminPreview);
      if (!access.allowed) return res.status(403).json({ message: accessMessage(access), access });
      if (!adminPreview) void logActivity(userId, "game", `${GAMES.find((g) => g.id === gameId)?.title ?? gameId}${computer ? " vs the computer" : ""}`);

      // Joining a specific open table, or accepting a challenge.
      if (tableId) {
        const table = await loadMatch(tableId);
        const st = table?.state;
        const fresh = table && Date.now() - new Date(table.created_at).getTime() < WAITING_MINUTES * 60 * 1000;
        if (!table || table.status !== "waiting" || !isFramework(st) || !fresh) return res.status(409).json({ message: "That game is no longer open." });
        if (table.player1_id === userId) return res.status(400).json({ message: "That is your own table." });
        if (st.invitee && st.invitee !== userId) return res.status(403).json({ message: "That challenge was for someone else." });
        await clearOpenMatches(userId);
        const joined = await saveIfUnchanged(table, { ...st, adminPreview: !!st.adminPreview || adminPreview }, { player2_id: userId, status: "active" });
        if (!joined) return res.status(409).json({ message: "Someone else just joined that table." });
        markSeen(joined.id, 2);
        return res.json(await clientFor(joined, userId));
      }

      await clearOpenMatches(userId);
      if (computer) {
        const row = await insertMatch({
          game_type: gameId, status: "active", player1_id: userId, player2_id: null,
          state: freshState(gameId, true, level, { adminPreview }),
        });
        return res.json(await clientFor(row, userId));
      }

      if (inviteUserId) {
        if (inviteUserId === userId) return res.status(400).json({ message: "Pick another reader to challenge." });
        const { data: target } = await db().from("users").select("id,role,is_eye_gaze_user,is_admin").eq("id", inviteUserId).maybeSingle();
        if (!target || target.role !== "student" || target.is_eye_gaze_user || target.is_admin) return res.status(404).json({ message: "That reader can't be challenged right now." });
        const row = await insertMatch({
          game_type: gameId, status: "waiting", player1_id: userId,
          state: freshState(gameId, false, level, { invitee: inviteUserId, adminPreview }),
        });
        markSeen(row.id, 1);
        return res.json(await clientFor(row, userId));
      }

      // Quick match: join the oldest open table for this game whose host is still here.
      const since = new Date(Date.now() - WAITING_MINUTES * 60 * 1000).toISOString();
      const { data: open } = await db().from(TABLE).select("*")
        .eq("status", "waiting").eq("state->>game", gameId).neq("player1_id", userId)
        .gte("created_at", since).order("created_at", { ascending: true }).limit(10);
      for (const table of open || []) {
        const st = table.state;
        if (!isFramework(st) || st.invitee) continue;
        const hostSeen = seen.get(table.id)?.[1];
        if (!hostSeen || Date.now() - hostSeen > AWAY_MS) continue;
        const joined = await saveIfUnchanged(table, { ...st, adminPreview: !!st.adminPreview || adminPreview }, { player2_id: userId, status: "active" });
        if (joined) {
          markSeen(joined.id, 2);
          return res.json(await clientFor(joined, userId));
        }
      }
      const row = await insertMatch({
        game_type: gameId, status: "waiting", player1_id: userId,
        state: freshState(gameId, false, level, { adminPreview }),
      });
      markSeen(row.id, 1);
      res.json(await clientFor(row, userId));
    } catch (error: any) {
      console.error("[arcade] join", error?.message);
      res.status(500).json({ message: "Could not start that game." });
    }
  });

  app.get("/api/club-arise/matches/:id", authMiddleware, async (req: any, res) => {
    try {
      if (!studentOnly(req, res)) return;
      const userId = Number(req.user.id);
      const row = await loadMatch(String(req.params.id));
      if (!row) return res.status(404).json({ message: "Game not found." });
      const seat = seatOf(row, userId);
      if (!seat) {
        // An invited reader may look at the challenge before accepting it.
        if (row.state?.invitee !== userId) return res.status(403).json({ message: "This is not your game." });
      } else markSeen(row.id, seat);
      res.set("Cache-Control", "no-store");
      res.json(await clientFor(row, userId));
    } catch (error: any) {
      console.error("[arcade] get", error?.message);
      res.status(500).json({ message: "Could not load the game." });
    }
  });

  app.post("/api/club-arise/matches/:id/action", authMiddleware, async (req: any, res) => {
    try {
      if (!studentOnly(req, res)) return;
      const userId = Number(req.user.id);
      for (let attempt = 0; attempt < 4; attempt++) {
        const row = await loadMatch(String(req.params.id));
        if (!row) return res.status(404).json({ message: "Game not found." });
        const seat = seatOf(row, userId);
        if (!seat) return res.status(403).json({ message: "This is not your game." });
        const state = row.state;
        if (!isFramework(state)) return res.status(409).json({ message: "This game has ended. Start a new one." });
        if (row.status === "waiting") return res.status(400).json({ message: "Waiting for another reader to join." });
        if (row.status !== "active") return res.json(await clientFor(row, userId));
        markSeen(row.id, seat);
        const engine = ENGINES[state.game];
        if (!engine.toAct(state.g).includes(seat)) return res.status(400).json({ message: "Wait for your turn." });
        const next: StoredState = { ...state };
        try {
          next.g = engine.play(state.g, seat, req.body?.move ?? req.body);
        } catch (error) {
          if (error instanceof MoveError) return res.status(400).json({ message: error.message });
          throw error;
        }
        next.winner = engine.outcome(next.g);
        let interim: unknown = undefined;
        if (next.computer && next.winner === null && engine.toAct(next.g).includes(2)) {
          interim = engine.view(next.g, seat); // shown first, so the computer's reply can animate in
          computerActs(next);
        }
        const saved = next.winner !== null ? await finishMatch(row, next) : await saveIfUnchanged(row, next);
        if (!saved) continue; // someone else moved at the same moment; try again
        return res.json(await clientFor(saved, userId, interim === undefined ? {} : { interim }));
      }
      res.status(409).json({ message: "The board changed. Try that move again." });
    } catch (error: any) {
      console.error("[arcade] action", error?.message);
      res.status(500).json({ message: "Could not make that move." });
    }
  });

  app.post("/api/club-arise/matches/:id/leave", authMiddleware, async (req: any, res) => {
    try {
      if (!studentOnly(req, res)) return;
      const userId = Number(req.user.id);
      const row = await loadMatch(String(req.params.id));
      if (!row) return res.status(404).json({ message: "Game not found." });
      if (!seatOf(row, userId)) return res.status(403).json({ message: "This is not your game." });
      if (isFramework(row.state)) await leaveMatch(row, userId);
      else if (["waiting", "active"].includes(row.status)) await db().from(TABLE).update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", row.id);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[arcade] leave", error?.message);
      res.status(500).json({ message: "Could not leave that game." });
    }
  });

  app.post("/api/club-arise/matches/:id/claim", authMiddleware, async (req: any, res) => {
    try {
      if (!studentOnly(req, res)) return;
      const userId = Number(req.user.id);
      const row = await loadMatch(String(req.params.id));
      if (!row) return res.status(404).json({ message: "Game not found." });
      const seat = seatOf(row, userId);
      const state = row.state;
      if (!seat || !isFramework(state)) return res.status(403).json({ message: "This is not your game." });
      if (row.status !== "active" || state.computer) return res.json(await clientFor(row, userId));
      const other: Seat = seat === 1 ? 2 : 1;
      if (awayFor(row.id, other) < CLAIM_MS) return res.status(400).json({ message: "Your opponent is still here. Give them a moment!" });
      const saved = await finishMatch(row, { ...state, winner: seat, result: "forfeit" }, other);
      res.json(await clientFor(saved || (await loadMatch(row.id)), userId));
    } catch (error: any) {
      console.error("[arcade] claim", error?.message);
      res.status(500).json({ message: "Could not end that game." });
    }
  });

  app.post("/api/club-arise/matches/:id/decline", authMiddleware, async (req: any, res) => {
    try {
      if (!studentOnly(req, res)) return;
      const userId = Number(req.user.id);
      const row = await loadMatch(String(req.params.id));
      const state = row?.state;
      if (!row || !isFramework(state) || state.invitee !== userId) return res.status(404).json({ message: "Challenge not found." });
      if (row.status === "waiting") await saveIfUnchanged(row, { ...state, declined: true }, { status: "cancelled" });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[arcade] decline", error?.message);
      res.status(500).json({ message: "Could not decline that challenge." });
    }
  });

  // Open tables anyone can join, and challenges sent to you.
  app.get("/api/club-arise/lobby", authMiddleware, async (req: any, res) => {
    try {
      if (!studentOnly(req, res)) return;
      const userId = Number(req.user.id);
      const since = new Date(Date.now() - WAITING_MINUTES * 60 * 1000).toISOString();
      const { data } = await db().from(TABLE).select("id,player1_id,state,created_at")
        .eq("status", "waiting").neq("game_type", "chess").gte("created_at", since)
        .order("created_at", { ascending: false }).limit(40);
      const rows = (data || []).filter((row: any) => {
        if (!isFramework(row.state) || row.player1_id === userId) return false;
        const hostSeen = seen.get(row.id)?.[1];
        return !!hostSeen && Date.now() - hostSeen < AWAY_MS;
      });
      const names = await namesFor(rows.map((r: any) => r.player1_id));
      const shape = (row: any) => ({
        matchId: row.id,
        gameId: row.state.game,
        gameName: GAME_INFO[row.state.game]?.name || "Arcade game",
        hostId: row.player1_id,
        hostName: names.get(row.player1_id) || "Reader",
        createdAt: row.created_at,
      });
      res.set("Cache-Control", "no-store");
      res.json({
        tables: rows.filter((r: any) => !r.state.invitee).map(shape),
        invites: rows.filter((r: any) => r.state.invitee === userId).map(shape),
      });
    } catch (error: any) {
      console.error("[arcade] lobby", error?.message);
      res.status(500).json({ message: "Could not load the game room." });
    }
  });
}

/** Coins rule used by the avatar world: a finished match counts unless its reward flag says otherwise. */
export function matchEarnsCoins(match: { player1_id: number; player2_id: number | null; state?: any }, userId: number): boolean {
  const seat = match.player1_id === userId ? "1" : "2";
  return match.state?.rewards?.[seat]?.coins !== false;
}
/** Which game a stored match is (new matches keep it in state.game). */
export function matchGameId(match: { game_type?: string; state?: any }): string {
  return String(match.state?.game || match.game_type || "");
}
