/**
 * One monthly pool of AI minutes per Arise account, shared by Arise Notes and Pod+'s AI tools
 * (audiobook transcripts and "catch me up", the podcast maker, the wiki reader). Free accounts have 60
 * minutes a month; All Access (Notes Plus) has 1,500. Notes keeps the count (server/ariseNotes.ts); this
 * is how Pod+ checks and spends it. Minutes go by audio length: audio transcribed, audio made or read aloud.
 *
 * Set up once in server/routes.ts with configureAiMinutes(). Until then (tests, a local server) nothing is
 * counted and every request is allowed.
 */
export type AiMinutesBackend = {
  /** The Arise account behind a request: the signed-in user, or the Pod+ sign-in's email. */
  accountOf(req: any): Promise<number | null>;
  left(userId: number): Promise<number>;
  spend(userId: number, minutes: number, kind: string): Promise<void>;
};
let backend: AiMinutesBackend | null = null;
export function configureAiMinutes(b: AiMinutesBackend | null): void { backend = b; }

export const OUT_OF_MINUTES = "You've used this month's AI minutes. They're shared by Arise Notes and Pod+. Arise All Access gives you 1,500 a month.";

/**
 * Checks there are minutes for this request (at least one). Answers the request itself and returns false when
 * not: 401 to sign in, 402 when this month's minutes are used up. On true, call spendAi() once the work is done.
 */
export async function haveAiMinutes(req: any, res: any): Promise<boolean> {
  if (!backend) return true;
  let id: number | null = null;
  try { id = await backend.accountOf(req); } catch { id = null; }
  if (!id) { res.status(401).json({ message: "Sign in to use Pod+'s AI. Listening stays free without an account.", needSignIn: true }); return false; }
  let left = 0;
  try { left = await backend.left(id); } catch { left = 1; } // a hiccup in the count never blocks
  if (left < 1) { res.status(402).json({ message: OUT_OF_MINUTES, code: "ai_minutes", allAccess: true }); return false; }
  req.aiAccount = id;
  return true;
}

/** Counts minutes for the request haveAiMinutes() let through. Never throws. */
export async function spendAi(req: any, minutes: number, kind: string): Promise<void> {
  if (!backend || !req?.aiAccount || !(minutes > 0)) return;
  try { await backend.spend(req.aiAccount, minutes, kind); } catch (e: any) { console.error("[ai-minutes] couldn't count", kind, e?.message); }
}
