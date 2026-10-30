// Earshot/Podscroll: the show page (episodes like a streaming app, played back to back), Pod Modes
// (Sleep, Commute... playlists), "Add to", and the AI podcast finder. Shared by both apps, so it
// imports nothing from the Arise app itself.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUp, BookOpen, Bookmark, Car, Check, ChevronLeft, ChevronRight, Download, Dumbbell, Headphones, ListPlus, Loader2, Moon, Newspaper, Play, Plus, Shirt, Sparkles, Trash2, X, type LucideIcon } from "lucide-react";
import { episodeKey, useOfflineAudio } from "./offlineAudio";
import {
  DEFAULT_MODES, GENRE, HUB_FONTS, MODE_ICONS, clock, durationWords, hiRes, hubTheme, inkOn, realEpisodes,
  type Earshot as EarshotData, type PodEpisode, type PodMode, type PodShow, type SavedEpisode,
} from "@shared/earshot";

const ACCENT = "#ff8a3d";
const agoWords = (iso: string) => {
  const d = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(d)) return "";
  if (d < 3600) return "Just out"; if (d < 86400) return `${Math.floor(d / 3600)}h ago`; if (d < 86400 * 7) return `${Math.floor(d / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: d > 86400 * 300 ? "numeric" : undefined });
};
type Spot = { t: number; secs: number };

// ===========================================================================
// The show page: big art, then every episode in a list; play any one and the rest follow
// ===========================================================================
export function ShowPage({ show, load, hideTeasers = true, following, onFollow, onPlayFrom, onClose, adFree, onAdFree, spots, onAddTo, onGenre }: {
  show: PodShow; load: (id: string) => Promise<{ show: PodShow | null; episodes: PodEpisode[] }>; following: boolean; onFollow: (s: PodShow) => void;
  onPlayFrom: (show: PodShow, list: PodEpisode[], index: number) => void; onClose: () => void; adFree: boolean; onAdFree: (on: boolean) => void;
  spots: Record<string, Spot>; onAddTo: (ep: PodEpisode) => void; onGenre: (g: string) => void; hideTeasers?: boolean;
}) {
  const [eps, setEps] = useState<PodEpisode[] | null>(null);
  const [full, setFull] = useState<PodShow>(show);
  const [err, setErr] = useState("");
  const [oldest, setOldest] = useState(false);
  useEffect(() => { load(show.id).then((r) => { setEps(r.episodes); if (r.show) setFull({ ...r.show, genre: r.show.genre || show.genre }); }).catch((e) => setErr(e?.message || "This show didn't load.")); }, [show.id, load, show.genre]);
  const list = useMemo(() => { const real = eps ? realEpisodes(eps, hideTeasers) : []; return oldest ? real.slice().reverse() : real; }, [eps, oldest, hideTeasers]);
  const resumeAt = list.findIndex((e) => spots[e.id]);
  const art = hiRes(full.art);
  return <div className="absolute inset-0 z-40 overflow-y-auto bg-[#0e0d10] text-white [scrollbar-width:none]" role="dialog" aria-label={full.name}>
    <div className="relative">
      <div className="absolute inset-0 overflow-hidden"><div className="absolute -inset-[20%] bg-cover bg-center opacity-30 blur-3xl" style={{ backgroundImage: `url("${art}")` }} /><div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0e0d10]" /></div>
      <div className="relative flex flex-col items-center px-5 pb-6 pt-[calc(env(safe-area-inset-top,0px)+4rem)] text-center">
        <button type="button" onClick={onClose} aria-label="Back" className="absolute left-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10"><ChevronLeft size={22} /></button>
        <img src={art} alt={`${full.name} cover art`} referrerPolicy="no-referrer" className="aspect-square w-[min(72vw,320px)] rounded-2xl object-cover shadow-[0_24px_50px_-20px_rgba(0,0,0,.9)]" />
        <h2 className="mt-6 text-[22px] font-semibold leading-tight tracking-tight">{full.name}</h2>
        <p className="mt-1 text-sm text-white/45">{[full.author, eps?.length ? `${eps.length} episodes` : ""].filter(Boolean).join(" · ")}</p>
        <div className="mt-5 flex w-full max-w-xs gap-2">
          <button type="button" disabled={!list.length} onClick={() => onPlayFrom(full, list, Math.max(0, resumeAt))} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-[#0e0d10] disabled:opacity-40"><Play size={15} fill="currentColor" />{resumeAt >= 0 ? "Resume" : oldest ? "Play first" : "Play latest"}</button>
          <button type="button" onClick={() => onFollow(full)} aria-label={following ? "Unfollow" : "Follow"} className={`grid min-h-11 min-w-11 place-items-center rounded-full ring-1 ${following ? "text-white ring-white/30" : "text-white/80 ring-white/15"}`}>{following ? <Check size={17} /> : <Plus size={17} />}</button>
        </div>
      </div>
    </div>
    <div className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+3rem)]">
      <div className="flex items-center justify-between border-b border-white/[.06] pb-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-[.14em] text-white/45">Episodes</h3>
        <button type="button" onClick={() => setOldest((o) => !o)} className="text-xs text-white/45">{oldest ? "Oldest first" : "Newest first"}</button>
      </div>
      {!eps && !err && <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-white/40" /></div>}
      {err && <p className="py-8 text-center text-sm text-white/50">{err}</p>}
      {eps && !eps.length && <p className="py-8 text-center text-sm text-white/50">No playable episodes right now.</p>}
      <ol className="divide-y divide-white/[.06]">
        {list.map((e, i) => {
          const spot = spots[e.id]; const pct = spot && e.secs ? Math.min(100, (spot.t / e.secs) * 100) : 0;
          const left = spot && e.secs ? Math.max(0, e.secs - spot.t) : 0;
          return <li key={e.id} className="py-4">
            <button type="button" onClick={() => onPlayFrom(full, list, i)} className="block w-full text-left">
              <span className="block text-[11px] text-white/35">{e.date ? agoWords(e.date) : ""}</span>
              <span className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-white/90">{e.title}</span>
              {e.about && <span className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/40">{e.about}</span>}
            </button>
            <div className="mt-2.5 flex items-center gap-3">
              <button type="button" onClick={() => onPlayFrom(full, list, i)} aria-label={`Play ${e.title}`} className="flex items-center gap-2 rounded-full bg-white/[.07] py-1.5 pl-2 pr-3 text-xs font-medium text-white/80">
                <Play size={12} fill="currentColor" />
                {pct > 0 ? <><span className="relative h-1 w-10 overflow-hidden rounded-full bg-white/20"><span className="absolute inset-y-0 left-0 bg-white" style={{ width: `${pct}%` }} /></span>{durationWords(left)} left</> : (e.secs ? durationWords(e.secs) : "Play")}
              </button>
              <button type="button" onClick={() => onAddTo(e)} aria-label={`Add ${e.title} to a mode`} className="ml-auto grid h-8 w-8 place-items-center rounded-full text-white/40 hover:text-white/80"><ListPlus size={17} strokeWidth={1.7} /></button>
            </div>
          </li>;
        })}
      </ol>
      <button type="button" role="switch" aria-checked={adFree} onClick={() => onAdFree(!adFree)} className="mt-6 flex w-full items-center justify-between gap-3 border-t border-white/[.06] pt-4 text-left">
        <span><span className="block text-sm text-white/80">Support this show</span><span className="block text-xs text-white/35">{adFree ? "Its ads play in full." : "Never skip this show's ads."}</span></span>
        <span className={`relative h-6 w-10 flex-none rounded-full transition ${adFree ? "bg-white" : "bg-white/15"}`}><span className={`absolute top-1 h-4 w-4 rounded-full transition ${adFree ? "left-5 bg-[#0e0d10]" : "left-1 bg-white"}`} /></span>
      </button>
    </div>
  </div>;
}

// ===========================================================================
// Add to: the Library and any Pod Modes
// ===========================================================================
export function AddToSheet({ es, ep, saved, onSave, update, say, onClose, toSaved }: {
  es: EarshotData; ep: PodEpisode; saved: boolean; onSave: () => void; update: (fn: (e: EarshotData) => EarshotData) => void; say: (m: string) => void; onClose: () => void; toSaved: (ep: PodEpisode) => SavedEpisode;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const offline = useOfflineAudio();
  const dl = offline?.state(episodeKey(ep.id));
  const downloadRow = offline && ep.audio ? <Toggle on={dl?.status === "saved"}
    onClick={() => { if (dl?.status === "saved" || dl?.status === "saving") void offline.remove(episodeKey(ep.id)).then(() => say(dl.status === "saved" ? "Download removed." : "Download stopped.")); else void offline.saveEpisode(toSaved(ep)); }}
    icon={dl?.status === "saving" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={1.8} />}
    title={dl?.status === "saved" ? "Downloaded" : dl?.status === "saving" ? `Downloading… ${Math.round(dl.pct * 100)}%` : "Download"}
    sub={dl?.status === "saved" ? "Plays without a connection · tap to remove" : dl?.status === "saving" ? "Tap to stop" : dl?.status === "error" ? dl.error || "Try again" : "Pod+ Membership · listen offline"} /> : null;
  const inMode = (m: PodMode) => m.episodes.some((x) => x.id === ep.id);
  const toggle = (id: string) => update((e) => ({ ...e, modes: e.modes.map((m) => (m.id !== id ? m : inMode(m) ? { ...m, episodes: m.episodes.filter((x) => x.id !== ep.id) } : { ...m, episodes: [toSaved(ep), ...m.episodes].slice(0, 150) })) }));
  const allIn = es.modes.every(inMode);
  const all = () => { update((e) => ({ ...e, modes: e.modes.map((m) => (allIn ? { ...m, episodes: m.episodes.filter((x) => x.id !== ep.id) } : inMode(m) ? m : { ...m, episodes: [toSaved(ep), ...m.episodes].slice(0, 150) })) })); say(allIn ? "Removed from every mode." : "Added to every mode."); };
  const create = () => {
    const n = name.replace(/\s+/g, " ").trim().slice(0, 30); if (!n) return;
    const id = `${n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16) || "mode"}-${Math.random().toString(36).slice(2, 6)}`;
    update((e) => ({ ...e, modes: [...e.modes, { id, name: n, icon: MODE_ICONS[0], episodes: [toSaved(ep)] }].slice(0, 24) }));
    setNaming(false); setName(""); say(`Made “${n}” and added this episode.`);
  };
  return <Sheet title="Add to" onClose={onClose}>
    <div className="overflow-y-auto px-4 pb-5">
      <div className="flex items-center gap-3 border-b border-white/[.07] pb-3"><img src={hiRes(ep.art, 200)} alt="" referrerPolicy="no-referrer" className="h-11 w-11 rounded-md object-cover" /><span className="min-w-0"><span className="line-clamp-1 text-sm font-semibold">{ep.title}</span><span className="line-clamp-1 text-xs text-white/50">{ep.show}</span></span></div>
      <div className="mt-1 divide-y divide-white/[.06]">
        <Toggle on={saved} onClick={onSave} icon={<Bookmark size={16} strokeWidth={1.8} />} title="Listen later" sub="In your Library" />
        {downloadRow}
      </div>
      <div className="mt-5 flex items-baseline justify-between"><h4 className="text-[12px] font-semibold uppercase tracking-[.14em] text-white/45">Pod Modes</h4><button type="button" onClick={all} className="text-xs font-medium text-white/60 hover:text-white">{allIn ? "Remove from all" : "Add to all"}</button></div>
      <div className="mt-1 divide-y divide-white/[.06]">
        {es.modes.map((m) => { const th = hubTheme(m); return <Toggle key={m.id} on={inMode(m)} onClick={() => toggle(m.id)} icon={<span className="grid h-full w-full place-items-center rounded-full" style={{ background: th.bg, color: inkOn(th.bg) }}><ModeIcon m={m} size={15} /></span>} title={m.name} sub={`${m.episodes.length} episode${m.episodes.length === 1 ? "" : "s"}`} />; })}
      </div>
      {naming ? <div className="mt-3 flex gap-2">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") setNaming(false); }} maxLength={30} placeholder="Name it: Road trip, Bedtime…" aria-label="New mode name" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-base outline-none focus:border-white/40" />
        <button type="button" onClick={create} disabled={!name.trim()} className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-[#111013] disabled:opacity-40">Add</button>
      </div> : <button type="button" onClick={() => setNaming(true)} className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-sm font-medium text-white/70 hover:text-white"><span className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-white/15"><Plus size={16} /></span>New mode</button>}
    </div>
  </Sheet>;
}
function Toggle({ on, onClick, icon, title, sub }: { on: boolean; onClick: () => void; icon: ReactNode; title: string; sub: string }) {
  return <button type="button" role="checkbox" aria-checked={on} onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left">
    <span className="grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-full bg-white/[.07] text-white/80">{icon}</span>
    <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium">{title}</span><span className="block text-xs text-white/45">{sub}</span></span>
    <span className={`grid h-6 w-6 flex-none place-items-center rounded-full transition ${on ? "bg-white text-[#111013]" : "ring-1 ring-white/25"}`}>{on && <Check size={14} strokeWidth={2.5} />}</span>
  </button>;
}

// ===========================================================================
// Pod Modes in the Library: a card per mode; open one to play it back to back
// ===========================================================================
/** The built-in modes get fine line icons; ones people make get their first letter (no emoji). */
const MODE_LINE: Record<string, LucideIcon> = { briefing: Newspaper, sleep: Moon, commute: Car, workout: Dumbbell, focus: Headphones, learn: BookOpen, chores: Shirt };
export function ModeIcon({ m, size = 18 }: { m: { id: string; name: string }; size?: number }) {
  const I = MODE_LINE[m.id];
  return I ? <I size={size} strokeWidth={1.7} /> : <span style={{ fontSize: Math.round(size * 0.9) }} className="font-semibold leading-none">{(m.name.trim()[0] || "•").toUpperCase()}</span>;
}

export function ModesHub({ es, onOpen }: { es: EarshotData; onOpen: (m: PodMode) => void }) {
  return <section className="mt-8">
    <div className="flex items-baseline justify-between">
      <h3 className="text-[13px] font-semibold uppercase tracking-[.14em] text-white/45">Pod Modes</h3>
      <span className="text-[11px] text-white/30">Add with Save or +</span>
    </div>
    <div className="mt-3 overflow-hidden rounded-2xl bg-white/[.03] ring-1 ring-white/[.06]">
      {es.modes.map((m, i) => {
        const arts = m.episodes.slice(0, 3).map((e) => e.art);
        const blurb = DEFAULT_MODES.find((d) => d.id === m.id)?.blurb ?? "Your mode";
        return <button key={m.id} type="button" onClick={() => onOpen(m)} className={`flex min-h-[64px] w-full items-center gap-3.5 px-4 py-3 text-left transition active:bg-white/[.04] ${i ? "border-t border-white/[.06]" : ""}`}>
          {(() => { const th = hubTheme(m); return <span className="grid h-9 w-9 flex-none place-items-center rounded-full" style={{ background: th.bg, color: inkOn(th.bg), boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}><ModeIcon m={m} /></span>; })()}
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold tracking-tight text-white/90">{m.name}</span>
            <span className="block truncate text-xs text-white/40">{m.episodes.length ? `${m.episodes.length} episode${m.episodes.length === 1 ? "" : "s"}` : blurb}</span>
          </span>
          {arts.length > 0 && <span className="flex flex-none -space-x-3">{arts.map((a, j) => <img key={j} src={hiRes(a, 120)} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-md object-cover ring-2 ring-[#111013]" />)}</span>}
          <ChevronRight size={16} className="flex-none text-white/25" />
        </button>;
      })}
    </div>
  </section>;
}

export function ModeView({ mode, update, onPlay, onClose }: { mode: PodMode; update: (fn: (e: EarshotData) => EarshotData) => void; onPlay: (list: SavedEpisode[], index: number) => void; onClose: () => void }) {
  const builtIn = DEFAULT_MODES.some((d) => d.id === mode.id);
  const total = mode.episodes.reduce((a, e) => a + (e.secs || 0), 0);
  const remove = (id: string) => update((e) => ({ ...e, modes: e.modes.map((m) => (m.id === mode.id ? { ...m, episodes: m.episodes.filter((x) => x.id !== id) } : m)) }));
  const move = (i: number, d: number) => update((e) => ({ ...e, modes: e.modes.map((m) => { if (m.id !== mode.id) return m; const list = m.episodes.slice(); const j = i + d; if (j < 0 || j >= list.length) return m; [list[i], list[j]] = [list[j], list[i]]; return { ...m, episodes: list }; }) }));
  const del = () => { update((e) => ({ ...e, modes: e.modes.filter((m) => m.id !== mode.id) })); onClose(); };
  const th = hubTheme(mode); const ink = inkOn(th.bg); const font = HUB_FONTS[th.font];
  return <div className="absolute inset-0 z-40 overflow-y-auto bg-[#0e0d10] [scrollbar-width:none]" role="dialog" aria-label={mode.name}>
    <div className="relative px-5 pb-6 pt-[calc(env(safe-area-inset-top,0px)+4rem)]" style={{ background: th.bg, color: ink }}>
      <button type="button" onClick={onClose} aria-label="Back" className="absolute left-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] grid h-10 w-10 place-items-center rounded-full opacity-80 hover:opacity-100"><ChevronLeft size={22} /></button>
      <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: th.accent, color: inkOn(th.accent) }}><ModeIcon m={mode} size={22} /></span>
      <h2 className="mt-4 text-[32px] leading-tight" style={{ fontFamily: font.stack, fontWeight: font.weight, letterSpacing: font.tracking }}>{mode.name}</h2>
      <p className="mt-1 text-sm opacity-60">{mode.episodes.length} episode{mode.episodes.length === 1 ? "" : "s"}{total ? ` · ${durationWords(total)}` : ""}</p>
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={!mode.episodes.length} onClick={() => onPlay(mode.episodes, 0)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold disabled:opacity-40" style={{ background: th.accent, color: inkOn(th.accent) }}><Play size={16} fill="currentColor" />Play all</button>
        <button type="button" disabled={mode.episodes.length < 2} onClick={() => { const i = Math.floor(Math.random() * mode.episodes.length); onPlay([...mode.episodes.slice(i), ...mode.episodes.slice(0, i)], 0); }} className="min-h-12 rounded-full px-5 text-sm font-semibold disabled:opacity-40" style={{ boxShadow: `inset 0 0 0 1px ${ink}33` }}>Shuffle</button>
      </div>
    </div>
    <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] pt-3">
      {!mode.episodes.length && <p className="py-10 text-center text-sm text-white/55">Nothing here yet. Tap Save on any episode and pick “{mode.name}”.</p>}
      <ol className="flex flex-col gap-1">{mode.episodes.map((e, i) => <li key={e.id} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-xl p-2 hover:bg-white/5">
        <button type="button" onClick={() => onPlay(mode.episodes, i)} aria-label={`Play ${e.title}`}><img src={hiRes(e.art, 200)} alt="" referrerPolicy="no-referrer" className="h-[52px] w-[52px] rounded-lg object-cover" /></button>
        <button type="button" onClick={() => onPlay(mode.episodes, i)} className="min-w-0 text-left"><b className="line-clamp-1 text-sm">{e.title}</b><span className="line-clamp-1 text-xs text-white/55">{e.show}{e.secs ? ` · ${durationWords(e.secs)}` : ""}</span></button>
        <span className="flex gap-1">
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs disabled:opacity-30">↑</button>
          <button type="button" onClick={() => remove(e.id)} aria-label={`Remove ${e.title}`} className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><X size={14} /></button>
        </span>
      </li>)}</ol>
      {!builtIn && <button type="button" onClick={del} className="mt-8 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-rose-300"><Trash2 size={15} />Delete this mode</button>}
    </div>
  </div>;
}

// ===========================================================================
// The AI finder
// ===========================================================================
type Pick = { show: PodShow; why: string; episode: PodEpisode | null };
const IDEAS = ["Funny podcasts for a long drive", "Something calming to fall asleep to", "True crime that isn't too gory", "Learn about money in 20 minutes", "History told like a thriller", "Clean comedy for the family"];
export function AiFinder({ api, ex, onShow, onPlay }: { api: (path: string, init?: { method?: string; body?: unknown }) => Promise<any>; ex: string; onShow: (s: PodShow) => void; onPlay: (s: PodShow, e: PodEpisode) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ summary: string; picks: Pick[] } | null>(null);
  const [err, setErr] = useState("");
  const go = (text = q) => {
    const t = text.trim(); if (t.length < 3 || busy) return;
    setQ(t); setBusy(true); setErr(""); setRes(null);
    api(`/api/earshot/ai-find?x=1${ex}`, { method: "POST", body: { q: t } }).then((b) => setRes({ summary: b.summary || "", picks: Array.isArray(b.picks) ? b.picks : [] })).catch((e) => setErr(e?.message || "That didn't work. Try again.")).finally(() => setBusy(false));
  };
  return <section className="mt-5 rounded-2xl bg-white/[.03] p-4 ring-1 ring-white/[.06]">
    <div>
      <div className="flex items-center gap-2 text-white/45"><Sparkles size={14} strokeWidth={1.8} /><span className="text-[11px] font-semibold uppercase tracking-[.14em]">Ask AI</span></div>
      <h3 className="mt-1.5 text-[17px] font-semibold tracking-tight text-white/90">What do you feel like hearing?</h3>
      <form onSubmit={(e) => { e.preventDefault(); go(); }} className="mt-3 flex items-center gap-1 rounded-full bg-black/30 p-1 pl-4 ring-1 ring-white/[.08] focus-within:ring-white/25">
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={400} placeholder="A cozy mystery for my commute" aria-label="Describe the podcast you want" className="min-h-10 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/30" />
        <button type="submit" disabled={busy || q.trim().length < 3} aria-label="Find" className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white text-[#111013] transition disabled:bg-white/10 disabled:text-white/30">{busy ? <Loader2 className="animate-spin" size={17} /> : <ArrowUp size={18} strokeWidth={2.2} />}</button>
      </form>
      {!res && !busy && <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">{IDEAS.map((i) => <button key={i} type="button" onClick={() => go(i)} className="flex-none rounded-full px-3 py-1.5 text-xs text-white/55 ring-1 ring-white/[.08] transition hover:text-white/80">{i}</button>)}</div>}
      {busy && <p className="mt-4 flex items-center gap-2 text-sm text-white/60"><Loader2 className="animate-spin" size={16} />Listening to thousands of shows for you…</p>}
      {err && <p className="mt-3 text-sm text-rose-300">{err}</p>}
      {res && <div className="mt-4">
        {res.summary && <p className="text-sm text-white/75">{res.summary}</p>}
        {!res.picks.length && <p className="mt-2 text-sm text-white/55">Nothing fit just right. Try describing it another way.</p>}
        <div className="mt-2 flex flex-col divide-y divide-white/[.06]">{res.picks.map((p) => <div key={p.show.id} className="grid grid-cols-[64px_1fr] gap-3 py-3">
          <button type="button" onClick={() => onShow(p.show)}><img src={hiRes(p.show.art, 200)} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-xl object-cover" /></button>
          <div className="min-w-0">
            <button type="button" onClick={() => onShow(p.show)} className="block max-w-full truncate text-left text-sm font-semibold">{p.show.name}</button>
            <p className="line-clamp-2 text-xs leading-relaxed text-white/60">{p.why}</p>
            <div className="mt-1.5 flex gap-1.5">
              {p.episode && <button type="button" onClick={() => onPlay(p.show, p.episode!)} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#111013]"><Play size={11} fill="currentColor" />Play</button>}
              <button type="button" onClick={() => onShow(p.show)} className="rounded-full px-3 py-1 text-xs font-medium text-white/70 ring-1 ring-white/15">Episodes</button>
            </div>
          </div>
        </div>)}</div>
        <button type="button" onClick={() => { setRes(null); setQ(""); }} className="mt-3 text-xs font-bold text-white/55 underline">Ask again</button>
      </div>}
    </div>
  </section>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="absolute inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
    <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} className="flex max-h-[85%] w-full flex-col rounded-t-3xl bg-[#1c1620] pt-2 shadow-2xl">
      <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-white/20" />
      <div className="flex items-center justify-between px-4 pb-2"><h3 className="text-lg font-semibold">{title}</h3><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><X size={18} /></button></div>
      {children}
    </div>
  </div>;
}
