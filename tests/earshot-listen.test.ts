// Pod+ listening extras: Fit my drive, Hours back, Ask the episode, Catch me up, timed comments.
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { addHoursBack, cleanAskAnswer, cleanHoursBack, cleanMoment, emptyHoursBack, fitDrive, hoursWords, momentsBetween, parseStamp, sumKinds, transcriptForAi, weekKey } from "../shared/earshotListen";
import { registerListenRoutes } from "../server/podcastListen";
import { memoryEarshotStore } from "../server/earshot";
import { cleanEarshot } from "../shared/earshot";
import { createAttemptLimiter } from "../server/attemptLimiter";

const ep = (id: string, mins: number, left?: number) => ({ id, secs: mins * 60, ...(left ? { left: left * 60 } : {}) });

test("Fit my drive fills the minutes as closely as it can", () => {
  const plan = fitDrive([ep("a", 50), ep("b", 18), ep("c", 12), ep("d", 9)], 30);
  assert.deepEqual(plan.picks.map((p) => p.id), ["b", "c"], "18 + 12 is exactly 30");
  assert.equal(plan.secs, 1800);
  // Faster speed: a 40-minute episode at 2x takes 20 minutes.
  assert.deepEqual(fitDrive([ep("long", 40), ep("x", 7)], 20, 2).picks.map((p) => p.id), ["long"]);
  // Part-heard: only what's left counts.
  assert.deepEqual(fitDrive([ep("started", 60, 14), ep("y", 30)], 15).picks.map((p) => p.id), ["started"]);
  // Nothing fits: no picks rather than a long overshoot.
  assert.equal(fitDrive([ep("huge", 120)], 20).picks.length, 0);
  // A tie keeps the earlier (preferred) episode.
  assert.deepEqual(fitDrive([ep("first", 10), ep("second", 10)], 10).picks.map((p) => p.id), ["first"]);
});

test("Hours back adds up per week and all time, and an undo takes it back", () => {
  const mon = new Date(2026, 9, 26, 9), sun = new Date(2026, 10, 1, 22), nextMon = new Date(2026, 10, 2, 8);
  assert.equal(weekKey(mon), "2026-10-26"); assert.equal(weekKey(sun), "2026-10-26"); assert.equal(weekKey(nextMon), "2026-11-02");
  let h = emptyHoursBack();
  h = addHoursBack(h, "ads", 120, mon); h = addHoursBack(h, "speed", 300, sun); h = addHoursBack(h, "intros", 45, nextMon);
  h = addHoursBack(h, "ads", -30, mon);
  assert.equal(sumKinds(h.weeks["2026-10-26"]), 390);
  assert.equal(sumKinds(h.total), 435);
  assert.deepEqual(cleanHoursBack(JSON.parse(JSON.stringify(h))), h, "survives being saved");
  assert.deepEqual(cleanHoursBack({ total: { ads: -5, speed: "x" }, weeks: { bad: {} } }), emptyHoursBack());
  assert.equal(hoursWords(30), "under a minute"); assert.equal(hoursWords(45 * 60), "45 min"); assert.equal(hoursWords(135 * 60), "2h 15m");
});

test("settings: the new switches default sensibly and survive saving", () => {
  const d = cleanEarshot({});
  assert.deepEqual([d.settings.voiceBoost, d.settings.hoursBack, d.settings.liveComments], [false, true, true]);
  const s = cleanEarshot({ settings: { voiceBoost: true, hoursBack: false, liveComments: false } });
  assert.deepEqual([s.settings.voiceBoost, s.settings.hoursBack, s.settings.liveComments], [true, false, false]);
});

const segs = [
  { s: 0, e: 8, t: "Welcome to the show." }, { s: 8, e: 15, t: "Today we talk bread." },
  { s: 300, e: 310, t: "The secret is a long, cold rise." }, { s: 900, e: 910, t: "Our guest recommends a Dutch oven." },
];

test("Ask: the transcript is timed, and answers only keep real moments", () => {
  const text = transcriptForAi(segs);
  assert.match(text, /^\[0:00\] Welcome to the show\. Today we talk bread\./);
  assert.match(text, /\[15:00\] Our guest recommends a Dutch oven\./);
  assert.equal(transcriptForAi(segs, 1000, 400).includes("Dutch oven"), false, "stops where they stopped listening");
  assert.equal(parseStamp("1:02:03"), 3723); assert.equal(parseStamp("5:01"), 301); assert.equal(parseStamp("soon"), null);
  const a = cleanAskAnswer({ answer: " A long cold rise. ", moments: [{ t: "5:02", label: "The secret" }, { t: "5:05", label: "dupe" }, { t: "40:00", label: "made up" }, { t: "x" }] }, segs, 910);
  assert.equal(a.answer, "A long cold rise.");
  assert.deepEqual(a.moments, [{ t: 300, label: "The secret" }], "snapped to the line, near-duplicates and invented times dropped");
  assert.equal(cleanAskAnswer(null, segs, 910).found, false);
});

test("timed comments: a moment is whole seconds, and only pops up while listening through it", () => {
  assert.equal(cleanMoment(83.7), 83); assert.equal(cleanMoment("12"), 12);
  assert.equal(cleanMoment(-1), null); assert.equal(cleanMoment(""), null); assert.equal(cleanMoment(99999), null);
  const list = [{ id: "1", t: 10 }, { id: "2", t: null }, { id: "3", t: 11 }];
  assert.deepEqual(momentsBetween(list, 9.8, 10.1).map((c) => c.id), ["1"]);
  assert.deepEqual(momentsBetween(list, 5, 60), [], "a jump isn't listening");
});

test("the comment store keeps a comment's moment", async () => {
  const store = memoryEarshotStore();
  const c = await store.addComment({ episodeId: "9", showId: "1", userId: "u", author: "A", body: "wow", t: 42 });
  assert.equal(c.t, 42);
  assert.equal((await store.comments("9", "u"))[0].t, 42);
});

async function serve(ask: (system: string, user: string) => Promise<string>, transcript = segs) {
  const app = express(); app.use(express.json());
  const auth = (req: any, _res: any, next: any) => { req.user = { id: 1, role: "todo" }; next(); };
  const dir: any = { loadShow: async () => ({ show: { name: "Bread Talk" }, episodes: [{ id: "22", title: "Sourdough", about: "All about bread" }, { id: "21", title: "Yeast", about: "Earlier one" }] }) };
  const limited = (lim: ReturnType<typeof createAttemptLimiter>, req: any, res: any) => { const k = "u"; if (lim.retryAfter(k) > 0) { res.status(429).json({}); return true; } lim.fail(k); return false; };
  registerListenRoutes(app, auth, { prefix: "/api/earshot", dir, limited, voterOf: () => "u1", ask, aiOn: () => true,
    transcriptOf: async (_s, _e, chunk) => (chunk === 0 ? { source: "publisher", segments: transcript, ads: [], chapters: [], chunk: 0, chunkSecs: 1000, more: false } : null) });
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const post = (path: string, body: unknown) => fetch(`http://127.0.0.1:${port}/api/earshot/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { server, post };
}

test("POST /ask answers from the transcript with moments to jump to", async () => {
  let sent = "";
  const { server, post } = await serve(async (_sys, user) => { sent = user; return JSON.stringify({ answer: "A Dutch oven.", moments: [{ t: "15:00", label: "The recommendation" }], found: true }); });
  try {
    const r = await post("ask", { showId: "1", episodeId: "22", q: "What did the guest recommend?" });
    assert.equal(r.status, 200);
    const b: any = await r.json();
    assert.equal(b.answer, "A Dutch oven."); assert.deepEqual(b.moments, [{ t: 900, label: "The recommendation" }]);
    assert.match(sent, /Episode: Sourdough/); assert.match(sent, /\[15:00\] Our guest recommends/);
    assert.equal((await post("ask", { showId: "1", episodeId: "22", q: "?" })).status, 400);
  } finally { server.close(); }
});

test("POST /catchup recaps only what was heard, plus earlier episodes", async () => {
  let sent = "";
  const { server, post } = await serve(async (_sys, user) => { sent = user; return JSON.stringify({ recap: "They covered bread basics and the cold rise.", points: ["Cold rise matters"] }); });
  try {
    const r = await post("catchup", { showId: "1", episodeId: "22", upTo: 400, earlier: ["21"] });
    assert.equal(r.status, 200);
    const b: any = await r.json();
    assert.match(b.recap, /cold rise/); assert.deepEqual(b.points, ["Cold rise matters"]);
    assert.match(sent, /long, cold rise/); assert.equal(sent.includes("Dutch oven"), false, "nothing past where they stopped");
    assert.match(sent, /Yeast: Earlier one/);
    assert.equal((await post("catchup", { showId: "1", episodeId: "22", upTo: 10 })).status, 400, "nothing to recap yet");
  } finally { server.close(); }
});
