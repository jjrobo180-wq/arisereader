// World clock (a Plugin Store add-on): the time where family and friends live, and whether it's
// a good time to call.
import { useEffect, useState } from "react";
import { Globe, X } from "lucide-react";
import { CLOCK_ZONES } from "@shared/lifePlugins";
import { Empty, PageHead, Panel, inputClass, type SectionProps } from "./ui";

const here = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } })();
const labelFor = (z: string) => CLOCK_ZONES.find((c) => c.zone === z)?.label || z.split("/").pop()!.replace(/_/g, " ");

export default function WorldClock({ family, setFamily }: SectionProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 15_000); return () => window.clearInterval(t); }, []);
  const zones = family.clocks;
  const hourIn = (z: string) => { try { return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: z }).format(now)); } catch { return 12; } };
  const diff = (z: string) => {
    try {
      const at = (tz: string) => { const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now); const g = (t: string) => Number(p.find((x) => x.type === t)?.value); return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")); };
      const h = Math.round((at(z) - at(here || "UTC")) / 3_600_000 * 2) / 2;
      return h === 0 ? "Same time" : `${h > 0 ? "+" : ""}${h} hr`;
    } catch { return ""; }
  };
  const add = (z: string) => { if (z && !zones.includes(z)) setFamily((f) => ({ ...f, clocks: [...f.clocks, z].slice(0, 12) })); };

  return <div className="space-y-6">
    <PageHead eyebrow="World clock" title="What time is it there?" blurb="Keep the time zones of family and friends handy, and see if it's a good time to call." />
    <Panel><label className="block text-xs font-bold text-slate-500">Add a city<select value="" onChange={(e) => add(e.target.value)} className={inputClass + " mt-1"}><option value="">Pick a city…</option>{CLOCK_ZONES.filter((c) => !zones.includes(c.zone)).map((c) => <option key={c.zone} value={c.zone}>{c.label}</option>)}</select></label></Panel>
    {zones.length ? <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{zones.map((z) => { const h = hourIn(z); const awake = h >= 8 && h < 21; const night = h < 6 || h >= 22; return <li key={z} className={`relative rounded-[1.5rem] p-5 shadow-[0_8px_28px_#17152b14] ${night ? "bg-[#1e1b3a] text-white" : "bg-white ring-1 ring-[#e7e8f0]"}`}>
      <button type="button" onClick={() => setFamily((f) => ({ ...f, clocks: f.clocks.filter((x) => x !== z) }))} className={`absolute right-3 top-3 rounded-lg p-1.5 ${night ? "text-white/50 hover:text-white" : "text-slate-300 hover:text-slate-600"}`} aria-label={`Remove ${labelFor(z)}`}><X size={15} /></button>
      <p className={`text-sm font-bold ${night ? "text-violet-200" : "text-slate-500"}`}>{labelFor(z)} · {diff(z)}</p>
      <p className="mt-1 text-4xl font-black tabular-nums tracking-tight">{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: z }).format(now)}</p>
      <p className={`text-sm ${night ? "text-violet-200" : "text-slate-500"}`}>{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric", timeZone: z }).format(now)}</p>
      <p className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${awake ? "bg-emerald-50 text-emerald-700" : night ? "bg-white/10 text-violet-100" : "bg-amber-50 text-amber-700"}`}>{awake ? "📞 Good time to call" : night ? "😴 Probably asleep" : "⏰ Early or late"}</p>
    </li>; })}</ul> : <Panel><Empty icon={<Globe />} title="No cities yet.">Add where your people are.</Empty></Panel>}
  </div>;
}
