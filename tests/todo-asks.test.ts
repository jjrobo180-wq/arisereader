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
  // Two days named: the one after "on", "by" or "before" is the one that counts.
  const two = askTiming("email the coach about Saturday on Monday", SAT);
  assert.equal(two.mode, "later"); assert.equal(two.due, "2026-11-16"); assert.equal(two.title, "email the coach about Saturday");
  const two2 = askTiming("practice sheet for Friday's test by Wednesday", SAT);
  assert.equal(two2.mode, "now"); assert.equal(two2.due, "2026-11-18");
  // A time that has already gone by today is made now.
  assert.equal(askTiming("a story at 8am today", SAT).mode, "now");
});

test("the kind of thing asked for, and the task's name", () => {
  assert.equal(askKind("make a worksheet for Kha"), "worksheet");
  assert.equal(askKind("quiz on volcanoes"), "quiz");
  assert.equal(askKind("email the coach about Saturday"), "email");
  assert.equal(askKind("plan a week of dinners"), "recipe");
  assert.equal(askKind("weekly chore schedule"), "plan");
  assert.equal(askKind("tell me something"), "answer");
  assert.equal(askKind("tidy up the garage notes"), "other");
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
  assert.match(read("client/src/components/teacher-hub/AriseAsks.tsx"), /dangerouslySetInnerHTML=\{\{ __html: askHtml\(main\) \}\}/);
  assert.match(read("shared/askHtml.ts"), /export const escHtml = \(s: string\) => s\.replace\(\/&\/g, "&amp;"\)/);
});

// ── Questions, live facts and cleaner results (November 2026) ───────────────────────────────────
import { needsLookup } from "../shared/ariseAsks";
import { placeIn, tzCity, weatherFacts, makeLookup } from "../server/askLookup";
import { askHtml, splitAnswerKey } from "../shared/askHtml";

test("a question is answered now, not turned into a to-do due on the day it mentions", () => {
  for (const q of ["what's the weather tomorrow", "whats the weather tomorrow?", "will it snow on Monday", "who won the Broncos game", "is the library open today"]) {
    assert.equal(askKind(q), "answer", q);
    const t = askTiming(q, SAT);
    assert.equal(t.mode, "now", q); assert.equal(t.due, "", q);
  }
  // Things to make stay things to make, with their timing.
  assert.equal(askKind("make a worksheet for Kha by Monday"), "worksheet");
  assert.equal(askTiming("make a worksheet for Kha by Monday", SAT).due, "2026-11-16");
  assert.equal(askKind("plan a week of dinners"), "recipe");
  assert.equal(askKind("make a packing list for the weekend weather"), "list");
  assert.ok(needsLookup("what's the weather tomorrow") && needsLookup("latest news about the Mars rover") && !needsLookup("make a worksheet"));
});

test("the weather: the place named in the ask, or the phone's time zone, from Open-Meteo", async () => {
  assert.equal(placeIn("what's the weather in Chicago tomorrow"), "Chicago");
  assert.equal(placeIn("will it rain in San Diego on Saturday?"), "San Diego");
  assert.equal(placeIn("what's the weather tomorrow"), "");
  assert.equal(placeIn("weather in the morning"), "");
  assert.equal(tzCity("America/Los_Angeles"), "Los Angeles");
  const urls: string[] = [];
  const fake = (async (url: string) => {
    urls.push(url);
    if (url.includes("geocoding")) return new Response(JSON.stringify({ results: [{ name: "Denver", admin1: "Colorado", country: "United States", country_code: "US", latitude: 39.7, longitude: -104.9 }] }));
    return new Response(JSON.stringify({ current: { temperature_2m: 41.2, apparent_temperature: 37, weather_code: 3, wind_speed_10m: 8 },
      daily: { time: ["2026-11-15", "2026-11-16"], weather_code: [3, 71], temperature_2m_max: [52.4, 38], temperature_2m_min: [30, 24.6], precipitation_probability_max: [10, 70], snowfall_sum: [0, 1.2], wind_speed_10m_max: [12, 20], sunrise: ["2026-11-15T06:41", "2026-11-16T06:42"], sunset: ["2026-11-15T16:44", "2026-11-16T16:43"] } }));
  }) as any;
  const w = await weatherFacts("what's the weather tomorrow", "America/Denver", fake);
  assert.ok(w);
  assert.match(urls[0], /name=Denver/);
  assert.match(urls[1], /temperature_unit=fahrenheit/);
  assert.match(w!.facts, /Weather for Denver, Colorado \(from the phone's time zone/);
  assert.match(w!.facts, /Monday, Nov 16: light snow, high 38°F, low 25°F, chance of rain or snow 70%, snow 1.2 in/);
  assert.equal(w!.source, "Open-Meteo forecast for Denver, Colorado");
  // Other questions about now are looked up on the web.
  const look = makeLookup({ search: async () => JSON.stringify({ facts: "- The Broncos beat the Chiefs 24-17 on Sunday night.", sources: ["NFL.com"] }), fetchImpl: fake });
  const news = await look("who won the Broncos game", undefined, "Saturday");
  assert.match(news!.facts, /Broncos beat the Chiefs/); assert.equal(news!.source, "Looked up on the web: NFL.com");
});

test("Arise answers from the live facts and says where they came from", async () => {
  const f = fakeDeps(async () => JSON.stringify({ title: "Tomorrow's weather in Denver", summary: "Light snow tomorrow.", markdown: "**Light snow** tomorrow in Denver, high 38°F and low 25°F." }));
  const asks = createAsks({ ...f.deps, lookup: async () => ({ facts: "Weather for Denver: Monday light snow, high 38°F", source: "Open-Meteo forecast for Denver, Colorado" }) });
  await asks.start(7, { ask: "what's the weather tomorrow", tz: "America/Denver", when: "Answered now" });
  await wait();
  const [saved] = await asks.list(7);
  assert.equal(saved.status, "done"); assert.equal(saved.kind, "answer"); assert.equal(saved.tz, "America/Denver");
  assert.equal(saved.source, "Open-Meteo forecast for Denver, Colorado");
  assert.match(f.prompts[0], /Live information \(use this for anything current\):\nWeather for Denver/);
  assert.match(f.prompts[0], /Never say you can't look things up/);
  assert.equal(f.notes[0].title, "Arise: Tomorrow's weather in Denver");
});

test("worksheets read cleanly: blanks stay on their line, the answer key is kept apart", () => {
  const html = askHtml("1. Write 0.875 as a fraction in simplest form. ____");
  assert.match(html, /simplest form\.&nbsp;<span class="blank" aria-label="blank"><\/span>/);
  const { main, key } = splitAnswerKey("# Fractions\n\n1. 1/2 + 1/4 = ____\n\n## Answer Key\n1. 3/4");
  assert.match(main, /1\/2 \+ 1\/4/); assert.ok(!/3\/4/.test(main)); assert.equal(key, "1. 3/4");
  assert.deepEqual(splitAnswerKey("Just text"), { main: "Just text", key: "" });
  const ui = read("client/src/components/teacher-hub/AriseAsks.tsx");
  assert.match(ui, /data-testid="arise-ask-key"/);
  assert.match(ui, /printAsk\(current, false\)/); assert.match(ui, /Print with answers/);
  assert.match(ui, /data-testid="arise-ask-source"/);
  // A question isn't a to-do: no task, and it opens straight to the answer.
  assert.match(read("client/src/lib/ariseAsks.ts"), /const task: TaskFromAsk \| null = question \? null :/);
  assert.match(read("client/src/components/teacher-hub/HubTasks.tsx"), /if \(!t\) openAsk\(a\.id\);/);
  assert.match(read("server/routes.ts"), /lookup: makeLookup\(\{ search: \(system, user\) => perplexityChat\(system, user, 30_000\) \}\)/);
});

test("an ask made from the Work Hub opens the Work Hub from its notification; one from To Duo still opens To Duo", async () => {
  const f = fakeDeps(async () => GOOD);
  const asks = createAsks(f.deps);
  await asks.start(7, { ask: "make a worksheet for Kha", hub: "work" });
  await asks.start(7, { ask: "make a worksheet for Kha too", hub: "somewhere-else" });
  await wait();
  const saved = await asks.list(7);
  const work = saved.find((a) => a.ask === "make a worksheet for Kha")!;
  const life = saved.find((a) => a.ask === "make a worksheet for Kha too")!;
  assert.equal(work.hub, "work");
  assert.equal(life.hub, undefined);
  assert.ok(f.notes.some((n) => n.url === `/#/workhub?go=asks&ask=${work.id}`));
  assert.ok(f.notes.some((n) => n.url === `/#/to-do?go=asks&ask=${life.id}`));
  // It survives being saved and read back (cleanAsks).
  assert.equal(cleanAsks(JSON.parse(JSON.stringify(saved))).find((a) => a.id === work.id)?.hub, "work");
});

test("@arise works in the Work Hub: Tasks, Home's quick add and pop-up, the notification link and the finished toast", () => {
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /const ariseAsks = useAriseAsks\(user \? token : null\);/);
  assert.match(hub, /<Tasks workspace=\{workspace\}[\s\S]{0,200}arise=\{\{ asks: ariseAsks\.asks, loaded: ariseAsks\.loaded, open: ariseAsks\.open, people: \[\], hub: "work" \}\} \/>/);
  // Home: the quick add and the pop-up both try "@arise" first, before the to-do is added.
  assert.match(hub, /if \(sendHomeAsk\(title\)\) return; const found = smartDate\(title\);/);
  assert.match(hub, /const addHomeTask = \(fields: TaskFields\) => \{[\s\S]{0,400}if \(sendHomeAsk\(/);
  assert.match(hub, /startTaskAsk\(text, nid, \[\], "work"\)/);
  // The notification's link ("#/workhub?go=asks&ask=…") opens Tasks on the Arise tab; a finished ask says so.
  assert.match(hub, /params\.get\("go"\) !== "asks"/);
  assert.match(hub, /onAskFinished\(/);
  // The Work Hub never sends student names to the AI.
  assert.doesNotMatch(hub, /startTaskAsk\([^)]*students/);
  const lib = read("client/src/lib/ariseAsks.ts");
  assert.match(lib, /\.\.\.\(hub === "work" \? \{ hub \} : \{\}\)/);
  assert.match(read("client/src/components/teacher-hub/HubTasks.tsx"), /startTaskAsk\(text, id, arise\.people, arise\.hub\)/);
});

test("@arise after a sentence in the name still counts, and the words before it stay part of the request", () => {
  assert.equal(
    parseTaskAsk("Kha fiction/non fiction worksheet. @arise create a worksheet for kha that gives examples of fiction and non fiction"),
    "Kha fiction/non fiction worksheet. create a worksheet for kha that gives examples of fiction and non fiction",
  );
  assert.equal(parseTaskAsk("Plan:\n@arise what's the weather"), "Plan: what's the weather");
  // Still not an ask: an @ in the middle of a sentence, an email address, nothing after it.
  assert.equal(parseTaskAsk("email @arise team"), null);
  assert.equal(parseTaskAsk("write to x@arise.com about it"), null);
  assert.equal(parseTaskAsk("buy milk. @arise hi"), null);
});

test("@arise works when a to-do is edited too, in Work Hub Tasks and Home and in To Duo", () => {
  const tasks = read("client/src/components/teacher-hub/HubTasks.tsx");
  assert.match(tasks, /existingId\?: string/);
  assert.match(tasks, /sendAsk\(text, \{ listId: fields\.listId, priority: fields\.priority, \.\.\.\(editing\.id \? \{ existingId: editing\.id \} : \{\}\) \}\)/);
  assert.match(tasks, /else if \(extra\.existingId\) setWorkspace/);
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /sendHomeAsk = \(text: string, priority = false, existingId\?: string\)/);
  assert.match(hub, /fields\.priority, homeTask\)\) return; setWorkspace/);
  const duo = read("client/src/pages/AriseTodo.tsx");
  assert.match(duo, /const isNew = !data\.tasks\.some\(\(t\) => t\.id === editing\.id\);/);
  assert.match(duo, /else if \(!isNew\) setData/);
  assert.doesNotMatch(duo, /if \(!data\.tasks\.some\(\(t\) => t\.id === editing\.id\)\) \{\n      const typed/);
});
