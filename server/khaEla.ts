// Kha ELA Worksheet Maker (Math Lessons → "Kha ELA"). The rules, prompts and documents live in shared/khaEla.ts
// (the pictures in shared/khaElaArt.ts); this file asks the AI, checks every question, and keeps the result.
//
//   GET    /api/kha-ela          my recent worksheets (newest first) and whether the AI is on
//   POST   /api/kha-ela          { settings, text, images[], refineFrom?, change? } → 202 { id }  (builds in the background)
//   GET    /api/kha-ela/:id      { status: "working" | "done" | "failed", stage, pack?, error? }
//   DELETE /api/kha-ela/:id      forget it
//
// Teachers and the administrator only. A build is a few AI calls (the worksheet, the check, a repair), too long for one
// web request, so it runs in the background and the page polls. Records: "khaela:job:<id>" and "khaela:list:<userId>".
//
// Nothing reaches a teacher unchecked:
//  1. a reply with the wrong number of poems, questions or panels, a quote that is not in the poems, an option list
//     that is not usable, or a missing answer is sent back with exactly what is wrong (up to three tries);
//  2. a second reader answers every question from the poems alone; a different answer, or a statement it finds false, flags it;
//  3. a flagged question is rewritten once and checked again; if it still fails it stays, marked "Double-check this one".
// Only the student's first name is sent to the AI.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { PageError, fetchPageText, linksFrom, pagesText, type PageText } from "./pageText";
import { SpedAiError, askClean, askOpenAI, type SpedAsk, type SpedDeps } from "./spedExemplar";
import {
  CHECK_SYSTEM, KHA_LIMITS, REPAIR_SYSTEM, checkText, cleanKhaSheet, cleanQuestionForRepair, cleanSettings, judgeSheet, khaPrompt, khaText, parseJsonLoose, poemsForReader, refineText,
  type KhaPack, type KhaSettings, type KhaSheet,
} from "../shared/khaEla";

export type KhaDeps = SpedDeps;
const IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

type Job = { id: string; ownerId: number; status: "working" | "done" | "failed"; stage: string; updatedAt: number; startedAt: number; title: string; error?: string; pack?: KhaPack };
const jobKey = (id: string) => `khaela:job:${id}`;
const listKey = (userId: number) => `khaela:list:${userId}`;
const ID = /^[a-f0-9-]{36}$/;
/** A build that has not moved for this long was lost (the server restarted): say so instead of spinning forever. */
const STALE_MS = 8 * 60_000;

/** The second reader answers every question; flagged ones are rewritten once and checked again. */
export async function checkSheet(sheet: KhaSheet, askAI: (a: SpedAsk) => Promise<string>, setStage: (s: string) => Promise<void> = async () => {}): Promise<{ checked: number; flagged: number }> {
  const all = sheet.parts.flatMap((p) => p.questions);
  try {
    await setStage("Checking every question");
    const read = async (only?: Set<string>) => judgeSheet(sheet, parseJsonLoose(await askAI({ system: CHECK_SYSTEM, text: checkText(sheet, only), images: [] })), only);
    let flagged = await read();
    if (flagged.size) {
      await setStage("Fixing anything that did not check out");
      const bad = new Set(flagged.keys());
      const raw: any = parseJsonLoose(await askAI({
        system: REPAIR_SYSTEM,
        text: `${poemsForReader(sheet.poems)}\n\nQuestions to fix:\n${JSON.stringify(all.filter((q) => bad.has(q.id)).map(({ verified, ...q }) => ({ ...q, wasWrong: flagged.get(q.id) })))}`,
        images: [],
      }));
      const toolNames = sheet.toolbox.map((t) => t.name);
      for (const r of Array.isArray(raw?.questions) ? raw.questions : []) {
        const target = all.find((q) => q.id === String(r?.id) && bad.has(q.id));
        const fixed = target ? cleanQuestionForRepair({ ...r, type: target.type }, sheet.poems, toolNames) : null;
        if (target && fixed) Object.assign(target, { ...fixed, id: target.id });
      }
      flagged = await read(bad);
    }
    for (const q of all) q.verified = !flagged.has(q.id);
    return { checked: all.length, flagged: flagged.size };
  } catch (e: any) {
    // If the check itself could not run, nothing is called sure.
    console.warn("[kha-ela] check failed:", e?.message || e);
    for (const q of all) q.verified = false;
    return { checked: all.length, flagged: all.length };
  }
}

/** The whole build: the worksheet (new, or the previous one with the teacher's change), then the check. */
export async function buildSheet(settings: KhaSettings, text: string, images: string[], askAI: (a: SpedAsk) => Promise<string>, opts: { previous?: KhaSheet; change?: string; skipCheck?: boolean; setStage?: (s: string) => Promise<void> } = {}) {
  const setStage = opts.setStage ?? (async () => {});
  await setStage(opts.previous ? "Making your change" : "Writing the worksheet and comic");
  const base = khaText(settings, text, images.length);
  const input = opts.previous && opts.change ? `${base}\n\n${refineText(opts.previous, opts.change)}` : base;
  const sheet = await askClean(askAI, khaPrompt(settings), input, opts.previous ? [] : images, (raw) => cleanKhaSheet(raw, settings));
  const check = opts.skipCheck ? { checked: 0, flagged: 0 } : await checkSheet(sheet, askAI, setStage);
  return { sheet, check };
}

export function registerKhaElaRoutes(app: Express, auth: RequestHandler, deps: KhaDeps) {
  const now = deps.now ?? Date.now;
  const kv = deps.kv;
  const askAI = deps.askAI ?? askOpenAI;
  const aiConfigured = deps.aiConfigured ?? (() => !!process.env.OPENAI_API_KEY);
  const builds = createAttemptLimiter({ max: KHA_LIMITS.perDay, windowMs: 24 * 3600_000, now });

  const who = (req: any) => ({ id: Number(req.user?.id), teacher: req.user?.isAdmin === true || req.user?.role === "teacher", admin: req.user?.isAdmin === true });
  const getList = async (userId: number): Promise<string[]> => {
    const d = await kv.get(listKey(userId)).catch(() => null);
    return Array.isArray(d?.value) ? d!.value.filter((x: unknown) => typeof x === "string" && ID.test(x)) : [];
  };
  const getJob = async (id: string): Promise<Job | null> => {
    if (!ID.test(id)) return null;
    const d = await kv.get(jobKey(id)).catch(() => null);
    const j = d?.value && typeof d.value === "object" ? (d.value as Job) : null;
    if (j && j.status === "working" && now() - j.updatedAt > STALE_MS) return { ...j, status: "failed", error: "That build was interrupted. Tap Make it again." };
    return j;
  };
  const putJob = (j: Job) => kv.set(jobKey(j.id), { ...j, updatedAt: now() });
  const fail = (res: any, e: any, what: string) => { console.error(`[kha-ela] ${what}:`, e?.message || e); res.status(500).json({ message: "The Kha ELA maker couldn’t do that just now. Try again in a moment." }); };
  const gate = (req: any, res: any) => {
    const u = who(req);
    if (!u.id) { res.status(401).json({ message: "Log in to use the Kha ELA maker." }); return null; }
    if (!u.teacher) { res.status(403).json({ message: "The Kha ELA maker is for teacher accounts." }); return null; }
    return u;
  };

  app.get("/api/kha-ela", auth, async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const u = gate(req, res); if (!u) return;
    try {
      const mine = [];
      for (const id of await getList(u.id)) {
        const j = await getJob(id);
        if (j && j.ownerId === u.id) mine.push({ id: j.id, title: j.pack?.title || j.title, status: j.status, createdAt: j.pack?.createdAt || new Date(j.startedAt).toISOString() });
      }
      res.json({ ai: aiConfigured(), mine });
    } catch (e) { fail(res, e, "list"); }
  });

  app.post("/api/kha-ela", auth, async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const u = gate(req, res); if (!u) return;
    if (!aiConfigured()) return res.status(503).json({ message: "The Kha ELA maker isn’t turned on for this site yet." });
    const body = req.body ?? {};
    const settings = cleanSettings(body.settings);
    const text = String(body.text ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, KHA_LIMITS.text);
    const images = (Array.isArray(body.images) ? body.images : []).filter((x: unknown) => typeof x === "string" && x);
    if (images.length > KHA_LIMITS.images) return res.status(400).json({ message: `Add up to ${KHA_LIMITS.images} photos at a time.` });
    if (images.some((x: string) => x.length > KHA_LIMITS.imageChars || !IMAGE_RE.test(x))) return res.status(400).json({ message: "One of the photos couldn’t be read. Try a JPG or PNG photo or screenshot." });
    // A link to a worksheet or poems to follow: its words are read for the build (server/pageText.ts).
    const links = linksFrom(body.links);
    if (String(Array.isArray(body.links) ? body.links.join("") : body.links ?? "").trim() && !links.length) return res.status(400).json({ message: "That doesn’t look like a web address. Paste the full link, starting with https://" });
    if (settings.source === "asis" && body.refineFrom === undefined && !text && !images.length && !links.length) return res.status(400).json({ message: "Paste the poems or worksheet to use (or add a link or photos), or switch to “Write new poems.”" });
    // A change to a worksheet already made: the previous worksheet goes back to the AI with what to change.
    let previous: KhaSheet | undefined;
    const change = String(body.change ?? "").replace(/\s+/g, " ").trim().slice(0, KHA_LIMITS.change);
    if (body.refineFrom !== undefined) {
      if (!change) return res.status(400).json({ message: "Say what to change (for example “make it shorter” or “add a rhyme question”)." });
      const from = await getJob(String(body.refineFrom));
      if (!from || from.status !== "done" || !from.pack || (from.ownerId !== u.id && !u.admin)) return res.status(404).json({ message: "That worksheet isn’t here anymore." });
      previous = from.pack.sheet;
    }
    const wait = builds.retryAfter(String(u.id));
    if (wait) return res.status(429).json({ message: `That’s a lot of worksheets today! You can make another in ${waitWords(wait)}.` });
    builds.fail(String(u.id));
    const id = randomUUID();
    const job: Job = { id, ownerId: u.id, status: "working", stage: "Starting", startedAt: now(), updatedAt: now(), title: previous ? "Changed worksheet" : "New worksheet" };
    try {
      await putJob(job);
      await kv.set(listKey(u.id), [id, ...(await getList(u.id))].slice(0, 20));
    } catch (e) { return fail(res, e, "start"); }
    res.status(202).json({ id });
    // The build carries on after the answer is sent; the page polls GET /api/kha-ela/:id.
    void (async () => {
      try {
        let fullText = text;
        if (links.length && !previous) {
          job.stage = "Reading the page"; await putJob(job);
          const pages: PageText[] = [];
          for (const l of links) pages.push(await (deps.fetchPage ?? fetchPageText)(l));
          fullText = [text, pagesText(pages, KHA_LIMITS.text)].filter(Boolean).join("\n\n").slice(0, KHA_LIMITS.text);
        }
        const built = await buildSheet(settings, fullText, images, askAI, { previous, change, skipCheck: deps.skipCheck, setStage: async (stage) => { job.stage = stage; await putJob(job); } });
        const pack: KhaPack = { id, title: built.sheet.title, createdAt: new Date(now()).toISOString(), ownerId: u.id, settings, sheet: built.sheet, check: built.check };
        await putJob({ ...job, status: "done", stage: "Done", pack });
      } catch (e: any) {
        console.error("[kha-ela] build failed:", e?.message || e);
        await putJob({ ...job, status: "failed", stage: "Stopped", error: e instanceof SpedAiError || e instanceof PageError ? e.message : "The build didn’t finish. Tap Make it again." }).catch(() => {});
      }
    })();
  });

  app.get("/api/kha-ela/:id", auth, async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const u = gate(req, res); if (!u) return;
    try {
      const j = await getJob(String(req.params.id));
      if (!j || (j.ownerId !== u.id && !u.admin)) return res.status(404).json({ message: "That worksheet isn’t here anymore." });
      res.json({ id: j.id, status: j.status, stage: j.stage, error: j.error, pack: j.pack });
    } catch (e) { fail(res, e, "open"); }
  });

  app.delete("/api/kha-ela/:id", auth, async (req: any, res: any) => {
    const u = gate(req, res); if (!u) return;
    try {
      const id = String(req.params.id);
      const j = await getJob(id);
      await kv.set(listKey(u.id), (await getList(u.id)).filter((x) => x !== id));
      if (j && j.ownerId === u.id) await kv.set(jobKey(id), null);
      res.json({ ok: true });
    } catch (e) { fail(res, e, "delete"); }
  });
}
