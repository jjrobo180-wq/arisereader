// Notes on every device: each device keeps its own copy (IndexedDB) so notes open instantly and work
// offline, and syncs with the server (server/arisePages.ts) a moment after each change, every 15
// seconds while open, and when the connection comes back.
//
// Every save names the revision it started from. If another device saved first, the server turns it
// back with its newer copy: the newer copy is kept in the note, and this device's version is kept as
// a separate "conflict copy", so nothing anyone wrote is lost.
// Locked notes are only ever kept encrypted, here and on the server.
import { DEFAULT_SETTINGS, cleanSettings, type Page, type PageMeta, type PageSettings } from "@shared/arisePages";
import { api, NotesError } from "../api";

export type SyncState = "loading" | "synced" | "syncing" | "offline" | "error";
type Row = { id: string; meta: PageMeta; page: Page | null; dirty: boolean; baseRev: number };
type Op = { kind: "delete" | "restore"; id: string };
type Snapshot = { metas: PageMeta[]; settings: PageSettings; state: SyncState; message: string };

const metaOf = (p: Page): PageMeta => {
  const { content, cipher: _c, search: _s, ...rest } = p;
  return { ...rest, content: { title: content.title, html: "", ink: [], look: content.look }, title: content.title };
};
export const newPageId = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16)));

// ─── IndexedDB ───────────────────────────────────────────────────────────────
function openDb(userId: number): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(`arise-pages-${userId}`, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("pages")) d.createObjectStore("pages", { keyPath: "id" });
        if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
const tx = <T,>(db: IDBDatabase | null, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> =>
  new Promise((resolve) => {
    if (!db) { resolve(undefined); return; }
    try {
      const t = db.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => resolve(r ? (r as IDBRequest<T>).result : undefined);
      t.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });

// ─── The engine ──────────────────────────────────────────────────────────────
export class PagesSync {
  private db: IDBDatabase | null = null;
  private rows = new Map<string, Row>();
  private settings: PageSettings = { ...DEFAULT_SETTINGS };
  private settingsDirty = false;
  private ops: Op[] = [];
  private lastSync = "";
  private state: SyncState = "loading";
  private message = "";
  private listeners = new Set<(s: Snapshot) => void>();
  private remoteListeners = new Set<(id: string) => void>();
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private again = false;
  private stopped = false;
  private ready: Promise<void>;

  constructor(readonly userId: number) {
    this.ready = this.load();
  }

  // ─── Reading ───
  private async load() {
    this.db = await openDb(this.userId);
    const rows = ((await tx<Row[]>(this.db, "pages", "readonly", (s) => s.getAll())) ?? []) as Row[];
    for (const r of rows) this.rows.set(r.id, r);
    const kv = async <T,>(k: string) => (await tx<T>(this.db, "kv", "readonly", (s) => s.get(k))) as T | undefined;
    this.settings = cleanSettings((await kv<any>("settings")) ?? DEFAULT_SETTINGS, (await kv<number>("settingsRev")) ?? 0);
    this.settingsDirty = (await kv<boolean>("settingsDirty")) ?? false;
    this.ops = (await kv<Op[]>("ops")) ?? [];
    this.lastSync = (await kv<string>("lastSync")) ?? "";
    this.state = rows.length ? "syncing" : "loading";
    this.emit();
    void this.sync();
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.onWake);
      window.addEventListener("focus", this.onWake);
      document.addEventListener("visibilitychange", this.onWake);
      this.pollTimer = setInterval(() => { if (document.visibilityState === "visible") void this.sync(); }, 15_000);
    }
  }
  private onWake = () => { if (document.visibilityState === "visible") void this.sync(); };
  stop() {
    this.stopped = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    window.removeEventListener("online", this.onWake);
    window.removeEventListener("focus", this.onWake);
    document.removeEventListener("visibilitychange", this.onWake);
  }

  subscribe(fn: (s: Snapshot) => void) { this.listeners.add(fn); fn(this.snapshot()); return () => { this.listeners.delete(fn); }; }
  /** Told when an open note changed on another device. */
  onRemote(fn: (id: string) => void) { this.remoteListeners.add(fn); return () => { this.remoteListeners.delete(fn); }; }
  snapshot(): Snapshot {
    return { metas: [...this.rows.values()].map((r) => r.meta), settings: this.settings, state: this.state, message: this.message };
  }
  private emit() { const s = this.snapshot(); this.listeners.forEach((f) => f(s)); }
  private put(r: Row) { this.rows.set(r.id, r); void tx(this.db, "pages", "readwrite", (s) => { s.put(r); }); }
  private kvSet(k: string, v: unknown) { void tx(this.db, "kv", "readwrite", (s) => { s.put(v, k); }); }

  /** A whole note: from this device when it's up to date, else from the server. */
  async open(id: string): Promise<Page | null> {
    await this.ready;
    const r = this.rows.get(id);
    if (r?.page && (r.dirty || r.page.rev >= r.meta.rev)) return structuredClone(r.page);
    try {
      const { page } = await api<{ page: Page }>(`pages/${id}`);
      const keep = this.rows.get(id);
      if (keep?.dirty && keep.page) return structuredClone(keep.page); // typed while it loaded
      this.put({ id, meta: metaOf(page), page, dirty: false, baseRev: page.rev });
      this.emit();
      return structuredClone(page);
    } catch (e) {
      if (r?.page) return structuredClone(r.page); // offline: the copy here
      if (e instanceof NotesError && e.status === 404) { this.rows.delete(id); void tx(this.db, "pages", "readwrite", (s) => { s.delete(id); }); this.emit(); }
      return null;
    }
  }
  cached(id: string): Page | null { const p = this.rows.get(id)?.page; return p ? structuredClone(p) : null; }
  meta(id: string): PageMeta | null { return this.rows.get(id)?.meta ?? null; }

  // ─── Writing ───
  /** Keeps a change on this device now and sends it a moment later. */
  save(page: Page) {
    const r = this.rows.get(page.id);
    const p: Page = { ...page, updatedAt: new Date().toISOString() };
    this.put({ id: p.id, meta: metaOf(p), page: p, dirty: true, baseRev: r?.baseRev ?? 0 });
    this.emit();
    this.schedule();
  }
  remove(id: string) { this.mark(id, new Date().toISOString()); this.ops.push({ kind: "delete", id }); this.kvSet("ops", this.ops); this.schedule(50); }
  restore(id: string) { this.mark(id, null); this.ops.push({ kind: "restore", id }); this.kvSet("ops", this.ops); this.schedule(50); }
  private mark(id: string, at: string | null) {
    const r = this.rows.get(id);
    if (!r) return;
    this.put({ ...r, meta: { ...r.meta, deletedAt: at }, page: r.page ? { ...r.page, deletedAt: at } : null });
    this.emit();
  }
  /** Gone for good (from Recently Deleted, or locked notes after a forgotten password). */
  async forever(ids: string[], lockedReset = false) {
    await api("pages/forever", { method: "POST", body: { ids, lockedReset } });
    for (const id of ids) { this.rows.delete(id); void tx(this.db, "pages", "readwrite", (s) => { s.delete(id); }); }
    this.emit();
  }
  saveSettings(next: PageSettings) {
    this.settings = { ...next, rev: this.settings.rev };
    this.settingsDirty = true;
    this.kvSet("settings", this.settings); this.kvSet("settingsDirty", true);
    this.emit();
    this.schedule(200);
  }
  getSettings() { return this.settings; }

  private schedule(ms = 700) {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => void this.sync(), ms);
  }
  /** Sends the rest now (when leaving a note). */
  flush() { return this.sync(); }

  // ─── Syncing ───
  async sync(): Promise<void> {
    await this.ready;
    if (this.stopped) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    if (this.state !== "loading") this.state = "syncing";
    this.emit();
    try {
      await this.pushOps();
      await this.pushPages();
      await this.pushSettings();
      await this.pull();
      this.state = "synced"; this.message = "";
    } catch (e: any) {
      this.state = e instanceof NotesError && e.status === 0 ? "offline" : "error";
      this.message = e?.message || "";
      this.schedule(this.state === "offline" ? 8000 : 15_000);
    } finally {
      this.busy = false;
      this.emit();
      if (this.again) { this.again = false; void this.sync(); }
    }
  }

  private async pushOps() {
    while (this.ops.length) {
      const op = this.ops[0];
      try { await api(op.kind === "delete" ? `pages/${op.id}` : `pages/${op.id}/restore`, { method: op.kind === "delete" ? "DELETE" : "POST" }); }
      catch (e) { if (!(e instanceof NotesError) || e.status === 0 || e.status >= 500) throw e; } // a 404: already gone
      this.ops.shift();
      this.kvSet("ops", this.ops);
    }
  }

  private async pushPages() {
    for (const r of [...this.rows.values()].filter((x) => x.dirty && x.page)) {
      const page = r.page!;
      try {
        const { page: saved } = await api<{ page: Page }>(`pages/${page.id}`, { method: "PUT", body: { page, baseRev: r.baseRev } });
        const now = this.rows.get(page.id);
        // Typed again while it was sending: keep the newer words, on top of the saved revision.
        const changed = now?.page && now.page.updatedAt !== page.updatedAt;
        this.put({ id: page.id, meta: changed ? now!.meta : metaOf(saved), page: changed ? now!.page : saved, dirty: !!changed, baseRev: saved.rev });
      } catch (e) {
        if (!(e instanceof NotesError)) throw e;
        if (e.status === 409 && e.body?.page) {
          // Another device saved first: theirs stays in the note, ours becomes a copy.
          const theirs: Page = e.body.page;
          this.put({ id: theirs.id, meta: metaOf(theirs), page: theirs, dirty: false, baseRev: theirs.rev });
          if (!sameContent(page, theirs)) {
            const copyId = newPageId();
            const copy: Page = { ...page, id: copyId, rev: 0, createdAt: new Date().toISOString(), content: page.locked ? page.content : { ...page.content, title: `${page.content.title || "Note"} (conflict copy)` } };
            this.put({ id: copyId, meta: metaOf(copy), page: copy, dirty: true, baseRev: 0 });
            this.message = "A note changed on another device at the same time. Both versions are kept.";
          }
          this.remoteListeners.forEach((f) => f(theirs.id));
        } else if (e.status === 404 && e.code === "gone") {
          // Removed for good on another device while this one had changes: keep this device's version.
          this.put({ ...r, baseRev: 0 });
        } else if (e.status === 413 || e.status === 400) {
          this.put({ ...r, dirty: false });
          this.message = e.message;
        } else throw e;
      }
    }
  }

  private async pushSettings() {
    if (!this.settingsDirty) return;
    try {
      const { settings } = await api<{ settings: PageSettings }>("pages-settings", { method: "PUT", body: { settings: this.settings, baseRev: this.settings.rev } });
      this.settings = settings;
    } catch (e) {
      if (!(e instanceof NotesError) || e.status !== 409) throw e;
      // Both changed: folders from both, the notes password from the server if it has one.
      const theirs = cleanSettings(e.body?.settings, e.body?.settings?.rev ?? 0);
      const folders = [...theirs.folders, ...this.settings.folders.filter((f) => !theirs.folders.some((t) => t.id === f.id))];
      this.settings = { ...this.settings, folders, vault: theirs.vault ?? this.settings.vault, rev: theirs.rev };
      this.kvSet("settings", this.settings);
      return this.pushSettings();
    }
    this.settingsDirty = false;
    this.kvSet("settings", this.settings); this.kvSet("settingsRev", this.settings.rev); this.kvSet("settingsDirty", false);
  }

  private async pull() {
    const since = this.lastSync ? new Date(Date.parse(this.lastSync) - 5000).toISOString() : "";
    const r = await api<{ pages: PageMeta[]; settings: PageSettings; now: string }>("pages", { query: since ? { since } : undefined });
    for (const m of r.pages) {
      const mine = this.rows.get(m.id);
      if (mine?.dirty) continue; // sorted out when it's sent
      if (mine && mine.meta.rev >= m.rev) continue;
      const hadPage = !!mine?.page;
      this.put({ id: m.id, meta: m, page: null, dirty: false, baseRev: m.rev });
      if (hadPage) this.remoteListeners.forEach((f) => f(m.id));
    }
    if (!this.settingsDirty && r.settings.rev !== this.settings.rev) {
      this.settings = cleanSettings(r.settings, r.settings.rev);
      this.kvSet("settings", this.settings); this.kvSet("settingsRev", this.settings.rev);
    }
    this.lastSync = r.now;
    this.kvSet("lastSync", r.now);
    // The first time on a device: every note (the full list), so ones deleted elsewhere aren't kept.
    if (!since) {
      const ids = new Set(r.pages.map((p) => p.id));
      for (const [id, row] of this.rows) if (!ids.has(id) && !row.dirty) { this.rows.delete(id); void tx(this.db, "pages", "readwrite", (s) => { s.delete(id); }); }
    }
  }
}

function sameContent(a: Page, b: Page) {
  return a.locked === b.locked && JSON.stringify(a.locked ? a.cipher : a.content) === JSON.stringify(b.locked ? b.cipher : b.content);
}

// One engine per signed-in person, shared by every screen.
let current: PagesSync | null = null;
export function pagesSyncFor(userId: number): PagesSync {
  if (current?.userId !== userId) { current?.stop(); current = new PagesSync(userId); }
  return current;
}
