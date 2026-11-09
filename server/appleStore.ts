// Arise All Access bought inside the iPhone apps with Apple's in-app purchase (StoreKit 2).
//
// The app hands the server the purchase Apple signed (a JWS). It's trusted only after checking that
// the certificate chain in its header ends at Apple Root CA - G3 (by fingerprint), that each
// certificate signs the one before it and is in date, that the two Apple certificates carry Apple's
// App Store marker extensions, and that the JWS itself is signed by the leaf (ES256). Then the
// purchase must be for one of our apps and the All Access product.
//
// Renewals, cancellations and refunds come from Apple's App Store Server Notifications (version 2):
// the same signed format, checked the same way.
import { X509Certificate, createHash, createPublicKey, verify } from "node:crypto";

/** SHA-256 of Apple Root CA - G3 (https://www.apple.com/certificateauthority/). */
export const APPLE_ROOT_G3_SHA256 = "63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179";
/** Apple's marker on the App Store receipt-signing leaf, and on the WWDR intermediate. */
const LEAF_OID = "1.2.840.113635.100.6.11.1";
const INTERMEDIATE_OID = "1.2.840.113635.100.6.2.1";

/** The iPhone apps that sell All Access, and the product each sells. */
export const APPLE_APPS = ["com.arisereader.arisetodo", "com.arisereader.fit", "com.arisereader.notes", "com.arisereader.podplus"] as const;
export const allAccessProductOf = (bundleId: string) => `${bundleId}.allaccess.monthly`;
export const isAllAccessProduct = (bundleId: unknown, productId: unknown) =>
  typeof bundleId === "string" && (APPLE_APPS as readonly string[]).includes(bundleId) && productId === allAccessProductOf(bundleId);

export class AppleVerifyError extends Error {}

const b64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const fingerprint = (c: X509Certificate) => createHash("sha256").update(c.raw).digest("hex").toUpperCase();
/** True when a certificate's DER carries the given extension OID (the OID's encoded bytes appear in it). */
function hasOid(cert: X509Certificate, oid: string): boolean {
  const parts = oid.split(".").map(Number);
  const bytes: number[] = [parts[0] * 40 + parts[1]];
  for (const n of parts.slice(2)) {
    const stack: number[] = [n & 0x7f];
    let v = Math.floor(n / 128);
    while (v > 0) { stack.unshift((v & 0x7f) | 0x80); v = Math.floor(v / 128); }
    bytes.push(...stack);
  }
  const needle = Buffer.from([0x06, bytes.length, ...bytes]);
  return cert.raw.includes(needle);
}

export type VerifyOptions = { now?: number; rootSha256?: string; skipOids?: boolean };

/** Checks an Apple-signed JWS and returns its payload. Throws AppleVerifyError when it isn't Apple's. */
export function verifyAppleJws<T = any>(jws: unknown, o: VerifyOptions = {}): T {
  if (typeof jws !== "string" || jws.length > 20_000) throw new AppleVerifyError("not a signed purchase");
  const parts = jws.split(".");
  if (parts.length !== 3) throw new AppleVerifyError("not a signed purchase");
  let header: any;
  try { header = JSON.parse(b64url(parts[0]).toString("utf8")); } catch { throw new AppleVerifyError("bad header"); }
  if (header?.alg !== "ES256" || !Array.isArray(header.x5c) || header.x5c.length !== 3) throw new AppleVerifyError("unexpected signature type");
  let chain: X509Certificate[];
  try { chain = header.x5c.map((c: string) => new X509Certificate(Buffer.from(c, "base64"))); } catch { throw new AppleVerifyError("bad certificate"); }
  const [leaf, mid, root] = chain;
  if (fingerprint(root) !== (o.rootSha256 ?? APPLE_ROOT_G3_SHA256)) throw new AppleVerifyError("not signed by Apple");
  const at = o.now ?? Date.now();
  for (const c of chain) if (Date.parse(c.validFrom) > at || Date.parse(c.validTo) < at) throw new AppleVerifyError("certificate out of date");
  if (!leaf.verify(mid.publicKey) || !mid.verify(root.publicKey) || !root.verify(root.publicKey)) throw new AppleVerifyError("broken certificate chain");
  if (!o.skipOids && (!hasOid(leaf, LEAF_OID) || !hasOid(mid, INTERMEDIATE_OID))) throw new AppleVerifyError("not an App Store certificate");
  const ok = verify("sha256", Buffer.from(`${parts[0]}.${parts[1]}`), { key: createPublicKey(leaf.publicKey.export({ type: "spki", format: "pem" })), dsaEncoding: "ieee-p1363" }, b64url(parts[2]));
  if (!ok) throw new AppleVerifyError("bad signature");
  try { return JSON.parse(b64url(parts[1]).toString("utf8")) as T; } catch { throw new AppleVerifyError("bad payload"); }
}

/** The fields of Apple's JWSTransactionDecodedPayload that we use. */
export type AppleTransaction = {
  bundleId: string; productId: string; originalTransactionId: string; transactionId: string;
  expiresDate?: number; revocationDate?: number; signedDate?: number; purchaseDate?: number;
  appAccountToken?: string; environment?: "Production" | "Sandbox" | string;
};

/** What an All Access purchase means right now: running until `endsAt`, or ended. */
export function allAccessState(t: AppleTransaction, now: number): { active: boolean; endsAt: string | null } {
  if (t.revocationDate) return { active: false, endsAt: new Date(t.revocationDate).toISOString() };
  const ends = Number(t.expiresDate);
  if (!Number.isFinite(ends) || ends <= 0) return { active: false, endsAt: null };
  return { active: ends > now, endsAt: new Date(ends).toISOString() };
}
