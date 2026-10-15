import test from "node:test";
import assert from "node:assert/strict";
import { START_COLS, START_RHYTHM, packStart, startSize } from "../shared/startScreen";

const holes = (sizes: ReturnType<typeof startSize>[], upToRow: number) => {
  const placed = packStart(sizes); const filled = new Set<string>();
  for (const p of placed) for (let y = p.row; y < p.row + p.rows; y++) for (let x = p.col; x < p.col + p.cols; x++) filled.add(`${x},${y}`);
  let n = 0; for (let y = 0; y < upToRow; y++) for (let x = 0; x < START_COLS; x++) if (!filled.has(`${x},${y}`)) n++;
  return n;
};

test("the start screen's default sizes fill whole rows with no holes, cycle after cycle", () => {
  for (const cycles of [1, 2, 3]) {
    const sizes = Array.from({ length: START_RHYTHM.length * cycles }, (_, i) => startSize(i));
    const placed = packStart(sizes);
    const rows = Math.max(...placed.map((p) => p.row + p.rows));
    assert.equal(rows, 7 * cycles, `${cycles} cycle(s) take 7 rows each`);
    assert.equal(holes(sizes, rows), 0);
  }
});

test("it mixes sizes like a Windows Phone: small, medium and wide all appear, and the first row is four small tiles", () => {
  assert.deepEqual(new Set(START_RHYTHM), new Set(["small", "medium", "large"]));
  assert.deepEqual(START_RHYTHM.slice(0, 4), ["small", "small", "small", "small"]);
  const placed = packStart(START_RHYTHM.slice(0, 5));
  assert.deepEqual([placed[4].col, placed[4].row, placed[4].cols, placed[4].rows], [0, 1, 2, 2], "the first medium sits under the first row, at the left");
});

test("a few tiles never leave a hole above the last row (partial last rows are normal)", () => {
  for (let n = 1; n <= 30; n++) {
    const sizes = Array.from({ length: n }, (_, i) => startSize(i));
    const placed = packStart(sizes); const last = Math.max(...placed.map((p) => p.row + p.rows));
    // Every row except the ones the final tiles occupy must be full.
    const lastTouch = Math.max(...placed.slice(-3).map((p) => p.row));
    assert.equal(holes(sizes, lastTouch), 0, `${n} tiles`);
    assert.ok(last >= 1);
  }
});

test("tile sizes wrap around and never go negative", () => {
  assert.equal(startSize(15), startSize(0)); assert.equal(startSize(-1), startSize(14));
});
