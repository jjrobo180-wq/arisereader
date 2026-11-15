// "@arise" asks in Arise To Duo's tasks: reading the ask and its timing (shared/ariseAsks.ts), making it now or at
// its time and telling the person (server/todoAsks.ts), the Arise tab (components/teacher-hub/AriseAsks.tsx) and
// how they're wired into Tasks.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { askKind, askTaskTitle, askTiming, cleanAsks, parseTaskAsk } from "../shared/ariseAsks";
import { createAsks, readMade } from "../server/todoAsks";

const read = (p: string) => readFileSync(p, "utf8");
const SAT = new Date("2026-11-14T21:00:00"); // a Saturday evening

test("a task starting with @arise is an ask; anything else isn't", () => {
  assert.equal(parseTaskAsk("@arise make a worksheet for Kha"), "make a worksheet for Kha");
  assert.equal(parseTaskAsk("  @Arise: plan dinners"), "plan dinners");
  assert.equal(parseTaskAsk("@ arise quiz on volcanoes"), "quiz on volcanoes");
  assert.equal(parseTaskAsk("@arise"), null);
  assert.equal(parseTaskAsk("@arise hi"), null);
  assert.equal(parseTaskAsk("buy milk"), null);
  assert.equal(parseTaskAsk("email @arise team"), null);
  assert.equal(parseTaskAsk("@arisen something"), null);
});

test("timing: 'by' and plain days are made now and due then; 'before' is due the day before", () => {
  const none = askTiming("make a worksheet for Kha", SAT);
  assert.equal(none.mode, "now"); assert.equal(none.due, ""); assert.equal(none.when, "Made now");
  const by = askTiming("make a worksheet for Kha by Monday", SAT);
  assert.equal(by.mode, "now"); assert.equal(by.due, "2026-11-16"); assert.equal(by.title, "make a worksheet for Kha"); assert.match(by.when, /due Mon, Nov 16/);
  const before = askTiming("make a worksheet for Kha before Monday", SAT);
  assert.equal(before.mode, "now"); assert.equal(before.due, "2026-11-15"); assert.match(before.when, /before Mon, Nov 16/);
  assert.equal(askTiming("grocery list for next week", SAT).due, "2026-11-21");
  assert.equal(askTiming("quiz on volcanoes due 11/20", SAT).mode, "now");
  assert.equal(askTiming("summarize photosynthesis today", SAT).when, "Made now · due today");
});

test("timing: 'on Monday' and set times are made later, at that time or 7 in the morning", () => {
  const on = askTiming("make a worksheet for Kha on Monday", SAT);
  assert.equal(on.mode, "later"); assert.equal(on.due, "2026-11-16");
  assert.equal(on.runAt.getHours(), 7); assert.equal(on.runAt.getDate(), 16);
  assert.equal(on.when, "Made Mon, Nov 16 at 7:00 AM");
  const at = askTiming("lesson plan for fractions Monday at 3pm", SAT);
  assert.equal(at.mode, "later"); assert.equal(at.runAt.getHours(), 15); assert.equal(at.dueTime, "15:00");
  // "by" wins over a time: it's made now so it's ready in time.
  assert.equal(askTiming("report by Monday at 3pm", SAT).mode, "now");
  // A time that has already gone by today is made now.
  assert.equal(askTiming("a story at 8am today", SAT).mode, "now");
});

test("the kind of thing asked for, and the task's name", () => {
  assert.equal(askKind("make a worksheet for Kha"), "worksheet");
  assert.equal(askKind("quiz on volcanoes"), "quiz");
  assert.equal(askKind("email the coach about Saturday"), "email");
  assert.equal(askKind("plan a week of dinners"), "recipe");
  assert.equal(askKind("weekly chore schedule"), "plan");
  assert.equal(askKind("tell me something"), "other");
  assert.equal(askTaskTitle("make a worksheet for Kha"), "Arise: make a worksheet for Kha");
});

test("saved asks are cleaned and capped", () => {
  const asks = cleanAsks([{ id: "abc123", ask: "x".repeat(900), kind: "nope", status: "weird", createdAt: "2026-11-14T00:00:00Z", runAt: "", due: "bad", when: "" }, { id: "BAD ID", ask: "y" }, null]);
  assert.equal(asks.length, 1);
  assert.equal(asks[0].ask.length, 600);
  assert.equal(asks[0].kind, "other");
  assert.equal(asks[0].status, "failed");
  assert.equal(asks[0].due, "");
});

test("only a usable AI answer is kept", () => {
  assert.equal(readMade("not json"), null);
  assert.equal(readMade(JSON.stringify({ title: "x", markdown: "short" })), null);
  const ok = readMade(JSON.stringify({ title: "Kha's Fractions Worksheet", summary: "Ready!", markdown: "# Fractions\n\n1. What is 1/2 + 1/4? ____\n\n## Answer key\n1. 3/4" }));
  assert.equal(ok?.title, "Kha's Fractions Worksheet");
  assert.match(ok!.markdown, /Answer key/);
});

function fakeDeps(aiAnswer: () => Promise<string>) {
  const store = new Map<string, string>();
  const notes: { userId: number; title: string; body: string; url: string }[] = [];
  let clock = Date.parse("2026-11-14T21:00:00Z");
  const prompts: string[] = [];
  const deps = {
    read: async (k: string) => store.get(k) || "",
    write: async (k: string, v: string) => { store.set(k, v); },
    ai: async (system: string, user: string) => { prompts.push(system + "\n" + user); return aiAnswer(); },
    aiReady: () => true,
    notify: async (userId: number, m: { title: string; body: string; url: string }) => { notes.push({ userId, ...m }); },
    now: () => clock,
  };
  return { deps, store, notes, prompts, tick: (ms: number) => { clock += ms; } };
}
const wait = () => new Promise((r) => setTimeout(r, 20));
const GOOD = JSON.stringify({ title: "Fractions Worksheet for Kha", summary: "Kha's worksheet is ready.", markdown: "# Fractions\n\n1. 1/2 + 1/4 = ____\n\n## Answer key\n1. 3/4" });

test("an ask made now: Arise makes it, saves it and sends a notification that opens it", async () => {
  const f = fakeDeps(async () => GOOD);
  const asks = createAsks(f.deps);
  const rec = await asks.start(7, { ask: "make a worksheet for Kha by Monday", taskId: "t1", due: "2026-11-16", when: "Made now · due Mon, Nov 16", people: ["Kha", "Mom<script>"] });
  assert.ok(!("error" in rec));
  assert.equal((rec as any).status, "working");
  await wait();
  const [saved] = await asks.list(7);
  assert.equal(saved.status, "done");
  assert.equal(saved.title, "Fractions Worksheet for Kha");
  assert.equal(saved.taskId, "t1");
  assert.ok(!saved.seen);
  assert.equal(f.notes.length, 1);
  assert.equal(f.notes[0].title, "Arise finished: Fractions Worksheet for Kha");
  assert.equal(f.notes[0].url, `/#/to-do?go=asks&ask=${saved.id}`);
  // The family's names go to Arise, cleaned; the due day too.
  assert.match(f.prompts[0], /People in this family or class: Kha, Momscript/);
  assert.match(f.prompts[0], /It's needed by: 2026-11-16/);
});

test("an ask for later waits for its time, then is made by the once-a-minute pass", async () => {
  const f = fakeDeps(async () => GOOD);
  const asks = createAsks(f.deps);
  const monday7 = new Date(Date.parse("2026-11-16T07:00:00Z")).toISOString();
  const rec: any = await asks.start(7, { ask: "make a worksheet for Kha on Monday", runAt: monday7, due: "2026-11-16", when: "Made Mon, Nov 16 at 7:00 AM" });
  assert.equal(rec.status, "scheduled");
  await wait();
  assert.equal(f.prompts.length, 0);
  assert.equal(await asks.runDue(), 0);
  f.tick(36 * 3600_000);
  assert.equal(await asks.runDue(), 1);
  const [saved] = await asks.list(7);
  assert.equal(saved.status, "done");
  assert.equal(f.notes.length, 1);
  // Made once only.
  assert.equal(await asks.runDue(), 0);
});

test("a time too far ahead or in the past is made now", async () => {
  const f = fakeDeps(async () => GOOD);
  const asks = createAsks(f.deps);
  const rec: any = await asks.start(7, { ask: "plan a party", runAt: "2027-12-01T07:00:00Z" });
  assert.equal(rec.status, "working");
  const rec2: any = await asks.start(7, { ask: "plan a party", runAt: "2020-01-01T07:00:00Z" });
  assert.equal(rec2.status, "working");
  assert.equal(((await asks.start(7, { ask: "x" })) as any).status, 400);
});

test("when the AI fails, the ask says so and the person is told", async () => {
  const f = fakeDeps(async () => { throw new Error("busy"); });
  const asks = createAsks(f.deps);
  await asks.start(9, { ask: "make a worksheet" });
  await wait();
  const [saved] = await asks.list(9);
  assert.equal(saved.status, "failed");
  assert.match(f.notes[0].title, /couldn't finish/);
});

test("Arise's Markdown is shown safely: no tags from the AI get through", async () => {
  const { askHtml } = await import("../shared/askHtml");
  const html = askHtml("# Title\n\n<script>alert(1)</script>\n\n1. one\n2. two\n\n- [ ] box\n\n| a | b |\n|---|---|\n| 1 | 2 |");
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<ol start="1"><li>one<\/li><li>two<\/li><\/ol>/);
  assert.match(html, /<table>/);
});

test("wired into To Duo: @arise in Tasks and the Add sheet, the Arise tab, notifications and the server", () => {
  const tasks = read("client/src/components/teacher-hub/HubTasks.tsx");
  assert.match(tasks, /if \(sendAsk\(title, listId !== "all" \? \{ listId \} : \{\}\)\) \{ setQuick\(""\); return; \}/);
  assert.match(tasks, /data-testid="task-view-arise"/);
  assert.match(tasks, /arise && aiTab \? <AriseAsks/);
  assert.match(tasks, /ariseAsk=\{askByTask\.get\(task\.id\)\}/);
  const todo = read("client/src/pages/AriseTodo.tsx");
  assert.match(todo, /const started = startTaskAsk\(text, base\.id,/);
  assert.match(todo, /if \(go === "asks"\) \{/);
  assert.match(todo, /arise=\{\{ asks: ariseAsks\.asks, loaded: ariseAsks\.loaded, open: ariseAsks\.open,/);
  const routes = read("server/routes.ts");
  assert.match(routes, /registerTodoAsks\(app, authMiddleware, plans\.aiMeter, \{/);
  assert.match(routes, /notify: \(userId, message\) => notifyUser\(userId, message, "todo"\)/);
  const server = read("server/todoAsks.ts");
  assert.match(server, /app\.post\("\/api\/arise-todo\/asks", authMiddleware, async \(req: any, res, next\) => \{/);
  assert.match(server, /\}, aiMeter, async \(req: any, res\) => \{/);
  assert.match(read("client/src/components/teacher-hub/AriseAsks.tsx"), /dangerouslySetInnerHTML=\{\{ __html: askHtml\(current\.result\) \}\}/);
  assert.match(read("shared/askHtml.ts"), /export const escHtml = \(s: string\) => s\.replace\(\/&\/g, "&amp;"\)/);
});
