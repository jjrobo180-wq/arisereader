// Potty Training, shared: what a save added (shared/pro/potty/news.ts), the notification the others get, who
// hears it (server/pottySync.ts), and Accountability to-dos linked to Potty Training (shared/accountability.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { agoWords, cleanData, newPottyEntries, pottyNewsText } from "../shared/pro/potty";
import { makePottyWatcher } from "../server/pottySync";
import { cleanTask } from "../shared/accountability";

const NOW = Date.parse("2026-11-26T20:00:00Z");
const kid = { id: "k1", name: "Ariana" };
const data = (logs: any[]) => ({ v: 2, kids: [kid], cur: "k1", logs });
const pee = { id: "e1", kid: "k1", at: NOW - 60_000, kind: "pee", by: "Sarah" };

test("who logged it is kept", () => {
  assert.equal(cleanData(data([pee])).logs[0].by, "Sarah");
  assert.equal(cleanData(data([{ ...pee, by: "  " }])).logs[0].by, undefined);
});

test("only entries the save added, from the last 12 hours", () => {
  const old = { ...pee, id: "e0", at: NOW - 3_600_000 };
  const stale = { ...pee, id: "e2", at: NOW - 13 * 3_600_000 };
  const drink = { id: "e3", kid: "k1", at: NOW, kind: "drink" };
  const news = newPottyEntries(data([old]), data([old, pee, stale, drink]), NOW);
  assert.deepEqual(news.map((n) => n.id), ["e3", "e1"]);
  assert.equal(news.find((n) => n.id === "e1")!.counts, true);
  assert.equal(news.find((n) => n.id === "e3")!.counts, false);
  assert.equal(news[1].kid, "Ariana");
});

test("the notification says who, what, which child and when", () => {
  const [n] = newPottyEntries(null, data([pee]), NOW);
  assert.deepEqual(pottyNewsText("Sarah", [n], NOW), { title: "💧 Sarah logged: Pee in the potty", body: "Ariana · just now" });
  assert.equal(agoWords(NOW - 15 * 60_000, NOW), "15 min ago");
  assert.equal(agoWords(NOW - 2 * 3_600_000, NOW), "2 hr ago");
});

test("everyone else who shares it hears, and the logger's linked to-dos are checked off", async () => {
  const pushed: [number, string][] = [];
  const checked: [number, string][] = [];
  const watch = makePottyWatcher({
    push: (u, m) => { pushed.push([u, m.title]); },
    nameOf: async (u) => (u === 2 ? "Sarah" : "Jay"),
    sharers: async () => [2, 3],
    checkOff: async (u, what) => { checked.push([u, what]); return 1; },
    now: () => NOW,
  });
  // Sarah (2) logs in Jay's (1) app.
  const r = await watch({ app: "pro-potty", ownerId: 1, editorId: 2, before: data([]), after: data([pee]) });
  assert.deepEqual(r, { told: 2, checked: 1 });
  assert.deepEqual(pushed.map((p) => p[0]).sort(), [1, 3]);
  assert.equal(pushed[0][1], "💧 Sarah logged: Pee in the potty");
  assert.deepEqual(checked, [[2, "Pee in the potty · Ariana"]]);
});

test("nothing new, drinks only, or another app: nobody is told", async () => {
  let n = 0;
  const watch = makePottyWatcher({ push: () => { n++; }, nameOf: async () => "", sharers: async () => [2], checkOff: async () => { n++; return 0; }, now: () => NOW });
  await watch({ app: "pro-potty", ownerId: 1, editorId: 1, before: data([pee]), after: data([pee]) });
  await watch({ app: "pro-potty", ownerId: 1, editorId: 1, before: data([]), after: data([{ id: "d", kid: "k1", at: NOW, kind: "drink" }]) });
  await watch({ app: "pro-notes", ownerId: 1, editorId: 1, before: data([]), after: data([pee]) });
  assert.equal(n, 0);
});

test("an Accountability to-do can be linked to Potty Training, and then needs no photo", () => {
  const t = cleanTask({ title: "Track potty training", assignee: 2, link: "potty", proof: "photo" }, [1, 2])!;
  assert.equal(t.link, "potty");
  assert.equal(t.proof, "none");
  assert.equal(cleanTask({ title: "x", assignee: 2, link: "nope" }, [1, 2])!.link, "");
  assert.equal(cleanTask({ title: "Quiz", assignee: 2, kind: "quiz", link: "potty", quiz: { title: "q", questions: [{ id: "a", prompt: "p", choices: ["a", "b"], answer: "a" }] } }, [1, 2])?.link ?? "", "");
});
