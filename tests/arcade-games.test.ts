import { test } from "node:test";
import assert from "node:assert/strict";
import { ENGINES, GAME_IDS } from "../shared/arcade/registry";
import { GAMES, GAME_INFO } from "../shared/arcade/catalog";
import { MoveError, setSearchBudgetScale, type Level, type Seat } from "../shared/arcade/core";
import { lineWinner } from "../shared/arcade/games/tictactoe";
import { legalPaths } from "../shared/arcade/games/checkers";
import { legalCells } from "../shared/arcade/games/reversi";
import { feedback } from "../shared/arcade/games/logic";
import { canPlay, rankOf } from "../shared/arcade/games/cards";

type Result = { outcome: 0 | 1 | 2 | null; moves: number; slowestMs: number };

/** Plays a whole game with the computer on both sides. */
function playOut(id: string, levels: [Level, Level], maxMoves = 2000): Result {
  const engine = ENGINES[id];
  let s = engine.init({ level: levels[1], vsComputer: false });
  let moves = 0, slowestMs = 0;
  while (engine.outcome(s) === null && moves < maxMoves) {
    const seats = engine.toAct(s);
    assert.ok(seats.length > 0, `${id}: nobody can act but the game is not over`);
    for (const seat of seats) {
      if (engine.outcome(s) !== null || !engine.toAct(s).includes(seat)) continue;
      const t0 = Date.now();
      const move = engine.ai(s, seat, levels[seat - 1]);
      slowestMs = Math.max(slowestMs, Date.now() - t0);
      const before = JSON.stringify(s);
      s = engine.play(s, seat, move);
      assert.equal(typeof JSON.stringify(s), "string");
      assert.notEqual(JSON.stringify(s), before, `${id}: a move must change the state`);
      moves++;
    }
  }
  return { outcome: engine.outcome(s), moves, slowestMs };
}

test("catalog and registry list the same 27 games", () => {
  assert.equal(GAME_IDS.length, 27);
  assert.deepEqual([...GAME_IDS].sort(), GAMES.map((g) => g.id).sort());
  for (const id of GAME_IDS) assert.ok(GAME_INFO[id].how.length >= 2, id + " needs how-to-play text");
});

test("every game finishes with legal computer moves at every level", () => {
  setSearchBudgetScale(0.25); // legality only; strength is tested below at full budget
  for (const id of GAME_IDS) {
    for (const levels of [[1, 1], [2, 3], [3, 2]] as [Level, Level][]) {
      const r = playOut(id, levels);
      assert.notEqual(r.outcome, null, `${id} ${levels} did not finish`);
      assert.ok(r.slowestMs < 1500, `${id} computer took ${r.slowestMs}ms`);
    }
  }
  setSearchBudgetScale(1);
});

test("states survive a JSON round trip (they are stored in the database)", () => {
  for (const id of GAME_IDS) {
    const engine = ENGINES[id];
    let s = engine.init({ level: 2, vsComputer: true });
    for (let i = 0; i < 6 && engine.outcome(s) === null; i++) {
      const seat = engine.toAct(s)[0];
      s = JSON.parse(JSON.stringify(engine.play(s, seat, engine.ai(s, seat, 2))));
    }
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  }
});

test("moves out of turn and junk input are rejected with friendly errors", () => {
  for (const id of GAME_IDS) {
    const engine = ENGINES[id];
    const s = engine.init({ level: 2, vsComputer: false });
    for (const junk of [null, {}, { cell: -1 }, { cell: "x" }, { col: 99 }, { type: "nope" }]) {
      const seat = engine.toAct(s)[0];
      try {
        engine.play(s, seat, junk as any);
      } catch (error) {
        assert.ok(error instanceof MoveError, `${id} threw ${String(error)} for ${JSON.stringify(junk)}`);
      }
    }
    const acting = engine.toAct(s);
    if (acting.length === 1) {
      const waiting = (acting[0] === 1 ? 2 : 1) as Seat;
      assert.throws(() => engine.play(s, waiting, engine.ai(s, acting[0], 1)), MoveError, id + " allowed a move out of turn");
    }
  }
});

test("tic-tac-toe: hard computer never loses", () => {
  for (let i = 0; i < 40; i++) {
    const a = playOut("tictactoe", [1, 3]);
    assert.notEqual(a.outcome, 1);
    const b = playOut("tictactoe", [3, 1]);
    assert.notEqual(b.outcome, 2);
  }
  assert.deepEqual(lineWinner([1, 1, 1, 0, 2, 2, 0, 0, 0])?.line, [0, 1, 2]);
});

test("fifteen: three numbers adding to 15 win, and hard never loses", () => {
  const e = ENGINES.fifteen;
  let s = e.init({ level: 3, vsComputer: false });
  s = e.play(s, 1, { number: 2 });
  s = e.play(s, 2, { number: 9 });
  assert.throws(() => e.play(s, 1, { number: 9 }), MoveError); // already taken
  s = e.play(s, 1, { number: 6 });
  s = e.play(s, 2, { number: 1 });
  assert.equal(e.outcome(s), null);
  s = e.play(s, 1, { number: 7 }); // 2 + 6 + 7 = 15
  assert.equal(e.outcome(s), 1);
  assert.deepEqual(s.triple, [2, 6, 7]);
  for (let i = 0; i < 30; i++) assert.notEqual(playOut("fifteen", [1, 3]).outcome, 1);
});

test("connect four: full columns are rejected and hard usually beats easy", () => {
  const e = ENGINES.four;
  let s = e.init({ level: 2, vsComputer: false });
  for (let i = 0; i < 6; i++) s = e.play(s, (i % 2 ? 2 : 1) as Seat, { col: 0 });
  assert.throws(() => e.play(s, 1, { col: 0 }), /full/);
  let hardWins = 0;
  for (let i = 0; i < 6; i++) if (playOut("four", [1, 3]).outcome === 2) hardWins++;
  assert.ok(hardWins >= 5, "hard won " + hardWins + "/6");
});

test("checkers: captures are compulsory, multi-jumps continue, crowning ends the move", () => {
  const board = Array(64).fill(0);
  const sq = (r: number, c: number) => r * 8 + c;
  board[sq(5, 2)] = 1; // seat 1 man
  board[sq(4, 3)] = 2; // enemy to jump
  board[sq(2, 5)] = 2; // second enemy for a double jump
  board[sq(6, 7)] = 1; // another piece that could just step
  const paths = legalPaths(board, 1);
  assert.deepEqual(paths, [[sq(5, 2), sq(3, 4), sq(1, 6)]]);
  const crown = Array(64).fill(0);
  crown[sq(2, 1)] = 1; crown[sq(1, 2)] = 2; crown[sq(1, 4)] = 2;
  // Jumping onto row 0 crowns the man and stops, even though another jump would follow for a king.
  assert.deepEqual(legalPaths(crown, 1), [[sq(2, 1), sq(0, 3)]]);
  const e = ENGINES.checkers;
  let s = e.init({ level: 2, vsComputer: false });
  assert.equal((e.view(s, 1) as any).moves.length, 7);
  assert.throws(() => e.play(s, 1, { path: [sq(5, 0), sq(3, 2)] }), MoveError);
  let hardWins = 0;
  for (let i = 0; i < 4; i++) if (playOut("checkers", [1, 3]).outcome === 2) hardWins++;
  assert.ok(hardWins >= 3, "hard won " + hardWins + "/4");
});

test("reversi: four opening moves, flips, and hard beats easy", () => {
  const e = ENGINES.reversi;
  const s = e.init({ level: 2, vsComputer: false });
  assert.deepEqual(legalCells(s.board, 1).sort((a, b) => a - b), [19, 26, 37, 44]);
  const next = e.play(s, 1, { cell: 19 });
  assert.deepEqual(next.flipped, [27]);
  assert.deepEqual(next.counts, [4, 1]);
  let hardWins = 0;
  for (let i = 0; i < 4; i++) if (playOut("reversi", [1, 3]).outcome === 2) hardWins++;
  assert.ok(hardWins >= 3, "hard won " + hardWins + "/4");
});

test("dots & boxes: finishing a box scores it and keeps the turn", () => {
  const e = ENGINES.dots;
  let s = e.init({ level: 2, vsComputer: false });
  // Box 0 sides: top 0, bottom 4, left 20, right 21.
  s = e.play(s, 1, { line: 0 });
  s = e.play(s, 2, { line: 4 });
  s = e.play(s, 1, { line: 20 });
  s = e.play(s, 2, { line: 21 });
  assert.equal(s.boxes[0], 2);
  assert.deepEqual(s.scores, [0, 1]);
  assert.equal(s.turn, 2);
});

test("mancala: landing in your store earns another turn; captures take the opposite pit", () => {
  const e = ENGINES.mancala;
  let s = e.init({ level: 2, vsComputer: false });
  s = e.play(s, 1, { pit: 2 }); // 4 seeds from pit 2 → pits 3,4,5 and store 6
  assert.equal(s.pits[6], 1);
  assert.equal(s.turn, 1);
  const cap = { ...e.init({ level: 2, vsComputer: false }) };
  cap.pits = [1, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 9, 3, 0];
  const after = e.play(cap, 1, { pit: 0 });
  assert.equal(after.pits[6], 10); // 1 own seed + 9 captured from pit 11
  assert.equal(after.pits[11], 0);
  let hardWins = 0;
  for (let i = 0; i < 4; i++) if (playOut("mancala", [1, 3]).outcome === 2) hardWins++;
  assert.ok(hardWins >= 3, "hard won " + hardWins + "/4");
});

test("gobble: only bigger pieces can cover, and uncovering an opponent line loses", () => {
  const e = ENGINES.gobble;
  let s = e.init({ level: 2, vsComputer: false });
  s = e.play(s, 1, { from: -1, to: 4, size: 2 });
  assert.throws(() => e.play(s, 2, { from: -1, to: 4, size: 2 }), /bigger/);
  s = e.play(s, 2, { from: -1, to: 4, size: 3 });
  assert.equal(s.stacks[4].length, 2);
  // Uncovering: seat 2 covers seat 1's line piece, then moves away revealing the line.
  const t = e.init({ level: 2, vsComputer: false });
  t.stacks = [[1], [1], [1, 6], [], [], [], [], [], []];
  t.reserve = [[0, 2, 2], [2, 2, 1]];
  t.turn = 2;
  const after = e.play(t, 2, { from: 2, to: 5 });
  assert.equal(after.winner, 1);
});

test("sea battle: fleets stay hidden, ready starts battle, sinking all ships wins", () => {
  const e = ENGINES.seabattle;
  let s = e.init({ level: 2, vsComputer: false });
  assert.deepEqual(e.toAct(s), [1, 2]);
  const view = e.view(s, 1) as any;
  assert.equal(view.revealedShips.length, 0);
  assert.equal(JSON.stringify(view).includes(JSON.stringify(s.fleets[1][0].cells)), false);
  s = e.play(s, 1, { type: "ready" });
  s = e.play(s, 2, { type: "ready" });
  assert.equal(s.phase, "battle");
  const targets = s.fleets[1].flatMap((sh: any) => sh.cells);
  const misses = Array.from({ length: 64 }, (_, i) => i).filter((i) => !s.fleets[0].some((sh: any) => sh.cells.includes(i)));
  let m = 0;
  for (const cell of targets) {
    s = e.play(s, 1, { type: "fire", cell });
    if (s.winner) break;
    s = e.play(s, 2, { type: "fire", cell: misses[m++] });
  }
  assert.equal(s.winner, 1);
  assert.ok((e.view(s, 2) as any).revealedShips.length === 4);
});

test("crazy eights: must play a match before drawing, hands stay hidden", () => {
  const e = ENGINES.eights;
  const s = e.init({ level: 2, vsComputer: false });
  const view = e.view(s, 1) as any;
  assert.equal(view.hand.length, 7);
  assert.equal(view.theirCount, 7);
  assert.equal(view.theirHand, undefined);
  const playable = s.hands[0].filter((c: number) => canPlay(s, c));
  if (playable.length) assert.throws(() => e.play(s, 1, { type: "draw" }), /can play/);
  const eightIn = { ...s, hands: [[7, ...s.hands[0].slice(1)], s.hands[1]] as [number[], number[]] };
  assert.equal(rankOf(7), 8);
  const after = e.play(eightIn, 1, { type: "play", card: 7, suit: 2 });
  assert.equal(after.suit, 2);
});

test("go fish: asking takes every matching card and books are laid down", () => {
  const e = ENGINES.gofish;
  const s = e.init({ level: 2, vsComputer: false });
  s.hands = [[0, 13, 26], [39, 1, 2]]; // seat 1 has three aces, seat 2 has the last ace
  s.books = [[], []];
  s.turn = 1;
  const after = e.play(s, 1, { rank: 1 });
  assert.deepEqual(after.books[0], [1]);
  assert.equal(after.turn, 1);
  assert.equal((e.view(after, 2) as any).hand.includes(39), false);
});

test("memory: a match keeps the turn, a miss passes it, faces stay hidden", () => {
  const e = ENGINES.memory;
  let s = e.init({ level: 2, vsComputer: false });
  const a = 0, b = s.cards.findIndex((f: string, i: number) => i !== a && f === s.cards[a]);
  const hidden = (e.view(s, 2) as any).cards;
  assert.ok(hidden.every((c: string | null) => c === null));
  s = e.play(s, 1, { card: a });
  s = e.play(s, 1, { card: b });
  assert.equal(s.turn, 1);
  assert.equal(s.scores[0], 1);
  const c = s.cards.findIndex((_: string, i: number) => !s.matched[i]);
  const d = s.cards.findIndex((f: string, i: number) => !s.matched[i] && i !== c && f !== s.cards[c]);
  s = e.play(s, 1, { card: c });
  s = e.play(s, 1, { card: d });
  assert.equal(s.turn, 2);
  assert.deepEqual(s.peek, [c, d]);
});

test("rock paper scissors: picks stay secret until both are in", () => {
  const e = ENGINES.rps;
  let s = e.init({ level: 2, vsComputer: false });
  s = e.play(s, 1, { hand: "rock" });
  assert.equal((e.view(s, 2) as any).theyPicked, true);
  assert.equal(JSON.stringify(e.view(s, 2)).includes("rock"), false);
  assert.throws(() => e.play(s, 1, { hand: "paper" }), MoveError);
  s = e.play(s, 2, { hand: "scissors" });
  assert.deepEqual(s.wins, [1, 0]);
});

test("last stone: taking the last stone wins and hard plays perfectly", () => {
  const e = ENGINES.nim;
  const s = { piles: [0, 2], turn: 1 as Seat, winner: null, last: null };
  assert.equal(e.play(s, 1, { pile: 1, take: 2 }).winner, 1);
  for (let i = 0; i < 25; i++) {
    const t = { piles: [3, 4, 5], turn: 2 as Seat, winner: null, last: null }; // xor ≠ 0: winning for seat 2
    let st: any = t;
    while (st.winner === null) {
      const seat = st.turn as Seat;
      st = e.play(st, seat, e.ai(st, seat, seat === 2 ? 3 : 1));
    }
    assert.equal(st.winner, 2);
  }
});

test("code breaker: feedback is correct and rival codes stay hidden", () => {
  assert.deepEqual(feedback([0, 1, 2, 3], [0, 2, 1, 5]), { exact: 1, near: 2 });
  assert.deepEqual(feedback([0, 1, 2, 3], [0, 1, 2, 3]), { exact: 4, near: 0 });
  const e = ENGINES.codebreaker;
  let s = e.init({ level: 3, vsComputer: false });
  s = e.play(s, 1, { code: [0, 1, 2, 3] });
  const v = e.view(s, 2) as any;
  assert.equal(v.theirResults.length, 0, "rival's guess hidden until the round ends");
  assert.equal(v.mySecret, null);
  let solvedInTime = 0;
  for (let i = 0; i < 10; i++) {
    let t = e.init({ level: 3, vsComputer: false });
    while (t.winner === null) for (const seat of e.toAct(t)) t = e.play(t, seat, e.ai(t, seat, 3));
    if (t.guesses[0].some((g: any) => g.exact === 4) || t.guesses[1].some((g: any) => g.exact === 4)) solvedInTime++;
  }
  assert.ok(solvedInTime >= 9);
});

test("quiz duels: answers are simultaneous and the correct answer stays hidden", () => {
  const e = ENGINES.math_duel;
  let s = e.init({ level: 2, vsComputer: false });
  const v = e.view(s, 1) as any;
  assert.equal(v.question.correct, undefined);
  assert.deepEqual(e.toAct(s), [1, 2]);
  const q = s.questions[0];
  s = e.play(s, 1, { choice: q.correct });
  assert.deepEqual(e.toAct(s), [2]);
  assert.equal((e.view(s, 2) as any).theyAnswered, true);
  assert.equal(JSON.stringify(e.view(s, 2)).includes('"correct"'), false);
  s = e.play(s, 2, { choice: q.options.find((o: string) => o !== q.correct) });
  assert.deepEqual(s.scores, [10, 0]);
  assert.equal(s.round, 1);
});

test("word rescue: a right letter keeps the turn and the eighth miss loses", () => {
  const e = ENGINES.word_rescue;
  let s = { word: "BOOK", hint: "", guessed: [] as string[], misses: 7, turn: 1 as Seat, winner: null, last: null };
  s = e.play(s, 1, { letter: "O" });
  assert.equal(s.turn, 1);
  s = e.play(s, 1, { letter: "Z" });
  assert.equal(s.winner, 2);
  assert.equal((e.view({ ...s, winner: null } as any, 2) as any).word, null);
});

test("harder computers beat easy ones in the strategy games", () => {
  for (const id of ["gomoku", "ultimate", "gobble", "dots", "seabattle"]) {
    let hardWins = 0, games = 6;
    for (let i = 0; i < games; i++) {
      const a = playOut(id, [1, 3]);
      if (a.outcome === 2) hardWins++;
    }
    assert.ok(hardWins >= 4, `${id}: hard won ${hardWins}/${games}`);
  }
});
