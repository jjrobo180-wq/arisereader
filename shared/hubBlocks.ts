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

// ─── Halves of a block, and whose class it is ───────────────────────────────
//
// In one block a teacher may push in to two classes: the first half with one teacher and the second half
// with another. A service can say which half of its block it is in, and whose class it is. Both are
// optional: a teacher who does not split a block never sees a half.

/** The half of a block a service is in. Not set means the whole block. */
export type BlockPart = "first" | "second";
export const BLOCK_PARTS: BlockPart[] = ["first", "second"];
export const PART_NAMES: Record<BlockPart, string> = { first: "1st half", second: "2nd half" };
export const TEACHER_NAME_MAX = 60;

/** A saved half made safe to use: "first" or "second", or nothing. */
export const cleanPart = (value: unknown): BlockPart | undefined => (value === "first" || value === "second" ? value : undefined);
/** The name of the teacher whose class it is, as it is kept: single spaces, not too long, and capitals on a name typed all in small letters ("ms. lee" is Ms. Lee). */
export const cleanTeacher = (value: unknown): string => {
  const name = (typeof value === "string" ? value : "").replace(/\s+/g, " ").trim().slice(0, TEACHER_NAME_MAX);
  return name === name.toLowerCase() ? name.replace(/(^|[\s-])(\p{L})/gu, (_all, before: string, letter: string) => before + letter.toUpperCase()) : name;
};

/** "1st half · Ms. Lee": the half of the block and whose class it is. "" for the whole block with no class named. */
export function groupText(where: { part?: unknown; teacher?: unknown }): string {
  const part = cleanPart(where.part);
  return [part ? PART_NAMES[part] : "", cleanTeacher(where.teacher)].filter(Boolean).join(" · ");
}

/** "Block 2 · 1st half · Ms. Lee": where a service is, in a few words. "" when it is in no block and no class. */
export function placeText(blocks: SchoolBlock[], where: { block?: string; part?: unknown; teacher?: unknown }): string {
  return [blockName(blocks, where.block), groupText(where)].filter(Boolean).join(" · ");
}

/** Sorts the halves of a block in the order of the day: the whole block, then the first half, then the second. */
export const partRank = (part: unknown): number => (part === "first" ? 1 : part === "second" ? 2 : 0);
