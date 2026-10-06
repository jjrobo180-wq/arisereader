// Web push, built on Node's own crypto (VAPID sign-in + RFC 8291 message encryption),
// so it needs no extra package. Works for iPhone/iPad Home Screen apps (iOS 16.4+),
// Android, and desktop browsers.
import crypto from "node:crypto";

export type VapidKeys = { publicKey: string; privateKey: string; subject: string };
export type PushSubscriptionInfo = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushMessage = { title: string; body: string; url?: string; tag?: string };
export type PushResult = { ok: boolean; status: number; gone: boolean };

const b64u = (buf: Buffer) => buf.toString("base64url");
const fromB64u = (text: string) => Buffer.from(text, "base64url");

/** A fresh sign-in key pair, as the two url-safe strings browsers and push services use. */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" }) as { d: string };
  const pub = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const raw = Buffer.concat([Buffer.from([4]), fromB64u(pub.x), fromB64u(pub.y)]);
  return { publicKey: b64u(raw), privateKey: jwk.d };
}

function privateKeyObject(keys: VapidKeys) {
  const pub = fromB64u(keys.publicKey);
  return crypto.createPrivateKey({
    format: "jwk",
    key: { kty: "EC", crv: "P-256", d: keys.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
  });
}

/** The signed pass that tells the push service this message comes from us. */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, nowMs = Date.now()): string {
  const audience = new URL(endpoint).origin;
  const header = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(Buffer.from(JSON.stringify({ aud: audience, exp: Math.floor(nowMs / 1000) + 12 * 3600, sub: keys.subject })));
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), { key: privateKeyObject(keys), dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64u(signature)}, k=${keys.publicKey}`;
}

/** Encrypts a message so only the subscribed device can read it (aes128gcm). */
export function encryptPush(payload: Buffer, subscription: PushSubscriptionInfo): Buffer {
  const userPublic = fromB64u(subscription.keys.p256dh);
  const authSecret = fromB64u(subscription.keys.auth);
  if (userPublic.length !== 65 || authSecret.length < 16) throw new Error("Bad push subscription keys");

  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const serverPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(userPublic);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), userPublic, serverPublic]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(4096);
  return Buffer.concat([salt, size, Buffer.from([serverPublic.length]), serverPublic, body]);
}

export async function sendWebPush(subscription: PushSubscriptionInfo, message: PushMessage, keys: VapidKeys, fetchImpl: typeof fetch = fetch): Promise<PushResult> {
  const payload = Buffer.from(JSON.stringify(message).slice(0, 3000));
  const response = await fetchImpl(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuthorization(subscription.endpoint, keys),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body: new Uint8Array(encryptPush(payload, subscription)),
    signal: AbortSignal.timeout(15_000),
  });
  // 404 / 410: the device turned notifications off or removed the app, so forget it.
  return { ok: response.ok, status: response.status, gone: response.status === 404 || response.status === 410 };
}
