// Video form checks (November 2026). Run with: npx tsx --test tests/trainer-form-check.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryCoachStore, registerCoachRoutes } from "../server/coach";
import { createMemoryKv } from "../server/fitKv";
import { emptyFit } from "../shared/fit";
import { cleanFeedback, filePathOk, markAt } from "../shared/coachFormCheck";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("feedback is cleaned: points kept in the frame, junk paths refused, marks in time order", () => {
  const fb = cleanFeedback({ text: " Knees out ", rating: "fix", voice: "../../etc/passwd", marks: [
    { t: 9, text: "Depth", strokes: [] },
    { t: 2.345, strokes: [{ color: "#ff3b30", pts: [[0.1, 0.2], [1.7, -3], ["x", 0.5]] }, { color: "purple", pts: [[0.5, 0.5]] }] },
    { t: 4, strokes: [], text: "" },
  ] }, "link-1", "2026-11-08T00:00:00Z", 10);
  assert.equal(fb.text, "Knees out"); assert.equal(fb.rating, "fix"); assert.equal(fb.voice, "");
  assert.deepEqual(fb.marks.map((m) => m.t), [2.35, 9], "the empty mark is dropped, the rest sorted");
  assert.deepEqual(fb.marks[0].strokes, [{ color: "#ff3b30", pts: [[0.1, 0.2], [1, 0], [0, 0.5]] }]);
  assert.ok(filePathOk("link-1/voice-abc-12.m4a", "link-1"));
  assert.ok(!filePathOk("link-2/voice-abc.m4a", "link-1"), "another client's file");
  assert.ok(!filePathOk("link-1/../x.m4a", "link-1"));
  assert.equal(markAt(fb.marks, 3)?.t, 2.35); assert.equal(markAt(fb.marks, 6), null); assert.equal(markAt(fb.marks, 9.1)?.text, "Depth");
});

test("a client sends a video; the trainer draws on it and replies; nobody else can see it", async () => {
  const store = createMemoryCoachStore(); const sent: any[] = []; const removed: string[] = [];
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
  registerCoachRoutes(app, (_q: any, _r: any, next: any) => next(), { store, kv: createMemoryKv(), fitData: async () => emptyFit(), nameOf: async (id) => ({ 101: "Vanessa" } as any)[id] ?? "X", notify: async (u, m) => { sent.push([u, m.title]); }, inviteSecret: "t",
    files: { uploadUrl: async (p) => `https://store.test/up/${p}`, viewUrls: async (ps) => Object.fromEntries(ps.map((p) => [p, `https://store.test/see/${p}`])), remove: async (ps) => { removed.push(...ps); } } });
  await call("PUT", "/api/coach/trainer/profile", 7, { profile: { name: "Coach Mike" } });
  const inv = (await call("GET", "/api/coach/trainer/invite", 7)).body;
  await call("POST", `/api/coach/invite/${inv.code}/join`, 101, { consent: {} });
  const link = (await call("GET", "/api/coach/trainer", 7)).body.clients[0].id;

  // Client: upload link for a video only; trainer: for a voice note only.
  assert.equal((await call("POST", `/api/coach/links/${link}/form-checks/upload`, 101, { type: "audio/mp4", size: 1000 })).status, 400);
  assert.equal((await call("POST", `/api/coach/links/${link}/form-checks/upload`, 101, { type: "video/mp4", size: 200 * 1024 * 1024 })).status, 400, "too big");
  const up = (await call("POST", `/api/coach/links/${link}/form-checks/upload`, 101, { type: "video/quicktime", size: 5_000_000 })).body;
  assert.match(up.path, new RegExp(`^${link}/video-[a-z0-9-]+\\.mov$`)); assert.match(up.url, /^https:\/\/store\.test\/up\//);
  assert.equal((await call("POST", `/api/coach/links/${link}/form-checks/upload`, 555, { type: "video/mp4", size: 10 })).status, 404, "strangers get nothing");
  // A made-up path is refused.
  assert.equal((await call("POST", `/api/coach/links/${link}/form-checks`, 101, { video: "other/video-x.mp4" })).status, 400);
  const fc = (await call("POST", `/api/coach/links/${link}/form-checks`, 101, { video: up.path, exName: "Back squat", note: "Knee felt odd", secs: 14.2 })).body.check;
  assert.equal(fc.status, "new"); assert.deepEqual(sent.at(-1), [7, "Form check"]);
  const tl = (await call("GET", `/api/coach/links/${link}/form-checks`, 7)).body.checks;
  assert.equal(tl[0].videoUrl, `https://store.test/see/${up.path}`);
  assert.equal((await call("GET", `/api/coach/links/${link}/form-checks`, 555)).status, 404);

  // Trainer: voice note upload, then feedback with drawings.
  assert.equal((await call("POST", `/api/coach/links/${link}/form-checks/upload`, 7, { type: "video/mp4", size: 10 })).status, 400, "trainers upload voice notes, not videos");
  const vu = (await call("POST", `/api/coach/links/${link}/form-checks/upload`, 7, { type: "audio/mp4", size: 40_000 })).body;
  assert.equal((await call("POST", `/api/coach/links/${link}/form-checks/${fc.id}/feedback`, 101, { feedback: { text: "self review" } })).status, 404, "clients can't review");
  assert.equal((await call("POST", `/api/coach/links/${link}/form-checks/${fc.id}/feedback`, 7, { feedback: {} })).status, 400);
  const fb = (await call("POST", `/api/coach/links/${link}/form-checks/${fc.id}/feedback`, 7, { feedback: { text: "Push knees out", rating: "fix", voice: vu.path, marks: [{ t: 3.2, text: "Knees caving here", strokes: [{ color: "#ffcc00", pts: [[0.4, 0.6], [0.45, 0.7]] }] }] } })).body.check;
  assert.equal(fb.status, "reviewed"); assert.equal(fb.feedback.voice, vu.path); assert.equal(fb.feedback.marks.length, 1);
  assert.deepEqual(sent.at(-1), [101, "Your trainer reviewed your form"]);
  const cl = (await call("GET", `/api/coach/links/${link}/form-checks`, 101)).body.checks[0];
  assert.equal(cl.voiceUrl, `https://store.test/see/${vu.path}`);
  // Redoing the voice note removes the old file.
  const vu2 = (await call("POST", `/api/coach/links/${link}/form-checks/upload`, 7, { type: "audio/webm", size: 40_000 })).body;
  await call("POST", `/api/coach/links/${link}/form-checks/${fc.id}/feedback`, 7, { feedback: { text: "Better", voice: vu2.path } });
  assert.ok(removed.includes(vu.path));
  // The client deletes it: the files go too.
  await call("PUT", `/api/coach/links/${link}/form-checks/${fc.id}`, 101, { remove: true });
  assert.ok(removed.includes(up.path) && removed.includes(vu2.path));
  assert.equal((await call("GET", `/api/coach/links/${link}/form-checks`, 7)).body.checks.length, 0);
});

test("form checks are in both apps, with permission text for camera and microphone", () => {
  assert.match(read("client/src/pages/fit/FitCoach.tsx"), /<ClientFormChecks token=\{token\} linkId=\{link\.id\}/);
  assert.match(read("client/src/pages/trainer/TrainerClient.tsx"), /<TrainerFormChecks token=\{token\} linkId=\{linkId\}/);
  const ui = read("client/src/pages/coach/FormCheck.tsx");
  for (const t of ["fc-record", "fc-send", "fc-draw", "fc-keep", "fc-voice-rec", "fc-send-feedback", 'capture="environment"']) assert.ok(ui.includes(t), t);
  const plist = read(".github/scripts/configure_fit_app.py");
  assert.match(plist, /Arise Fit uses the microphone for the sound of a video/);
  assert.match(plist, /Arise Trainer uses the microphone only when you record a voice note/);
  assert.doesNotMatch(plist, /Form check video stays on your iPhone/);
});
