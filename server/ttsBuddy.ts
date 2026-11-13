// TTS Buddy (shared/ttsBuddy.ts says what it is). No accounts: a teacher's phone keeps a long random key, a child's
// laptop keeps its own, and the server only stores a hash of each. Nothing about the child is needed or kept beyond
// the answers on the current worksheet and an optional first name or seat number the teacher types.
//
// Teacher (header x-buddy-teacher):
//   GET    /api/buddy/teacher                       worksheets, class code, linked laptops and their progress
//   POST   /api/buddy/teacher/read                  photos of a worksheet → a new worksheet, split into items
//   GET    /api/buddy/teacher/worksheets/:wid       one worksheet
//   PUT    /api/buddy/teacher/worksheets/:wid       save edits
//   DELETE /api/buddy/teacher/worksheets/:wid
//   POST   /api/buddy/teacher/send                  this worksheet goes to every linked laptop (and the class code)
//   POST   /api/buddy/teacher/link                  link a laptop by the 4-digit code on its screen
//   PATCH  /api/buddy/teacher/laptops/:lid          rename (first name or seat), or {unlink: true}
// Laptop (header x-buddy-laptop):
//   POST   /api/buddy/laptop                        a new laptop: its id, key and code
//   GET    /api/buddy/laptop/:lid                   waiting (its code) or ready (the worksheet)
//   POST   /api/buddy/laptop/:lid/join              join with the teacher's class code
//   POST   /api/buddy/laptop/:lid/progress          answers so far, the step it's on, done
// Both:
//   POST   /api/buddy/speak                         one part of an item read aloud: mp3 + when each word is said
import type { Express } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createAttemptLimiter, clientAddress, waitWords } from "./attemptLimiter";
import { createMemoryKv, type FitKv } from "./fitKv";
import {
  LAPTOP_HOURS, LIMITS, PAIR_MINUTES, READ_PROMPT, alignWords, classCode, cleanName, cleanWorksheet, estimateTimes,
  normClass, normPair, pairCode, questionCount, shownFor, spokenFor, tokens, type Laptop, type Timed, type Worksheet,
} from "../shared/ttsBuddy";

export type Spoken = { audio: Buffer; type?: string; words: Timed[]; duration: number };
export type BuddyDeps = {
  kv?: FitKv;
  /** Reads the worksheet photos with the AI; returns its JSON reply. */
  readPhotos?: (images: string[]) => Promise<string>;
  /** The natural voice for a piece of text, with when each word is said. */
  speak?: (text: string) => Promise<Spoken>;
  aiConfigured?: () => boolean;
  now?: () => number;
  rand?: () => number;
};

const IMAGE_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;
/** Groq takes about 4 MB per request, so each page must stay under that once it's text. */
const MAX_IMAGE = 3_700_000;
const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 40);
const KEY_RE = /^[A-Za-z0-9_-]{32,80}$/;

type TeacherRec = { classCode: string; worksheets: string[]; laptops: string[]; current: string };
type LaptopRec = { secret: string; code: string; codeAt: number; teacher: string; laptop: Laptop | null; created: number };
type WsRec = { owner: string; ws: Worksheet };

/** Small write-through cache in front of the store: laptops ask every few seconds, so their reads stay in memory. */
function cachedKv(kv: FitKv): FitKv {
  const mem = new Map<string, any>();
  return {
    async get(k) {
      if (mem.has(k)) return structuredClone(mem.get(k));
      const v = await kv.get(k);
      mem.set(k, v); if (mem.size > 20_000) for (const x of Array.from(mem.keys()).slice(0, 5_000)) mem.delete(x);
      return structuredClone(v);
    },
    async set(k, v) { await kv.set(k, v); mem.set(k, v == null ? null : structuredClone(v)); },
  };
}

export function registerTtsBuddyRoutes(app: Express, deps: BuddyDeps = {}) {
  const now = deps.now ?? Date.now;
  const rand = deps.rand ?? Math.random;
  const kv = cachedKv(deps.kv ?? createMemoryKv());
  const readPhotos = deps.readPhotos ?? ((images: string[]) => readWorksheet(images));
  const speak = deps.speak ?? createBuddyVoice().speak;
  const aiConfigured = deps.aiConfigured ?? buddyAiReady;
  const readsByTeacher = createAttemptLimiter({ max: LIMITS.readsPerDay, windowMs: 24 * 3600_000, now });
  // A whole school usually shares one internet address, so the per-address limits are roomy.
  const readsByPlace = createAttemptLimiter({ max: LIMITS.readsPerDay * 10, windowMs: 24 * 3600_000, now });
  const newLaptops = createAttemptLimiter({ max: 600, windowMs: 3600_000, now });
  const linkTries = createAttemptLimiter({ max: 30, windowMs: 10 * 60_000, now });
  const iso = () => new Date(now()).toISOString();

  const K = { t: (id: string) => `buddy:teacher:${id}`, w: (id: string) => `buddy:ws:${id}`, l: (id: string) => `buddy:laptop:${id}`, p: (c: string) => `buddy:pair:${c}`, c: (c: string) => `buddy:class:${c}` };
  const teacherId = (req: any) => { const k = String(req.headers?.["x-buddy-teacher"] || ""); return KEY_RE.test(k) ? hash(`t|${k}`) : ""; };
  const getTeacher = async (tid: string): Promise<TeacherRec> => ({ classCode: "", worksheets: [], laptops: [], current: "", ...((await kv.get(K.t(tid))) || {}) });
  const getWs = async (wid: string): Promise<WsRec | null> => (/^[a-z0-9-]{8,40}$/i.test(wid) ? kv.get(K.w(wid)) : null);
  const ownWs = async (tid: string, wid: string) => { const r = await getWs(wid); return r && r.owner === tid ? r : null; };
  /** A laptop's link ends after a school day; it goes back to showing a code. */
  const live = (r: LaptopRec) => !!r.laptop && now() - Date.parse(r.laptop.linkedAt) < LAPTOP_HOURS * 3600_000;
  const getLaptop = async (req: any, lid: string): Promise<LaptopRec | null> => {
    if (!/^[a-z0-9-]{8,40}$/i.test(lid)) return null;
    const k = String(req.headers?.["x-buddy-laptop"] || "");
    const r: LaptopRec | null = KEY_RE.test(k) ? await kv.get(K.l(lid)) : null;
    return r && r.secret === hash(`l|${k}`) ? r : null;
  };

  /** A fresh 4-digit code nobody else is showing right now. */
  const freshPair = async (lid: string) => {
    for (let i = 0; i < 25; i++) {
      const code = pairCode(rand);
      const held: { lid: string; at: number } | null = await kv.get(K.p(code));
      if (!held || held.lid === lid || now() - held.at > PAIR_MINUTES * 60_000) { await kv.set(K.p(code), { lid, at: now() }); return code; }
    }
    throw new Error("no code free");
  };
  const ensureClassCode = async (tid: string, t: TeacherRec) => {
    if (t.classCode && (await kv.get(K.c(t.classCode))) === tid) return t.classCode;
    for (let i = 0; i < 25; i++) {
      const code = classCode(rand);
      if (!(await kv.get(K.c(code)))) { await kv.set(K.c(code), tid); t.classCode = code; return code; }
    }
    throw new Error("no class code free");
  };
  const link = async (tid: string, t: TeacherRec, lid: string, rec: LaptopRec, wid: string, name: string) => {
    if (rec.code) { const held = await kv.get(K.p(rec.code)); if (held?.lid === lid) await kv.set(K.p(rec.code), null); }
    rec.teacher = tid; rec.code = "";
    rec.laptop = { id: lid, name, worksheetId: wid, answers: {}, step: 0, done: false, seen: iso(), linkedAt: iso() };
    await kv.set(K.l(lid), rec);
    t.laptops = [lid, ...t.laptops.filter((x) => x !== lid)].slice(0, LIMITS.laptops);
  };
  const progressOf = (rec: LaptopRec, ws: Worksheet | null) => {
    const l = rec.laptop!;
    const qs = ws ? ws.items.filter((i) => i.kind !== "read") : [];
    return { ...l, answered: qs.filter((q) => (l.answers[q.id] || "").trim()).length, questions: qs.length, worksheetTitle: ws?.title || "" };
  };
  const bad = (res: any, status: number, message: string) => res.status(status).json({ message });

  // ---------------- Teacher ----------------
  app.get("/api/buddy/teacher", async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const tid = teacherId(req); if (!tid) return bad(res, 401, "Open TTS Buddy again to start.");
    const t = await getTeacher(tid);
    const worksheets = (await Promise.all(t.worksheets.map((id) => getWs(id)))).filter((r): r is WsRec => !!r && r.owner === tid)
      .map(({ ws }) => ({ id: ws.id, title: ws.title, questions: questionCount(ws), steps: ws.items.length, createdAt: ws.createdAt }));
    const wsCache = new Map<string, Worksheet | null>();
    const laptops = [];
    for (const lid of t.laptops) {
      const rec: LaptopRec | null = await kv.get(K.l(lid));
      if (!rec || rec.teacher !== tid || !live(rec)) continue;
      const wid = rec.laptop!.worksheetId;
      if (!wsCache.has(wid)) wsCache.set(wid, (await getWs(wid))?.ws ?? null);
      laptops.push(progressOf(rec, wsCache.get(wid)!));
    }
    res.json({ classCode: t.classCode, current: t.current, worksheets, laptops, aiReady: aiConfigured() });
  });

  app.post("/api/buddy/teacher/read", async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const tid = teacherId(req); if (!tid) return bad(res, 401, "Open TTS Buddy again to start.");
    if (!aiConfigured()) return bad(res, 503, "Reading worksheets isn't turned on yet.");
    const sent = Array.isArray(req.body?.images) ? req.body.images.length : 0;
    const images: string[] = Array.isArray(req.body?.images) ? req.body.images.filter((s: unknown) => typeof s === "string" && IMAGE_RE.test(s) && s.length <= MAX_IMAGE).slice(0, LIMITS.pages) : [];
    if (!images.length) return bad(res, 400, sent ? "That photo is too big or isn't a picture. Take it again." : "Add a photo of the worksheet.");
    const place = clientAddress(req);
    const wait = Math.max(readsByTeacher.retryAfter(tid), readsByPlace.retryAfter(place));
    if (wait) return bad(res, 429, `That's a lot of worksheets today. Try again in ${waitWords(wait)}.`);
    readsByTeacher.fail(tid); readsByPlace.fail(place);
    let raw: any;
    try { raw = looseJson(await readPhotos(images)); } catch (e: any) { console.error("[tts-buddy] read failed:", e?.message); return bad(res, 502, e?.message || "Couldn't read that worksheet. Try again."); }
    const ws = cleanWorksheet({ ...raw, pages: images.length }, randomUUID(), iso());
    if (!ws.items.length) return bad(res, 422, "That doesn't look like a worksheet I can read. Try a clearer photo, straight on, with the whole page in view.");
    await kv.set(K.w(ws.id), { owner: tid, ws } satisfies WsRec);
    const t = await getTeacher(tid);
    const dropped = t.worksheets.slice(LIMITS.worksheets - 1);
    t.worksheets = [ws.id, ...t.worksheets].slice(0, LIMITS.worksheets);
    for (const id of dropped) await kv.set(K.w(id), null);
    await kv.set(K.t(tid), t);
    res.json({ worksheet: ws });
  });

  app.get("/api/buddy/teacher/worksheets/:wid", async (req: any, res: any) => {
    const tid = teacherId(req); if (!tid) return bad(res, 401, "Open TTS Buddy again to start.");
    const r = await ownWs(tid, req.params.wid); if (!r) return bad(res, 404, "That worksheet is gone.");
    res.json({ worksheet: r.ws });
  });

  app.put("/api/buddy/teacher/worksheets/:wid", async (req: any, res: any) => {
    const tid = teacherId(req); if (!tid) return bad(res, 401, "Open TTS Buddy again to start.");
    const r = await ownWs(tid, req.params.wid); if (!r) return bad(res, 404, "That worksheet is gone.");
    const ws = cleanWorksheet({ ...req.body, pages: r.ws.pages, createdAt: r.ws.createdAt }, r.ws.id, iso());
    if (!ws.items.length) return bad(res, 400, "A worksheet needs at least one question.");
    await kv.set(K.w(ws.id), { owner: tid, ws } satisfies WsRec);
    res.json({ worksheet: ws });
  });

  app.delete("/api/buddy/teacher/worksheets/:wid", async (req: any, res: any) => {
    const tid = teacherId(req); if (!tid) return bad(res, 401, "Open TTS Buddy again to start.");
    const r = await ownWs(tid, req.params.wid); if (!r) return res.json({ ok: true });
    await kv.set(K.w(r.ws.id), null);
    const t = await getTeacher(tid);
    t.worksheets = t.worksheets.filter((x) => x !== r.ws.id); if (t.current === r.ws.id) t.current = "";
    await kv.set(K.t(tid), t);
    res.json({ ok: true });
  });

  app.post("/api/buddy/teacher/send", async (req: any, res: any) => {
    const tid = teacherId(req); if (!tid) return bad(res, 401, "Open TTS Buddy again to start.");
    const r = await ownWs(tid, String(req.body?.worksheetId || "")); if (!r) return bad(res, 404, "That worksheet is gone.");
    const t = await getTeacher(tid);
    await ensureClassCode(tid, t);
    t.current = r.ws.id;
    let sent = 0;
    for (const lid of t.laptops) {
      const rec: LaptopRec | null = await kv.get(K.l(lid));
      if (!rec || rec.teacher !== tid || !live(rec)) continue;
      if (rec.laptop!.worksheetId !== r.ws.id) { rec.laptop = { ...rec.laptop!, worksheetId: r.ws.id, answers: {}, step: 0, done: false }; await kv.set(K.l(lid), rec); }
      sent++;
    }
    await kv.set(K.t(tid), t);
    res.json({ classCode: t.classCode, sent });
  });

  app.post("/api/buddy/teacher/link", async (req: any, res: any) => {
    const tid = teacherId(req); if (!tid) return bad(res, 401, "Open TTS Buddy again to start.");
    const wait = linkTries.retryAfter(tid); if (wait) return bad(res, 429, `Too many codes tried. Wait ${waitWords(wait)}.`);
    const code = normPair(req.body?.code);
    if (code.length !== 4) return bad(res, 400, "Type the 4 numbers on the laptop's screen.");
    const r = await ownWs(tid, String(req.body?.worksheetId || "")); if (!r) return bad(res, 404, "Pick a worksheet to send first.");
    const held: { lid: string; at: number } | null = await kv.get(K.p(code));
    const rec: LaptopRec | null = held && now() - held.at <= PAIR_MINUTES * 60_000 ? await kv.get(K.l(held.lid)) : null;
    if (!held || !rec || rec.code !== code) { linkTries.fail(tid); return bad(res, 404, "No laptop is showing that code. Check the numbers, or reload the page on the laptop."); }
    const t = await getTeacher(tid);
    await link(tid, t, held.lid, rec, r.ws.id, cleanName(req.body?.name));
    await ensureClassCode(tid, t);
    if (!t.current) t.current = r.ws.id;
    await kv.set(K.t(tid), t);
    res.json({ laptop: progressOf(rec, r.ws) });
  });

  app.patch("/api/buddy/teacher/laptops/:lid", async (req: any, res: any) => {
    const tid = teacherId(req); if (!tid) return bad(res, 401, "Open TTS Buddy again to start.");
    const rec: LaptopRec | null = /^[a-z0-9-]{8,40}$/i.test(req.params.lid) ? await kv.get(K.l(req.params.lid)) : null;
    if (!rec || rec.teacher !== tid || !rec.laptop) return bad(res, 404, "That laptop isn't linked anymore.");
    const t = await getTeacher(tid);
    if (req.body?.unlink) {
      rec.laptop = null; rec.teacher = "";
      await kv.set(K.l(req.params.lid), rec);
      t.laptops = t.laptops.filter((x) => x !== req.params.lid); await kv.set(K.t(tid), t);
      return res.json({ ok: true });
    }
    if (typeof req.body?.name === "string") rec.laptop.name = cleanName(req.body.name);
    if (req.body?.restart) rec.laptop = { ...rec.laptop, answers: {}, step: 0, done: false };
    await kv.set(K.l(req.params.lid), rec);
    res.json({ ok: true });
  });

  // ---------------- Laptop ----------------
  app.post("/api/buddy/laptop", async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const place = clientAddress(req);
    const wait = newLaptops.retryAfter(place); if (wait) return bad(res, 429, `Try again in ${waitWords(wait)}.`);
    newLaptops.fail(place);
    const id = randomUUID(); const key = randomBytes(24).toString("base64url");
    const code = await freshPair(id);
    await kv.set(K.l(id), { secret: hash(`l|${key}`), code, codeAt: now(), teacher: "", laptop: null, created: now() } satisfies LaptopRec);
    res.json({ id, key, code });
  });

  app.get("/api/buddy/laptop/:lid", async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const rec = await getLaptop(req, req.params.lid); if (!rec) return bad(res, 404, "start over");
    if (!live(rec)) {
      if (rec.laptop) { rec.laptop = null; rec.teacher = ""; }
      if (!rec.code || now() - rec.codeAt > (PAIR_MINUTES - 2) * 60_000) { rec.code = await freshPair(req.params.lid); rec.codeAt = now(); await kv.set(K.l(req.params.lid), rec); }
      return res.json({ state: "waiting", code: rec.code });
    }
    const l = rec.laptop!;
    if (now() - Date.parse(l.seen) > 20_000) { l.seen = iso(); await kv.set(K.l(req.params.lid), rec); }
    const ws = (await getWs(l.worksheetId))?.ws;
    if (!ws) return res.json({ state: "linked", name: l.name });
    res.json({ state: "ready", name: l.name, worksheet: ws, answers: l.answers, step: l.step, done: l.done });
  });

  app.post("/api/buddy/laptop/:lid/join", async (req: any, res: any) => {
    const rec = await getLaptop(req, req.params.lid); if (!rec) return bad(res, 404, "start over");
    const wait = linkTries.retryAfter(`l:${req.params.lid}`); if (wait) return bad(res, 429, `Too many tries. Wait ${waitWords(wait)}.`);
    const code = normClass(req.body?.classCode);
    const tid: string | null = code.length === 4 ? await kv.get(K.c(code)) : null;
    const t = tid ? await getTeacher(tid) : null;
    if (!tid || !t || t.classCode !== code) { linkTries.fail(`l:${req.params.lid}`); return bad(res, 404, "That class code didn't work. Check the letters with your teacher."); }
    if (!t.current || !(await ownWs(tid, t.current))) return bad(res, 409, "Your teacher hasn't sent a worksheet yet. Try again in a moment.");
    await link(tid, t, req.params.lid, rec, t.current, cleanName(req.body?.name));
    await kv.set(K.t(tid), t);
    res.json({ ok: true });
  });

  app.post("/api/buddy/laptop/:lid/progress", async (req: any, res: any) => {
    const rec = await getLaptop(req, req.params.lid); if (!rec || !live(rec)) return bad(res, 404, "start over");
    const ws = (await getWs(rec.laptop!.worksheetId))?.ws;
    if (!ws || req.body?.worksheetId !== ws.id) return bad(res, 409, "Your teacher sent a new worksheet.");
    const ids = new Set(ws.items.map((i) => i.id));
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.body?.answers || {})) if (ids.has(k) && typeof v === "string") answers[k] = v.slice(0, 2000);
    rec.laptop = { ...rec.laptop!, answers, step: Math.max(0, Math.min(ws.items.length, Number(req.body?.step) || 0)), done: req.body?.done === true, seen: iso() };
    await kv.set(K.l(req.params.lid), rec);
    res.json({ ok: true });
  });

  // ---------------- Voice ----------------
  app.post("/api/buddy/speak", async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const wid = String(req.body?.worksheetId || "");
    let ws: Worksheet | null = null;
    const tid = teacherId(req);
    if (tid) ws = (await ownWs(tid, wid))?.ws ?? null;
    if (!ws && req.body?.laptopId) {
      const rec = await getLaptop(req, String(req.body.laptopId));
      if (rec && live(rec) && rec.laptop!.worksheetId === wid) ws = (await getWs(wid))?.ws ?? null;
    }
    if (!ws) return bad(res, 403, "That worksheet isn't on this device.");
    const item = ws.items.find((i) => i.id === req.body?.itemId);
    const part = String(req.body?.part || "q");
    const said = item ? spokenFor(item, part) : "";
    if (!item || !said) return bad(res, 404, "Nothing to read there.");
    let spoken: Spoken;
    try { spoken = await speak(said); } catch (e: any) { console.error("[tts-buddy] voice failed:", e?.message); return bad(res, 503, "The voice isn't available right now."); }
    const shown = tokens(shownFor(item, part)).map((t) => t.w);
    const words = spoken.words.length ? alignWords(shown, spoken.words, spoken.duration) : estimateTimes(shown, spoken.duration);
    res.json({ audio: `data:${spoken.type || "audio/mpeg"};base64,${spoken.audio.toString("base64")}`, words, duration: spoken.duration });
  });
}

// ---------------- The AI pieces ----------------
// This site's AI runs on Groq (server/aiProvider.ts: OpenAI is off, and any request to OpenAI's chat is quietly sent
// to Groq's text-only model, which can't see photos). So the worksheet photos go straight to Groq's vision model,
// one page per request (Groq takes up to about 4 MB per request), and OpenAI is used only when the site turns it on.
const openAiOn = () => !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "routed-to-grok" && process.env.USE_OPENAI === "1";
export const buddyAiReady = () => !!process.env.GROQ_API_KEY || openAiOn();
const GROQ = "https://api.groq.com/openai/v1";
const VISION_MODELS = () => Array.from(new Set([process.env.GROQ_VISION_MODEL, "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"].filter(Boolean) as string[]));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The JSON in a model's reply, even when it wrapped it in a code fence or a sentence. */
export function looseJson(text: string): any {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch { /* look inside */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* not JSON */ } }
  return null;
}

type Chat = (url: string, key: string, body: any) => Promise<Response>;
const post: Chat = (url, key, body) => fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) });

/** One page → {title, items}. Retries when busy, tries the next vision model if one is retired, and drops JSON mode
 *  if a model refuses it. */
export async function readPage(image: string, page: number, pages: number, chat: Chat = post): Promise<{ title: string; items: any[] }> {
  const text = `${READ_PROMPT}\n\n${pages > 1 ? `This is page ${page} of ${pages}.` : "Here is the worksheet."} Reply with the JSON only.`;
  const messages = [{ role: "user", content: [{ type: "text", text }, { type: "image_url", image_url: { url: image } }] }];
  let lastStatus = 0;
  const tries: [string, string, string][] = [];
  if (process.env.GROQ_API_KEY) for (const m of VISION_MODELS()) tries.push([`${GROQ}/chat/completions`, process.env.GROQ_API_KEY, m]);
  if (openAiOn()) tries.push(["https://api.openai.com/v1/chat/completions", process.env.OPENAI_API_KEY!, "gpt-4.1"]);
  for (const [url, key, model] of tries) {
    let json = true;
    for (let attempt = 0; attempt < 4; attempt++) {
      let r: Response;
      try { r = await chat(url, key, { model, temperature: 0, max_tokens: 6000, ...(json ? { response_format: { type: "json_object" } } : {}), messages }); }
      catch (e: any) { if (attempt < 2) { await wait(1500); continue; } lastStatus = -1; break; }
      if (r.ok) {
        const body: any = await r.json().catch(() => null);
        const parsed = looseJson(body?.choices?.[0]?.message?.content || "");
        if (parsed && Array.isArray(parsed.items)) return { title: String(parsed.title || ""), items: parsed.items };
        if (attempt < 1) continue; // asked again once: models sometimes trip on long JSON
        lastStatus = 422; break;
      }
      lastStatus = r.status;
      const why = await r.text().catch(() => "");
      console.error(`[tts-buddy] ${model} page ${page}: ${r.status} ${why.slice(0, 300)}`);
      if (r.status === 400 && json && /response_format|json/i.test(why)) { json = false; continue; }
      if (r.status === 429 || r.status >= 500) { await wait(Math.min(12, Number(r.headers.get("retry-after")) || 2 * 2 ** attempt) * 1000); continue; }
      break; // this model can't take it (retired, too big): the next one
    }
  }
  if (lastStatus === 429) throw new Error("The reader is busy right now. Try again in a minute.");
  if (lastStatus === 413) throw new Error("That photo is too big. Try again, a little farther back.");
  throw new Error(lastStatus === 422 ? "Couldn't make out the questions on that page. Try a clearer photo, straight on, in good light." : "Couldn't reach the worksheet reader. Try again in a moment.");
}

/** All the pages at once; the items come back in page order as one worksheet. */
export async function readWorksheet(images: string[], read = readPage): Promise<string> {
  const pages = await Promise.all(images.map((img, i) => read(img, i + 1, images.length)));
  return JSON.stringify({ title: pages.find((p) => p.title.trim())?.title || "", items: pages.flatMap((p) => p.items) });
}

const VOICE_VERSION = "v2";
const BUCKET = "buddy-voice";
/** The site's own read-aloud voice (server/groqVoice.ts: Groq's Orpheus, then Deepgram's Aura, then OpenAI's).
 *  "autumn" is the warm, unhurried one. Then Groq's Whisper hears it back with the time of every word, so the words
 *  on screen light up when they're said. Each piece of text is made once and kept (memory, then Supabase Storage). */
export function createBuddyVoice(opts: { storage?: () => any } = {}) {
  const memory = new Map<string, Spoken>();
  const inFlight = new Map<string, Promise<Spoken>>();
  let bucket: Promise<unknown> | null = null;
  const storage = async () => (opts.storage ? opts.storage() : (await import("./supabase")).getAdminSupabase().storage);
  const remember = (id: string, s: Spoken) => { memory.delete(id); memory.set(id, s); while (memory.size > 400) memory.delete(memory.keys().next().value as string); };

  async function timings(audio: Buffer, type: string): Promise<{ words: Timed[]; duration: number }> {
    const ask = async (url: string, key: string, model: string) => {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(audio)], { type }), type === "audio/wav" ? "speech.wav" : "speech.mp3");
      form.append("model", model); form.append("language", "en");
      form.append("response_format", "verbose_json"); form.append("timestamp_granularities[]", "word");
      const t = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(30_000) });
      if (!t.ok) throw new Error(`timings ${t.status} ${(await t.text().catch(() => "")).slice(0, 200)}`);
      const j: any = await t.json();
      return { duration: Number(j.duration) || 0, words: (j.words || []).map((w: any) => ({ word: String(w.word), start: Number(w.start) || 0, end: Number(w.end) || 0 })) };
    };
    try {
      if (process.env.GROQ_API_KEY) return await ask(`${GROQ}/audio/transcriptions`, process.env.GROQ_API_KEY, "whisper-large-v3-turbo");
      if (openAiOn()) return await ask("https://api.openai.com/v1/audio/transcriptions", process.env.OPENAI_API_KEY!, "whisper-1");
    } catch (e: any) { console.warn("[tts-buddy] word timings:", e?.message); }
    return { words: [], duration: 0 };
  }

  async function make(text: string): Promise<Spoken> {
    const { aiSpeech } = await import("./groqVoice");
    const s = await aiSpeech(text, "autumn");
    const t = await timings(s.audio, s.type);
    // Without timings the page spreads the words evenly; about 2.6 words a second at this pace.
    return { audio: s.audio, type: s.type, words: t.words, duration: t.duration || Math.max(1, text.split(/\s+/).length / 2.6) };
  }

  return {
    async speak(text: string): Promise<Spoken> {
      const id = createHash("sha1").update(`${VOICE_VERSION}|${text}`).digest("hex");
      const hit = memory.get(id); if (hit) { remember(id, hit); return hit; }
      let p = inFlight.get(id);
      if (!p) {
        p = (async () => {
          try {
            const s = await storage();
            const m = await s.from(BUCKET).download(`${id}.json`);
            if (m.data) {
              const meta = JSON.parse(await m.data.text());
              const a = await s.from(BUCKET).download(`${id}.${meta.type === "audio/wav" ? "wav" : "mp3"}`);
              if (a.data) return { audio: Buffer.from(await a.data.arrayBuffer()), type: meta.type || "audio/mpeg", words: meta.words || [], duration: meta.duration || 0 };
            }
          } catch { /* not saved yet */ }
          const made = await make(text);
          void (async () => {
            try {
              const s = await storage();
              await (bucket ??= s.createBucket(BUCKET, { public: false, fileSizeLimit: "8MB" }).catch(() => null));
              await s.from(BUCKET).upload(`${id}.${made.type === "audio/wav" ? "wav" : "mp3"}`, made.audio, { contentType: made.type, upsert: true });
              await s.from(BUCKET).upload(`${id}.json`, Buffer.from(JSON.stringify({ type: made.type, words: made.words, duration: made.duration })), { contentType: "application/json", upsert: true });
            } catch { /* made again next time */ }
          })();
          return made;
        })().finally(() => inFlight.delete(id));
        inFlight.set(id, p);
      }
      const s = await p; remember(id, s); return s;
    },
  };
}
