// The Ultimate Chess computer: a small, fast search engine (0x88 board with make/unmake).
// The rules engine in chessEngine.ts stays authoritative; this file only picks moves.
import { scaledBudget } from "../shared/arcade/core";
import type { ChessState } from "./chessEngine";

const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
const WHITE = 0, BLACK = 8;
const FILES = "abcdefgh";
const TYPE_OF: Record<string, number> = { P: PAWN, N: KNIGHT, B: BISHOP, R: ROOK, Q: QUEEN, K: KING };
const LETTER = ["", "p", "n", "b", "r", "q", "k"];

const KNIGHT_STEPS = [-33, -31, -18, -14, 14, 18, 31, 33];
const BISHOP_STEPS = [-17, -15, 15, 17];
const ROOK_STEPS = [-16, -1, 1, 16];
const KING_STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];

// Move = from | to << 7 | promotion << 14 | flags << 17
const F_CAPTURE = 1, F_DOUBLE = 2, F_EP = 4, F_CASTLE = 8;
const mFrom = (m: number) => m & 127;
const mTo = (m: number) => (m >> 7) & 127;
const mPromo = (m: number) => (m >> 14) & 7;
const mFlags = (m: number) => m >> 17;
const encode = (from: number, to: number, promo = 0, flags = 0) => from | (to << 7) | (promo << 14) | (flags << 17);

// Squares: index = row * 16 + col, row 0 is rank 8 (the top of the board for White).
const sqName = (s: number) => FILES[s & 7] + (8 - (s >> 4));
const sqIndex = (name: string) => (8 - Number(name[1])) * 16 + FILES.indexOf(name[0]);
// Castling rights bits: 1 white king side, 2 white queen side, 4 black king side, 8 black queen side.
const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[sqIndex("e1")] = 15 & ~3; CASTLE_MASK[sqIndex("a1")] = 15 & ~2; CASTLE_MASK[sqIndex("h1")] = 15 & ~1;
CASTLE_MASK[sqIndex("e8")] = 15 & ~12; CASTLE_MASK[sqIndex("a8")] = 15 & ~8; CASTLE_MASK[sqIndex("h8")] = 15 & ~4;

// ─── Zobrist keys (two 32-bit halves: one indexes the table, one checks it) ──
let seed = 0x2545f491;
const rnd32 = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
const Z_PIECE_A = new Uint32Array(16 * 128), Z_PIECE_B = new Uint32Array(16 * 128);
for (let i = 0; i < Z_PIECE_A.length; i++) { Z_PIECE_A[i] = rnd32(); Z_PIECE_B[i] = rnd32(); }
const Z_CASTLE_A = new Uint32Array(16), Z_CASTLE_B = new Uint32Array(16);
for (let i = 0; i < 16; i++) { Z_CASTLE_A[i] = rnd32(); Z_CASTLE_B[i] = rnd32(); }
const Z_EP_A = new Uint32Array(128), Z_EP_B = new Uint32Array(128);
for (let i = 0; i < 128; i++) { Z_EP_A[i] = rnd32(); Z_EP_B[i] = rnd32(); }
const Z_SIDE_A = rnd32(), Z_SIDE_B = rnd32();

// ─── Evaluation tables (White's view; row 0 is rank 8) ──────────────────────
const MG_VALUE = [0, 100, 320, 335, 500, 950, 0];
const EG_VALUE = [0, 125, 300, 320, 540, 960, 0];
const PHASE_WEIGHT = [0, 0, 1, 1, 2, 4, 0];
const PST_MG: number[][] = [
  [],
  [0, 0, 0, 0, 0, 0, 0, 0, 60, 60, 60, 60, 60, 60, 60, 60, 20, 20, 25, 35, 35, 25, 20, 20, 8, 8, 12, 25, 25, 12, 8, 8,
    2, 2, 6, 20, 20, 6, 2, 2, 4, -2, -6, 4, 4, -6, -2, 4, 4, 8, 8, -18, -18, 8, 8, 4, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 12, 16, 16, 12, 5, -30, -30, 5, 16, 22, 22, 16, 5, -30,
    -30, 0, 16, 22, 22, 16, 0, -30, -30, 5, 12, 16, 16, 12, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -35, -30, -30, -30, -30, -35, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 6, 0, 0, 0, 0, 6, -10, -20, -10, -12, -10, -10, -12, -10, -20],
  [0, 0, 0, 0, 0, 0, 0, 0, 8, 12, 12, 12, 12, 12, 12, 8, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 3, 6, 6, 3, 0, 0],
  [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 15, 15, -5, -10, -10, -5, 15, 15, 20, 30, 10, 0, 0, 10, 30, 20],
];
const PST_EG: number[][] = [
  [],
  [0, 0, 0, 0, 0, 0, 0, 0, 90, 90, 90, 90, 90, 90, 90, 90, 55, 55, 55, 55, 55, 55, 55, 55, 35, 35, 35, 35, 35, 35, 35, 35,
    20, 20, 20, 20, 20, 20, 20, 20, 10, 10, 10, 10, 10, 10, 10, 10, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  PST_MG[2],
  PST_MG[3],
  [0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  PST_MG[5],
  [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
];
const PASSED_BONUS = [0, 95, 65, 42, 26, 16, 10, 0]; // by row for White (row 1 = about to promote)

const MATE = 100_000;
const INF = 1_000_000;

type Undo = { move: number; captured: number; castle: number; ep: number; half: number; ha: number; hb: number };
type TTEntry = { hb: number; depth: number; score: number; flag: 0 | 1 | 2; move: number };
const TT_EXACT = 0, TT_LOWER = 1, TT_UPPER = 2;

class Stop extends Error {}

export class Position {
  b = new Int8Array(128);
  side = WHITE;
  castle = 0;
  ep = -1;
  half = 0;
  kings = [0, 0];
  ha = 0;
  hb = 0;
  /** Hash keys of earlier positions (game history + search path), for repetition checks. */
  past: number[] = [];
  private undo: Undo[] = [];

  static fromFen(fen: string): Position {
    const p = new Position();
    const [rows, side, castle, ep, half] = fen.trim().split(/\s+/);
    let r = 0, c = 0;
    for (const ch of rows) {
      if (ch === "/") { r++; c = 0; continue; }
      if (/\d/.test(ch)) { c += Number(ch); continue; }
      const type = TYPE_OF[ch.toUpperCase()];
      p.b[r * 16 + c] = type | (ch === ch.toUpperCase() ? WHITE : BLACK);
      c++;
    }
    p.side = side === "b" ? BLACK : WHITE;
    p.castle = (castle.includes("K") ? 1 : 0) | (castle.includes("Q") ? 2 : 0) | (castle.includes("k") ? 4 : 0) | (castle.includes("q") ? 8 : 0);
    p.ep = ep && ep !== "-" ? sqIndex(ep) : -1;
    p.half = Number(half) || 0;
    p.init();
    return p;
  }

  static fromState(state: ChessState): Position {
    const p = new Position();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const piece = state.board[r]?.[c];
      if (piece) p.b[r * 16 + c] = TYPE_OF[piece[1]] | (piece[0] === "w" ? WHITE : BLACK);
    }
    p.side = state.turn === 1 ? WHITE : BLACK;
    p.castle = (state.castling?.wK ? 1 : 0) | (state.castling?.wQ ? 2 : 0) | (state.castling?.bK ? 4 : 0) | (state.castling?.bQ ? 8 : 0);
    p.ep = state.enPassant ? sqIndex(state.enPassant) : -1;
    p.half = state.halfmove || 0;
    p.init();
    // Earlier positions from the game, so the computer knows about repetition draws.
    const keys = state.history || [];
    for (const key of keys.slice(-Math.min(keys.length, p.half + 2), -1)) {
      const old = Position.fromKey(key);
      if (old) p.past.push(old.hb);
    }
    return p;
  }

  /** Parses a position key from chessEngine.ts ("wR--…/…:turn:castling:ep"). */
  private static fromKey(key: string): Position | null {
    const [rows, turn, castle, ep] = key.split(":");
    const ranks = rows?.split("/");
    if (!ranks || ranks.length !== 8) return null;
    const p = new Position();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const code = ranks[r].slice(c * 2, c * 2 + 2);
      if (code && code !== "--") p.b[r * 16 + c] = TYPE_OF[code[1]] | (code[0] === "w" ? WHITE : BLACK);
    }
    p.side = turn === "2" ? BLACK : WHITE;
    p.castle = (castle?.[0] === "1" ? 1 : 0) | (castle?.[1] === "1" ? 2 : 0) | (castle?.[2] === "1" ? 4 : 0) | (castle?.[3] === "1" ? 8 : 0);
    p.ep = ep && ep !== "-" ? sqIndex(ep) : -1;
    p.init();
    return p;
  }

  private init() {
    this.ha = 0; this.hb = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      const pc = this.b[s];
      if (!pc) continue;
      if ((pc & 7) === KING) this.kings[pc >> 3] = s;
      this.ha ^= Z_PIECE_A[pc * 128 + s]; this.hb ^= Z_PIECE_B[pc * 128 + s];
    }
    this.ha ^= Z_CASTLE_A[this.castle]; this.hb ^= Z_CASTLE_B[this.castle];
    if (this.ep >= 0) { this.ha ^= Z_EP_A[this.ep]; this.hb ^= Z_EP_B[this.ep]; }
    if (this.side === BLACK) { this.ha ^= Z_SIDE_A; this.hb ^= Z_SIDE_B; }
  }

  attacked(s: number, by: number): boolean {
    const b = this.b;
    // Pawns: a white pawn attacks up the board (toward row 0).
    if (by === WHITE) {
      const a = s + 15, c = s + 17;
      if (!(a & 0x88) && b[a] === (PAWN | WHITE)) return true;
      if (!(c & 0x88) && b[c] === (PAWN | WHITE)) return true;
    } else {
      const a = s - 15, c = s - 17;
      if (!(a & 0x88) && b[a] === (PAWN | BLACK)) return true;
      if (!(c & 0x88) && b[c] === (PAWN | BLACK)) return true;
    }
    for (const d of KNIGHT_STEPS) { const t = s + d; if (!(t & 0x88) && b[t] === (KNIGHT | by)) return true; }
    for (const d of KING_STEPS) { const t = s + d; if (!(t & 0x88) && b[t] === (KING | by)) return true; }
    for (const d of BISHOP_STEPS) {
      for (let t = s + d; !(t & 0x88); t += d) {
        const pc = b[t];
        if (!pc) continue;
        if ((pc & 8) === by && ((pc & 7) === BISHOP || (pc & 7) === QUEEN)) return true;
        break;
      }
    }
    for (const d of ROOK_STEPS) {
      for (let t = s + d; !(t & 0x88); t += d) {
        const pc = b[t];
        if (!pc) continue;
        if ((pc & 8) === by && ((pc & 7) === ROOK || (pc & 7) === QUEEN)) return true;
        break;
      }
    }
    return false;
  }

  inCheck(side = this.side): boolean { return this.attacked(this.kings[side >> 3], side ^ 8); }

  /** Pseudo-legal moves (the king may be left in check; make() callers test that). */
  moves(capturesOnly = false): number[] {
    const out: number[] = [];
    const b = this.b, us = this.side, them = us ^ 8;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const pc = b[s];
      if (!pc || (pc & 8) !== us) continue;
      const type = pc & 7;
      if (type === PAWN) {
        const dir = us === WHITE ? -16 : 16;
        const startRow = us === WHITE ? 6 : 1, lastRow = us === WHITE ? 0 : 7;
        const one = s + dir;
        if (!(one & 0x88) && !b[one]) {
          if ((one >> 4) === lastRow) { for (let pr = QUEEN; pr >= KNIGHT; pr--) out.push(encode(s, one, pr)); }
          else if (!capturesOnly) {
            out.push(encode(s, one));
            const two = one + dir;
            if ((s >> 4) === startRow && !b[two]) out.push(encode(s, two, 0, F_DOUBLE));
          }
        }
        for (const side of [-1, 1]) {
          const t = one + side;
          if (t & 0x88) continue;
          if (b[t] && (b[t] & 8) === them) {
            if ((t >> 4) === lastRow) { for (let pr = QUEEN; pr >= KNIGHT; pr--) out.push(encode(s, t, pr, F_CAPTURE)); }
            else out.push(encode(s, t, 0, F_CAPTURE));
          } else if (t === this.ep) out.push(encode(s, t, 0, F_CAPTURE | F_EP));
        }
      } else if (type === KNIGHT || type === KING) {
        for (const d of type === KNIGHT ? KNIGHT_STEPS : KING_STEPS) {
          const t = s + d;
          if (t & 0x88) continue;
          if (!b[t]) { if (!capturesOnly) out.push(encode(s, t)); }
          else if ((b[t] & 8) === them) out.push(encode(s, t, 0, F_CAPTURE));
        }
        if (type === KING && !capturesOnly) this.castles(s, out);
      } else {
        const steps = type === BISHOP ? BISHOP_STEPS : type === ROOK ? ROOK_STEPS : KING_STEPS;
        for (const d of steps) {
          for (let t = s + d; !(t & 0x88); t += d) {
            if (!b[t]) { if (!capturesOnly) out.push(encode(s, t)); continue; }
            if ((b[t] & 8) === them) out.push(encode(s, t, 0, F_CAPTURE));
            break;
          }
        }
      }
    }
    return out;
  }

  private castles(s: number, out: number[]) {
    const b = this.b, us = this.side, them = us ^ 8;
    const row = us === WHITE ? 7 : 0, home = row * 16 + 4;
    if (s !== home) return;
    const kingSide = us === WHITE ? 1 : 4, queenSide = us === WHITE ? 2 : 8;
    if ((this.castle & (kingSide | queenSide)) === 0 || this.attacked(home, them)) return;
    if (this.castle & kingSide && !b[home + 1] && !b[home + 2] && b[home + 3] === (ROOK | us)
      && !this.attacked(home + 1, them) && !this.attacked(home + 2, them)) out.push(encode(home, home + 2, 0, F_CASTLE));
    if (this.castle & queenSide && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === (ROOK | us)
      && !this.attacked(home - 1, them) && !this.attacked(home - 2, them)) out.push(encode(home, home - 2, 0, F_CASTLE));
  }

  private put(s: number, pc: number) { this.b[s] = pc; this.ha ^= Z_PIECE_A[pc * 128 + s]; this.hb ^= Z_PIECE_B[pc * 128 + s]; }
  private take(s: number) { const pc = this.b[s]; this.b[s] = 0; this.ha ^= Z_PIECE_A[pc * 128 + s]; this.hb ^= Z_PIECE_B[pc * 128 + s]; return pc; }

  /** Plays a pseudo-legal move. Returns false (and takes it back) if it leaves the mover in check. */
  make(m: number): boolean {
    const from = mFrom(m), to = mTo(m), flags = mFlags(m), promo = mPromo(m);
    const us = this.side;
    this.past.push(this.hb);
    let captured = 0;
    const u: Undo = { move: m, captured: 0, castle: this.castle, ep: this.ep, half: this.half, ha: this.ha, hb: this.hb };
    if (this.ep >= 0) { this.ha ^= Z_EP_A[this.ep]; this.hb ^= Z_EP_B[this.ep]; }
    this.ha ^= Z_CASTLE_A[this.castle]; this.hb ^= Z_CASTLE_B[this.castle];
    const pc = this.take(from);
    if (flags & F_EP) captured = this.take(to + (us === WHITE ? 16 : -16));
    else if (this.b[to]) captured = this.take(to);
    this.put(to, promo ? promo | us : pc);
    if (flags & F_CASTLE) {
      if (to > from) this.put(from + 1, this.take(from + 3));
      else this.put(from - 1, this.take(from - 4));
    }
    if ((pc & 7) === KING) this.kings[us >> 3] = to;
    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.ep = flags & F_DOUBLE ? (from + to) >> 1 : -1;
    this.half = (pc & 7) === PAWN || captured ? 0 : this.half + 1;
    this.ha ^= Z_CASTLE_A[this.castle]; this.hb ^= Z_CASTLE_B[this.castle];
    if (this.ep >= 0) { this.ha ^= Z_EP_A[this.ep]; this.hb ^= Z_EP_B[this.ep]; }
    this.side ^= 8; this.ha ^= Z_SIDE_A; this.hb ^= Z_SIDE_B;
    u.captured = captured;
    this.undo.push(u);
    if (this.inCheck(us)) { this.unmake(); return false; }
    return true;
  }

  unmake() {
    const u = this.undo.pop()!;
    this.past.pop();
    const m = u.move, from = mFrom(m), to = mTo(m), flags = mFlags(m);
    this.side ^= 8;
    const us = this.side;
    const moved = this.b[to];
    this.b[to] = 0;
    this.b[from] = mPromo(m) ? PAWN | us : moved;
    if (flags & F_EP) this.b[to + (us === WHITE ? 16 : -16)] = u.captured;
    else if (u.captured) this.b[to] = u.captured;
    if (flags & F_CASTLE) {
      if (to > from) { this.b[from + 3] = this.b[from + 1]; this.b[from + 1] = 0; }
      else { this.b[from - 4] = this.b[from - 1]; this.b[from - 1] = 0; }
    }
    if ((this.b[from] & 7) === KING) this.kings[us >> 3] = from;
    this.castle = u.castle; this.ep = u.ep; this.half = u.half; this.ha = u.ha; this.hb = u.hb;
  }

  makeNull() {
    this.past.push(this.hb);
    this.undo.push({ move: -1, captured: 0, castle: this.castle, ep: this.ep, half: this.half, ha: this.ha, hb: this.hb });
    if (this.ep >= 0) { this.ha ^= Z_EP_A[this.ep]; this.hb ^= Z_EP_B[this.ep]; }
    this.ep = -1;
    this.side ^= 8; this.ha ^= Z_SIDE_A; this.hb ^= Z_SIDE_B;
  }

  unmakeNull() {
    const u = this.undo.pop()!;
    this.past.pop();
    this.side ^= 8;
    this.ep = u.ep; this.ha = u.ha; this.hb = u.hb;
  }

  legalMoves(): number[] {
    return this.moves().filter((m) => { if (!this.make(m)) return false; this.unmake(); return true; });
  }

  /** Repetition of an earlier position (within the reversible-move window). */
  repeated(): boolean {
    const past = this.past;
    for (let i = past.length - 2, n = 0; i >= 0 && n < this.half; i -= 2, n += 2) if (past[i] === this.hb) return true;
    return false;
  }

  /** Score from the side to move's view, in centipawns. */
  evaluate(): number {
    const b = this.b;
    let mg = 0, eg = 0, phase = 0;
    const bishops = [0, 0];
    // Pawn files: for White, the lowest row (most advanced); for Black, the highest row (most advanced).
    const whitePawnRows: number[][] = [[], [], [], [], [], [], [], []];
    const blackPawnRows: number[][] = [[], [], [], [], [], [], [], []];
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const pc = b[s];
      if (pc === (PAWN | WHITE)) whitePawnRows[s & 7].push(s >> 4);
      else if (pc === (PAWN | BLACK)) blackPawnRows[s & 7].push(s >> 4);
    }
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const pc = b[s];
      if (!pc) continue;
      const type = pc & 7, white = (pc & 8) === WHITE;
      const row = s >> 4, col = s & 7;
      const idx = white ? row * 8 + col : (7 - row) * 8 + col;
      let pm = MG_VALUE[type] + PST_MG[type][idx];
      let pe = EG_VALUE[type] + PST_EG[type][idx];
      phase += PHASE_WEIGHT[type];
      if (type === BISHOP) bishops[white ? 0 : 1]++;
      if (type === PAWN) {
        const own = white ? whitePawnRows : blackPawnRows, enemy = white ? blackPawnRows : whitePawnRows;
        if (own[col].length > 1) { pm -= 8; pe -= 14; }
        let passed = true;
        for (let f = Math.max(0, col - 1); f <= Math.min(7, col + 1) && passed; f++) {
          for (const r of enemy[f]) if (white ? r < row : r > row) { passed = false; break; }
        }
        if (passed) { const bonus = PASSED_BONUS[white ? row : 7 - row]; pm += bonus >> 1; pe += bonus; }
      } else if (type === ROOK) {
        const own = white ? whitePawnRows : blackPawnRows, enemy = white ? blackPawnRows : whitePawnRows;
        if (!own[col].length) { pm += enemy[col].length ? 8 : 16; pe += enemy[col].length ? 4 : 8; }
      }
      if (white) { mg += pm; eg += pe; } else { mg -= pm; eg -= pe; }
    }
    if (bishops[0] >= 2) { mg += 25; eg += 40; }
    if (bishops[1] >= 2) { mg -= 25; eg -= 40; }
    phase = Math.min(24, phase);
    const score = Math.round((mg * phase + eg * (24 - phase)) / 24);
    return this.side === WHITE ? score : -score;
  }

  /** Not enough pieces left for anyone to checkmate. */
  deadDraw(): boolean {
    let minors = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const t = this.b[s] & 7;
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      if (t === KNIGHT || t === BISHOP) minors++;
    }
    return minors <= 1;
  }

  hasPieces(side: number): boolean {
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const pc = this.b[s];
      if (pc && (pc & 8) === side && (pc & 7) !== PAWN && (pc & 7) !== KING) return true;
    }
    return false;
  }

  perft(depth: number): number {
    if (depth === 0) return 1;
    let n = 0;
    for (const m of this.moves()) {
      if (!this.make(m)) continue;
      n += this.perft(depth - 1);
      this.unmake();
    }
    return n;
  }
}

export const moveToUci = (m: number) => sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? LETTER[mPromo(m)] : "");

// ─── Search ──────────────────────────────────────────────────────────────────
const VICTIM = [0, 100, 300, 310, 500, 900, 2000];
type SearchOptions = { maxDepth: number; budgetMs: number; noise: number };

class Searcher {
  nodes = 0;
  stopped = false;
  private deadline = 0;
  private tt = new Map<number, TTEntry>();
  private killers: number[][] = Array.from({ length: 128 }, () => [0, 0]);
  private history = new Int32Array(16 * 128);
  private noise: number;
  private noiseSalt = (Math.random() * 0xffffffff) >>> 0;

  constructor(private pos: Position, private opts: SearchOptions) { this.noise = opts.noise; }

  private evalNoisy(): number {
    const base = this.pos.evaluate();
    if (!this.noise) return base;
    // The same position always gets the same nudge within one search, so the search stays consistent.
    let h = (this.pos.hb ^ this.noiseSalt) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    return base + ((h % (2 * this.noise + 1)) - this.noise);
  }

  private order(moves: number[], ttMove: number, ply: number): number[] {
    const b = this.pos.b;
    const scores = moves.map((m) => {
      if (m === ttMove) return 1_000_000;
      const flags = mFlags(m);
      let s = 0;
      if (flags & F_CAPTURE) {
        const victim = flags & F_EP ? PAWN : b[mTo(m)] & 7;
        s = 100_000 + VICTIM[victim] * 10 - (b[mFrom(m)] & 7);
      } else if (this.killers[ply]?.[0] === m) s = 90_000;
      else if (this.killers[ply]?.[1] === m) s = 89_000;
      else s = Math.min(80_000, this.history[(b[mFrom(m)] & 15) * 128 + mTo(m)]);
      if (mPromo(m)) s += mPromo(m) === QUEEN ? 95_000 : -50_000;
      return s;
    });
    const idx = moves.map((_, i) => i).sort((a, c) => scores[c] - scores[a]);
    return idx.map((i) => moves[i]);
  }

  private tick() {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) { this.stopped = true; throw new Stop(); }
  }

  private quiesce(alpha: number, beta: number, ply: number): number {
    this.tick();
    const pos = this.pos;
    const checked = ply < 40 && pos.inCheck();
    if (!checked) {
      const stand = this.evalNoisy();
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
    }
    const moves = this.order(pos.moves(!checked), 0, Math.min(ply, 127));
    let legal = 0;
    let best = checked ? -MATE + ply : alpha;
    for (const m of moves) {
      if (!checked && !(mFlags(m) & F_CAPTURE) && mPromo(m) !== QUEEN) continue;
      if (!pos.make(m)) continue;
      legal++;
      const score = -this.quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    if (checked && !legal) return -MATE + ply;
    return checked ? best : alpha;
  }

  private search(depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
    const pos = this.pos;
    if (ply > 0) {
      this.tick();
      if (pos.half >= 100 || pos.repeated() || pos.deadDraw()) return 0;
      // Mate distance pruning.
      alpha = Math.max(alpha, -MATE + ply);
      beta = Math.min(beta, MATE - ply - 1);
      if (alpha >= beta) return alpha;
    }
    const checked = pos.inCheck();
    if (checked && ply < 60) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);

    const key = pos.ha;
    const entry = this.tt.get(key);
    let ttMove = 0;
    if (entry && entry.hb === pos.hb) {
      ttMove = entry.move;
      if (ply > 0 && entry.depth >= depth) {
        const s = entry.score;
        if (entry.flag === TT_EXACT) return s;
        if (entry.flag === TT_LOWER && s >= beta) return s;
        if (entry.flag === TT_UPPER && s <= alpha) return s;
      }
    }

    if (allowNull && !checked && ply > 0 && depth >= 3 && beta < MATE - 1000 && pos.hasPieces(pos.side) && this.evalNoisy() >= beta) {
      pos.makeNull();
      let score: number;
      try { score = -this.search(depth - 3, -beta, -beta + 1, ply + 1, false); } finally { pos.unmakeNull(); }
      if (score >= beta) return beta;
    }

    const moves = this.order(pos.moves(), ttMove, Math.min(ply, 127));
    const startAlpha = alpha;
    let best = -INF, bestMove = 0, legal = 0;
    for (const m of moves) {
      if (!pos.make(m)) continue;
      legal++;
      let score: number;
      try {
        if (legal === 1) score = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
        else {
          // Principal variation search: prove the move is worse with a null window first.
          score = -this.search(depth - 1, -alpha - 1, -alpha, ply + 1, true);
          if (score > alpha && score < beta) score = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
        }
      } finally { pos.unmake(); }
      if (score > best) { best = score; bestMove = m; if (ply === 0) this.rootBest = m; }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!(mFlags(m) & F_CAPTURE)) {
          const k = this.killers[Math.min(ply, 127)];
          if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
          this.history[(pos.b[mFrom(m)] & 15) * 128 + mTo(m)] += depth * depth;
        }
        break;
      }
    }
    if (!legal) return checked ? -MATE + ply : 0;
    const flag = best >= beta ? TT_LOWER : best > startAlpha ? TT_EXACT : TT_UPPER;
    if (this.tt.size > 400_000) this.tt.clear();
    this.tt.set(key, { hb: pos.hb, depth, score: best, flag, move: bestMove });
    return best;
  }

  rootBest = 0;

  run(): { move: number; score: number; depth: number } {
    this.deadline = Date.now() + scaledBudget(this.opts.budgetMs);
    let result = { move: 0, score: 0, depth: 0 };
    const legal = this.pos.legalMoves();
    if (!legal.length) return result;
    result.move = legal[0];
    if (legal.length === 1) return { move: legal[0], score: 0, depth: 0 };
    for (let depth = 1; depth <= this.opts.maxDepth; depth++) {
      this.rootBest = 0;
      try {
        const score = this.search(depth, -INF, INF, 0, false);
        result = { move: this.rootBest || result.move, score, depth };
        if (Math.abs(score) > MATE - 200) break; // a forced mate was found
      } catch (error) {
        if (!(error instanceof Stop)) throw error;
        // A better first move found in the unfinished iteration is still trustworthy.
        if (this.rootBest && depth > 1) result = { ...result, move: this.rootBest };
        break;
      }
    }
    return result;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────
/** Strength settings for the four computer levels shown in the lobby. */
export const CHESS_LEVELS: Record<number, SearchOptions & { randomChance: number }> = {
  1: { maxDepth: 1, budgetMs: 40, noise: 220, randomChance: 0.3 },
  2: { maxDepth: 2, budgetMs: 120, noise: 70, randomChance: 0 },
  3: { maxDepth: 5, budgetMs: 260, noise: 18, randomChance: 0 },
  4: { maxDepth: 64, budgetMs: 450, noise: 6, randomChance: 0 },
};

export type ChessPick = { from: string; to: string; promotion?: "q" | "r" | "b" | "n"; score: number; depth: number };

/** Picks a move for whoever is to move in `state`, at the given strength (1 to 4). */
export function pickChessMove(state: ChessState, level: number): ChessPick | null {
  const pos = Position.fromState(state);
  const settings = CHESS_LEVELS[Math.max(1, Math.min(4, Math.round(level) || 2))];
  const legal = pos.legalMoves();
  if (!legal.length) return null;
  let move: number;
  let score = 0, depth = 0;
  if (settings.randomChance && Math.random() < settings.randomChance) {
    move = legal[Math.floor(Math.random() * legal.length)];
  } else {
    const result = new Searcher(pos, settings).run();
    move = result.move || legal[0];
    score = result.score; depth = result.depth;
  }
  const uci = moveToUci(move);
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] as ChessPick["promotion"]) || undefined, score, depth };
}
