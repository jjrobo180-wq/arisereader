// Accountability (an Arise To Duo app, shared/accountability.ts): shared spaces where people ask each
// other for things, get nudged until they're done, and check them off with proof (a photo or video,
// a filled-in worksheet, a quiz a child took). Spaces, members, tasks and check-ins are rows in
// Supabase (acct_* tables), so everyone in a space sees the same thing on every device. Proof files
// sit in a private bucket and are only ever opened through short signed links, by members.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import {
  LIMITS, QUIZ_PROMPT, WORKSHEET_PROMPT, aiUserMessage, cleanAiAsk, cleanAnswers, cleanCode, cleanQuiz, cleanTask, cleanWorksheet, dueOn,
  inviteCode, isDone, localNow, newId, nudgeNow, nudgeText, scoreQuiz, type AcctTask, type Checkin, type Member, type Proof, type Space,
} from "../shared/accountability";
import { goUrl } from "../shared/todoReminders";

type Db = { from: (table: string) => any; storage: { from: (bucket: string) => any } };
type Push = (userId: number, message: { title: string; body: string; url?: string; tag?: string }) => Promise<number>;
type Ask = (system: string, user: string) => Promise<string>;
export type AccountabilityDeps = {
  db: () => Db;
  push: Push;
  ask?: Ask;
  aiReady?: () => boolean;
  nameOf: (userId: number) => Promise<string>;
  now?: () => number;
};

const BUCKET = "accountability-proof";
const PROOF_TYPES: Record<string, { ext: string; kind: Proof["type"]; maxMb: number }> = {
  "image/jpeg": { ext: "jpg", kind: "photo", maxMb: 15 }, "image/png": { ext: "png", kind: "photo", maxMb: 15 }, "image/webp": { ext: "webp", kind: "photo", maxMb: 15 },
  "image/heic": { ext: "heic", kind: "photo", maxMb: 15 },
  "video/mp4": { ext: "mp4", kind: "video", maxMb: 100 }, "video/quicktime": { ext: "mov", kind: "video", maxMb: 100 }, "video/webm": { ext: "webm", kind: "video", maxMb: 100 },
};
const URL_FOR = (taskId: string) => goUrl("accountability", `task=${encodeURIComponent(taskId)}`);
const TZ = (v: unknown) => (typeof v === "string" && /^[A-Za-z_+\-/0-9]{1,60}$/.test(v) ? v : "");

const rowToTask = (r: any): AcctTask => ({ ...(r.data || {}), id: r.id, spaceId: r.space_id, assignee: r.assignee, createdBy: r.created_by, archived: !!r.archived, createdAt: r.created_at });
const rowToCheckin = (r: any): Checkin => ({ note: "", proof: [], answers: {}, score: null, feedback: "", reviewedBy: null, reviewedAt: null, status: "done", ...(r.data || {}), id: r.id, taskId: r.task_id, spaceId: r.space_id, day: r.day, by: r.by_user, at: r.at });

let bucketReady: Promise<void> | null = null;
function ensureBucket(db: Db) {
  bucketReady ??= Promise.resolve(db.storage.createBucket?.(BUCKET, { public: false, fileSizeLimit: "100MB", allowedMimeTypes: Object.keys(PROOF_TYPES) }))
    .then((r: any) => { if (r?.error && !/already exists|duplicate/i.test(r.error.message || "")) console.error("[accountability] bucket:", r.error.message); })
    .catch((e: any) => console.error("[accountability] bucket check:", e?.message));
  return bucketReady;
}

/** The site's AI (OpenAI), asked for a JSON object. */
const openAiJson: Ask = async (system, user) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0.7, max_tokens: 2500, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(res.status === 429 ? "busy" : "failed");
  const body: any = await res.json().catch(() => null);
  return String(body?.choices?.[0]?.message?.content || "");
};

export function registerAccountabilityRoutes(app: Express, authMiddleware: RequestHandler, deps: AccountabilityDeps) {
  const now = deps.now ?? Date.now;
  const db = () => deps.db();
  const ask = deps.ask ?? openAiJson;
  const aiReady = deps.aiReady ?? (() => !!process.env.OPENAI_API_KEY);
  const writes = createAttemptLimiter({ max: 400, windowMs: 3600_000, now });
  const joins = createAttemptLimiter({ max: 20, windowMs: 3600_000, now });
  const pokes = createAttemptLimiter({ max: 30, windowMs: 3600_000, now });
  const ais = createAttemptLimiter({ max: 30, windowMs: 3600_000, now });

  const me = (req: any, res: any): number | null => {
    const id = Number(req.user?.id);
    if (!Number.isSafeInteger(id) || req.adminPreview) { res.status(403).json({ message: "Sign in to your own account to use Accountability." }); return null; }
    return id;
  };
  const limited = (lim: ReturnType<typeof createAttemptLimiter>, key: string, res: any) => {
    const wait = lim.retryAfter(key);
    if (wait > 0) { res.status(429).json({ message: `Slow down a little. Try again in ${waitWords(wait)}.` }); return true; }
    lim.fail(key); return false;
  };
  const fail = (res: any, e: any, what: string) => { console.error(`[accountability] ${what}:`, e?.message || e); res.status(500).json({ message: "Accountability couldn't do that just now. Try again in a moment." }); };

  const mySpaceIds = async (userId: number): Promise<string[]> => {
    const { data, error } = await db().from("acct_members").select("space_id").eq("user_id", userId);
    if (error) throw error;
    return (data || []).map((r: any) => r.space_id);
  };
  const membersOf = async (spaceIds: string[]): Promise<Map<string, Member[]>> => {
    const out = new Map<string, Member[]>();
    if (!spaceIds.length) return out;
    const { data, error } = await db().from("acct_members").select("space_id, user_id, name, role, tz").in("space_id", spaceIds);
    if (error) throw error;
    for (const r of data || []) out.set(r.space_id, [...(out.get(r.space_id) || []), { userId: r.user_id, name: r.name || "", role: r.role === "owner" ? "owner" : "member", tz: r.tz || "" }]);
    return out;
  };
  const memberOf = async (userId: number, spaceId: string): Promise<Member[] | null> => {
    const m = (await membersOf([spaceId])).get(spaceId) || [];
    return m.some((x) => x.userId === userId) ? m : null;
  };
  const taskById = async (id: string): Promise<AcctTask | null> => {
    const { data, error } = await db().from("acct_tasks").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToTask(data) : null;
  };
  const nameIn = (members: Member[], userId: number) => members.find((m) => m.userId === userId)?.name || "Your partner";

  /** Everything for this person: their spaces, members, tasks, and the last 60 days of check-ins. */
  app.get("/api/accountability", authMiddleware, async (req: any, res) => {
    const userId = me(req, res); if (userId == null) return;
    try {
      res.set("Cache-Control", "no-store");
      const tz = TZ(req.query.tz);
      if (tz) await db().from("acct_members").update({ tz }).eq("user_id", userId).neq("tz", tz);
      const ids = await mySpaceIds(userId);
      if (!ids.length) return res.json({ me: userId, spaces: [], tasks: [], checkins: [] });
      const [{ data: spaces, error: e1 }, members, { data: tasks, error: e2 }, { data: checks, error: e3 }] = await Promise.all([
        db().from("acct_spaces").select("id, name, code, created_by").in("id", ids),
        membersOf(ids),
        db().from("acct_tasks").select("*").in("space_id", ids).eq("archived", false).order("created_at", { ascending: true }).limit(2000),
        db().from("acct_checkins").select("*").in("space_id", ids).gte("day", new Date(now() - 62 * 86_400_000).toISOString().slice(0, 10)).order("at", { ascending: false }).limit(5000),
      ]);
      if (e1 || e2 || e3) throw e1 || e2 || e3;
      const out: Space[] = (spaces || []).map((s: any) => ({ id: s.id, name: s.name, code: s.code, createdBy: s.created_by, members: members.get(s.id) || [] }));
      res.json({ me: userId, spaces: out, tasks: (tasks || []).map(rowToTask), checkins: (checks || []).map(rowToCheckin) });
    } catch (e) { fail(res, e, "load"); }
  });

  /** A new space; whoever makes it is its first member. Body { name, myName, tz }. */
  app.post("/api/accountability/spaces", authMiddleware, async (req: any, res) => {
    const userId = me(req, res); if (userId == null) return;
    if (limited(writes, String(userId), res)) return;
    try {
      if ((await mySpaceIds(userId)).length >= LIMITS.spacesPerUser) return res.status(400).json({ message: `You can be in up to ${LIMITS.spacesPerUser} spaces.` });
      const name = String(req.body?.name || "").trim().slice(0, LIMITS.spaceName) || "Our space";
      const myName = String(req.body?.myName || "").trim().slice(0, LIMITS.name) || (await deps.nameOf(userId)) || "Me";
      const id = newId();
      let code = inviteCode();
      for (let i = 0; i < 4; i++) { const { data } = await db().from("acct_spaces").select("id").eq("code", code).maybeSingle(); if (!data) break; code = inviteCode(); }
      const { error } = await db().from("acct_spaces").insert({ id, name, code, created_by: userId });
      if (error) throw error;
      const { error: e2 } = await db().from("acct_members").insert({ space_id: id, user_id: userId, name: myName, role: "owner", tz: TZ(req.body?.tz) || "" });
      if (e2) throw e2;
      res.json({ ok: true, id, code });
    } catch (e) { fail(res, e, "new space"); }
  });

  /** Join with an invite code. Body { code, myName, tz }. */
  app.post("/api/accountability/join", authMiddleware, async (req: any, res) => {
    const userId = me(req, res); if (userId == null) return;
    if (limited(joins, String(userId), res)) return;
    try {
      const code = cleanCode(req.body?.code);
      const { data: space, error } = await db().from("acct_spaces").select("id, name, created_by").eq("code", code).maybeSingle();
      if (error) throw error;
      if (!space) return res.status(404).json({ message: "That invite code didn't match a space. Check it and try again." });
      const members = (await membersOf([space.id])).get(space.id) || [];
      if (members.some((m) => m.userId === userId)) return res.json({ ok: true, id: space.id, already: true });
      if (members.length >= LIMITS.membersPerSpace) return res.status(400).json({ message: "That space is full." });
      const myName = String(req.body?.myName || "").trim().slice(0, LIMITS.name) || (await deps.nameOf(userId)) || "Partner";
      const { error: e2 } = await db().from("acct_members").insert({ space_id: space.id, user_id: userId, name: myName, role: "member", tz: TZ(req.body?.tz) || "" });
      if (e2) throw e2;
      for (const m of members) void deps.push(m.userId, { title: `${myName} joined ${space.name}`, body: "You can ask each other for things now.", url: goUrl("accountability"), tag: `acct-join-${space.id}` }).catch(() => {});
      res.json({ ok: true, id: space.id });
    } catch (e) { fail(res, e, "join"); }
  });

  /** Rename the space, change your own name, or make a new invite code. Body { name?, myName?, newCode? }. */
  app.patch("/api/accountability/spaces/:id", authMiddleware, async (req: any, res) => {
    const userId = me(req, res); if (userId == null) return;
    if (limited(writes, String(userId), res)) return;
    try {
      const members = await memberOf(userId, String(req.params.id));
      if (!members) return res.status(404).json({ message: "That space isn't yours." });
      const owner = members.find((m) => m.userId === userId)?.role === "owner";
      const patch: any = {};
      if (typeof req.body?.name === "string" && owner) patch.name = req.body.name.trim().slice(0, LIMITS.spaceName) || "Our space";
      if (req.body?.newCode && owner) patch.code = inviteCode();
      if (Object.keys(patch).length) { const { error } = await db().from("acct_spaces").update(patch).eq("id", req.params.id); if (error) throw error; }
      if (typeof req.body?.myName === "string" && req.body.myName.trim()) {
        const { error } = await db().from("acct_members").update({ name: req.body.myName.trim().slice(0, LIMITS.name) }).eq("space_id", req.params.id).eq("user_id", userId);
        if (error) throw error;
      }
      res.json({ ok: true, code: patch.code });
    } catch (e) { fail(res, e, "space update"); }
  });

  /** Leave a space (the last one out deletes it, with its tasks, check-ins and proof). */
  app.post("/api/accountability/spaces/:id/leave", authMiddleware, async (req: any, res) => {
    const userId = me(req, res); if (userId == null) return;
    try {
      const id = String(req.params.id);
      const members = await memberOf(userId, id);
      if (!members) return res.json({ ok: true });
      const { error } = await db().from("acct_members").delete().eq("space_id", id).eq("user_id", userId);
      if (error) throw error;
      if (members.length <= 1) {
        const { data: files } = await db().from("acct_checkins").select("data").eq("space_id", id);
        const paths = (files || []).flatMap((r: any) => (r.data?.proof || []).map((p: Proof) => p.path)).filter(Boolean);
        if (paths.length) await db().storage.from(BUCKET).remove(paths).catch?.(() => {});
        await db().from("acct_spaces").delete().eq("id", id);
      } else if (members.find((m) => m.userId === userId)?.role === "owner") {
        const next = members.find((m) => m.userId !== userId)!;
        await db().from("acct_members").update({ role: "owner" }).eq("space_id", id).eq("user_id", next.userId);
      }
      res.json({ ok: true });
    } catch (e) { fail(res, e, "leave"); }
  });

  /** A new task, or a change to one. Body { spaceId, task }. */
  const saveTask = async (req: any, res: any, existing: AcctTask | null) => {
    const userId = me(req, res); if (userId == null) return;
    if (limited(writes, String(userId), res)) return;
    try {
      const spaceId = existing?.spaceId || String(req.body?.spaceId || "");
      const members = await memberOf(userId, spaceId);
      if (!members) return res.status(404).json({ message: "That space isn't yours." });
      if (existing && existing.createdBy !== userId && existing.assignee !== userId) return res.status(403).json({ message: "Only the person who asked can change this." });
      const t = cleanTask(req.body?.task, members.map((m) => m.userId));
      if (!t) return res.status(400).json({ message: "Give it a name and pick who it's for." });
      if (existing) {
        const { error } = await db().from("acct_tasks").update({ data: t, assignee: t.assignee, updated_at: new Date(now()).toISOString() }).eq("id", existing.id);
        if (error) throw error;
        return res.json({ ok: true, id: existing.id });
      }
      const { count } = await db().from("acct_tasks").select("id", { count: "exact", head: true }).eq("space_id", spaceId).eq("archived", false);
      if ((count || 0) >= LIMITS.tasksPerSpace) return res.status(400).json({ message: "This space has as many tasks as it can hold. Remove a few first." });
      const id = newId();
      const { error } = await db().from("acct_tasks").insert({ id, space_id: spaceId, data: t, assignee: t.assignee, created_by: userId });
      if (error) throw error;
      if (t.assignee !== userId) {
        const asker = nameIn(members, userId);
        void deps.push(t.assignee, { title: `${asker} asked: ${t.title}`, body: `${t.kind === "worksheet" ? "A worksheet" : t.kind === "quiz" ? "A quiz for your little one" : "A new to-do"} · ${t.repeat.every === "once" ? "once" : t.repeat.every === "daily" ? "every day" : t.repeat.every === "weekdays" ? "weekdays" : "weekly"}, by ${t.due}.`, url: URL_FOR(id), tag: `acct-new-${id}` }).catch(() => {});
      }
      res.json({ ok: true, id });
    } catch (e) { fail(res, e, "task save"); }
  };
  app.post("/api/accountability/tasks", authMiddleware, (req: any, res) => void saveTask(req, res, null));
  app.put("/api/accountability/tasks/:id", authMiddleware, async (req: any, res) => {
    try { const t = await taskById(String(req.params.id)); if (!t || t.archived) return res.status(404).json({ message: "That task is gone." }); await saveTask(req, res, t); } catch (e) { fail(res, e, "task change"); }
  });
  app.delete("/api/accountability/tasks/:id", authMiddleware, async (req: any, res) => {
    const userId = me(req, res); if (userId == null) return;
    try {
      const t = await taskById(String(req.params.id));
      if (!t || !(await memberOf(userId, t.spaceId))) return res.json({ ok: true });
      if (t.createdBy !== userId && t.assignee !== userId) return res.status(403).json({ message: "Only the person who asked can remove this." });
      const { error } = await db().from("acct_tasks").update({ archived: true }).eq("id", t.id);
      if (error) throw error;
      res.json({ ok: true });
    } catch (e) { fail(res, e, "task remove"); }
  });

  /** Somewhere to put a photo or video of the finished work. Body { spaceId, type, size }. */
  app.post("/api/accountability/upload-url", authMiddleware, async (req: any, res) => {
    const userId = me(req, res); if (userId == null) return;
    if (limited(writes, String(userId), res)) return;
    try {
      const spaceId = String(req.body?.spaceId || "");
      if (!(await memberOf(userId, spaceId))) return res.status(404).json({ message: "That space isn't yours." });
      const type = String(req.body?.type || "").split(";")[0].toLowerCase();
      const kind = PROOF_TYPES[type];
      if (!kind) return res.status(400).json({ message: "Photos can be JPG, PNG, WebP or HEIC; videos MP4 or MOV." });
      const size = Number(req.body?.size) || 0;
      if (size <= 0 || size > kind.maxMb * 1024 * 1024) return res.status(400).json({ message: kind.kind === "video" ? "Videos can be up to 100 MB. Try a shorter clip." : "Photos can be up to 15 MB." });
      await ensureBucket(db());
      const path = `${spaceId}/${userId}/${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${kind.ext}`;
      const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      res.json({ url: data.signedUrl, path, kind: kind.kind });
    } catch (e) { fail(res, e, "upload link"); }
  });

  /** Short links to look at proof. Body { paths }. Only files in the person's spaces. */
  app.post("/api/accountability/proof-urls", authMiddleware, async (req: any, res) => {
    const userId = me(req, res); if (userId == null) return;
    try {
      const mine = new Set(await mySpaceIds(userId));
      const paths = (Array.isArray(req.body?.paths) ? req.body.paths : []).map(String).filter((p: string) => /^[A-Za-z0-9_-]+\/\d+\/[A-Za-z0-9.-]+$/.test(p) && mine.has(p.split("/")[0])).slice(0, 40);
      const out: Record<string, string> = {};
      for (const p of paths) {
        const { data } = await db().storage.from(BUCKET).createSignedUrl(p, 3600);
        if (data?.signedUrl) out[p] = data.signedUrl;
      }
      res.json({ urls: out });
    } catch (e) { fail(res, e, "proof links"); }
  });

  /** Check it off for a day. Body { taskId, day, note, proof, answers }. One check-in per task and
   *  day: checking off again (after a redo) replaces it. Tells the one who asked. */
  app.post("/api/accountability/checkins", authMiddleware, async (req: any, res) => {
    const userId = me(req, res); if (userId == null) return;
    if (limited(writes, String(userId), res)) return;
    try {
      const t = await taskById(String(req.body?.taskId || ""));
      const members = t ? await memberOf(userId, t.spaceId) : null;
      if (!t || !members || t.archived) return res.status(404).json({ message: "That task is gone." });
      const day = String(req.body?.day || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ message: "Which day is this for?" });
      const proof: Proof[] = (Array.isArray(req.body?.proof) ? req.body.proof : []).slice(0, LIMITS.proofs)
        .filter((p: any) => typeof p?.path === "string" && p.path.startsWith(`${t.spaceId}/${userId}/`) && /^[A-Za-z0-9_/.-]+$/.test(p.path))
        .map((p: any) => ({ path: p.path, type: p.type === "video" ? "video" : "photo" }));
      if (t.proof !== "none" && !proof.length && t.kind === "task") return res.status(400).json({ message: t.proof === "video" ? "Add a video of the finished work." : "Add a photo of the finished work." });
      const answers = cleanAnswers(req.body?.answers);
      const score = t.kind === "quiz" && t.quiz ? scoreQuiz(t.quiz, answers) : null;
      const status = t.review && t.createdBy !== userId ? "done" : "approved";
      const data = { note: String(req.body?.note || "").slice(0, LIMITS.note), proof, answers, score, status, feedback: "", reviewedBy: null, reviewedAt: null };
      const { data: old } = await db().from("acct_checkins").select("id").eq("task_id", t.id).eq("day", day).maybeSingle();
      const id = old?.id || newId();
      const row = { id, task_id: t.id, space_id: t.spaceId, day, by_user: userId, at: new Date(now()).toISOString(), data };
      const { error } = old ? await db().from("acct_checkins").update(row).eq("id", id) : await db().from("acct_checkins").insert(row);
      if (error) throw error;
      const who = nameIn(members, userId);
      const extra = score ? ` · ${score.right}/${score.total} right` : proof.length ? ` · ${proof.some((p) => p.type === "video") ? "video" : "photo"} attached` : "";
      for (const m of members) if (m.userId !== userId && (m.userId === t.createdBy || t.createdBy === userId)) {
        void deps.push(m.userId, { title: `✓ ${who} did it: ${t.title}`, body: `${status === "done" ? "Tap to look and approve." : "Checked off."}${extra}`, url: URL_FOR(t.id), tag: `acct-done-${t.id}-${day}` }).catch(() => {});
      }
      res.json({ ok: true, id, status, score });
    } catch (e) { fail(res, e, "check-in"); }
  });

  /** The one who asked approves it, or sends it back. Body { status: "approved"|"redo", feedback }. */
  app.post("/api/accountability/checkins/:id/review", authMiddleware, async (req: any, res) => {
    const userId = me(req, res); if (userId == null) return;
    if (limited(writes, String(userId), res)) return;
    try {
      const { data: row, error } = await db().from("acct_checkins").select("*").eq("id", String(req.params.id)).maybeSingle();
      if (error) throw error;
      const c = row ? rowToCheckin(row) : null;
      const t = c ? await taskById(c.taskId) : null;
      const members = t ? await memberOf(userId, t.spaceId) : null;
      if (!c || !t || !members) return res.status(404).json({ message: "That check-in is gone." });
      if (c.by === userId) return res.status(403).json({ message: "Someone else checks your work." });
      const status = req.body?.status === "redo" ? "redo" : "approved";
      const feedback = String(req.body?.feedback || "").slice(0, LIMITS.feedback);
      const data = { ...row.data, status, feedback, reviewedBy: userId, reviewedAt: new Date(now()).toISOString() };
      const { error: e2 } = await db().from("acct_checkins").update({ data }).eq("id", c.id);
      if (e2) throw e2;
      // A redo starts the nudges again.
      if (status === "redo") await db().from("acct_nudges").delete().eq("task_id", t.id).eq("day", c.day);
      const who = nameIn(members, userId);
      void deps.push(c.by, status === "approved"
        ? { title: `⭐ ${who} approved: ${t.title}`, body: feedback || "Great job!", url: URL_FOR(t.id), tag: `acct-ok-${c.id}` }
        : { title: `↺ ${who} asked for a redo: ${t.title}`, body: feedback || "Take another look.", url: URL_FOR(t.id), tag: `acct-redo-${c.id}` }).catch(() => {});
      res.json({ ok: true });
    } catch (e) { fail(res, e, "review"); }
  });

  /** A friendly poke right now, from the one who asked. */
  app.post("/api/accountability/tasks/:id/poke", authMiddleware, async (req: any, res) => {
    const userId = me(req, res); if (userId == null) return;
    if (limited(pokes, `${userId}:${req.params.id}`, res)) return;
    try {
      const t = await taskById(String(req.params.id));
      const members = t ? await memberOf(userId, t.spaceId) : null;
      if (!t || !members) return res.status(404).json({ message: "That task is gone." });
      if (t.assignee === userId) return res.status(400).json({ message: "That one's yours." });
      const sent = await deps.push(t.assignee, { title: `👋 ${nameIn(members, userId)}: ${t.title}`, body: String(req.body?.message || "").slice(0, 200) || "Just checking in on this one.", url: URL_FOR(t.id), tag: `acct-poke-${t.id}` });
      res.json({ ok: true, sent });
    } catch (e) { fail(res, e, "poke"); }
  });

  /** The AI makes a worksheet or a quiz (metered like every AI call in server/routes.ts). The app
   *  falls back to the built-in maker (shared/accountability.ts) when this fails. */
  app.post(["/api/accountability/ai/worksheet", "/api/accountability/ai/quiz"], authMiddleware, async (req: any, res) => {
    const userId = me(req, res); if (userId == null) return;
    const a = cleanAiAsk(req.body);
    if (!a) return res.status(400).json({ message: "What should it be about?" });
    if (!aiReady()) return res.status(503).json({ message: "AI isn't set up here.", builtin: true });
    if (limited(ais, String(userId), res)) return;
    const quiz = req.path.endsWith("/quiz");
    try {
      const text = await ask(quiz ? QUIZ_PROMPT : WORKSHEET_PROMPT, aiUserMessage(a));
      let parsed: any = null; try { parsed = JSON.parse(text); } catch { /* below */ }
      const made = quiz ? cleanQuiz(parsed) : cleanWorksheet(parsed);
      if (!made) return res.status(502).json({ message: "The AI's answer couldn't be used.", builtin: true });
      res.json(quiz ? { quiz: made } : { worksheet: made });
    } catch (e: any) {
      res.status(e?.message === "busy" ? 503 : 502).json({ message: "The AI is busy right now.", builtin: true });
    }
  });
}

// ---- nudges: every minute, the assignee of anything due and not done hears about it again ----

export async function sendDueAccountabilityNudges(deps: Pick<AccountabilityDeps, "db" | "push" | "now">): Promise<number> {
  const db = deps.db(); const nowMs = (deps.now ?? Date.now)();
  const { data: rows, error } = await db.from("acct_tasks").select("*").eq("archived", false).limit(5000);
  if (error) throw error;
  const tasks = (rows || []).map(rowToTask).filter((t: AcctTask) => t.nag > 0);
  if (!tasks.length) return 0;
  const spaceIds = Array.from(new Set(tasks.map((t: AcctTask) => t.spaceId)));
  const { data: mrows } = await db.from("acct_members").select("space_id, user_id, name, tz").in("space_id", spaceIds);
  const members = (mrows || []) as { space_id: string; user_id: number; name: string; tz: string }[];
  const tzOf = (userId: number) => members.find((m) => m.user_id === userId && m.tz)?.tz || "America/Denver";
  const days = new Set<string>(); const localByTask = new Map<string, { day: string; minutes: number }>();
  for (const t of tasks) { const l = localNow(nowMs, tzOf(t.assignee)); localByTask.set(t.id, l); days.add(l.day); }
  const due = tasks.filter((t: AcctTask) => dueOn(t, localByTask.get(t.id)!.day));
  if (!due.length) return 0;
  const ids = due.map((t: AcctTask) => t.id);
  const [{ data: crows }, { data: nrows }] = await Promise.all([
    db.from("acct_checkins").select("task_id, day, data").in("task_id", ids).in("day", Array.from(days)),
    db.from("acct_nudges").select("task_id, day, n, last_at").in("task_id", ids).in("day", Array.from(days)),
  ]);
  let sent = 0;
  for (const t of due) {
    const l = localByTask.get(t.id)!;
    const c = (crows || []).find((r: any) => r.task_id === t.id && r.day === l.day);
    const n = (nrows || []).find((r: any) => r.task_id === t.id && r.day === l.day);
    const last = n ? { at: Date.parse(n.last_at), n: n.n } : null;
    if (!nudgeNow(t, isDone(c ? { status: c.data?.status } as Checkin : null), l, last, nowMs)) continue;
    const asker = members.find((m) => m.space_id === t.spaceId && m.user_id === t.createdBy)?.name || "";
    const text = nudgeText(t, t.createdBy === t.assignee ? "" : asker, last?.n ?? 0);
    // Marked first, so a slow send can't make the next minute's pass send it twice.
    await db.from("acct_nudges").upsert({ task_id: t.id, day: l.day, n: (last?.n ?? 0) + 1, last_at: new Date(nowMs).toISOString() });
    try { if (await deps.push(t.assignee, { ...text, url: URL_FOR(t.id), tag: `acct-nudge-${t.id}` })) sent++; } catch { /* next time */ }
  }
  return sent;
}

export function startAccountabilityTicker(deps: Pick<AccountabilityDeps, "db" | "push">) {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return; busy = true;
    try { await sendDueAccountabilityNudges(deps); } catch (e: any) { console.error("[accountability] nudge pass failed", e?.message); }
    finally { busy = false; }
  }, 60_000);
  timer.unref?.();
  return timer;
}
