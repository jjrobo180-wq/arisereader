// Apple push notifications for the Arise To Duo iPhone app. An App Store app can't receive Web Push,
// so the app registers its Apple device token (saved with the Web Push devices, endpoint
// "apns:<token>") and the server sends to Apple directly over HTTP/2 with a signed token.
//
// Needs, on the server:
//   APNS_KEY      the .p8 key's text (or base64 of it), from developer.apple.com → Keys, "Apple Push Notifications service"
//   APNS_KEY_ID   that key's 10-character id
//   APPLE_TEAM_ID 6TYWWNKX6P
// Optional: APNS_TOPIC (default com.arisereader.arisetodo), APNS_SANDBOX=1 for a debug build.
import crypto from "node:crypto";
import http2 from "node:http2";

export const APNS_PREFIX = "apns:";
export const isAppleDevice = (endpoint: string) => endpoint.startsWith(APNS_PREFIX);
export const appleToken = (endpoint: string) => endpoint.slice(APNS_PREFIX.length);
/** A device token as iOS hands it over: hex, 64 characters or a little more. */
export const cleanAppleToken = (v: unknown): string | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return /^[0-9a-f]{64,200}$/.test(t) ? t : null;
};

function keyText(): string | null {
  const raw = process.env.APNS_KEY?.trim();
  if (!raw) return null;
  if (raw.includes("BEGIN PRIVATE KEY")) return raw.replace(/\\n/g, "\n");
  try { const t = Buffer.from(raw, "base64").toString("utf8"); return t.includes("BEGIN PRIVATE KEY") ? t : null; } catch { return null; }
}
export const hasApplePush = () => !!(keyText() && process.env.APNS_KEY_ID && (process.env.APPLE_TEAM_ID || process.env.APNS_TEAM_ID));

let jwt: { token: string; at: number } | null = null;
/** Apple's sign-in token for sending: made with the key, good for an hour (we remake it every 40 minutes). */
export function appleJwt(now = Date.now()): string {
  if (jwt && now - jwt.at < 40 * 60_000) return jwt.token;
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "ES256", kid: process.env.APNS_KEY_ID });
  const body = b64({ iss: process.env.APPLE_TEAM_ID || process.env.APNS_TEAM_ID, iat: Math.floor(now / 1000) });
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key: keyText()!, dsaEncoding: "ieee-p1363" }).toString("base64url");
  jwt = { token: `${head}.${body}.${sig}`, at: now };
  return jwt.token;
}

let session: http2.ClientHttp2Session | null = null;
function connect(): http2.ClientHttp2Session {
  if (session && !session.closed && !session.destroyed) return session;
  const host = process.env.APNS_SANDBOX === "1" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  session = http2.connect(host);
  session.on("error", () => { session = null; });
  session.on("goaway", () => { session = null; });
  session.unref?.();
  return session;
}

export type AppleMessage = { title: string; body: string; url?: string; tag?: string };
/** The notification Apple shows: title and words, the default sound, and where tapping it goes. */
export const applePayload = (m: AppleMessage) => JSON.stringify({ aps: { alert: { title: String(m.title || "").slice(0, 160), body: String(m.body || "").slice(0, 600) }, sound: "default", ...(m.tag ? { "thread-id": String(m.tag).slice(0, 64) } : {}) }, url: m.url || "/" });

/** Sends to one iPhone. `gone`: Apple says the app was deleted or the token is no good, so forget it. */
export function sendApplePush(token: string, m: AppleMessage): Promise<{ ok: boolean; gone: boolean }> {
  if (!hasApplePush()) return Promise.resolve({ ok: false, gone: false });
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: { ok: boolean; gone: boolean }) => { if (!done) { done = true; resolve(r); } };
    try {
      const req = connect().request({
        ":method": "POST", ":path": `/3/device/${token}`,
        authorization: `bearer ${appleJwt()}`,
        "apns-topic": process.env.APNS_TOPIC || "com.arisereader.arisetodo",
        "apns-push-type": "alert", "apns-priority": "10",
        "content-type": "application/json",
      });
      let status = 0, text = "";
      req.setTimeout(15_000, () => { req.close(); finish({ ok: false, gone: false }); });
      req.on("response", (h) => { status = Number(h[":status"]); });
      req.on("data", (d) => { text += d; });
      req.on("end", () => {
        if (status !== 200) console.warn("[apns]", status, text.slice(0, 160));
        finish({ ok: status === 200, gone: status === 410 || (status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(text)) });
      });
      req.on("error", () => finish({ ok: false, gone: false }));
      req.end(applePayload(m));
    } catch (e: any) {
      console.warn("[apns] send failed", String(e?.message || e).slice(0, 160));
      finish({ ok: false, gone: false });
    }
  });
}
