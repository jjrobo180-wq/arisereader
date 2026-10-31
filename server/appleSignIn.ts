// Sign in with Apple for the Arise To Duo and Pod+ iPhone apps.
//
// The app asks iOS to sign in (the Apple sheet with Face ID); iOS hands back an identity token, a JWT
// signed by Apple. The server checks it here against Apple's published keys before trusting who it
// says the person is: signed by Apple, issued by appleid.apple.com, made for one of our apps, and not
// expired. Nothing from the phone is trusted without that check.
import { createPrivateKey, createPublicKey, sign as signData, verify as verifySignature, type JsonWebKey } from "node:crypto";

export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
/** The apps a token may be for (their bundle IDs). */
export const ARISE_APP = "com.arisereader.arisetodo";
export const PODPLUS_APP = "com.arisereader.podplus";
/** A.R.I.S.E. Reader Educator, the teacher and parent Reader app. */
export const EDUCATOR_APP = "com.arisereader.educator";
/** Arise Fit, training and nutrition (personal accounts, like Arise To Duo). */
export const FIT_APP = "com.arisereader.fit";

export type AppleClaims = { sub: string; email: string; emailVerified: boolean; privateEmail: boolean; aud: string };
type Jwk = JsonWebKey & { kid?: string; alg?: string };
export type KeyFetcher = () => Promise<Jwk[]>;

const part = (s: string) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

let cache: { at: number; keys: Jwk[] } | null = null;
/** Apple's signing keys, kept an hour (fetched again at once when a token names a key we don't have). */
export const appleKeys: KeyFetcher = async () => {
  if (cache && Date.now() - cache.at < 3600_000) return cache.keys;
  const r = await fetch(APPLE_KEYS_URL, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Apple keys: ${r.status}`);
  const body = (await r.json()) as { keys?: Jwk[] };
  cache = { at: Date.now(), keys: Array.isArray(body.keys) ? body.keys : [] };
  return cache.keys;
};

export class AppleTokenError extends Error {}

/** Checks an identity token from the iPhone. Throws AppleTokenError when it can't be trusted. */
export async function verifyAppleToken(token: string, audiences: string[], keys: KeyFetcher = appleKeys, now = Date.now()): Promise<AppleClaims> {
  const pieces = String(token || "").split(".");
  if (pieces.length !== 3) throw new AppleTokenError("That Apple sign-in didn't come through. Try again.");
  let header: any, claims: any;
  try { header = part(pieces[0]); claims = part(pieces[1]); } catch { throw new AppleTokenError("That Apple sign-in didn't come through. Try again."); }
  if (header?.alg !== "RS256" || typeof header?.kid !== "string") throw new AppleTokenError("That Apple sign-in isn't signed the way Apple signs.");
  let list = await keys();
  let jwk = list.find((k) => k.kid === header.kid);
  if (!jwk && keys === appleKeys) { cache = null; list = await keys(); jwk = list.find((k) => k.kid === header.kid); }
  if (!jwk) throw new AppleTokenError("That Apple sign-in used a key Apple doesn't list.");
  const ok = verifySignature("RSA-SHA256", Buffer.from(`${pieces[0]}.${pieces[1]}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(pieces[2], "base64url"));
  if (!ok) throw new AppleTokenError("That Apple sign-in isn't genuine.");
  if (claims?.iss !== APPLE_ISSUER) throw new AppleTokenError("That sign-in isn't from Apple.");
  if (!audiences.includes(String(claims?.aud))) throw new AppleTokenError("That Apple sign-in was made for a different app.");
  if (!(Number(claims?.exp) * 1000 > now - 60_000)) throw new AppleTokenError("That Apple sign-in ran out. Try again.");
  if (typeof claims?.sub !== "string" || !claims.sub) throw new AppleTokenError("That Apple sign-in has no account in it.");
  const truthy = (v: unknown) => v === true || v === "true";
  return {
    sub: claims.sub, aud: String(claims.aud),
    email: typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "",
    emailVerified: truthy(claims.email_verified), privateEmail: truthy(claims.is_private_email),
  };
}

/** A username for a new account made with Apple: from the email when it's a real one, else "apple" and a number. */
export function appleUsername(email: string, privateEmail: boolean, taken: (name: string) => Promise<boolean>): Promise<string> {
  const base = (!privateEmail && email ? email.split("@")[0] : "apple").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20) || "apple";
  return (async () => {
    const start = base.length >= 3 ? base : `${base}user`;
    if (!(await taken(start))) return start;
    for (let i = 0; i < 20; i++) {
      const name = `${start.slice(0, 22)}${Math.floor(1000 + Math.random() * 90000)}`;
      if (!(await taken(name))) return name;
    }
    return `apple${Date.now().toString(36)}`;
  })();
}

// ---------------- token revocation when an account is deleted ----------------
// Apple asks apps that use Sign in with Apple to revoke the person's Apple tokens when they delete
// their account. That needs a "Sign in with Apple" key from the Apple Developer site, set on the server
// as APPLE_SIWA_KEY (the .p8 text), APPLE_SIWA_KEY_ID and APPLE_TEAM_ID. With them, the sign-in's
// one-time code is traded for a refresh token (kept with the account) and revoked on deletion.

export const siwaConfigured = () => !!(process.env.APPLE_SIWA_KEY && process.env.APPLE_SIWA_KEY_ID && process.env.APPLE_TEAM_ID);

/** The short-lived client secret Apple's token endpoints want: an ES256 JWT signed with the key. */
export function appleClientSecret(clientId: string, now = Math.floor(Date.now() / 1000)): string {
  const raw = String(process.env.APPLE_SIWA_KEY || "").replace(/\\n/g, "\n");
  const key = createPrivateKey(raw.includes("BEGIN") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b({ alg: "ES256", kid: process.env.APPLE_SIWA_KEY_ID });
  const body = b({ iss: process.env.APPLE_TEAM_ID, iat: now, exp: now + 300, aud: APPLE_ISSUER, sub: clientId });
  const sig = signData("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${head}.${body}.${sig}`;
}

const form = (o: Record<string, string>) => new URLSearchParams(o).toString();

/** Trades the sign-in's one-time code for a refresh token ("" when the key isn't set or Apple says no). */
export async function appleRefreshToken(code: string, clientId: string): Promise<string> {
  if (!siwaConfigured() || !code) return "";
  const r = await fetch(`${APPLE_ISSUER}/auth/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(10_000),
    body: form({ client_id: clientId, client_secret: appleClientSecret(clientId), code, grant_type: "authorization_code" }),
  });
  if (!r.ok) return "";
  const body = (await r.json().catch(() => ({}))) as any;
  return typeof body.refresh_token === "string" ? body.refresh_token : "";
}

/** Revokes a refresh token. True when Apple accepted it. */
export async function revokeAppleToken(refreshToken: string, clientId: string): Promise<boolean> {
  if (!siwaConfigured() || !refreshToken) return false;
  const r = await fetch(`${APPLE_ISSUER}/auth/revoke`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(10_000),
    body: form({ client_id: clientId, client_secret: appleClientSecret(clientId), token: refreshToken, token_type_hint: "refresh_token" }),
  });
  return r.ok;
}
