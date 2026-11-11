// Moving to Cooked Trainer: import clients and workouts from a CSV, email invites, export everything.
// Run with: npx tsx --test tests/trainer-import.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryCoachStore, registerCoachRoutes } from "../server/coach";
import { createMemoryKv } from "../server/fitKv";
import { emptyFit } from "../shared/fit";
import { importClients, importWorkouts, matchExercise, parseCsv } from "../shared/coachImport";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("CSV parsing handles quotes, commas in names, tabs, semicolons and Windows line ends", () => {
  assert.deepEqual(parseCsv('Name,Note\r\n"Reyes, Maya","said ""hi"""\r\n\r\nSam,x'), [["Name", "Note"], ["Reyes, Maya", 'said "hi"'], ["Sam", "x"]]);
  assert.deepEqual(parseCsv("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv("a;b\n1;2\n"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv("﻿Name\nAna"), [["Name"], ["Ana"]], "Excel's byte-order mark is dropped");
});

test("a Trainerize-style client list imports; bad and duplicate rows are skipped", () => {
  const csv = "First Name,Last Name,Email,Phone,Tags,Status\nVanessa,Cruz,VANESSA@x.com,,online;fat loss,Active\nSam,Lee,,(303) 555-0101,,Active\nNo,Contact,,,,Active\n,,ghost@x.com,,,\nVanessa,Cruz,vanessa@x.com,,,Active";
  const r = importClients(csv);
  assert.deepEqual(r.clients.map((c) => [c.name, c.email, c.phone]), [["Vanessa Cruz", "vanessa@x.com", ""], ["Sam Lee", "", "(303) 555-0101"]]);
  assert.deepEqual(r.clients[0].tags, ["online", "fat loss"]);
  assert.equal(r.skipped, 3);
  assert.match(importClients("Name,Address\nA,B").problem!, /Email or Phone/);
  assert.equal(importClients("Client,E-mail\nAna Diaz,ana@x.com").clients[0].name, "Ana Diaz", "other column names work too");
});

test("exercise names match the catalog, abbreviations included; unknown ones become the coach's own", () => {
  assert.equal(matchExercise("Barbell Bench Press")?.id, "bench-press");
  assert.equal(matchExercise("bench press")?.id, "bench-press");
  assert.equal(matchExercise("Underwater basket weaving"), null);
  const csv = "Workout,Exercise,Sets,Reps,Rest,Notes\nPush A,Bench Press,4,6-8,2 min,Pause first rep\nPush A,Sled push,3,20 m,90,\nPush A,Sled Push,2,20 m,90,\nPull A,Deadlift,3,5 reps,3:00,\n,orphan,1,1,1,";
  const r = importWorkouts(csv, [], (() => { let n = 0; return () => `id${++n}`; })());
  assert.deepEqual(r.workouts.map((w) => [w.name, w.items.length]), [["Push A", 3], ["Pull A", 1]]);
  const bench = r.workouts[0].items[0];
  assert.deepEqual([bench.exId, bench.sets, bench.reps, bench.rest, bench.note], ["bench-press", 4, "6-8", 120, "Pause first rep"]);
  assert.equal(r.exercises.length, 1, "the same unknown exercise is added once");
  assert.equal(r.workouts[0].items[1].exId, r.workouts[0].items[2].exId);
  assert.equal(r.workouts[1].items[0].reps, "5"); assert.equal(r.workouts[1].items[0].rest, 180);
  assert.match(importWorkouts("A,B\n1,2").problem!, /Workout column/);
});

test("import, email invites and export through the routes", async () => {
  const store = createMemoryCoachStore(); const mails: any[] = [];
  const routes = new Map<string, any[]>();
  const add = (m: string) => (path: string, ...h: any[]) => routes.set(`${m} ${path}`, h);
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT") };
  const call = async (m: string, path: string, user: number, body: any = {}) => {
    for (const [k, h] of routes) { const [km, kp] = k.split(" "); if (km !== m) continue; const names: string[] = []; const hit = path.match(new RegExp("^" + kp.replace(/:([a-z]+)/g, (_s, n) => { names.push(n); return "([^/?]+)"; }) + "$")); if (!hit) continue;
      const req: any = { params: Object.fromEntries(names.map((n, i) => [n, hit[i + 1]])), body, query: {}, user: { id: user }, headers: {} };
      let status = 200, out: any; const res: any = { headersSent: false, status(s: number) { status = s; return res; }, json(b: any) { out = b; res.headersSent = true; return res; } };
      for (const fn of h) { let next = false; await fn(req, res, () => { next = true; }); if (!next) break; } return { status, body: out }; }
    throw new Error(`no route ${m} ${path}`);
  };
  registerCoachRoutes(app, (_q: any, _r: any, next: any) => next(), { store, kv: createMemoryKv(), fitData: async () => emptyFit(), nameOf: async () => "X", notify: async () => {}, inviteSecret: "t",
    sendEmail: async (to, subject, html, o) => { mails.push({ to, subject, html, o }); return { sent: true }; } });
  await call("PUT", "/api/coach/trainer/profile", 7, { profile: { name: "Coach <Mike>", email: "mike@gym.com" } });
  const im = (await call("POST", "/api/coach/trainer/import/clients", 7, { csv: "Name,Email,Phone\nVanessa Cruz,v@x.com,\nSam Lee,,3035550101" })).body;
  assert.equal(im.added, 2);
  const again = (await call("POST", "/api/coach/trainer/import/clients", 7, { csv: "Name,Email\nVanessa Cruz,v@x.com" })).body;
  assert.equal(again.added, 0); assert.equal(again.already, 1, "importing twice doesn't duplicate");
  assert.equal((await call("POST", "/api/coach/trainer/import/clients", 7, { csv: "nothing" })).status, 400);
  const leads = (await call("GET", "/api/coach/trainer/leads", 7)).body.leads;
  assert.deepEqual(leads.map((l: any) => l.source), ["import", "import"]);
  // Email invites: only to leads with an email, with the real invite link, and the coach's name escaped.
  const inv = (await call("POST", "/api/coach/trainer/import/invite", 7, { leadIds: leads.map((l: any) => l.id) })).body;
  assert.equal(inv.sent, 1); assert.equal(mails[0].to, "v@x.com");
  assert.match(mails[0].html, /#\/fit\?coach=7-/); assert.match(mails[0].html, /Coach &lt;Mike&gt;/); assert.equal(mails[0].o.replyTo, "mike@gym.com");
  assert.equal(inv.leads.find((l: any) => l.email === "v@x.com").status, "contacted");
  // Workouts: preview, then add to the library.
  const csv = "Workout,Exercise,Sets,Reps\nLegs,Back Squat,5,5\nLegs,Belt squat,3,10";
  const pv = (await call("POST", "/api/coach/trainer/import/workouts", 7, { csv })).body;
  assert.equal(pv.applied, false); assert.equal((await call("GET", "/api/coach/trainer", 7)).body.library.workouts.length, 0);
  const ap = (await call("POST", "/api/coach/trainer/import/workouts", 7, { csv, apply: true })).body;
  assert.equal(ap.library.workouts.length, 1); assert.equal(ap.added, 1);
  const ap2 = (await call("POST", "/api/coach/trainer/import/workouts", 7, { csv, apply: true })).body;
  assert.deepEqual(ap2.library.workouts.map((w: any) => w.name), ["Legs", "Legs (imported)"]);
  assert.equal(ap2.library.exercises.length, 1, "the coach's own exercise is reused, not added twice");
  // Export.
  const ex = (await call("GET", "/api/coach/trainer/export", 7)).body;
  assert.equal(ex.app, "Cooked Trainer"); assert.equal(ex.library.workouts.length, 2); assert.equal(ex.leads.length, 2);
  assert.match(ex.clientsCsv, /^Name,Status,Client since/);
});

test("import and export are in Cooked Trainer", () => {
  const ui = read("client/src/pages/trainer/TrainerMove.tsx");
  for (const t of ["tr-import-clients", "tr-import-workouts", "tr-export", "tr-invite-all"]) assert.ok(ui.includes(t), t);
  assert.match(read("client/src/pages/trainer/TrainerApp.tsx"), /<MoveCard /);
  assert.match(read("server/routes.ts"), /sendEmail: \(to, subject, html, options\) =>/);
});
