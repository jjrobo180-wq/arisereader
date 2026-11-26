// FamilyHub: one shared Arise To Do hub for a whole family, beside each person's own WorkHub and LifeHub.
// The person who starts it owns it; the others join with its 6-character code. Everyone in it opens and
// saves the same workspace (server/familySpace.ts), merged the same way two phones' LifeHub copies are.

/** Letters and digits that can't be misread for each other (no 0/O, 1/I/L). */
export const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const FAMILY_MAX_MEMBERS = 12;

export function makeFamilyCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length) % CODE_LETTERS.length];
  return out;
}

/** What someone typed, as a code: case, spaces and dashes don't matter. */
export function cleanFamilyCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_LETTERS.includes(ch)) return null;
  return code;
}

export function cleanFamilyName(input: unknown): string {
  const name = typeof input === "string" ? input.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  return name || "Family";
}

export type FamilyInfo = {
  name: string;
  code: string;
  owner: boolean;
  members: { id: number; name: string; owner: boolean }[];
};

/** Who may do what: anyone in it can invite (the code) and leave; only the owner removes people, and
 *  the owner leaves only by being the last one (then the family and its hub are deleted). */
export function canLeave(info: { owner: boolean; memberCount: number }): boolean {
  return !info.owner || info.memberCount <= 1;
}
