// SPED Exemplar Maker (Math Lessons → "SPED Exemplar Maker"). Rules, prompts and documents live in
// shared/spedExemplar.ts; this file asks the AI, checks every answer, and keeps the result.
//
//   GET    /api/sped-exemplar          my recent exemplars (newest first) and whether the AI is on
//   POST   /api/sped-exemplar          { title, grade, text, images[] } → 202 { id }  (builds in the background)
//   GET    /api/sped-exemplar/:id      { status: "working" | "done" | "failed", stage, pack? , error? }
//   DELETE /api/sped-exemplar/:id      forget it
//
// Teachers and the administrator only. A build is several AI calls (the guide, the practice pack, the check,
// a repair), which is too long for one web request, so it runs in the background and the page polls.
// Records live in the key-value store: "spedex:job:<id>" and "spedex:list:<userId>" (ids, newest first).
//
// Nothing reaches a teacher unchecked:
//  1. a reply missing hints, steps, a why, a check or an answer is sent back with exactly what is missing;
//  2. code redoes every "=" sentence in every step (shared/ariseMathVerify.ts wrongArithmetic);
//  3. a second AI solves each problem cold, seeing only the problem, and its answer must match;
//  4. whatever fails is rewritten once and checked again; if it still fails it is kept but marked
//     "double-check this one", never presented as sure.
import { OpenAIBusyError, OpenAIQuotaError, postChat, readOpenAIError } from "./openaiFetch";
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { PageError, fetchPageText, linksFrom, pagesText, type PageText } from "./pageText";
import { UploadError, readUploads } from "./uploadText";
import type { KV } from "./podcastDirectory";
import { SOLVE_PROMPT, judge, solveText, type SolveItem } from "../shared/ariseMathVerify";
import {
  REPAIR_SYSTEM, SOLVE_BATCH, SPED_LIMITS, allProblems, cleanExemplarFrame, cleanPracticeFrame, cleanProblemForRepair, cleanSolvedBatch, exemplarPrompt, fillOutline, fixText, lessonText, parseJsonLoose, plainText, practicePrompt, solveBatchPrompt, unsolved,
  type Cleaned, type SpedPack, type XExemplar, type XOutlineProblem, type XPractice, type XProblem,
} from "../shared/spedExemplar";

/** maxTokens: the longest reply to ask for (a small one fits the free AI's per-minute allowance; see server/aiProvider.ts). */
export type SpedAsk = { system: string; text: string; images: string[]; maxTokens?: number };
export type SpedDeps = {
  kv: KV;
  /** Asks the AI and returns its reply (JSON text). */
  askAI?: (ask: SpedAsk) => Promise<string>;
  aiConfigured?: () => boolean;
  /** Tests only: leaves out the second solver. */
  skipCheck?: boolean;
  now?: () => number;
  /** Reads a lesson page for "paste a link" (tests pass their own). */
  fetchPage?: (url: string) => Promise<PageText>;
};

export class SpedAiError extends Error {}
const IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MODEL = () => process.env.SPED_EXEMPLAR_MODEL || process.env.MATH_PREP_MODEL || process.env.MATH_TUTOR_MODEL || "gpt-4.1";

export async function askOpenAI(ask: SpedAsk): Promise<string> {
  const content: any[] = [{ type: "text", text: ask.text }];
  // A PDF goes to the AI as a file (it reads the text and the pages); a photo as an image.
  ask.images.forEach((url, i) => content.push(url.startsWith("data:application/pdf") ? { type: "file", file: { filename: `lesson-${i + 1}.pdf`, file_data: url } } : { type: "image_url", image_url: { url, detail: "high" } }));
  let response: Response;
  try {
    // Rate limits are waited out and retried; an account out of credit says so (server/openaiFetch.ts).
    response = await postChat({ model: MODEL(), temperature: 0, max_tokens: ask.maxTokens ?? 16000, response_format: { type: "json_object" }, messages: [{ role: "system", content: ask.system }, { role: "user", content: ask.images.length ? content : ask.text }] }, { label: "sped-exemplar", timeoutMs: 170_000, maxWaitMs: 120_000 });
  } catch (error: any) {
    if (error instanceof OpenAIQuotaError || error instanceof OpenAIBusyError) throw new SpedAiError(error.message);
    throw new SpedAiError(error?.name === "TimeoutError" ? "That took too long. Try pasting fewer problems at a time." : "The AI can’t be reached right now. Try again in a moment.");
  }
  if (!response.ok) {
    const why = await readOpenAIError(response);
    throw new SpedAiError(ask.images.length ? `The AI couldn’t read those photos or files (${why.code || why.type || response.status}). Paste the lesson text instead, or try clearer photos.` : `The AI couldn’t do that (${why.code || why.type || response.status}${why.msg ? `: ${why.msg.slice(0, 120)}` : ""}). Try again.`);
  }
  const payload: any = await response.json().catch(() => null);
  return String(payload?.choices?.[0]?.message?.content || "");
}

type Job = { id: string; ownerId: number; status: "working" | "done" | "failed"; stage: string; updatedAt: number; startedAt: number; title: string; error?: string; pack?: SpedPack };
const jobKey = (id: string) => `spedex:job:${id}`;
const listKey = (userId: number) => `spedex:list:${userId}`;
const ID = /^[a-f0-9-]{36}$/;
/** A build that has not moved for this long was lost (the server restarted): say so instead of spinning forever. */
const STALE_MS = 8 * 60_000;

/** Asks, cleans, and if the reply is missing things, tells the AI exactly what and asks again. */
export async function askClean<T>(askAI: (a: SpedAsk) => Promise<string>, system: string, text: string, images: string[], clean: (raw: unknown) => Cleaned<T>, tries = 3, maxTokens?: number): Promise<T> {
  let errors: string[] = [];
  for (let i = 0; i < tries; i++) {
    const raw = await askAI({ system, text: i ? `${text}\n\n${fixText(errors)}` : text, images, ...(maxTokens ? { maxTokens } : {}) });
    const parsed = parseJsonLoose(raw);
    if (!parsed) { errors = ["Your reply was not valid JSON. Send one JSON object and nothing else."]; continue; }
    const c = clean(parsed);
    if (c.ok) return c.value;
    errors = c.errors;
    console.warn(`[sped-exemplar] reply ${i + 1} was missing things: ${errors.slice(0, 3).join(" | ")}`);
  }
  throw new SpedAiError("The AI’s answer was still missing parts after three tries. Tap Build again, or paste fewer problems.");
}

/** The one number in an answer like "$42.3" or "about 42.3 meters", or null if there isn't exactly one. */
export function singleNumber(s: string): number | null {
  const m = s.replace(/(\d),(?=\d{3})/g, "$1").match(/-?\d+(?:\.\d+)?/g);
  return m && m.length === 1 ? Number(m[0]) : null;
}

// ─── The checks ───
type Check = { key: string; get: () => { q: string; answer: string; accept: string[]; steps: string[]; hint: string }; set: (ok: boolean) => void };

function checks(e: XExemplar, p: XPractice): Check[] {
  const out: Check[] = [];
  const problem = (prefix: string) => (x: XProblem): Check => ({ key: `${prefix}${x.id}`, get: () => ({ q: plainText(x.story), answer: x.finalAnswer, accept: x.accept, steps: [...x.steps, x.check, x.answer].map(plainText), hint: x.hints.map(plainText).join(" ") }), set: (ok) => { x.verified = ok; } });
  for (const s of e.sections) for (const x of s.problems) out.push(problem("e:")(x));
  for (const s of p.book) for (const x of s.problems) out.push(problem("b:")(x));
  for (const x of p.sheet) out.push({ key: `s:${x.id}`, get: () => ({ q: plainText(x.q), answer: x.finalAnswer, accept: x.accept, steps: [...x.steps, x.answer].map(plainText), hint: "" }), set: (ok) => { x.verified = ok; } });
  return out;
}

async function judgeAll(list: Check[], askAI: (a: SpedAsk) => Promise<string>): Promise<Map<string, string>> {
  const items = list.map((c) => ({ id: c.key, c: c.get() }));
  const solveItems: SolveItem[] = items.map(({ id, c }) => ({ id, q: c.q, choices: [] }));
  let solved: unknown = null;
  // The solver sees only the problem, in batches so a long lesson fits.
  const results: unknown[] = [];
  for (let i = 0; i < solveItems.length; i += 12) {
    const raw = await askAI({ system: SOLVE_PROMPT, text: solveText(solveItems.slice(i, i + 12)), images: [], maxTokens: 6000 });
    const r: any = parseJsonLoose(raw);
    if (Array.isArray(r?.results)) results.push(...r.results);
  }
  // A rounded answer is still right: 42.28 and 42.3 are the same answer to "about how many meters?".
  const finals = new Map(items.map(({ id, c }) => [id, c.answer]));
  for (const r of results as any[]) {
    const a = singleNumber(String(r?.answer ?? "")), b = singleNumber(finals.get(String(r?.id)) ?? "");
    if (a !== null && b !== null && Math.abs(a - b) <= Math.max(0.051, Math.abs(b) * 0.006)) r.answer = finals.get(String(r.id));
  }
  solved = { results };
  const flagged = judge(items.map(({ id, c }) => ({ id, question: { q: c.q, choices: [], answer: c.answer, accept: c.accept, steps: c.steps.map((work) => ({ title: "", work })), hint: c.hint } })), solved);
  return new Map(flagged.map((f) => [f.id, f.why]));
}

/** Checks every answer; rewrites the ones that fail once; marks what still fails. Returns how many were checked and flagged. */
export async function checkPack(e: XExemplar, p: XPractice, askAI: (a: SpedAsk) => Promise<string>, setStage: (s: string) => Promise<void> = async () => {}): Promise<{ checked: number; flagged: number }> {
  const list = checks(e, p);
  await setStage("Checking every answer");
  let flagged = await judgeAll(list, askAI);
  if (flagged.size) {
    await setStage("Fixing anything that did not check out");
    const bad = list.filter((c) => flagged.has(c.key));
    const problems = bad.filter((c) => !c.key.startsWith("s:"));
    const sheet = bad.filter((c) => c.key.startsWith("s:"));
    const find = (key: string) => [...e.sections, ...p.book].flatMap((s) => s.problems).find((x) => key.endsWith(`:${x.id}`) && (key.startsWith("e:") ? e.sections.some((s) => s.problems.includes(x)) : p.book.some((s) => s.problems.includes(x))));
    try {
      if (problems.length) {
        const raw: any = parseJsonLoose(await askAI({ system: REPAIR_SYSTEM, text: JSON.stringify(problems.map((c) => { const x = find(c.key)!; return { id: x.id, problem: flagged.get(c.key), story: x.story, steps: x.steps, answer: x.answer, finalAnswer: x.finalAnswer }; })), images: [] }));
        for (const r of Array.isArray(raw?.problems) ? raw.problems : []) {
          const target = problems.map((c) => find(c.key)).find((x) => x && x.id === String(r?.id));
          const fixed = target ? cleanProblemForRepair(r) : null;
          if (target && fixed) Object.assign(target, { ...fixed, id: target.id, picture: target.picture, verified: false });
        }
      }
      if (sheet.length) {
        const raw: any = parseJsonLoose(await askAI({ system: SHEET_REPAIR_SYSTEM, text: JSON.stringify(sheet.map((c) => { const x = p.sheet.find((s) => `s:${s.id}` === c.key)!; return { id: x.id, problem: flagged.get(c.key), q: x.q, steps: x.steps, answer: x.answer, finalAnswer: x.finalAnswer }; })), images: [] }));
        for (const r of Array.isArray(raw?.items) ? raw.items : []) {
          const x = p.sheet.find((s) => s.id === String(r?.id));
          const steps = (Array.isArray(r?.steps) ? r.steps : []).map((s: unknown) => String(s).slice(0, 400)).filter(Boolean);
          if (x && r?.q && steps.length >= 2 && r?.answer && r?.finalAnswer) Object.assign(x, { q: String(r.q).slice(0, 500), steps, answer: String(r.answer).slice(0, 300), finalAnswer: String(r.finalAnswer).slice(0, 120), accept: [...new Set([String(r.finalAnswer), ...(Array.isArray(r.accept) ? r.accept.map(String) : [])])].slice(0, 8) });
        }
      }
      flagged = await judgeAll(list.filter((c) => flagged.has(c.key)), askAI);
    } catch (err: any) { console.warn("[sped-exemplar] repair failed:", err?.message || err); /* what failed stays flagged */ }
  }
  let n = 0;
  for (const c of list) { const ok = !flagged.has(c.key); c.set(ok); if (!ok) n++; }
  return { checked: list.length, flagged: n };
}

const SHEET_REPAIR_SYSTEM = `You are fixing student practice questions that failed a check. Work each one out again from scratch and send it corrected. Every "=" must be exactly true; every number a student needs is IN the question.
Reply with one JSON object and nothing else: { "items": [ { "id": "same id", "q": "the question", "steps": ["the worked steps"], "answer": "the answer", "finalAnswer": "the short answer only", "accept": ["other correct ways to write it"] } ] }
Plain-text math only: × ÷ − ² ³ √ π, fractions like 3/4.`;

/** Solves the outline's problems a few at a time (each ask small enough for the free AI's per-minute allowance). */
async function solveAll(ask: { title: string; grade: string }, guide: Pick<XExemplar, "title" | "recipe">, todo: XOutlineProblem[], askAI: (a: SpedAsk) => Promise<string>, setStage: (s: string) => Promise<void>, label: string): Promise<Map<string, XProblem>> {
  const out = new Map<string, XProblem>();
  for (let i = 0; i < todo.length; i += SOLVE_BATCH) {
    const batch = todo.slice(i, i + SOLVE_BATCH);
    await setStage(`${label} ${i + 1}${batch.length > 1 ? `–${i + batch.length}` : ""} of ${todo.length}`);
    const got = await askClean(askAI, solveBatchPrompt(ask, guide, batch), "Solve every problem listed, and send the JSON object.", [], cleanSolvedBatch(batch), 3, 5000);
    for (const p of got) out.set(p.id, p);
  }
  return out;
}

/** The whole build: the guide, the practice pack, the check. Each is outlined first, then its problems are
 *  solved a few at a time (see "Building it in small steps" in shared/spedExemplar.ts). */
export async function buildPack(ask: { title: string; grade: string; text: string }, images: string[], askAI: (a: SpedAsk) => Promise<string>, opts: { skipCheck?: boolean; setStage?: (s: string) => Promise<void> } = {}) {
  const setStage = opts.setStage ?? (async () => {});
  const input = lessonText(ask, images.length);
  await setStage("Writing the teacher guide");
  const frame = await askClean(askAI, exemplarPrompt(ask, "outline"), input, images, cleanExemplarFrame, 3, 8000);
  const guideSolved = await solveAll(ask, frame, unsolved(frame.sections), askAI, setStage, "Solving the guide’s problems");
  const exemplar: XExemplar = { ...frame, sections: fillOutline(frame.sections, guideSolved) };
  await setStage("Writing the practice pack");
  // The practice pack is told the guide's recipe and problems, so it practices the same skills with new numbers.
  const pframe = await askClean(askAI, practicePrompt(ask, exemplar, "outline"), input, images, cleanPracticeFrame, 3, 8000);
  const bookSolved = await solveAll(ask, exemplar, unsolved(pframe.book), askAI, setStage, "Solving the lesson’s practice problems");
  const practice: XPractice = { ...pframe, book: fillOutline(pframe.book, bookSolved) };
  const check = opts.skipCheck ? { checked: 0, flagged: 0 } : await checkPack(exemplar, practice, askAI, setStage);
  if (opts.skipCheck) for (const x of allProblems(exemplar, practice)) x.verified = true;
  if (opts.skipCheck) for (const x of practice.sheet) x.verified = true;
  return { exemplar, practice, check };
}

export function registerSpedExemplarRoutes(app: Express, auth: RequestHandler, deps: SpedDeps) {
  const now = deps.now ?? Date.now;
  const kv = deps.kv;
  const askAI = deps.askAI ?? askOpenAI;
  const aiConfigured = deps.aiConfigured ?? (() => !!process.env.OPENAI_API_KEY);
  const builds = createAttemptLimiter({ max: SPED_LIMITS.perDay, windowMs: 24 * 3600_000, now });

  const who = (req: any) => ({ id: Number(req.user?.id), teacher: req.user?.isAdmin === true || req.user?.role === "teacher", admin: req.user?.isAdmin === true });
  const getList = async (userId: number): Promise<string[]> => {
    const d = await kv.get(listKey(userId)).catch(() => null);
    return Array.isArray(d?.value) ? d!.value.filter((x: unknown) => typeof x === "string" && ID.test(x)) : [];
  };
  const getJob = async (id: string): Promise<Job | null> => {
    if (!ID.test(id)) return null;
    const d = await kv.get(jobKey(id)).catch(() => null);
    const j = d?.value && typeof d.value === "object" ? (d.value as Job) : null;
    if (j && j.status === "working" && now() - j.updatedAt > STALE_MS) return { ...j, status: "failed", error: "That build was interrupted. Tap Build again." };
    return j;
  };
  const putJob = (j: Job) => kv.set(jobKey(j.id), { ...j, updatedAt: now() });
  const fail = (res: any, e: any, what: string) => { console.error(`[sped-exemplar] ${what}:`, e?.message || e); res.status(500).json({ message: "The SPED Exemplar Maker couldn’t do that just now. Try again in a moment." }); };
  const gate = (req: any, res: any) => {
    const u = who(req);
    if (!u.id) { res.status(401).json({ message: "Log in to use the SPED Exemplar Maker." }); return null; }
    if (!u.teacher) { res.status(403).json({ message: "The SPED Exemplar Maker is for teacher accounts." }); return null; }
    return u;
  };

  app.get("/api/sped-exemplar", auth, async (req: any, res: any) => {
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

  app.post("/api/sped-exemplar", auth, async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const u = gate(req, res); if (!u) return;
    if (!aiConfigured()) return res.status(503).json({ message: "The SPED Exemplar Maker isn’t turned on for this site yet." });
    const body = req.body ?? {};
    const typed = String(body.text ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, SPED_LIMITS.text);
    const title = String(body.title ?? "").replace(/\s+/g, " ").trim().slice(0, SPED_LIMITS.title);
    const grade = /^(K|[1-9]|1[0-2])$/.test(String(body.grade ?? "").trim()) ? String(body.grade).trim() : "";
    const photos = (Array.isArray(body.images) ? body.images : []).filter((x: unknown) => typeof x === "string" && x);
    if (photos.length > SPED_LIMITS.images) return res.status(400).json({ message: `Add up to ${SPED_LIMITS.images} photos at a time.` });
    if (photos.some((x: string) => x.length > SPED_LIMITS.imageChars || !IMAGE_RE.test(x))) return res.status(400).json({ message: "One of the photos couldn’t be read. Try a JPG or PNG photo or screenshot." });
    // Files: Word, Excel, PowerPoint, CSV and text become words; a PDF goes to the AI as it is (server/uploadText.ts).
    let up: { text: string; attachments: string[] };
    try { up = readUploads(body.files, SPED_LIMITS.text); } catch (e: any) { if (e instanceof UploadError) return res.status(400).json({ message: e.message }); throw e; }
    const images = [...photos, ...up.attachments];
    const text = [typed, up.text].filter(Boolean).join("\n\n").slice(0, SPED_LIMITS.text);
    // A link to the lesson page: its words are read for the build (see server/pageText.ts).
    const links = linksFrom(body.links);
    if (String(Array.isArray(body.links) ? body.links.join("") : body.links ?? "").trim() && !links.length) return res.status(400).json({ message: "That doesn’t look like a web address. Paste the full link, starting with https://" });
    if (!images.length && !links.length && text.length < 20) return res.status(400).json({ message: "Paste the lesson (at least a few lines), add a link to it, or add photos of it." });
    const wait = builds.retryAfter(String(u.id));
    if (wait) return res.status(429).json({ message: `That’s a lot of exemplars today! You can make another in ${waitWords(wait)}.` });
    builds.fail(String(u.id));
    const id = randomUUID();
    const job: Job = { id, ownerId: u.id, status: "working", stage: "Starting", startedAt: now(), updatedAt: now(), title: title || "New exemplar" };
    try {
      await putJob(job);
      await kv.set(listKey(u.id), [id, ...(await getList(u.id))].slice(0, 20));
    } catch (e) { return fail(res, e, "start"); }
    res.status(202).json({ id });
    // The build carries on after the answer is sent; the page polls GET /api/sped-exemplar/:id.
    void (async () => {
      try {
        let lessonText = text;
        if (links.length) {
          job.stage = "Reading the lesson page"; await putJob(job);
          const pages: PageText[] = [];
          for (const l of links) pages.push(await (deps.fetchPage ?? fetchPageText)(l));
          lessonText = [text, pagesText(pages, SPED_LIMITS.text)].filter(Boolean).join("\n\n").slice(0, SPED_LIMITS.text);
        }
        const built = await buildPack({ title, grade, text: lessonText }, images, askAI, { skipCheck: deps.skipCheck, setStage: async (stage) => { job.stage = stage; await putJob(job); } });
        const pack: SpedPack = { id, title: title || built.exemplar.title, grade: grade || built.exemplar.grade, createdAt: new Date(now()).toISOString(), ownerId: u.id, exemplar: built.exemplar, practice: built.practice, check: built.check };
        await putJob({ ...job, status: "done", stage: "Done", pack });
      } catch (e: any) {
        console.error("[sped-exemplar] build failed:", e?.message || e);
        await putJob({ ...job, status: "failed", stage: "Stopped", error: e instanceof SpedAiError || e instanceof PageError ? e.message : "The build didn’t finish. Tap Build again." }).catch(() => {});
      }
    })();
  });

  app.get("/api/sped-exemplar/:id", auth, async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const u = gate(req, res); if (!u) return;
    try {
      const j = await getJob(String(req.params.id));
      if (!j || (j.ownerId !== u.id && !u.admin)) return res.status(404).json({ message: "That exemplar isn’t here anymore." });
      res.json({ id: j.id, status: j.status, stage: j.stage, error: j.error, pack: j.pack });
    } catch (e) { fail(res, e, "open"); }
  });

  app.delete("/api/sped-exemplar/:id", auth, async (req: any, res: any) => {
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
