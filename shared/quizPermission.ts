// A parent's say-so for book quizzes.
// - Camera quizzes ("On my own"): the student enters a parent's email, and the parent approves from the email.
// - Proctor quizzes: the student enters a parent's email, and the parent gets a one-time code to type in,
//   good for one quiz, until they create a parent account and get their own Parent Proctor Code.
// Everything for one student is kept in one record (the `parent_quiz_permissions` setting, keyed by student id).

export type CameraStatus = "none" | "pending" | "approved" | "declined";

export type OneTimeCode = { hash: string; email: string; expiresAt: number };

export type PermissionRecord = {
  camera: {
    status: CameraStatus;
    email: string;
    /** The link in the parent's email carries this. */
    token: string;
    requestedAt: number;
    decidedAt: number;
  };
  codes: OneTimeCode[];
};

export type PermissionBook = Record<string, PermissionRecord>;

/** A one-time code lasts this long if the parent doesn't use it. */
export const ONE_TIME_CODE_DAYS = 7;
export const ONE_TIME_CODE_MS = ONE_TIME_CODE_DAYS * 24 * 60 * 60 * 1000;
/** At most this many unused one-time codes per student at once. */
export const MAX_CODES = 3;
/** Emails a student can send a day, for each kind. */
export const PERMISSION_EMAILS_PER_DAY = 3;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isPermissionToken = (v: string) => /^[0-9a-f]{48}$/.test(v);

// Letters and digits that are hard to mix up when read aloud or off a phone (no 0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A code like "K7QM-2XDP". `random` returns a byte (0–255) each call. */
export function makeOneTimeCode(random: () => number): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[random() % CODE_ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/** What the student typed, the way the code is stored: upper case, without spaces or dashes. */
export const normalizeCode = (v: string) => String(v || "").toUpperCase().replace(/[\s-]/g, "");

export function emptyRecord(): PermissionRecord {
  return { camera: { status: "none", email: "", token: "", requestedAt: 0, decidedAt: 0 }, codes: [] };
}

const STATUSES: CameraStatus[] = ["none", "pending", "approved", "declined"];

export function cleanRecord(input: unknown, now: number): PermissionRecord {
  const r = input && typeof input === "object" ? (input as any) : {};
  const c = r.camera && typeof r.camera === "object" ? r.camera : {};
  const status: CameraStatus = STATUSES.includes(c.status) ? c.status : "none";
  return {
    camera: {
      status,
      email: typeof c.email === "string" ? c.email.slice(0, 200) : "",
      token: typeof c.token === "string" && isPermissionToken(c.token) ? c.token : "",
      requestedAt: Number(c.requestedAt) || 0,
      decidedAt: Number(c.decidedAt) || 0,
    },
    codes: (Array.isArray(r.codes) ? r.codes : [])
      .filter((x: any) => x && typeof x.hash === "string" && Number(x.expiresAt) > now)
      .map((x: any) => ({ hash: x.hash, email: String(x.email || "").slice(0, 200), expiresAt: Number(x.expiresAt) }))
      .slice(-MAX_CODES),
  };
}

export function parseBook(raw: string | null | undefined): PermissionBook {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}

export const recordFor = (book: PermissionBook, studentId: number, now: number) => cleanRecord(book[String(studentId)], now);

/** The student asks again (maybe with another email): a new link, and the old one stops working. */
export function requestCamera(rec: PermissionRecord, email: string, token: string, now: number): PermissionRecord {
  if (rec.camera.status === "approved") return rec;
  return { ...rec, camera: { status: "pending", email, token, requestedAt: now, decidedAt: 0 } };
}

export function decideCamera(rec: PermissionRecord, token: string, approve: boolean, now: number): PermissionRecord | null {
  if (!token || rec.camera.token !== token) return null;
  return { ...rec, camera: { ...rec.camera, status: approve ? "approved" : "declined", decidedAt: now } };
}

export function addCode(rec: PermissionRecord, hash: string, email: string, now: number): PermissionRecord {
  return { ...rec, codes: [...rec.codes, { hash, email, expiresAt: now + ONE_TIME_CODE_MS }].slice(-MAX_CODES) };
}

/** Uses up a matching code. Returns the record without it, or null when nothing matched. */
export function useCode(rec: PermissionRecord, hash: string, now: number): PermissionRecord | null {
  const i = rec.codes.findIndex((c) => c.hash === hash && c.expiresAt > now);
  if (i < 0) return null;
  return { ...rec, codes: rec.codes.filter((_, j) => j !== i) };
}

/** "ja•••@gmail.com", so a student can see where the email went without the screen showing the whole address. */
export function maskEmail(email: string): string {
  const [name, domain] = String(email || "").split("@");
  if (!domain) return "";
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(4, name.length - 2)))}@${domain}`;
}
