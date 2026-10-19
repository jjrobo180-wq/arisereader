// Passcode lock for a hub: one passcode (4–8 digits) set in the hub's ⋯ menu, which then locks any
// app the person picks and any note they mark "Lock note". Like the iPhone: unlock once and
// everything locked opens until you lock again (or leave the app for a few minutes).
//
// Only a salted PBKDF2 hash of the passcode is kept, never the passcode itself.

export type PrivacyLock = {
  salt: string;
  hash: string;
  /** How many digits the passcode has, so the keypad unlocks as soon as the last digit is typed. */
  digits: number;
  /** Section / app ids that need the passcode to open. */
  apps: string[];
};

const hex = (s: unknown, max: number) => (typeof s === "string" && /^[0-9a-f]+$/i.test(s) && s.length <= max ? s.toLowerCase() : "");

/** A saved lock, or null when there is none (or it's damaged). */
export function cleanLock(raw: unknown): PrivacyLock | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const salt = hex(r.salt, 64), hash = hex(r.hash, 128);
  const digits = typeof r.digits === "number" && Number.isInteger(r.digits) && r.digits >= 4 && r.digits <= 8 ? r.digits : 0;
  if (!salt || !hash || !digits) return null;
  const apps = Array.isArray(r.apps) ? [...new Set(r.apps.filter((x): x is string => typeof x === "string" && !!x && x.length <= 60))].slice(0, 200) : [];
  return { salt, hash, digits, apps };
}

export const validPasscode = (code: string) => /^\d{4,8}$/.test(code);

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function derive(code: string, salt: string): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveBits"]);
  const salty = new Uint8Array(salt.match(/../g)!.map((h) => parseInt(h, 16)));
  return toHex(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salty, iterations: 120_000 }, key, 256));
}

/** A new lock for this passcode, keeping the apps already chosen. */
export async function makeLock(code: string, apps: string[] = []): Promise<PrivacyLock> {
  if (!validPasscode(code)) throw new Error("Passcode must be 4 to 8 digits");
  const salt = toHex(globalThis.crypto.getRandomValues(new Uint8Array(16)).buffer);
  return { salt, hash: await derive(code, salt), digits: code.length, apps };
}

export async function checkPasscode(lock: PrivacyLock, code: string): Promise<boolean> {
  if (code.length !== lock.digits) return false;
  return (await derive(code, lock.salt)) === lock.hash;
}

export const appLocked = (lock: PrivacyLock | null | undefined, id: string) => !!lock && lock.apps.includes(id);

export function toggleApp(lock: PrivacyLock, id: string): PrivacyLock {
  return { ...lock, apps: lock.apps.includes(id) ? lock.apps.filter((a) => a !== id) : [...lock.apps, id] };
}
