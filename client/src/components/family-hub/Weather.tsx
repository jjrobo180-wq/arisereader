// Weather (a Plugin Store add-on): right now and the next 7 days for your town (Open-Meteo).
import { useState, type FormEvent } from "react";
import { CloudSun, Droplets, MapPin, RefreshCw, Wind } from "lucide-react";
import { weatherCode, type Forecast } from "@shared/lifePlugins";
import { useLifeFeed } from "./useLifeFeed";
import { Empty, PageHead, Panel, inputClass, plain, primary, type SectionProps } from "./ui";

export default function Weather({ family, setFamily }: SectionProps) {
  const prefs = family.weather;
  const [draft, setDraft] = useState(prefs.place);
  const [round, setRound] = useState(0);
  const feed = useLifeFeed<Forecast>(prefs.place ? `/api/lifehub/weather?place=${encodeURIComponent(prefs.place)}&unit=${prefs.unit}` : null, round);
  const setPrefs = (p: Partial<typeof prefs>) => setFamily((f) => ({ ...f, weather: { ...f.weather, ...p } }));
  const w = feed.data, now = w ? weatherCode(w.current.code) : null;
  const save = (e: FormEvent) => { e.preventDefault(); if (draft.trim()) setPrefs({ place: draft.trim() }); };

  return <div className="space-y-6">
    <PageHead eyebrow="Weather" title={w ? w.place.split(",")[0] : "Weather"} blurb="Right now and the week ahead, so you know what to wear and when to plan the picnic."
      action={prefs.place ? <div className="flex gap-2"><div className="inline-flex rounded-xl bg-slate-100 p-1">{(["F", "C"] as const).map((u) => <button key={u} type="button" onClick={() => setPrefs({ unit: u })} aria-pressed={prefs.unit === u} className={`min-h-9 rounded-lg px-3 text-sm font-bold ${prefs.unit === u ? "bg-white shadow-sm" : "text-slate-500"}`}>°{u}</button>)}</div><button type="button" onClick={() => setRound((r) => r + 1)} className={plain + " px-2.5"} aria-label="Refresh"><RefreshCw size={16} className={feed.busy ? "animate-spin" : ""} /></button></div> : undefined} />
    <Panel>
      <form onSubmit={save} className="flex gap-2"><label className="relative min-w-0 flex-1"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} placeholder="Your town (Denver, CO)" className={inputClass + " pl-9"} aria-label="Town or city" /></label><button type="submit" className={primary} disabled={!draft.trim() || draft.trim() === prefs.place}>{prefs.place ? "Change" : "Show weather"}</button></form>
    </Panel>
    {!prefs.place ? <Panel><Empty icon={<CloudSun />} title="Where are you?">Type your town above to see the forecast.</Empty></Panel>
      : feed.busy && !w ? <p className="flex items-center gap-2 text-sm text-slate-500"><RefreshCw size={15} className="animate-spin" />Checking the sky…</p>
      : feed.error ? <Panel><p className="text-sm text-rose-700" role="alert">{feed.error}</p></Panel>
      : w && now && <>
        <section className="rounded-[2rem] bg-gradient-to-br from-sky-400 to-indigo-500 p-7 text-white shadow-[0_18px_40px_#4f46e533] sm:p-9">
          <p className="text-sm font-bold text-sky-100">{w.place}</p>
          <div className="mt-2 flex flex-wrap items-center gap-6">
            <span className="text-7xl" aria-hidden>{now.icon}</span>
            <div><p className="text-7xl font-black tracking-tighter">{w.current.temp}°</p><p className="text-lg font-bold">{now.text}</p></div>
            <dl className="ml-auto grid grid-cols-1 gap-1 text-sm font-bold text-sky-50">
              <div>Feels like {w.current.feels}°</div>
              <div className="flex items-center gap-1.5"><Wind size={15} />{w.current.wind} {w.unit === "F" ? "mph" : "km/h"}</div>
              <div className="flex items-center gap-1.5"><Droplets size={15} />{w.current.humidity}% humidity</div>
            </dl>
          </div>
        </section>
        <Panel title="Next 7 days">
          <ul className="divide-y divide-slate-100">{w.days.map((d, i) => { const c = weatherCode(d.code); return <li key={d.date} className="flex items-center gap-3 py-2.5">
            <span className="w-24 text-sm font-extrabold">{i === 0 ? "Today" : new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" })}</span>
            <span className="text-2xl" aria-hidden>{c.icon}</span>
            <span className="min-w-0 flex-1 text-sm text-slate-500">{c.text}{d.rain >= 20 ? ` · ${d.rain}% rain` : ""}</span>
            <span className="text-sm font-black tabular-nums">{d.high}°</span><span className="w-10 text-right text-sm font-bold tabular-nums text-slate-400">{d.low}°</span>
          </li>; })}</ul>
          <p className="mt-3 text-[11px] text-slate-400">Weather data by Open-Meteo.com</p>
        </Panel>
      </>}
  </div>;
}
