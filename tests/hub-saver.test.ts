// How the Teacher Hub page saves: one save at a time, retries on its own, and never loses
// what was typed. Run with: npx tsx --test tests/hub-saver.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { HubSaver, type SaveRequest, type SaveResponse, type SaveView } from "../client/src/lib/hubSaver";

type W = { n: number; text?: string };

function setup(first: W = { n: 0 }, updatedAt: string | null = "t0") {
  let now = 0;
  const timers: Array<{ id: number; at: number; run: () => void }> = [];
  let nextId = 1;
  const views: SaveView[] = [];
  const sent: Array<{ request: SaveRequest<W>; keepalive: boolean }> = [];
  const queue: Array<(r: SaveResponse) => void> = [];
  let auto: ((request: SaveRequest<W>) => SaveResponse | "network") | null = null;
  let saves = 0;
  const saver = new HubSaver<W>({
    put: (request, options) => {
      sent.push({ request, keepalive: options.keepalive });
      if (auto) {
        const answer = auto(request);
        if (answer === "network") return Promise.reject(new TypeError("Failed to fetch"));
        return Promise.resolve(answer);
      }
      return new Promise<SaveResponse>((resolve) => queue.push(resolve));
    },
    onView: (view) => views.push(view),
    onSaved: () => { saves++; },
    setTimer: (run, ms) => { const id = nextId++; timers.push({ id, at: now + ms, run }); return id; },
    clearTimer: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
  }, { workspace: first, updatedAt });
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const advance = async (ms: number) => {
    now += ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers.splice(timers.indexOf(due), 1);
      due.run();
      await settle();
    }
    await settle();
  };
  const answer = async (reply: SaveResponse) => { const resolve = queue.shift(); assert.ok(resolve, "a save was waiting for an answer"); resolve!(reply); await settle(); };
  const ok = (updatedAt: string): SaveResponse => ({ status: 200, body: { success: true, updatedAt } });
  const last = () => views[views.length - 1];
  return { saver, views, sent, advance, answer, ok, last, settle, setAuto: (fn: typeof auto) => { auto = fn; }, timers: () => timers.length, saves: () => saves };
}

test("typing waits for a pause, then one save goes out that names the copy it started from", async () => {
  const t = setup();
  t.saver.change({ n: 1 });
  await t.advance(300);
  t.saver.change({ n: 2 });
  await t.advance(600);
  assert.equal(t.sent.length, 0, "still typing");
  await t.advance(200);
  assert.equal(t.sent.length, 1);
  assert.deepEqual(t.sent[0].request, { workspace: { n: 2 }, baseUpdatedAt: "t0" });
  assert.equal(t.last().kind, "saving");
  await t.answer(t.ok("t1"));
  assert.equal(t.last().kind, "saved");
  t.saver.change({ n: 3 });
  await t.advance(800);
  assert.equal(t.sent[1].request.baseUpdatedAt, "t1", "the next save starts from the copy the last one made");
});

test("only one save is ever on its way; what is typed meanwhile goes right after", async () => {
  const t = setup();
  t.saver.change({ n: 1 });
  await t.advance(800);
  assert.equal(t.sent.length, 1);
  t.saver.change({ n: 2 });
  await t.advance(800);
  assert.equal(t.sent.length, 1, "the first save has not come back yet");
  await t.answer(t.ok("t1"));
  assert.equal(t.last().kind, "waiting", "the later change is still waiting to go");
  await t.advance(800);
  assert.equal(t.sent.length, 2);
  assert.deepEqual(t.sent[1].request, { workspace: { n: 2 }, baseUpdatedAt: "t1" });
  await t.answer(t.ok("t2"));
  assert.equal(t.last().kind, "saved");
});

test("a change that leaves everything as it was sends nothing", async () => {
  const same = { n: 5 };
  const t = setup(same);
  t.saver.change(same);
  t.saver.change({ n: 5 });
  await t.advance(2000);
  assert.equal(t.sent.length, 0);
  assert.equal(t.last().kind, "saved");
  assert.equal(t.saver.hasUnsaved(), false);
});

test("with no connection it says so, keeps the work, and tries again by itself", async () => {
  const t = setup();
  t.setAuto(() => "network");
  t.saver.change({ n: 1 });
  await t.advance(800);
  assert.equal(t.last().kind, "retrying");
  assert.equal(t.saver.hasUnsaved(), true);
  assert.equal(t.sent.length, 1);
  await t.advance(2000);
  assert.equal(t.sent.length, 2, "again after 2 seconds");
  await t.advance(5000);
  assert.equal(t.sent.length, 3, "then after 5 more");
  t.setAuto(() => t.ok("t9"));
  await t.advance(15000);
  assert.equal(t.sent.length, 4);
  assert.equal(t.last().kind, "saved");
  assert.equal(t.saver.hasUnsaved(), false);
});

test("a server problem or a strange answer is not 'saved'", async () => {
  const t = setup();
  t.setAuto(() => ({ status: 500, body: { message: "boom" } }));
  t.saver.change({ n: 1 });
  await t.advance(800);
  assert.equal(t.last().kind, "retrying");
  t.setAuto(() => ({ status: 200, body: {} }));
  await t.advance(2000);
  assert.equal(t.last().kind, "retrying", "a 200 without 'success' is not a save");
  t.setAuto(() => ({ status: 200, body: "<html>proxy page</html>" as any }));
  await t.advance(5000);
  assert.equal(t.last().kind, "retrying");
  assert.equal(t.saves(), 0);
});

test("a retry button tries right away", async () => {
  const t = setup();
  t.setAuto(() => "network");
  t.saver.change({ n: 1 });
  await t.advance(800);
  t.setAuto(() => t.ok("t1"));
  t.saver.retryNow();
  await t.settle();
  assert.equal(t.last().kind, "saved");
  assert.equal(t.timers(), 0, "no retry left waiting");
});

test("a copy changed on another device stops the save and asks, and nothing newer is written over", async () => {
  const t = setup();
  t.setAuto(() => ({ status: 409, body: { code: "hub_conflict", updatedAt: "t7", message: "x" } }));
  t.saver.change({ n: 1 });
  await t.advance(800);
  const view: any = t.last();
  assert.equal(view.kind, "blocked");
  assert.equal(view.block, "conflict");
  assert.equal(view.serverUpdatedAt, "t7");
  // More typing does not go out while the question is open.
  t.saver.change({ n: 2 });
  await t.advance(3000);
  assert.equal(t.sent.length, 1);
  assert.equal((t.last() as any).block, "conflict");
  // "Keep mine": goes out as an overwrite with the newest typing.
  t.setAuto(() => t.ok("t8"));
  t.saver.keepMine();
  await t.settle();
  assert.equal(t.sent.length, 2);
  assert.deepEqual(t.sent[1].request, { workspace: { n: 2 }, baseUpdatedAt: "t0", overwrite: true });
  assert.equal(t.last().kind, "saved");
  // And a normal save after it names the new copy and no longer overwrites.
  t.saver.change({ n: 3 });
  await t.advance(800);
  assert.deepEqual(t.sent[2].request, { workspace: { n: 3 }, baseUpdatedAt: "t8" });
});

test("choosing the newer copy replaces this page's and starts clean", async () => {
  const t = setup();
  t.setAuto(() => ({ status: 409, body: { code: "hub_conflict", updatedAt: "t7" } }));
  t.saver.change({ n: 1 });
  await t.advance(800);
  t.saver.rebase({ n: 99 }, "t7");
  assert.equal(t.last().kind, "saved");
  assert.equal(t.saver.hasUnsaved(), false);
  t.setAuto(() => t.ok("t8"));
  t.saver.change({ n: 100 });
  await t.advance(800);
  assert.deepEqual(t.sent[1].request, { workspace: { n: 100 }, baseUpdatedAt: "t7" });
});

test("a full Hub says so, and the next edit (a delete, say) tries again", async () => {
  const t = setup();
  t.setAuto(() => ({ status: 413, body: { code: "hub_too_large" } }));
  t.saver.change({ n: 1, text: "x".repeat(50) });
  await t.advance(800);
  assert.equal((t.last() as any).block, "too_large");
  t.setAuto(() => t.ok("t1"));
  t.saver.change({ n: 1 });
  await t.advance(800);
  assert.equal(t.last().kind, "saved");
});

test("a full caseload, an ended plan and a sign-out each stop with their own reason", async () => {
  for (const [reply, block] of [
    [{ status: 409, body: { code: "hub_seats_full", message: "Plan covers 100." } }, "seats_full"],
    [{ status: 402, body: { code: "hub_required" } }, "plan"],
    [{ status: 401, body: {} }, "signed_out"],
    [{ status: 403, body: {} }, "signed_out"],
    [{ status: 400, body: { message: "Workspace must be an object." } }, "rejected"],
  ] as const) {
    const t = setup();
    t.setAuto(() => reply as any);
    t.saver.change({ n: 1 });
    await t.advance(800);
    assert.equal((t.last() as any).block, block, block);
  }
  const t = setup();
  t.setAuto(() => ({ status: 409, body: { code: "hub_seats_full", message: "Plan covers 100." } }));
  t.saver.change({ n: 1 });
  await t.advance(800);
  assert.equal((t.last() as any).message, "Plan covers 100.");
});

test("a signed-out page keeps waiting instead of sending the same thing again and again", async () => {
  const t = setup();
  t.setAuto(() => ({ status: 401, body: {} }));
  t.saver.change({ n: 1 });
  await t.advance(800);
  t.saver.change({ n: 2 });
  await t.advance(10_000);
  assert.equal(t.sent.length, 1);
});

test("leaving the page saves what is waiting right away, without waiting for the pause", async () => {
  const t = setup();
  t.saver.change({ n: 1 });
  const done = t.saver.flush();
  await t.settle();
  assert.equal(t.sent.length, 1);
  assert.equal(t.sent[0].keepalive, true, "a save sent while the page closes is allowed to finish");
  await t.answer(t.ok("t1"));
  await done;
  assert.equal(t.saver.hasUnsaved(), false);
});

test("leaving while a save is already on its way sends the rest after it", async () => {
  const t = setup();
  t.saver.change({ n: 1 });
  await t.advance(800);
  t.saver.change({ n: 2 });
  const done = t.saver.flush();
  await t.settle();
  assert.equal(t.sent.length, 1, "waits for the first to land");
  await t.answer(t.ok("t1"));
  assert.equal(t.sent.length, 2);
  assert.deepEqual(t.sent[1].request, { workspace: { n: 2 }, baseUpdatedAt: "t1" });
  await t.answer(t.ok("t2"));
  await done;
  assert.equal(t.saver.hasUnsaved(), false);
});

test("a page that is finished with does nothing more", async () => {
  const t = setup();
  t.saver.change({ n: 1 });
  const finishing = t.saver.finish();
  await t.settle();
  await t.answer(t.ok("t1"));
  await finishing;
  const before = t.views.length;
  t.saver.change({ n: 2 });
  await t.advance(5000);
  assert.equal(t.sent.length, 1);
  assert.equal(t.views.length, before);
});
