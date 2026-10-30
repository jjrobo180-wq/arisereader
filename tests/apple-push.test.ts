import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { appleJwt, applePayload, cleanAppleToken, hasApplePush, isAppleDevice } from "../server/applePush";

test("apple push: tokens, payload and the signed sign-in token", () => {
  assert.equal(cleanAppleToken("AB".repeat(32)), "ab".repeat(32));
  assert.equal(cleanAppleToken("not a token"), null);
  assert.ok(isAppleDevice("apns:abc"));
  assert.ok(!isAppleDevice("https://web.push.apple.com/x"));
  const body = JSON.parse(applePayload({ title: "Hi", body: "There", url: "/arise-todo", tag: "t" }));
  assert.deepEqual(body.aps.alert, { title: "Hi", body: "There" });
  assert.equal(body.url, "/arise-todo");

  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  process.env.APNS_KEY = Buffer.from(privateKey.export({ type: "pkcs8", format: "pem" }) as string).toString("base64");
  process.env.APNS_KEY_ID = "ABC123DEFG";
  process.env.APPLE_TEAM_ID = "6TYWWNKX6P";
  assert.ok(hasApplePush());
  const jwt = appleJwt(Date.now());
  const [h, b, s] = jwt.split(".");
  assert.equal(JSON.parse(Buffer.from(h, "base64url").toString()).kid, "ABC123DEFG");
  assert.equal(JSON.parse(Buffer.from(b, "base64url").toString()).iss, "6TYWWNKX6P");
  assert.ok(crypto.verify("sha256", Buffer.from(`${h}.${b}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url")));
});
