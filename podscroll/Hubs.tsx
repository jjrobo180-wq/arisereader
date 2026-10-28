// Pod Modes (hubs) on the Pod+ home page: a row of them, a page for each with its own look
// (page color, accent and typeface, set by the listener), and the "Add to" menu that opens from an
// episode card's ⋮ button or a press-and-hold. Modes are the same saved lists the swipe feed uses.
import { useMemo, useRef, useState } from "react";
import {
  EARSHOT_LIMITS, GENRE, GENRES, HUB_ACCENTS, HUB_BACKGROUNDS, HUB_FONTS, MODE_ICONS, hiRes, hubTheme, inkOn, isTeaser,
  type Earshot, type HubFont, type HubTheme, type PodEpisode, type PodMode, type PodShow, type SavedEpisode,
} from "@shared/earshot";
import { ModeIcon } from "../client/src/components/family-hub/earshot/EarshotExtras";
import { artIn } from "./art";
import { ArrowUp, Ban, Bookmark, Car, Check, ThumbsDown, ChevronLeft, Pencil, ChevronRight, RefreshCw, Loader2, Palette, Play, Plus, RotateCcw, Shuffle, SlidersHorizontal, Sparkles, Trash2, X, Zap } from "lucide-react";

type Update = (fn: (e: Earshot) => Earshot) => void;
type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;

export const toSaved = (e: PodEpisode): SavedEpisode => ({ id: e.id, showId: e.showId, title: e.title, show: e.show, art: e.art, secs: e.secs, at: new Date().toISOString(), audio: e.audio, date: e.date });
const mins = (s: number) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`; };
const newModeId = (name: string) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16) || "mode"}-${Math.random().toString(36).slice(2, 6)}`;

/** The row of Pod Modes on the home page. */
export function ModesRow({ es, update, onOpen, onNew, onDrive, onNews }: { es: Earshot; update: Update; onOpen: (m: PodMode) => void; onNew: () => void; /** Opens Fit my drive (a built-in hub, always first). */ onDrive?: () => void; /** Opens Up to the Minute News (a built-in hub). */ onNews?: () => void }) {
  const [arranging, setArranging] = useState(false);
  const move = (id: string, d: number) => update((e) => {
    const list = e.modes.slice(); const i = list.findIndex((m) => m.id === id); const j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return e;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...e, modes: list };
  });
  return <section aria-label="Pod Modes" className="mb-6">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">Pod Modes</h2>
      <div className="flex items-center gap-3">
        {!arranging && <span className="hidden text-xs text-[#606060] sm:inline">Tap ⋮ on any episode to add it</span>}
        <button onClick={() => setArranging((v) => !v)} aria-pressed={arranging} aria-label={arranging ? "Done editing Pod Modes" : "Edit Pod Modes"} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium ${arranging ? "text-[#065fd4]" : "text-[#606060] hover:text-[#0f0f0f]"}`}>{arranging ? "Done" : <><Pencil size={15} strokeWidth={1.8} />Edit</>}</button>
      </div>
    </div>
    <div className="-mx-1 mt-3 flex gap-5 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
      {onDrive && !arranging && <button onClick={onDrive} aria-label="Fit my drive: say how long the drive is and get episodes that end as you arrive" className="group flex shrink-0 flex-col items-center gap-2.5 active:scale-[.97] transition-transform" data-testid="hub-fit-drive">
        <span className="relative block h-[104px] w-[104px] sm:h-[120px] sm:w-[120px]">
          <span className="grid h-full w-full place-items-center rounded-full text-white shadow-[0_12px_28px_-14px_rgba(0,0,0,.55)] transition-transform duration-500 group-hover:scale-[1.04]" style={{ background: "linear-gradient(135deg,#ff8a3d,#ff3b30)" }}><Car size={38} /></span>
          <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/[.06]" />
        </span>
        <span className="flex w-[112px] flex-col items-center gap-0.5 sm:w-[128px]">
          <span className="line-clamp-2 text-center text-[15px] font-semibold leading-tight">Fit my drive</span>
          <span className="text-center text-xs text-[#606060]">Ends as you arrive</span>
        </span>
      </button>}
      {onNews && !arranging && <button onClick={onNews} aria-label="Up to the Minute News: only news from the last few hours" className="group flex shrink-0 flex-col items-center gap-2.5 active:scale-[.97] transition-transform" data-testid="hub-news-now">
        <span className="relative block h-[104px] w-[104px] sm:h-[120px] sm:w-[120px]">
          <span className="grid h-full w-full place-items-center rounded-full text-white shadow-[0_12px_28px_-14px_rgba(0,0,0,.55)] transition-transform duration-500 group-hover:scale-[1.04]" style={{ background: "linear-gradient(135deg,#1e3a8a,#0f172a)" }}><Zap size={38} className="text-[#ffb37a]" /></span>
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-[#ff3b30] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow">Live</span>
          <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/[.06]" />
        </span>
        <span className="flex w-[112px] flex-col items-center gap-0.5 sm:w-[128px]">
          <span className="line-clamp-2 text-center text-[15px] font-semibold leading-tight">Up to the Minute News</span>
          <span className="text-center text-xs text-[#606060]">Last few hours only</span>
        </span>
      </button>}
      {es.modes.map((m, idx) => {
        const th = hubTheme(m); const font = HUB_FONTS[th.font];
        const cover = m.episodes[0]?.art;
        const circle = <span className="relative block h-[104px] w-[104px] sm:h-[120px] sm:w-[120px]">
          <span className="block h-full w-full overflow-hidden rounded-full shadow-[0_12px_28px_-14px_rgba(0,0,0,.55)]" style={{ background: th.bg }}>
            {cover
              ? <img src={hiRes(cover, 300)} alt="" {...artIn} className="pz-art h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
              : <span className="grid h-full w-full place-items-center" style={{ color: inkOn(th.bg) }}><ModeIcon m={m} size={34} /></span>}
          </span>
          <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/[.06]" />
          {cover && <span className="absolute -bottom-0.5 -right-0.5 grid h-9 w-9 place-items-center rounded-full ring-[3px] ring-white" style={{ background: th.accent, color: inkOn(th.accent) }}><ModeIcon m={m} size={16} /></span>}
          {m.fresh && <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow" style={{ background: th.accent, color: inkOn(th.accent) }}>Fresh</span>}
        </span>;
        const label = <span className="flex w-[112px] flex-col items-center gap-0.5 sm:w-[128px]">
          <span className="line-clamp-2 text-center text-[15px] leading-tight" style={{ fontFamily: font.stack, fontWeight: font.weight, letterSpacing: font.tracking }}>{m.name}</span>
          <span className="text-xs text-[#606060]">{m.episodes.length ? `${m.episodes.length} episode${m.episodes.length === 1 ? "" : "s"}` : m.fresh ? "Filling today" : "Empty"}</span>
        </span>;
        if (!arranging) return <button key={m.id} onClick={() => onOpen(m)} className="group flex shrink-0 flex-col items-center gap-2.5 active:scale-[.97] transition-transform">{circle}{label}</button>;
        return <div key={m.id} className="flex shrink-0 flex-col items-center gap-2.5">
          <span className="relative rounded-full ring-2 ring-[#1c62b9] ring-offset-2">{circle}</span>
          <span className="flex gap-1.5">
            <button onClick={() => move(m.id, -1)} disabled={idx === 0} aria-label={`Move ${m.name} left`} className="grid h-9 w-9 place-items-center rounded-full bg-[#f2f2f2] disabled:opacity-30"><ChevronLeft size={18} /></button>
            <button onClick={() => move(m.id, 1)} disabled={idx === es.modes.length - 1} aria-label={`Move ${m.name} right`} className="grid h-9 w-9 place-items-center rounded-full bg-[#f2f2f2] disabled:opacity-30"><ChevronRight size={18} /></button>
          </span>
          {label}
        </div>;
      })}
      {!arranging && <button onClick={onNew} className="flex shrink-0 flex-col items-center gap-2.5">
        <span className="grid h-[104px] w-[104px] place-items-center rounded-full border-2 border-dashed border-[#c4c4c4] text-[#606060] sm:h-[120px] sm:w-[120px]"><Plus size={28} /></span>
        <span className="text-[15px] font-medium text-[#606060]">New mode</span>
      </button>}
    </div>
  </section>;
}

/** Make a new, empty Pod Mode. Returns its id. */
export function makeMode(update: Update, name: string): string {
  const n = name.replace(/\s+/g, " ").trim().slice(0, 30);
  const id = newModeId(n);
  update((e) => ({ ...e, modes: [...e.modes, { id, name: n, icon: MODE_ICONS[0], episodes: [] }].slice(0, EARSHOT_LIMITS.modes) }));
  return id;
}

/** A small dialog to name a new mode. */
export function NewModeDialog({ onMake, onClose }: { onMake: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  return <div role="dialog" aria-modal="true" aria-labelledby="ps-newmode" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-3 pb-3 sm:items-center">
    <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onMake(name); }} className="w-full max-w-sm rounded-2xl bg-white p-5 text-[#0f0f0f] shadow-2xl">
      <h2 id="ps-newmode" className="text-lg font-semibold">New Pod Mode</h2>
      <p className="mt-1 text-sm text-[#606060]">A playlist for a moment: a drive, a run, a long cook.</p>
      <label htmlFor="ps-newmode-name" className="sr-only">Name</label>
      <input id="ps-newmode-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Road trip, Bedtime, Deep work…" className="mt-4 h-11 w-full rounded-xl border border-[#d3d3d3] px-3 text-base outline-none focus:border-[#1c62b9]" />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-sm font-medium hover:bg-[#f2f2f2]">Cancel</button>
        <button type="submit" disabled={!name.trim()} className="h-10 rounded-full bg-[#0f0f0f] px-5 text-sm font-semibold text-white disabled:opacity-40">Create</button>
      </div>
    </form>
  </div>;
}

/** "Add to": Listen later and every Pod Mode, from an episode card. */
export function AddToMenu({ es, ep, update, say, onClose, onDislike, onBlock }: { es: Earshot; ep: PodEpisode; update: Update; say: (m: string) => void; onClose: () => void; onDislike?: (e: PodEpisode) => void; onBlock?: (e: PodEpisode) => void }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const inMode = (m: PodMode) => m.episodes.some((x) => x.id === ep.id);
  const later = es.saved.some((x) => x.id === ep.id);
  const toggle = (id: string) => update((e) => ({ ...e, modes: e.modes.map((m) => (m.id !== id ? m : inMode(m) ? { ...m, episodes: m.episodes.filter((x) => x.id !== ep.id) } : { ...m, episodes: [toSaved(ep), ...m.episodes].slice(0, EARSHOT_LIMITS.modeEpisodes) })) }));
  const toggleLater = () => update((e) => ({ ...e, saved: later ? e.saved.filter((x) => x.id !== ep.id) : [toSaved(ep), ...e.saved].slice(0, EARSHOT_LIMITS.saved) }));
  const create = () => {
    const n = name.replace(/\s+/g, " ").trim().slice(0, 30); if (!n) return;
    update((e) => ({ ...e, modes: [...e.modes, { id: newModeId(n), name: n, icon: MODE_ICONS[0], episodes: [toSaved(ep)] }].slice(0, EARSHOT_LIMITS.modes) }));
    setNaming(false); setName(""); say(`Made “${n}” and added this episode.`);
  };
  const row = (key: string, on: boolean, act: () => void, icon: React.ReactNode, title: string, sub: string) =>
    <button key={key} role="checkbox" aria-checked={on} onClick={act} className="flex min-h-[56px] w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-[#f7f7f5]">
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f2f2f2]">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium">{title}</span><span className="block text-xs text-[#606060]">{sub}</span></span>
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${on ? "bg-[#0f0f0f] text-white" : "ring-1 ring-[#c4c4c4]"}`}>{on && <Check size={14} strokeWidth={2.5} />}</span>
    </button>;
  return <div role="dialog" aria-modal="true" aria-labelledby="ps-addto" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-3 pb-3 sm:items-center">
    <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white text-[#0f0f0f] shadow-2xl">
      <div className="flex items-center gap-3 border-b border-[#ececec] p-4">
        <img src={hiRes(ep.art, 120)} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
        <div className="min-w-0 flex-1"><p id="ps-addto" className="line-clamp-1 text-sm font-semibold">{ep.title}</p><p className="truncate text-xs text-[#606060]">{ep.show}</p></div>
        <button onClick={onClose} aria-label="Close" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><X size={20} /></button>
      </div>
      <div className="overflow-y-auto p-2">
        {onDislike && <button onClick={() => { onDislike(ep); onClose(); }} className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-[#f7f7f5]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f2f2f2]"><ThumbsDown size={16} strokeWidth={1.8} /></span>
          <span className="min-w-0"><span className="block text-[15px] font-medium">Not interested</span><span className="block text-xs text-[#606060]">Show fewer episodes like this</span></span>
        </button>}
        {onBlock && <button onClick={() => { onBlock(ep); onClose(); }} className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-[#fef3f2]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fef3f2] text-[#b42318]"><Ban size={16} strokeWidth={1.8} /></span>
          <span className="min-w-0"><span className="block truncate text-[15px] font-medium text-[#b42318]">Don't show this podcast</span><span className="block truncate text-xs text-[#606060]">Never see {ep.show} again</span></span>
        </button>}
        {(onDislike || onBlock) && <div className="mx-2 my-1.5 h-px bg-[#ececec]" />}
        {row("later", later, toggleLater, <Bookmark size={16} strokeWidth={1.8} />, "Listen later", "In your Library")}
        <p className="px-2 pb-1 pt-4 text-[12px] font-semibold uppercase tracking-[.14em] text-[#767676]">Pod Modes</p>
        {es.modes.map((m) => { const th = hubTheme(m); return row(m.id, inMode(m), () => toggle(m.id), <span className="grid h-full w-full place-items-center" style={{ background: th.bg, color: inkOn(th.bg) }}><ModeIcon m={m} size={15} /></span>, m.name, `${m.episodes.length} episode${m.episodes.length === 1 ? "" : "s"}`); })}
        {naming
          ? <form onSubmit={(e) => { e.preventDefault(); create(); }} className="flex gap-2 p-2">
            <label htmlFor="ps-addto-new" className="sr-only">New mode name</label>
            <input id="ps-addto-new" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Name it" className="h-10 min-w-0 flex-1 rounded-lg border border-[#d3d3d3] px-3 text-base outline-none focus:border-[#1c62b9]" />
            <button type="submit" disabled={!name.trim()} className="h-10 rounded-lg bg-[#0f0f0f] px-4 text-sm font-semibold text-white disabled:opacity-40">Add</button>
          </form>
          : <button onClick={() => setNaming(true)} className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2 text-sm font-medium text-[#3a3a3a] hover:bg-[#f7f7f5]"><span className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-[#d3d3d3]"><Plus size={16} /></span>New mode</button>}
      </div>
      <div className="border-t border-[#ececec] p-3"><button onClick={onClose} className="h-10 w-full rounded-full bg-[#0f0f0f] text-sm font-semibold text-white">Done</button></div>
    </div>
  </div>;
}

/** A Pod Mode's own page, in its own look, with the editor for that look. */
type Order = "in" | "shuffle" | "shows";
const ORDERS: { id: Order; name: string; hint: string }[] = [
  { id: "in", name: "In order", hint: "Top to bottom" },
  { id: "shuffle", name: "Shuffle", hint: "Every episode mixed" },
  { id: "shows", name: "Shuffle shows", hint: "Shows mixed, each show's episodes in order" },
];

export function ModePage({ es, id, update, say, onPlay, onBack, api, ex }: { es: Earshot; id: string; update: Update; say: (m: string) => void; onPlay: (index: number, order: Order) => void; onBack: () => void; api: Api; ex: string }) {
  const mode = es.modes.find((m) => m.id === id);
  const [editing, setEditing] = useState(false);
  const [rename, setRename] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [order, setOrderState] = useState<Order>(() => { try { const v = localStorage.getItem(`podscroll.order.${id}`); return v === "shuffle" || v === "shows" ? v : "in"; } catch { return "in"; } });
  const setOrder = (o: Order) => { setOrderState(o); try { localStorage.setItem(`podscroll.order.${id}`, o); } catch { /* private window */ } };
  const th = useMemo(() => (mode ? hubTheme(mode) : null), [mode]);
  if (!mode || !th) return <div className="px-6 py-24 text-center text-[#606060]">That Pod Mode is gone. <button onClick={onBack} className="font-semibold underline">Back home</button></div>;
  const ink = inkOn(th.bg); const font = HUB_FONTS[th.font];
  const builtIn = ["briefing", "sleep", "commute", "workout", "focus", "learn", "chores"].includes(mode.id);
  const setTheme = (t: Partial<HubTheme> | null) => update((e) => ({ ...e, modes: e.modes.map((m) => (m.id !== mode.id ? m : t === null ? { ...m, theme: undefined } : { ...m, theme: { ...hubTheme(m), ...t } })) }));
  const remove = (eid: string) => update((e) => ({ ...e, modes: e.modes.map((m) => (m.id === mode.id ? { ...m, episodes: m.episodes.filter((x) => x.id !== eid) } : m)) }));
  const moveUp = (i: number) => update((e) => ({ ...e, modes: e.modes.map((m) => { if (m.id !== mode.id || i < 1) return m; const l = m.episodes.slice(); [l[i - 1], l[i]] = [l[i], l[i - 1]]; return { ...m, episodes: l }; }) }));
  const saveName = () => { const n = (rename || "").replace(/\s+/g, " ").trim().slice(0, 30); if (n) update((e) => ({ ...e, modes: e.modes.map((m) => (m.id === mode.id ? { ...m, name: n } : m)) })); setRename(null); };
  const del = () => { update((e) => ({ ...e, modes: e.modes.filter((m) => m.id !== mode.id) })); say(`Deleted “${mode.name}”.`); onBack(); };
  const total = mode.episodes.reduce((a, e) => a + (e.secs || 0), 0);

  return <div className="mx-auto max-w-[1100px] px-4 pb-20 pt-3 sm:px-6">
    <div className="flex items-center justify-between gap-3">
      <button onClick={onBack} className="inline-flex h-10 items-center gap-1 rounded-full pl-2 pr-4 text-sm font-medium hover:bg-[#f2f2f2]"><ChevronLeft size={20} />Home</button>
      <button onClick={() => setEditing((v) => !v)} aria-expanded={editing} className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium ${editing ? "bg-[#0f0f0f] text-white" : "bg-[#f2f2f2] hover:bg-[#e5e5e5]"}`}><Palette size={16} />Customize</button>
    </div>

    <section className="mt-3 overflow-hidden rounded-2xl p-5 sm:p-7" style={{ background: th.bg, color: ink }}>
      <div className="flex flex-wrap items-end gap-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: th.accent, color: inkOn(th.accent) }}><ModeIcon m={mode} size={24} /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em]"><span className="opacity-60">Pod Mode</span>{mode.fresh && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider" style={{ background: th.accent, color: inkOn(th.accent) }}>Fresh</span>}</p>
          {rename !== null
            ? <form onSubmit={(e) => { e.preventDefault(); saveName(); }}><label htmlFor="ps-mode-name" className="sr-only">Name</label><input id="ps-mode-name" autoFocus value={rename} onChange={(e) => setRename(e.target.value)} onBlur={saveName} maxLength={30} className="mt-1 h-12 w-full rounded-lg bg-black/10 px-3 text-2xl outline-none" style={{ fontFamily: font.stack, fontWeight: font.weight, color: ink }} /></form>
            : <h1 className="mt-1 text-[34px] leading-[1.05] sm:text-[48px]" style={{ fontFamily: font.stack, fontWeight: font.weight, letterSpacing: font.tracking }}>
              <button onClick={() => setRename(mode.name)} className="text-left" title="Rename">{mode.name}</button>
            </h1>}
          <p className="mt-1.5 text-sm opacity-65">{mode.episodes.length} episode{mode.episodes.length === 1 ? "" : "s"}{total ? ` · ${mins(total)}` : ""}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button disabled={!mode.episodes.length} onClick={() => onPlay(0, order)} className="inline-flex h-11 items-center gap-2 rounded-full px-6 text-[15px] font-semibold disabled:opacity-40" style={{ background: th.accent, color: inkOn(th.accent) }}>{order === "in" ? <Play size={17} fill="currentColor" /> : <Shuffle size={17} />}{order === "in" ? "Play" : order === "shuffle" ? "Shuffle play" : "Shuffle shows"}</button>
        <div role="radiogroup" aria-label="Play order" className="inline-flex h-11 items-center rounded-full p-1" style={{ boxShadow: `inset 0 0 0 1px ${ink}33` }}>
          {ORDERS.map((o) => <button key={o.id} role="radio" aria-checked={order === o.id} title={o.hint} onClick={() => setOrder(o.id)} className="h-9 rounded-full px-3.5 text-sm font-medium" style={order === o.id ? { background: ink, color: th.bg } : undefined}>{o.name}</button>)}
        </div>
        <button onClick={() => setFinding(true)} className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[15px] font-medium" style={{ boxShadow: `inset 0 0 0 1px ${ink}40` }}><Sparkles size={16} />Find with AI</button>
      </div>
    </section>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e5e5e5] px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Fresh</p>
        <p className="text-xs text-[#606060]">{mode.fresh ? `Rebuilt every day with the newest episodes${mode.freshDay ? `. Last: ${mode.freshDay === new Date().toLocaleDateString("en-CA") ? "today" : mode.freshDay}` : ""}.` : "Turn on to rebuild this mode every day with the newest episodes."}</p>
      </div>
      <div className="flex items-center gap-2">
        {mode.fresh && <button onClick={() => update((e) => ({ ...e, modes: e.modes.map((m) => (m.id === mode.id ? { ...m, freshDay: undefined } : m)) }))} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium hover:bg-[#f2f2f2]"><RefreshCw size={15} />Refresh now</button>}
        <button role="switch" aria-checked={!!mode.fresh} aria-label="Fresh" onClick={() => update((e) => ({ ...e, modes: e.modes.map((m) => (m.id === mode.id ? { ...m, fresh: !m.fresh, freshDay: undefined } : m)) }))} className={`relative h-7 w-12 rounded-full transition ${mode.fresh ? "bg-[#0f0f0f]" : "bg-[#d3d3d3]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${mode.fresh ? "left-6" : "left-1"}`} /></button>
      </div>
    </div>

    {finding && <AiFinderPanel mode={mode} api={api} ex={ex} update={update} say={say} onClose={() => setFinding(false)} />}

    {editing && <section aria-label="Customize this mode" className="mt-4 rounded-2xl border border-[#e5e5e5] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Customize</h2>
        <button onClick={() => setTheme(null)} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[#606060] hover:bg-[#f2f2f2]"><RotateCcw size={14} />Reset</button>
      </div>
      <p className="mt-4 text-[12px] font-semibold uppercase tracking-[.14em] text-[#767676]">Background</p>
      <Swatches colors={HUB_BACKGROUNDS} value={th.bg} onPick={(bg) => setTheme({ bg })} label="Background" />
      <p className="mt-4 text-[12px] font-semibold uppercase tracking-[.14em] text-[#767676]">Accent</p>
      <Swatches colors={HUB_ACCENTS} value={th.accent} onPick={(accent) => setTheme({ accent })} label="Accent" />
      <p className="mt-4 text-[12px] font-semibold uppercase tracking-[.14em] text-[#767676]">Typeface</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(Object.keys(HUB_FONTS) as HubFont[]).map((f) => <button key={f} onClick={() => setTheme({ font: f })} aria-pressed={th.font === f} className={`h-11 rounded-lg px-4 text-[15px] ${th.font === f ? "bg-[#0f0f0f] text-white" : "bg-[#f2f2f2] hover:bg-[#e5e5e5]"}`} style={{ fontFamily: HUB_FONTS[f].stack, fontWeight: HUB_FONTS[f].weight }}>{HUB_FONTS[f].name}</button>)}
      </div>
    </section>}

    <h2 className="mt-8 text-base font-semibold">Episodes</h2>
    <ol className="mt-2 flex flex-col divide-y divide-[#ececec]">
      {!mode.episodes.length && <li className="py-10 text-center text-sm text-[#606060]">Nothing here yet. Tap ⋮ on any episode, then pick “{mode.name}”.</li>}
      {mode.episodes.map((e, i) => <li key={e.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5">
        <button onClick={() => onPlay(i, "in")} aria-label={`Play ${e.title}`} className="relative block overflow-hidden rounded-lg"><img src={hiRes(e.art, 160)} alt="" {...artIn} className="pz-art h-16 w-16 object-cover transition-transform duration-500 hover:scale-110 sm:h-[72px] sm:w-[128px]" /></button>
        <button onClick={() => onPlay(i, "in")} className="min-w-0 text-left">
          <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{e.title}</span>
          <span className="line-clamp-1 text-xs text-[#606060]">{e.show}{e.secs ? ` · ${mins(e.secs)}` : ""}</span>
        </button>
        <span className="flex gap-1">
          <button onClick={() => moveUp(i)} disabled={i === 0} aria-label="Move up" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#f2f2f2] disabled:opacity-30"><ArrowUp size={16} /></button>
          <button onClick={() => remove(e.id)} aria-label={`Remove ${e.title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><X size={16} /></button>
        </span>
      </li>)}
    </ol>
    {!builtIn && <button onClick={del} className="mt-10 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-[#b42318] hover:bg-[#fef3f2]"><Trash2 size={15} />Delete this mode</button>}
  </div>;
}

function Swatches({ colors, value, onPick, label }: { colors: readonly string[]; value: string; onPick: (c: string) => void; label: string }) {
  return <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={label}>
    {colors.map((c) => <button key={c} onClick={() => onPick(c)} aria-label={`${label} ${c}`} aria-pressed={value.toUpperCase() === c.toUpperCase()} className="grid h-9 w-9 place-items-center rounded-full" style={{ background: c, boxShadow: value.toUpperCase() === c.toUpperCase() ? "0 0 0 2px #fff, 0 0 0 4px #0f0f0f" : "inset 0 0 0 1px rgba(0,0,0,.15)" }}>{value.toUpperCase() === c.toUpperCase() && <Check size={15} color={inkOn(c)} strokeWidth={2.5} />}</button>)}
    <label className="relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-[#f2f2f2] pl-1 pr-3 text-xs font-medium hover:bg-[#e5e5e5]">
      <span className="h-7 w-7 rounded-full" style={{ background: value, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }} />Custom
      <input type="color" value={value} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`Custom ${label.toLowerCase()} color`} />
    </label>
  </div>;
}

// ---------------------------------------------------------------------------
// Find with AI: describe what you want; filters (length, how new, genres) and a "don't include"
// list shape what it adds. Settings are kept per mode, in this browser.
// ---------------------------------------------------------------------------
type AiPrefs = { prompt: string; length: "any" | "short" | "mid" | "long" | "xl"; since: "any" | "week" | "month" | "year"; genres: string[]; avoid: string[]; skipIn: boolean; noTeasers: boolean; smaller: boolean; count: number };
const LENGTHS: { id: AiPrefs["length"]; name: string; min: number; max: number }[] = [
  { id: "any", name: "Any length", min: 0, max: Infinity }, { id: "short", name: "Under 20 min", min: 0, max: 1200 },
  { id: "mid", name: "20–45 min", min: 1200, max: 2700 }, { id: "long", name: "45–90 min", min: 2700, max: 5400 }, { id: "xl", name: "90 min +", min: 5400, max: Infinity },
];
const SINCE: { id: AiPrefs["since"]; name: string; days: number }[] = [{ id: "any", name: "Any time", days: Infinity }, { id: "week", name: "Past week", days: 7 }, { id: "month", name: "Past month", days: 31 }, { id: "year", name: "Past year", days: 366 }];
const defaultPrefs = (m: PodMode): AiPrefs => ({ prompt: "", length: "any", since: "any", genres: [], avoid: [], skipIn: true, noTeasers: true, smaller: false, count: 10 });
type Found = { ep: PodEpisode; show: PodShow; why: string };

function AiFinderPanel({ mode, api, ex, update, say, onClose }: { mode: PodMode; api: Api; ex: string; update: Update; say: (m: string) => void; onClose: () => void }) {
  const key = `podscroll.ai.${mode.id}`;
  const [p, setP] = useState<AiPrefs>(() => { try { return { ...defaultPrefs(mode), ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch { return defaultPrefs(mode); } });
  const set = (x: Partial<AiPrefs>) => setP((o) => { const n = { ...o, ...x }; try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* private window */ } return n; });
  const [more, setMore] = useState(false);
  const [avoidText, setAvoidText] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Found[] | null>(null);
  const [note, setNote] = useState("");
  const inMode = (id: string) => mode.episodes.some((e) => e.id === id);

  const fits = (ep: PodEpisode, show: PodShow) => {
    const len = LENGTHS.find((l) => l.id === p.length)!; const since = SINCE.find((x) => x.id === p.since)!;
    if (!/^https:\/\//i.test(ep.audio || "")) return false;
    if (ep.secs && (ep.secs < len.min || ep.secs > len.max)) return false;
    if (since.days !== Infinity) { const d = (Date.now() - Date.parse(ep.date)) / 86_400_000; if (!Number.isFinite(d) || d > since.days) return false; }
    if (p.noTeasers && isTeaser(ep)) return false;
    if (p.skipIn && inMode(ep.id)) return false;
    const hay = `${show.name} ${show.author} ${ep.title} ${ep.about}`.toLowerCase();
    if (p.avoid.some((w) => w && hay.includes(w.toLowerCase()))) return false;
    if (p.genres.length && show.genre && !p.genres.includes(show.genre) && show.appleGenre) {
      const names = p.genres.flatMap((g) => GENRE[g]?.apple ?? []);
      if (!names.includes(show.appleGenre)) return false;
    }
    return true;
  };

  // Candidates beyond what's shown wait here; adding one slides the next one into its place.
  const reserve = useRef<Found[]>([]);
  const shownIds = useRef(new Set<string>());
  const rounds = useRef(0);
  const take = (n: number) => { const out: Found[] = []; while (out.length < n && reserve.current.length) { const f = reserve.current.shift()!; if (!shownIds.current.has(f.ep.id) && !inMode(f.ep.id)) { shownIds.current.add(f.ep.id); out.push(f); } } return out; };
  const offer = (list: Found[]) => {
    const perShow = new Map<string, number>();
    for (const f of [...reserve.current]) perShow.set(f.show.id, (perShow.get(f.show.id) ?? 0) + 1);
    for (const f of list) {
      if (shownIds.current.has(f.ep.id) || reserve.current.some((x) => x.ep.id === f.ep.id)) continue;
      const n = perShow.get(f.show.id) ?? 0; if (n >= 2) continue; // variety: at most two from one show
      perShow.set(f.show.id, n + 1); reserve.current.push(f);
    }
  };
  const fill = () => setFound((cur) => { const have = cur ?? []; const need = Math.max(0, p.count - have.length); return need ? [...have, ...take(need)] : have; });

  const run = async () => {
    setBusy(true); setNote("");
    if (found) setFound((cur) => (cur ?? []).filter((f) => !inMode(f.ep.id)));
    else { setFound([]); reserve.current = []; shownIds.current = new Set(); }
    const len = LENGTHS.find((l) => l.id === p.length)!;
    const topicWords = p.genres.map((g) => GENRE[g]?.name).filter(Boolean).join(" ");
    // Each new search words it a little differently, so "Find more" turns up new episodes.
    const round = rounds.current++;
    const twist = ["", " episode", " conversation", " explained", " interview", " stories", " deep dive", " news"][round % 8];
    const searchQ = `${(p.prompt.trim() || mode.name).slice(0, 60)}${twist}`;
    const q = [
      p.prompt.trim() || `Podcast episodes for ${mode.name}`,
      topicWords ? `Topics: ${topicWords}.` : "",
      len.id !== "any" ? `Episodes ${len.name.toLowerCase()}.` : "",
      p.avoid.length ? `Do not include anything about: ${p.avoid.join(", ")}.` : "",
      p.smaller ? "Prefer smaller, independent shows over the biggest ones." : "",
    ].filter(Boolean).join(" ").slice(0, 390);
    const asShow = (e: PodEpisode): PodShow => ({ id: e.showId, name: e.show, author: e.author, art: e.art, genre: "", appleGenre: "", link: "", episodes: 0, explicit: e.explicit, latest: e.date });
    const avoidShow = (sh: PodShow) => p.avoid.some((w) => w && `${sh.name} ${sh.author}`.toLowerCase().includes(w.toLowerCase()));
    // Both at once: a plain episode search (fast, ready to play) and the AI's picks.
    const searchJob = Promise.all([searchQ, topicWords ? `${searchQ} ${topicWords}` : ""].filter(Boolean).map((t) => api(`/api/earshot/search?q=${encodeURIComponent(t)}${ex}`).catch(() => null)))
      .then((rs) => { const eps: PodEpisode[] = rs.flatMap((r) => (r?.episodes || []) as PodEpisode[]); offer(eps.filter((e) => !avoidShow(asShow(e)) && fits(e, asShow(e))).map((e) => ({ ep: e, show: asShow(e), why: "Matches what you asked for" }))); fill(); });
    const aiJob = api("/api/earshot/ai-find", { method: "POST", body: { q } }).then(async (b) => {
      if (b && b.ai === false) setNote("AI isn't available right now, so these come from a search for your words.");
      let picks: { show: PodShow; why: string; episode: PodEpisode | null }[] = Array.isArray(b?.picks) ? b.picks : [];
      if (p.smaller) picks = picks.slice().sort((a, c) => (a.show.episodes || 0) - (c.show.episodes || 0));
      picks = picks.filter((x) => !avoidShow(x.show));
      const ready = picks.filter((x) => x.episode && fits(x.episode, x.show));
      // AI picks go to the front: they're the closest to what was asked.
      const aiFound = ready.map((x) => ({ ep: { ...x.episode!, art: x.episode!.art || x.show.art }, show: x.show, why: x.why }));
      reserve.current = [...aiFound.filter((f) => !shownIds.current.has(f.ep.id)), ...reserve.current.filter((f) => !aiFound.some((a) => a.ep.id === f.ep.id))];
      fill();
      // A few of the AI's shows whose suggested episode didn't fit: look for one that does, all at once.
      const rest = picks.filter((x) => !(x.episode && fits(x.episode, x.show))).slice(0, 5);
      const more = await Promise.all(rest.map((x) => api(`/api/earshot/show/${x.show.id}?x=1${ex}`).then((r) => {
        const ep = ((r.episodes || []) as PodEpisode[]).map((e) => ({ ...e, art: e.art || x.show.art })).find((e) => fits(e, x.show));
        return ep ? { ep, show: x.show, why: x.why } : null;
      }).catch(() => null)));
      offer(more.filter((x): x is Found => !!x)); fill();
    }).catch(() => {});
    await Promise.all([searchJob, aiJob]);
    setBusy(false);
  };

  const add = (list: Found[]) => {
    update((e) => ({ ...e, modes: e.modes.map((m) => {
      if (m.id !== mode.id) return m;
      const have = new Set(m.episodes.map((x) => x.id));
      return { ...m, episodes: [...m.episodes, ...list.filter((f) => !have.has(f.ep.id)).map((f) => toSaved(f.ep))].slice(0, EARSHOT_LIMITS.modeEpisodes) };
    }) }));
    say(list.length === 1 ? `Added to ${mode.name}.` : `Added ${list.length} episodes to ${mode.name}.`);
    // Each added episode's spot gets the next suggestion.
    const gone = new Set(list.map((f) => f.ep.id));
    setFound((cur) => { const kept = (cur ?? []).filter((f) => !gone.has(f.ep.id)); const fresh = take(Math.max(0, p.count - kept.length)); return [...kept, ...fresh]; });
  };
  const addAvoid = () => { const w = avoidText.replace(/\s+/g, " ").trim().slice(0, 40); if (w && !p.avoid.includes(w)) set({ avoid: [...p.avoid, w].slice(0, 20) }); setAvoidText(""); };
  const chip = (on: boolean) => `h-9 rounded-full px-3.5 text-sm ${on ? "bg-[#0f0f0f] text-white" : "bg-[#f2f2f2] hover:bg-[#e5e5e5]"}`;
  const label = "mt-4 text-[12px] font-semibold uppercase tracking-[.14em] text-[#767676]";

  return <section aria-label="Find with AI" className="mt-4 rounded-2xl border border-[#e5e5e5] p-5">
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Sparkles size={17} />Find with AI</h2>
      <button onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><X size={18} /></button>
    </div>
    <label htmlFor={`ps-ai-${mode.id}`} className="mt-3 block text-sm text-[#606060]">Describe what belongs in {mode.name}.</label>
    <textarea id={`ps-ai-${mode.id}`} value={p.prompt} onChange={(e) => set({ prompt: e.target.value.slice(0, 300) })} rows={2} placeholder={`e.g. Calm, slow conversations about history, nothing too intense`} className="mt-2 w-full resize-none rounded-xl border border-[#d3d3d3] p-3 text-base outline-none focus:border-[#1c62b9]" />

    <p className={label}>Length</p>
    <div className="mt-2 flex flex-wrap gap-2">{LENGTHS.map((l) => <button key={l.id} onClick={() => set({ length: l.id })} aria-pressed={p.length === l.id} className={chip(p.length === l.id)}>{l.name}</button>)}</div>

    <p className={label}>Don't include</p>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {p.avoid.map((w) => <span key={w} className="inline-flex h-9 items-center gap-1 rounded-full bg-[#fef3f2] pl-3.5 pr-1 text-sm text-[#b42318]">{w}<button onClick={() => set({ avoid: p.avoid.filter((x) => x !== w) })} aria-label={`Allow ${w} again`} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#fee4e2]"><X size={14} /></button></span>)}
      <form onSubmit={(e) => { e.preventDefault(); addAvoid(); }} className="flex items-center gap-1">
        <label htmlFor={`ps-avoid-${mode.id}`} className="sr-only">Something to leave out</label>
        <input id={`ps-avoid-${mode.id}`} value={avoidText} onChange={(e) => setAvoidText(e.target.value)} placeholder="A topic, word or show" className="h-9 w-44 rounded-full border border-[#d3d3d3] px-3.5 text-sm outline-none focus:border-[#1c62b9]" />
        <button type="submit" disabled={!avoidText.trim()} className="h-9 rounded-full bg-[#f2f2f2] px-3 text-sm font-medium disabled:opacity-40">Add</button>
      </form>
    </div>

    <button onClick={() => setMore((v) => !v)} aria-expanded={more} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#065fd4]"><SlidersHorizontal size={15} />{more ? "Fewer filters" : "More filters"}</button>
    {more && <div>
      <p className={label}>Released</p>
      <div className="mt-2 flex flex-wrap gap-2">{SINCE.map((x) => <button key={x.id} onClick={() => set({ since: x.id })} aria-pressed={p.since === x.id} className={chip(p.since === x.id)}>{x.name}</button>)}</div>
      <p className={label}>Only these topics</p>
      <div className="mt-2 flex flex-wrap gap-2">{GENRES.map((g) => { const on = p.genres.includes(g.id); return <button key={g.id} onClick={() => set({ genres: on ? p.genres.filter((x) => x !== g.id) : [...p.genres, g.id] })} aria-pressed={on} className={chip(on)}>{g.name}</button>; })}</div>
      <p className={label}>How many</p>
      <div className="mt-2 flex flex-wrap gap-2">{[5, 10, 20].map((n) => <button key={n} onClick={() => set({ count: n })} aria-pressed={p.count === n} className={chip(p.count === n)}>{n} episodes</button>)}</div>
      <div className="mt-4 flex flex-col gap-2">
        {([["skipIn", "Skip episodes already in this mode"], ["noTeasers", "No trailers or short previews"], ["smaller", "Prefer smaller, independent shows"]] as [keyof AiPrefs, string][]).map(([k, t]) =>
          <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={!!p[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<AiPrefs>)} className="h-5 w-5 accent-[#0f0f0f]" />{t}</label>)}
      </div>
    </div>}

    <div className="mt-5 flex flex-wrap gap-2">
      <button onClick={() => { if (found && reserve.current.length) setFound((cur) => [...(cur ?? []), ...take(p.count)]); else void run(); }} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0f0f0f] px-6 text-[15px] font-semibold text-white disabled:opacity-60">{busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}{busy ? "Finding…" : found ? "Find more" : "Find episodes"}</button>
      {found && found.length > 0 && <button onClick={() => add(found)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#f2f2f2] px-5 text-[15px] font-medium hover:bg-[#e5e5e5]"><Plus size={17} />Add all {found.length}</button>}
    </div>
    {note && <p className="mt-3 text-xs text-[#767676]">{note}</p>}
    {found && !found.length && !busy && <p className="mt-4 text-sm text-[#606060]">{shownIds.current.size ? "You added them all. Tap Find more for new ones." : "Nothing fit those filters. Loosen one (length or released) and try again."}</p>}
    {found && found.length > 0 && <ul className="mt-4 divide-y divide-[#ececec]">
      {found.map((f) => { const added = inMode(f.ep.id); return <li key={f.ep.id} className="flex items-center gap-3 py-2.5">
        <img src={hiRes(f.ep.art, 120)} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold">{f.ep.title}</p>
          <p className="truncate text-xs text-[#606060]">{f.show.name}{f.ep.secs ? ` · ${mins(f.ep.secs)}` : ""}</p>
          {f.why && <p className="line-clamp-1 text-xs text-[#767676]">{f.why}</p>}
        </div>
        <button onClick={() => add([f])} disabled={added} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#f2f2f2] px-3.5 text-sm font-medium disabled:bg-transparent disabled:text-[#606060]">{added ? <><Check size={15} />Added</> : <><Plus size={15} />Add</>}</button>
      </li>; })}
    </ul>}
  </section>;
}
