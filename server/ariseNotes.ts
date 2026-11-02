// Arise Notes (shared/ariseNotes.ts): the AI note taker's server.
//
// A recording reaches the server in pieces (a live recording every few minutes; an upload is cut on
// the device), each written down by speech-to-text (server/ariseNotesAi.ts) and charged against the
// month's minutes, rounded up per recording. Before each piece the minutes left are checked; when they
// run out the audio is still saved, so it can be written down once minutes come back. Then the AI
// writes the summary in the chosen template. Action items and dates go to Arise To Duo after the
// person checks them (server/ariseNotesHubs.ts).
//
// Privacy: audio is deleted once it's written down unless the person chose to keep it (30 days, or
// always). Each note is only ever read by its owner (or, if they share it with their Family plan or
// turn on a view-only link, by those people). "Delete everything" removes all of it.
import type { Express, RequestHandler } from "express";
import { createHash, randomBytes } from "node:crypto";
import { clientAddress, createAttemptLimiter, waitWords } from "./attemptLimiter";
import {
  DEFAULT_SETTINGS, DIARIZE_PIECE_SECS, MEMO_MAX_SECS, NOTES_PLANS, NOTES_TEMPLATES, PIECE_MAX_BYTES, PIECE_SECS, PROVIDER_CENTS_PER_MIN,
  aiCents, allows, capText, cleanFamilyCode, cleanIep, cleanSettings, dayWords, familyCode, fmtClock, isTemplateId, monthStartOf, nextMonthStart, noteHtml, noteText,
  planFor, rollAccount, searchQuery, segmentIdx, speakerName, templateAllowed, templateOf, transcribeCheck, transcriptForAi, usageView, warningDue,
  type IepDraft, type NoteForExport, type NoteSummary, type NotesFeature, type NotesPlanId, type NotesTemplateId, type Segment, type UsageView,
} from "../shared/ariseNotes";
import type { AccountRow, NoteRow, NotesStore, PieceRow } from "./ariseNotesStore";
import { answerFromPassages, planSearch, readMemo, translateSummary, writeParentEmail, writeStudyTools, writeSummary, type AskJson, type HeardLine, type Hearer } from "./ariseNotesAi";
import { addIepToWork, addToLife, addToWork, lifeTargets, workTargets, type EventIn, type LifeStore, type TaskIn, type WorkStore } from "./ariseNotesHubs";

type User = { id: number; role?: string; isAdmin?: boolean; displayName?: string; username?: string; email?: string | null; teacherId?: number | null; accountApproved?: boolean };
type Message = { title: string; body: string; url?: string; tag?: string };

export type NotesDeps = {
  store: NotesStore;
  hear: Hearer;
  ask: AskJson;
  aiReady: () => boolean;
  /** The Notes plan this account itself has (from billing): free, basic, plus or family. */
  planOf: (userId: number, user?: User | null) => Promise<NotesPlanId>;
  getUser: (id: number) => Promise<User | null | undefined>;
  /** Students under 13 only come in through a teacher or parent: a student account needs one of them. */
  studentAllowed?: (user: User) => Promise<boolean>;
  push?: (userId: number, m: Message) => Promise<number>;
  email?: (to: string, subject: string, html: string) => Promise<boolean>;
  life?: LifeStore;
  work?: WorkStore;
  makeQuiz?: (user: User, quiz: { title: string; description: string; questions: any[] }) => Promise<{ id: number } | null>;
  now?: () => number;
};

type Ctx = { user: User; plan: NotesPlanId; poolId: number; pooled: boolean; me: AccountRow; pool: AccountRow; usage: UsageView; familyOwner: number | null };

const FEATURE_NAME: Record<NotesFeature, string> = {
  templates: "Meeting templates", export: "Exporting", share: "Share links", ask: "Ask your notes", memo: "Voice memo to task", planner: "Adding to your planner",
  calendar: "Adding to your calendar", parent: "Parent-friendly summaries", translate: "Translation", study: "Flashcards and quizzes", speakers: "Speaker labels",
  iep: "IEP meeting mode", rollover: "Rollover",
};
const EXTS = new Set(["webm", "ogg", "mp3", "m4a", "mp4", "wav", "mpeg", "mpga", "flac"]);
const MIME: Record<string, string> = { webm: "audio/webm", ogg: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", wav: "audio/wav", mpeg: "audio/mpeg", mpga: "audio/mpeg", flac: "audio/flac" };
const WHISPER_HINT: Partial<Record<NotesTemplateId, string>> = {
  iep: "IEP meeting. Accommodations, goals, present levels, services, speech therapy, occupational therapy, minutes per week, LRE, FAPE, progress monitoring.",
  parent: "Parent-teacher conference about a student.",
  staff: "Staff meeting.",
  lecture: "Class lecture.",
  doctor: "Doctor visit. Medicines, doses, milligrams, follow-up appointment.",
  interview: "Interview.",
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const cut = (v: unknown, n: number) => (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim().slice(0, n);
const sha = (s: string) => createHash("sha1").update(s).digest("hex");
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const langOf = (v: unknown) => { const s = cut(v, 40).replace(/[^\p{L} ()-]/gu, ""); return s || "English"; };
const langKey = (l: string) => l.toLowerCase().replace(/[^a-z]+/g, "-").slice(0, 30) || "english";

export function registerAriseNotesRoutes(app: Express, auth: RequestHandler, deps: NotesDeps) {
  const store = deps.store;
  const now = deps.now ?? Date.now;
  const ais = createAttemptLimiter({ max: 60, windowMs: 3600_000, now });
  const pieceLimit = createAttemptLimiter({ max: 400, windowMs: 3600_000, now });
  const shareViews = createAttemptLimiter({ max: 120, windowMs: 600_000, now });
  const joins = createAttemptLimiter({ max: 10, windowMs: 3600_000, now });

  const fail = (res: any, e: any, what: string) => {
    console.error(`[notes] ${what}:`, e?.message || e);
    if (!res.headersSent) res.status(500).json({ message: "Arise Notes couldn't do that just now. Try again in a moment." });
  };
  const limited = (lim: ReturnType<typeof createAttemptLimiter>, key: string, res: any) => {
    const wait = lim.retryAfter(key);
    if (wait > 0) { res.status(429).json({ message: `That's a lot at once. Try again in ${waitWords(wait)}.` }); return true; }
    lim.fail(key);
    return false;
  };

  /** The signed-in person, if they may use Notes. */
  const who = async (req: any, res: any): Promise<User | null> => {
    const u: User | undefined = req.user;
    if (!u || !Number.isSafeInteger(Number(u.id)) || req.adminPreview) { res.status(403).json({ message: "Sign in to your own account to use Arise Notes." }); return null; }
    if (u.role === "student" && !u.isAdmin && deps.studentAllowed && !(await deps.studentAllowed(u))) {
      res.status(403).json({ message: "Students use Arise Notes through a teacher or parent account. Ask your teacher or parent to set it up for you.", code: "student" });
      return null;
    }
    return { ...u, id: Number(u.id) };
  };

  const account = async (userId: number, planId: NotesPlanId): Promise<AccountRow> => {
    const got = await store.getAccount(userId);
    const base: AccountRow = got ?? { userId, period: monthStartOf(now()), used: 0, own: 0, rollover: 0, warned: 0, settings: { ...DEFAULT_SETTINGS }, familyCode: null };
    const rolled = rollAccount(base, NOTES_PLANS[planId], now()) as AccountRow;
    if (!got || rolled !== base) await store.saveAccount(rolled);
    return rolled;
  };

  /** Plan, minutes and settings. A Family plan's members use the owner's shared minutes. */
  const ctxOf = async (user: User): Promise<Ctx> => {
    const own = await deps.planOf(user.id, user);
    let plan = own, poolId = user.id, pooled = false;
    const familyOwner = own === "family" ? user.id : await store.familyOwnerOf(user.id);
    if (own === "free" && familyOwner && familyOwner !== user.id) {
      const ownerPlan = await deps.planOf(familyOwner, await deps.getUser(familyOwner));
      if (ownerPlan === "family") { plan = "family"; poolId = familyOwner; pooled = true; }
    }
    const me = await account(user.id, plan);
    const pool = poolId === user.id ? me : await account(poolId, "family");
    return { user, plan, poolId, pooled, me, pool, usage: usageView(pool, me, plan, pooled), familyOwner: familyOwner ?? null };
  };

  const need = (ctx: Ctx, f: NotesFeature, res: any) => {
    if (allows(ctx.plan, f)) return true;
    const p = planFor(f);
    const plural = f === "templates" || f === "share" || f === "parent" || f === "study" || f === "speakers";
    res.status(402).json({ message: `${FEATURE_NAME[f]} ${plural ? "are" : "is"} part of Arise Notes ${NOTES_PLANS[p].name}.`, code: "upgrade", plan: p });
    return false;
  };

  /** Everyone in this person's family group (the owner and members), or just them. */
  const familyGroup = async (userId: number): Promise<number[]> => {
    const owner = (await store.familyOwnerOf(userId)) ?? userId;
    const members = await store.familyMembers(owner);
    return members.length ? [owner, ...members.filter((m) => m !== owner)] : [userId];
  };

  /** A note this person may open (`write`: only their own). Anyone else's is "not found". */
  const noteFor = async (user: User, id: string, res: any, write = true): Promise<NoteRow | null> => {
    const note = await store.getNote(String(id || ""));
    if (note && note.ownerId === user.id) return note;
    if (note && !write && note.familyShared && (await familyGroup(user.id)).includes(note.ownerId)) return note;
    res.status(404).json({ message: "That note isn't here. It may have been deleted." });
    return null;
  };

  const summaryOf = (n: NoteRow): NoteSummary | null => (n.summary?.data && typeof n.summary.data === "object" ? (n.summary.data as NoteSummary) : null);
  const exportable = (n: NoteRow, segments: Segment[]): NoteForExport => ({ title: n.title, createdAt: n.createdAt, durationSecs: n.durationSecs, template: n.template, summary: summaryOf(n), segments, speakers: n.speakers });
  const listItem = (n: NoteRow, mine: boolean) => ({
    id: n.id, title: n.title, template: n.template, source: n.source, status: n.status, durationSecs: n.durationSecs, createdAt: n.createdAt, folder: n.folder, tags: n.tags,
    familyShared: n.familyShared, mine, gist: cut(summaryOf(n)?.summary, 180), actions: summaryOf(n)?.actions.length ?? 0, minutes: n.chargedMinutes,
  });
  const pieceView = (p: PieceRow) => ({ idx: p.idx, start: p.startSecs, secs: p.secs, state: p.state, error: p.error, kept: !!p.path });
  const noteView = async (n: NoteRow, viewer: User) => {
    const [segments, pieces, actions] = await Promise.all([store.getSegments(n.id), store.getPieces(n.id), store.getActions(n.id)]);
    const { transcript: _t, shareToken, ...rest } = n;
    return {
      ...rest, shareToken: n.ownerId === viewer.id ? shareToken : null, mine: n.ownerId === viewer.id, summary: summaryOf(n), summaryTemplate: n.summary?.template ?? null, summaryAt: n.summary?.at ?? null,
      stale: !!n.extras?.edited, segments, pieces: pieces.map(pieceView), actions, audio: pieces.some((p) => !!p.path),
    };
  };
  const statusFrom = (pieces: PieceRow[], current: NoteRow["status"]): NoteRow["status"] => {
    if (pieces.some((p) => p.state === "no_minutes")) return "no_minutes";
    if (pieces.some((p) => p.state === "failed")) return "failed";
    if (pieces.some((p) => p.state === "new")) return "processing";
    return current === "recording" ? "recording" : "ready";
  };

  // ─── Warnings at 80% and 100% ───────────────────────────────────────────────
  const warn = async (ctx: Ctx, poolUsed: number) => {
    const level = warningDue(poolUsed, ctx.usage.allowance, ctx.pool.warned);
    if (!level) return;
    const acct = await store.getAccount(ctx.poolId);
    if (!acct || acct.warned >= level) return;
    await store.saveAccount({ ...acct, warned: level });
    const reset = dayWords(nextMonthStart(acct.period), now());
    const m: Message = level === 100
      ? { title: "Arise Notes: out of minutes", body: `All ${ctx.usage.allowance.toLocaleString("en-US")} minutes for this month are used. Upgrade or wait until ${reset}. New recordings are still saved.`, url: "/notes/#/usage", tag: "notes-minutes" }
      : { title: "Arise Notes: 80% of your minutes used", body: `${poolUsed.toLocaleString("en-US")} of ${ctx.usage.allowance.toLocaleString("en-US")} minutes used this month. They start again on ${reset}.`, url: "/notes/#/usage", tag: "notes-minutes" };
    const to = [...new Set([ctx.poolId, ctx.user.id])];
    for (const id of to) {
      await deps.push?.(id, m).catch(() => 0);
      const u = await deps.getUser(id).catch(() => null);
      if (u?.email && deps.email) await deps.email(u.email, m.title, `<p>${m.body}</p><p><a href="https://arisetodo.com/notes/">Open Arise Notes</a></p>`).catch(() => false);
    }
  };

  // ─── Writing down one piece ─────────────────────────────────────────────────
  const pathOf = (n: NoteRow, idx: number, ext: string) => `${n.ownerId}/${n.id}/${idx}.${ext}`;
  /** `onPhone`: Private mode, the iPhone already wrote this piece down; only its text arrives. A recording
   *  that started with minutes left may finish (so its transcript isn't cut off); the safety cap still applies. */
  const transcribePiece = async (ctx: Ctx, note: NoteRow, piece: PieceRow, audio: Buffer, mime: string, onPhone?: { lines: HeardLine[]; duration: number }) => {
    const path = piece.path || pathOf(note, piece.idx, piece.ext);
    const est = Math.max(1, Math.ceil(Math.max(0, piece.secs || 60) / 60));
    const check = onPhone
      ? (ctx.usage.capLeft < est ? { ok: false as const, reason: "cap" as const, message: capText(ctx.usage.resetOn, now()) } : { ok: true as const })
      : transcribeCheck(ctx.usage, piece.secs || 60, now());
    if (!check.ok && onPhone) {
      return { ok: false as const, code: check.reason, message: check.message, usage: ctx.usage };
    }
    if (!check.ok) {
      if (!piece.path) await store.putAudio(path, audio, MIME[piece.ext] || "audio/webm");
      await store.savePiece({ ...piece, state: "no_minutes", path, error: check.message });
      await store.updateNote(note.id, { status: "no_minutes", durationSecs: Math.max(note.durationSecs, piece.startSecs + piece.secs) });
      return { ok: false as const, code: check.reason, message: check.message, usage: ctx.usage };
    }
    let heard;
    try {
      heard = onPhone ? { lines: onPhone.lines, duration: onPhone.duration, provider: "on-device", diarized: false } : await deps.hear.hear({ audio, ext: piece.ext, mime: mime || MIME[piece.ext] || "", speakers: allows(ctx.plan, "speakers") && note.extras?.speakers !== false, prompt: WHISPER_HINT[note.template] });
    } catch (e: any) {
      console.error("[notes] speech to text:", e?.message);
      if (!piece.path) await store.putAudio(path, audio, MIME[piece.ext] || "audio/webm").catch(() => {});
      await store.savePiece({ ...piece, state: "failed", path, error: String(e?.message || "failed").slice(0, 200) });
      await store.updateNote(note.id, { durationSecs: Math.max(note.durationSecs, piece.startSecs + piece.secs) });
      return { ok: false as const, code: "failed", message: "This part couldn't be written down just now. It's saved, so you can try again.", retry: true, usage: ctx.usage };
    }
    const segs: Segment[] = heard.lines.map((l, i) => ({ idx: segmentIdx(piece.idx, i), start: r2(piece.startSecs + l.start), end: r2(piece.startSecs + Math.max(l.end, l.start)), speaker: l.speaker, text: l.text.slice(0, 2000) }));
    await store.replaceSegments(note.id, note.ownerId, segmentIdx(piece.idx, 0), segmentIdx(piece.idx + 1, 0), segs);
    // Minutes come from the audio's real length, as the speech-to-text service measured it.
    const secs = heard.duration > 0 ? heard.duration : piece.secs;
    const charged = await store.charge(note.id, ctx.user.id, ctx.poolId, secs);
    await store.logUsage({ userId: ctx.user.id, poolId: ctx.poolId, noteId: note.id, kind: "transcribe", minutes: charged.delta, secs: r2(secs), provider: heard.provider, costCents: Math.round((secs / 60) * (PROVIDER_CENTS_PER_MIN[heard.provider] ?? 0.5) * 10_000) / 10_000 });
    // The audio is kept only when the person chose to keep it.
    let kept: string | null = null;
    if (note.audioKeep !== "delete" && audio.length) { await store.putAudio(path, audio, MIME[piece.ext] || "audio/webm"); kept = path; }
    else if (piece.path) await store.removeAudio([piece.path]);
    await store.savePiece({ ...piece, secs: r2(secs), state: "done", path: kept, provider: heard.provider, error: "" });
    const [all, pieces] = await Promise.all([store.getSegments(note.id), store.getPieces(note.id)]);
    const fresh = await store.getNote(note.id);
    await store.updateNote(note.id, {
      transcript: all.map((s) => s.text).join("\n").slice(0, 1_500_000),
      durationSecs: Math.max(fresh?.durationSecs ?? note.durationSecs, piece.startSecs + secs),
      status: statusFrom(pieces, fresh?.status ?? note.status),
      ...(heard.diarized ? { extras: { ...(fresh?.extras ?? note.extras), diarized: true } } : {}),
    });
    await warn(ctx, charged.poolUsed);
    const usage = usageView({ ...ctx.pool, used: charged.poolUsed }, { ...ctx.me, own: charged.ownUsed }, ctx.plan, ctx.pooled);
    return { ok: true as const, segments: segs, usage, minutes: charged.delta, provider: heard.provider, diarized: heard.diarized, secs: r2(secs) };
  };

  // ─── Me: plan, minutes, settings, family ────────────────────────────────────
  app.get("/api/notes/me", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const ctx = await ctxOf(user);
      const groupOwner = ctx.familyOwner;
      let family: any = null;
      if (groupOwner) {
        const ids = await store.familyMembers(groupOwner);
        const people = await Promise.all([groupOwner, ...ids].map(async (id) => ({ id, name: cut((await deps.getUser(id).catch(() => null))?.displayName, 60) || "Someone", owner: id === groupOwner })));
        const ownerAcct = groupOwner === user.id ? ctx.me : await store.getAccount(groupOwner);
        family = { role: groupOwner === user.id ? "owner" : "member", people, code: groupOwner === user.id ? ownerAcct?.familyCode ?? null : null, active: ctx.plan === "family" };
      }
      const features = Object.fromEntries((Object.keys(FEATURE_NAME) as NotesFeature[]).map((f) => [f, allows(ctx.plan, f)]));
      res.set("Cache-Control", "no-store");
      res.json({
        user: { id: user.id, name: cut(user.displayName, 80) || user.username || "", role: user.role || "student", teacher: user.role === "teacher" || !!user.isAdmin, admin: !!user.isAdmin, workHub: !!user.isAdmin || ["teacher", "parent", "todo"].includes(String(user.role)), email: !!user.email },
        plan: ctx.plan, planName: NOTES_PLANS[ctx.plan].name, usage: ctx.usage, settings: ctx.me.settings, features,
        templates: NOTES_TEMPLATES.map((t) => ({ id: t.id, label: t.label, emoji: t.emoji, blurb: t.blurb, allowed: templateAllowed(ctx.plan, t.id) })),
        services: { speech: deps.hear.available(), speakers: deps.hear.speakersAvailable(), ai: deps.aiReady() },
        limits: { pieceSecs: allows(ctx.plan, "speakers") && deps.hear.speakersAvailable() ? DIARIZE_PIECE_SECS : PIECE_SECS, pieceBytes: PIECE_MAX_BYTES, maxSecs: ctx.usage.maxSecs, memoSecs: MEMO_MAX_SECS },
        family,
      });
    } catch (e) { fail(res, e, "me"); }
  });

  app.patch("/api/notes/settings", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const ctx = await ctxOf(user);
      const settings = cleanSettings({ ...ctx.me.settings, ...(req.body && typeof req.body === "object" ? req.body : {}) });
      await store.saveAccount({ ...ctx.me, settings });
      res.json({ settings });
    } catch (e) { fail(res, e, "settings"); }
  });

  // ─── Notes ─────────────────────────────────────────────────────────────────
  app.get("/api/notes", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const q = cut(req.query?.q, 120);
      let ids: string[] | undefined;
      if (q) ids = await store.findNotes(user.id, searchQuery([q]) || q);
      const mine = await store.listNotes([user.id], { ids, limit: 300 });
      // Notes family members shared with everyone on the plan.
      const group = (await familyGroup(user.id)).filter((id) => id !== user.id);
      const shared = group.length && !q ? await store.listNotes(group, { sharedOnly: true, limit: 100 }) : [];
      const names = new Map<number, string>();
      for (const n of shared) if (!names.has(n.ownerId)) names.set(n.ownerId, cut((await deps.getUser(n.ownerId).catch(() => null))?.displayName, 60) || "Family");
      res.set("Cache-Control", "no-store");
      res.json({ notes: [...mine.map((n) => listItem(n, true)), ...shared.map((n) => ({ ...listItem(n, false), by: names.get(n.ownerId) }))] });
    } catch (e) { fail(res, e, "list"); }
  });

  app.post("/api/notes", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const ctx = await ctxOf(user);
      const source = req.body?.source === "upload" ? "upload" : "record";
      let template: NotesTemplateId = isTemplateId(req.body?.template) ? req.body.template : ctx.me.settings.template;
      if (!templateAllowed(ctx.plan, template)) template = "general";
      const expected = Math.max(0, Number(req.body?.expectedSecs) || 0);
      if (expected > ctx.usage.maxSecs + 30) {
        const max = Math.round(ctx.usage.maxSecs / 60);
        return res.status(413).json({ code: "too_long", message: `This file is ${Math.round(expected / 60)} minutes long. On ${NOTES_PLANS[ctx.plan].name}, one recording can be up to ${max >= 120 ? "2 hours" : `${max} minutes`}.${ctx.plan === "free" ? " Basic and up take up to 2 hours." : " Trim it or split it into two files."}`, plan: ctx.plan === "free" ? "basic" : null });
      }
      if (ctx.usage.left <= 0 && req.body?.saveOnly !== true) {
        const check = transcribeCheck(ctx.usage, 60, now());
        return res.status(402).json({ code: check.ok ? "minutes" : check.reason, message: check.ok ? "No minutes left." : check.message, canSave: true, usage: ctx.usage });
      }
      const typed = cut(req.body?.title, 140);
      // Private mode (Notes iPhone app): the audio is written down on the iPhone and never sent here.
      const privateMode = req.body?.privacy === "private";
      const note = await store.createNote({
        ownerId: user.id, title: typed || cut(req.body?.defaultTitle, 140) || (source === "upload" ? "Uploaded recording" : "New recording"),
        template, source, status: source === "upload" ? "processing" : "recording", audioKeep: privateMode ? "delete" : ctx.me.settings.audio, folder: cut(req.body?.folder, 40),
        extras: { autoTitle: !typed, speakers: !privateMode && allows(ctx.plan, "speakers") && req.body?.speakers !== false, ...(privateMode ? { privacy: "private" } : {}) },
      });
      res.status(201).json({ note: await noteView(note, user), usage: ctx.usage, limits: { pieceSecs: allows(ctx.plan, "speakers") && deps.hear.speakersAvailable() && req.body?.speakers !== false ? DIARIZE_PIECE_SECS : PIECE_SECS, maxSecs: ctx.usage.maxSecs } });
    } catch (e) { fail(res, e, "create"); }
  });

  app.get("/api/notes/:id", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const note = await noteFor(user, req.params.id, res, false);
      if (!note) return;
      res.set("Cache-Control", "no-store");
      res.json({ note: await noteView(note, user) });
    } catch (e) { fail(res, e, "open"); }
  });

  app.patch("/api/notes/:id", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      const b = req.body || {};
      const patch: Partial<NoteRow> = {};
      if (typeof b.title === "string") { patch.title = cut(b.title, 140) || note.title; patch.extras = { ...note.extras, autoTitle: false }; }
      if (typeof b.folder === "string") patch.folder = cut(b.folder, 40);
      if (Array.isArray(b.tags)) patch.tags = [...new Set(b.tags.map((t: unknown) => cut(t, 24).toLowerCase()).filter(Boolean))].slice(0, 10) as string[];
      if (b.speakers && typeof b.speakers === "object") patch.speakers = Object.fromEntries(Object.entries(b.speakers).slice(0, 30).map(([k, v]) => [cut(k, 6), cut(v, 40)]).filter(([k]) => k));
      if (Array.isArray(b.highlights)) patch.highlights = [...new Set(b.highlights.map(Number).filter((n: number) => Number.isFinite(n) && n >= 0 && n < 8 * 3600).map((n: number) => Math.round(n)))].slice(0, 200) as number[];
      if (isTemplateId(b.template)) {
        const ctx = await ctxOf(user);
        if (!templateAllowed(ctx.plan, b.template)) return need(ctx, templateOf(b.template).needs ?? "templates", res);
        patch.template = b.template;
      }
      if (typeof b.familyShared === "boolean") {
        if (b.familyShared && (await familyGroup(user.id)).length < 2) return res.status(409).json({ message: "Join or start a Family plan to share notes with your family." });
        patch.familyShared = b.familyShared;
      }
      if (b.audioKeep === "delete" || b.audioKeep === "30d" || b.audioKeep === "keep") {
        patch.audioKeep = b.audioKeep;
        if (b.audioKeep === "delete") {
          const kept = (await store.getPieces(note.id)).filter((p) => p.path && p.state === "done");
          await store.removeAudio(kept.map((p) => p.path!));
          for (const p of kept) await store.savePiece({ ...p, path: null });
        }
      }
      if (patch.highlights && !patch.extras) patch.extras = { ...note.extras, edited: true };
      const next = await store.updateNote(note.id, patch);
      res.json({ note: next ? await noteView(next, user) : null });
    } catch (e) { fail(res, e, "update"); }
  });

  app.delete("/api/notes/:id", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      const paths = (await store.getPieces(note.id)).map((p) => p.path).filter((p): p is string => !!p);
      if (paths.length) await store.removeAudio(paths);
      await store.deleteNote(note.id);
      res.json({ ok: true });
    } catch (e) { fail(res, e, "delete"); }
  });

  // A piece of audio: written down now if there are minutes, saved for later if not.
  app.post("/api/notes/:id/pieces", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      if (limited(pieceLimit, `u${user.id}`, res)) return;
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      const audio: Buffer | null = Buffer.isBuffer(req.body) ? req.body : null;
      if (!audio?.length) return res.status(400).json({ message: "No audio arrived. Try again." });
      if (audio.length > PIECE_MAX_BYTES + 1_048_576) return res.status(413).json({ message: "That piece of audio is too big." });
      const idx = Math.floor(Number(req.query?.idx));
      const start = Number(req.query?.start);
      const secs = Number(req.query?.secs) || 0;
      const ext = String(req.query?.ext || "").toLowerCase();
      if (!Number.isInteger(idx) || idx < 0 || idx > 2000 || !Number.isFinite(start) || start < 0 || secs < 0 || secs > 3700 || !EXTS.has(ext)) return res.status(400).json({ message: "That piece of audio doesn't look right." });
      const ctx = await ctxOf(user);
      if (start + secs > ctx.usage.maxSecs + 90) {
        const max = Math.round(ctx.usage.maxSecs / 60);
        return res.status(413).json({ code: "too_long", message: `On ${NOTES_PLANS[ctx.plan].name}, one recording can be up to ${max >= 120 ? "2 hours" : `${max} minutes`}.` });
      }
      const existing = (await store.getPieces(note.id)).find((p) => p.idx === idx);
      if (existing?.state === "done") {
        const segs = (await store.getSegments(note.id)).filter((s) => s.idx >= segmentIdx(idx, 0) && s.idx < segmentIdx(idx + 1, 0));
        return res.json({ ok: true, segments: segs, usage: ctx.usage, minutes: 0, repeat: true });
      }
      const piece: PieceRow = { noteId: note.id, idx, ownerId: note.ownerId, startSecs: r2(start), secs: r2(secs), ext, state: "new", path: existing?.path ?? null, provider: "", error: "", bytes: audio.length, createdAt: new Date(now()).toISOString(), updatedAt: new Date(now()).toISOString() };
      await store.savePiece(piece);
      const out = await transcribePiece(ctx, note, piece, audio, String(req.headers?.["content-type"] || ""));
      res.status(out.ok ? 200 : out.code === "failed" ? 502 : 402).json(out);
    } catch (e) { fail(res, e, "piece"); }
  });

  // Private mode: a piece the iPhone already wrote down. Only its text and times arrive, never audio.
  app.post("/api/notes/:id/pieces/text", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      if (limited(pieceLimit, `u${user.id}`, res)) return;
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      const b = req.body || {};
      const idx = Math.floor(Number(b.idx));
      const start = Number(b.start);
      const secs = Number(b.secs) || 0;
      if (!Number.isInteger(idx) || idx < 0 || idx > 2000 || !Number.isFinite(start) || start < 0 || secs <= 0 || secs > 3700 || !Array.isArray(b.lines) || b.lines.length > 3000) return res.status(400).json({ message: "That part of the transcript doesn't look right." });
      const lines: HeardLine[] = b.lines.map((l: any) => ({ start: Math.max(0, Math.min(secs, Number(l?.start) || 0)), end: Math.max(0, Math.min(secs + 1, Number(l?.end) || 0)), text: cut(l?.text, 2000), speaker: null })).filter((l: HeardLine) => l.text);
      const ctx = await ctxOf(user);
      if (start + secs > ctx.usage.maxSecs + 90) {
        const max = Math.round(ctx.usage.maxSecs / 60);
        return res.status(413).json({ code: "too_long", message: `On ${NOTES_PLANS[ctx.plan].name}, one recording can be up to ${max >= 120 ? "2 hours" : `${max} minutes`}.` });
      }
      const existing = (await store.getPieces(note.id)).find((p) => p.idx === idx);
      if (existing?.state === "done") {
        const segs = (await store.getSegments(note.id)).filter((s) => s.idx >= segmentIdx(idx, 0) && s.idx < segmentIdx(idx + 1, 0));
        return res.json({ ok: true, segments: segs, usage: ctx.usage, minutes: 0, repeat: true });
      }
      const piece: PieceRow = { noteId: note.id, idx, ownerId: note.ownerId, startSecs: r2(start), secs: r2(secs), ext: "txt", state: "new", path: null, provider: "on-device", error: "", bytes: 0, createdAt: new Date(now()).toISOString(), updatedAt: new Date(now()).toISOString() };
      await store.savePiece(piece);
      const out = await transcribePiece(ctx, note, piece, Buffer.alloc(0), "", { lines, duration: secs });
      res.status(out.ok ? 200 : 402).json(out);
    } catch (e) { fail(res, e, "text piece"); }
  });

  /** Writes down the pieces that were saved for later (out of minutes, or the service was busy). */
  app.post("/api/notes/:id/resume", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      let done = 0, left = 0, message = "";
      for (const p of await store.getPieces(note.id)) {
        if (p.state !== "no_minutes" && p.state !== "failed") continue;
        if (message) { left++; continue; }
        const audio = p.path ? await store.getAudio(p.path) : null;
        if (!audio) { await store.savePiece({ ...p, state: "failed", error: "The audio for this part is gone." }); left++; continue; }
        const out = await transcribePiece(await ctxOf(user), (await store.getNote(note.id)) ?? note, p, audio, "");
        if (out.ok) done++; else { left++; message = out.message; }
      }
      const fresh = await store.getNote(note.id);
      if (fresh) await store.updateNote(note.id, { status: statusFrom(await store.getPieces(note.id), fresh.status === "recording" ? "ready" : fresh.status) });
      res.json({ done, left, message, note: fresh ? await noteView((await store.getNote(note.id))!, user) : null, usage: (await ctxOf(user)).usage });
    } catch (e) { fail(res, e, "resume"); }
  });

  /** Recording stopped (or the upload is all sent). */
  app.post("/api/notes/:id/finish", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      const dur = Number(req.body?.durationSecs);
      const highlights = Array.isArray(req.body?.highlights) ? [...new Set([...note.highlights, ...req.body.highlights.map(Number).filter((n: number) => Number.isFinite(n) && n >= 0 && n < 8 * 3600).map(Math.round)])].slice(0, 200) as number[] : note.highlights;
      const pieces = await store.getPieces(note.id);
      const next = await store.updateNote(note.id, { durationSecs: Number.isFinite(dur) && dur > 0 ? Math.max(note.durationSecs, Math.min(dur, 8 * 3600)) : note.durationSecs, highlights, status: statusFrom(pieces, "ready") });
      res.json({ note: next ? await noteView(next, user) : null });
    } catch (e) { fail(res, e, "finish"); }
  });

  app.patch("/api/notes/:id/segments/:idx", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      const idx = Math.floor(Number(req.params.idx));
      const patch: { text?: string; speaker?: string | null } = {};
      if (typeof req.body?.text === "string") { const t = req.body.text.replace(/\s+/g, " ").trim().slice(0, 2000); if (!t) return res.status(400).json({ message: "A line can't be empty. Delete the words you don't want instead." }); patch.text = t; }
      if (req.body?.speaker === null || typeof req.body?.speaker === "string") patch.speaker = req.body.speaker === null ? null : cut(req.body.speaker, 6) || null;
      if (!(await store.updateSegment(note.id, idx, patch))) return res.status(404).json({ message: "That line isn't here." });
      const all = await store.getSegments(note.id);
      await store.updateNote(note.id, { transcript: all.map((s) => s.text).join("\n").slice(0, 1_500_000), extras: { ...note.extras, edited: true } });
      res.json({ ok: true });
    } catch (e) { fail(res, e, "edit line"); }
  });

  app.get("/api/notes/:id/audio", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const note = await noteFor(user, req.params.id, res, false);
      if (!note) return;
      const pieces = (await store.getPieces(note.id)).filter((p) => p.path);
      const links = await store.audioLinks(pieces.map((p) => p.path!), 3600);
      res.set("Cache-Control", "no-store");
      res.json({ pieces: pieces.filter((p) => links[p.path!]).map((p) => ({ idx: p.idx, start: p.startSecs, secs: p.secs, url: links[p.path!] })) });
    } catch (e) { fail(res, e, "audio"); }
  });

  // ─── The summary ───────────────────────────────────────────────────────────
  app.post("/api/notes/:id/summary", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      const ctx = await ctxOf(user);
      const template: NotesTemplateId = isTemplateId(req.body?.template) ? req.body.template : note.template;
      if (!templateAllowed(ctx.plan, template)) return need(ctx, templateOf(template).needs ?? "templates", res);
      if (!deps.aiReady()) return res.status(503).json({ message: "The AI isn't set up on this site yet, so summaries can't be written. Your transcript is saved." });
      const segs = await store.getSegments(note.id);
      if (!segs.length) return res.status(409).json({ message: "Nothing has been written down in this note yet." });
      const lines = transcriptForAi(segs, note.speakers, note.highlights);
      const hash = sha(JSON.stringify([template, lines]));
      if (!req.body?.force && note.summary?.hash === hash && note.summary.template === template && summaryOf(note)) {
        return res.json({ note: await noteView(note, user), cached: true });
      }
      if (limited(ais, `u${user.id}`, res)) return;
      const maxT = Math.max(note.durationSecs, segs[segs.length - 1]?.end ?? 0);
      const w = await writeSummary(deps.ask, { template, meetingDay: note.createdAt.slice(0, 10), lines, maxT });
      const summary = w.value;
      if (!summary.summary && !summary.keyPoints.length) return res.status(502).json({ message: "The AI's summary didn't come through. Try again in a moment." });
      const patch: Partial<NoteRow> = { summary: { template, hash, at: new Date(now()).toISOString(), data: summary }, template, extras: { ...note.extras, edited: false } };
      if (note.extras?.autoTitle && summary.title) patch.title = summary.title;
      if (note.status === "processing") patch.status = statusFrom(await store.getPieces(note.id), "ready");
      await store.updateNote(note.id, patch);
      await store.replaceActions(note.id, note.ownerId, summary.actions.map((a) => ({ text: a.what, who: a.who, due: isDay(a.due) ? a.due : null })));
      await store.logUsage({ userId: user.id, poolId: ctx.poolId, noteId: note.id, kind: "summary", minutes: 0, secs: 0, provider: "ai", costCents: aiCents(w.chars) });
      res.json({ note: await noteView((await store.getNote(note.id))!, user) });
    } catch (e) { fail(res, e, "summary"); }
  });

  // Teacher and family tools that start from the summary. Each is kept once made.
  const fromSummary = async (req: any, res: any, feature: NotesFeature) => {
    const user = await who(req, res);
    if (!user) return null;
    const note = await noteFor(user, req.params.id, res);
    if (!note) return null;
    const ctx = await ctxOf(user);
    if (!need(ctx, feature, res)) return null;
    const summary = summaryOf(note);
    if (!summary) { res.status(409).json({ message: "Make the summary first." }); return null; }
    if (!deps.aiReady()) { res.status(503).json({ message: "The AI isn't set up on this site yet." }); return null; }
    return { user, note, ctx, summary };
  };

  app.post("/api/notes/:id/parent", auth, async (req: any, res) => {
    try {
      const got = await fromSummary(req, res, "parent");
      if (!got) return;
      const language = langOf(req.body?.language);
      const key = langKey(language);
      const have = got.note.extras?.parent?.[key];
      if (have && !req.body?.force) return res.json({ email: have });
      if (limited(ais, `u${got.user.id}`, res)) return;
      const w = await writeParentEmail(deps.ask, got.summary, language);
      if (!w.value) return res.status(502).json({ message: "The email didn't come through. Try again." });
      const fresh = (await store.getNote(got.note.id)) ?? got.note;
      await store.updateNote(got.note.id, { extras: { ...fresh.extras, parent: { ...(fresh.extras?.parent || {}), [key]: w.value } } });
      await store.logUsage({ userId: got.user.id, poolId: got.ctx.poolId, noteId: got.note.id, kind: "parent", minutes: 0, secs: 0, provider: "ai", costCents: aiCents(w.chars) });
      res.json({ email: w.value });
    } catch (e) { fail(res, e, "parent email"); }
  });

  app.post("/api/notes/:id/translate", auth, async (req: any, res) => {
    try {
      const got = await fromSummary(req, res, "translate");
      if (!got) return;
      const language = langOf(req.body?.language);
      const key = langKey(language);
      const have = got.note.extras?.translations?.[key];
      if (have && !req.body?.force) return res.json({ language, summary: have });
      if (limited(ais, `u${got.user.id}`, res)) return;
      const w = await translateSummary(deps.ask, got.summary, got.note.template, got.note.durationSecs || 8 * 3600, language);
      const fresh = (await store.getNote(got.note.id)) ?? got.note;
      await store.updateNote(got.note.id, { extras: { ...fresh.extras, translations: { ...(fresh.extras?.translations || {}), [key]: w.value } } });
      await store.logUsage({ userId: got.user.id, poolId: got.ctx.poolId, noteId: got.note.id, kind: "translate", minutes: 0, secs: 0, provider: "ai", costCents: aiCents(w.chars) });
      res.json({ language, summary: w.value });
    } catch (e) { fail(res, e, "translate"); }
  });

  app.post("/api/notes/:id/study", auth, async (req: any, res) => {
    try {
      const got = await fromSummary(req, res, "study");
      if (!got) return;
      const have = got.note.extras?.study;
      if (have && !req.body?.force) return res.json({ study: have });
      if (limited(ais, `u${got.user.id}`, res)) return;
      const segs = await store.getSegments(got.note.id);
      const w = await writeStudyTools(deps.ask, got.summary, transcriptForAi(segs, got.note.speakers));
      if (!w.value.flashcards.length && !w.value.quiz.length) return res.status(502).json({ message: "The study tools didn't come through. Try again." });
      const fresh = (await store.getNote(got.note.id)) ?? got.note;
      await store.updateNote(got.note.id, { extras: { ...fresh.extras, study: w.value } });
      await store.logUsage({ userId: got.user.id, poolId: got.ctx.poolId, noteId: got.note.id, kind: "study", minutes: 0, secs: 0, provider: "ai", costCents: aiCents(w.chars) });
      res.json({ study: w.value });
    } catch (e) { fail(res, e, "study"); }
  });

  /** A teacher sends the quiz to A.R.I.S.E. Reader, where their students take it as a custom quiz. */
  app.post("/api/notes/:id/study/reader", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      if (user.role !== "teacher" && !user.isAdmin) return res.status(403).json({ message: "Sending a quiz to A.R.I.S.E. Reader is for teacher accounts." });
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      const quiz = note.extras?.study?.quiz;
      if (!Array.isArray(quiz) || !quiz.length) return res.status(409).json({ message: "Make the flashcards and quiz first." });
      if (!deps.makeQuiz) return res.status(503).json({ message: "A.R.I.S.E. Reader quizzes aren't available here." });
      const letters = ["A", "B", "C", "D"];
      const made = await deps.makeQuiz(user, {
        title: cut(`${note.title} (quiz)`, 120), description: "Made from class notes with Arise Notes.",
        questions: quiz.slice(0, 10).map((q: any) => ({ prompt: cut(q.q, 300), question_image: null, option_a_text: cut(q.choices?.[0], 160), option_a_image: null, option_b_text: cut(q.choices?.[1], 160), option_b_image: null, option_c_text: cut(q.choices?.[2], 160), option_c_image: null, option_d_text: cut(q.choices?.[3], 160), option_d_image: null, correct_answer: letters[Math.max(0, Math.min(3, Number(q.answer) || 0))] })),
      });
      if (!made) return res.status(502).json({ message: "The quiz couldn't be saved to A.R.I.S.E. Reader." });
      await store.updateNote(note.id, { extras: { ...note.extras, readerQuiz: made.id } });
      res.json({ ok: true, quizId: made.id });
    } catch (e) { fail(res, e, "quiz to reader"); }
  });

  // ─── Arise To Duo ──────────────────────────────────────────────────────────
  const workAllowed = (u: User) => !!u.isAdmin || ["teacher", "parent", "todo"].includes(String(u.role));

  app.get("/api/notes/hubs/targets", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const life = deps.life ? await lifeTargets(deps.life, user.id).catch(() => null) : null;
      const work = deps.work && workAllowed(user) ? await workTargets(deps.work, user.id).catch(() => null) : null;
      res.set("Cache-Control", "no-store");
      res.json({ life, work });
    } catch (e) { fail(res, e, "hub targets"); }
  });

  /** Checked action items (and dates) go to the planner: LifeHub or WorkHub. */
  app.post("/api/notes/:id/send", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      const ctx = await ctxOf(user);
      const b = req.body || {};
      const hub = b.hub === "work" ? "work" : "life";
      const tasks: (TaskIn & { id?: string })[] = (Array.isArray(b.tasks) ? b.tasks : []).slice(0, 60).map((t: any) => ({ id: typeof t?.id === "string" ? t.id : undefined, title: cut(t?.title, 200), notes: cut(t?.notes, 1000), due: isDay(t?.due) ? t.due : "", time: isTime(t?.time) ? t.time : "", who: cut(t?.who, 100) })).filter((t: TaskIn) => t.title);
      const events: EventIn[] = (Array.isArray(b.events) ? b.events : []).slice(0, 20).map((e: any) => ({ title: cut(e?.title, 120), date: isDay(e?.date) ? e.date : "", time: isTime(e?.time) ? e.time : "", notes: cut(e?.notes, 500) })).filter((e: EventIn) => e.title && e.date);
      if (!tasks.length && !events.length) return res.status(400).json({ message: "Check at least one item to add." });
      if (tasks.length && !need(ctx, "planner", res)) return;
      if (events.length && !tasks.length && !need(ctx, "calendar", res)) return;
      let result: any;
      if (hub === "work") {
        if (!workAllowed(user) || !deps.work) return res.status(403).json({ message: "WorkHub is for adult accounts." });
        result = await addToWork(deps.work, user.id, { tasks, events, from: note.title });
      } else {
        if (!deps.life) return res.status(503).json({ message: "LifeHub isn't available here." });
        result = await addToLife(deps.life, user.id, { tasks, events, listId: cut(b.listId, 100) || undefined, calendarId: cut(b.calendarId, 100) || undefined, from: note.title });
      }
      const ids = tasks.map((t) => t.id).filter((x): x is string => !!x);
      await store.markActions(ids, user.id, hub);
      res.json({ ok: true, hub, ...result, actions: await store.getActions(note.id) });
    } catch (e: any) {
      if (/full|out of space|busy saving/i.test(String(e?.message))) return res.status(409).json({ message: e.message });
      fail(res, e, "send to planner");
    }
  });

  /** The reviewed IEP draft goes under the student in WorkHub (only after the teacher confirms). */
  app.post("/api/notes/:id/iep/send", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      const ctx = await ctxOf(user);
      if (!need(ctx, "iep", res)) return;
      if (!workAllowed(user) || !deps.work) return res.status(403).json({ message: "Filing an IEP draft needs Arise WorkHub (a teacher or adult account)." });
      const iep: IepDraft | null = cleanIep(req.body?.iep) ?? summaryOf(note)?.iep ?? null;
      if (!iep) return res.status(409).json({ message: "There's no IEP draft in this note. Make the summary with the IEP meeting template first." });
      const student = cut(req.body?.student || iep.student, 80);
      const summary = summaryOf(note);
      const text = noteText({ ...exportable(note, []), summary: summary ? { ...summary, iep } : null }, false);
      const result = await addIepToWork(deps.work, user.id, { student, iep, meetingDay: note.createdAt.slice(0, 10), noteText: text, from: note.title });
      await store.updateNote(note.id, { extras: { ...note.extras, iepSent: { student, at: new Date(now()).toISOString() } } });
      res.json({ ok: true, student, ...result });
    } catch (e: any) {
      if (/Choose the student|busy saving/i.test(String(e?.message))) return res.status(409).json({ message: e.message });
      fail(res, e, "iep to workhub");
    }
  });

  // ─── Voice memo to task ────────────────────────────────────────────────────
  app.post("/api/notes/memo", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const ctx = await ctxOf(user);
      if (!need(ctx, "memo", res)) return;
      if (limited(pieceLimit, `u${user.id}`, res)) return;
      const audio: Buffer | null = Buffer.isBuffer(req.body) ? req.body : null;
      const secs = Number(req.query?.secs) || 0;
      const ext = String(req.query?.ext || "").toLowerCase();
      if (!audio?.length || !EXTS.has(ext)) return res.status(400).json({ message: "No voice memo arrived. Try again." });
      if (secs > MEMO_MAX_SECS + 10 || audio.length > 8_000_000) return res.status(413).json({ message: "Voice memos can be up to 2 minutes." });
      const note = await store.createNote({ ownerId: user.id, title: "Voice memo", source: "memo", status: "processing", audioKeep: ctx.me.settings.audio, extras: { autoTitle: true, speakers: false } });
      const piece: PieceRow = { noteId: note.id, idx: 0, ownerId: user.id, startSecs: 0, secs: r2(secs), ext, state: "new", path: null, provider: "", error: "", bytes: audio.length, createdAt: new Date(now()).toISOString(), updatedAt: new Date(now()).toISOString() };
      await store.savePiece(piece);
      const out = await transcribePiece(ctx, note, piece, audio, String(req.headers?.["content-type"] || ""));
      if (!out.ok) return res.status(out.code === "failed" ? 502 : 402).json({ ...out, noteId: note.id });
      const text = out.segments.map((s) => s.text).join(" ").trim();
      if (!text) { await store.updateNote(note.id, { status: "ready" }); return res.json({ noteId: note.id, text: "", idea: null, usage: out.usage }); }
      const today = String(req.body?.today || req.query?.today || "");
      const day = isDay(today) ? today : new Date(now()).toISOString().slice(0, 10);
      const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
      let idea = null;
      if (deps.aiReady()) {
        try {
          const w = await readMemo(deps.ask, text, day, weekday);
          idea = w.value;
          await store.logUsage({ userId: user.id, poolId: ctx.poolId, noteId: note.id, kind: "memo", minutes: 0, secs: 0, provider: "ai", costCents: aiCents(w.chars) });
        } catch (e: any) { console.warn("[notes] memo idea:", e?.message); }
      }
      await store.updateNote(note.id, { status: "ready", title: cut(idea?.title || text, 90) || "Voice memo", extras: { autoTitle: false, speakers: false, memo: idea } });
      res.json({ noteId: note.id, text, idea, usage: out.usage });
    } catch (e) { fail(res, e, "memo"); }
  });

  // ─── Ask your notes ────────────────────────────────────────────────────────
  app.post("/api/notes/ask", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const ctx = await ctxOf(user);
      if (!need(ctx, "ask", res)) return;
      const question = cut(req.body?.question, 500);
      if (question.length < 3) return res.status(400).json({ message: "Type a question about your notes." });
      if (!deps.aiReady()) return res.status(503).json({ message: "The AI isn't set up on this site yet." });
      if (limited(ais, `u${user.id}`, res)) return;
      const today = isDay(req.body?.today) ? req.body.today : new Date(now()).toISOString().slice(0, 10);
      const plan = await planSearch(deps.ask, question, today);
      const terms = searchQuery([...plan.value.keywords, question]);
      let hits = terms ? await store.search(user.id, terms, plan.value.from || null, plan.value.to || null, 40) : [];
      if (!hits.length && (plan.value.from || plan.value.to) && terms) hits = await store.search(user.id, terms, null, null, 40);
      // The best lines, each with the one before and after it for context.
      const picked = hits.slice(0, 12);
      const passages: { noteId: string; title: string; t: number; date: string; text: string }[] = [];
      for (const h of picked) {
        const segs = await store.getSegments(h.noteId);
        const i = segs.findIndex((s) => s.idx === h.idx);
        const around = segs.slice(Math.max(0, i - 1), i + 2).map((s) => s.text).join(" ");
        passages.push({ noteId: h.noteId, title: h.title || "Untitled note", t: Math.round(h.start), date: h.createdAt.slice(0, 10), text: cut(around || h.text, 700) });
      }
      let chars = 0;
      let answer = "I couldn't find that in your notes.", found = false;
      if (passages.length) {
        const w = await answerFromPassages(deps.ask, question, passages.map((p) => `(${p.title}, ${p.date}, at ${fmtClock(p.t)}) ${p.text}`));
        chars = w.chars + plan.chars;
        if (w.value.answer) { answer = w.value.answer; found = w.value.found; }
      }
      const used = new Set([...answer.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1])));
      const cites = passages.map((p, i) => ({ n: i + 1, noteId: p.noteId, title: p.title, t: p.t, date: p.date, text: p.text })).filter((c) => used.has(c.n));
      await store.logUsage({ userId: user.id, poolId: ctx.poolId, noteId: null, kind: "ask", minutes: 0, secs: 0, provider: "ai", costCents: aiCents(chars || plan.chars) });
      res.json({ answer, found: found && cites.length > 0, cites });
    } catch (e) { fail(res, e, "ask"); }
  });

  // ─── Export and share ──────────────────────────────────────────────────────
  app.post("/api/notes/:id/email", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      const ctx = await ctxOf(user);
      if (!need(ctx, "export", res)) return;
      const full = await deps.getUser(user.id);
      if (!full?.email) return res.status(409).json({ message: "Your account doesn't have an email address yet. Add one in your account settings." });
      if (!deps.email) return res.status(503).json({ message: "Email isn't set up on this site." });
      const segs = await store.getSegments(note.id);
      const withTranscript = segs.reduce((n, s) => n + s.text.length, 0) < 60_000;
      const html = noteHtml(exportable(note, segs), withTranscript) + (withTranscript ? "" : "<p><em>The full transcript is in Arise Notes.</em></p>");
      if (!(await deps.email(full.email, `Notes: ${note.title || "Untitled note"}`, html))) return res.status(502).json({ message: "The email couldn't be sent just now." });
      res.json({ ok: true, to: full.email.replace(/^(.).*(@.*)$/, "$1…$2") });
    } catch (e) { fail(res, e, "email"); }
  });

  app.post("/api/notes/:id/share", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const note = await noteFor(user, req.params.id, res);
      if (!note) return;
      const on = req.body?.on === true;
      if (on) { const ctx = await ctxOf(user); if (!need(ctx, "share", res)) return; }
      const token = note.shareToken || randomBytes(18).toString("base64url");
      await store.updateNote(note.id, { shareToken: token, shareOn: on });
      res.json({ on, token, path: `/notes/#/s/${token}` });
    } catch (e) { fail(res, e, "share"); }
  });

  /** A view-only link (no sign-in): the summary and transcript, never the audio. */
  app.get("/api/notes/shared/:token", async (req: any, res) => {
    try {
      if (limited(shareViews, clientAddress(req), res)) return;
      const note = await store.noteByShare(String(req.params.token || ""));
      if (!note) return res.status(404).json({ message: "This link was turned off or doesn't exist." });
      const segments = await store.getSegments(note.id);
      res.set("Cache-Control", "no-store");
      res.set("X-Robots-Tag", "noindex, nofollow");
      res.json({ note: { title: note.title, createdAt: note.createdAt, durationSecs: note.durationSecs, template: note.template, summary: summaryOf(note), segments, speakers: note.speakers } });
    } catch (e) { fail(res, e, "shared"); }
  });

  // ─── Family plan ───────────────────────────────────────────────────────────
  app.post("/api/notes/family/code", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const ctx = await ctxOf(user);
      if (ctx.plan !== "family" || ctx.pooled) return res.status(409).json({ message: "Only the person with the Family plan can invite people." });
      let code = "";
      for (let i = 0; i < 5 && !code; i++) { const c = familyCode(); if (!(await store.ownerOfCode(c))) code = c; }
      await store.saveAccount({ ...ctx.me, familyCode: code || null });
      res.json({ code });
    } catch (e) { fail(res, e, "family code"); }
  });

  app.post("/api/notes/family/join", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      if (limited(joins, `u${user.id}`, res)) return;
      const code = cleanFamilyCode(req.body?.code);
      const owner = code.length === 8 ? await store.ownerOfCode(code) : null;
      if (!owner) return res.status(404).json({ message: "That invite code didn't work. Check it with the person who sent it." });
      if (owner === user.id) return res.status(409).json({ message: "That's your own invite code. Send it to the people you want to add." });
      if ((await deps.planOf(owner, await deps.getUser(owner))) !== "family") return res.status(409).json({ message: "That Family plan isn't active right now." });
      const already = await store.familyOwnerOf(user.id);
      if (already && already !== owner) return res.status(409).json({ message: "You're already on another family's plan. Leave it first." });
      if ((await deps.planOf(user.id, user)) === "family") return res.status(409).json({ message: "You have your own Family plan already." });
      const members = await store.familyMembers(owner);
      if (!members.includes(user.id) && members.length >= NOTES_PLANS.family.people - 1) return res.status(409).json({ message: "That Family plan is full (4 people)." });
      await store.addFamilyMember(user.id, owner);
      const ownerName = cut((await deps.getUser(owner))?.displayName, 60) || "the family";
      await deps.push?.(owner, { title: "Arise Notes", body: `${cut(user.displayName, 60) || "Someone"} joined your Family plan.`, url: "/notes/#/family" }).catch(() => 0);
      res.json({ ok: true, owner: ownerName });
    } catch (e) { fail(res, e, "family join"); }
  });

  app.post("/api/notes/family/remove", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      const memberId = Number(req.body?.memberId);
      if (memberId === user.id || req.body?.leave === true) {
        await store.removeFamilyMember(user.id);
        return res.json({ ok: true });
      }
      if ((await store.familyOwnerOf(memberId)) !== user.id) return res.status(404).json({ message: "That person isn't on your Family plan." });
      await store.removeFamilyMember(memberId);
      res.json({ ok: true });
    } catch (e) { fail(res, e, "family remove"); }
  });

  // ─── Privacy: delete everything ────────────────────────────────────────────
  app.post("/api/notes/wipe", auth, async (req: any, res) => {
    try {
      const user = await who(req, res);
      if (!user) return;
      if (String(req.body?.confirm || "") !== "DELETE") return res.status(400).json({ message: "Type DELETE to confirm." });
      const paths = await store.wipe(user.id);
      if (paths.length) await store.removeAudio(paths);
      res.json({ ok: true, audio: paths.length });
    } catch (e) { fail(res, e, "wipe"); }
  });

  // ─── Admin: heavy users ────────────────────────────────────────────────────
  app.get("/api/notes/admin/usage", auth, async (req: any, res) => {
    try {
      if (!req.user?.isAdmin) return res.status(403).json({ message: "Admin only." });
      const since = `${monthStartOf(now())}T00:00:00.000Z`;
      const rows = (await store.usageSince(since)).slice(0, 50);
      const people = await Promise.all(rows.map(async (r) => ({ ...r, costCents: Math.round(r.costCents * 100) / 100, name: cut((await deps.getUser(r.userId).catch(() => null))?.displayName, 60) || `Account ${r.userId}` })));
      res.set("Cache-Control", "no-store");
      res.json({ since, people });
    } catch (e) { fail(res, e, "admin usage"); }
  });
}

/** Audio kept for 30 days is deleted once the 30 days are up. */
export async function sweepNotesAudio(store: NotesStore, nowMs = Date.now()): Promise<number> {
  const cutoff = new Date(nowMs - 30 * 86_400_000).toISOString();
  const old = await store.expiredAudio(cutoff, 500);
  if (!old.length) return 0;
  await store.removeAudio(old.map((p) => p.path!).filter(Boolean));
  for (const p of old) await store.savePiece({ ...p, path: null });
  return old.length;
}
export function startNotesTicker(store: NotesStore) {
  const run = () => { sweepNotesAudio(store).catch((e) => console.error("[notes] audio sweep:", e?.message)); };
  setTimeout(run, 90_000).unref?.();
  setInterval(run, 3600_000).unref?.();
}
// Kept for anything that wants the clock text.
export { fmtClock, speakerName };
