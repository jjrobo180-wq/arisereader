// "@arise" asks from Arise To Do's tasks (shared/ariseAsks.ts): the person types "@arise make a worksheet for
// Kha by Monday" as a task, the phone works out when (now, or later for "on Monday") and sends it here. Arise's
// AI makes it right away or at that time, it's saved with the person's other asks, and a notification says it's
// ready. Asks are kept per person in the settings table (todo_asks_u<id>); asks waiting for their time are also
// listed in todo_asks_due so the once-a-minute pass can find them without reading everyone's.
//
//   GET    /api/arise-todo/asks            every ask, newest first
//   POST   /api/arise-todo/asks            { ask, taskId?, runAt?, due?, when?, people? }  -> { ask }
//   POST   /api/arise-todo/asks/:id/seen   marks it opened
//   POST   /api/arise-todo/asks/:id/retry  makes it again
//   DELETE /api/arise-todo/asks/:id
// Making one is metered like every To Do AI use (plans.aiMeter), so it's part of Unlimited.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { ASK_LIMITS, TZ, askKind, askSystemPrompt, cleanAsks, isAskId, needsLookup, newAskId, type AriseAsk } from "../shared/ariseAsks";
import type { Lookup } from "./askLookup";

export type AskAi = (system: string, user: string) => Promise<string>;
export type AsksDeps = {
  read: (key: string) => Promise<string>;
  write: (key: string, value: string) => Promise<void>;
  ai: AskAi;
  aiReady: () => boolean;
  notify: (userId: number, message: { title: string; body: string; url: string; tag: string }) => Promise<unknown>;
  now?: () => number;
  /** Live facts for questions about now (the weather, news, scores): server/askLookup.ts. */
  lookup?: (ask: string, tz: string | undefined, today: string) => Promise<Lookup>;
};

const KEY = (userId: number) => `todo_asks_u${userId}`;
const DUE_KEY = "todo_asks_due";
const MAX_AHEAD = 120 * 864e5;
const STALE_MS = 10 * 60_000;
type DueRow = { u: number; id: string; at: number };

/** The site's AI, asked for JSON. */
export const askOpenAiJson: AskAi = async (system, user) => {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.TODO_ASK_MODEL || "gpt-4.1", temperature: 0.6, max_tokens: 3000, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) { lastErr = new Error(`ai ${res.status}`); if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2000)); continue; } break; }
      const body: any = await res.json().catch(() => null);
      const text = String(body?.choices?.[0]?.message?.content || "").trim();
      if (text) return text;
      lastErr = new Error("empty answer");
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error("AI failed");
};

/** What came back from the AI, made safe to keep: a title, one line, and the Markdown. Null when unusable. */
export function readMade(text: string): { title: string; summary: string; markdown: string } | null {
  let j: any = null;
  try { j = JSON.parse(text); } catch { return null; }
  const markdown = String(j?.markdown || "").replace(/\r\n/g, "\n").trim().slice(0, ASK_LIMITS.result);
  if (markdown.length < 20) return null;
  const title = String(j?.title || "").replace(/\s+/g, " ").trim().slice(0, 100) || "Your Arise ask";
  const summary = String(j?.summary || "").replace(/\s+/g, " ").trim().slice(0, 200) || `${title} is ready.`;
  return { title, summary, markdown };
}

export function createAsks(deps: AsksDeps) {
  const now = deps.now ?? Date.now;
  // One person's asks are changed one at a time, so two finishing together don't undo each other.
  const chains = new Map<number, Promise<unknown>>();
  const serial = <T>(userId: number, work: () => Promise<T>): Promise<T> => {
    const run = (chains.get(userId) ?? Promise.resolve()).catch(() => {}).then(work);
    chains.set(userId, run.finally(() => { if (chains.get(userId) === run) chains.delete(userId); }));
    return run;
  };
  let dueChain: Promise<unknown> = Promise.resolve();
  const dueSerial = <T>(work: () => Promise<T>): Promise<T> => { const run = dueChain.catch(() => {}).then(work); dueChain = run; return run; };

  const list = async (userId: number): Promise<AriseAsk[]> => { try { return cleanAsks(JSON.parse((await deps.read(KEY(userId))) || "[]")); } catch { return []; } };
  const save = (userId: number, asks: AriseAsk[]) => deps.write(KEY(userId), JSON.stringify(cleanAsks(asks)));
  const update = (userId: number, id: string, change: (a: AriseAsk) => AriseAsk | null) => serial(userId, async () => {
    const asks = await list(userId);
    const i = asks.findIndex((a) => a.id === id);
    if (i < 0) return null;
    const next = change(asks[i]);
    if (next) asks[i] = next; else asks.splice(i, 1);
    await save(userId, asks);
    return next;
  });
  const dueRows = async (): Promise<DueRow[]> => { try { const r = JSON.parse((await deps.read(DUE_KEY)) || "[]"); return Array.isArray(r) ? r.filter((x) => Number.isSafeInteger(x?.u) && isAskId(x?.id) && Number.isFinite(x?.at)) : []; } catch { return []; } };
  const setDue = (change: (rows: DueRow[]) => DueRow[]) => dueSerial(async () => { await deps.write(DUE_KEY, JSON.stringify(change(await dueRows()).slice(0, 20_000))); });

  /** Makes one ask now: the AI writes it, it's saved, and the person is told. */
  const make = async (userId: number, id: string, people: string[] = []) => {
    const started = await update(userId, id, (a) => ({ ...a, status: "working", error: undefined, runAt: new Date(now()).toISOString() }));
    if (!started) return null;
    const today = new Date(now()).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    let made: ReturnType<typeof readMade> = null;
    // Questions about now get today's facts first, so Arise answers instead of saying it can't know.
    let live: Lookup = null;
    if (deps.lookup && (started.kind === "answer" || needsLookup(started.ask))) live = await deps.lookup(started.ask, started.tz, today).catch(() => null);
    const asked = `Request: ${started.ask}\nKind: ${started.kind}${started.due ? `\nIt's needed by: ${started.due}` : ""}`
      + (live ? `\n\nLive information (use this for anything current):\n${live.facts}` : (started.kind === "answer" && needsLookup(started.ask) ? "\n\nNo live information could be fetched for this right now." : ""));
    try { made = readMade(await deps.ai(askSystemPrompt(today, people), asked)); }
    catch (e: any) { console.error("[todo-asks] AI:", e?.message || e); }
    const finished = await update(userId, id, (a) => made
      ? { ...a, status: "done", title: made.title, summary: made.summary, result: made.markdown, finishedAt: new Date(now()).toISOString(), error: undefined, seen: false, ...(live ? { source: live.source } : {}) }
      : { ...a, status: "failed", error: "Arise couldn't make this one. Try again.", finishedAt: new Date(now()).toISOString() });
    if (finished) {
      // Asked from the Work Hub, it opens there; from To Do, it opens in To Do.
      const url = finished.hub === "work" ? `/#/workhub?go=asks&ask=${id}` : `/#/to-do?go=asks&ask=${id}`;
      await deps.notify(userId, made
        ? { title: finished.kind === "answer" ? `Arise: ${finished.title}` : `Arise finished: ${finished.title}`, body: finished.summary || "It's ready in your Arise tab.", url, tag: `arise-ask-${id}` }
        : { title: "Arise couldn't finish", body: `"${finished.ask.slice(0, 80)}" didn't work. Tap to try again.`, url, tag: `arise-ask-${id}` }).catch(() => {});
    }
    return finished;
  };

  /** Starts a new ask: made now, or listed to be made at its time. */
  const start = async (userId: number, body: any): Promise<AriseAsk | { error: string; status: number }> => {
    const ask = String(body?.ask || "").replace(/\s+/g, " ").trim().slice(0, ASK_LIMITS.ask);
    if (ask.length < 3) return { error: "Tell Arise what to make after @arise.", status: 400 };
    const t = now();
    const asked = Date.parse(String(body?.runAt || ""));
    const at = Number.isFinite(asked) && asked > t + 60_000 && asked < t + MAX_AHEAD ? asked : t;
    const later = at > t;
    const id = newAskId();
    const rec: AriseAsk = {
      id, ask, kind: askKind(ask), status: later ? "scheduled" : "working", createdAt: new Date(t).toISOString(), runAt: new Date(at).toISOString(),
      due: /^\d{4}-\d\d-\d\d$/.test(String(body?.due || "")) ? String(body.due) : "",
      when: String(body?.when || (later ? "Made later" : "Made now")).slice(0, 120),
      ...(typeof body?.taskId === "string" && body.taskId.length <= 80 ? { taskId: body.taskId } : {}),
      ...(typeof body?.tz === "string" && TZ.test(body.tz) ? { tz: body.tz } : {}),
      ...(body?.hub === "work" ? { hub: "work" as const } : {}),
    };
    await serial(userId, async () => save(userId, [rec, ...(await list(userId))]));
    const people = Array.isArray(body?.people) ? body.people.map((p: unknown) => String(p || "").replace(/[^\p{L}\p{N} '.-]/gu, "").trim().slice(0, 30)).filter(Boolean).slice(0, 20) : [];
    if (later) await setDue((rows) => [...rows, { u: userId, id, at }]);
    else void make(userId, id, people);
    return rec;
  };

  /** The once-a-minute pass: makes the asks whose time has come, and restarts any that stopped part way. */
  const runDue = async (): Promise<number> => {
    const t = now();
    const rows = await dueRows();
    const ready = rows.filter((r) => r.at <= t);
    if (ready.length) await setDue((all) => all.filter((r) => !ready.some((x) => x.u === r.u && x.id === r.id)));
    for (const r of ready.slice(0, 20)) await make(r.u, r.id).catch((e) => console.error("[todo-asks] scheduled:", e?.message || e));
    return ready.length;
  };
  /** An ask left "working" (the server restarted while it was being made) is made again when its person looks. */
  const recover = async (userId: number, asks: AriseAsk[]) => {
    const t = now();
    for (const a of asks) if (a.status === "working" && t - Date.parse(a.runAt) > STALE_MS) void make(userId, a.id);
  };

  return { list, start, make, update, runDue, recover, setDue };
}

export function registerTodoAsks(app: Express, authMiddleware: RequestHandler, aiMeter: RequestHandler, deps: AsksDeps) {
  const asks = createAsks(deps);
  const limit = createAttemptLimiter({ max: 40, windowMs: 60 * 60_000 });
  const who = (req: any, res: any): number | null => {
    const u = req.adminPreview && req.realUser ? req.realUser : req.user;
    const id = Number(u?.id);
    if (!Number.isSafeInteger(id) || id <= 0) { res.status(401).json({ message: "Sign in to use Arise." }); return null; }
    return id;
  };

  app.get("/api/arise-todo/asks", authMiddleware, async (req: any, res) => {
    const userId = who(req, res); if (userId == null) return;
    const all = await asks.list(userId);
    void asks.recover(userId, all);
    res.json({ asks: all });
  });

  app.post("/api/arise-todo/asks", authMiddleware, async (req: any, res, next) => {
    const userId = who(req, res); if (userId == null) return;
    if (!deps.aiReady()) return res.status(503).json({ message: "Arise's AI isn't set up on this site yet." });
    const wait = limit.retryAfter(`u${userId}`);
    if (wait > 0) return res.status(429).json({ message: `That's a lot of asks. Try again in ${waitWords(wait)}.` });
    next();
  }, aiMeter, async (req: any, res) => {
    const userId = who(req, res); if (userId == null) return;
    limit.fail(`u${userId}`);
    try {
      const made = await asks.start(userId, req.body);
      if ("error" in made) return res.status(made.status).json({ message: made.error });
      res.json({ ask: made });
    } catch (e: any) {
      console.error("[todo-asks] start:", e?.message || e);
      res.status(500).json({ message: "Couldn't send that to Arise. Try again." });
    }
  });

  app.post("/api/arise-todo/asks/:id/seen", authMiddleware, async (req: any, res) => {
    const userId = who(req, res); if (userId == null) return;
    if (!isAskId(req.params.id)) return res.status(404).json({ message: "Not found." });
    const a = await asks.update(userId, req.params.id, (x) => ({ ...x, seen: true }));
    a ? res.json({ ask: a }) : res.status(404).json({ message: "Not found." });
  });

  app.post("/api/arise-todo/asks/:id/retry", authMiddleware, aiMeter, async (req: any, res) => {
    const userId = who(req, res); if (userId == null) return;
    if (!isAskId(req.params.id)) return res.status(404).json({ message: "Not found." });
    if (!deps.aiReady()) return res.status(503).json({ message: "Arise's AI isn't set up on this site yet." });
    const found = (await asks.list(userId)).find((a) => a.id === req.params.id);
    if (!found) return res.status(404).json({ message: "Not found." });
    if (found.status === "working") return res.json({ ask: found });
    await asks.setDue((rows) => rows.filter((r) => !(r.u === userId && r.id === found.id)));
    void asks.make(userId, found.id);
    res.json({ ask: { ...found, status: "working" } });
  });

  app.delete("/api/arise-todo/asks/:id", authMiddleware, async (req: any, res) => {
    const userId = who(req, res); if (userId == null) return;
    if (!isAskId(req.params.id)) return res.status(404).json({ message: "Not found." });
    await asks.update(userId, req.params.id, () => null);
    await asks.setDue((rows) => rows.filter((r) => !(r.u === userId && r.id === req.params.id)));
    res.json({ ok: true });
  });

  // Asks waiting for their day and time.
  let ticking = false;
  const timer = setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try { await asks.runDue(); } catch (e: any) { console.error("[todo-asks] pass failed:", e?.message || e); } finally { ticking = false; }
  }, 60_000);
  timer.unref?.();
  return asks;
}
