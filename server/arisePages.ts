// Arise Notes → Notes: the server side of typed and handwritten notes (shared/arisePages.ts).
// Free for everyone signed in. Each device keeps its own copy and syncs here: a save names the
// revision it started from, and a save that would overwrite another device's newer change is turned
// back with the newer copy (409), so the device can keep both. Locked notes arrive already
// encrypted; the server never sees their words or the notes password.
import type { Express, RequestHandler } from "express";
import {
  PAGE_BYTES_MAX, PAGES_PER_PERSON, TRASH_DAYS, cleanPage, cleanSettings, isUuid, pageBytes, textOfHtml, type Page,
} from "../shared/arisePages";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import type { PagesStore } from "./arisePagesStore";
import type { AskJson } from "./ariseNotesAi";
import { addToLife, type LifeStore, type TaskIn } from "./ariseNotesHubs";

type User = { id: number; role?: string; isAdmin?: boolean };
export type PagesDeps = { store: PagesStore; ask?: AskJson; aiReady?: () => boolean; life?: LifeStore; now?: () => number };

const AI_ACTIONS = {
  summarize: "Summarize this note in 2 to 5 short sentences. Keep names, dates and numbers. Answer as JSON: {\"text\": \"...\"}.",
  tidy: "Tidy this note: fix spelling and grammar, make it clear and well organized, keep every fact and the writer's voice. Use short paragraphs and bullet points where they help. Answer as JSON: {\"text\": \"...\"} using plain text with \"- \" for bullets and blank lines between paragraphs.",
  todos: "List the action items in this note: things someone needs to do. Answer as JSON: {\"items\": [{\"title\": \"...\", \"due\": \"YYYY-MM-DD or empty\"}]} (at most 20; empty list if there are none). Today is TODAY.",
  continue: "Continue this note naturally for one or two short paragraphs, in the same voice. Answer as JSON: {\"text\": \"...\"}.",
  simpler: "Rewrite this note in plain, simple words a 12-year-old could follow, keeping every fact. Answer as JSON: {\"text\": \"...\"}.",
  title: "Suggest a short title (under 8 words) for this note. Answer as JSON: {\"text\": \"...\"}.",
} as const;
type AiAction = keyof typeof AI_ACTIONS;

export function registerPagesRoutes(app: Express, auth: RequestHandler, deps: PagesDeps) {
  const store = deps.store;
  const now = deps.now ?? Date.now;
  const stamp = () => new Date(now()).toISOString();
  const saves = createAttemptLimiter({ max: 1200, windowMs: 3600_000, now });
  const ais = createAttemptLimiter({ max: 60, windowMs: 3600_000, now });

  const fail = (res: any, e: any, what: string) => {
    console.error(`[pages] ${what}:`, e?.message || e);
    if (!res.headersSent) res.status(500).json({ message: "Your notes couldn't be reached just now. Your changes are kept on this device and will sync." });
  };
  const who = (req: any, res: any): User | null => {
    const u = req.user;
    if (!u || !Number.isSafeInteger(Number(u.id)) || req.adminPreview) { res.status(403).json({ message: "Sign in to your own account to use Notes." }); return null; }
    return { ...u, id: Number(u.id) };
  };
  const limited = (lim: ReturnType<typeof createAttemptLimiter>, key: string, res: any) => {
    const wait = lim.retryAfter(key);
    if (wait > 0) { res.status(429).json({ message: `That's a lot at once. Try again in ${waitWords(wait)}.` }); return true; }
    lim.fail(key);
    return false;
  };
  /** A note this person owns, or a 404 (someone else's note is "not found", never "forbidden"). */
  const mine = async (user: User, id: string, res: any) => {
    const p = isUuid(id) ? await store.get(id.toLowerCase()) : null;
    if (!p || p.ownerId !== user.id) { res.status(404).json({ message: "That note isn't here. It may have been deleted." }); return null; }
    return p;
  };
  const view = (p: Page & { ownerId?: number }) => { const { ownerId: _o, search: _s, ...rest } = p as any; return rest; };

  // Everything changed since `since` (or all notes), and the settings. Devices call this to sync.
  app.get("/api/pages", auth, async (req: any, res) => {
    try {
      const user = who(req, res);
      if (!user) return;
      const since = typeof req.query?.since === "string" && !Number.isNaN(Date.parse(req.query.since)) ? new Date(req.query.since).toISOString() : undefined;
      const [pages, settings] = await Promise.all([store.list(user.id, since), store.settings(user.id)]);
      res.set("Cache-Control", "no-store");
      res.json({ pages, settings, now: stamp() });
    } catch (e) { fail(res, e, "list"); }
  });

  app.get("/api/pages/search", auth, async (req: any, res) => {
    try {
      const user = who(req, res);
      if (!user) return;
      const q = String(req.query?.q ?? "").trim().slice(0, 100);
      res.json({ pages: q.length < 2 ? [] : await store.search(user.id, q) });
    } catch (e) { fail(res, e, "search"); }
  });

  app.put("/api/pages-settings", auth, async (req: any, res) => {
    try {
      const user = who(req, res);
      if (!user) return;
      const baseRev = Math.max(0, Math.floor(Number(req.body?.baseRev) || 0));
      const out = await store.saveSettings(user.id, cleanSettings(req.body?.settings), baseRev);
      res.status(out.ok ? 200 : 409).json({ settings: out.settings });
    } catch (e) { fail(res, e, "settings"); }
  });

  app.get("/api/pages/:id", auth, async (req: any, res) => {
    try {
      const user = who(req, res);
      if (!user) return;
      const p = await mine(user, req.params.id, res);
      if (!p) return;
      res.set("Cache-Control", "no-store");
      res.json({ page: view(p) });
    } catch (e) { fail(res, e, "open"); }
  });

  // Save (and make) a note. The device chooses the id, so a note made offline keeps it.
  app.put("/api/pages/:id", auth, async (req: any, res) => {
    try {
      const user = who(req, res);
      if (!user) return;
      if (limited(saves, `u${user.id}`, res)) return;
      const id = String(req.params.id || "").toLowerCase();
      if (!isUuid(id)) return res.status(400).json({ message: "That note doesn't look right." });
      const baseRev = Math.max(0, Math.floor(Number(req.body?.baseRev) || 0));
      const prev = await store.get(id);
      if (prev && prev.ownerId !== user.id) return res.status(404).json({ message: "That note isn't here." });
      if (!prev && baseRev > 0) return res.status(404).json({ message: "That note was deleted on another device.", code: "gone" });
      if (!prev && (await store.count(user.id)) >= PAGES_PER_PERSON) return res.status(409).json({ message: `You have ${PAGES_PER_PERSON.toLocaleString("en-US")} notes, the most one account can keep. Empty Recently Deleted or remove old notes first.` });
      const page = cleanPage({ ...req.body?.page, id }, stamp(), prev);
      page.id = id;
      const bytes = pageBytes(page);
      if (bytes > PAGE_BYTES_MAX) return res.status(413).json({ message: "This note is too big to sync (pictures and pages add up). Split it into two notes, or remove a few pictures." });
      const out = await store.save(user.id, page, baseRev, bytes);
      if (!out.ok) return res.status(409).json({ message: "This note changed on another device.", page: view(out.page) });
      // An earlier version, for Version history (at most every 10 minutes).
      if (prev && prev.rev >= 1) await store.addVersion(user.id, prev, pageBytes(prev)).catch((e) => console.error("[pages] version:", e?.message));
      res.json({ page: view(out.page) });
    } catch (e) { fail(res, e, "save"); }
  });

  /** To Recently Deleted (kept 30 days), or back. */
  app.delete("/api/pages/:id", auth, async (req: any, res) => {
    try {
      const user = who(req, res);
      if (!user) return;
      if (!(await mine(user, req.params.id, res))) return;
      const p = await store.setDeleted(user.id, req.params.id.toLowerCase(), stamp());
      res.json({ page: p && view(p) });
    } catch (e) { fail(res, e, "delete"); }
  });
  app.post("/api/pages/:id/restore", auth, async (req: any, res) => {
    try {
      const user = who(req, res);
      if (!user) return;
      if (!(await mine(user, req.params.id, res))) return;
      const p = await store.setDeleted(user.id, req.params.id.toLowerCase(), null);
      res.json({ page: p && view(p) });
    } catch (e) { fail(res, e, "restore"); }
  });
  /** Gone for good: one note, or everything in Recently Deleted. */
  app.post("/api/pages/forever", auth, async (req: any, res) => {
    try {
      const user = who(req, res);
      if (!user) return;
      const ids: string[] = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter(isUuid).map((x: string) => x.toLowerCase()).slice(0, 10_000);
      const list = await store.list(user.id);
      // Normally only notes already in Recently Deleted. "Forgot my notes password" clears the locked
      // notes instead, since nobody can open them any more.
      const ok = new Set(list.filter((p) => (req.body?.lockedReset === true ? p.locked : !!p.deletedAt)).map((p) => p.id));
      const allowed = ids.filter((id) => ok.has(id));
      res.json({ removed: await store.remove(user.id, allowed) });
    } catch (e) { fail(res, e, "remove"); }
  });

  // Version history.
  app.get("/api/pages/:id/versions", auth, async (req: any, res) => {
    try {
      const user = who(req, res);
      if (!user) return;
      if (!(await mine(user, req.params.id, res))) return;
      res.json({ versions: await store.versions(req.params.id.toLowerCase()) });
    } catch (e) { fail(res, e, "versions"); }
  });
  app.get("/api/pages/:id/versions/:rev", auth, async (req: any, res) => {
    try {
      const user = who(req, res);
      if (!user) return;
      if (!(await mine(user, req.params.id, res))) return;
      const v = await store.version(req.params.id.toLowerCase(), Math.floor(Number(req.params.rev)));
      if (!v) return res.status(404).json({ message: "That version isn't kept any more." });
      res.json({ version: v });
    } catch (e) { fail(res, e, "version"); }
  });

  // AI help on a typed note (never on a locked one: its words never reach the server).
  app.post("/api/pages/:id/ai", auth, async (req: any, res) => {
    try {
      const user = who(req, res);
      if (!user) return;
      const p = await mine(user, req.params.id, res);
      if (!p) return;
      if (p.locked) return res.status(400).json({ message: "Locked notes stay private, so AI tools can't read them." });
      if (!deps.ask || !(deps.aiReady?.() ?? true)) return res.status(503).json({ message: "AI help isn't switched on for this site yet." });
      const action = String(req.body?.action || "") as AiAction;
      if (!(action in AI_ACTIONS)) return res.status(400).json({ message: "Choose what the AI should do." });
      if (limited(ais, `u${user.id}`, res)) return;
      // The device sends the text it has (it may be newer than the last save); else the saved note's.
      const text = (typeof req.body?.text === "string" && req.body.text.trim() ? req.body.text : p.search || textOfHtml(p.content.html)).slice(0, 24_000);
      if (text.trim().length < 3) return res.status(400).json({ message: "There's nothing in this note yet." });
      const today = new Date(now()).toISOString().slice(0, 10);
      const { json } = await deps.ask(AI_ACTIONS[action].replace("TODAY", today), text, { maxTokens: 1400, temperature: 0.3 });
      if (action === "todos") {
        const items = (Array.isArray(json?.items) ? json.items : []).slice(0, 20).map((x: any) => ({ title: String(x?.title ?? x ?? "").replace(/\s+/g, " ").trim().slice(0, 200), due: /^\d{4}-\d{2}-\d{2}$/.test(String(x?.due)) ? String(x.due) : "" })).filter((x: any) => x.title);
        return res.json({ items });
      }
      const out = String(json?.text ?? "").trim().slice(0, 20_000);
      if (!out) return res.status(502).json({ message: "The AI didn't answer. Try again in a moment." });
      res.json({ text: out });
    } catch (e) { fail(res, e, "ai"); }
  });

  // Checked to-dos go to Arise To Duo's LifeHub (the Reminders and Calendar happen on the iPhone).
  app.post("/api/pages/:id/planner", auth, async (req: any, res) => {
    try {
      const user = who(req, res);
      if (!user) return;
      const p = await mine(user, req.params.id, res);
      if (!p) return;
      if (!deps.life) return res.status(503).json({ message: "LifeHub isn't available here." });
      const tasks: TaskIn[] = (Array.isArray(req.body?.tasks) ? req.body.tasks : []).slice(0, 60).map((t: any) => ({ title: String(t?.title ?? "").replace(/\s+/g, " ").trim().slice(0, 200), notes: "", due: /^\d{4}-\d{2}-\d{2}$/.test(String(t?.due)) ? t.due : "", time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t?.time)) ? t.time : "", who: "" })).filter((t: TaskIn) => t.title);
      if (!tasks.length) return res.status(400).json({ message: "Check at least one to-do." });
      const title = p.locked ? "a locked note" : (p.content.title || "a note");
      const r = await addToLife(deps.life, user.id, { tasks, events: [], from: title });
      res.json({ ok: true, ...r });
    } catch (e: any) {
      if (/full|out of space|busy saving/i.test(String(e?.message))) return res.status(409).json({ message: e.message });
      fail(res, e, "planner");
    }
  });
}

/** Removes notes that have been in Recently Deleted for 30 days (hourly). */
export function startPagesTicker(store: PagesStore) {
  const run = () => { void store.purgeTrash(new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString()).catch((e) => console.error("[pages] purge:", e?.message)); };
  setTimeout(run, 60_000);
  setInterval(run, 3600_000).unref?.();
}
