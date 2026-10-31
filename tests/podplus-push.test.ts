import test from "node:test";
import assert from "node:assert/strict";
import { quietHour, runPodPush, type PodPushRow } from "../server/podPush";

const T = "ab".repeat(32);
function memDb(rows: PodPushRow[]) {
  return { rows, save: async () => {}, forget: async (t: string) => { const i = rows.findIndex((r) => r.token === t); if (i >= 0) rows.splice(i, 1); }, all: async () => rows.map((r) => ({ ...r, seen: { ...r.seen } })), update: async (t: string, p: Partial<PodPushRow>) => { Object.assign(rows.find((r) => r.token === t)!, p); } };
}
const noon = new Date("2026-10-30T18:00:00Z"); // 12:00 in Denver

test("pod+ push: the first look only remembers; a new episode later is sent once", async () => {
  const db = memDb([{ token: T, follows: ["123"], seen: {}, time_zone: "America/Denver", sent_day: "", sent_count: 0 }]);
  let ep = "e1"; const sent: any[] = [];
  const deps = { db, newest: async () => ({ show: "My Show", episodeId: ep, title: "Part 2" }), send: async (_t: string, m: any) => { sent.push(m); return { ok: true, gone: false }; } };
  assert.equal(await runPodPush(deps, noon), 0);
  assert.equal(db.rows[0].seen["123"], "e1");
  ep = "e2";
  assert.equal(await runPodPush(deps, noon), 1);
  assert.equal(sent[0].title, "My Show"); assert.match(sent[0].body, /Part 2/); assert.equal(sent[0].url, "?s=123&e=e2");
  assert.equal(await runPodPush(deps, noon), 0, "not twice");
});

test("pod+ push: waits through the night, at most 4 a day, forgets a gone phone", async () => {
  assert.ok(quietHour(22) && quietHour(3) && !quietHour(8) && !quietHour(20));
  const db = memDb([{ token: T, follows: ["1", "2", "3", "4", "5"], seen: { 1: "a", 2: "a", 3: "a", 4: "a", 5: "a" }, time_zone: "America/Denver", sent_day: "", sent_count: 0 }]);
  const deps = { db, newest: async (id: string) => ({ show: "S" + id, episodeId: "b", title: "t" }), send: async () => ({ ok: true, gone: false }) };
  assert.equal(await runPodPush(deps, new Date("2026-10-31T05:00:00Z")), 0, "11 pm in Denver");
  assert.equal(await runPodPush(deps, noon), 4);
  const gone = memDb([{ token: T, follows: ["1"], seen: { 1: "a" }, time_zone: "UTC", sent_day: "", sent_count: 0 }]);
  await runPodPush({ db: gone, newest: async () => ({ show: "S", episodeId: "b", title: "t" }), send: async () => ({ ok: false, gone: true }) }, noon);
  assert.equal(gone.rows.length, 0);
});

test("pod+ app: welcome, notification question and tour on first launch; pushes go to the Pod+ app", async () => {
  const { readFileSync } = await import("node:fs");
  const r = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const main = r("podscroll/main.tsx");
  assert.match(main, /isNativeApp\(\) && read\(WELCOME_KEY\) !== "1"/, "only in the app, once");
  assert.match(main, /onPush=\{\(\) => startPodPush\(api, followIds, true\)\}/);
  assert.match(main, /syncPodPush\(api, followIds\(\)\)/, "the server keeps the followed shows current");
  const w = r("podscroll/Welcome.tsx");
  assert.match(w, /askApple\("com\.arisereader\.podplus"\)/);
  assert.match(w, /data-testid="pod-welcome-listen"/, "listening never needs an account");
  assert.match(w, /data-testid="pod-notify-later"/);
  assert.match(r("server/podPush.ts"), /PODPLUS_TOPIC = "com\.arisereader\.podplus"/);
  assert.match(r("podscroll/ios-app/package.json"), /@capacitor\/push-notifications/);
  assert.match(r("podscroll/ios-app/configure-ios.py"), /capacitorDidRegisterForRemoteNotifications/);
  assert.match(r(".github/workflows/podplus-testflight.yml"), /APPLE_ID_AUTH PUSH_NOTIFICATIONS/);
});
