import { type ArcadeEngine, type Outcome, type Seat, check, clone, intField, other, pick, rand, shuffle } from "../core";

// Sea Battle on an 8×8 grid. Fleets are placed at random (shuffle until you like it), ships never touch.
export const GRID = 8;
export const FLEET = [4, 3, 3, 2];

export type Ship = { cells: number[] };
export type SeaState = {
  phase: "setup" | "battle";
  fleets: [Ship[], Ship[]];
  ready: [boolean, boolean];
  marks: [number[], number[]]; // marks[a-1][cell] on the OTHER seat's waters: 0 unknown, 1 miss, 2 hit
  turn: Seat;
  winner: Outcome;
  last: { seat: Seat; cell: number; hit: boolean; sunk: number | null } | null;
};
export type SeaMove = { type: "shuffle" } | { type: "ready" } | { type: "fire"; cell: number };

const neighbors8 = (cell: number): number[] => {
  const r = Math.floor(cell / GRID), c = cell % GRID, out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < GRID && cc >= 0 && cc < GRID) out.push(rr * GRID + cc);
  }
  return out;
};
const neighbors4 = (cell: number): number[] => {
  const r = Math.floor(cell / GRID), c = cell % GRID, out: number[] = [];
  if (r > 0) out.push(cell - GRID);
  if (r < GRID - 1) out.push(cell + GRID);
  if (c > 0) out.push(cell - 1);
  if (c < GRID - 1) out.push(cell + 1);
  return out;
};

function placements(size: number): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
    if (c + size <= GRID) out.push(Array.from({ length: size }, (_, k) => r * GRID + c + k));
    if (r + size <= GRID) out.push(Array.from({ length: size }, (_, k) => (r + k) * GRID + c));
  }
  return out;
}
const PLACEMENTS: Record<number, number[][]> = Object.fromEntries([2, 3, 4].map((n) => [n, placements(n)]));

export function randomFleet(): Ship[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const blocked = new Set<number>();
    const ships: Ship[] = [];
    let ok = true;
    for (const size of FLEET) {
      const options = PLACEMENTS[size].filter((cells) => cells.every((x) => !blocked.has(x)));
      if (!options.length) { ok = false; break; }
      const cells = pick(options);
      ships.push({ cells });
      for (const x of cells) { blocked.add(x); for (const n of neighbors8(x)) blocked.add(n); }
    }
    if (ok) return ships;
  }
  // Fallback layout (never reached in practice).
  return [{ cells: [0, 1, 2, 3] }, { cells: [16, 17, 18] }, { cells: [32, 33, 34] }, { cells: [48, 49] }];
}

const isSunk = (ship: Ship, marks: readonly number[]) => ship.cells.every((x) => marks[x] === 2);

export const seabattle: ArcadeEngine<SeaState, SeaMove> = {
  id: "seabattle",
  init(opts) {
    return {
      phase: "setup",
      fleets: [randomFleet(), randomFleet()],
      ready: [false, opts.vsComputer],
      marks: [Array(GRID * GRID).fill(0), Array(GRID * GRID).fill(0)],
      turn: 1,
      winner: null,
      last: null,
    };
  },
  toAct(s) {
    if (s.winner !== null) return [];
    if (s.phase === "setup") return ([1, 2] as Seat[]).filter((seat) => !s.ready[seat - 1]);
    return [s.turn];
  },
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    const s = clone(state);
    if (state.phase === "setup") {
      check(!state.ready[seat - 1], "You are ready. Waiting for the other captain.");
      if (move?.type === "shuffle") { s.fleets[seat - 1] = randomFleet(); return s; }
      check(move?.type === "ready", "Shuffle your fleet or press Ready.");
      s.ready[seat - 1] = true;
      if (s.ready[0] && s.ready[1]) { s.phase = "battle"; s.turn = 1; }
      return s;
    }
    check(move?.type === "fire", "Choose a square to fire at.");
    check(state.turn === seat, "Wait for your turn.");
    const cell = intField((move as any).cell, 0, GRID * GRID - 1, "Choose a square to fire at.");
    const marks = s.marks[seat - 1];
    check(!marks[cell], "You already fired there.");
    const enemy = s.fleets[other(seat) - 1];
    const ship = enemy.find((sh) => sh.cells.includes(cell));
    marks[cell] = ship ? 2 : 1;
    const sunk = ship && isSunk(ship, marks) ? ship.cells.length : null;
    s.last = { seat, cell, hit: !!ship, sunk };
    if (enemy.every((sh) => isSunk(sh, marks))) s.winner = seat;
    else s.turn = other(seat);
    return s;
  },
  view(s, seat) {
    const them = other(seat);
    const theirFleet = s.fleets[them - 1];
    const myMarks = s.marks[seat - 1];
    const sunkShips = theirFleet.filter((sh) => isSunk(sh, myMarks) || s.winner !== null).map((sh) => sh.cells);
    return {
      phase: s.phase,
      turn: s.turn,
      winner: s.winner,
      last: s.last,
      ready: s.ready,
      myFleet: s.fleets[seat - 1].map((sh) => ({ cells: sh.cells, sunk: isSunk(sh, s.marks[them - 1]) })),
      myShots: myMarks, // what I know about their waters
      theirShots: s.marks[them - 1], // where they fired at me
      revealedShips: sunkShips,
      theirShipsLeft: theirFleet.filter((sh) => !isSunk(sh, myMarks)).length,
      myShipsLeft: s.fleets[seat - 1].filter((sh) => !isSunk(sh, s.marks[them - 1])).length,
    };
  },
  ai(s, seat, level) {
    if (s.phase === "setup") return { type: "ready" };
    const marks = s.marks[seat - 1];
    const fleet = s.fleets[other(seat) - 1];
    // Only knowledge the computer is allowed: its own marks and which ships are sunk.
    const sunkShips = fleet.filter((sh) => isSunk(sh, marks));
    const sunkCells = new Set(sunkShips.flatMap((sh) => sh.cells));
    const blocked = new Set<number>();
    for (const x of sunkCells) for (const n of neighbors8(x)) blocked.add(n);
    const open = marks.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const liveHits = marks.map((v, i) => (v === 2 && !sunkCells.has(i) ? i : -1)).filter((i) => i >= 0);
    const fire = (cell: number) => ({ type: "fire" as const, cell });

    if (level === 1) {
      if (liveHits.length && Math.random() < 0.45) {
        const near = shuffle(liveHits.flatMap(neighbors4)).filter((x) => !marks[x]);
        if (near.length) return fire(near[0]);
      }
      return fire(pick(open));
    }
    if (level === 2) {
      if (liveHits.length) {
        // Extend along a line of hits when there is one.
        if (liveHits.length >= 2) {
          const horizontal = Math.floor(liveHits[0] / GRID) === Math.floor(liveHits[1] / GRID);
          const sorted = liveHits.slice().sort((a, b) => a - b);
          const step = horizontal ? 1 : GRID;
          const ends = [sorted[0] - step, sorted[sorted.length - 1] + step].filter((x) =>
            x >= 0 && x < GRID * GRID && !marks[x] && (!horizontal || Math.floor(x / GRID) === Math.floor(sorted[0] / GRID)));
          if (ends.length) return fire(pick(ends));
        }
        const near = shuffle(liveHits.flatMap(neighbors4)).filter((x) => !marks[x] && !blocked.has(x));
        if (near.length) return fire(near[0]);
      }
      const parity = open.filter((i) => (Math.floor(i / GRID) + (i % GRID)) % 2 === 0 && !blocked.has(i));
      return fire(pick(parity.length ? parity : open));
    }
    // Level 3: probability map of where the remaining ships can still be.
    const remaining = fleet.filter((sh) => !isSunk(sh, marks)).map((sh) => sh.cells.length);
    const heat = Array(GRID * GRID).fill(0);
    for (const size of remaining) {
      for (const cells of PLACEMENTS[size]) {
        if (cells.some((x) => marks[x] === 1 || sunkCells.has(x) || blocked.has(x))) continue;
        const covered = cells.filter((x) => marks[x] === 2).length;
        const weight = covered ? 1 + covered * 25 : 1;
        for (const x of cells) if (!marks[x]) heat[x] += weight;
      }
    }
    let best = open[0], bestHeat = -1;
    for (const x of open) { const h = heat[x] + Math.random() * 0.5; if (h > bestHeat) { bestHeat = h; best = x; } }
    return fire(best ?? open[rand(open.length)]);
  },
};
