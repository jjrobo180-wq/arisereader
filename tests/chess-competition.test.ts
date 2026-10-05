// The chess competition (Crown Clash): its dates, its points, and the standings the chess page is sent.
// Run with: npx tsx --test tests/chess-competition.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CHESS_COMPETITIONS, CLASH_ANNOUNCE_MS, CLASH_BOARD_SIZE, CLASH_MIN_PLIES, CLASH_POINTS, CLASH_RESULTS_STAY_MS, CLASH_SAME_READER_PER_DAY,
  clashClock, clashDates, clashFirstDay, clashGamePoints, clashHeat, clashLastDay, clashPhase, clashStandings, clashTarget, clashWhyText, currentClash,
  type ClashGame,
} from "../shared/chessCompetition";
import { clashView, forgetClashBoard, toClashGame } from "../server/chessCompetition";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const CLASH = CHESS_COMPETITIONS[0];
const START = Date.parse(CLASH.startsAt), END = Date.parse(CLASH.endsAt);
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

// ─── The dates ──────────────────────────────────────────────────────────────

test("Crown Clash runs from Monday Oct 5 through Monday Oct 19, 2026, Mountain Time", () => {
  assert.equal(CLASH.name, "Crown Clash");
  const mountain = (ms: number) => new Date(ms).toLocaleString("en-US", { timeZone: "America/Denver", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  assert.equal(mountain(START), "Mon, Oct 5, 12:00 AM");
  assert.equal(mountain(END - 1000), "Mon, Oct 19, 11:59 PM");
  assert.equal(END - START, 15 * DAY, "two weeks, plus the last Monday");
  assert.equal(clashDates(CLASH), "Oct 5 – Oct 19");
  assert.equal(clashFirstDay(CLASH), "Monday, Oct 5");
  assert.equal(clashLastDay(CLASH), "Monday, Oct 19");
});

test("it is announced a week ahead, on for its dates, and its results stay two weeks", () => {
  assert.equal(currentClash(START - CLASH_ANNOUNCE_MS - HOUR), null);
  assert.equal(currentClash(START - DAY)?.id, CLASH.id);
  assert.equal(clashPhase(CLASH, START - DAY), "soon");
  assert.equal(clashPhase(CLASH, START), "live");
  assert.equal(clashPhase(CLASH, END - 1), "live");
  assert.equal(clashPhase(CLASH, END), "ended");
  assert.equal(currentClash(END + CLASH_RESULTS_STAY_MS - HOUR)?.id, CLASH.id);
  assert.equal(currentClash(END + CLASH_RESULTS_STAY_MS + HOUR), null);
  // a competition that is on is shown ahead of one that just ended or is coming up
  const next = { ...CLASH, id: "next", startsAt: new Date(END + 2 * DAY).toISOString(), endsAt: new Date(END + 9 * DAY).toISOString() };
  assert.equal(currentClash(END + DAY, [CLASH, next])?.id, "next", "the next one is announced over old results");
  assert.equal(currentClash(END + 3 * DAY, [CLASH, next])?.id, "next");
});

test("the countdown counts to the start, then to the end", () => {
  assert.equal(clashTarget(CLASH, START - HOUR), START);
  assert.equal(clashTarget(CLASH, START + HOUR), END);
  assert.deepEqual(clashClock(END - (START + 9 * HOUR + 47 * MIN + 30_000)), { days: 14, hours: 14, minutes: 12, seconds: 30 });
  assert.deepEqual(clashClock(999), { days: 0, hours: 0, minutes: 0, seconds: 1 }, "it shows 1 until the last second is gone");
  assert.deepEqual(clashClock(0), { days: 0, hours: 0, minutes: 0, seconds: 0 });
  assert.deepEqual(clashClock(-5000), { days: 0, hours: 0, minutes: 0, seconds: 0 }, "never below zero");
});

test("the last day and the last hour are marked", () => {
  assert.equal(clashHeat(CLASH, START + DAY), null);
  assert.equal(clashHeat(CLASH, END - DAY - MIN), null);
  assert.equal(clashHeat(CLASH, END - 5 * HOUR), "day");
  assert.equal(clashHeat(CLASH, END - 20 * MIN), "hour");
  assert.equal(clashHeat(CLASH, END + MIN), null);
  assert.equal(clashHeat(CLASH, START - MIN), null);
});

// ─── The points ─────────────────────────────────────────────────────────────

let serial = 0;
/** A finished game. Defaults: a long game the first seat won by checkmate. */
function game(p1: number, p2: number | null, over: Partial<ClashGame> = {}): ClashGame {
  serial++;
  return { id: "g" + String(serial).padStart(4, "0"), p1, p2, winner: 1, result: "checkmate", computer: p2 === null, level: 2, plies: 40, finishedAt: START + serial * MIN, ...over };
}

test("harder opponents are worth more", () => {
  assert.deepEqual(CLASH_POINTS.computer, [2, 3, 4, 5]);
  for (const level of [1, 2, 3, 4]) assert.equal(clashGamePoints(game(1, null, { level }), 1), CLASH_POINTS.computer[level - 1]);
  assert.equal(clashGamePoints(game(1, null, { level: 9 }), 1), 5, "an odd level is treated as the nearest real one");
  assert.equal(clashGamePoints(game(1, null, { winner: 2, level: 4 }), 1), 0, "losing to the computer earns nothing");
  assert.equal(clashGamePoints(game(1, 2), 1), CLASH_POINTS.reader);
  assert.equal(clashGamePoints(game(1, 2), 2), 0);
  assert.equal(clashGamePoints(game(1, 2, { winner: 2 }), 2), CLASH_POINTS.reader);
  assert.equal(clashGamePoints(game(1, 2, { winner: 0, result: "stalemate" }), 1), CLASH_POINTS.draw);
  assert.equal(clashGamePoints(game(1, 2, { winner: 0, result: "stalemate" }), 2), CLASH_POINTS.draw);
});

test("a very short game only counts if it ends in checkmate", () => {
  const quit = game(1, 2, { result: "resignation", plies: 2 });
  const mate = game(1, 2, { result: "checkmate", plies: 7 });
  const longEnough = game(3, 4, { result: "resignation", plies: CLASH_MIN_PLIES });
  const almost = game(5, 6, { result: "timeout", plies: CLASH_MIN_PLIES - 1 });
  const t = clashStandings([quit, mate, longEnough, almost]);
  assert.deepEqual(t.scores.get(quit.id)![1], { points: 0, outcome: "win", counted: false, why: "short" });
  assert.equal(t.scores.get(mate.id)![1].points, 5);
  assert.equal(t.scores.get(longEnough.id)![1].points, 5);
  assert.equal(t.scores.get(almost.id)![1].why, "short");
  assert.equal(t.counted, 2);
  assert.deepEqual(t.rows.map((r) => [r.userId, r.points, r.games]), [[1, 5, 1], [3, 5, 1], [2, 0, 1], [4, 0, 1]], "games that do not count leave no trace");
  assert.match(clashWhyText("short"), /8 moves each/);
});

test("the same two readers can play for points three times a day", () => {
  const day = (n: number) => START + n * DAY + 10 * HOUR;
  const games = [0, 1, 2, 3, 4].map((i) => game(1, 2, { finishedAt: day(0) + i * MIN, winner: i % 2 ? 2 : 1 }));
  const nextDay = game(2, 1, { finishedAt: day(1) });
  const other = game(1, 3, { finishedAt: day(0) + 30 * MIN });
  const computer = [0, 1, 2, 3, 4, 5].map((i) => game(1, null, { finishedAt: day(0) + HOUR + i * MIN }));
  const t = clashStandings([...games, nextDay, other, ...computer]);
  assert.equal(CLASH_SAME_READER_PER_DAY, 3);
  assert.deepEqual(games.map((g) => t.scores.get(g.id)![1].why), [null, null, null, "repeat", "repeat"]);
  assert.equal(t.scores.get(nextDay.id)![1].counted, true, "a new day starts the count again, whoever plays White");
  assert.equal(t.scores.get(other.id)![1].counted, true, "a different reader is not held back");
  assert.ok(computer.every((g) => t.scores.get(g.id)![1].counted), "games against the computer have no such limit");
  const one = t.rows.find((r) => r.userId === 1)!;
  // 2 wins of the first 3 against reader 2 (10), a win against reader 3 (5), six computer wins on Challenger (18)
  assert.deepEqual([one.points, one.wins, one.losses, one.games], [33, 9, 2, 11]);
  assert.match(clashWhyText("repeat"), /3 counted games today/);
  // a short game does not use up one of the three
  const short = game(7, 8, { finishedAt: day(2), result: "resignation", plies: 4 });
  const three = [1, 2, 3].map((i) => game(7, 8, { finishedAt: day(2) + i * MIN }));
  assert.ok(three.every((g) => clashStandings([short, ...three]).scores.get(g.id)![1].counted));
  // the day is the site's day (Mountain Time), not the day in London
  const lateNight = [0, 1, 2].map((i) => game(11, 12, { finishedAt: Date.parse("2026-10-07T04:00:00Z") + i * MIN })); // 10 PM Oct 6 in Denver
  const sameNight = game(11, 12, { finishedAt: Date.parse("2026-10-07T05:30:00Z") }); // 11:30 PM Oct 6 in Denver
  const afterMidnight = game(11, 12, { finishedAt: Date.parse("2026-10-07T06:30:00Z") }); // 12:30 AM Oct 7 in Denver
  const night = clashStandings([...lateNight, sameNight, afterMidnight]);
  assert.equal(night.scores.get(sameNight.id)![1].why, "repeat");
  assert.equal(night.scores.get(afterMidnight.id)![1].counted, true);
});

test("the board is ordered by points, then wins, then fewer losses, then who got there first", () => {
  const at = (n: number) => START + n * HOUR;
  const t = clashStandings([
    // 10: 9 points from three Challenger wins
    game(10, null, { finishedAt: at(1) }), game(10, null, { finishedAt: at(2) }), game(10, null, { finishedAt: at(3) }),
    // 20: 9 points from a Titan win and a Master win, so fewer wins than 10
    game(20, null, { level: 4, finishedAt: at(1) }), game(20, null, { level: 3, finishedAt: at(2) }),
    // 30 and 40: 5 points and one win each; 40 also lost a game
    game(30, null, { level: 4, finishedAt: at(9) }),
    game(40, null, { level: 4, finishedAt: at(1) }), game(40, null, { level: 4, winner: 2, finishedAt: at(2) }),
    // 50 and 60: the same record; 60 reached it first
    game(50, null, { level: 1, finishedAt: at(8) }), game(60, null, { level: 1, finishedAt: at(4) }),
    // 70 has only lost: on the board with no points
    game(70, null, { winner: 2, finishedAt: at(5) }),
  ]);
  assert.deepEqual(t.rows.map((r) => r.userId), [10, 20, 30, 40, 60, 50, 70]);
  assert.deepEqual(t.rows.map((r) => r.rank), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(t.rows.map((r) => r.points), [9, 9, 5, 5, 2, 2, 0]);
  // a later loss does not change when a reader reached their score
  const lossLater = clashStandings([game(50, null, { level: 1, finishedAt: at(4) }), game(50, null, { winner: 2, finishedAt: at(20) }), game(60, null, { level: 1, finishedAt: at(8) }), game(60, null, { winner: 2, finishedAt: at(9) })]);
  assert.deepEqual(lossLater.rows.map((r) => r.userId), [50, 60]);
});

// ─── The server ─────────────────────────────────────────────────────────────

type Tables = { club_arise_matches: any[]; users: any[] };
/** A pretend Supabase: enough of the query builder for the competition code. */
function fakeDb(tables: Tables, opts: { leanFails?: boolean } = {}) {
  const stats = { reads: 0, columns: [] as string[] };
  const project = (row: any, columns: string) => {
    const out: any = {};
    for (const part of columns.split(",")) {
      // "state->winner" comes back as "winner": a part of a JSON column is named after its last key
      const m = /^(\w+)(->>?)(\w+)$/.exec(part);
      if (!m) { out[part] = row[part]; continue; }
      const v = row[m[1]]?.[m[3]];
      out[m[3]] = v === undefined || v === null ? null : m[2] === "->>" ? String(v) : v;
    }
    return out;
  };
  const from = (table: string) => {
    let rows = [...tables[table as keyof Tables]], columns = "", range: [number, number] | null = null;
    const orders: [string, boolean][] = [];
    const q: any = {
      select(c: string) { columns = c; return q; },
      eq(k: string, v: any) { rows = rows.filter((r) => r[k] === v); return q; },
      gte(k: string, v: any) { rows = rows.filter((r) => String(r[k]) >= v); return q; },
      lt(k: string, v: any) { rows = rows.filter((r) => String(r[k]) < v); return q; },
      in(k: string, vs: any[]) { rows = rows.filter((r) => vs.includes(r[k])); return q; },
      order(k: string, o?: { ascending?: boolean }) { orders.push([k, o?.ascending !== false]); return q; },
      range(a: number, b: number) { range = [a, b]; return q; },
      then(resolve: (v: any) => void) {
        stats.reads++; stats.columns.push(columns);
        if (opts.leanFails && columns.includes("->")) return resolve({ data: null, error: { message: "this database does not answer that" } });
        for (const [k, asc] of [...orders].reverse()) rows.sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (asc ? 1 : -1));
        const [a, b] = range || [0, 999]; // Supabase hands back 1000 rows at most
        resolve({ data: rows.slice(a, b + 1).map((r) => project(r, columns)), error: null });
      },
    };
    return q;
  };
  return { from, stats };
}

let rowSerial = 0;
/** A saved match row, the way the chess server stores it. */
function row(p1: number, p2: number | null, at: number, state: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
  rowSerial++;
  return {
    id: "m" + String(rowSerial).padStart(5, "0"), game_type: "chess", status: "finished", player1_id: p1, player2_id: p2, updated_at: new Date(at).toISOString(),
    state: { winner: 1, result: "checkmate", computer: p2 === null, computerLevel: 2, moveHistory: Array(30).fill("e4"), history: Array(80).fill("a long position key"), ...state },
    ...over,
  };
}
const reader = (id: number, name: string, over: Record<string, unknown> = {}) => ({ id, display_name: name, username: name.toLowerCase(), role: "student", is_admin: false, ...over });

test("a saved match is read the same from the lean answer and from the whole game", () => {
  const whole = row(5, null, START + HOUR, { computerLevel: 4, moveHistory: Array(22).fill("e4") });
  const lean = { id: whole.id, player1_id: 5, player2_id: null, updated_at: whole.updated_at, winner: 1, result: "checkmate", computer: true, computerLevel: 4, moveHistory: Array(22).fill("e4") };
  const want = { id: whole.id, p1: 5, p2: null, winner: 1, result: "checkmate", computer: true, level: 4, plies: 22, finishedAt: START + HOUR };
  assert.deepEqual(toClashGame(whole), want);
  assert.deepEqual(toClashGame(lean), want);
  assert.equal(toClashGame(row(5, 6, START, { winner: 0, result: "stalemate" }))!.winner, 0, "a draw is a result");
  assert.equal(toClashGame(row(5, 6, START, { winner: null })), null, "a game with no result is left out (it is not a draw)");
  assert.equal(toClashGame({ ...lean, winner: null }), null);
  assert.equal(toClashGame(row(5, null, START, { computer: false })), null, "a live match needs two readers");
  assert.equal(toClashGame(row(5, 5, START)), null, "nobody plays themselves");
  assert.equal(toClashGame({ ...lean, updated_at: null }), null);
  assert.equal(toClashGame(row(5, 9, START, { computer: true }))!.p2, null, "the computer's seat is nobody's");
});

test("the chess page is sent the board, the reader's place and their last game", async () => {
  forgetClashBoard();
  const users = [reader(1, "Maya"), reader(2, "Eli"), reader(3, "Sofia"), reader(4, "Noah"), reader(8, "Sample Reader", { username: "sample7" }), reader(9, "Boss", { is_admin: true })];
  const games = [
    row(1, null, START + 1 * HOUR, { computerLevel: 4 }),             // Maya +5
    row(1, 2, START + 2 * HOUR),                                       // Maya beats Eli +5
    row(2, null, START + 3 * HOUR, { computerLevel: 3 }),             // Eli +4
    row(3, null, START + 4 * HOUR, { winner: 0, result: "stalemate" }), // Sofia draws +1
    row(3, null, START + 5 * HOUR, { winner: 2 }),                     // Sofia loses
    row(2, 3, START + 6 * HOUR, { result: "resignation", moveHistory: ["e4", "e5"] }), // too short
    row(4, null, START - HOUR, { computerLevel: 4 }),                  // before it began
    row(4, null, END + MIN, { computerLevel: 4 }),                     // after it ended
    row(8, null, START + HOUR, { computerLevel: 4 }),                  // a demo account
    row(1, 8, START + 7 * HOUR),                                       // against a demo account
    row(9, null, START + HOUR, { computerLevel: 4 }),                  // an admin
    row(1, null, START + 8 * HOUR, {}, { status: "active" }),          // still being played
    row(1, null, START + 8 * HOUR, {}, { game_type: "checkers" }),     // another game
  ];
  const db = fakeDb({ club_arise_matches: games, users });
  const now = START + 2 * DAY;

  const eli = await clashView(db, 2, now);
  assert.equal(eli.competition?.id, CLASH.id);
  assert.equal(eli.phase, "live");
  assert.equal(eli.now, now);
  assert.deepEqual(eli.standings.map((s) => [s.rank, s.displayName, s.points, s.wins, s.draws, s.losses, s.games]), [
    [1, "Maya", 10, 2, 0, 0, 2],
    [2, "Eli", 4, 1, 0, 1, 2],
    [3, "Sofia", 1, 0, 1, 1, 2],
  ]);
  assert.equal(eli.players, 3);
  assert.equal(eli.games, 5);
  assert.deepEqual(eli.me, { rank: 2, userId: 2, displayName: "Eli", points: 4, wins: 1, draws: 0, losses: 1, games: 2, ahead: { displayName: "Maya", points: 10 } });
  assert.deepEqual(eli.last, { matchId: games[5].id, points: 0, outcome: "win", counted: false, why: "short" }, "the newest game, even one that did not count");
  assert.ok(db.stats.columns[0].includes("state->winner") && !/(^|,)state(,|$)/.test(db.stats.columns[0]), "only the needed parts of each game are read");

  const maya = await clashView(db, 1, now);
  assert.equal(maya.me?.rank, 1);
  assert.equal(maya.me?.ahead, null);
  assert.equal(maya.last?.matchId, games[1].id, "a game against a demo account is not Maya's last counted game");

  const noah = await clashView(db, 4, now);
  assert.equal(noah.me, null, "games outside the dates put nobody on the board");
  assert.equal(noah.last, null);

  // the board is kept for a few seconds, so a busy lobby does not re-read every game
  const readsSoFar = db.stats.reads;
  await clashView(db, 3, now);
  assert.equal(db.stats.reads, readsSoFar);
  // a game that just finished shows up right away
  games.push(row(4, null, START + 9 * HOUR, { computerLevel: 1 }));
  forgetClashBoard();
  const after = await clashView(db, 4, now, true);
  assert.deepEqual([after.me?.rank, after.me?.points, after.me?.ahead?.displayName], [3, 2, "Eli"]);
  assert.deepEqual(after.last, { matchId: games.at(-1)!.id, points: 2, outcome: "win", counted: true, why: null });
  assert.ok(db.stats.reads > readsSoFar);
});

test("before it starts there is no board, after it ends the results stay, then it is gone", async () => {
  forgetClashBoard();
  const db = fakeDb({ club_arise_matches: [row(1, null, START + HOUR), row(2, null, START + 2 * HOUR, { computerLevel: 4 })], users: [reader(1, "Maya"), reader(2, "Eli")] });
  const soon = await clashView(db, 1, START - DAY);
  assert.deepEqual([soon.phase, soon.standings.length, soon.me, db.stats.reads], ["soon", 0, null, 0]);
  const ended = await clashView(db, 1, END + DAY);
  assert.equal(ended.phase, "ended");
  assert.deepEqual(ended.standings.map((s) => s.displayName), ["Eli", "Maya"]);
  assert.equal(ended.me?.rank, 2);
  const gone = await clashView(db, 1, END + CLASH_RESULTS_STAY_MS + DAY);
  assert.deepEqual([gone.competition, gone.phase, gone.standings.length], [null, null, 0]);
});

test("the final board is read after the end, not kept from before it", async () => {
  forgetClashBoard();
  const games = [row(1, null, END - 2 * HOUR, { computerLevel: 4 }), row(2, null, END - HOUR, { computerLevel: 3 })];
  const db = fakeDb({ club_arise_matches: games, users: [reader(1, "Maya"), reader(2, "Eli")] });
  assert.deepEqual((await clashView(db, 2, END - MIN)).standings.map((s) => s.displayName), ["Maya", "Eli"]);
  // Eli wins once more with seconds to go; nothing tells this server (another one saved the game)
  games.push(row(2, null, END - 20_000, { computerLevel: 3 }));
  const final = await clashView(db, 2, END + MIN);
  assert.equal(final.phase, "ended");
  assert.deepEqual(final.standings.map((s) => [s.displayName, s.points]), [["Eli", 8], ["Maya", 5]], "the last-second win is in the final results");
  // and the final board is then kept, since it cannot change
  const reads = db.stats.reads;
  assert.equal((await clashView(db, 1, END + 2 * MIN)).me?.rank, 2);
  assert.equal(db.stats.reads, reads);
});

// Keep this one last of the server tests: after a failed lean read the server reads whole games for a while.
test("every game is read, however many there are, and an older database still answers", async () => {
  forgetClashBoard();
  // 2,350 games: more than Supabase hands back at once
  const users = Array.from({ length: 70 }, (_, i) => reader(100 + i, "Reader " + i));
  const games = Array.from({ length: 2350 }, (_, i) => row(100 + (i % 70), null, START + i * 30_000, { computerLevel: 1 }));
  const db = fakeDb({ club_arise_matches: games, users });
  const view = await clashView(db, 100, START + 3 * DAY);
  assert.equal(view.games, 2350);
  assert.equal(view.players, 70);
  assert.equal(view.standings.length, CLASH_BOARD_SIZE);
  assert.equal(view.standings.reduce((n, s) => n + s.games, 0) > 1000, true);
  assert.equal(view.me?.games, 34);
  // reader 169 is below the top 50 but still learns their own place
  const low = await clashView(db, 169, START + 3 * DAY);
  assert.ok(low.me && low.me.rank > CLASH_BOARD_SIZE && !low.standings.some((s) => s.userId === 169));

  forgetClashBoard();
  const old = fakeDb({ club_arise_matches: games.slice(0, 40), users }, { leanFails: true });
  const warn = console.warn; console.warn = () => {};
  try {
    const fallback = await clashView(old, 100, START + 3 * DAY);
    assert.equal(fallback.games, 40);
    assert.ok(old.stats.columns.some((c) => /(^|,)state(,|$)/.test(c)), "it falls back to reading whole games");
  } finally { console.warn = warn; }
  forgetClashBoard();
});

// ─── How it is wired into the site ──────────────────────────────────────────

test("the competition is wired into the chess server, the chess page and the Games page", () => {
  const arena = read("server/chessArena.ts"), page = read("client/src/pages/UltimateChess.tsx"), games = read("client/src/pages/Games.tsx");
  const route = arena.slice(arena.indexOf('app.get("/api/chess/competition"'));
  assert.ok(route.startsWith('app.get("/api/chess/competition",authMiddleware'), "readers must be signed in");
  assert.ok(route.slice(0, 400).includes("if(!isStudent(req.user))return res.status(403)"), "students only, like the rest of chess");
  assert.ok(route.slice(0, 600).includes("clashView(db(),req.user.id"), "a reader can only ask about their own place");
  assert.ok(/if\(saved\)\{forgetClashBoard\(\);await awardPoints\(saved\);\}/.test(arena), "a finished game refreshes the board");
  for (const part of ["<ClashBanner", "<ClashPodium", "<ClashBoard", "<ClashFanfare", "<ClashEarnedLine"]) assert.ok(page.includes(part), `the chess page shows ${part}`);
  assert.ok(page.includes("useClash(token"));
  assert.ok(games.includes("<ClashStrip onOpen={() => enter(BY_ID.chess)} />"), "the Games page points to it");
  const css = read("client/src/pages/ultimate-chess.css");
  for (const cls of [".ucc-banner", ".ucc-clock", ".ucc-podium", ".ucc-fanfare", ".ucc-confetti", ".ucc-earned", ".ucc-rules"]) assert.ok(css.includes(cls), cls);
  assert.ok(read("client/src/pages/worlds.css").includes(".worlds-clash"));
});
