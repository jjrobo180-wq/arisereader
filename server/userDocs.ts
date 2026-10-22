// Arise Office and the premium apps: each person's own saved files, kept on the server.
//
// Sheets, Docs and Slides files can be big (a workbook with thousands of cells, a document with
// many pages), far too big to ride along inside the one JSON a hub is saved as (capped at a few
// megabytes for everything in it). So each file is its own JSON object in a private Supabase
// Storage bucket, with a small index per person for the file lists. The premium apps keep their
// data here too (one object per app), so they never eat into the hub's space either.
//
//   GET    /api/docs?kind=sheet            list my files of a kind (newest first)
//   POST   /api/docs                       make a file  { kind, name, content }
//   GET    /api/docs/:id                   open one
//   PUT    /api/docs/:id                   save         { name?, content?, baseUpdatedAt? }  409 if it changed elsewhere
//   DELETE /api/docs/:id                   move to trash (kept 30 days) — POST /api/docs/:id/restore brings it back
//   GET    /api/docs/:id/versions          version history (a copy at most every 10 minutes, 25 kept)
//   GET    /api/docs/:id/versions/:at      one old version
//   GET/PUT /api/app-data/:app             a premium app's saved data (?owner=<id>: a linked profile's, if shared)
//
// Everything is private: paths start with the signed-in person's id, and only signed URLs or the
// server itself ever read them.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";

const BUCKET = "arise-user-docs";
export const DOC_KINDS = ["sheet", "doc", "slides"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const MAX_DOC_BYTES = 10_000_000;
export const MAX_APP_BYTES = 2_000_000;
const MAX_FILES = 2000;
const VERSION_EVERY_MS = 10 * 60_000;
const VERSIONS_KEPT = 25;
const TRASH_DAYS = 30;

export type DocEntry = { id: string; kind: DocKind; name: string; createdAt: string; updatedAt: string; size: number; trashedAt?: string; starred?: boolean };

/** What a storage bucket needs to do here. The real one is Supabase Storage; tests pass a map. */
export type DocStore = {
  read(path: string): Promise<string | null>;
  write(path: string, body: string): Promise<void>;
  remove(paths: string[]): Promise<void>;
  list(prefix: string): Promise<string[]>;
};

export function supabaseDocStore(getAdminSupabase: () => any): DocStore {
  let ready: Promise<void> | null = null;
  const bucket = () => {
    const db = getAdminSupabase();
    const r: Promise<void> = ready ??= db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: "12MB" })
      .then(({ error }: any) => { if (error && !/already exists|duplicate/i.test(error.message || "")) console.error("[docs] bucket:", error.message); })
      .catch((e: any) => console.error("[docs] bucket check failed:", e?.message || e));
    return r.then(() => db.storage.from(BUCKET));
  };
  return {
    async read(path) {
      const { data, error } = await (await bucket()).download(path);
      if (error) {
        const status = String((error as any).statusCode || (error as any).status || "");
        if (status === "404" || /not found|does not exist/i.test(error.message || "")) return null;
        // A temporary storage failure is NOT the same thing as an empty account.
        // Returning null here could cause the next save to overwrite the file index.
        throw new Error(error.message || "Document storage unavailable");
      }
      return data ? await data.text() : null;
    },
    async write(path, body) {
      const { error } = await (await bucket()).upload(path, Buffer.from(body, "utf8"), { contentType: "application/json", upsert: true, cacheControl: "0" });
      if (error) throw new Error(error.message || "save failed");
    },
    async remove(paths) {
      if (!paths.length) return;
      const { error } = await (await bucket()).remove(paths);
      if (error) throw new Error(error.message || "remove failed");
    },
    async list(prefix) {
      const { data, error } = await (await bucket()).list(prefix, { limit: 1000, sortBy: { column: "name", order: "desc" } });
      if (error) return [];
      return (data || []).map((f: any) => String(f.name));
    },
  };
}

const isKind = (k: unknown): k is DocKind => (DOC_KINDS as readonly string[]).includes(String(k));
const cleanName = (v: unknown, kind: DocKind) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || (kind === "sheet" ? "Untitled spreadsheet" : kind === "doc" ? "Untitled document" : "Untitled presentation");
const isId = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9_-]{6,64}$/.test(v);
const isAppId = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9-]{2,60}$/.test(v);

/** One lock per person, so two saves at once can't both rewrite the index from the same old copy. */
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(key, next);
  next.finally(() => { if (locks.get(key) === next) locks.delete(key); }).catch(() => {});
  return next;
}

/** Linked profiles (server/profileLinks.ts): may this person read or change another account's app? */
export type OwnerAppAccess = (req: any, ownerId: number, appKey: string, need: "view" | "edit") => Promise<boolean>;

export function registerUserDocRoutes(app: Express, authMiddleware: RequestHandler, store: DocStore, now: () => number = Date.now, ownerAccess?: OwnerAppAccess) {
  const uid = (req: any) => (req.user?.id ? String(req.user.id) : "");
  const indexPath = (u: string) => `${u}/_index.json`;
  const docPath = (u: string, id: string) => `${u}/docs/${id}.json`;
  const verDir = (u: string, id: string) => `${u}/versions/${id}`;

  async function readIndex(u: string): Promise<DocEntry[]> {
    const raw = await store.read(indexPath(u));
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.filter((e: any) => e && isId(e.id) && isKind(e.kind)) : [];
    } catch { return []; }
  }
  const writeIndex = (u: string, list: DocEntry[]) => store.write(indexPath(u), JSON.stringify(list.slice(0, MAX_FILES)));

  /** Files in the trash past 30 days are deleted for good the next time the list is read. */
  async function sweepTrash(u: string, list: DocEntry[]): Promise<DocEntry[]> {
    const cutoff = now() - TRASH_DAYS * 86_400_000;
    const old = list.filter((e) => e.trashedAt && Date.parse(e.trashedAt) < cutoff);
    if (!old.length) return list;
    await store.remove(old.map((e) => docPath(u, e.id))).catch(() => {});
    const keep = list.filter((e) => !old.includes(e));
    await writeIndex(u, keep).catch(() => {});
    return keep;
  }

  app.get("/api/docs", authMiddleware, async (req: any, res) => {
    const u = uid(req);
    if (!u) return res.status(401).json({ message: "Sign in to see your files." });
    try {
      const kind = req.query?.kind;
      const list = await sweepTrash(u, await readIndex(u));
      const trash = req.query?.trash === "1";
      res.set("Cache-Control", "no-store");
      res.json({ docs: list.filter((e) => (!kind || e.kind === kind) && (trash ? !!e.trashedAt : !e.trashedAt)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
    } catch (e: any) {
      console.error("[docs] list failed:", e?.message);
      res.status(500).json({ message: "Couldn't load your files. Try again." });
    }
  });

  app.post("/api/docs", authMiddleware, async (req: any, res) => {
    const u = uid(req);
    if (!u) return res.status(401).json({ message: "Sign in to save files." });
    const kind = req.body?.kind;
    if (!isKind(kind)) return res.status(400).json({ message: "Unknown kind of file." });
    const content = req.body?.content ?? null;
    const body = JSON.stringify(content);
    if (Buffer.byteLength(body) > MAX_DOC_BYTES) return res.status(413).json({ message: "That file is too big to save (10 MB at most)." });
    try {
      const entry = await withLock(u, async () => {
        const list = await readIndex(u);
        if (list.length >= MAX_FILES) throw Object.assign(new Error("full"), { status: 409 });
        const at = new Date(now()).toISOString();
        const e: DocEntry = { id: randomUUID().replace(/-/g, "").slice(0, 20), kind, name: cleanName(req.body?.name, kind), createdAt: at, updatedAt: at, size: Buffer.byteLength(body) };
        await store.write(docPath(u, e.id), JSON.stringify({ ...e, content }));
        await writeIndex(u, [e, ...list]);
        return e;
      });
      res.json({ doc: entry });
    } catch (e: any) {
      if (e?.status === 409) return res.status(409).json({ message: `You have ${MAX_FILES} files. Delete some to make more.` });
      console.error("[docs] create failed:", e?.message);
      res.status(500).json({ message: "Couldn't make that file. Try again." });
    }
  });

  app.get("/api/docs/:id", authMiddleware, async (req: any, res) => {
    const u = uid(req);
    if (!u) return res.status(401).json({ message: "Sign in to open files." });
    if (!isId(req.params.id)) return res.status(400).json({ message: "That isn't a file." });
    try {
      const raw = await store.read(docPath(u, req.params.id));
      if (!raw) return res.status(404).json({ message: "That file couldn't be found. It may have been deleted." });
      res.set("Cache-Control", "no-store");
      res.type("application/json").send(raw);
    } catch {
      res.status(500).json({ message: "Couldn't open that file. Try again." });
    }
  });

  app.put("/api/docs/:id", authMiddleware, async (req: any, res) => {
    const u = uid(req), id = req.params.id;
    if (!u) return res.status(401).json({ message: "Sign in to save." });
    if (!isId(id)) return res.status(400).json({ message: "That isn't a file." });
    const hasContent = req.body && "content" in req.body;
    const body = hasContent ? JSON.stringify(req.body.content) : "";
    if (Buffer.byteLength(body) > MAX_DOC_BYTES) return res.status(413).json({ message: "That file is too big to save (10 MB at most)." });
    try {
      const out = await withLock(u, async () => {
        const list = await readIndex(u);
        const entry = list.find((e) => e.id === id);
        if (!entry) throw Object.assign(new Error("gone"), { status: 404 });
        const base = req.body?.baseUpdatedAt;
        if (hasContent && typeof base === "string" && base && base !== entry.updatedAt && req.body?.force !== true) {
          throw Object.assign(new Error("conflict"), { status: 409, updatedAt: entry.updatedAt });
        }
        const at = new Date(now()).toISOString();
        let content: unknown;
        if (hasContent) {
          content = req.body.content;
          // A copy for version history, at most every ten minutes.
          const versions = (await store.list(verDir(u, id)).catch(() => [])).filter((n) => n.endsWith(".json")).sort().reverse();
          const last = versions[0] ? Number(versions[0].replace(".json", "")) : 0;
          if (now() - last >= VERSION_EVERY_MS) {
            const prev = await store.read(docPath(u, id)).catch(() => null);
            if (prev) {
              await store.write(`${verDir(u, id)}/${now()}.json`, prev).catch(() => {});
              const extra = versions.slice(VERSIONS_KEPT - 1);
              if (extra.length) await store.remove(extra.map((n) => `${verDir(u, id)}/${n}`)).catch(() => {});
            }
          }
        } else {
          const raw = await store.read(docPath(u, id));
          content = raw ? JSON.parse(raw).content : null;
        }
        const next: DocEntry = {
          ...entry,
          name: req.body?.name !== undefined ? cleanName(req.body.name, entry.kind) : entry.name,
          ...(typeof req.body?.starred === "boolean" ? { starred: req.body.starred } : {}),
          updatedAt: at, size: hasContent ? Buffer.byteLength(body) : entry.size,
        };
        await store.write(docPath(u, id), JSON.stringify({ ...next, content }));
        await writeIndex(u, [next, ...list.filter((e) => e.id !== id)]);
        return next;
      });
      res.json({ doc: out });
    } catch (e: any) {
      if (e?.status === 404) return res.status(404).json({ message: "That file was deleted." });
      if (e?.status === 409) return res.status(409).json({ message: "This file was changed on another device.", updatedAt: e.updatedAt, code: "doc_conflict" });
      console.error("[docs] save failed:", e?.message);
      res.status(500).json({ message: "Couldn't save. Your changes are kept on this device and will save when you're back online." });
    }
  });

  const trashMove = (trashed: boolean) => async (req: any, res: any) => {
    const u = uid(req), id = req.params.id;
    if (!u) return res.status(401).json({ message: "Sign in first." });
    if (!isId(id)) return res.status(400).json({ message: "That isn't a file." });
    try {
      await withLock(u, async () => {
        const list = await readIndex(u);
        await writeIndex(u, list.map((e) => (e.id !== id ? e : trashed ? { ...e, trashedAt: new Date(now()).toISOString() } : (({ trashedAt: _t, ...rest }) => rest)(e))));
      });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Couldn't do that. Try again." });
    }
  };
  app.delete("/api/docs/:id", authMiddleware, trashMove(true));
  app.post("/api/docs/:id/restore", authMiddleware, trashMove(false));

  app.get("/api/docs/:id/versions", authMiddleware, async (req: any, res) => {
    const u = uid(req), id = req.params.id;
    if (!u || !isId(id)) return res.status(400).json({ message: "That isn't a file." });
    const names = (await store.list(verDir(u, id)).catch(() => [])).filter((n) => /^\d+\.json$/.test(n)).sort().reverse();
    res.json({ versions: names.map((n) => ({ at: Number(n.replace(".json", "")) })) });
  });
  app.get("/api/docs/:id/versions/:at", authMiddleware, async (req: any, res) => {
    const u = uid(req), id = req.params.id, at = String(req.params.at);
    if (!u || !isId(id) || !/^\d{10,15}$/.test(at)) return res.status(400).json({ message: "That isn't a version." });
    const raw = await store.read(`${verDir(u, id)}/${at}.json`).catch(() => null);
    if (!raw) return res.status(404).json({ message: "That version is gone." });
    res.type("application/json").send(raw);
  });

  // ── A premium app's own saved data ──
  // With ?owner=<id>, the app's data of someone who shares it with this person (Linked profiles):
  // reading needs View, saving needs Edit, checked on the server every time.
  async function appOwner(req: any, res: any, need: "view" | "edit"): Promise<string | null> {
    const u = uid(req);
    if (!u) { res.status(401).json({ message: "Sign in first." }); return null; }
    const raw = req.query?.owner;
    if (raw === undefined || raw === "" || String(raw) === u) return u;
    const ownerId = Number(raw);
    if (!ownerAccess || !Number.isInteger(ownerId) || ownerId <= 0) { res.status(400).json({ message: "Unknown account." }); return null; }
    if (!(await ownerAccess(req, ownerId, String(req.params.app), need).catch(() => false))) {
      res.status(403).json({ message: need === "edit" ? "You can look at this, but not change it. Ask them for Edit access." : "This isn't shared with you any more." });
      return null;
    }
    return String(ownerId);
  }
  app.get("/api/app-data/:app", authMiddleware, async (req: any, res) => {
    const appId = req.params.app;
    if (!isAppId(appId)) return res.status(400).json({ message: "Unknown app." });
    const u = await appOwner(req, res, "view");
    if (!u) return;
    try {
      const raw = await store.read(`${u}/apps/${appId}.json`);
      res.set("Cache-Control", "no-store");
      if (!raw) return res.json({ data: null, updatedAt: null });
      res.type("application/json").send(raw);
    } catch {
      res.status(500).json({ message: "Couldn't load this app's data." });
    }
  });
  app.put("/api/app-data/:app", authMiddleware, async (req: any, res) => {
    const appId = req.params.app;
    if (!isAppId(appId)) return res.status(400).json({ message: "Unknown app." });
    const u = await appOwner(req, res, "edit");
    if (!u) return;
    const body = JSON.stringify({ data: req.body?.data ?? null, updatedAt: new Date(now()).toISOString() });
    if (Buffer.byteLength(body) > MAX_APP_BYTES) return res.status(413).json({ message: "This app is full. Delete some older entries to save more." });
    try {
      await store.write(`${u}/apps/${appId}.json`, body);
      res.json({ ok: true, updatedAt: JSON.parse(body).updatedAt });
    } catch {
      res.status(500).json({ message: "Couldn't save. It's kept on this device and will save when you're back online." });
    }
  });
}
