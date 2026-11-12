// A.R.I.S.E. Math "Test Prep" (rules in shared/ariseMathPrep.ts): photos of practice sheets, or the
// standard or lesson name, become practice for an upcoming test.
//
//   GET    /api/math/prep                 my prep sets (made by me or sent to me), with my progress
//   POST   /api/math/prep                 { title, testDate, grade, text, images[] } → a new set
//   GET    /api/math/prep/:id             one set and my progress on it
//   POST   /api/math/prep/:id/more        { topicId } → more questions for that topic
//   PUT    /api/math/prep/:id/progress    { answers: { questionId: "right" | "wrong" } }
//   POST   /api/math/prep/:id/share       teacher: to their class; parent: { childIds } or every child
//   DELETE /api/math/prep/:id             the maker deletes it; anyone else takes it off their list
//
// Behind the Arise Math add-on gate like the rest of /api/math. Photos go to the AI service to be read
// and are not kept. Sets live in the key-value store (podcast_cache): "mathprep:set:<id>",
// "mathprep:list:<userId>" (ids, newest first) and "mathprep:prog:<userId>:<setId>".
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import type { KV } from "./podcastDirectory";
import { CheckUnavailable, checkQuestions, checkTopics, type AskJson } from "../shared/ariseMathVerify";
import { COULD_NOT_BUILD, NO_MATH_FOUND, PREP_LIMITS, cleanMore, cleanPrepAsk, cleanPrepReply, cleanReading, morePrompt, prepPrompt, readPrompt, readingText, type PrepSet } from "../shared/ariseMathPrep";

export type PrepAsk = { system: string; text: string; images: string[] };
export type MathPrepDeps = {
  kv: KV;
  /** Asks the AI and returns its reply, which should be JSON. */
  askAI?: (ask: PrepAsk) => Promise<string>;
  aiConfigured?: () => boolean;
  /** Tests only: leaves out the second solver. */
  skipCheck?: boolean;
  gradeOf?: (userId: number) => Promise<string | null>;
  /** A teacher's students, and a parent's linked children (ids). */
  studentsOf?: (teacherId: number) => Promise<{ id: number }[]>;
  childrenOf?: (parentId: number) => Promise<number[]>;
  nameOf?: (userId: number) => Promise<string>;
  notify?: (userId: number, message: { title: string; body: string; url?: string; tag?: string }) => Promise<unknown>;
  now?: () => number;
};

class PrepAiError extends Error {}
const CHECK_FAILED = "I built your practice but couldn’t double-check the math just now. Tap Build again.";
const IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MODEL = () => process.env.MATH_PREP_MODEL || process.env.MATH_TUTOR_MODEL || "gpt-4.1";

async function askOpenAI(ask: PrepAsk): Promise<string> {
  const content: any[] = [{ type: "text", text: ask.text }];
  for (const url of ask.images) content.push({ type: "image_url", image_url: { url, detail: "high" } });
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL(), temperature: 0.2, max_tokens: 16000, response_format: { type: "json_object" },
        messages: [{ role: "system", content: ask.system }, { role: "user", content }],
      }),
      signal: AbortSignal.timeout(150_000),
    });
  } catch (error: any) {
    throw new PrepAiError(error?.name === "TimeoutError" ? "That took too long. Try fewer pages, or type the lesson name." : "The math helper can’t be reached right now. Try again in a moment.");
  }
  if (!response.ok) {
    console.error("[arise-math-prep] AI request failed:", response.status);
    throw new PrepAiError(response.status === 429 ? "The math helper is busy. Try again in a minute." : "The math helper couldn’t read that. Try clearer photos, or type the lesson or standard.");
  }
  const payload: any = await response.json().catch(() => null);
  return String(payload?.choices?.[0]?.message?.content || "");
}

const setKey = (id: string) => `mathprep:set:${id}`;
const listKey = (userId: number) => `mathprep:list:${userId}`;
const progKey = (userId: number, id: string) => `mathprep:prog:${userId}:${id}`;
const ID = /^[a-f0-9-]{36}$/;
type Progress = Record<string, "right" | "wrong">;

export function registerMathPrepRoutes(app: Express, auth: RequestHandler, deps: MathPrepDeps) {
  const now = deps.now ?? Date.now;
  const kv = deps.kv;
  const askAI = deps.askAI ?? askOpenAI;
  const askJson: AskJson = async (system, text) => JSON.parse(await askAI({ system, text, images: [] }));
  const aiConfigured = deps.aiConfigured ?? (() => !!process.env.OPENAI_API_KEY);
  const builds = createAttemptLimiter({ max: PREP_LIMITS.perDay, windowMs: 24 * 3600_000, now });
  const mores = createAttemptLimiter({ max: PREP_LIMITS.morePerDay, windowMs: 24 * 3600_000, now });

  const who = (req: any) => {
    const id = Number(req.user?.id);
    return { id, role: req.user?.isAdmin ? "admin" : String(req.user?.role || "student"), name: String(req.user?.displayName || req.user?.username || "") };
  };
  const getList = async (userId: number): Promise<string[]> => {
    const d = await kv.get(listKey(userId)).catch(() => null);
    return Array.isArray(d?.value) ? d!.value.filter((x: unknown) => typeof x === "string" && ID.test(x)) : [];
  };
  const addToList = async (userId: number, id: string) => {
    const list = [id, ...(await getList(userId)).filter((x) => x !== id)].slice(0, PREP_LIMITS.sets);
    await kv.set(listKey(userId), list);
  };
  const getSet = async (id: string): Promise<PrepSet | null> => {
    if (!ID.test(id)) return null;
    const d = await kv.get(setKey(id)).catch(() => null);
    return d?.value && typeof d.value === "object" ? (d.value as PrepSet) : null;
  };
  const canSee = (s: PrepSet, u: { id: number; role: string }) => s.ownerId === u.id || s.sharedWith.includes(u.id) || u.role === "admin";
  const getProgress = async (userId: number, id: string): Promise<Progress> => {
    const d = await kv.get(progKey(userId, id)).catch(() => null);
    return d?.value && typeof d.value === "object" ? (d.value as Progress) : {};
  };
  const count = (s: PrepSet, p: Progress) => {
    const ids = s.topics.flatMap((t) => t.questions.map((q) => q.id));
    return { total: ids.length, done: ids.filter((q) => p[q]).length, right: ids.filter((q) => p[q] === "right").length };
  };
  const fail = (res: any, e: any, what: string) => { console.error(`[arise-math-prep] ${what}:`, e?.message || e); res.status(500).json({ message: "Test Prep couldn’t do that just now. Try again in a moment." }); };

  app.get("/api/math/prep", auth, async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const u = who(req);
    if (!u.id) return res.status(401).json({ message: "Log in to use Test Prep." });
    try {
      const sets = [];
      for (const id of await getList(u.id)) {
        const s = await getSet(id);
        if (!s || !canSee(s, u)) continue;
        sets.push({ id: s.id, title: s.title, testDate: s.testDate, grade: s.grade, topics: s.topics.map((t) => t.name), ownerName: s.ownerName, mine: s.ownerId === u.id, sharedCount: s.sharedWith.length, createdAt: s.createdAt, progress: count(s, await getProgress(u.id, id)) });
      }
      const share = u.role === "teacher" || u.role === "admin" ? "class" : u.role === "parent" ? "child" : null;
      const children = share === "child" && deps.childrenOf
        ? await Promise.all((await deps.childrenOf(u.id).catch(() => [] as number[])).map(async (id) => ({ id, name: (await deps.nameOf?.(id).catch(() => "")) || "Your child" })))
        : [];
      res.json({ sets, share, children, ai: aiConfigured() });
    } catch (e) { fail(res, e, "list"); }
  });

  app.post("/api/math/prep", auth, async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const u = who(req);
    if (!u.id) return res.status(401).json({ message: "Log in to use Test Prep." });
    if (!aiConfigured()) return res.status(503).json({ message: "Test Prep isn’t turned on for this site yet." });
    const ask = cleanPrepAsk(req.body);
    const images = (Array.isArray(req.body?.images) ? req.body.images : []).filter((x: unknown) => typeof x === "string" && x);
    if (images.length > PREP_LIMITS.images) return res.status(400).json({ message: `Add up to ${PREP_LIMITS.images} pictures at a time.` });
    if (images.some((x: string) => x.length > PREP_LIMITS.imageChars || !IMAGE_RE.test(x))) return res.status(400).json({ message: "One of the pictures couldn’t be read. Try a JPG or PNG photo or screenshot." });
    if (!images.length && !ask.text) return res.status(400).json({ message: "Add a picture of the practice sheet." });
    const wait = builds.retryAfter(String(u.id));
    if (wait) return res.status(429).json({ message: `That’s a lot of test prep today! You can make another in ${waitWords(wait)}.` });
    builds.fail(String(u.id));
    if (!ask.grade && u.role === "student") ask.grade = (await deps.gradeOf?.(u.id).catch(() => null)) || "";

    let raw = "";
    try {
      raw = await askAI({
        system: prepPrompt(ask),
        text: [ask.title && `The test: ${ask.title}`, ask.testDate && `Test date: ${ask.testDate}`, ask.text && `What the test covers (typed): ${ask.text}`, images.length ? `${images.length} picture${images.length === 1 ? "" : "s"} of the practice material follow.` : "No pictures: use the typed text."].filter(Boolean).join("\n"),
        images,
      });
    } catch (e: any) {
      return res.status(502).json({ message: e instanceof PrepAiError ? e.message : "The math helper couldn’t read that. Try again." });
    }
    let parsed: unknown = null;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    let result = cleanPrepReply(parsed, ask);
    // A picture is never turned down on one try: look again just to read it, then build from what was read.
    if ("notMath" in result && images.length) {
      console.warn("[arise-math-prep] first look found no math; reading the pictures");
      let reading = cleanReading(null);
      try { reading = cleanReading(JSON.parse(await askAI({ system: readPrompt(), text: "Read these pictures.", images }))); }
      catch (e: any) { console.warn("[arise-math-prep] closer look failed:", e?.message || e); return res.status(502).json({ message: COULD_NOT_BUILD }); }
      if (!reading.found && !ask.text) return res.json({ notMath: NO_MATH_FOUND });
      const asked = { ...ask, grade: ask.grade || reading.grade };
      try { result = cleanPrepReply(JSON.parse(await askAI({ system: prepPrompt(asked), text: [ask.title && `The test: ${ask.title}`, ask.text && `What the test covers (typed): ${ask.text}`, readingText(reading)].filter(Boolean).join("\n"), images: [] })), asked); }
      catch (e: any) { console.warn("[arise-math-prep] rebuild failed:", e?.message || e); return res.status(502).json({ message: COULD_NOT_BUILD }); }
      if ("notMath" in result) return res.status(502).json({ message: COULD_NOT_BUILD });
    }
    if ("notMath" in result) return res.json({ notMath: result.notMath });
    // Nothing reaches a student unchecked. If the check can't run, nothing is shown: wrong math is worse than a retry.
    if (!deps.skipCheck) {
      try { result.set.topics = await checkTopics(result.set.topics, askJson); }
      catch (e: any) { console.error("[arise-math-prep] check failed:", e?.message || e); return res.status(502).json({ message: e instanceof CheckUnavailable ? CHECK_FAILED : COULD_NOT_BUILD }); }
      if (!result.set.topics.length) { console.error("[arise-math-prep] no questions passed the check"); return res.status(502).json({ message: COULD_NOT_BUILD }); }
    }
    try {
      const set: PrepSet = { ...result.set, id: randomUUID(), ownerId: u.id, ownerName: u.name, ownerRole: u.role, sharedWith: [], createdAt: new Date(now()).toISOString() };
      await kv.set(setKey(set.id), set);
      await addToList(u.id, set.id);
      res.json({ set, progress: {} });
    } catch (e) { fail(res, e, "save"); }
  });

  app.get("/api/math/prep/:id", auth, async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const u = who(req);
    try {
      const s = await getSet(String(req.params.id));
      if (!s || !canSee(s, u)) return res.status(404).json({ message: "That test prep isn’t here anymore." });
      res.json({ set: s, progress: await getProgress(u.id, s.id), mine: s.ownerId === u.id });
    } catch (e) { fail(res, e, "open"); }
  });

  app.post("/api/math/prep/:id/more", auth, async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const u = who(req);
    if (!aiConfigured()) return res.status(503).json({ message: "Test Prep isn’t turned on for this site yet." });
    try {
      const s = await getSet(String(req.params.id));
      if (!s || !canSee(s, u)) return res.status(404).json({ message: "That test prep isn’t here anymore." });
      const topic = s.topics.find((t) => t.id === String(req.body?.topicId || ""));
      if (!topic) return res.status(404).json({ message: "That topic isn’t in this test prep." });
      const wait = mores.retryAfter(String(u.id));
      if (wait) return res.status(429).json({ message: `That’s a lot of practice today! More questions in ${waitWords(wait)}.` });
      mores.fail(String(u.id));
      let raw = "";
      try { raw = await askAI({ system: morePrompt(topic, topic.questions.map((q) => q.q), s.grade), text: `More practice on ${topic.name}, please.`, images: [] }); }
      catch (e: any) { return res.status(502).json({ message: e instanceof PrepAiError ? e.message : "The math helper couldn’t make more right now. Try again." }); }
      let parsed: unknown = null;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      let added = cleanMore(parsed, topic.questions);
      if (!deps.skipCheck) added = await checkQuestions(added, askJson).catch(() => []);
      if (!added.length) return res.status(502).json({ message: "The math helper couldn’t make more right now. Try again." });
      // Kept with the set (newest set wins if two people ask at once), so everyone it's shared with gets them.
      const fresh = (await getSet(s.id)) || s;
      const t = fresh.topics.find((x) => x.id === topic.id);
      if (t) t.questions = [...t.questions, ...added].slice(-60);
      await kv.set(setKey(s.id), fresh);
      res.json({ questions: added });
    } catch (e) { fail(res, e, "more"); }
  });

  app.put("/api/math/prep/:id/progress", auth, async (req: any, res: any) => {
    const u = who(req);
    try {
      const s = await getSet(String(req.params.id));
      if (!s || !canSee(s, u)) return res.status(404).json({ message: "That test prep isn’t here anymore." });
      const ids = new Set(s.topics.flatMap((t) => t.questions.map((q) => q.id)));
      const p = await getProgress(u.id, s.id);
      for (const [k, v] of Object.entries(req.body?.answers || {})) if (ids.has(k) && (v === "right" || v === "wrong")) p[k] = v;
      await kv.set(progKey(u.id, s.id), p);
      res.json({ ok: true, progress: count(s, p) });
    } catch (e) { fail(res, e, "progress"); }
  });

  app.post("/api/math/prep/:id/share", auth, async (req: any, res: any) => {
    const u = who(req);
    try {
      const s = await getSet(String(req.params.id));
      if (!s || (s.ownerId !== u.id && u.role !== "admin")) return res.status(404).json({ message: "Only the person who made this test prep can send it." });
      let to: number[] = [];
      if (u.role === "teacher" || u.role === "admin") to = (await deps.studentsOf?.(u.id).catch(() => []) ?? []).map((x) => Number(x.id));
      else if (u.role === "parent") {
        const mine = await deps.childrenOf?.(u.id).catch(() => [] as number[]) ?? [];
        const asked = Array.isArray(req.body?.childIds) ? req.body.childIds.map(Number) : mine;
        to = mine.filter((id) => asked.includes(id));
      } else return res.status(403).json({ message: "Teachers and parents can send test prep." });
      to = to.filter((id) => Number.isSafeInteger(id) && id > 0 && id !== u.id);
      if (!to.length) return res.status(400).json({ message: u.role === "parent" ? "Link your child’s account first." : "You don’t have any students yet." });
      s.sharedWith = [...new Set([...s.sharedWith, ...to])];
      await kv.set(setKey(s.id), s);
      for (const id of to) {
        await addToList(id, s.id);
        void deps.notify?.(id, { title: `📝 Test prep: ${s.title}`, body: `${u.name || "Your teacher"} sent you practice for your test${s.testDate ? ` on ${s.testDate}` : ""}.`, url: "/math/#prep", tag: `mathprep-${s.id}` })?.catch?.(() => {});
      }
      res.json({ ok: true, sent: to.length });
    } catch (e) { fail(res, e, "share"); }
  });

  app.delete("/api/math/prep/:id", auth, async (req: any, res: any) => {
    const u = who(req);
    try {
      const id = String(req.params.id);
      const s = await getSet(id);
      await kv.set(listKey(u.id), (await getList(u.id)).filter((x) => x !== id));
      if (s && s.ownerId === u.id) {
        for (const other of s.sharedWith) await kv.set(listKey(other), (await getList(other)).filter((x) => x !== id));
        await kv.set(setKey(id), null);
      }
      res.json({ ok: true });
    } catch (e) { fail(res, e, "delete"); }
  });
}
