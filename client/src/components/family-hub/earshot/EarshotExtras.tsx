// Earshot/Podscroll: the show page (episodes like a streaming app, played back to back), Pod Modes
// (Sleep, Commute... playlists), "Add to", and the AI podcast finder. Shared by both apps, so it
// imports nothing from the Arise app itself.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUp, BookOpen, Car, Check, ChevronLeft, ChevronRight, Dumbbell, Headphones, ListPlus, Loader2, Moon, Play, Plus, Shirt, Sparkles, Trash2, X, type LucideIcon } from "lucide-react";
import {
  DEFAULT_MODES, GENRE, MODE_ICONS, clock, durationWords, hiRes,
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
export function ShowPage({ show, load, following, onFollow, onPlayFrom, onClose, adFree, onAdFree, spots, onAddTo, onGenre }: {
  show: PodShow; load: (id: string) => Promise<{ show: PodShow | null; episodes: PodEpisode[] }>; following: boolean; onFollow: (s: PodShow) => void;
  onPlayFrom: (show: PodShow, list: PodEpisode[], index: number) => void; onClose: () => void; adFree: boolean; onAdFree: (on: boolean) => void;
  spots: Record<string, Spot>; onAddTo: (ep: PodEpisode) => void; onGenre: (g: string) => void;
}) {
  const [eps, setEps] = useState<PodEpisode[] | null>(null);
  const [full, setFull] = useState<PodShow>(show);
  const [err, setErr] = useState("");
  const [oldest, setOldest] = useState(false);
  useEffect(() => { load(show.id).then((r) => { setEps(r.episodes); if (r.show) setFull({ ...r.show, genre: r.show.genre || show.genre }); }).catch((e) => setErr(e?.message || "This show didn't load.")); }, [show.id, load, show.genre]);
  const list = useMemo(() => (eps ? (oldest ? eps.slice().reverse() : eps) : []), [eps, oldest]);
  const resumeAt = list.findIndex((e) => spots[e.id]);
  const art = hiRes(full.art);
  return <div className="absolute inset-0 z-40 overflow-y-auto bg-[#120e14] text-white [scrollbar-width:none]" role="dialog" aria-label={full.name}>
    <div className="relative">
      <div className="absolute inset-0 overflow-hidden"><div className="absolute -inset-[20%] bg-cover bg-center opacity-60 blur-3xl saturate-150" style={{ backgroundImage: `url("${art}")` }} /><div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#120e14]/40 to-[#120e14]" /></div>
      <div className="relative flex flex-col items-center px-5 pb-5 pt-14 text-center">
        <button type="button" onClick={onClose} aria-label="Back" className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/45 backdrop-blur"><ChevronLeft size={22} /></button>
        <img src={art} alt={`${full.name} cover art`} referrerPolicy="no-referrer" className="aspect-square w-[min(62vw,280px)] rounded-[22px] object-cover shadow-[0_30px_60px_-15px_rgba(0,0,0,.8)] ring-1 ring-white/15" />
        <h2 className="mt-5 text-2xl font-semibold leading-tight sm:text-3xl">{full.name}</h2>
        <p className="mt-1 text-sm text-white/65">{full.author}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {GENRE[full.genre] && <button type="button" onClick={() => onGenre(full.genre)} className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold">{GENRE[full.genre].name}</button>}
          {!!eps?.length && <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold">{eps.length} episodes</span>}
        </div>
        <div className="mt-5 flex w-full max-w-sm gap-2">
          <button type="button" disabled={!list.length} onClick={() => onPlayFrom(full, list, Math.max(0, resumeAt))} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full text-base font-semibold bg-white text-[#111013] disabled:opacity-50"><Play size={18} fill="currentColor" />{resumeAt >= 0 ? "Resume" : oldest ? "Play from the start" : "Play latest"}</button>
          <button type="button" onClick={() => onFollow(full)} className={`flex min-h-12 items-center gap-1.5 rounded-full px-5 text-sm font-semibold ${following ? "bg-white text-[#120e14]" : "bg-white/12"}`}>{following ? <Check size={16} /> : <Plus size={16} />}{following ? "Following" : "Follow"}</button>
        </div>
      </div>
    </div>
    <div className="px-4 pb-10">
      <button type="button" role="switch" aria-checked={adFree} onClick={() => onAdFree(!adFree)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 text-left">
        <span><b className="block text-sm">Support this show</b><span className="block text-xs text-white/55">{adFree ? "Its ads play in full, so the show gets paid." : "Turn on to never skip this show's ads."}</span></span>
        <span className={`relative h-7 w-12 flex-none rounded-full transition ${adFree ? "" : "bg-white/15"}`} style={adFree ? { background: ACCENT } : undefined}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${adFree ? "left-6" : "left-1"}`} /></span>
      </button>
      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Episodes</h3>
        <div className="flex rounded-full bg-white/10 p-0.5">{([[false, "Newest"], [true, "Oldest"]] as const).map(([v, l]) => <button key={l} type="button" aria-pressed={oldest === v} onClick={() => setOldest(v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${oldest === v ? "bg-white text-[#120e14]" : "text-white/70"}`}>{l}</button>)}</div>
      </div>
      <p className="mt-1 text-xs text-white/45">Play any episode and the ones below it keep playing, back to back.</p>
      {!eps && !err && <div className="grid place-items-center py-10"><Loader2 className="animate-spin" /></div>}
      {err && <p className="py-8 text-center text-sm text-white/60">{err}</p>}
      {eps && !eps.length && <p className="py-8 text-center text-sm text-white/60">No playable episodes right now.</p>}
      <ol className="mt-3 flex flex-col gap-1">
        {list.map((e, i) => {
          const spot = spots[e.id]; const pct = spot && e.secs ? Math.min(100, (spot.t / e.secs) * 100) : 0;
          return <li key={e.id} className="group grid grid-cols-[124px_1fr_auto] gap-3 rounded-2xl p-2 hover:bg-white/5">
            <button type="button" onClick={() => onPlayFrom(full, list, i)} aria-label={`Play ${e.title}`} className="relative aspect-video overflow-hidden rounded-xl bg-white/5">
              <img src={hiRes(e.art || full.art, 400)} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
              <span className="absolute inset-0 grid place-items-center bg-black/25"><span className="grid h-9 w-9 place-items-center rounded-full bg-black/55 backdrop-blur"><Play size={16} fill="currentColor" /></span></span>
              {pct > 0 && <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25"><span className="block h-full" style={{ width: `${pct}%`, background: ACCENT }} /></span>}
              {e.secs > 0 && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 text-[10px] font-bold tabular-nums">{clock(e.secs)}</span>}
            </button>
            <button type="button" onClick={() => onPlayFrom(full, list, i)} className="min-w-0 text-left">
              <b className="line-clamp-2 block text-sm leading-snug">{e.title}</b>
              <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-wider text-white/40">{[e.date ? agoWords(e.date) : "", e.secs ? durationWords(e.secs) : ""].filter(Boolean).join(" · ")}</span>
              {e.about && <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-white/55">{e.about}</span>}
            </button>
            <button type="button" onClick={() => onAddTo(e)} aria-label={`Add ${e.title} to a mode`} className="mt-1 grid h-9 w-9 place-items-center self-start rounded-full bg-white/10"><ListPlus size={17} /></button>
          </li>;
        })}
      </ol>
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
  const [icon, setIcon] = useState(MODE_ICONS[0]);
  const inMode = (m: PodMode) => m.episodes.some((x) => x.id === ep.id);
  const toggle = (id: string) => update((e) => ({ ...e, modes: e.modes.map((m) => (m.id !== id ? m : inMode(m) ? { ...m, episodes: m.episodes.filter((x) => x.id !== ep.id) } : { ...m, episodes: [toSaved(ep), ...m.episodes].slice(0, 150) })) }));
  const allIn = es.modes.every(inMode);
  const all = () => { update((e) => ({ ...e, modes: e.modes.map((m) => (allIn ? { ...m, episodes: m.episodes.filter((x) => x.id !== ep.id) } : inMode(m) ? m : { ...m, episodes: [toSaved(ep), ...m.episodes].slice(0, 150) })) })); say(allIn ? "Removed from every mode." : "Added to every mode."); };
  const create = () => {
    const n = name.replace(/\s+/g, " ").trim().slice(0, 30); if (!n) return;
    const id = `${n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16) || "mode"}-${Math.random().toString(36).slice(2, 6)}`;
    update((e) => ({ ...e, modes: [...e.modes, { id, name: n, icon, episodes: [toSaved(ep)] }].slice(0, 24) }));
    setNaming(false); setName(""); say(`Made “${n}” and added this episode.`);
  };
  return <Sheet title="Add to" onClose={onClose}>
    <div className="overflow-y-auto px-4 pb-5">
      <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5"><img src={hiRes(ep.art, 200)} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-lg object-cover" /><span className="min-w-0"><b className="line-clamp-1 block text-sm">{ep.title}</b><span className="line-clamp-1 block text-xs text-white/55">{ep.show}</span></span></div>
      <Toggle on={saved} onClick={onSave} icon="🔖" title="Saved" sub="Your Library" />
      <div className="mt-4 flex items-center justify-between"><h4 className="text-sm font-semibold">Pod Modes</h4><button type="button" onClick={all} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">{allIn ? "Remove from all" : "Add to all"}</button></div>
      {es.modes.map((m) => <Toggle key={m.id} on={inMode(m)} onClick={() => toggle(m.id)} icon={m.icon} title={m.name} sub={`${m.episodes.length} episode${m.episodes.length === 1 ? "" : "s"}`} />)}
      {naming ? <div className="mt-3 rounded-2xl bg-white/5 p-3">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} maxLength={30} placeholder="Name it: Road trip, Bedtime, Cooking…" aria-label="Mode name" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base outline-none focus:border-[#ff8a3d]" />
        <div className="mt-2 flex flex-wrap gap-1">{MODE_ICONS.map((ic) => <button key={ic} type="button" aria-pressed={icon === ic} onClick={() => setIcon(ic)} className={`grid h-9 w-9 place-items-center rounded-lg text-lg ${icon === ic ? "bg-white/25" : "bg-white/5"}`}>{ic}</button>)}</div>
        <div className="mt-3 flex gap-2"><button type="button" onClick={create} disabled={!name.trim()} className="min-h-10 flex-1 rounded-full font-semibold bg-white text-[#111013] disabled:opacity-40">Create & add</button><button type="button" onClick={() => setNaming(false)} className="min-h-10 rounded-full bg-white/10 px-4 font-bold">Cancel</button></div>
      </div> : <button type="button" onClick={() => setNaming(true)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 text-sm font-bold"><Plus size={16} />New mode</button>}
    </div>
  </Sheet>;
}
function Toggle({ on, onClick, icon, title, sub }: { on: boolean; onClick: () => void; icon: string; title: string; sub: string }) {
  return <button type="button" role="checkbox" aria-checked={on} onClick={onClick} className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-white/5 p-3 text-left">
    <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-white/10 text-xl">{icon}</span>
    <span className="min-w-0 flex-1"><b className="block text-sm">{title}</b><span className="block text-xs text-white/55">{sub}</span></span>
    <span className={`grid h-7 w-7 flex-none place-items-center rounded-full ${on ? "text-[#24160a]" : "bg-white/10"}`} style={on ? { background: ACCENT } : undefined}>{on ? <Check size={16} /> : <Plus size={16} />}</span>
  </button>;
}

// ===========================================================================
// Pod Modes in the Library: a card per mode; open one to play it back to back
// ===========================================================================
/** The built-in modes get fine line icons; ones people make keep the emoji they picked. */
const MODE_LINE: Record<string, LucideIcon> = { sleep: Moon, commute: Car, workout: Dumbbell, focus: Headphones, learn: BookOpen, chores: Shirt };
function ModeIcon({ m, size = 18 }: { m: PodMode; size?: number }) {
  const I = MODE_LINE[m.id];
  return I ? <I size={size} strokeWidth={1.6} /> : <span style={{ fontSize: size }} className="leading-none grayscale-[.3]">{m.icon}</span>;
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
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/[.06] text-white/80">{<ModeIcon m={m} />}</span>
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
  return <div className="absolute inset-0 z-40 overflow-y-auto bg-[#0e0d10] [scrollbar-width:none]" role="dialog" aria-label={mode.name}>
    <div className="relative border-b border-white/[.06] px-5 pb-6 pt-16">
      <button type="button" onClick={onClose} aria-label="Back" className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full text-white/70 hover:bg-white/[.06]"><ChevronLeft size={22} /></button>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[.06] text-white/85"><ModeIcon m={mode} size={22} /></span>
      <h2 className="mt-4 text-[28px] font-semibold tracking-tight">{mode.name}</h2>
      <p className="mt-1 text-sm text-white/45">{mode.episodes.length} episode{mode.episodes.length === 1 ? "" : "s"}{total ? ` · ${durationWords(total)}` : ""}</p>
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={!mode.episodes.length} onClick={() => onPlay(mode.episodes, 0)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-[#111013] disabled:opacity-40"><Play size={16} fill="currentColor" />Play all</button>
        <button type="button" disabled={mode.episodes.length < 2} onClick={() => { const i = Math.floor(Math.random() * mode.episodes.length); onPlay([...mode.episodes.slice(i), ...mode.episodes.slice(0, i)], 0); }} className="min-h-12 rounded-full px-5 text-sm font-semibold text-white/80 ring-1 ring-white/15 disabled:opacity-40">Shuffle</button>
      </div>
    </div>
    <div className="px-4 pb-10 pt-3">
      {!mode.episodes.length && <p className="py-10 text-center text-sm text-white/55">Nothing here yet. Tap Save (or the + on a show's episodes) and pick “{mode.name}”.</p>}
      <ol className="flex flex-col gap-1">{mode.episodes.map((e, i) => <li key={e.id} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-xl p-2 hover:bg-white/5">
        <button type="button" onClick={() => onPlay(mode.episodes, i)} aria-label={`Play ${e.title}`}><img src={hiRes(e.art, 200)} alt="" referrerPolicy="no-referrer" className="h-[52px] w-[52px] rounded-lg object-cover" /></button>
        <button type="button" onClick={() => onPlay(mode.episodes, i)} className="min-w-0 text-left"><b className="line-clamp-1 block text-sm">{e.title}</b><span className="line-clamp-1 block text-xs text-white/55">{e.show}{e.secs ? ` · ${durationWords(e.secs)}` : ""}</span></button>
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
