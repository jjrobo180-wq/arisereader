// Radio, a Premium plugin of its own in To Duo (it was a page inside Podster until Nov 15, 2026). Live
// stations from the free Radio Browser directory, played from each station's own stream through To Duo's
// player (duoAudio.ts), so they keep playing on every other page. Saved stations stay on this device.
import { useEffect, useMemo, useState } from "react";
import { Heart, Loader2, Pause, Play, Radio as RadioIcon, Search, Shuffle } from "lucide-react";
import { superAppOf } from "@shared/superApps";
import { MOODS, ask, cleanName, fullTimeNews, myCountry, playable, tagsOf, where, type Station } from "../../../../podscroll/Radio";
import { Empty, inputClass, plain } from "@/components/family-hub/ui";
import { PageStrip, SuperHead } from "@/components/super-apps/SuperShell";
import { duoAudio, useDuoAudio } from "./duoAudio";

const SAVED = "duo.radio.saved";
const readSaved = (): Station[] => { try { const v = JSON.parse(localStorage.getItem(SAVED) || "[]"); return Array.isArray(v) ? v.filter((s) => s?.stationuuid && s?.url_resolved) : []; } catch { return []; } };
const writeSaved = (list: Station[]) => { try { localStorage.setItem(SAVED, JSON.stringify(list.slice(0, 60))); } catch { /* private window */ } };
const logoOf = (s: Station) => (/^https:\/\//i.test(s.favicon || "") ? s.favicon : "");

export function playStation(s: Station) {
  duoAudio.play({ kind: "radio", section: "podradio", key: `radio:${s.stationuuid}`, title: cleanName(s.name), sub: where(s) || s.country || "Live radio", art: logoOf(s) || undefined, src: s.url_resolved, live: true });
}

function Logo({ s }: { s: Station }) {
  const [bad, setBad] = useState(false);
  const src = logoOf(s);
  const initials = cleanName(s.name).replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "FM";
  return <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-50 text-sm font-black text-slate-600 ring-1 ring-slate-100">
    {src && !bad ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className="h-full w-full object-contain p-1.5" /> : initials}
  </span>;
}

function StationCard({ s, saved, onSave }: { s: Station; saved: boolean; onSave: () => void }) {
  const a = useDuoAudio();
  const on = a.track?.key === `radio:${s.stationuuid}`;
  const tags = tagsOf(s);
  return <div className={`flex min-w-0 items-center gap-3 rounded-[1.25rem] border bg-white p-3 transition ${on ? "border-violet-300 ring-2 ring-violet-100" : "border-[#e7e8f0] hover:border-violet-200"}`} data-testid="radio-station">
    <button type="button" onClick={() => (on ? duoAudio.toggle() : playStation(s))} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${on && a.playing ? "Pause" : "Play"} ${cleanName(s.name)}`}>
      <Logo s={s} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-[#232139]">{cleanName(s.name)}</span>
        <span className="block truncate text-xs font-medium text-slate-500">{where(s) || s.country}</span>
        {tags && <span className="block truncate text-xs text-slate-400">{tags}</span>}
      </span>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${on ? "bg-[#6e5ae0] text-white" : "bg-violet-50 text-violet-700"}`}>
        {on && a.loading && !a.playing ? <Loader2 size={16} className="animate-spin" /> : on && a.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="translate-x-px" />}
      </span>
    </button>
    <button type="button" onClick={onSave} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save station"} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-500">
      <Heart size={17} className={saved ? "fill-rose-500 text-rose-500" : ""} />
    </button>
  </div>;
}

function useStations(path: string | null, pick: (rows: Station[]) => Station[], spin: number) {
  const [list, setList] = useState<Station[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!path) return;
    let live = true;
    setList(null); setErr("");
    ask(path).then((rows: Station[]) => {
      if (!live) return;
      const seen = new Set<string>();
      const out = (Array.isArray(rows) ? rows : []).filter(playable).filter((s) => { const k = cleanName(s.name).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
      setList(pick(out));
    }).catch((e) => { if (live) setErr(e?.message || "Radio stations aren't loading right now."); });
    return () => { live = false; };
  }, [path, spin]); // eslint-disable-line react-hooks/exhaustive-deps
  return { list, err };
}

export default function RadioApp({ start }: { start?: string | null }) {
  const app = superAppOf("podradio")!;
  const country = useMemo(myCountry, []);
  const [page, setPage] = useState(start && app.pages.some((p) => p.id === start) ? start : "stations");
  const [mood, setMood] = useState("near");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [spin, setSpin] = useState(0);
  const [saved, setSaved] = useState<Station[]>(readSaved);
  const isSaved = (s: Station) => saved.some((x) => x.stationuuid === s.stationuuid);
  const toggleSave = (s: Station) => setSaved((l) => { const next = isSaved(s) ? l.filter((x) => x.stationuuid !== s.stationuuid) : [s, ...l]; writeSaved(next); return next; });

  const stationsPath = useMemo(() => {
    if (page !== "stations") return null;
    const p = new URLSearchParams({ hidebroken: "true", order: "random", limit: "120" });
    if (term) p.set("name", term);
    else {
      const m = MOODS.find((x) => x.id === mood);
      if (m?.tag) p.set("tag", m.tag);
      if (mood === "near" || mood === "fm") p.set("countrycode", country);
    }
    return `/json/stations/search?${p}`;
  }, [page, term, mood, country]);
  const stations = useStations(stationsPath, (l) => l.slice(0, 60), spin);
  const news = useStations(page === "news" ? `/json/stations/search?${new URLSearchParams({ hidebroken: "true", tag: "news", order: "votes", reverse: "true", limit: "400" })}` : null,
    (l) => l.filter(fullTimeNews).sort((a, b) => (Number(b.countrycode === country) - Number(a.countrycode === country)) || ((b.votes || 0) - (a.votes || 0))).slice(0, 80), spin);

  const grid = (r: { list: Station[] | null; err: string }, empty: string) => r.err
    ? <div className="py-14 text-center"><p className="text-sm font-semibold text-slate-500">{r.err}</p><button type="button" onClick={() => setSpin((n) => n + 1)} className={`${plain} mt-3`}>Try again</button></div>
    : !r.list ? <div className="grid min-h-[30vh] place-items-center" role="status" aria-label="Loading stations"><Loader2 className="animate-spin text-violet-600" size={26} /></div>
    : !r.list.length ? <p className="py-14 text-center text-sm font-semibold text-slate-500">{empty}</p>
    : <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{r.list.map((s) => <StationCard key={s.stationuuid} s={s} saved={isSaved(s)} onSave={() => toggleSave(s)} />)}</div>;

  return <div data-testid="super-app-podradio">
    <SuperHead app={app} />
    <PageStrip app={app} pages={app.pages.map((p) => p.id)} current={page} onPick={(id) => { setPage(id); window.scrollTo({ top: 0 }); }} badges={{ saved: saved.length }} />
    {page === "stations" && <div className="space-y-4">
      <form role="search" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }} className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Find a station</span>
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTerm(""); }} placeholder="Find a station (KEXP, 97.1…)" className={`${inputClass} pl-9`} />
        </label>
        <button type="button" onClick={() => setSpin((n) => n + 1)} className={plain} aria-label="Shuffle stations"><Shuffle size={16} /><span className="hidden sm:inline">Shuffle</span></button>
      </form>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Kinds of stations">
        {MOODS.map((m) => { const on = !term && mood === m.id; return <button key={m.id} type="button" aria-pressed={on} onClick={() => { setTerm(""); setQ(""); setMood(m.id); }}
          className={`min-h-9 shrink-0 rounded-full px-3.5 text-sm font-bold transition ${on ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{m.label}</button>; })}
      </div>
      {grid(stations, term ? `No stations called “${term}”. Try another name.` : "No stations here right now. Try another kind.")}
    </div>}
    {page === "news" && <div className="space-y-4">
      <p className="text-sm text-slate-500">Stations that are news all day, live from their own streams. Stations from your country first.</p>
      {grid(news, "No news stations are on the air right now. Try again in a little while.")}
    </div>}
    {page === "saved" && (saved.length
      ? <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{saved.map((s) => <StationCard key={s.stationuuid} s={s} saved onSave={() => toggleSave(s)} />)}</div>
      : <Empty icon={<RadioIcon size={26} />} title="No saved stations yet">Tap the heart on a station to keep it here.</Empty>)}
    <p className="mt-8 text-xs text-slate-400">Stations from <a href="https://www.radio-browser.info" target="_blank" rel="noreferrer" className="underline">Radio Browser</a>, a free community directory. Each plays from the station's own stream.</p>
  </div>;
}
