// Kitchen timers (a Plugin Store add-on): run several named timers at once (pasta, oven, laundry),
// each with an alarm when it's done.
import { useEffect, useRef, useState } from "react";
import { BellRing, Pause, Play, Plus, Timer, X } from "lucide-react";
import { Empty, PageHead, Panel, inputClass, primary, type SectionProps } from "./ui";

type T = { id: string; name: string; total: number; endAt: number | null; left: number; done: boolean };
const QUICK: [string, number][] = [["Eggs", 9], ["Pasta", 11], ["Rice", 18], ["Cookies", 12], ["Tea", 4], ["Laundry", 45], ["Nap", 20], ["Screen time", 30]];

function alarm() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < 6; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "square"; o.frequency.value = i % 2 ? 880 : 1046; const t = ctx.currentTime + i * 0.3; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.26); }
    window.setTimeout(() => void ctx.close(), 2500);
  } catch { /* no sound */ }
  try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch { /* no vibration */ }
}
const fmt = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };

export default function KitchenTimers({ makeId, say }: SectionProps) {
  const [timers, setTimers] = useState<T[]>([]);
  const [name, setName] = useState("");
  const [mins, setMins] = useState(10);
  const timersRef = useRef(timers);
  timersRef.current = timers;

  // Ticks from end times, so a timer stays right even if the phone sleeps for a bit.
  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now();
      // Which ones just finished, read before the update so the alarm rings exactly once.
      const rang = timersRef.current.filter((x) => x.endAt && !x.done && x.endAt <= now + 250).map((x) => x.name);
      setTimers((list) => list.map((x) => {
        if (!x.endAt || x.done) return x;
        const left = Math.max(0, Math.round((x.endAt - now) / 1000));
        if (x.endAt <= now + 250) return { ...x, left: 0, endAt: null, done: true };
        return { ...x, left };
      }));
      if (rang.length) { alarm(); say(`⏰ ${rang.join(", ")} ${rang.length === 1 ? "is" : "are"} done!`); }
    }, 500);
    return () => window.clearInterval(t);
  }, [say]);

  const start = (n: string, m: number) => { const total = Math.max(1, Math.round(m * 60)); setTimers((l) => [...l, { id: makeId(), name: n.trim() || "Timer", total, endAt: Date.now() + total * 1000, left: total, done: false }]); };
  const toggle = (id: string) => setTimers((l) => l.map((x) => (x.id !== id || x.done ? x : x.endAt ? { ...x, endAt: null } : { ...x, endAt: Date.now() + x.left * 1000 })));
  const bump = (id: string, s: number) => setTimers((l) => l.map((x) => (x.id !== id ? x : { ...x, left: x.left + s, total: x.total + s, done: false, endAt: x.endAt ? x.endAt + s * 1000 : x.done ? Date.now() + s * 1000 : null })));

  return <div className="space-y-6">
    <PageHead eyebrow="Kitchen timers" title="Timers for everything" blurb="Run as many timers as you need at once. Keep this page open and an alarm sounds when each is done." />
    <Panel title="New timer">
      <form onSubmit={(e) => { e.preventDefault(); start(name, mins); setName(""); }} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="What's it for?" className={inputClass} aria-label="Timer name" />
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><input type="number" min={1} max={600} value={mins} onChange={(e) => setMins(Math.max(1, Math.min(600, Number(e.target.value) || 1)))} className={inputClass + " px-2"} aria-label="Minutes" />min</label>
        <button type="submit" className={primary}><Play size={15} />Start</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">{QUICK.map(([n, m]) => <button key={n} type="button" onClick={() => start(n, m)} className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-700">{n} · {m}m</button>)}</div>
    </Panel>
    {timers.length ? <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{timers.map((x) => <li key={x.id} className={`rounded-[1.5rem] p-5 shadow-[0_8px_28px_#17152b14] ${x.done ? "animate-pulse bg-rose-500 text-white" : "bg-white ring-1 ring-[#e7e8f0]"}`}>
      <div className="flex items-center justify-between"><p className="font-extrabold">{x.done && <BellRing size={16} className="mr-1 inline" />}{x.name}</p><button type="button" onClick={() => setTimers((l) => l.filter((y) => y.id !== x.id))} className={`rounded-lg p-1.5 ${x.done ? "text-white/80 hover:bg-white/10" : "text-slate-300 hover:text-slate-600"}`} aria-label={`Remove ${x.name}`}><X size={15} /></button></div>
      <p className="mt-2 text-5xl font-black tabular-nums tracking-tight">{x.done ? "Done!" : fmt(x.left)}</p>
      {!x.done && <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${(1 - x.left / x.total) * 100}%` }} /></div>}
      <div className="mt-3 flex gap-2">
        {!x.done && <button type="button" onClick={() => toggle(x.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-700 hover:bg-slate-200">{x.endAt ? <><Pause size={14} />Pause</> : <><Play size={14} />Resume</>}</button>}
        <button type="button" onClick={() => bump(x.id, 60)} className={`inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold ${x.done ? "bg-white/20 hover:bg-white/30" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}><Plus size={14} />1 min</button>
      </div>
    </li>)}</ul> : <Panel><Empty icon={<Timer />} title="No timers running.">Tap a quick timer above to start one.</Empty></Panel>}
  </div>;
}
