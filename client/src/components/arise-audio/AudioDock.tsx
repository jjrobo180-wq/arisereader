// What's playing from Radio or Audiobooks, in a To Duo card above every page (duoAudio.ts), so it keeps
// playing, and stays in reach, while the person uses the rest of To Duo. Tapping it opens the plugin.
import { useState } from "react";
import { Loader2, Moon, Pause, Play, Radio, RotateCcw, RotateCw, SkipBack, SkipForward, X } from "lucide-react";
import { RATES, duoAudio, useDuoAudio } from "./duoAudio";

export const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
};
const SLEEPS: [string, number | null][] = [["Off", null], ["15 min", 15], ["30 min", 30], ["45 min", 45], ["1 hour", 60]];
const round = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 disabled:opacity-30";

export default function AudioDock({ open, current }: { open: (section: "podradio" | "audiobooks") => void; current: string }) {
  const s = useDuoAudio();
  const [more, setMore] = useState(false);
  const tr = s.track;
  if (!tr) return null;
  const here = current === tr.section;
  const pct = s.d ? Math.min(100, (s.t / s.d) * 100) : 0;
  return <section aria-label="Now playing" data-testid="duo-audio-dock"
    className="sticky top-2 z-20 mb-4 overflow-hidden rounded-[1.25rem] border border-[#e7e8f0] bg-white/95 shadow-[0_8px_28px_#17152b14] backdrop-blur">
    <div className="flex items-center gap-3 p-2.5 pr-2">
      <button type="button" onClick={() => open(tr.section)} disabled={here} aria-label={here ? undefined : `Open ${tr.kind === "radio" ? "Radio" : "Audiobooks"}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default">
        {tr.art ? <img src={tr.art} alt="" referrerPolicy="no-referrer" className="h-11 w-11 shrink-0 rounded-xl bg-slate-100 object-cover" />
          : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><Radio size={20} /></span>}
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 truncate text-sm font-bold text-[#232139]">
            {tr.live && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-1.5 text-[10px] font-black uppercase tracking-wide text-rose-600"><span className="h-1.5 w-1.5 rounded-full bg-rose-500 motion-safe:animate-pulse" />Live</span>}
            <span className="truncate">{tr.title}</span>
          </span>
          <span className="block truncate text-xs font-medium text-slate-500">{s.error || (tr.live ? tr.sub : `${tr.sub}${s.d ? ` · ${clock(s.t)} / ${clock(s.d)}` : ""}`)}</span>
        </span>
      </button>
      {!tr.live && <button type="button" onClick={() => duoAudio.skip(-15)} aria-label="Back 15 seconds" className={`${round} hidden sm:grid`}><RotateCcw size={17} /></button>}
      {tr.onPrev && <button type="button" onClick={tr.onPrev} aria-label="Previous chapter" className={`${round} hidden sm:grid`}><SkipBack size={17} /></button>}
      <button type="button" onClick={duoAudio.toggle} aria-label={s.playing ? "Pause" : "Play"} data-testid="duo-audio-toggle"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#6e5ae0] text-white shadow-sm transition hover:bg-[#5948c8]">
        {s.loading && !s.playing ? <Loader2 size={18} className="animate-spin" /> : s.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-px" />}
      </button>
      {tr.onNext && <button type="button" onClick={tr.onNext} aria-label="Next chapter" className={`${round} hidden sm:grid`}><SkipForward size={17} /></button>}
      {!tr.live && <button type="button" onClick={() => duoAudio.skip(30)} aria-label="Forward 30 seconds" className={`${round} hidden sm:grid`}><RotateCw size={17} /></button>}
      {!tr.live && <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} aria-label="Speed and sleep timer"
        className="h-10 shrink-0 rounded-full px-2.5 text-xs font-black tabular-nums text-slate-600 hover:bg-slate-100">{s.rate}×</button>}
      <button type="button" onClick={duoAudio.stop} aria-label="Stop" data-testid="duo-audio-stop" className={round}><X size={17} /></button>
    </div>
    {!tr.live && s.d > 0 && <input type="range" min={0} max={Math.round(s.d)} value={Math.round(s.t)} onChange={(e) => duoAudio.seek(Number(e.target.value))} aria-label="Position"
      className="block h-1 w-full cursor-pointer appearance-none bg-slate-100 accent-[#6e5ae0]" style={{ background: `linear-gradient(to right,#6e5ae0 ${pct}%,#eef0f6 ${pct}%)` }} />}
    {more && !tr.live && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-3 py-2.5 text-xs font-bold text-slate-500">
      <span className="flex items-center gap-1">Speed
        {RATES.map((r) => <button key={r} type="button" onClick={() => duoAudio.setRate(r)} aria-pressed={s.rate === r}
          className={`h-8 rounded-full px-2.5 tabular-nums ${s.rate === r ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{r}×</button>)}
      </span>
      <span className="flex items-center gap-1"><Moon size={14} />Sleep
        {SLEEPS.map(([label, m]) => { const on = m == null ? s.sleepAt == null : false; return <button key={label} type="button" onClick={() => duoAudio.sleepIn(m)} aria-pressed={on}
          className={`h-8 rounded-full px-2.5 ${on ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{label}</button>; })}
        {s.sleepAt && <span className="ml-1 font-semibold text-violet-700">Stops at {new Date(s.sleepAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
      </span>
    </div>}
  </section>;
}
