// The listening extras' screens for the Earshot/Pod+ player: Ask the episode (answers that jump to the
// moment), Catch me up (a recap of what you already heard), Fit my drive (episodes that fill your
// minutes), the Hours back counter, and timed comments popping up as their moment plays.
// Imports nothing from the Arise app (Pod+ uses it too).
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Car, Clock3, Loader2, MessageCircle, Play, Send, Sparkles, Volume2, X } from "lucide-react";
import { clock, type Earshot as EarshotData, type PodEpisode, type SavedEpisode } from "@shared/earshot";
import { driveSecs, fitDrive, hoursWords, sumKinds, weekKey, type AskMoment, type HoursBack } from "@shared/earshotListen";
import { readHoursBack } from "./listenExtras";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
const ACCENT = "#ff8a3d";

function ListenSheet({ title, icon, onClose, children, tall }: { title: string; icon?: ReactNode; onClose: () => void; children: ReactNode; tall?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <div className="absolute inset-0 z-30 flex flex-col justify-end">
    <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55" />
    <div role="dialog" aria-modal="true" aria-label={title} className={`relative flex flex-col rounded-t-3xl bg-[#1d1720] pb-[env(safe-area-inset-bottom,0px)] text-white shadow-2xl ${tall ? "h-[85%]" : "max-h-[85%]"}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h3 className="flex items-center gap-2 text-base font-semibold">{icon}{title}</h3><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><X size={18} /></button></div>
      {children}
    </div>
  </div>;
}

const MomentButton = ({ m, onJump }: { m: AskMoment; onJump: (t: number) => void }) =>
  <button type="button" onClick={() => onJump(m.t)} className="flex min-h-10 w-full items-center gap-2.5 rounded-xl bg-white/[.06] px-3 text-left text-sm hover:bg-white/10">
    <span className="grid h-7 w-7 flex-none place-items-center rounded-full" style={{ background: ACCENT }}><Play size={12} fill="#111" strokeWidth={0} className="ml-0.5" /></span>
    <b className="flex-none tabular-nums">{clock(m.t)}</b><span className="min-w-0 truncate text-white/70">{m.label}</span>
  </button>;

// ===========================================================================
// Ask the episode
// ===========================================================================
type Asked = { q: string; answer?: string; moments?: AskMoment[]; error?: string; partial?: boolean; readTo?: number };
const STARTERS = ["What's this episode about?", "What are the main takeaways?", "Who is the guest?", "Did they recommend anything?"];

export function AskSheet({ ep, api, play, onJump, onClose }: { ep: PodEpisode; api: Api; play?: string; onJump: (t: number) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Asked[]>([]);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [list]);
  const ask = async (question: string, e?: FormEvent) => {
    e?.preventDefault();
    const text = question.trim(); if (text.length < 3 || busy) return;
    setBusy(true); setQ("");
    setList((l) => [...l, { q: text }]);
    try {
      const b = await api("/api/earshot/ask", { method: "POST", body: { showId: ep.showId, episodeId: ep.id, q: text, ...(play ? { play } : {}) } });
      setList((l) => l.map((x, i) => (i === l.length - 1 ? { ...x, answer: b.answer, moments: b.moments || [], partial: !!b.partial, readTo: b.readTo } : x)));
    } catch (err: any) {
      setList((l) => l.map((x, i) => (i === l.length - 1 ? { ...x, error: err?.message || "Couldn't answer right now." } : x)));
    } finally { setBusy(false); }
  };
  return <ListenSheet title="Ask this episode" icon={<Sparkles size={17} style={{ color: ACCENT }} />} onClose={onClose} tall>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <p className="line-clamp-1 text-xs text-white/50">{ep.title}</p>
      {!list.length && <>
        <p className="mt-4 text-sm leading-relaxed text-white/75">Ask anything about what's said in this episode. Answers point to the moments they come from, so you can jump right there.</p>
        <div className="mt-4 flex flex-wrap gap-2">{STARTERS.map((s) => <button key={s} type="button" onClick={() => void ask(s)} className="min-h-9 rounded-full bg-white/10 px-3.5 text-[13px] font-medium hover:bg-white/15">{s}</button>)}</div>
      </>}
      <div className="mt-2 flex flex-col gap-5">{list.map((x, i) => <div key={i}>
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-white/15 px-3.5 py-2 text-sm">{x.q}</p>
        {!x.answer && !x.error && <p className="mt-3 flex items-center gap-2 text-sm text-white/60"><Loader2 size={15} className="animate-spin" />Reading the episode… the first question on a long one takes up to a minute.</p>}
        {x.error && <p className="mt-3 text-sm text-rose-300">{x.error}</p>}
        {x.answer && <div className="mt-3 space-y-2">
          <p className="text-[15px] leading-relaxed">{x.answer}</p>
          {x.moments?.map((m) => <MomentButton key={m.t} m={m} onJump={(t) => { onJump(t); onClose(); }} />)}
          {x.partial && <p className="text-xs text-white/45">Only the first {Math.max(1, Math.round((x.readTo || 0) / 60))} minutes could be read so far. Ask again in a minute for the rest.</p>}
        </div>}
      </div>)}<div ref={end} /></div>
    </div>
    <form onSubmit={(e) => void ask(q, e)} className="flex items-center gap-2 border-t border-white/10 p-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder="When do they talk about…" aria-label="Your question about this episode" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-base text-white outline-none placeholder:text-white/35 focus:border-[#ff8a3d]" />
      <button type="submit" disabled={q.trim().length < 3 || busy} aria-label="Ask" className="grid h-11 w-11 flex-none place-items-center rounded-full bg-white text-[#111013] disabled:opacity-40">{busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}</button>
    </form>
  </ListenSheet>;
}

// ===========================================================================
// Catch me up
// ===========================================================================
export function CatchUpSheet({ ep, api, upTo, play, earlier, onResume, onClose }: { ep: PodEpisode; api: Api; upTo: number; play?: string; earlier: string[]; onResume: () => void; onClose: () => void }) {
  const [res, setRes] = useState<{ recap: string; points: string[] } | null>(null);
  const [err, setErr] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const earlierKey = earlier.join(",");
  useEffect(() => {
    let on = true;
    api("/api/earshot/catchup", { method: "POST", body: { showId: ep.showId, episodeId: ep.id, upTo: Math.floor(upTo), earlier: earlierKey ? earlierKey.split(",") : [], ...(play ? { play } : {}) } })
      .then((b) => { if (on) setRes({ recap: b.recap, points: b.points || [] }); }).catch((e: any) => { if (on) setErr(e?.message || "Couldn't write a recap right now."); });
    return () => { on = false; if (canSpeak) window.speechSynthesis.cancel(); };
  }, [api, ep.id, ep.showId, upTo, play, earlierKey, canSpeak]);
  const speak = () => {
    if (!res || !canSpeak) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance([res.recap, ...res.points].join(" "));
    u.rate = 1.05; u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); setSpeaking(true);
  };
  return <ListenSheet title="Catch me up" icon={<Clock3 size={17} style={{ color: ACCENT }} />} onClose={onClose}>
    <div className="overflow-y-auto px-4 py-4">
      <p className="text-xs text-white/50">{upTo >= 60 ? `What you heard of “${ep.title}”, up to ${clock(upTo)}` : `Before “${ep.title}”`}. Nothing ahead is spoiled.</p>
      {!res && !err && <p className="mt-6 flex items-center gap-2 text-sm text-white/65"><Loader2 size={16} className="animate-spin" />Going over what you heard…</p>}
      {err && <p className="mt-5 text-sm text-white/70">{err}</p>}
      {res && <>
        <p className="mt-4 text-[16px] leading-relaxed">{res.recap}</p>
        {!!res.points.length && <ul className="mt-4 space-y-2">{res.points.map((p) => <li key={p} className="flex gap-2.5 text-sm leading-snug text-white/80"><span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full" style={{ background: ACCENT }} />{p}</li>)}</ul>}
      </>}
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => { if (canSpeak) window.speechSynthesis.cancel(); onResume(); }} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#111013]"><Play size={15} fill="currentColor" strokeWidth={0} />{upTo >= 60 ? `Pick up at ${clock(upTo)}` : "Start listening"}</button>
        {res && canSpeak && <button type="button" onClick={speak} aria-pressed={speaking} className="flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold"><Volume2 size={16} />{speaking ? "Stop" : "Read it to me"}</button>}
      </div>
    </div>
  </ListenSheet>;
}

/** Whether "Catch me up" is worth offering: they're well into it, or came back after a break. */
export function catchUpWorthIt(time: number, spotAt: number | undefined): boolean {
  if (time >= 10 * 60) return true;
  return time >= 2 * 60 && !!spotAt && Date.now() - spotAt > 24 * 3600_000;
}

// ===========================================================================
// Fit my drive
// ===========================================================================
const SPOTS_KEY = "earshot.spots";
const readLeft = (): Record<string, number> => {
  try { const v = JSON.parse(localStorage.getItem(SPOTS_KEY) || "{}"); const out: Record<string, number> = {}; for (const [id, s] of Object.entries<any>(v || {})) if (s && s.secs > 0 && s.t > 0) out[id] = s.secs - s.t; return out; } catch { return {}; }
};
const DRIVE_KEY = "earshot.drive";
const MINUTES = [10, 15, 20, 30, 45, 60, 90];

export function DriveSheet({ es, speed, onPlay, onClose }: { es: EarshotData; speed: number; onPlay: (list: SavedEpisode[], title: string) => void; onClose: () => void }) {
  const kept = useMemo(() => { try { return JSON.parse(localStorage.getItem(DRIVE_KEY) || "{}"); } catch { return {}; } }, []);
  const [minutes, setMinutes] = useState<number>(Number(kept.minutes) || 30);
  const [custom, setCustom] = useState("");
  const sources = useMemo(() => {
    const out: { id: string; name: string; eps: SavedEpisode[] }[] = [];
    const all = new Map<string, SavedEpisode>();
    const add = (e: SavedEpisode) => { if (!all.has(e.id)) all.set(e.id, e); };
    es.saved.forEach(add); es.modes.forEach((m) => m.episodes.forEach(add)); es.liked.forEach(add);
    out.push({ id: "all", name: "Anything I saved", eps: Array.from(all.values()) });
    if (es.saved.length) out.push({ id: "later", name: "Listen later", eps: es.saved });
    es.modes.filter((m) => m.episodes.length).forEach((m) => out.push({ id: `m:${m.id}`, name: `${m.icon} ${m.name}`, eps: m.episodes }));
    if (es.liked.length) out.push({ id: "liked", name: "Liked", eps: es.liked });
    return out;
  }, [es.saved, es.modes, es.liked]);
  const [src, setSrc] = useState<string>(sources.some((s) => s.id === kept.src) ? kept.src : sources.find((s) => s.id === "m:commute")?.id ?? "all");
  const source = sources.find((s) => s.id === src) ?? sources[0];
  const heard = useMemo(() => new Set(es.heard), [es.heard]);
  const plan = useMemo(() => {
    const left = readLeft();
    // Part-heard first (finish what you started), then ones not heard yet, then the rest.
    const cands = source.eps.filter((e) => e.secs > 0).map((e) => ({ ...e, left: left[e.id] }));
    const rank = (e: typeof cands[number]) => (e.left ? 0 : heard.has(e.id) ? 2 : 1);
    cands.sort((a, b) => rank(a) - rank(b));
    return fitDrive(cands, minutes, speed);
  }, [source, minutes, speed, heard]);
  const start = () => {
    if (!plan.picks.length) return;
    try { localStorage.setItem(DRIVE_KEY, JSON.stringify({ minutes, src })); } catch { /* not kept */ }
    onPlay(plan.picks.map(({ left: _l, ...e }) => e), `Your ${minutes}-minute drive`);
  };
  const gap = Math.round((plan.secs - plan.target) / 60);
  return <ListenSheet title="Fit my drive" icon={<Car size={18} style={{ color: ACCENT }} />} onClose={onClose} tall>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <p className="text-sm text-white/70">How long is the drive? Episodes are picked to end as you arrive{speed !== 1 ? `, at your ${speed}× speed` : ""}. Ones you started pick up where you left off.</p>
      <div className="mt-4 flex flex-wrap gap-1.5">{MINUTES.map((m) => <button key={m} type="button" aria-pressed={minutes === m} onClick={() => { setMinutes(m); setCustom(""); }} className={`min-h-10 rounded-full px-3.5 text-sm font-semibold ${minutes === m ? "bg-white text-[#120e14]" : "bg-white/10 text-white/80"}`}>{m < 60 ? `${m} min` : `${m / 60 === 1 ? "1 hr" : `${m / 60} hr`}`}</button>)}
        <label className="flex min-h-10 items-center gap-1.5 rounded-full bg-white/10 pl-3.5 pr-2 text-sm text-white/80">Other<input inputMode="numeric" value={custom} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 3); setCustom(v); const n = Number(v); if (n >= 5 && n <= 240) setMinutes(n); }} placeholder="min" aria-label="Minutes" className="w-12 bg-transparent text-base text-white outline-none placeholder:text-white/35" /></label>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-white/40">From</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{sources.map((s) => <button key={s.id} type="button" aria-pressed={src === s.id} onClick={() => setSrc(s.id)} className={`min-h-9 rounded-full px-3 text-[13px] font-medium ${src === s.id ? "bg-white text-[#120e14]" : "bg-white/10 text-white/75"}`}>{s.name}</button>)}</div>
      <div className="mt-5">
        {!source.eps.length ? <p className="rounded-2xl bg-white/5 p-4 text-sm text-white/65">Nothing saved here yet. Save episodes to Listen later or a Pod Mode, and they can fill your drive.</p>
          : !plan.picks.length ? <p className="rounded-2xl bg-white/5 p-4 text-sm text-white/65">Every episode here is longer than {minutes} minutes. Try a longer drive or another list.</p>
          : <>
            <p className="text-sm"><b>{plan.picks.length} episode{plan.picks.length === 1 ? "" : "s"} · {hoursWords(plan.secs)}</b><span className="text-white/55"> · {gap === 0 ? "right on time" : gap < 0 ? `${-gap} min short` : `${gap} min over`}</span></p>
            <ul className="mt-3 flex flex-col gap-2">{plan.picks.map((e) => <li key={e.id} className="grid grid-cols-[44px_1fr_auto] items-center gap-3">
              <img src={e.art} alt="" referrerPolicy="no-referrer" className="h-11 w-11 rounded-lg object-cover" />
              <span className="min-w-0"><b className="block truncate text-sm">{e.title}</b><span className="block truncate text-xs text-white/50">{e.show}{e.left ? " · picks up where you left off" : ""}</span></span>
              <span className="text-xs tabular-nums text-white/55">{Math.max(1, Math.round(driveSecs(e, speed) / 60))} min</span>
            </li>)}</ul>
          </>}
      </div>
    </div>
    <div className="border-t border-white/10 p-3"><button type="button" disabled={!plan.picks.length} onClick={start} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-[#111013] disabled:opacity-40" style={{ background: ACCENT }}><Car size={18} />Start the drive</button></div>
  </ListenSheet>;
}

// ===========================================================================
// Hours back
// ===========================================================================
export function useHoursBack(): HoursBack {
  const [h, setH] = useState(readHoursBack);
  useEffect(() => {
    const again = () => setH(readHoursBack());
    window.addEventListener("earshot-hours", again); window.addEventListener("storage", again);
    const t = setInterval(again, 30_000);
    return () => { window.removeEventListener("earshot-hours", again); window.removeEventListener("storage", again); clearInterval(t); };
  }, []);
  return h;
}

/** The counter: this week's time back, all time, and where it came from. light: on a white page (Pod+ home). */
export function HoursBackCard({ light, onHide }: { light?: boolean; onHide?: () => void }) {
  const h = useHoursBack();
  const week = h.weeks[weekKey()];
  const wk = sumKinds(week), all = sumKinds(h.total);
  const parts = ([["ads", "ads skipped"], ["intros", "intros skipped"], ["speed", "faster speed"]] as const).map(([k, l]) => [Math.round((week?.[k] ?? 0) / 60), l] as const).filter(([m]) => m > 0);
  const ink = light ? "text-[#0f0f0f]" : "text-white", soft = light ? "text-[#606060]" : "text-white/55";
  return <section aria-label="Hours back" className={`relative flex items-center gap-3.5 rounded-2xl p-3.5 pr-10 ${light ? "bg-[#fff4ec] ring-1 ring-[#ffd9bf]" : "bg-white/[.05] ring-1 ring-white/[.08]"}`}>
    <span className="grid h-11 w-11 flex-none place-items-center rounded-full text-white" style={{ background: ACCENT }}><Clock3 size={21} /></span>
    <div className="min-w-0">
      <p className={`text-[15px] font-semibold ${ink}`}>{wk >= 60 ? `${hoursWords(wk)} back this week` : all >= 60 ? "Hours back" : "Your hours back start here"}</p>
      <p className={`text-xs leading-snug ${soft}`}>{wk >= 60 && parts.length ? parts.map(([m, l]) => `${m} min ${l}`).join(" · ") : "Skipped ads and intros, and a faster speed, add up here."}{all >= 60 ? ` · ${hoursWords(all)} all time` : ""}</p>
    </div>
    {onHide && <button type="button" onClick={onHide} aria-label="Hide the Hours back counter" title="Hide (turn it back on in Settings)" className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full ${light ? "text-[#909090] hover:bg-black/5" : "text-white/40 hover:bg-white/10"}`}><X size={15} /></button>}
  </section>;
}

// ===========================================================================
// Timed comments as their moment plays
// ===========================================================================
export type TimedComment = { id: string; author: string; body: string; t?: number | null; mine: boolean };

/** Fetches the active episode's timed comments (once per episode), for popping up as they're reached. */
export function useTimedComments(api: Api, epId: string | undefined, on: boolean) {
  const [list, setList] = useState<TimedComment[]>([]);
  const load = useCallback(() => {
    if (!epId || !on) { setList([]); return; }
    api(`/api/earshot/comments/${epId}`).then((b) => setList((b.comments || []).filter((c: TimedComment) => typeof c.t === "number"))).catch(() => setList([]));
  }, [api, epId, on]);
  useEffect(() => { load(); }, [load]);
  return { list, reload: load };
}

export function MomentBubble({ c, onOpen, onClose }: { c: TimedComment; onOpen: () => void; onClose: () => void }) {
  return <div role="status" className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl bg-black/55 py-2 pl-3 pr-1.5 text-[13px] text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md">
    <MessageCircle size={14} className="flex-none opacity-70" />
    <button type="button" onClick={onOpen} className="min-w-0 text-left"><b className="mr-1.5 font-semibold">{c.mine ? "You" : c.author}</b><span className="line-clamp-2 inline text-white/85">{c.body}</span></button>
    <button type="button" onClick={onClose} aria-label="Hide this comment" className="grid h-7 w-7 flex-none place-items-center rounded-full text-white/55 hover:bg-white/10"><X size={13} /></button>
  </div>;
}
