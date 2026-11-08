// The Notes tab: every typed and handwritten note, in folders, searchable, synced across devices.
// It has a plain, professional look whatever the app's look is (pages-pro.css). On a phone it opens on
// your folders; a folder shows its notes, and a note opens on its own. On an iPad or computer the
// folders, the list and the note sit side by side. New notes start from a blank page or a template (meeting, journal, Cornell, graph
// paper…), in the look you chose for new notes.
import { useEffect, useMemo, useRef, useState } from "react";
import { SwipeItem } from "./SwipeItem";
import { ChevronLeft, ChevronRight, FileText, Folder as FolderIcon, FolderPlus, Grid2X2, Hash, LayoutTemplate, List as ListIcon, Lock, LockOpen, MoreHorizontal, PenLine, Pin, Plus, RotateCcw, Search, Settings2, ShieldCheck, SquarePen, Trash2 } from "lucide-react";
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
import "./pages-pro.css";
import { useAppearance } from "../appearance";

type Filter = { kind: "all" } | { kind: "pinned" } | { kind: "folder"; id: string } | { kind: "tag"; tag: string } | { kind: "locked" } | { kind: "ink" } | { kind: "trash" };
const FKEY = "arise-pages-filter", PKEY = "arise-pages-pane";

export default function PagesView({ ctx, openId, tabs }: { ctx: AppCtx; openId: string | null; tabs: React.ReactNode }) {
  const userId = ctx.me.user.id;
  const say = useToast();
  const { sync, metas, settings, state, message } = usePages(userId);
  const key = useUnlocked(settings.vault);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Set<string> | null>(null);
  const [filter, setFilterState] = useState<Filter>(() => { try { return JSON.parse(localStorage.getItem(FKEY) || "") as Filter; } catch { return { kind: "all" }; } });
  const setFilter = (f: Filter) => { setFilterState(f); try { localStorage.setItem(FKEY, JSON.stringify(f)); } catch { /* not kept */ } };
  // On a phone: your folders, or one folder's notes.
  const [pane, setPaneState] = useState<"folders" | "list">(() => { try { return localStorage.getItem(PKEY) === "list" ? "list" : "folders"; } catch { return "folders"; } });
  const setPane = (p: "folders" | "list") => { setPaneState(p); try { localStorage.setItem(PKEY, p); } catch { /* not kept */ } };
  const pick = (f: Filter) => { setFilter(f); setPane("list"); };
  // The dock's "New note" (NotesDock.tsx) opens the list with the new-note sheet up.
  const [sheet, setSheet] = useState<"" | "new" | "folder" | "settings" | "vault">(() => { try { if (sessionStorage.getItem("arise-notes-new") === "1") { sessionStorage.removeItem("arise-notes-new"); return "new"; } } catch { /* opens closed */ } return ""; });
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1000);
  useEffect(() => { const f = () => setWide(window.innerWidth >= 1000); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  useEffect(() => { if (message) say(message); }, [message, say]);
  // The dock's + > New note while Notes is already open: show the new-note sheet (it is only read on first open otherwise).
  useEffect(() => {
    const f = () => { try { if (sessionStorage.getItem("arise-notes-new") === "1") sessionStorage.removeItem("arise-notes-new"); } catch { /* fine */ } setSheet("new"); };
    window.addEventListener("arise-notes-new", f);
    return () => window.removeEventListener("arise-notes-new", f);
  }, []);
  // The folder column on a tablet always starts at its top (no half-hidden first row).
  const [full, setFull] = useState(false);
  const sideRef = useRef<HTMLElement>(null);
  useEffect(() => { if (sideRef.current) sideRef.current.scrollTop = 0; }, [wide, filter.kind]);

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
  // Swipe actions: delete (to Recently Deleted, with Undo) and pin.
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => { if (!undo) return; const t = window.setTimeout(() => setUndo(null), 5000); return () => window.clearTimeout(t); }, [undo]);
  const trashNote = (m: PageMeta) => { sync.remove(m.id); setUndo({ id: m.id, title: pageTitle(m as any) }); };
  const pinNote = async (m: PageMeta) => {
    const p = sync.cached(m.id) ?? await sync.open(m.id).catch(() => null);
    if (!p) { say("Open the note once to pin it."); return; }
    sync.save({ ...p, pinned: !p.pinned }); say(p.pinned ? "Unpinned." : "Pinned to the top.");
  };
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

  const count = (f: (m: PageMeta) => boolean) => live.filter(f).length;
  const on = (f: Filter) => JSON.stringify(f) === JSON.stringify(filter) && (wide || pane === "list");
  const nav = <nav className="pp-nav" aria-label="Folders" data-testid="pages-folders">
    <ul className="pp-group">
      <FolderRow on={on({ kind: "all" })} icon={<FileText />} label="All notes" count={live.length} onClick={() => pick({ kind: "all" })} testId="pages-folder-all" />
      <FolderRow on={on({ kind: "pinned" })} icon={<Pin />} label="Pinned" count={count((m) => m.pinned)} onClick={() => pick({ kind: "pinned" })} />
      <FolderRow on={on({ kind: "ink" })} icon={<PenLine />} label="Handwritten" count={count((m) => m.kind === "ink")} onClick={() => pick({ kind: "ink" })} />
      <FolderRow on={on({ kind: "locked" })} icon={<Lock />} label="Locked" count={count((m) => m.locked)} onClick={() => pick({ kind: "locked" })} />
    </ul>
    <div className="pp-grouphead"><h3>My folders</h3><button type="button" onClick={() => { setEditFolder(null); setSheet("folder"); }} data-testid="pages-new-folder"><FolderPlus className="h-4 w-4" />New folder</button></div>
    {folders.length ? <ul className="pp-group">{folders.map((f) => <FolderRow key={f.id} on={on({ kind: "folder", id: f.id })} icon={<FolderIcon />} tint={f.color || undefined} label={f.name} count={count((m) => m.folderId === f.id)}
      onClick={() => pick({ kind: "folder", id: f.id })} onEdit={() => { setEditFolder(f); setSheet("folder"); }} testId="pages-folder" />)}</ul>
      : <button type="button" className="pp-group pp-empty-folder" onClick={() => { setEditFolder(null); setSheet("folder"); }}><FolderPlus className="h-5 w-5" /><span><b>Make your first folder</b><small>Work, school, home: keep notes where you'll find them.</small></span></button>}
    {tags.length > 0 && <><div className="pp-grouphead"><h3>Tags</h3></div>
      <div className="flex flex-wrap gap-1.5 px-1">{tags.map((t) => <button key={t} type="button" className="pp-tag" aria-pressed={filter.kind === "tag" && filter.tag === t} onClick={() => pick({ kind: "tag", tag: t })}><Hash className="h-3 w-3" />{t}</button>)}</div></>}
    <ul className="pp-group mt-5"><FolderRow on={on({ kind: "trash" })} icon={<Trash2 />} label="Recently Deleted" count={metas.filter((m) => m.deletedAt).length} onClick={() => pick({ kind: "trash" })} /></ul>
    <p className="pp-trust"><ShieldCheck className="h-4 w-4 shrink-0" />{SYNC_WORDS[state]} across your devices. Locked notes are encrypted on this device with your notes password.</p>
  </nav>;

  const filterName = filter.kind === "all" ? "All notes" : filter.kind === "pinned" ? "Pinned" : filter.kind === "ink" ? "Handwritten" : filter.kind === "locked" ? "Locked" : filter.kind === "trash" ? "Recently Deleted" : filter.kind === "tag" ? `#${filter.tag}` : folders.find((f) => f.id === filter.id)?.name ?? "Folder";
  const grid = settings.prefs.view === "grid" && !wide;

  const by = settings.prefs.sort === "created" ? "createdAt" : "updatedAt";
  const sections = useMemo(() => (filter.kind === "trash" || q.trim() || settings.prefs.sort === "title" ? [{ label: "", items: shown }] : groupNotes(shown, by)), [shown, filter.kind, q, settings.prefs.sort, by]);
  const card = (m: PageMeta, i: number) => <PageCard key={m.id} m={m} i={i} grid={grid} on={openId === m.id} folder={folders.find((f) => f.id === m.folderId)} trash={filter.kind === "trash"}
    onOpen={() => open(m.id)} onTrash={() => trashNote(m)} onPin={() => void pinNote(m)} onRestore={() => { sync.restore(m.id); say("Restored."); }} onForever={async () => { if (!window.confirm("Delete this note for good?")) return; await sync.forever([m.id]).catch((e) => say(e.message)); }} />;

  const list = <div className="relative flex h-full min-h-0 flex-col">
    <div className="space-y-3.5 px-4 pb-2 pt-[max(1rem,var(--sat,env(safe-area-inset-top,0px)))]">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          {!wide && <button type="button" className="pp-back" onClick={() => setPane("folders")} data-testid="pages-back-folders"><ChevronLeft className="h-5 w-5" />Folders</button>}
          <h2 className="pp-title truncate" data-testid="pages-filter">{filterName}</h2>
          <p className="mt-1 text-[13px] text-[var(--an-muted)]" aria-live="polite">{shown.length} {shown.length === 1 ? "note" : "notes"}<span className="text-[var(--an-faint)]"> · {SYNC_WORDS[state]}</span></p>
        </div>
        {wide && filter.kind !== "trash" && <button type="button" className="an-round-btn" aria-label="New note" onClick={() => create(PAGE_TEMPLATES[0])} data-testid="pages-new"><SquarePen className="h-[18px] w-[18px]" /></button>}
        {settings.vault && key && <button type="button" className="an-round-btn" aria-label="Lock locked notes now" onClick={() => { lockNow(); say("Locked notes are locked."); }}><LockOpen className="h-[18px] w-[18px]" /></button>}
        {!wide && <button type="button" className="an-round-btn" aria-label={grid ? "Show as a list" : "Show as cards"} onClick={() => sync.saveSettings({ ...settings, prefs: { ...settings.prefs, view: grid ? "list" : "grid" } })}>{grid ? <ListIcon className="h-[18px] w-[18px]" /> : <Grid2X2 className="h-[18px] w-[18px]" />}</button>}
        <button type="button" className="an-round-btn" aria-label="Notes settings" onClick={() => setSheet("settings")}><Settings2 className="h-[18px] w-[18px]" /></button>
      </div>
      <label className="an-search block"><span className="sr-only">Search notes</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-[var(--an-faint)]" aria-hidden />
        <input className="an-input an-bare an-search-input" style={{ height: "3rem", borderRadius: 999, paddingLeft: "2.9rem" }} placeholder="Search notes and handwriting" value={q} onChange={(e) => setQ(e.target.value)} data-testid="pages-search" />
      </label>
      {filter.kind !== "trash" && <div className="an-scroll -mx-4 flex gap-2 overflow-x-auto px-4">
        <button type="button" className="pp-quick" onClick={() => create(PAGE_TEMPLATES[0])} data-testid="pages-new-quick"><SquarePen className="h-4 w-4" />New note</button>
        <button type="button" className="pp-quick" onClick={() => create(PAGE_TEMPLATES.find((t) => t.id === "ink-lined")!)} data-testid="pages-new-ink"><PenLine className="h-4 w-4" />Handwrite</button>
        <button type="button" className="pp-quick" onClick={() => setSheet("new")} data-testid="pages-templates"><LayoutTemplate className="h-4 w-4" />Templates</button>
      </div>}
      {filter.kind === "trash" && <div className="flex items-center gap-2 text-[13px] text-[var(--an-muted)]"><span className="flex-1">Notes stay here {TRASH_DAYS} days, then they're deleted for good.</span>
        {shown.length > 0 && <Btn kind="danger" onClick={async () => { if (!window.confirm(`Delete ${shown.length} note${shown.length === 1 ? "" : "s"} for good? This can't be undone.`)) return; try { await sync.forever(shown.map((m) => m.id)); say("Deleted for good."); } catch (e: any) { say(e.message); } }}>Empty</Btn>}</div>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-44" style={{ WebkitOverflowScrolling: "touch" }}>
      {state === "loading" && !metas.length ? <Spinner /> : shown.length === 0 ? <Empty filter={filter} q={q} onNew={() => create(PAGE_TEMPLATES[0])} />
        : <div data-testid="pages-list">{sections.map((sec) => <section key={sec.label || "all"}>
          {sec.label && <h3 className="pp-section">{sec.label}</h3>}
          <ul className={grid ? "an-masonry" : "pp-rows"} style={sec.label ? undefined : { marginTop: ".5rem" }}>{sec.items.map((m, i) => card(m, i))}</ul>
        </section>)}</div>}
    </div>
    {undo && <div className="pp-undo" role="status" data-testid="pages-undo"><span className="min-w-0 flex-1 truncate">Deleted “{undo.title}”</span><button type="button" onClick={() => { sync.restore(undo.id); setUndo(null); say("Restored."); }}>Undo</button></div>}
    {filter.kind !== "trash" && !wide && <button type="button" className="pp-compose" onClick={() => create(PAGE_TEMPLATES[0])} data-testid="pages-new" aria-label="New note"><SquarePen className="h-6 w-6" /></button>}
  </div>;

  /** The phone's first screen: your folders, with search across every note. */
  const folderScreen = <div className="relative flex h-full min-h-0 flex-col" data-testid="pages-folder-screen">
    <div className="space-y-3 px-4 pb-2 pt-[max(1rem,var(--sat,env(safe-area-inset-top,0px)))]">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1"><h2 className="pp-title">Notes</h2><p className="pp-sub">{live.length} {live.length === 1 ? "note" : "notes"} · {folders.length} {folders.length === 1 ? "folder" : "folders"}</p></div>
        <button type="button" className="an-round-btn" aria-label="Notes settings" onClick={() => setSheet("settings")}><Settings2 className="h-[18px] w-[18px]" /></button>
      </div>
      <label className="an-search block"><span className="sr-only">Search all notes</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-[var(--an-faint)]" aria-hidden />
        <input className="an-input an-bare an-search-input" style={{ height: "2.75rem", borderRadius: 12, paddingLeft: "2.7rem" }} placeholder="Search all notes and handwriting" value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim()) { setFilter({ kind: "all" }); setPane("list"); } }} data-testid="pages-search-all" />
      </label>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-44">{state === "loading" && !metas.length ? <Spinner /> : nav}</div>
    <button type="button" className="pp-compose" onClick={() => create(PAGE_TEMPLATES[0])} data-testid="pages-new" aria-label="New note"><SquarePen className="h-6 w-6" /></button>
  </div>;

  const editor = openId ? <PageScreen key={openId} ctx={ctx} id={openId} onBack={() => { setFull(false); ctx.go({ name: "pages" }); }} expanded={wide && full} onExpand={wide ? () => setFull((v) => !v) : undefined} /> : null;

  return <div className="flex h-[100dvh] min-h-0 flex-col" data-testid="pages-view">
    {(!openId || wide) && !(wide && full && openId) && tabs}
    <div className="flex min-h-0 flex-1">
      {wide ? <>
        {!(full && openId) && <aside ref={sideRef} style={{ overscrollBehavior: "contain" }} className="hidden w-[260px] shrink-0 overflow-y-auto border-r border-[var(--an-line)] px-3 py-4 lg:block">{nav}</aside>}
        {!(full && openId) && <section className="w-[360px] shrink-0 border-r border-[var(--an-line)]">{list}</section>}
        <main className="min-w-0 flex-1">{editor ?? <div className="grid h-full place-items-center text-center text-[15px] text-[var(--an-muted)]"><div><div className="an-empty-stack"><i /><i /><i><PenLine className="h-7 w-7" strokeWidth={1.8} /></i></div><p className="an-display text-[24px] text-[var(--an-ink)]">Choose a note</p><p className="mt-1">or start a new one.</p><Btn kind="primary" className="mt-5 !min-h-12 !px-6" onClick={() => create(PAGE_TEMPLATES[0])} data-testid="pages-new-empty"><Plus className="h-4 w-4" />New note</Btn></div></div>}</main>
      </> : <main className="min-w-0 flex-1">{editor ?? (pane === "folders" ? folderScreen : list)}</main>}
    </div>
    {sheet === "new" && <Sheet title="New note" onClose={() => setSheet("")} wide>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="pages-template-list">{PAGE_TEMPLATES.map((t) => <button key={t.id} type="button" onClick={() => create(t)} className="an-card flex items-center gap-3 p-3 text-left hover:border-[var(--an-violet)]">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--an-violet-soft)] text-[var(--an-violet)]">{t.kind === "ink" ? <PenLine className="h-5 w-5" strokeWidth={1.8} /> : t.id.includes("grid") ? <Grid2X2 className="h-5 w-5" strokeWidth={1.8} /> : t.id.includes("cornell") ? <LayoutTemplate className="h-5 w-5" strokeWidth={1.8} /> : <FileText className="h-5 w-5" strokeWidth={1.8} />}</span><span><span className="block text-[15px] font-bold">{t.name}</span><span className="text-[12px] text-[var(--an-muted)]">{t.kind === "ink" ? "Handwriting" : "Typed"}</span></span></button>)}</div>
    </Sheet>}
    {sheet === "folder" && <FolderSheet folder={editFolder} onClose={() => setSheet("")}
      onSave={(v) => { if (editFolder) saveFolders(settings.folders.map((f) => (f.id === editFolder.id ? { ...f, ...v } : f))); else { const f = { id: newPageId(), ...v, sort: settings.folders.length }; saveFolders([...settings.folders, f]); pick({ kind: "folder", id: f.id }); } setSheet(""); }}
      onDelete={editFolder ? () => {
        // Its notes move to All notes.
        for (const m of live.filter((x) => x.folderId === editFolder.id)) { const p = sync.cached(m.id); if (p) sync.save({ ...p, folderId: "" }); }
        saveFolders(settings.folders.filter((f) => f.id !== editFolder.id)); setFilter({ kind: "all" }); setSheet("");
      } : undefined} />}
    {sheet === "settings" && <NotesSettingsSheet ctx={ctx} onClose={() => setSheet("")} onVault={() => setSheet("vault")} />}
    {sheet === "vault" && <VaultSheet sync={sync} settings={settings} userId={userId} onClose={() => setSheet("")} onDone={() => { setSheet(""); say("Your notes password is set. Lock any note from its menu."); }} />}
  </div>;
}

/** One folder in the folder list: an icon, its name, how many notes, and (for your folders) Edit. */
function FolderRow({ on, icon, tint, label, count, onClick, onEdit, testId }: { on: boolean; icon: React.ReactNode; tint?: string; label: string; count: number; onClick: () => void; onEdit?: () => void; testId?: string }) {
  return <li className="pp-folder" data-on={on || undefined}>
    <button type="button" onClick={onClick} aria-pressed={on} className="pp-folder-main" data-testid={testId}>
      <span aria-hidden className="pp-folder-icon" style={tint ? { color: tint } : undefined}>{icon}</span>
      <span className="pp-folder-name">{label}</span><span className="pp-count">{count}</span><ChevronRight aria-hidden className="pp-chev" />
    </button>
    {onEdit && <button type="button" className="pp-folder-edit" onClick={onEdit} aria-label={`Rename or delete ${label}`} data-testid="pages-folder-edit"><MoreHorizontal className="h-[18px] w-[18px]" /></button>}
  </li>;
}

function PageCard({ m, i, grid, on, folder, trash, onOpen, onTrash, onPin, onRestore, onForever }: { m: PageMeta; i: number; grid: boolean; on: boolean; folder?: Folder; trash: boolean; onOpen: () => void; onTrash: () => void; onPin: () => void; onRestore: () => void; onForever: () => void }) {
  const look = cleanLook(m.content?.look ?? DEFAULT_LOOK);
  const dark = useAppearance().dark;
  const paper = PAPER_THEMES[dark && look.theme === "paper" ? "charcoal" : look.theme];
  const title = pageTitle(m as any);
  const meta = <span className="flex items-center gap-1.5 text-[12px] text-[var(--an-muted)]">{m.pinned && <Pin className="h-3 w-3" aria-label="Pinned" />}{m.locked && <Lock className="h-3 w-3" aria-label="Locked" />}{shortDate(m.updatedAt)}{folder && <span className="truncate">· {folder.name}</span>}</span>;
  const preview = m.locked ? "Locked" : m.preview || (m.kind === "ink" ? "Handwritten note" : "No text yet");
  if (trash) return <li className="flex items-center gap-3 p-3">
    <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold">{title}</span>{meta}</span>
    <IconBtn label="Restore" onClick={onRestore}><RotateCcw className="h-5 w-5" /></IconBtn><IconBtn label="Delete for good" onClick={onForever}><Trash2 className="h-5 w-5 text-[#c2283a]" /></IconBtn>
  </li>;
  const kindIcon = m.locked ? <Lock /> : m.kind === "ink" ? <PenLine /> : <FileText />;
  if (grid) return <li><SwipeItem pinned={m.pinned} onDelete={onTrash} onPin={onPin} radius={18}><button type="button" onClick={onOpen} data-testid="pages-card" className="pp-card" data-on={on}>
    <span className="pp-card-paper" style={{ background: paper.bg, color: paper.ink }}>
      {m.locked ? <span className="flex h-full items-center justify-center"><Lock className="h-6 w-6 opacity-40" /></span>
        : m.kind === "ink" ? <span className="flex items-start gap-1.5 opacity-75"><PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="line-clamp-5">{preview}</span></span>
        : <span className="line-clamp-6 opacity-85">{preview}</span>}
    </span>
    <span className="pp-card-foot"><span className="pp-card-title">{title}</span>{meta}</span>
  </button></SwipeItem></li>;
  return <li><SwipeItem pinned={m.pinned} onDelete={onTrash} onPin={onPin}><button type="button" onClick={onOpen} data-testid="pages-card" className="pp-row" data-on={on}>
    <span className="pp-row-icon" data-kind={m.locked ? "lock" : m.kind} aria-hidden>{kindIcon}</span>
    <span className="min-w-0 flex-1">
      <span className="pp-row-title">{title}</span>
      <span className="pp-row-line"><span className="pp-row-date">{shortDate(m.updatedAt)}</span><span className="pp-row-preview">{preview}</span></span>
      {folder && <span className="pp-row-folder"><FolderIcon className="h-3 w-3" style={folder.color ? { color: folder.color } : undefined} />{folder.name}</span>}
    </span>
    <span className="pp-row-marks" aria-hidden>{m.pinned && <Pin className="h-3.5 w-3.5" />}</span>
  </button></SwipeItem></li>;
}

function Empty({ filter, q, onNew }: { filter: Filter; q: string; onNew: () => void }) {
  if (q) return <p className="px-3 py-16 text-center text-[15px] text-[var(--an-muted)]">Nothing matched “{q}”.</p>;
  if (filter.kind === "trash") return <p className="px-3 py-16 text-center text-[15px] text-[var(--an-muted)]">Nothing in Recently Deleted.</p>;
  if (filter.kind === "locked") return <p className="px-3 py-16 text-center text-[15px] text-[var(--an-muted)]">No locked notes. Open a note, tap ⋯, then Lock note.</p>;
  return <div className="px-6 py-14 text-center an-lift">
    <div aria-hidden className="an-empty-stack"><i /><i /><i><PenLine className="h-7 w-7" strokeWidth={1.8} /></i></div>
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
