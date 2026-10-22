// Passcode lock: lock chosen parts of a hub (a journal, money, one note, an installed app) behind
// a 4–8 digit passcode, set in Settings. It keeps other people who use the same phone or computer
// out — kids, a partner, a coworker at your desk. It is a lock on the screen, not encryption: the
// data itself is saved the same as always.
//
// The passcode is never saved, only a salted PBKDF2 hash of it, in the hub's own saved file
// (LifeHub: family.passLock, WorkHub: workspace.passLock), so the lock follows the account to every
// device. Unlocking lasts while the page stays open and in use (see client/src/lib/passLock.ts);
// reloading the page or leaving it idle locks everything again.
//
// Forgot the passcode? The account password turns the lock off (POST /api/pass-lock/check-password).

export type PassLock = {
  salt: string;
  hash: string;
  /** What is locked: section ids ("journal"), "note:<id>", "notes-app:<id>", "kit:<id>", WorkHub tab ids… */
  locked: string[];
  /** Locks again after this many minutes without use. */
  minutes: number;
};

export const LOCK_MINUTES = [1, 5, 15, 60] as const;
export const DEFAULT_LOCK_MINUTES = 5;
export const LOCK_LIMIT = 300;

export const validPasscode = (code: string) => /^\d{4,8}$/.test(code);
const HEX = /^[0-9a-f]{32,128}$/;
const LOCK_ID = /^[\w:.-]{1,100}$/;

/** A saved lock made safe, or undefined when there's no (valid) passcode. */
export function cleanPassLock(raw: unknown): PassLock | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.salt !== "string" || typeof r.hash !== "string" || !HEX.test(r.salt) || !HEX.test(r.hash)) return undefined;
  const locked = Array.isArray(r.locked) ? [...new Set(r.locked.filter((x): x is string => typeof x === "string" && LOCK_ID.test(x)))].slice(0, LOCK_LIMIT) : [];
  const minutes = (LOCK_MINUTES as readonly number[]).includes(Number(r.minutes)) ? Number(r.minutes) : DEFAULT_LOCK_MINUTES;
  return { salt: r.salt, hash: r.hash, locked, minutes };
}

const hex = (b: ArrayBuffer | Uint8Array) => Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const subtle = () => {
  const c = (globalThis as any).crypto;
  if (!c?.subtle) throw new Error("This browser can't set a passcode.");
  return c as Crypto;
};

/** The saved hash for a passcode (PBKDF2-SHA256, 120,000 rounds). */
export async function hashPasscode(code: string, salt: string): Promise<string> {
  const c = subtle();
  const key = await c.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = await c.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 120_000 }, key, 256);
  return hex(bits);
}

/** A new lock for this passcode, keeping what was already locked. */
export async function makePassLock(code: string, keep?: Pick<PassLock, "locked" | "minutes">): Promise<PassLock> {
  if (!validPasscode(code)) throw new Error("Use 4 to 8 numbers.");
  const salt = hex(subtle().getRandomValues(new Uint8Array(16)));
  return { salt, hash: await hashPasscode(code, salt), locked: keep?.locked ?? [], minutes: keep?.minutes ?? DEFAULT_LOCK_MINUTES };
}

/** Is this the right passcode? Compared without stopping at the first different character. */
export async function checkPasscode(lock: PassLock, code: string): Promise<boolean> {
  if (!validPasscode(code)) return false;
  const got = await hashPasscode(code, lock.salt);
  if (got.length !== lock.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ lock.hash.charCodeAt(i);
  return diff === 0;
}

export const isLocked = (lock: PassLock | undefined, id: string) => !!lock && lock.locked.includes(id);
export const toggleLocked = (lock: PassLock, id: string, on: boolean): PassLock =>
  ({ ...lock, locked: on ? [...new Set([...lock.locked, id])].slice(0, LOCK_LIMIT) : lock.locked.filter((x) => x !== id) });

export const noteLockId = (noteId: string) => `note:${noteId}`;
