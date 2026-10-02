import { test } from "node:test";
import assert from "node:assert/strict";
import { Position, pickChessMove } from "../server/chessAI";
import {
  applyChessMove, computerChessTurn, generateLegalMoves, initialChessState, replayChessMoves, type ChessState,
} from "../server/chessEngine";
import { setSearchBudgetScale } from "../shared/arcade/core";

/** Builds a rules-engine state from a FEN string (tests only). */
function stateFromFen(fen: string, extra: Partial<ChessState> = {}): ChessState {
  const [rows, side, castle, ep, half] = fen.split(" ");
  const base = initialChessState({ computer: true, computerLevel: 4 });
  const board = rows.split("/").map((row) => {
    const out: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) out.push(null);
      else out.push((ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase());
    }
    return out;
  });
  const state: ChessState = {
    ...base, board, turn: side === "w" ? 1 : 2,
    castling: { wK: castle.includes("K"), wQ: castle.includes("Q"), bK: castle.includes("k"), bQ: castle.includes("q") },
    enPassant: ep === "-" ? null : ep, halfmove: Number(half) || 0, history: [], uci: [], ...extra,
  };
  state.legalMoves = generateLegalMoves(state, state.turn === 1 ? "w" : "b");
  return state;
}

const PERFT: [string, number[]][] = [
  ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [20, 400, 8902, 197281]],
  ["r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
  ["8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
  ["r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
  ["rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379]],
];

test("the computer's move generator matches known perft counts", () => {
  for (const [fen, counts] of PERFT) {
    const pos = Position.fromFen(fen);
    counts.forEach((want, i) => assert.equal(pos.perft(i + 1), want, `${fen} depth ${i + 1}`));
  }
});

/** Perft through the rules engine the server uses to accept moves. */
function rulesPerft(state: ChessState, depth: number): number {
  const moves = generateLegalMoves(state, state.turn === 1 ? "w" : "b");
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += rulesPerft(applyChessMove(state, m, state.turn, state.lastTickAt), depth - 1);
  return n;
}

test("the rules engine matches known perft counts", () => {
  const shallow: [string, number][] = [[PERFT[0][0], 3], [PERFT[1][0], 2], [PERFT[2][0], 3], [PERFT[3][0], 2], [PERFT[4][0], 2]];
  for (const [fen, depth] of shallow) {
    const want = PERFT.find((p) => p[0] === fen)![1][depth - 1];
    assert.equal(rulesPerft(stateFromFen(fen), depth), want, fen);
  }
});

test("move notation tells pieces apart and marks mate", () => {
  // Two knights can reach d2: the file is added.
  let s = stateFromFen("4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1");
  s = applyChessMove(s, { from: "b1", to: "d2" }, 1, s.lastTickAt);
  assert.equal(s.moveHistory.at(-1), "Nbd2");
  // Two rooks on the same file: the rank is added.
  s = stateFromFen("4k3/R7/8/8/8/8/R7/4K3 w - - 0 1");
  s = applyChessMove(s, { from: "a7", to: "a5" }, 1, s.lastTickAt);
  assert.equal(s.moveHistory.at(-1), "R7a5");
  // Pawn capture, promotion with check, and checkmate.
  s = stateFromFen("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1");
  s = applyChessMove(s, { from: "e4", to: "d5" }, 1, s.lastTickAt);
  assert.equal(s.moveHistory.at(-1), "exd5");
  s = stateFromFen("k7/4P3/8/8/8/8/8/4K3 w - - 0 1");
  s = applyChessMove(s, { from: "e7", to: "e8", promotion: "q" }, 1, s.lastTickAt);
  assert.equal(s.moveHistory.at(-1), "e8=Q+");
  s = stateFromFen("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1");
  s = applyChessMove(s, { from: "a1", to: "a8" }, 1, s.lastTickAt);
  assert.equal(s.moveHistory.at(-1), "Ra8#");
  assert.equal(s.result, "checkmate");
  assert.equal(s.winner, 1);
});

test("the computer finds mate in one and grabs a free queen", () => {
  setSearchBudgetScale(1);
  for (const level of [2, 3, 4]) {
    const mate = pickChessMove(stateFromFen("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"), level)!;
    assert.equal(mate.from + mate.to, "a1a8", `level ${level} back-rank mate`);
  }
  const free = pickChessMove(stateFromFen("4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1"), 3)!;
  assert.equal(free.from + free.to, "d2d5");
});

test("the computer stays inside its time budget", () => {
  setSearchBudgetScale(1);
  const mid = stateFromFen("r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 8");
  for (const level of [1, 2, 3, 4]) {
    const t0 = Date.now();
    pickChessMove(mid, level);
    assert.ok(Date.now() - t0 < 700, `level ${level} took ${Date.now() - t0}ms`);
  }
});

test("stronger levels beat weaker ones and every move is legal", () => {
  setSearchBudgetScale(0.3);
  for (const [white, black] of [[4, 1], [1, 3]]) {
    let s = initialChessState();
    for (let ply = 0; s.winner === null && ply < 300; ply++) {
      const pick = pickChessMove(s, s.turn === 1 ? white : black)!;
      s = applyChessMove(s, pick, s.turn, s.lastTickAt);
    }
    const stronger = white > black ? 1 : 2;
    assert.equal(s.winner, stronger, `L${white} vs L${black}: ${s.result} after ${s.moveHistory.join(" ")}`);
  }
  setSearchBudgetScale(1);
});

test("the computer replies as Black and taking moves back rebuilds the game", () => {
  setSearchBudgetScale(0.3);
  let s = initialChessState({ computer: true, computerLevel: 2 });
  s = applyChessMove(s, { from: "e2", to: "e4" }, 1);
  s = computerChessTurn(s);
  assert.equal(s.turn, 1);
  assert.equal(s.uci!.length, 2);
  s = applyChessMove(s, { from: "g1", to: "f3" }, 1);
  s = computerChessTurn(s);
  const before = JSON.stringify(s.board);
  assert.equal(s.uci!.length, 4);
  const undone = replayChessMoves({ ...s, undosUsed: 1 }, s.uci!.slice(0, -2));
  assert.equal(undone.uci!.length, 2);
  assert.equal(undone.turn, 1);
  assert.equal(undone.board[7][6], "wN", "the knight is back on g1");
  assert.equal(undone.moveHistory.length, 2);
  assert.equal(undone.undosUsed, 1);
  assert.notEqual(JSON.stringify(undone.board), before);
  setSearchBudgetScale(1);
});

test("the computer sees repeated positions from the game so far", () => {
  let s = initialChessState();
  for (const [from, to] of [["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"]]) s = applyChessMove(s, { from, to }, s.turn, s.lastTickAt);
  // The starting position is back on the board with White to move.
  assert.equal(Position.fromState(s).repeated(), true);
  const fresh = initialChessState();
  assert.equal(Position.fromState(fresh).repeated(), false);
});
