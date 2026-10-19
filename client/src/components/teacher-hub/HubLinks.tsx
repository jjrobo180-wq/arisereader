// Arise WorkHub: linking things together (shared/hubLinks.ts).
//   <LinkEditor>     the "Linked" row on a reminder, note, goal or meeting: chips, + Link, smart suggestions
//   <ConnectedPanel> everything connected to an item or a student, grouped, one tap to open
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BookOpen, CalendarDays, CheckSquare, ClipboardCheck, FileText, Link2, Plus, Search, StickyNote, Target, User, X } from "lucide-react";
import { KIND_LABEL, KIND_ONE, LINK_KINDS, connections, linkables, linksOf, resolveLink, setLinks, suggestLinks, type HubLink, type LinkKind, type Linkable } from "@shared/hubLinks";
import { searchHub } from "@shared/hubSearch";
import type { Workspace } from "@shared/teacherHub";

/** The Hub and how to open a linked thing, for every piece of WorkHub below the page (set by TeacherHub). */
type LinkCtxValue = {
  workspace: Workspace; openLink: (l: HubLink) => void; token?: string | null;
  /** Opens "Add with AI" to read a document (upload or Drive) for a student; what it adds links to them. */
  readDocument?: (student?: string) => void;
};
const LinkCtx = createContext<LinkCtxValue | null>(null);
export const HubLinkProvider = ({ children, ...value }: LinkCtxValue & { children: ReactNode }) =>
  <LinkCtx.Provider value={value}>{children}</LinkCtx.Provider>;
export const useHubLinks = () => useContext(LinkCtx);

export const KIND_ICON: Record<LinkKind, ReactNode> = {
  file: <FileText className="h-4 w-4" />, student: <User className="h-4 w-4" />, goal: <Target className="h-4 w-4" />, meeting: <CalendarDays className="h-4 w-4" />,
  note: <StickyNote className="h-4 w-4" />, task: <CheckSquare className="h-4 w-4" />, lesson: <BookOpen className="h-4 w-4" />, quiz: <ClipboardCheck className="h-4 w-4" />,
};
const TONE: Record<LinkKind, string> = {
  file: "bg-sky-50 text-sky-800 ring-sky-200", student: "bg-teal-50 text-teal-800 ring-teal-200", goal: "bg-pink-50 text-pink-800 ring-pink-200", meeting: "bg-violet-50 text-violet-800 ring-violet-200",
  note: "bg-amber-50 text-amber-900 ring-amber-200", task: "bg-slate-100 text-slate-800 ring-slate-200", lesson: "bg-indigo-50 text-indigo-800 ring-indigo-200", quiz: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

/** One linked thing as a chip: tap to open it, × to unlink. */
export function LinkChip({ item, onOpen, onRemove }: { item: Linkable; onOpen?: () => void; onRemove?: () => void }) {
  return <span className={`inline-flex max-w-full items-center rounded-full ring-1 ${TONE[item.kind]}`} data-testid="link-chip">
    <button type="button" onClick={onOpen} disabled={!onOpen} title={`${KIND_ONE[item.kind]}: ${item.label}`} className="inline-flex min-h-9 min-w-0 items-center gap-1.5 rounded-full pl-2.5 pr-2 text-sm font-semibold">
      {KIND_ICON[item.kind]}<span className="truncate">{item.label}</span>
    </button>
    {onRemove && <button type="button" onClick={onRemove} aria-label={`Unlink ${item.label}`} className="mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-black/10"><X className="h-3.5 w-3.5" /></button>}
  </span>;
}

/** Search everything in the Hub and pick what to link. Stays open so several can be added. */
function LinkPicker({ workspace, links, self, onAdd, onClose }: { workspace: Workspace; links: HubLink[]; self?: HubLink; onAdd: (l: HubLink) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<LinkKind | "">("");
  const all = useMemo(() => linkables(workspace), [workspace]);
  const have = new Set([...links, ...(self ? [self] : [])].map((l) => `${l.kind}:${l.id}`));
  const pool = all.filter((x) => !have.has(`${x.kind}:${x.id}`) && (!only || x.kind === only));
  const found = q.trim() ? searchHub(pool.map((x) => ({ ...x, title: x.label, keywords: x.student })), q, 60) : pool.slice(0, 60);
  const kinds = LINK_KINDS.filter((k) => all.some((x) => x.kind === k));
  return createPortal(<div className="fixed inset-0 kb-sheet z-[760] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="Link something" className="flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-auto sm:max-h-[80vh] sm:max-w-xl sm:rounded-3xl" data-testid="link-picker">
      <div className="flex items-center gap-2 border-b border-slate-100 p-3">
        <Search className="ml-1 h-5 w-5 shrink-0 text-slate-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files, students, goals, meetings…" aria-label="Search what to link" className="min-h-12 min-w-0 flex-1 bg-transparent text-base outline-none" />
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">Done</button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-3 py-2" role="group" aria-label="Only show">
        {[["", "All"] as const, ...kinds.map((k) => [k, KIND_LABEL[k]] as const)].map(([k, label]) => <button key={k || "all"} type="button" aria-pressed={only === k} onClick={() => setOnly(k as LinkKind | "")}
          className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-bold ${only === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>{label}</button>)}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {found.length ? found.map((x) => <li key={`${x.kind}:${x.id}`}>
          <button type="button" onClick={() => onAdd({ kind: x.kind, id: x.id })} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50">
            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${TONE[x.kind]}`}>{KIND_ICON[x.kind]}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{x.label}</span><span className="block truncate text-xs text-slate-500">{KIND_ONE[x.kind]} · {x.sub}</span></span>
            <Plus className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </li>) : <li className="px-3 py-10 text-center text-sm text-slate-500">{all.length ? "Nothing else to link matches that." : "Add students, goals, files or reminders first, then link them here."}</li>}
      </ul>
    </div>
  </div>, document.body);
}

/** The "Linked" row: what this is linked to, a button to link more, and smart suggestions from its words. */
export function LinkEditor({ workspace, links, onChange, text = "", self, onOpen }: {
  workspace: Workspace; links: HubLink[]; onChange: (links: HubLink[]) => void; text?: string; self?: HubLink; onOpen?: (l: HubLink) => void;
}) {
  const ctx = useHubLinks();
  onOpen = onOpen ?? ctx?.openLink;
  const [picking, setPicking] = useState(false);
  const all = useMemo(() => linkables(workspace), [workspace]);
  const shown = links.map((l) => ({ l, item: resolveLink(workspace, l, all) })).filter((x): x is { l: HubLink; item: Linkable } => !!x.item);
  const suggested = useMemo(() => suggestLinks(workspace, text, links, self), [workspace, text, links, self]);
  const add = (l: HubLink) => onChange([...links, l]);
  return <div className="space-y-2" data-testid="link-editor">
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Link2 className="h-3.5 w-3.5" /> Linked</span>
      <button type="button" onClick={() => setPicking(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" data-testid="link-add"><Plus className="h-4 w-4" /> Link</button>
    </div>
    {shown.length > 0
      ? <div className="flex flex-wrap gap-1.5">{shown.map(({ l, item }) => <LinkChip key={`${l.kind}:${l.id}`} item={item} onOpen={onOpen ? () => onOpen(l) : undefined} onRemove={() => onChange(links.filter((x) => !(x.kind === l.kind && x.id === l.id)))} />)}</div>
      : <p className="text-sm text-slate-500">Link a Drive file, a student, their goals, a meeting or anything else this goes with.</p>}
    {suggested.length > 0 && <div className="flex flex-wrap items-center gap-1.5" data-testid="link-suggestions">
      <span className="text-xs font-semibold text-slate-500">Suggested:</span>
      {suggested.map((x) => <button key={`${x.kind}:${x.id}`} type="button" onClick={() => add({ kind: x.kind, id: x.id })} className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        <Plus className="h-3.5 w-3.5" />{KIND_ICON[x.kind]}<span className="truncate">{x.label}</span></button>)}
    </div>}
    {picking && <LinkPicker workspace={workspace} links={links} self={self} onAdd={add} onClose={() => setPicking(false)} />}
  </div>;
}

/** Everything connected to one item (or student), grouped by kind. */
export function ConnectedPanel({ workspace, kind, id, onOpen, title = "Connected", empty }: { workspace: Workspace; kind: LinkKind; id: string; onOpen: (l: HubLink) => void; title?: string; empty?: string }) {
  const items = useMemo(() => connections(workspace, kind, id), [workspace, kind, id]);
  const groups = LINK_KINDS.map((k) => ({ k, rows: items.filter((x) => x.kind === k) })).filter((g) => g.rows.length);
  return <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label={title} data-testid="connected-panel">
    <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><Link2 className="h-4 w-4 text-teal-700" />{title}<span className="text-sm font-medium text-slate-500">{items.length}</span></h3>
    {groups.length ? <div className="space-y-3">{groups.map(({ k, rows }) => <div key={k}>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{KIND_LABEL[k]}</p>
      <div className="flex flex-wrap gap-1.5">{rows.map((x) => <LinkChip key={`${x.kind}:${x.id}`} item={x} onOpen={() => onOpen({ kind: x.kind, id: x.id })} />)}</div>
    </div>)}</div> : <p className="text-sm text-slate-500">{empty || "Nothing connected yet. Link files, goals or reminders, or add things for this student."}</p>}
  </section>;
}

/**
 * "Connected" under a meeting, goal or other item: a button with how many things are connected,
 * opening the links it keeps (to change) and everything connected to it. Opens by itself when a
 * link elsewhere pointed here (`focusKey` in session storage holds this item's id).
 */
export function ItemConnections({ kind, id, text, setWorkspace, focusKey }: {
  kind: "meeting" | "goal" | "note" | "task"; id: string; text: string;
  setWorkspace: (update: (w: Workspace) => Workspace) => void; focusKey?: string;
}) {
  const ctx = useHubLinks();
  const [open, setOpen] = useState(() => { try { if (focusKey && sessionStorage.getItem(focusKey) === id) { sessionStorage.removeItem(focusKey); return true; } } catch { /* closed */ } return false; });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open && ref.current && focusKey) ref.current.scrollIntoView({ behavior: "smooth", block: "center" }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ctx) return null;
  const count = connections(ctx.workspace, kind, id).length;
  const links = linksOf(ctx.workspace, kind, id);
  return <div ref={ref} className="mt-1">
    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-teal-800 underline decoration-teal-200 underline-offset-4" data-testid={`${kind}-connected`}>
      <Link2 className="h-4 w-4" /> Connected{count ? ` (${count})` : ""}
    </button>
    {open && <div className="mt-2 space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3"><LinkEditor workspace={ctx.workspace} links={links} onChange={(next) => setWorkspace((w) => setLinks(w, kind, id, next))} text={text} self={{ kind, id }} /></div>
      <ConnectedPanel workspace={ctx.workspace} kind={kind} id={id} onOpen={ctx.openLink} title="Everything connected" />
    </div>}
  </div>;
}
