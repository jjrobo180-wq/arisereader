// Teacher Hub: the blocks (periods) of the school day. Service minutes are sectioned off by them:
// Block 1 to Block 5 to start with, and the teacher can rename them or add more.
// A block stands in for the time of day, so minutes carry a block and no clock time.

/** One block of the school day. */
export type SchoolBlock = { id: string; name: string };

export const BLOCK_NAME_MAX = 30;
export const BLOCKS_MAX = 12;

/** Block 1 to Block 5 (or "Period 1" to "Period 5"), with ids that stay the same so a plan can point at one. */
export const defaultBlocks = (word = "Block", count = 5): SchoolBlock[] => Array.from({ length: count }, (_, i) => ({ id: `b${i + 1}`, name: `${word} ${i + 1}` }));

/** Saved blocks made safe to use: each with an id and a name, and no id twice. null when nothing usable was saved, so the five default blocks are used. */
export function cleanBlocks(raw: unknown): SchoolBlock[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: SchoolBlock[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const id = typeof (b as any).id === "string" ? (b as any).id.trim().slice(0, 40) : "";
    const name = String((b as any).name ?? "").replace(/\s+/g, " ").trim().slice(0, BLOCK_NAME_MAX);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name });
    if (out.length >= BLOCKS_MAX) break;
  }
  return out.length ? out : null;
}

/** The blocks of this teacher's day: the saved ones, or Block 1 to Block 5. */
export const schoolBlocks = (workspace: { minuteBlocks?: SchoolBlock[] }): SchoolBlock[] => cleanBlocks(workspace.minuteBlocks) || defaultBlocks();

/** A block's name ("" when the block is not one of the teacher's). */
export const blockName = (blocks: SchoolBlock[], id: string | undefined): string => (id && blocks.find((b) => b.id === id)?.name) || "";
