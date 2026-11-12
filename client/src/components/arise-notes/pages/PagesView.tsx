// The Notes tab: every typed and handwritten note, in folders, searchable, synced across devices.
// It has a plain, professional look whatever the app's look is (pages-pro.css). On a phone it opens on
// your folders; a folder shows its notes, and a note opens on its own. On an iPad or computer the
// folders, the list and the note sit side by side. New notes start from a blank page or a template (meeting, journal, Cornell, graph
// paper…), in the look you chose for new notes.
import { useEffect, useMemo, useRef, useState } from "react";
import { SwipeItem } from "./SwipeItem";
import type { ListNote } from "../api";
import { AudioLines, CheckCircle2, Circle, FolderInput, PinOff, X, Upload, ChevronLeft, ChevronRight, FileText, LayoutGrid, Mic, Folder as FolderIcon, FolderPlus, Grid2X2, Hash, LayoutTemplate, List as ListIcon, Lock, LockOpen, MoreHorizontal, PenLine, Pin, Plus, RotateCcw, Search, Settings as SettingsIcon, Settings2, MessageCircle, SquarePen, Trash2 } from "lucide-react";
import { DEFAULT_LOOK, PAGE_TEMPLATES, PAPER_THEMES, TRASH_DAYS, blankInkPage, cleanLook, pageTitle, type Folder, type Page, type PageMeta, type PageTemplate } from "@shared/arisePages";
import { api } from "../api";
import { Btn, Notice, Sheet, Spinner, Toggle, shortDate, useToast } from "../ui";
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

export default function PagesView({ ctx, openId, tabs, recorded = [] }: { ctx: AppCtx; openId: string | null; tabs: React.ReactNode; /** Meetings recorded or uploaded for AI notes (they used to be on the Recordings page). */ recorded?: ListNote[] }) {
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
  /** Notes waiting to go into the folder being made from "Move to › New folder…". */
  const [moveAfterFolder, setMoveAfterFolder] = useState<string[] | null>(null);
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
  // An open note fills the whole screen by default (no folders and list beside it); the
  // expand / shrink button switches, and the choice is remembered.
  const [full, setFullState] = useState(() => { try { return localStorage.getItem("arise-pages-full") !== "0"; } catch { return true; } });
  const setFull = (f: boolean | ((v: boolean) => boolean)) => setFullState((v) => { const n = typeof f === "function" ? f(v) : f; try { localStorage.setItem("arise-pages-full", n ? "1" : "0"); } catch { /* not kept */ } return n; });
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
  // Select mode (like Apple Notes' Edit): pick many notes, then delete, pin or move them together.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [moveIds, setMoveIds] = useState<string[] | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const lastPick = useRef<string | null>(null);
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); lastPick.current = null; };
  useEffect(() => { stopSelecting(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(null); if (selecting) stopSelecting(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [selecting]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Click picks one; Shift picks the run from the last one; ⌘/Ctrl adds or removes one. */
  const toggle = (id: string, e?: { shiftKey?: boolean }) => setPicked((cur) => {
    const n = new Set(cur);
    if (e?.shiftKey && lastPick.current) {
      const ids = shown.map((m) => m.id); const a = ids.indexOf(lastPick.current), b = ids.indexOf(id);
      if (a >= 0 && b >= 0) { for (const x of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) n.add(x); return n; }
    }
    if (n.has(id)) n.delete(id); else n.add(id);
    lastPick.current = id;
    return n;
  });
  const startWith = (id: string) => { setSelecting(true); setPicked(new Set([id])); lastPick.current = id; };
  const pages = async (ids: string[]) => (await Promise.all(ids.map(async (id) => sync.cached(id) ?? await sync.open(id).catch(() => null)))).filter((p): p is Page => !!p);
  const trashMany = (ids: string[]) => {
    if (!ids.length) return;
    for (const id of ids) sync.remove(id);
    if (ids.length === 1) { const m = metas.find((x) => x.id === ids[0]); setUndo({ id: ids[0], title: m ? pageTitle(m as any) : "Note" }); }
    else say(`${ids.length} notes moved to Recently Deleted.`);
    stopSelecting();
  };
  const pinMany = async (ids: string[], pin: boolean) => {
    const list = await pages(ids);
    for (const p of list) if (p.pinned !== pin) sync.save({ ...p, pinned: pin });
    say(pin ? (list.length === 1 ? "Pinned to the top." : `${list.length} notes pinned.`) : (list.length === 1 ? "Unpinned." : `${list.length} notes unpinned.`));
    stopSelecting();
  };
  const moveMany = async (ids: string[], folderId: string) => {
    const list = await pages(ids);
    for (const p of list) if (p.folderId !== folderId) sync.save({ ...p, folderId });
    const name = folderId ? settings.folders.find((f) => f.id === folderId)?.name ?? "the folder" : "All notes";
    say(list.length === 1 ? `Moved to ${name}.` : `${list.length} notes moved to ${name}.`);
    setMoveIds(null); stopSelecting();
  };
  const restoreMany = (ids: string[]) => { for (const id of ids) sync.restore(id); say(ids.length === 1 ? "Restored." : `${ids.length} notes restored.`); stopSelecting(); };
  const foreverMany = async (ids: string[]) => {
    if (!ids.length || !window.confirm(`Delete ${ids.length === 1 ? "this note" : `${ids.length} notes`} for good? This can't be undone.`)) return;
    try { await sync.forever(ids); say("Deleted for good."); } catch (e: any) { say(e.message); }
    stopSelecting();
  };
  const pickedIds = shown.filter((m) => picked.has(m.id)).map((m) => m.id);
  const allPinned = pickedIds.length > 0 && pickedIds.every((id) => metas.find((m) => m.id === id)?.pinned);

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
  // Record a meeting straight into a new note (PageScreen records; typing @ariserecord does too).
  const recordMeeting = () => { try { sessionStorage.setItem("arise-pages-record", "1"); } catch { /* opens without recording */ } void create(PAGE_TEMPLATES[0]); };
  const nav = <nav className="pp-nav" aria-label="Folders" data-testid="pages-folders">
    <button type="button" onClick={recordMeeting} data-testid="pages-record" className="pp-record" title="Records into a new note. Or type @ariserecord in any note.">
      <span className="pp-record-dot" aria-hidden /><span className="flex-1">Record a meeting</span><Mic className="h-4 w-4 opacity-60" aria-hidden />
    </button>
    <ul className="pp-group">
      <FolderRow on={false} icon={<Upload />} label="Upload a recording" onClick={() => ctx.go({ name: "upload" })} testId="pages-upload" />
      <FolderRow on={false} icon={<LayoutGrid />} label="Apps" onClick={() => ctx.go({ name: "apps" })} testId="pages-apps" />
      {/* On a computer there's no bottom bar, so Ask and Settings sit here, like Apple Notes' sidebar. */}
      {wide && <FolderRow on={false} icon={<MessageCircle />} label="Ask" onClick={() => ctx.go({ name: "undercover" })} testId="pages-side-ask" />}
      {wide && <FolderRow on={false} icon={<SettingsIcon />} label="Settings" onClick={() => ctx.go({ name: "settings" })} testId="pages-side-settings" />}
    </ul>
    <ul className="pp-group">
      <FolderRow on={on({ kind: "all" })} icon={<FileText />} label="All notes" count={live.length} onClick={() => pick({ kind: "all" })} testId="pages-folder-all" />
      {/* Pinned, Handwritten and Locked only show when they have notes (or are open), to keep the list short. */}
      {(count((m) => m.pinned) > 0 || filter.kind === "pinned") && <FolderRow on={on({ kind: "pinned" })} icon={<Pin />} label="Pinned" count={count((m) => m.pinned)} onClick={() => pick({ kind: "pinned" })} />}
      {(count((m) => m.kind === "ink") > 0 || filter.kind === "ink") && <FolderRow on={on({ kind: "ink" })} icon={<PenLine />} label="Handwritten" count={count((m) => m.kind === "ink")} onClick={() => pick({ kind: "ink" })} />}
      {(count((m) => m.locked) > 0 || filter.kind === "locked") && <FolderRow on={on({ kind: "locked" })} icon={<Lock />} label="Locked" count={count((m) => m.locked)} onClick={() => pick({ kind: "locked" })} />}
    </ul>
    <div className="pp-grouphead"><h3>Folders</h3><button type="button" onClick={() => { setEditFolder(null); setSheet("folder"); }} data-testid="pages-new-folder" aria-label="New folder" title="New folder"><Plus className="h-4 w-4" /></button></div>
    {folders.length ? <ul className="pp-group">{folders.map((f) => <FolderRow key={f.id} on={on({ kind: "folder", id: f.id })} icon={<FolderIcon />} tint={f.color || undefined} label={f.name} count={count((m) => m.folderId === f.id)}
      onClick={() => pick({ kind: "folder", id: f.id })} onEdit={() => { setEditFolder(f); setSheet("folder"); }} testId="pages-folder" />)}</ul>
      : <button type="button" className="pp-empty-folder" onClick={() => { setEditFolder(null); setSheet("folder"); }}><FolderPlus className="h-4 w-4" />New folder</button>}
    {tags.length > 0 && <><div className="pp-grouphead"><h3>Tags</h3></div>
      <div className="flex flex-wrap gap-1.5 px-1">{tags.map((t) => <button key={t} type="button" className="pp-tag" aria-pressed={filter.kind === "tag" && filter.tag === t} onClick={() => pick({ kind: "tag", tag: t })}><Hash className="h-3 w-3" />{t}</button>)}</div></>}
    <ul className="pp-group mt-5"><FolderRow on={on({ kind: "trash" })} icon={<Trash2 />} label="Recently Deleted" count={metas.filter((m) => m.deletedAt).length} onClick={() => pick({ kind: "trash" })} /></ul>
  </nav>;

  const filterName = filter.kind === "all" ? "All notes" : filter.kind === "pinned" ? "Pinned" : filter.kind === "ink" ? "Handwritten" : filter.kind === "locked" ? "Locked" : filter.kind === "trash" ? "Recently Deleted" : filter.kind === "tag" ? `#${filter.tag}` : folders.find((f) => f.id === filter.id)?.name ?? "Folder";
  const grid = settings.prefs.view === "grid" && !wide;

  const by = settings.prefs.sort === "created" ? "createdAt" : "updatedAt";
  const sections = useMemo(() => (filter.kind === "trash" || q.trim() || settings.prefs.sort === "title" ? [{ label: "", items: shown }] : groupNotes(shown, by)), [shown, filter.kind, q, settings.prefs.sort, by]);
  const card = (m: PageMeta, i: number) => <PageCard key={m.id} m={m} i={i} grid={grid} on={openId === m.id} folder={folders.find((f) => f.id === m.folderId)} trash={filter.kind === "trash"}
    selecting={selecting} selected={picked.has(m.id)}
    onSelect={(e) => { if (!selecting) setSelecting(true); toggle(m.id, e); }}
    onMove={() => setMoveIds([m.id])} onMenu={(x, y) => setMenu({ id: m.id, x, y })}
    onOpen={(e) => { if (selecting) { toggle(m.id, e); return; } if (e && (e.metaKey || e.ctrlKey || e.shiftKey)) { startWith(m.id); return; } open(m.id); }} onTrash={() => trashNote(m)} onPin={() => void pinNote(m)} onRestore={() => { sync.restore(m.id); say("Restored."); }} onForever={async () => { if (!window.confirm("Delete this note for good?")) return; await sync.forever([m.id]).catch((e) => say(e.message)); }} />;

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
        {filter.kind !== "trash" && <button type="button" className="an-round-btn" aria-label="Record a meeting into a new note" onClick={recordMeeting} data-testid="pages-record-list"><Mic className="h-[18px] w-[18px]" /></button>}
        {shown.length > 0 && <button type="button" className="pp-select-btn" aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))} data-testid="pages-select">{selecting ? "Done" : "Select"}</button>}
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
        {shown.length > 0 && <button type="button" className="pp-empty-trash" data-testid="pages-empty-trash" onClick={async () => { if (!window.confirm(`Delete ${shown.length} note${shown.length === 1 ? "" : "s"} for good? This can't be undone.`)) return; try { await sync.forever(shown.map((m) => m.id)); say("Deleted for good."); } catch (e: any) { say(e.message); } }}>Empty</button>}</div>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-44" style={{ WebkitOverflowScrolling: "touch" }}>
      {state === "loading" && !metas.length ? <Spinner /> : shown.length === 0 ? <Empty filter={filter} q={q} onNew={() => create(PAGE_TEMPLATES[0])} />
        : <div data-testid="pages-list">{sections.map((sec) => <section key={sec.label || "all"}>
          {sec.label && <h3 className="pp-section">{sec.label}</h3>}
          <ul className={grid ? "an-masonry" : "pp-rows"} style={sec.label ? undefined : { marginTop: ".5rem" }}>{sec.items.map((m, i) => card(m, i))}</ul>
        </section>)}</div>}
      {filter.kind === "all" && !q.trim() && recorded.length > 0 && <section aria-label="Recorded meetings" data-testid="pages-recorded" className="pp-recorded">
        <h3 className="pp-section">Recorded meetings</h3>
        <ul className="pp-rows">{recorded.map((n) => <li key={n.id}><button type="button" className="pp-row" onClick={() => ctx.go({ name: "note", id: n.id })} data-testid="pages-recorded-row">
          <span className="pp-row-icon" aria-hidden><AudioLines /></span>
          <span className="min-w-0 flex-1"><span className="pp-row-title">{n.title || "Untitled recording"}</span>
            <span className="pp-row-line"><span className="pp-row-date">{shortDate(n.createdAt)}</span><span className="pp-row-preview">{n.status === "recording" || n.status === "processing" ? "Writing it down…" : n.status === "no_minutes" ? "Out of minutes" : n.source === "upload" ? "Uploaded recording" : n.source === "memo" ? "Voice memo" : "Recorded meeting"}</span></span></span>
        </button></li>)}</ul>
      </section>}
    </div>
    {selecting && <div className="pp-bulk" role="toolbar" aria-label="Selected notes" data-testid="pages-bulk">
      <button type="button" onClick={() => setPicked(pickedIds.length === shown.length ? new Set() : new Set(shown.map((m) => m.id)))} data-testid="pages-select-all">{pickedIds.length === shown.length ? "None" : "All"}</button>
      <span className="pp-bulk-count" aria-live="polite">{pickedIds.length} selected</span>
      {filter.kind === "trash" ? <>
        <button type="button" disabled={!pickedIds.length} onClick={() => restoreMany(pickedIds)} data-testid="pages-bulk-restore"><RotateCcw />Restore</button>
        <button type="button" disabled={!pickedIds.length} className="pp-bulk-danger" onClick={() => void foreverMany(pickedIds)} data-testid="pages-bulk-forever"><Trash2 />Delete</button>
      </> : <>
        <button type="button" disabled={!pickedIds.length} onClick={() => void pinMany(pickedIds, !allPinned)} data-testid="pages-bulk-pin">{allPinned ? <PinOff /> : <Pin />}{allPinned ? "Unpin" : "Pin"}</button>
        <button type="button" disabled={!pickedIds.length} onClick={() => setMoveIds(pickedIds)} data-testid="pages-bulk-move"><FolderInput />Move</button>
        <button type="button" disabled={!pickedIds.length} className="pp-bulk-danger" onClick={() => trashMany(pickedIds)} data-testid="pages-bulk-delete"><Trash2 />Delete</button>
      </>}
      <button type="button" aria-label="Done selecting" onClick={stopSelecting}><X /></button>
    </div>}
    {undo && <div className="pp-undo" role="status" data-testid="pages-undo"><span className="min-w-0 flex-1 truncate">Deleted “{undo.title}”</span><button type="button" onClick={() => { sync.restore(undo.id); setUndo(null); say("Restored."); }}>Undo</button></div>}
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
  </div>;

  const editor = openId ? <PageScreen key={openId} ctx={ctx} id={openId} onBack={() => ctx.go({ name: "pages" })} expanded={wide && full} onExpand={wide ? () => setFull((v) => !v) : undefined} /> : null;

  return <div className="pp-min flex h-[100dvh] min-h-0 flex-col" data-testid="pages-view">
    {!wide && !openId && tabs}
    <div className="flex min-h-0 flex-1">
      {wide ? <>
        {!(full && openId) && <aside ref={sideRef} style={{ overscrollBehavior: "contain" }} className="hidden w-[260px] shrink-0 overflow-y-auto border-r border-[var(--an-line)] px-3 py-4 lg:block">{nav}</aside>}
        {!(full && openId) && <section className="w-[360px] shrink-0 border-r border-[var(--an-line)]">{list}</section>}
        <main className="min-w-0 flex-1">{editor ?? <div className="pp-blank"><p>No note selected</p><button type="button" onClick={() => create(PAGE_TEMPLATES[0])} data-testid="pages-new-empty"><Plus className="h-4 w-4" />New note</button></div>}</main>
      </> : <main className="min-w-0 flex-1">{editor ?? (pane === "folders" ? folderScreen : list)}</main>}
    </div>
    {sheet === "new" && <Sheet title="New note" onClose={() => setSheet("")} wide>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="pages-template-list">{PAGE_TEMPLATES.map((t) => <button key={t.id} type="button" onClick={() => create(t)} className="an-card flex items-center gap-3 p-3 text-left hover:border-[var(--an-violet)]">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--an-violet-soft)] text-[var(--an-violet)]">{t.kind === "ink" ? <PenLine className="h-5 w-5" strokeWidth={1.8} /> : t.id.includes("grid") ? <Grid2X2 className="h-5 w-5" strokeWidth={1.8} /> : t.id.includes("cornell") ? <LayoutTemplate className="h-5 w-5" strokeWidth={1.8} /> : <FileText className="h-5 w-5" strokeWidth={1.8} />}</span><span><span className="block text-[15px] font-bold">{t.name}</span><span className="text-[12px] text-[var(--an-muted)]">{t.kind === "ink" ? "Handwriting" : "Typed"}</span></span></button>)}</div>
    </Sheet>}
    {menu && (() => { const m = metas.find((x) => x.id === menu.id); if (!m) return null; const trash = !!m.deletedAt; return <>
      <div className="fixed inset-0 z-[60]" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
      <div role="menu" className="pp-menu" style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 230) }} data-testid="pages-menu">
        {trash ? <>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); restoreMany([m.id]); }}><RotateCcw />Restore</button>
          <button type="button" role="menuitem" className="pp-bulk-danger" onClick={() => { setMenu(null); void foreverMany([m.id]); }}><Trash2 />Delete for good</button>
        </> : <>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); open(m.id); }}><FileText />Open</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); void pinMany([m.id], !m.pinned); }}>{m.pinned ? <PinOff /> : <Pin />}{m.pinned ? "Unpin" : "Pin"}</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); setMoveIds([m.id]); }}><FolderInput />Move to folder</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); startWith(m.id); }}><CheckCircle2 />Select</button>
          <button type="button" role="menuitem" className="pp-bulk-danger" onClick={() => { setMenu(null); trashMany([m.id]); }}><Trash2 />Delete</button>
        </>}
      </div></>; })()}
    {moveIds && <Sheet title={moveIds.length === 1 ? "Move note to" : `Move ${moveIds.length} notes to`} onClose={() => setMoveIds(null)}>
      <ul className="pp-move" data-testid="pages-move-list">
        <li><button type="button" onClick={() => void moveMany(moveIds, "")}><FileText />No folder (All notes)</button></li>
        {folders.map((f) => <li key={f.id}><button type="button" onClick={() => void moveMany(moveIds, f.id)} data-testid="pages-move-folder"><FolderIcon style={f.color ? { color: f.color } : undefined} />{f.name}</button></li>)}
        <li><button type="button" className="pp-move-new" onClick={() => { const ids = moveIds; setMoveIds(null); setMoveAfterFolder(ids); setEditFolder(null); setSheet("folder"); }} data-testid="pages-move-new-folder"><FolderPlus />New folder…</button></li>
      </ul>
    </Sheet>}
    {sheet === "folder" && <FolderSheet folder={editFolder} onClose={() => { setSheet(""); setMoveAfterFolder(null); }}
      onSave={(v) => { if (editFolder) saveFolders(settings.folders.map((f) => (f.id === editFolder.id ? { ...f, ...v } : f))); else { const f = { id: newPageId(), ...v, sort: settings.folders.length }; saveFolders([...settings.folders, f]); if (moveAfterFolder) { const ids = moveAfterFolder; setMoveAfterFolder(null); void (async () => { const list = await pages(ids); for (const p of list) sync.save({ ...p, folderId: f.id }); say(list.length === 1 ? `Moved to ${f.name}.` : `${list.length} notes moved to ${f.name}.`); stopSelecting(); })(); } else pick({ kind: "folder", id: f.id }); } setSheet(""); }}
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
function FolderRow({ on, icon, tint, label, count, onClick, onEdit, testId }: { on: boolean; icon: React.ReactNode; tint?: string; label: string; count?: number; onClick: () => void; onEdit?: () => void; testId?: string }) {
  return <li className="pp-folder" data-on={on || undefined}>
    <button type="button" onClick={onClick} aria-pressed={on} className="pp-folder-main" data-testid={testId}>
      <span aria-hidden className="pp-folder-icon" style={tint ? { color: tint } : undefined}>{icon}</span>
      <span className="pp-folder-name">{label}</span>{count !== undefined && <span className="pp-count">{count}</span>}<ChevronRight aria-hidden className="pp-chev" />
    </button>
    {onEdit && <button type="button" className="pp-folder-edit" onClick={onEdit} aria-label={`Rename or delete ${label}`} data-testid="pages-folder-edit"><MoreHorizontal className="h-[18px] w-[18px]" /></button>}
  </li>;
}

type ClickMods = { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean };
function PageCard({ m, i, grid, on, folder, trash, selecting, selected, onSelect, onMove, onMenu, onOpen, onTrash, onPin, onRestore, onForever }: { m: PageMeta; i: number; grid: boolean; on: boolean; folder?: Folder; trash: boolean; selecting: boolean; selected: boolean; onSelect: (e?: ClickMods) => void; onMove: () => void; onMenu: (x: number, y: number) => void; onOpen: (e?: ClickMods) => void; onTrash: () => void; onPin: () => void; onRestore: () => void; onForever: () => void }) {
  const look = cleanLook(m.content?.look ?? DEFAULT_LOOK);
  const dark = useAppearance().dark;
  const paper = PAPER_THEMES[dark && look.theme === "paper" ? "charcoal" : look.theme];
  const title = pageTitle(m as any);
  const meta = <span className="flex items-center gap-1.5 text-[12px] text-[var(--an-muted)]">{m.pinned && <Pin className="h-3 w-3" aria-label="Pinned" />}{m.locked && <Lock className="h-3 w-3" aria-label="Locked" />}{shortDate(m.updatedAt)}{folder && <span className="truncate">· {folder.name}</span>}</span>;
  const preview = m.locked ? "Locked" : m.preview || (m.kind === "ink" ? "Handwritten note" : "No text yet");
  const context = (e: React.MouseEvent) => { e.preventDefault(); onMenu(e.clientX, e.clientY); };
  const check = selecting && <span className="pp-check" aria-hidden>{selected ? <CheckCircle2 /> : <Circle />}</span>;
  if (trash && selecting) return <li><button type="button" className="pp-row" data-on={selected} onClick={(e) => onOpen(e)} onContextMenu={context} aria-pressed={selected} data-testid="pages-card">{check}
    <span className="min-w-0 flex-1"><span className="pp-row-title">{title}</span>{meta}</span></button></li>;
  if (trash) return <li className="pp-trash-row" onContextMenu={context}>
    <span className="min-w-0 flex-1"><span className="pp-row-title">{title}</span>{meta}</span>
    <button type="button" title="Restore" aria-label="Restore" onClick={onRestore}><RotateCcw /></button>
    <button type="button" title="Delete for good" aria-label="Delete for good" onClick={onForever}><Trash2 /></button>
  </li>;
  const kindIcon = m.locked ? <Lock /> : m.kind === "ink" ? <PenLine /> : <FileText />;
  if (grid) return <li><SwipeItem pinned={m.pinned} onDelete={onTrash} onPin={onPin} radius={18}><button type="button" onClick={(e) => onOpen(e)} onContextMenu={context} aria-pressed={selecting ? selected : undefined} data-testid="pages-card" className="pp-card" data-on={selecting ? selected : on}>{check}
    <span className="pp-card-paper" style={{ background: paper.bg, color: paper.ink }}>
      {m.locked ? <span className="flex h-full items-center justify-center"><Lock className="h-6 w-6 opacity-40" /></span>
        : m.kind === "ink" ? <span className="flex items-start gap-1.5 opacity-75"><PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="line-clamp-5">{preview}</span></span>
        : <span className="line-clamp-6 opacity-85">{preview}</span>}
    </span>
    <span className="pp-card-foot"><span className="pp-card-title">{title}</span>{meta}</span>
  </button></SwipeItem></li>;
  return <li className="pp-li"><SwipeItem pinned={m.pinned} onDelete={onTrash} onPin={onPin}><button type="button" onClick={(e) => onOpen(e)} onContextMenu={context} aria-pressed={selecting ? selected : undefined} data-testid="pages-card" className="pp-row" data-on={selecting ? selected : on}>
    {check}<span className="pp-row-icon" data-kind={m.locked ? "lock" : m.kind} aria-hidden>{kindIcon}</span>
    <span className="min-w-0 flex-1">
      <span className="pp-row-title">{title}</span>
      <span className="pp-row-line"><span className="pp-row-date">{shortDate(m.updatedAt)}</span><span className="pp-row-preview">{preview}</span></span>
      {folder && <span className="pp-row-folder"><FolderIcon className="h-3 w-3" style={folder.color ? { color: folder.color } : undefined} />{folder.name}</span>}
    </span>
    <span className="pp-row-marks" aria-hidden>{m.pinned && <Pin className="h-3.5 w-3.5" />}</span>
  </button></SwipeItem>
    {/* Quick actions on hover (computer): pin, move, delete — one click each. */}
    {!selecting && <span className="pp-quickacts" data-testid="pages-quick-actions">
      <button type="button" title={m.pinned ? "Unpin" : "Pin"} aria-label={m.pinned ? "Unpin" : "Pin"} onClick={onPin}>{m.pinned ? <PinOff /> : <Pin />}</button>
      <button type="button" title="Move to folder" aria-label="Move to folder" onClick={onMove}><FolderInput /></button>
      <button type="button" title="Delete" aria-label="Delete" className="pp-bulk-danger" onClick={onTrash} data-testid="pages-quick-delete"><Trash2 /></button>
      <button type="button" title={`Select ${title}`} aria-label="Select" onClick={() => onSelect()}><Circle /></button>
    </span>}
  </li>;
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
