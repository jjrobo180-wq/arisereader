// The Notes tab: every typed and handwritten note, in folders, searchable, synced across devices.
// On a phone the list and a note take turns; on an iPad or computer they sit side by side, like
// Apple Notes. New notes start from a blank page or a template (meeting, journal, Cornell, graph
// paper…), in the look you chose for new notes.
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FolderPlus, Grid2X2, Hash, List as ListIcon, Lock, LockOpen, PenLine, Pin, Plus, RotateCcw, Search, Settings2, Trash2 } from "lucide-react";
import { DEFAULT_LOOK, PAGE_TEMPLATES, PAPER_THEMES, TRASH_DAYS, blankInkPage, cleanLook, pageTitle, type Folder, type Page, type PageMeta, type PageTemplate } from "@shared/arisePages";
import { api } from "../api";
import { Btn, IconBtn, Notice, Sheet, Spinner, Toggle, shortDate, useToast } from "../ui";
import type { AppCtx } from "../NotesApp";
import PageScreen from "./PageScreen";
import { drafts } from "./drafts";
import { lockNow } from "./pagesLock";
import { FolderSheet, SYNC_WORDS, VaultSheet, usePages, useUnlocked } from "./pagesUi";
import { newPageId } from "./pagesSync";

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

  const nav = <nav className="space-y-1" aria-label="Folders">
    <NavRow on={filter.kind === "all"} icon="🗒️" label="All notes" count={live.length} onClick={() => setFilter({ kind: "all" })} />
    <NavRow on={filter.kind === "pinned"} icon="📌" label="Pinned" count={live.filter((m) => m.pinned).length} onClick={() => setFilter({ kind: "pinned" })} />
    <NavRow on={filter.kind === "ink"} icon="✍️" label="Handwritten" count={live.filter((m) => m.kind === "ink").length} onClick={() => setFilter({ kind: "ink" })} />
    <NavRow on={filter.kind === "locked"} icon="🔒" label="Locked" count={live.filter((m) => m.locked).length} onClick={() => setFilter({ kind: "locked" })} />
    {folders.length > 0 && <p className="px-3 pb-1 pt-3 text-[12px] font-bold uppercase tracking-wider text-[var(--an-faint)]">Folders</p>}
    {folders.map((f) => <NavRow key={f.id} on={filter.kind === "folder" && filter.id === f.id} icon={f.icon} dot={f.color} label={f.name} count={live.filter((m) => m.folderId === f.id).length}
      onClick={() => setFilter({ kind: "folder", id: f.id })} onEdit={() => { setEditFolder(f); setSheet("folder"); }} />)}
    <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-semibold text-[var(--an-violet)] hover:bg-[var(--an-violet-soft)]" onClick={() => { setEditFolder(null); setSheet("folder"); }} data-testid="pages-new-folder"><FolderPlus className="h-4 w-4" />New folder</button>
    {tags.length > 0 && <><p className="px-3 pb-1 pt-3 text-[12px] font-bold uppercase tracking-wider text-[var(--an-faint)]">Tags</p>
      <div className="flex flex-wrap gap-1.5 px-2">{tags.map((t) => <button key={t} type="button" className="an-chip !min-h-8 !text-[13px]" aria-pressed={filter.kind === "tag" && filter.tag === t} onClick={() => setFilter({ kind: "tag", tag: t })}><Hash className="h-3 w-3" />{t}</button>)}</div></>}
    <div className="pt-3"><NavRow on={filter.kind === "trash"} icon="🗑️" label="Recently Deleted" count={metas.filter((m) => m.deletedAt).length} onClick={() => setFilter({ kind: "trash" })} /></div>
  </nav>;

  const filterName = filter.kind === "all" ? "All notes" : filter.kind === "pinned" ? "Pinned" : filter.kind === "ink" ? "Handwritten" : filter.kind === "locked" ? "Locked" : filter.kind === "trash" ? "Recently Deleted" : filter.kind === "tag" ? `#${filter.tag}` : folders.find((f) => f.id === filter.id)?.name ?? "Folder";
  const grid = settings.prefs.view === "grid" && !wide;

  const list = <div className="flex h-full min-h-0 flex-col">
    <div className="space-y-3 px-4 pb-3 pt-4">
      <div className="flex items-center gap-2">
        {!wide ? <FilterMenu name={filterName}>{nav}</FilterMenu> : <h2 className="min-w-0 flex-1 truncate text-[22px] font-extrabold tracking-[-.02em]">{filterName}</h2>}
        <span className="ml-auto text-[12px] text-[var(--an-faint)]" aria-live="polite">{SYNC_WORDS[state]}</span>
        {settings.vault && key && <IconBtn label="Lock locked notes now" onClick={() => { lockNow(); say("Locked notes are locked."); }}><LockOpen className="h-5 w-5" /></IconBtn>}
        {!wide && <IconBtn label={grid ? "Show as a list" : "Show as cards"} onClick={() => sync.saveSettings({ ...settings, prefs: { ...settings.prefs, view: grid ? "list" : "grid" } })}>{grid ? <ListIcon className="h-5 w-5" /> : <Grid2X2 className="h-5 w-5" />}</IconBtn>}
        <IconBtn label="Notes settings" onClick={() => setSheet("settings")}><Settings2 className="h-5 w-5" /></IconBtn>
      </div>
      <label className="relative block"><span className="sr-only">Search notes</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--an-faint)]" aria-hidden />
        <input className="an-input pl-9" placeholder="Search notes and handwriting" value={q} onChange={(e) => setQ(e.target.value)} data-testid="pages-search" />
      </label>
      {filter.kind !== "trash" && <div className="flex gap-2">
        <Btn kind="primary" className="flex-1" onClick={() => create(PAGE_TEMPLATES[0])} data-testid="pages-new"><Plus className="h-4 w-4" />New note</Btn>
        <Btn kind="soft" onClick={() => create(PAGE_TEMPLATES.find((t) => t.id === "ink-lined")!)} data-testid="pages-new-ink"><PenLine className="h-4 w-4" />Handwrite</Btn>
        <Btn kind="plain" onClick={() => setSheet("new")} aria-label="More kinds of note" data-testid="pages-templates"><ChevronDown className="h-4 w-4" /></Btn>
      </div>}
      {filter.kind === "trash" && <div className="flex items-center gap-2 text-[13px] text-[var(--an-muted)]"><span className="flex-1">Notes stay here {TRASH_DAYS} days, then they're deleted for good.</span>
        {shown.length > 0 && <Btn kind="danger" onClick={async () => { if (!window.confirm(`Delete ${shown.length} note${shown.length === 1 ? "" : "s"} for good? This can't be undone.`)) return; try { await sync.forever(shown.map((m) => m.id)); say("Deleted for good."); } catch (e: any) { say(e.message); } }}>Empty</Btn>}</div>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-28">
      {state === "loading" && !metas.length ? <Spinner /> : shown.length === 0 ? <Empty filter={filter} q={q} onNew={() => create(PAGE_TEMPLATES[0])} />
        : <ul className={grid ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "space-y-1.5"} data-testid="pages-list">
          {shown.map((m) => <PageCard key={m.id} m={m} grid={grid} on={openId === m.id} folder={folders.find((f) => f.id === m.folderId)} trash={filter.kind === "trash"}
            onOpen={() => open(m.id)} onRestore={() => { sync.restore(m.id); say("Restored."); }} onForever={async () => { if (!window.confirm("Delete this note for good?")) return; await sync.forever([m.id]).catch((e) => say(e.message)); }} />)}
        </ul>}
    </div>
  </div>;

  const editor = openId ? <PageScreen key={openId} ctx={ctx} id={openId} onBack={() => ctx.go({ name: "pages" })} /> : null;

  return <div className="flex h-[100dvh] min-h-0 flex-col" data-testid="pages-view">
    {(!openId || wide) && tabs}
    <div className="flex min-h-0 flex-1">
      {wide ? <>
        <aside className="hidden w-[240px] shrink-0 overflow-y-auto border-r border-[var(--an-line)] px-2 py-4 lg:block">{nav}</aside>
        <section className="w-[360px] shrink-0 border-r border-[var(--an-line)]">{list}</section>
        <main className="min-w-0 flex-1">{editor ?? <div className="grid h-full place-items-center text-center text-[15px] text-[var(--an-muted)]"><div><div className="text-[44px]">🗒️</div>Choose a note, or make a new one.</div></div>}</main>
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

function NavRow({ on, icon, dot, label, count, onClick, onEdit }: { on: boolean; icon: string; dot?: string; label: string; count: number; onClick: () => void; onEdit?: () => void }) {
  return <div className={`group flex items-center rounded-xl ${on ? "bg-[var(--an-violet-soft)]" : "hover:bg-black/[.03]"}`}>
    <button type="button" onClick={onClick} aria-pressed={on} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-[15px] font-semibold">
      <span aria-hidden className="text-[16px]">{icon}</span>{dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />}
      <span className="min-w-0 flex-1 truncate">{label}</span><span className="text-[13px] font-normal text-[var(--an-faint)]">{count}</span>
    </button>
    {onEdit && <button type="button" className="mr-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--an-muted)] opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={onEdit} aria-label={`Edit ${label}`}>Edit</button>}
  </div>;
}

function FilterMenu({ name, children }: { name: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="flex min-w-0 items-center gap-1 text-[22px] font-extrabold tracking-[-.02em]" onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="pages-filter">
      <span className="truncate">{name}</span><ChevronDown className="h-5 w-5 shrink-0 text-[var(--an-muted)]" /></button>
    {open && <Sheet title="Folders" onClose={() => setOpen(false)}><div onClick={(e) => { if ((e.target as HTMLElement).closest("button[aria-pressed]")) setOpen(false); }}>{children}</div></Sheet>}
  </>;
}

function PageCard({ m, grid, on, folder, trash, onOpen, onRestore, onForever }: { m: PageMeta; grid: boolean; on: boolean; folder?: Folder; trash: boolean; onOpen: () => void; onRestore: () => void; onForever: () => void }) {
  const look = cleanLook(m.content?.look ?? DEFAULT_LOOK);
  const paper = PAPER_THEMES[look.theme];
  const title = pageTitle(m as any);
  const meta = <span className="flex items-center gap-1.5 text-[12px] text-[var(--an-muted)]">{m.pinned && <Pin className="h-3 w-3 text-[var(--an-violet)]" aria-label="Pinned" />}{m.locked && <Lock className="h-3 w-3" aria-label="Locked" />}{m.kind === "ink" && <PenLine className="h-3 w-3" aria-label="Handwritten" />}{shortDate(m.updatedAt)}{folder && <span className="truncate">· {folder.icon} {folder.name}</span>}</span>;
  const preview = m.locked ? "Locked" : m.preview || (m.kind === "ink" ? "Handwritten note" : "No text yet");
  if (trash) return <li className="an-card flex items-center gap-3 p-3">
    <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold">{title}</span>{meta}</span>
    <IconBtn label="Restore" onClick={onRestore}><RotateCcw className="h-5 w-5" /></IconBtn><IconBtn label="Delete for good" onClick={onForever}><Trash2 className="h-5 w-5 text-[#c2283a]" /></IconBtn>
  </li>;
  if (grid) return <li><button type="button" onClick={onOpen} data-testid="pages-card" className={`flex h-44 w-full flex-col overflow-hidden rounded-2xl border text-left shadow-[0_8px_24px_-20px_rgba(30,20,90,.6)] transition hover:-translate-y-0.5 ${on ? "ring-2 ring-[var(--an-violet)]" : ""}`} style={{ borderColor: m.color || "var(--an-line)" }}>
    <span className="relative block flex-1 overflow-hidden px-3 pt-3 text-[12px] leading-snug" style={{ background: paper.bg, color: paper.ink }}>
      {m.color && <span className="absolute left-0 top-0 h-1 w-full" style={{ background: m.color }} />}
      <span className="line-clamp-6 opacity-80">{m.locked ? <span className="flex h-full items-center justify-center pt-8"><Lock className="h-7 w-7 opacity-50" /></span> : preview}</span>
    </span>
    <span className="block border-t border-[var(--an-line)] bg-white px-3 py-2"><span className="block truncate text-[14px] font-bold">{title}</span>{meta}</span>
  </button></li>;
  return <li><button type="button" onClick={onOpen} data-testid="pages-card" className={`flex w-full gap-3 rounded-2xl px-3 py-3 text-left transition ${on ? "bg-[var(--an-violet-soft)]" : "hover:bg-black/[.03]"}`}>
    <span className="mt-1 h-9 w-1.5 shrink-0 rounded-full" style={{ background: m.color || "transparent" }} />
    <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold">{title}</span><span className="block truncate text-[14px] text-[var(--an-muted)]">{preview}</span>{meta}</span>
  </button></li>;
}

function Empty({ filter, q, onNew }: { filter: Filter; q: string; onNew: () => void }) {
  if (q) return <p className="px-3 py-10 text-center text-[15px] text-[var(--an-muted)]">Nothing matched “{q}”.</p>;
  if (filter.kind === "trash") return <p className="px-3 py-10 text-center text-[15px] text-[var(--an-muted)]">Nothing in Recently Deleted.</p>;
  if (filter.kind === "locked") return <p className="px-3 py-10 text-center text-[15px] text-[var(--an-muted)]">No locked notes. Open a note, tap ⋯, then Lock note.</p>;
  return <div className="px-6 py-12 text-center">
    <div aria-hidden className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-[var(--an-violet-soft)] text-[30px]">🗒️</div>
    <h3 className="text-[18px] font-bold">{filter.kind === "all" ? "Your notes live here" : "Nothing here yet"}</h3>
    <p className="mx-auto mt-1.5 max-w-xs text-[15px] leading-relaxed text-[var(--an-muted)]">Type, handwrite with your Apple Pencil, add pictures, checklists and tables. Everything syncs to your other devices.</p>
    <Btn kind="primary" className="mt-5" onClick={onNew}><Plus className="h-4 w-4" />New note</Btn>
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
