// The "Drop" app: an AirDrop-style file hand-off between two devices, offered as its own Arise
// App Store install. Three ways to connect, since a browser can't do real Bluetooth/local peer
// discovery the way AirDrop does:
//   1. A 6-character code, typed on the receiving device.
//   2. A QR code encoding a direct download link (scan to receive).
//   3. A plain shareable link (send it any way — text, chat, email).
// A fourth, "nearby" list on the Drop screen shows other unclaimed drops made recently from the
// same account's hub (not true local-network discovery — see server/dropApp.ts for why — but
// gives a tap-to-grab list without typing a code when both devices are signed into the same hub).
//
// A drop is NOT family-record state like Notes/Sheets/Drive: the receiving device is often a
// different account (or no account at all, via the link), so drops are *not* read out of
// `Family` — they live server-side only, keyed by their own code (see server/dropApp.ts). This
// file only has the small amount of shared shape/validation both client and server use.

export type DropMeta = {
  code: string;
  name: string;
  size: number;
  contentType: string;
  createdAt: string;
  /** ISO timestamp; a drop past this is treated as gone even if not yet swept from storage. */
  expiresAt: string;
  claimed: boolean;
};

/** Drops live for 24 hours or until downloaded once, whichever comes first. */
export const DROP_TTL_MS = 24 * 60 * 60 * 1000;
export const DROP_MAX_BYTES = 200 * 1024 * 1024; // 200MB

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read aloud or type

export function makeDropCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

export const isDropCode = (s: unknown): s is string => typeof s === "string" && /^[A-Z2-9]{6}$/.test(s);

export function isDropExpired(meta: Pick<DropMeta, "expiresAt" | "claimed">, now = Date.now()): boolean {
  if (meta.claimed) return true;
  const t = Date.parse(meta.expiresAt);
  return !Number.isFinite(t) || t <= now;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const numPositive = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0; };

/** Parses a DropMeta back out of its JSON-stringified settings-table value; null if malformed. */
export function cleanDropMeta(raw: unknown): DropMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as any;
  const code = str(r.code, 6);
  if (!isDropCode(code)) return null;
  const name = str(r.name, 160) || "File";
  const contentType = str(r.contentType, 100) || "application/octet-stream";
  const createdAt = str(r.createdAt, 40);
  const expiresAt = str(r.expiresAt, 40);
  if (!createdAt || !expiresAt) return null;
  return { code, name, size: numPositive(r.size), contentType, createdAt, expiresAt, claimed: !!r.claimed };
}
