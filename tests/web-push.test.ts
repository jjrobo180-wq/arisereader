import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { encryptPush, generateVapidKeys, sendWebPush, vapidAuthorization } from "../server/webPush";
import { dueHubReminders, localParts } from "../shared/hubReminders";
import { emptyWorkspace } from "../shared/teacherHub";

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

function phone() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ecdh, auth, subscription: { endpoint: "https://web.push.apple.com/abc123", keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } } };
}

/** What a phone does with an incoming push message (RFC 8291). */
function decrypt(body: Buffer, device: ReturnType<typeof phone>) {
  const salt = body.subarray(0, 16);
  assert.equal(body.readUInt32BE(16), 4096);
  const idLength = body[20];
  const serverPublic = body.subarray(21, 21 + idLength);
  const cipherText = body.subarray(21 + idLength);
  const shared = device.ecdh.computeSecret(serverPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), device.ecdh.getPublicKey(), serverPublic]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", shared, device.auth, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(cipherText.subarray(cipherText.length - 16));
  const plain = Buffer.concat([decipher.update(cipherText.subarray(0, cipherText.length - 16)), decipher.final()]);
  assert.equal(plain[plain.length - 1], 2);
  return plain.subarray(0, plain.length - 1).toString();
}

test("a push message can be read by the phone it was made for, and only that phone", () => {
  const device = phone();
  const body = encryptPush(Buffer.from('{"title":"Hi"}'), device.subscription);
  assert.equal(decrypt(body, device), '{"title":"Hi"}');
  assert.throws(() => decrypt(body, phone()));
});

test("the VAPID pass is signed with our key and names the push service", () => {
  const keys = { ...generateVapidKeys(), subject: "mailto:support@arisereader.com" };
  assert.equal(fromB64u(keys.publicKey).length, 65);
  const header = vapidAuthorization("https://web.push.apple.com/abc123?x=1", keys, 1_800_000_000_000);
  const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header)!;
  assert.ok(match);
  assert.equal(match[4], keys.publicKey);
  const claims = JSON.parse(fromB64u(match[2]).toString());
  assert.equal(claims.aud, "https://web.push.apple.com");
  assert.equal(claims.sub, "mailto:support@arisereader.com");
  assert.equal(claims.exp, 1_800_000_000 + 12 * 3600);
  const pub = fromB64u(keys.publicKey);
  const publicKey = crypto.createPublicKey({ format: "jwk", key: { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) } });
  assert.ok(crypto.verify("sha256", Buffer.from(`${match[1]}.${match[2]}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, fromB64u(match[3])));
});

test("sendWebPush posts the encrypted message and reports a removed phone", async () => {
  const keys = { ...generateVapidKeys(), subject: "mailto:a@b.co" };
  const device = phone();
  let seen: any;
  const ok = await sendWebPush(device.subscription, { title: "T", body: "B" }, keys, (async (url: any, init: any) => { seen = { url, init }; return new Response(null, { status: 201 }); }) as any);
  assert.deepEqual(ok, { ok: true, status: 201, gone: false });
  assert.equal(seen.init.headers["Content-Encoding"], "aes128gcm");
  assert.equal(JSON.parse(decrypt(Buffer.from(seen.init.body), device)).title, "T");
  const gone = await sendWebPush(device.subscription, { title: "T", body: "B" }, keys, (async () => new Response(null, { status: 410 })) as any);
  assert.equal(gone.gone, true);
  assert.throws(() => encryptPush(Buffer.from("x"), { endpoint: "https://x.y", keys: { p256dh: "abc", auth: "abc" } }));
});

const at = (iso: string) => Date.parse(iso);

test("local time follows the teacher's time zone", () => {
  assert.deepEqual(localParts(at("2026-10-06T14:05:00Z"), "America/Denver"), { date: "2026-10-06", minutes: 8 * 60 + 5 });
  assert.deepEqual(localParts(at("2026-10-06T03:30:00Z"), "America/Denver"), { date: "2026-10-05", minutes: 21 * 60 + 30 });
  assert.equal(localParts(at("2026-10-06T14:05:00Z"), "Not/AZone").date, "2026-10-06");
});

function workspace() {
  const ws = emptyWorkspace();
  ws.events = [
    { id: "e1", title: "IEP meeting", date: "2026-10-06", start: "09:00", end: "10:00", location: "Room 4", notes: "" },
    { id: "e2", title: "Field day", date: "2026-10-06", start: "", end: "", location: "", notes: "" },
    { id: "e3", title: "Tomorrow", date: "2026-10-07", start: "09:00", end: "", location: "", notes: "" },
  ];
  ws.meetings = [{ id: "m1", student: "Sam", type: "IEP", date: "2026-10-06", notes: "", done: false }];
  ws.tasks = [
    { id: "t1", title: "Grade", dueDate: "2026-10-06", recurring: "", done: false },
    { id: "t2", title: "Old", dueDate: "2026-10-01", recurring: "", done: false },
    { id: "t3", title: "Finished", dueDate: "2026-10-06", recurring: "", done: true },
  ];
  return ws;
}

test("morning summary: once a day, only in the morning, only when there is something", () => {
  const zone = "America/Denver";
  const [morning] = dueHubReminders(workspace(), at("2026-10-06T14:00:00Z"), zone); // 8:00 am there
  assert.equal(morning.key, "morning:2026-10-06");
  assert.equal(morning.title, "Today in your Teacher Hub");
  assert.match(morning.body, /2 events, 1 meeting, 2 tasks \(1 overdue\)\. First up: IEP meeting at 9:00 AM\./);
  assert.deepEqual(dueHubReminders(workspace(), at("2026-10-06T14:00:00Z"), zone, { [morning.key]: 1 }), []);
  assert.deepEqual(dueHubReminders(workspace(), at("2026-10-06T10:00:00Z"), zone), []); // 4 am
  assert.deepEqual(dueHubReminders(workspace(), at("2026-10-06T19:00:00Z"), zone), []); // 1 pm
  assert.deepEqual(dueHubReminders(emptyWorkspace(), at("2026-10-06T14:00:00Z"), zone), []);
});

test("an event with a start time gets a heads-up 15 minutes before, once", () => {
  const zone = "America/Denver";
  const sent = { "morning:2026-10-06": 1 };
  assert.deepEqual(dueHubReminders(workspace(), at("2026-10-06T15:40:00Z"), zone, sent), []); // 9:40 am: the event already started
  const early = dueHubReminders(workspace(), at("2026-10-06T14:30:00Z"), zone, sent); // 8:30, 30 min before
  assert.deepEqual(early, []);
  const soon = dueHubReminders(workspace(), at("2026-10-06T14:50:00Z"), zone, sent); // 8:50
  assert.equal(soon.length, 1);
  assert.equal(soon[0].title, "IEP meeting");
  assert.equal(soon[0].body, "Starts at 9:00 AM · Room 4");
  assert.deepEqual(dueHubReminders(workspace(), at("2026-10-06T14:50:00Z"), zone, { ...sent, [soon[0].key]: 1 }), []);
});
