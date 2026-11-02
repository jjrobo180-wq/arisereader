// Where Arise Notes → Notes are kept (migrations/arise_pages.sql), and an in-memory copy for tests.
// A save names the revision it started from; if someone else saved first (another device), nothing
// is written and the newer copy comes back so the device can sort it out.
import type { Page, PageMeta, PageSettings } from "../shared/arisePages";
import { cleanSettings, DEFAULT_SETTINGS } from "../shared/arisePages";

export type SaveResult = { ok: true; page: Page } | { ok: false; page: Page };
export type Version = { rev: number; createdAt: string; bytes: number; kind: Page["kind"]; locked: boolean; content?: Page["content"]; cipher?: Page["cipher"] };

export interface PagesStore {
  list(ownerId: number, since?: string): Promise<PageMeta[]>;
  get(id: string): Promise<(Page & { ownerId: number }) | null>;
  /** Writes `page` as revision baseRev + 1 if the stored revision is still baseRev (0: a new note). */
  save(ownerId: number, page: Page, baseRev: number, bytes: number): Promise<SaveResult>;
  setDeleted(ownerId: number, id: string, at: string | null): Promise<Page | null>;
  remove(ownerId: number, ids: string[]): Promise<number>;
  count(ownerId: number): Promise<number>;
  search(ownerId: number, q: string): Promise<PageMeta[]>;
  settings(ownerId: number): Promise<PageSettings>;
  saveSettings(ownerId: number, s: PageSettings, baseRev: number): Promise<{ ok: boolean; settings: PageSettings }>;
  addVersion(ownerId: number, p: Page, bytes: number): Promise<void>;
  versions(id: string): Promise<Version[]>;
  version(id: string, rev: number): Promise<Version | null>;
  /** Notes deleted more than `days` ago are removed for good. */
  purgeTrash(before: string): Promise<number>;
}

const metaOf = (p: Page): PageMeta => {
  const { content, cipher: _c, search: _s, ...rest } = p;
  return { ...rest, content: { title: content.title, html: "", ink: [], look: content.look }, title: content.title } as PageMeta;
};

type Db = { from: (t: string) => any };
const PAGE_COLS = "id, owner_id, kind, folder_id, color, pinned, tags, locked, content, cipher, preview, search, rev, created_at, updated_at, deleted_at";
// The list leaves the content out (it can be megabytes); the title and look come from it.
const META_COLS = "id, owner_id, kind, folder_id, color, pinned, tags, locked, title:content->>title, look:content->look, preview, rev, created_at, updated_at, deleted_at";

const fromRow = (r: any): Page & { ownerId: number } => ({
  id: r.id, ownerId: Number(r.owner_id), kind: r.kind === "ink" ? "ink" : "text", folderId: r.folder_id ?? "", color: r.color ?? "", pinned: !!r.pinned, tags: r.tags ?? [], locked: !!r.locked,
  content: { title: r.content?.title ?? "", html: r.content?.html ?? "", ink: r.content?.ink ?? [], look: r.content?.look ?? {} },
  cipher: r.cipher ?? null, preview: r.preview ?? "", search: r.search ?? "", rev: Number(r.rev) || 1,
  createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(), deletedAt: r.deleted_at ? new Date(r.deleted_at).toISOString() : null,
});
const metaFromRow = (r: any): PageMeta => ({
  id: r.id, kind: r.kind === "ink" ? "ink" : "text", folderId: r.folder_id ?? "", color: r.color ?? "", pinned: !!r.pinned, tags: r.tags ?? [], locked: !!r.locked,
  content: { title: r.title ?? "", html: "", ink: [], look: r.look ?? {} } as any, title: r.title ?? "", preview: r.preview ?? "", rev: Number(r.rev) || 1,
  createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(), deletedAt: r.deleted_at ? new Date(r.deleted_at).toISOString() : null,
});
const toRow = (ownerId: number, p: Page, rev: number, bytes: number) => ({
  id: p.id, owner_id: ownerId, kind: p.kind, folder_id: p.folderId || null, color: p.color, pinned: p.pinned, tags: p.tags, locked: p.locked,
  content: p.content, cipher: p.cipher, preview: p.preview, search: p.search, bytes, rev, created_at: p.createdAt, updated_at: p.updatedAt, deleted_at: p.deletedAt,
});
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export function createSupabasePagesStore(db: () => Db): PagesStore {
  const must = <T,>(r: { data: T; error: any }): T => { if (r.error) throw new Error(r.error.message || String(r.error)); return r.data; };
  const VERSIONS_KEPT = 30;
  return {
    async list(ownerId, since) {
      const out: PageMeta[] = [];
      for (let from = 0; from < 20_000; from += 1000) {
        let q = db().from("arise_pages").select(META_COLS).eq("owner_id", ownerId);
        if (since) q = q.gt("updated_at", since);
        const rows = must(await q.order("updated_at", { ascending: false }).range(from, from + 999)) as any[];
        out.push(...rows.map(metaFromRow));
        if (rows.length < 1000) break;
      }
      return out;
    },
    async get(id) {
      const row = must(await db().from("arise_pages").select(PAGE_COLS).eq("id", id).maybeSingle());
      return row ? fromRow(row) : null;
    },
    async save(ownerId, page, baseRev, bytes) {
      const rev = baseRev + 1;
      if (baseRev === 0) {
        const r = await db().from("arise_pages").insert(toRow(ownerId, page, 1, bytes)).select(PAGE_COLS).maybeSingle();
        if (!r.error && r.data) return { ok: true, page: fromRow(r.data) };
        if (r.error && !/duplicate|unique/i.test(String(r.error.message))) throw new Error(r.error.message);
      } else {
        const rows = must(await db().from("arise_pages").update(toRow(ownerId, page, rev, bytes)).eq("id", page.id).eq("owner_id", ownerId).eq("rev", baseRev).select(PAGE_COLS)) as any[];
        if (rows?.length) return { ok: true, page: fromRow(rows[0]) };
      }
      const now = await this.get(page.id);
      if (!now || now.ownerId !== ownerId) throw new Error("not found");
      return { ok: false, page: now };
    },
    async setDeleted(ownerId, id, at) {
      const rows = must(await db().from("arise_pages").update({ deleted_at: at, updated_at: new Date().toISOString() }).eq("id", id).eq("owner_id", ownerId).select(PAGE_COLS)) as any[];
      if (!rows?.length) return null;
      // Each change counts as a revision, so other devices see it.
      const r = rows[0];
      const bumped = must(await db().from("arise_pages").update({ rev: Number(r.rev) + 1 }).eq("id", id).eq("owner_id", ownerId).select(PAGE_COLS)) as any[];
      return fromRow(bumped[0] ?? r);
    },
    async remove(ownerId, ids) {
      if (!ids.length) return 0;
      const rows = must(await db().from("arise_pages").delete().eq("owner_id", ownerId).in("id", ids).select("id")) as any[];
      return rows?.length ?? 0;
    },
    async count(ownerId) {
      const r = await db().from("arise_pages").select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
      if (r.error) throw new Error(r.error.message);
      return Number(r.count) || 0;
    },
    async search(ownerId, q) {
      const rows = must(await db().from("arise_pages").select(META_COLS).eq("owner_id", ownerId).is("deleted_at", null).ilike("search", like(q)).order("updated_at", { ascending: false }).limit(200)) as any[];
      return rows.map(metaFromRow);
    },
    async settings(ownerId) {
      const row = must(await db().from("arise_pages_settings").select("data, rev").eq("owner_id", ownerId).maybeSingle()) as any;
      return row ? cleanSettings(row.data, Number(row.rev) || 1) : { ...DEFAULT_SETTINGS };
    },
    async saveSettings(ownerId, s, baseRev) {
      const data = { folders: s.folders, vault: s.vault, prefs: s.prefs };
      if (baseRev === 0) {
        const r = await db().from("arise_pages_settings").insert({ owner_id: ownerId, data, rev: 1 }).select("data, rev").maybeSingle();
        if (!r.error && r.data) return { ok: true, settings: cleanSettings(r.data.data, 1) };
      } else {
        const rows = must(await db().from("arise_pages_settings").update({ data, rev: baseRev + 1, updated_at: new Date().toISOString() }).eq("owner_id", ownerId).eq("rev", baseRev).select("data, rev")) as any[];
        if (rows?.length) return { ok: true, settings: cleanSettings(rows[0].data, Number(rows[0].rev)) };
      }
      return { ok: false, settings: await this.settings(ownerId) };
    },
    async addVersion(ownerId, p, bytes) {
      const last = must(await db().from("arise_page_versions").select("rev, created_at").eq("page_id", p.id).order("rev", { ascending: false }).limit(1)) as any[];
      if (last?.[0] && Date.now() - Date.parse(last[0].created_at) < 10 * 60_000) return;
      must(await db().from("arise_page_versions").upsert({ page_id: p.id, rev: p.rev, owner_id: ownerId, kind: p.kind, locked: p.locked, content: p.content, cipher: p.cipher, bytes }, { onConflict: "page_id,rev" }));
      const old = must(await db().from("arise_page_versions").select("rev").eq("page_id", p.id).order("rev", { ascending: false }).range(VERSIONS_KEPT, VERSIONS_KEPT + 200)) as any[];
      if (old?.length) must(await db().from("arise_page_versions").delete().eq("page_id", p.id).in("rev", old.map((o) => o.rev)));
    },
    async versions(id) {
      const rows = must(await db().from("arise_page_versions").select("rev, created_at, bytes, kind, locked").eq("page_id", id).order("rev", { ascending: false })) as any[];
      return rows.map((r) => ({ rev: Number(r.rev), createdAt: new Date(r.created_at).toISOString(), bytes: Number(r.bytes) || 0, kind: r.kind, locked: !!r.locked }));
    },
    async version(id, rev) {
      const r = must(await db().from("arise_page_versions").select("rev, created_at, bytes, kind, locked, content, cipher").eq("page_id", id).eq("rev", rev).maybeSingle()) as any;
      return r ? { rev: Number(r.rev), createdAt: new Date(r.created_at).toISOString(), bytes: Number(r.bytes) || 0, kind: r.kind, locked: !!r.locked, content: r.content, cipher: r.cipher } : null;
    },
    async purgeTrash(before) {
      const rows = must(await db().from("arise_pages").delete().lt("deleted_at", before).select("id")) as any[];
      return rows?.length ?? 0;
    },
  };
}

export function createMemoryPagesStore(): PagesStore & { _pages: Map<string, Page & { ownerId: number }>; _versions: Map<string, Version[]> } {
  const pages = new Map<string, Page & { ownerId: number }>();
  const settings = new Map<number, PageSettings>();
  const versions = new Map<string, Version[]>();
  const copy = <T,>(v: T): T => structuredClone(v);
  return {
    _pages: pages,
    _versions: versions,
    async list(ownerId, since) { return [...pages.values()].filter((p) => p.ownerId === ownerId && (!since || p.updatedAt > since)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => metaOf(copy(p))); },
    async get(id) { const p = pages.get(id); return p ? copy(p) : null; },
    async save(ownerId, page, baseRev) {
      const cur = pages.get(page.id);
      if (cur && cur.ownerId !== ownerId) throw new Error("not found");
      if ((cur?.rev ?? 0) !== baseRev) return { ok: false, page: copy(cur!) };
      const next = { ...copy(page), rev: baseRev + 1, ownerId };
      pages.set(page.id, next);
      return { ok: true, page: copy(next) };
    },
    async setDeleted(ownerId, id, at) { const p = pages.get(id); if (!p || p.ownerId !== ownerId) return null; p.deletedAt = at; p.rev++; p.updatedAt = new Date().toISOString(); return copy(p); },
    async remove(ownerId, ids) { let n = 0; for (const id of ids) { const p = pages.get(id); if (p?.ownerId === ownerId) { pages.delete(id); versions.delete(id); n++; } } return n; },
    async count(ownerId) { return [...pages.values()].filter((p) => p.ownerId === ownerId).length; },
    async search(ownerId, q) { const w = q.toLowerCase(); return [...pages.values()].filter((p) => p.ownerId === ownerId && !p.deletedAt && p.search.toLowerCase().includes(w)).map((p) => metaOf(copy(p))); },
    async settings(ownerId) { return copy(settings.get(ownerId) ?? { ...DEFAULT_SETTINGS }); },
    async saveSettings(ownerId, s, baseRev) {
      const cur = settings.get(ownerId);
      if ((cur?.rev ?? 0) !== baseRev) return { ok: false, settings: copy(cur ?? { ...DEFAULT_SETTINGS }) };
      const next = { ...copy(s), rev: baseRev + 1 };
      settings.set(ownerId, next);
      return { ok: true, settings: copy(next) };
    },
    async addVersion(_o, p, bytes) {
      const list = versions.get(p.id) ?? [];
      if (list[0] && Date.now() - Date.parse(list[0].createdAt) < 10 * 60_000) return;
      list.unshift({ rev: p.rev, createdAt: new Date().toISOString(), bytes, kind: p.kind, locked: p.locked, content: copy(p.content), cipher: copy(p.cipher) });
      versions.set(p.id, list.slice(0, 30));
    },
    async versions(id) { return (versions.get(id) ?? []).map(({ content: _c, cipher: _x, ...v }) => v); },
    async version(id, rev) { const v = (versions.get(id) ?? []).find((x) => x.rev === rev); return v ? copy(v) : null; },
    async purgeTrash(before) { let n = 0; for (const [id, p] of pages) if (p.deletedAt && p.deletedAt < before) { pages.delete(id); n++; } return n; },
  };
}
