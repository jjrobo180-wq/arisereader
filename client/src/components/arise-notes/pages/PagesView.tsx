// The Notes tab: every typed and handwritten note, in folders, searchable, synced across devices.
// On a phone the list and a note take turns; on an iPad or computer they sit side by side, like
// Apple Notes. New notes start from a blank page or a template (meeting, journal, Cornell, graph
// paper…), in the look you chose for new notes.
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText, FolderPlus, Grid2X2, Hash, LayoutTemplate, List as ListIcon, Lock, LockOpen, PenLine, Pin, Plus, RotateCcw, Search, Settings2, Trash2 } from "lucide-react";
import { DEFAULT_LOOK, PAGE_TEMPLATES, PAPER_THEMES, TRASH_DAYS, blankInkPage, cleanLook, pageTitle, type Folder, type Page, type PageMeta, type PageTemplate } from "@shared/arisePages";
import { api } from "../api";
import { Btn, IconBtn, Notice, Sheet, Spinner, Toggle, shortDate, useToast } from "../ui";
import type { AppCtx } from "../NotesApp";
import PageScreen from "./PageScreen";
import { drafts } from "./drafts";
import { lockNow } from "./pagesLock";
import { FolderSheet, SYNC_WORDS, VaultSheet, usePages, useUnlocked } from "./pagesUi";
import { newPageId } from "./pagesSync";
import { groupNotes } from "./pagesGroups";

type Filter = { kind: "all" } | { kind: "pinned" } | { kind: "folder"; id: string } | { kind: "tag"; tag: string } | { kind: "locked" } | { kind: "ink" } | { kind: "trash" };
const FKEY = "arise-pages-filter";

export default function PagesView({ ctx, openId, tabs }: { ctx: AppCtx; openId: string | null; tabs: React.ReactNode }) {
  const userId = ctx.me.user.id;
  const say = useToast();
  const { sync, metas, settings, state, message } = usePages(userId);
  const key = useUnlocked(settings.vault);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Set<string> | null>(null);
  const [filter, setFilterState] = useState<Filter>(() => { try { return JSON.parse(localStorage.getItem(FKEY) || "") as Filter; } catch { return { kind: "all" }; } });
  const setFilter = (f: Filter) => { setFilterState(f); try { localStorage.setItem(FKEY, JSON.stringify(f)); } catch { /* not kept */ } };
  const [sheet, setSheet] = useState<"" | "new" | "folder" | "settings" | "vault">("");
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1000);
  useEffect(() => { const f = () => setWide(window.innerWidth >= 1000); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  useEffect(() => { if (message) say(message); }, [message, say]);

  // Search: titles and previews right away, then every word (and handwriting) from the server.
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setFound(null); return; }
    const t = setTimeout(() => { api<{ pages: PageMeta[] }>("pages/search", { query: { q: s } }).then((r) => setFound(new Set(r.pages.map((p) => p.id)))).catch(() => {}); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const folders = useMemo(() => [...settings.folders].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)), [settings.folders]);
  const live = metas.filter((m) => !m.deletedAt);
  const tags = useMemo(() => [...new Set(live.flatMap((m) => m.tags))].sort().slice(0, 30), [live]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = filter.kind === "trash" ? metas.filter((m) => m.deletedAt) : live;
    if (filter.kind === "pinned") list = list.filter((m) => m.pinned);
    if (filter.kind === "folder") list = list.filter((m) => m.folderId === filter.id);
    if (filter.kind === "tag") list = list.filter((m) => m.tags.includes(filter.tag));
    if (filter.kind === "locked") list = list.filter((m) => m.locked);
    if (filter.kind === "ink") list = list.filter((m) => m.kind === "ink");
    if (s) list = list.filter((m) => found?.has(m.id) || `${m.title} ${m.preview}`.toLowerCase().includes(s));
    const sort = settings.prefs.sort;
    return [...list].sort((a, b) => (filter.kind !== "trash" && Number(b.pinned) - Number(a.pinned)) || (sort === "title" ? pageTitle(a).localeCompare(pageTitle(b)) : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt)));
  }, [metas, live, filter, q, found, settings.prefs.sort]);

  const open = (id: string) => ctx.go({ name: "page", id });
  const create = (t: PageTemplate) => {
    const id = newPageId();
    const now = new Date().toISOString();
    const look = cleanLook({ ...settings.prefs.look, ...t.look });
    const page: Page = {
      id, kind: t.kind, folderId: filter.kind === "folder" ? filter.id : "", color: "", pinned: false, tags: [], locked: false,
      content: { title: t.title, html: t.html ?? "", ink: t.kind === "ink" ? [blankInkPage(t.paper ?? "lined")] : [], look }, cipher: null,
      preview: "", search: "", rev: 0, createdAt: now, updatedAt: now, deletedAt: null,
    };
    drafts.set(id, page);
    setSheet("");
    open(id);
  };
  const saveFolders = (f: Folder[]) => sync.saveSettings({ ...settings, folders: f });
  // A widget's "New note" or "Handwrite" opens here with a new note.
  useEffect(() => {
    const check = () => {
      let want: string | null = null;
      try { want = sessionStorage.getItem("arise-pages-new"); sessionStorage.removeItem("arise-pages-new"); } catch { /* none */ }
      if (want) create(PAGE_TEMPLATES.find((t) => t.id === (want === "ink" ? "ink-lined" : "blank"))!);
    };
    check();
    window.addEventListener("arise-pages-new", check);
    return () => window.removeEventListener("arise-pages-new", check);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nav = <nav className="space-y-1" aria-label="Folders">
    <NavRow on={filter.kind === "all"} icon={<FileText className="h-[18px] w-[18px]" />} tint="linear-gradient(135deg,#8a6bff,#5b45d8)" label="All notes" count={live.length} onClick={() => setFilter({ kind: "all" })} />
    <NavRow on={filter.kind === "pinned"} icon={<Pin className="h-[18px] w-[18px]" />} tint="linear-gradient(135deg,#ffb23f,#f08a00)" label="Pinned" count={live.filter((m) => m.pinned).length} onClick={() => setFilter({ kind: "pinned" })} />
    <NavRow on={filter.kind === "ink"} icon={<PenLine className="h-[18px] w-[18px]" />} tint="linear-gradient(135deg,#ff7a85,#ea3f55)" label="Handwritten" count={live.filter((m) => m.kind === "ink").length} onClick={() => setFilter({ kind: "ink" })} />
    <NavRow on={filter.kind === "locked"} icon={<Lock className="h-[18px] w-[18px]" />} tint="linear-gradient(135deg,#7d8499,#505770)" label="Locked" count={live.filter((m) => m.locked).length} onClick={() => setFilter({ kind: "locked" })} />
    {folders.length > 0 && <p className="an-eyebrow px-3 pb-1 pt-4">Folders</p>}
    {folders.map((f) => <NavRow key={f.id} on={filter.kind === "folder" && filter.id === f.id} icon={<span className="text-[18px] leading-none">{f.icon}</span>} tint={f.color ? `${f.color}33` : "#ecebf5"} soft label={f.name} count={live.filter((m) => m.folderId === f.id).length}
      onClick={() => setFilter({ kind: "folder", id: f.id })} onEdit={() => { setEditFolder(f); setSheet("folder"); }} />)}
    <button type="button" className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-semibold text-[var(--an-violet)] hover:bg-[var(--an-violet-soft)]" onClick={() => { setEditFolder(null); setSheet("folder"); }} data-testid="pages-new-folder"><span className="grid h-9 w-9 place-items-center rounded-xl border border-dashed border-[var(--an-violet)]/40"><FolderPlus className="h-[18px] w-[18px]" /></span>New folder</button>
    {tags.length > 0 && <><p className="an-eyebrow px-3 pb-1 pt-4">Tags</p>
      <div className="flex flex-wrap gap-1.5 px-2">{tags.map((t) => <button key={t} type="button" className="an-chip !min-h-8 !text-[13px]" aria-pressed={filter.kind === "tag" && filter.tag === t} onClick={() => setFilter({ kind: "tag", tag: t })}><Hash className="h-3 w-3" />{t}</button>)}</div></>}
    <div className="pt-3"><NavRow on={filter.kind === "trash"} icon={<Trash2 className="h-[18px] w-[18px]" />} tint="linear-gradient(135deg,#b9bdcb,#8d92a6)" label="Recently Deleted" count={metas.filter((m) => m.deletedAt).length} onClick={() => setFilter({ kind: "trash" })} /></div>
  </nav>;

  const filterName = filter.kind === "all" ? "All notes" : filter.kind === "pinned" ? "Pinned" : filter.kind === "ink" ? "Handwritten" : filter.kind === "locked" ? "Locked" : filter.kind === "trash" ? "Recently Deleted" : filter.kind === "tag" ? `#${filter.tag}` : folders.find((f) => f.id === filter.id)?.name ?? "Folder";
  const grid = settings.prefs.view === "grid" && !wide;

  const by = settings.prefs.sort === "created" ? "createdAt" : "updatedAt";
  const sections = useMemo(() => (filter.kind === "trash" || q.trim() || settings.prefs.sort === "title" ? [{ label: "", items: shown }] : groupNotes(shown, by)), [shown, filter.kind, q, settings.prefs.sort, by]);
  const card = (m: PageMeta, i: number) => <PageCard key={m.id} m={m} i={i} grid={grid} on={openId === m.id} folder={folders.find((f) => f.id === m.folderId)} trash={filter.kind === "trash"}
    onOpen={() => open(m.id)} onRestore={() => { sync.restore(m.id); say("Restored."); }} onForever={async () => { if (!window.confirm("Delete this note for good?")) return; await sync.forever([m.id]).catch((e) => say(e.message)); }} />;

  const list = <div className="relative flex h-full min-h-0 flex-col">
    <div className="space-y-3.5 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          {!wide ? <FilterMenu name={filterName}>{nav}</FilterMenu> : <h2 className="an-display truncate text-[34px]">{filterName}</h2>}
          <p className="mt-1 text-[13px] text-[var(--an-muted)]" aria-live="polite">{shown.length} {shown.length === 1 ? "note" : "notes"}<span className="text-[var(--an-faint)]"> · {SYNC_WORDS[state]}</span></p>
        </div>
        {settings.vault && key && <button type="button" className="an-round-btn" aria-label="Lock locked notes now" onClick={() => { lockNow(); say("Locked notes are locked."); }}><LockOpen className="h-[18px] w-[18px]" /></button>}
        {!wide && <button type="button" className="an-round-btn" aria-label={grid ? "Show as a list" : "Show as cards"} onClick={() => sync.saveSettings({ ...settings, prefs: { ...settings.prefs, view: grid ? "list" : "grid" } })}>{grid ? <ListIcon className="h-[18px] w-[18px]" /> : <Grid2X2 className="h-[18px] w-[18px]" />}</button>}
        <button type="button" className="an-round-btn" aria-label="Notes settings" onClick={() => setSheet("settings")}><Settings2 className="h-[18px] w-[18px]" /></button>
      </div>
      <label className="an-search block"><span className="sr-only">Search notes</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-[var(--an-faint)]" aria-hidden />
        <input className="an-input an-bare an-search-input" style={{ height: "3rem", borderRadius: 999, paddingLeft: "2.9rem" }} placeholder="Search notes and handwriting" value={q} onChange={(e) => setQ(e.target.value)} data-testid="pages-search" />
      </label>
      {filter.kind !== "trash" && <div className="an-scroll -mx-4 flex gap-2 overflow-x-auto px-4">
        <button type="button" className="an-quick" onClick={() => create(PAGE_TEMPLATES.find((t) => t.id === "ink-lined")!)} data-testid="pages-new-ink"><PenLine className="h-4 w-4" />Handwrite</button>
        <button type="button" className="an-quick" onClick={() => setSheet("new")} data-testid="pages-templates"><LayoutTemplate className="h-4 w-4" />Templates</button>
      </div>}
      {filter.kind === "trash" && <div className="flex items-center gap-2 text-[13px] text-[var(--an-muted)]"><span className="flex-1">Notes stay here {TRASH_DAYS} days, then they're deleted for good.</span>
        {shown.length > 0 && <Btn kind="danger" onClick={async () => { if (!window.confirm(`Delete ${shown.length} note${shown.length === 1 ? "" : "s"} for good? This can't be undone.`)) return; try { await sync.forever(shown.map((m) => m.id)); say("Deleted for good."); } catch (e: any) { say(e.message); } }}>Empty</Btn>}</div>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-44">
      {state === "loading" && !metas.length ? <Spinner /> : shown.length === 0 ? <Empty filter={filter} q={q} onNew={() => create(PAGE_TEMPLATES[0])} />
        : <div data-testid="pages-list">{sections.map((sec) => <section key={sec.label || "all"}>
          {sec.label && <h3 className="an-group-label">{sec.label}<span>{sec.items.length}</span></h3>}
          <ul className={grid ? "an-masonry" : "an-rows"} style={sec.label ? undefined : { marginTop: ".5rem" }}>{sec.items.map((m, i) => card(m, i))}</ul>
        </section>)}</div>}
    </div>
    {filter.kind !== "trash" && <button type="button" className="an-fab" style={wide ? { position: "absolute", right: "1rem", bottom: "1.25rem" } : undefined} onClick={() => create(PAGE_TEMPLATES[0])} data-testid="pages-new" aria-label="New note"><Plus className="h-6 w-6" strokeWidth={2.4} />New note</button>}
  </div>;

  const editor = openId ? <PageScreen key={openId} ctx={ctx} id={openId} onBack={() => ctx.go({ name: "pages" })} /> : null;

  return <div className="flex h-[100dvh] min-h-0 flex-col" data-testid="pages-view">
    {(!openId || wide) && tabs}
    <div className="flex min-h-0 flex-1">
      {wide ? <>
        <aside className="hidden w-[240px] shrink-0 overflow-y-auto border-r border-[var(--an-line)] px-2 py-4 lg:block">{nav}</aside>
        <section className="w-[360px] shrink-0 border-r border-[var(--an-line)]">{list}</section>
        <main className="min-w-0 flex-1">{editor ?? <div className="grid h-full place-items-center text-center text-[15px] text-[var(--an-muted)]"><div><div className="an-empty-stack"><i /><i /><i>✍️</i></div><p className="an-display text-[24px] text-[var(--an-ink)]">Choose a note</p><p className="mt-1">or start a new one.</p></div></div>}</main>
      </> : <main className="min-w-0 flex-1">{editor ?? list}</main>}
    </div>
    {sheet === "new" && <Sheet title="New note" onClose={() => setSheet("")} wide>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="pages-template-list">{PAGE_TEMPLATES.map((t) => <button key={t.id} type="button" onClick={() => create(t)} className="an-card flex items-center gap-3 p-3 text-left hover:border-[var(--an-violet)]">
        <span className="text-[24px]" aria-hidden>{t.emoji}</span><span><span className="block text-[15px] font-bold">{t.name}</span><span className="text-[12px] text-[var(--an-muted)]">{t.kind === "ink" ? "Handwriting" : "Typed"}</span></span></button>)}</div>
    </Sheet>}
    {sheet === "folder" && <FolderSheet folder={editFolder} onClose={() => setSheet("")}
      onSave={(v) => { if (editFolder) saveFolders(settings.folders.map((f) => (f.id === editFolder.id ? { ...f, ...v } : f))); else { const f = { id: newPageId(), ...v, sort: settings.folders.length }; saveFolders([...settings.folders, f]); setFilter({ kind: "folder", id: f.id }); } setSheet(""); }}
      onDelete={editFolder ? () => {
        // Its notes move to All notes.
        for (const m of live.filter((x) => x.folderId === editFolder.id)) { const p = sync.cached(m.id); if (p) sync.save({ ...p, folderId: "" }); }
        saveFolders(settings.folders.filter((f) => f.id !== editFolder.id)); setFilter({ kind: "all" }); setSheet("");
      } : undefined} />}
    {sheet === "settings" && <NotesSettingsSheet ctx={ctx} onClose={() => setSheet("")} onVault={() => setSheet("vault")} />}
    {sheet === "vault" && <VaultSheet sync={sync} settings={settings} userId={userId} onClose={() => setSheet("")} onDone={() => { setSheet(""); say("Your notes password is set. Lock any note from its menu."); }} />}
  </div>;
}

function NavRow({ on, icon, tint, soft, label, count, onClick, onEdit }: { on: boolean; icon: React.ReactNode; tint: string; soft?: boolean; label: string; count: number; onClick: () => void; onEdit?: () => void }) {
  return <div className={`group flex items-center rounded-2xl transition ${on ? "bg-[var(--an-violet-soft)]" : "hover:bg-black/[.03]"}`}>
    <button type="button" onClick={onClick} aria-pressed={on} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left text-[16px] font-semibold">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: tint, color: soft ? "var(--an-ink)" : "#fff", boxShadow: soft ? undefined : "inset 0 1px 0 rgba(255,255,255,.3)" }}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span><span className="text-[14px] font-medium tabular-nums text-[var(--an-faint)]">{count}</span>
    </button>
    {onEdit && <button type="button" className="mr-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--an-muted)] opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={onEdit} aria-label={`Edit ${label}`}>Edit</button>}
  </div>;
}

function FilterMenu({ name, children }: { name: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="an-display flex min-w-0 max-w-full items-center gap-1.5 text-[34px]" onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="pages-filter">
      <span className="truncate">{name}</span><ChevronDown className="mt-1 h-6 w-6 shrink-0 text-[var(--an-violet)]" /></button>
    {open && <Sheet title="Folders" onClose={() => setOpen(false)}><div onClick={(e) => { if ((e.target as HTMLElement).closest("button[aria-pressed]")) setOpen(false); }}>{children}</div></Sheet>}
  </>;
}

/** The colour a note wears: its own, or by kind. */
const tileOf = (m: PageMeta) => m.color || (m.kind === "ink" ? "#ef4e5b" : "#6a55dc");

function PageCard({ m, i, grid, on, folder, trash, onOpen, onRestore, onForever }: { m: PageMeta; i: number; grid: boolean; on: boolean; folder?: Folder; trash: boolean; onOpen: () => void; onRestore: () => void; onForever: () => void }) {
  const look = cleanLook(m.content?.look ?? DEFAULT_LOOK);
  const paper = PAPER_THEMES[look.theme];
  const title = pageTitle(m as any);
  const meta = <span className="flex items-center gap-1.5 text-[12px] text-[var(--an-muted)]">{m.pinned && <Pin className="h-3 w-3 text-[#f08a00]" aria-label="Pinned" />}{m.locked && <Lock className="h-3 w-3" aria-label="Locked" />}{shortDate(m.updatedAt)}{folder && <span className="truncate">· {folder.icon} {folder.name}</span>}</span>;
  const preview = m.locked ? "Locked" : m.preview || (m.kind === "ink" ? "Handwritten note" : "No text yet");
  const delay = { animationDelay: `${Math.min(i, 8) * 40}ms` };
  if (trash) return <li className="an-lift flex items-center gap-3 p-3" style={delay}>
    <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold">{title}</span>{meta}</span>
    <IconBtn label="Restore" onClick={onRestore}><RotateCcw className="h-5 w-5" /></IconBtn><IconBtn label="Delete for good" onClick={onForever}><Trash2 className="h-5 w-5 text-[#c2283a]" /></IconBtn>
  </li>;
  // Cards grow with what's in them, like paper: a long note is taller than a one-liner.
  const lines = m.locked ? 3 : Math.max(2, Math.min(9, Math.ceil(preview.length / 26)));
  if (grid) return <li className="an-lift" style={delay}><button type="button" onClick={onOpen} data-testid="pages-card" className="an-paper" data-on={on}>
    <span className="relative block px-3.5 pb-3 pt-4 text-[12.5px] leading-[1.45]" style={{ background: paper.bg, color: paper.ink, minHeight: `${3.2 + lines * 1.1}rem` }}>
      <span className="absolute left-3.5 top-0 h-1.5 w-8 rounded-b-full" style={{ background: tileOf(m) }} />
      {m.locked ? <span className="flex items-center justify-center py-5"><Lock className="h-7 w-7 opacity-40" /></span>
        : m.kind === "ink" ? <span className="flex items-center gap-2 opacity-70"><PenLine className="h-4 w-4" />{preview}</span>
        : <span className="line-clamp-[9] opacity-80" style={{ WebkitLineClamp: lines }}>{preview}</span>}
    </span>
    <span className="block border-t border-black/5 bg-white px-3.5 py-2.5"><span className="an-display block truncate text-[16px] !leading-tight">{title}</span>{meta}</span>
  </button></li>;
  return <li className="an-lift" style={delay}><button type="button" onClick={onOpen} data-testid="pages-card" className="an-row" data-on={on}>
    <span className="an-tile" style={{ background: `linear-gradient(135deg, ${tileOf(m)}, ${tileOf(m)}cc)` }} aria-hidden>{m.locked ? <Lock className="h-[18px] w-[18px]" /> : m.kind === "ink" ? <PenLine className="h-[18px] w-[18px]" /> : <FileText className="h-[18px] w-[18px]" />}</span>
    <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-bold tracking-[-.01em]">{title}</span><span className="block truncate text-[14px] text-[var(--an-muted)]">{preview}</span>{meta}</span>
  </button></li>;
}

function Empty({ filter, q, onNew }: { filter: Filter; q: string; onNew: () => void }) {
  if (q) return <p className="px-3 py-16 text-center text-[15px] text-[var(--an-muted)]">Nothing matched “{q}”.</p>;
  if (filter.kind === "trash") return <p className="px-3 py-16 text-center text-[15px] text-[var(--an-muted)]">Nothing in Recently Deleted.</p>;
  if (filter.kind === "locked") return <p className="px-3 py-16 text-center text-[15px] text-[var(--an-muted)]">No locked notes. Open a note, tap ⋯, then Lock note.</p>;
  return <div className="px-6 py-14 text-center an-lift">
    <div aria-hidden className="an-empty-stack"><i /><i /><i>✍️</i></div>
    <h3 className="an-display text-[26px]">{filter.kind === "all" ? "A fresh page" : "Nothing here yet"}</h3>
    <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-[var(--an-muted)]">Type, handwrite with your Apple Pencil, add pictures, checklists and tables. Everything syncs to your other devices.</p>
    <Btn kind="primary" className="mt-6 !min-h-12 !px-6" onClick={onNew}><Plus className="h-4 w-4" />Start writing</Btn>
  </div>;
}

function NotesSettingsSheet({ ctx, onClose, onVault }: { ctx: AppCtx; onClose: () => void; onVault: () => void }) {
  const { sync, settings } = usePages(ctx.me.user.id);
  const p = settings.prefs;
  const setP = (x: Partial<typeof p>) => sync.saveSettings({ ...settings, prefs: { ...p, ...x } });
  return <Sheet title="Notes settings" onClose={onClose}>
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-3 text-[15px] font-bold">Sort by
        <select className="an-input !w-auto !min-h-10" value={p.sort} onChange={(e) => setP({ sort: e.target.value as typeof p.sort })}><option value="edited">Last edited</option><option value="created">Date created</option><option value="title">Title</option></select></label>
      <Toggle on={p.pencilOnly} onChange={(v) => setP({ pencilOnly: v })} label="Pencil only" hint="On an iPad, only the Apple Pencil draws; your finger scrolls. Turns on by itself the first time you use a Pencil." />
      <div className="rounded-2xl border border-[var(--an-line)] p-3">
        <p className="text-[15px] font-bold">Notes password</p>
        <p className="mt-0.5 text-[13px] text-[var(--an-muted)]">{settings.vault ? "Set. Locked notes are encrypted on your devices; Arise can't open or reset them." : "Not set yet. Make one to lock notes."}</p>
        {!settings.vault && <Btn kind="soft" className="mt-2" onClick={onVault}><Lock className="h-4 w-4" />Create a notes password</Btn>}
        {settings.vault?.hint && <p className="mt-1 text-[13px]">Hint: {settings.vault.hint}</p>}
      </div>
      <Notice>The look for new notes is set from any note's Appearance (the palette button), with “Use for new notes”.</Notice>
    </div>
  </Sheet>;
}
