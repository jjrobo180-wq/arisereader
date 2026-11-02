// Locked notes: encrypted on this device with the person's notes password, like Apple Notes' locked
// notes, but the server can't open them either. AES-GCM 256 with a key from PBKDF2-SHA256 (310,000
// rounds) and a random salt. The server keeps the salt and an encrypted check value (to tell a right
// password from a wrong one), never the password or key. Forget the password and the locked notes
// can't be opened by anyone; they can only be cleared to start again.
//
// On the iPhone, Face ID can unlock: the key is kept in the iPhone's Keychain, readable only after
// Face ID (the AriseOnDevice plugin's secret calls). The key stays in memory while notes are unlocked
// and is forgotten after 10 minutes away, or on Lock now.
import { cleanContent, type Cipher, type Page, type PageContent, type Vault } from "@shared/arisePages";
import { hasNativePlugin, isNativeApp, nativeCall } from "@/lib/nativeApp";

const CHECK = "arise-notes-vault-v1";
const ITER = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (b: ArrayBuffer | Uint8Array) => { const u = b instanceof Uint8Array ? b : new Uint8Array(b); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function derive(password: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  // Extractable so Face ID can keep it in the Keychain; it never leaves this device otherwise.
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as BufferSource, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}
export async function sealText(key: CryptoKey, text: string): Promise<Cipher> {
  const iv = rand(12);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, enc.encode(text));
  return { v: 1, iv: b64(iv), data: b64(data) };
}
export async function openText(key: CryptoKey, c: Cipher): Promise<string> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(c.iv) as BufferSource }, key, unb64(c.data) as BufferSource);
  return dec.decode(plain);
}

/** A new notes password. */
export async function makeVault(password: string, hint = ""): Promise<{ vault: Vault; key: CryptoKey }> {
  const salt = rand(16);
  const key = await derive(password, salt, ITER);
  return { vault: { v: 1, salt: b64(salt), iter: ITER, check: await sealText(key, CHECK), hint: hint.trim().slice(0, 80) }, key };
}
/** The key for a password, or null when it's the wrong password. */
export async function unlockVault(vault: Vault, password: string): Promise<CryptoKey | null> {
  const key = await derive(password, unb64(vault.salt), vault.iter);
  try { return (await openText(key, vault.check)) === CHECK ? key : null; } catch { return null; }
}

export async function lockContent(key: CryptoKey, content: PageContent, extra: { inkText?: string } = {}): Promise<Cipher> {
  return sealText(key, JSON.stringify({ ...content, inkText: extra.inkText ?? "" }));
}
export async function unlockContent(key: CryptoKey, page: Page): Promise<PageContent & { inkText?: string }> {
  const raw = JSON.parse(await openText(key, page.cipher!));
  return { ...cleanContent(raw, page.kind), inkText: typeof raw?.inkText === "string" ? raw.inkText : "" };
}

// ─── The key while unlocked ───────────────────────────────────────────────────
let unlocked: { key: CryptoKey; salt: string } | null = null;
let hiddenAt = 0;
const listeners = new Set<() => void>();
export const onLockChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const changed = () => listeners.forEach((f) => f());
export const currentKey = (vault: Vault | null): CryptoKey | null => (unlocked && vault && unlocked.salt === vault.salt ? unlocked.key : null);
export function rememberKey(key: CryptoKey, vault: Vault) { unlocked = { key, salt: vault.salt }; changed(); }
export function lockNow() { unlocked = null; changed(); }
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else if (unlocked && hiddenAt && Date.now() - hiddenAt > 10 * 60_000) lockNow();
  });
}

// ─── Face ID (Notes iPhone app) ───────────────────────────────────────────────
const PLUGIN = /arise.?on.?device/i;
const NAME = "AriseOnDevice";
const slot = (userId: number) => `arise-notes-vault-${userId}`;
export const faceIdAvailable = () => isNativeApp() && hasNativePlugin(PLUGIN);
export async function faceIdSave(userId: number, key: CryptoKey) {
  if (!faceIdAvailable()) return false;
  try { await nativeCall(PLUGIN, NAME, "secretSave", { key: slot(userId), value: b64(await crypto.subtle.exportKey("raw", key)) }); return true; } catch { return false; }
}
export async function faceIdLoad(userId: number): Promise<CryptoKey | null> {
  if (!faceIdAvailable()) return null;
  try {
    const r = await nativeCall(PLUGIN, NAME, "secretLoad", { key: slot(userId), reason: "Unlock your locked notes" });
    if (!r?.value) return null;
    return crypto.subtle.importKey("raw", unb64(String(r.value)) as BufferSource, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  } catch { return null; }
}
export async function faceIdForget(userId: number) { if (faceIdAvailable()) await nativeCall(PLUGIN, NAME, "secretRemove", { key: slot(userId) }).catch(() => {}); }
export async function faceIdSet(userId: number): Promise<boolean> {
  if (!faceIdAvailable()) return false;
  try { return !!(await nativeCall(PLUGIN, NAME, "secretHas", { key: slot(userId) }))?.has; } catch { return false; }
}
