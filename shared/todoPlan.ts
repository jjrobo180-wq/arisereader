// A.R.I.S.E. To-Do: Free, and the $5 upgrade.
//
// Free (for everyone, including people on a $10 Arise Reader plan): ¼ MB of space, shared across
// WorkHub and LifeHub, and no AI. The upgrade, $5 a month: AI and unlimited space, under a
// fair-use policy. So someone who only wants To-Do pays at most $5; with a Reader plan, $15.
//
// "Space" is what the hubs save: everything typed in (to-dos, notes, students, calendar, logs).
// Nothing is ever deleted when someone is full. They keep using everything; they just can't add
// more until they clear some space or upgrade. The page and the server both measure with these
// functions, so they always agree.

export const FREE_SPACE_BYTES = 256 * 1024;
/** The upgrade's AI is for everyday use; this ceiling only stops runaway use (see FAIR_USE). */
export const UNLIMITED_AI_PER_MONTH = 300;
export const UNLIMITED_MONTHLY_CENTS = 500;

export const UNLIMITED_NAME = "A.R.I.S.E. To-Do Unlimited (AI and unlimited space)";
export const FAIR_USE =
  "Unlimited is meant for normal personal, family and classroom use. Using it in ways that put unusual strain on our service, like bulk data, automated use or anything far beyond normal use, isn't covered. If an account goes well beyond normal use, we'll contact you first. If it continues, we may limit the account or cancel the subscription and refund any unused time. Your data stays yours, and you can always export a copy.";

/** The code the server answers with when the free space is full. */
export const SPACE_FULL = "todo_space_full";
/** The code the server answers with when AI needs the upgrade (or its fair-use ceiling is reached). */
export const AI_LIMIT = "todo_ai_limit";

/** Bytes a hub takes up once saved. */
export function spaceOf(workspace: unknown): number {
  if (!workspace || typeof workspace !== "object") return 0;
  try { return new TextEncoder().encode(JSON.stringify(workspace) ?? "").length; } catch { return 0; }
}

/** Would this save take a free account past its space? (An account already over can keep what it has; it just can't grow.) */
export function growsPastFree(beforeTotal: number, afterTotal: number, limit = FREE_SPACE_BYTES): boolean {
  return afterTotal > limit && afterTotal > beforeTotal;
}

/** Space in words: "48 KB", "1.2 MB". */
export function spaceWords(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** This month, as "YYYY-MM" (UTC), for counting AI uses. */
export const aiMonth = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);
