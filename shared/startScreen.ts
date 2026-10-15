// The Windows-Phone-style start screen (the "Tile" theme's Home): four columns of square cells in
// three sizes — small (1×1), medium (2×2) and large/wide (4×2) — packed tightly with no gaps.
// Tiles that were never given a size by the person follow START_RHYTHM, which is built so that
// every full cycle fills whole rows exactly (nothing is left with a hole beside it).
import type { HomeSize } from "./hubLayout";

export const START_COLS = 4;
export const START_SPAN: Record<HomeSize, { cols: number; rows: number }> = { small: { cols: 1, rows: 1 }, medium: { cols: 2, rows: 2 }, large: { cols: 4, rows: 2 } };
/** Four small, a medium with four small, a wide, then two small, a medium and two small. 15 tiles, 7 rows. */
export const START_RHYTHM: readonly HomeSize[] = ["small", "small", "small", "small", "medium", "small", "small", "small", "small", "large", "small", "small", "medium", "small", "small"];
/** The size of the nth tile when nothing was chosen. */
export const startSize = (i: number): HomeSize => START_RHYTHM[((i % START_RHYTHM.length) + START_RHYTHM.length) % START_RHYTHM.length];

/** Where CSS grid (auto-flow: dense) puts each tile, so the layout can be checked without a browser. */
export function packStart(sizes: readonly HomeSize[]): { col: number; row: number; cols: number; rows: number }[] {
  const taken = new Set<string>();
  const fits = (c: number, r: number, w: number, h: number) => { if (c + w > START_COLS) return false; for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (taken.has(`${x},${y}`)) return false; return true; };
  return sizes.map((s) => {
    const { cols, rows } = START_SPAN[s];
    for (let r = 0; ; r++) for (let c = 0; c < START_COLS; c++) if (fits(c, r, cols, rows)) {
      for (let y = r; y < r + rows; y++) for (let x = c; x < c + cols; x++) taken.add(`${x},${y}`);
      return { col: c, row: r, cols, rows };
    }
  }) as { col: number; row: number; cols: number; rows: number }[];
}
