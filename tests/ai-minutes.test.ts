// One monthly pool of AI minutes per account, shared by Arise Notes and Pod+'s AI (server/aiMinutes.ts):
// Free has every Notes tool and 60 minutes; Pod+'s audiobook, podcast-maker and wiki AI spend the same minutes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerAriseNotesRoutes } from "../server/ariseNotes";
import { createMemoryNotesStore } from "../server/ariseNotesStore";
import { configureAiMinutes, haveAiMinutes, spendAi } from "../server/aiMinutes";
import { NOTES_PLANS, allows } from "../shared/ariseNotes";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const noop = () => {};
const fakeApp: any = new Proxy({}, { get: () => noop });
const reply = () => { const r: any = { code: 200, body: null, status(c: number) { r.code = c; return r; }, json(b: any) { r.body = b; return r; } }; return r; };

function notes(plan: "free" | "plus" = "free") {
  const store = createMemoryNotesStore(() => NOW);
  const users: Record<number, any> = { 7: { id: 7, role: "todo", displayName: "Pat" } };
  const minutes = registerAriseNotesRoutes(fakeApp, noop as any, {
    store, hear: { hear: async () => ({ lines: [], duration: 0, provider: "t", diarized: false }), available: () => true, speakersAvailable: () => false } as any,
    ask: async () => ({ json: {}, chars: 0 }), aiReady: () => true,
    planOf: async () => plan, getUser: async (id) => users[id] ?? null, now: () => NOW,
  });
  return { store, minutes };
}

test("free Notes has every tool and 60 minutes; only rollover is extra", () => {
  assert.equal(NOTES_PLANS.free.minutes, 60);
  for (const f of ["export", "templates", "share", "speakers", "iep", "study", "parent"] as const) assert.equal(allows("free", f as any), true, f);
  assert.equal(allows("free", "rollover"), false);
  assert.equal(NOTES_PLANS.free.maxSecs, 2 * 3600);
});

test("Pod+ AI spends the same 60 minutes as Notes, then stops with an All Access message", async () => {
  const { minutes } = notes("free");
  assert.equal(await minutes.left(7), 60);
  await minutes.spend(7, 10, "pod-audiobook-transcript");
  assert.equal(await minutes.left(7), 50, "a 10-minute transcript comes off the Notes minutes");
  configureAiMinutes({ accountOf: async (req) => req.acct ?? null, left: (id) => minutes.left(id), spend: (id, m, k) => minutes.spend(id, m, k) });
  try {
    // Signed out: sign in first.
    const r0 = reply();
    assert.equal(await haveAiMinutes({}, r0), false);
    assert.equal(r0.code, 401);
    assert.equal(r0.body.needSignIn, true);
    // Signed in with minutes: allowed, then counted.
    const req: any = { acct: 7 };
    assert.equal(await haveAiMinutes(req, reply()), true);
    await spendAi(req, 50, "pod-maker-episode");
    assert.equal(await minutes.left(7), 0);
    // Used up: 402 and the All Access note.
    const r2 = reply();
    assert.equal(await haveAiMinutes({ acct: 7 }, r2), false);
    assert.equal(r2.code, 402);
    assert.match(r2.body.message, /shared by Arise Notes and Pod\+.*All Access gives you 1,500/);
  } finally { configureAiMinutes(null); }
});

test("All Access (Notes Plus) has one 1,500-minute pool for both", async () => {
  const { minutes } = notes("plus");
  assert.equal(await minutes.left(7), 1500);
  await minutes.spend(7, 6, "pod-wiki");
  assert.equal(await minutes.left(7), 1494);
});

test("not set up (tests, a local server): nothing is counted or blocked", async () => {
  configureAiMinutes(null);
  assert.equal(await haveAiMinutes({}, reply()), true);
});

test("each Pod+ AI tool checks and spends the shared minutes", () => {
  const books = readFileSync("server/audiobooks.ts", "utf8");
  assert.match(books, /pod-audiobook-transcript/);
  assert.match(books, /pod-book-\$\{kind\}/, "catch me up and ask the book");
  assert.match(books, /pod-book-narrator/);
  const maker = readFileSync("server/podcastStudio.ts", "utf8");
  assert.match(maker, /pod-maker-recording/);
  assert.match(maker, /pod-maker-episode/);
  assert.match(readFileSync("server/earshot.ts", "utf8"), /wiki\/section[\s\S]{0,700}haveAiMinutes[\s\S]{0,400}spendAi\(req, Math\.max\(1, Math\.ceil\(chars \/ 900\)\), "pod-wiki"\)/);
  assert.match(readFileSync("podscroll/wikiPlayer.ts", "utf8"), /setWikiMeter/);
  assert.match(readFileSync("server/routes.ts", "utf8"), /configureAiMinutes\(\{/);
});
