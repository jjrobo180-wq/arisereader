// Pod Modes (hubs) on the Pod+ home page: a row of them, a page for each with its own look
// (page color, accent and typeface, set by the listener), and the "Add to" menu that opens from an
// episode card's ⋮ button or a press-and-hold. Modes are the same saved lists the swipe feed uses.
import { useMemo, useState } from "react";
import {
  EARSHOT_LIMITS, HUB_ACCENTS, HUB_BACKGROUNDS, HUB_FONTS, MODE_ICONS, hiRes, hubTheme, inkOn,
  type Earshot, type HubFont, type HubTheme, type PodEpisode, type PodMode, type SavedEpisode,
} from "@shared/earshot";
import { ModeIcon } from "../client/src/components/family-hub/earshot/EarshotExtras";
import { ArrowUp, Bookmark, Check, ChevronLeft, Palette, Play, Plus, RotateCcw, Shuffle, Trash2, X } from "lucide-react";

type Update = (fn: (e: Earshot) => Earshot) => void;

export const toSaved = (e: PodEpisode): SavedEpisode => ({ id: e.id, showId: e.showId, title: e.title, show: e.show, art: e.art, secs: e.secs, at: new Date().toISOString(), audio: e.audio, date: e.date });
const mins = (s: number) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`; };
const newModeId = (name: string) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16) || "mode"}-${Math.random().toString(36).slice(2, 6)}`;

/** The row of Pod Modes on the home page. */
export function ModesRow({ es, onOpen, onNew }: { es: Earshot; onOpen: (m: PodMode) => void; onNew: () => void }) {
  return <section aria-label="Pod Modes" className="mb-6">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-base font-semibold">Pod Modes</h2>
      <span className="text-xs text-[#606060]">Hold any episode, or tap its ⋮, to add it</span>
    </div>
    <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {es.modes.map((m) => {
        const th = hubTheme(m); const ink = inkOn(th.bg); const font = HUB_FONTS[th.font];
        return <button key={m.id} onClick={() => onOpen(m)} className="relative flex h-[132px] w-[168px] shrink-0 flex-col justify-between overflow-hidden rounded-xl p-3 text-left transition-transform hover:-translate-y-0.5" style={{ background: th.bg, color: ink, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06)" }}>
          <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: th.accent, color: inkOn(th.accent) }}><ModeIcon m={m} size={15} /></span>
          <span className="relative">
            <span className="block truncate text-[19px] leading-tight" style={{ fontFamily: font.stack, fontWeight: font.weight, letterSpacing: font.tracking }}>{m.name}</span>
            <span className="block text-xs opacity-60">{m.episodes.length ? `${m.episodes.length} episode${m.episodes.length === 1 ? "" : "s"}` : "Empty"}</span>
          </span>
          {m.episodes.length > 0 && <span className="absolute right-2 top-2 flex -space-x-2.5">{m.episodes.slice(0, 3).map((e, i) => <img key={i} src={hiRes(e.art, 80)} alt="" className="h-7 w-7 rounded-md object-cover" style={{ boxShadow: `0 0 0 2px ${th.bg}` }} />)}</span>}
        </button>;
      })}
      <button onClick={onNew} className="flex h-[132px] w-[120px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#c4c4c4] text-sm font-medium text-[#606060] hover:bg-[#f7f7f5]"><Plus size={20} />New mode</button>
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
export function AddToMenu({ es, ep, update, say, onClose }: { es: Earshot; ep: PodEpisode; update: Update; say: (m: string) => void; onClose: () => void }) {
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
export function ModePage({ es, id, update, say, onPlay, onBack }: { es: Earshot; id: string; update: Update; say: (m: string) => void; onPlay: (index: number, shuffle?: boolean) => void; onBack: () => void }) {
  const mode = es.modes.find((m) => m.id === id);
  const [editing, setEditing] = useState(false);
  const [rename, setRename] = useState<string | null>(null);
  const th = useMemo(() => (mode ? hubTheme(mode) : null), [mode]);
  if (!mode || !th) return <div className="px-6 py-24 text-center text-[#606060]">That Pod Mode is gone. <button onClick={onBack} className="font-semibold underline">Back home</button></div>;
  const ink = inkOn(th.bg); const font = HUB_FONTS[th.font];
  const builtIn = ["sleep", "commute", "workout", "focus", "learn", "chores"].includes(mode.id);
  const setTheme = (t: Partial<HubTheme> | null) => update((e) => ({ ...e, modes: e.modes.map((m) => (m.id !== mode.id ? m : t === null ? { ...m, theme: undefined } : { ...m, theme: { ...hubTheme(m), ...t } })) }));
  const remove = (eid: string) => update((e) => ({ ...e, modes: e.modes.map((m) => (m.id === mode.id ? { ...m, episodes: m.episodes.filter((x) => x.id !== eid) } : m)) }));
  const moveUp = (i: number) => update((e) => ({ ...e, modes: e.modes.map((m) => { if (m.id !== mode.id || i < 1) return m; const l = m.episodes.slice(); [l[i - 1], l[i]] = [l[i], l[i - 1]]; return { ...m, episodes: l }; }) }));
  const saveName = () => { const n = (rename || "").replace(/\s+/g, " ").trim().slice(0, 30); if (n) update((e) => ({ ...e, modes: e.modes.map((m) => (m.id === mode.id ? { ...m, name: n } : m)) })); setRename(null); };
  const del = () => { update((e) => ({ ...e, modes: e.modes.filter((m) => m.id !== mode.id) })); say(`Deleted “${mode.name}”.`); onBack(); };
  const total = mode.episodes.reduce((a, e) => a + (e.secs || 0), 0);

  return <div className="min-h-[calc(100vh-56px)]" style={{ background: th.bg, color: ink }}>
    <div className="mx-auto max-w-[960px] px-4 pb-20 pt-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} aria-label="Back" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/10"><ChevronLeft size={22} /></button>
        <button onClick={() => setEditing((v) => !v)} aria-expanded={editing} className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium" style={{ boxShadow: `inset 0 0 0 1px ${ink}40` }}><Palette size={16} />Customize</button>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-5">
        <span className="grid h-16 w-16 place-items-center rounded-full" style={{ background: th.accent, color: inkOn(th.accent) }}><ModeIcon m={mode} size={28} /></span>
        <div className="min-w-0 flex-1">
          {rename !== null
            ? <form onSubmit={(e) => { e.preventDefault(); saveName(); }} className="flex gap-2"><label htmlFor="ps-mode-name" className="sr-only">Name</label><input id="ps-mode-name" autoFocus value={rename} onChange={(e) => setRename(e.target.value)} onBlur={saveName} maxLength={30} className="h-12 min-w-0 flex-1 rounded-lg bg-black/10 px-3 text-2xl outline-none" style={{ fontFamily: font.stack, fontWeight: font.weight, color: ink }} /></form>
            : <h1 className="text-[40px] leading-[1.05] sm:text-[56px]" style={{ fontFamily: font.stack, fontWeight: font.weight, letterSpacing: font.tracking }}>
              <button onClick={() => setRename(mode.name)} className="text-left" title="Rename">{mode.name}</button>
            </h1>}
          <p className="mt-2 text-sm opacity-65">{mode.episodes.length} episode{mode.episodes.length === 1 ? "" : "s"}{total ? ` · ${mins(total)}` : ""}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button disabled={!mode.episodes.length} onClick={() => onPlay(0)} className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold disabled:opacity-40" style={{ background: th.accent, color: inkOn(th.accent) }}><Play size={18} fill="currentColor" />Play all</button>
        <button disabled={mode.episodes.length < 2} onClick={() => onPlay(0, true)} className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-medium disabled:opacity-40" style={{ boxShadow: `inset 0 0 0 1px ${ink}40` }}><Shuffle size={17} />Shuffle</button>
      </div>

      {editing && <section aria-label="Customize this mode" className="mt-6 rounded-2xl bg-white p-5 text-[#0f0f0f] shadow-[0_10px_40px_rgba(0,0,0,.18)]">
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

      <ol className="mt-8 flex flex-col">
        {!mode.episodes.length && <li className="rounded-xl px-4 py-10 text-center text-sm opacity-70">Nothing here yet. On the home page, hold any episode or tap its ⋮, then pick “{mode.name}”.</li>}
        {mode.episodes.map((e, i) => <li key={e.id} className="group grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-xl p-2 hover:bg-black/[.06]" style={{ borderTop: i ? `1px solid ${ink}14` : undefined }}>
          <button onClick={() => onPlay(i)} aria-label={`Play ${e.title}`}><img src={hiRes(e.art, 120)} alt="" className="h-14 w-14 rounded-md object-cover" /></button>
          <button onClick={() => onPlay(i)} className="min-w-0 text-left">
            <span className="line-clamp-1 text-[15px] font-semibold">{e.title}</span>
            <span className="line-clamp-1 text-xs opacity-60">{e.show}{e.secs ? ` · ${mins(e.secs)}` : ""}</span>
          </button>
          <span className="flex gap-1">
            <button onClick={() => moveUp(i)} disabled={i === 0} aria-label="Move up" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-30"><ArrowUp size={16} /></button>
            <button onClick={() => remove(e.id)} aria-label={`Remove ${e.title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/10"><X size={16} /></button>
          </span>
        </li>)}
      </ol>
      {!builtIn && <button onClick={del} className="mt-10 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium opacity-80 hover:opacity-100" style={{ boxShadow: `inset 0 0 0 1px ${ink}33` }}><Trash2 size={15} />Delete this mode</button>}
    </div>
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
