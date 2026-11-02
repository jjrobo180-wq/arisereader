// Sign in with Apple (server/appleSignIn.ts): only genuine, unexpired tokens for our apps are trusted.
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { AppleTokenError, appleUsername, verifyAppleToken } from "../server/appleSignIn";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: "jwk" }) as any), kid: "K1", alg: "RS256" };
const keys = async () => [jwk];
const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(claims: Record<string, unknown>, kid = "K1", key = privateKey) {
  const head = b({ alg: "RS256", kid }), body = b(claims);
  return `${head}.${body}.${sign("RSA-SHA256", Buffer.from(`${head}.${body}`), key).toString("base64url")}`;
}
const good = { iss: "https://appleid.apple.com", aud: "com.arisereader.arisetodo", sub: "001.abc", email: "Sam@Example.com", email_verified: "true", exp: Math.floor(Date.now() / 1000) + 600 };

test("a genuine token for the app is trusted", async () => {
  const c = await verifyAppleToken(token(good), ["com.arisereader.arisetodo"], keys);
  assert.deepEqual(c, { sub: "001.abc", aud: "com.arisereader.arisetodo", email: "sam@example.com", emailVerified: true, privateEmail: false });
});

test("wrong app, expired, wrong issuer, unknown key or a forged signature are refused", async () => {
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  for (const [t, why] of [
    [token({ ...good, aud: "com.someone.else" }), "aud"],
    [token({ ...good, exp: Math.floor(Date.now() / 1000) - 3600 }), "exp"],
    [token({ ...good, iss: "https://evil.example" }), "iss"],
    [token(good, "K2"), "kid"],
    [token(good, "K1", other), "signature"],
    ["not.a.token", "junk"],
  ] as const) await assert.rejects(verifyAppleToken(t, ["com.arisereader.arisetodo"], keys), AppleTokenError, why);
});

test("new usernames come from a real email, never a private relay one", async () => {
  const taken = new Set(["sam"]);
  const name = await appleUsername("sam@example.com", false, async (n) => taken.has(n));
  assert.match(name, /^sam\d{4,5}$/);
  assert.equal(await appleUsername("x7f@privaterelay.appleid.com", true, async () => false), "apple");
});
