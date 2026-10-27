// Pod+ Radio: live stations, including FM and AM stations' own web streams, from the free, open
// Radio Browser directory (radio-browser.info, about 50,000 stations). The page asks the directory
// directly (it allows that from any site) and plays each station's stream straight from the
// station. Only https streams that a browser can play natively are shown (no plain http, which a
// secure page can't load, and no HLS playlists). Stations come in random order, not by popularity.
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play, Radio as RadioIcon, Search, Shuffle, Square, Volume2, VolumeX } from "lucide-react";

export type Station = {
  stationuuid: string; name: string; url_resolved: string; favicon: string; tags: string;
  country: string; countrycode: string; state: string; codec: string; bitrate: number; hls: number;
};

// Radio Browser runs a few identical servers; try them in turn.
const SERVERS = ["https://de1.api.radio-browser.info", "https://de2.api.radio-browser.info", "https://fi1.api.radio-browser.info"];
let goodServer = 0;
async function ask(path: string): Promise<any> {
  let last: unknown;
  for (let i = 0; i < SERVERS.length; i++) {
    const k = (goodServer + i) % SERVERS.length;
    try {
      const r = await fetch(SERVERS[k] + path, { signal: AbortSignal.timeout(9000) });
      if (!r.ok) throw new Error(String(r.status));
      goodServer = k;
      return await r.json();
    } catch (e) { last = e; }
  }
  throw last instanceof Error ? new Error("Radio stations aren't loading right now. Try again in a moment.") : last;
}

const playable = (s: Station) => /^https:\/\//i.test(s.url_resolved || "") && !s.hls && !/\.m3u8(\?|$)/i.test(s.url_resolved);
const cleanName = (s: string) => String(s || "").replace(/\s+/g, " ").trim() || "Untitled station";
const where = (s: Station) => [s.state, s.countrycode].filter(Boolean).join(", ");
const tagsOf = (s: Station) => String(s.tags || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3).join(" · ");

function myCountry(): string {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of langs) { const m = /-([A-Za-z]{2})$/.exec(l || ""); if (m) return m[1].toUpperCase(); }
  } catch { /* no navigator */ }
  return "US";
}

const MOODS: { id: string; label: string; tag?: string }[] = [
  { id: "near", label: "Near you" },
  { id: "fm", label: "FM stations", tag: "fm" },
  { id: "news", label: "News", tag: "news" },
  { id: "talk", label: "Talk", tag: "talk" },
  { id: "sports", label: "Sports", tag: "sports" },
  { id: "hiphop", label: "Hip hop", tag: "hip hop" },
  { id: "pop", label: "Pop", tag: "pop" },
  { id: "rock", label: "Rock", tag: "rock" },
  { id: "rnb", label: "R&B", tag: "rnb" },
  { id: "jazz", label: "Jazz", tag: "jazz" },
  { id: "classical", label: "Classical", tag: "classical" },
  { id: "country", label: "Country", tag: "country" },
  { id: "latin", label: "Latin", tag: "latin" },
  { id: "lofi", label: "Lo-fi", tag: "lofi" },
  { id: "chill", label: "Chill", tag: "chillout" },
  { id: "world", label: "Around the world" },
];

export function RadioView({ onPlay, current }: { onPlay: (s: Station) => void; current: Station | null }) {
  const country = useMemo(myCountry, []);
  const [mood, setMood] = useState("near");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [list, setList] = useState<Station[] | null>(null);
  const [err, setErr] = useState("");
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    let live = true;
    setList(null); setErr("");
    const p = new URLSearchParams({ hidebroken: "true", order: "random", limit: "120" });
    if (term) { p.set("name", term); p.set("order", "random"); }
    else {
      const m = MOODS.find((x) => x.id === mood);
      if (m?.tag) p.set("tag", m.tag);
      if (mood === "near" || mood === "fm") p.set("countrycode", country);
    }
    ask(`/json/stations/search?${p}`).then((rows: Station[]) => {
      if (!live) return;
      const seen = new Set<string>();
      const out = (Array.isArray(rows) ? rows : []).filter(playable).filter((s) => { const k = cleanName(s.name).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
      setList(out.slice(0, 60));
    }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [mood, term, country, spin]);

  return <div className="px-4 pb-28 pt-3 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><RadioIcon size={24} strokeWidth={2} />Radio</h1>
        <p className="mt-1 text-sm text-[#606060]">Live FM, AM and online stations. Free, and it keeps playing with your phone locked.</p>
      </div>
      <form role="search" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }} className="flex w-full max-w-[360px] items-center">
        <label htmlFor="ps-radio-q" className="sr-only">Find a station</label>
        <input id="ps-radio-q" type="search" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTerm(""); }} placeholder="Find a station (e.g. KEXP, 97.1)" className="h-10 min-w-0 flex-1 rounded-l-full border border-r-0 border-[#d3d3d3] px-4 text-sm outline-none focus:border-[#1c62b9]" />
        <button type="submit" aria-label="Find station" className="inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-r-full border border-[#d3d3d3] bg-[#f8f8f8]"><Search size={18} /></button>
      </form>
    </div>

    <div role="group" aria-label="Station types" className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {MOODS.map((m) => {
        const on = !term && mood === m.id;
        return <button key={m.id} onClick={() => { setTerm(""); setQ(""); setMood(m.id); }} aria-pressed={on} className={`h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium ${on ? "bg-[#0f0f0f] text-white" : "bg-[#f2f2f2] hover:bg-[#e5e5e5]"}`}>{m.label}</button>;
      })}
      <button onClick={() => setSpin((n) => n + 1)} className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-[#065fd4] hover:bg-[#def1ff]"><Shuffle size={15} />Shuffle</button>
    </div>

    {err ? <div className="py-20 text-center"><p className="text-[#606060]">{err}</p><button onClick={() => setSpin((n) => n + 1)} className="mt-4 h-9 rounded-full bg-[#0f0f0f] px-4 text-sm font-semibold text-white">Try again</button></div>
      : !list ? <div className="flex justify-center py-24" role="status" aria-label="Loading stations"><Loader2 className="animate-spin text-[#606060]" size={28} /></div>
      : !list.length ? <p className="py-20 text-center text-[#606060]">{term ? `No stations called “${term}”.` : "No stations here right now."} Try another one.</p>
      : <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))]">
        {list.map((s) => {
          const on = current?.stationuuid === s.stationuuid;
          return <button key={s.stationuuid} onClick={() => onPlay(s)} aria-pressed={on} className={`flex min-w-0 items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${on ? "bg-[#fff1e8] ring-1 ring-[#ff6a1f]" : "bg-[#f7f7f5] hover:bg-[#efefec]"}`}>
            <Logo s={s} size={52} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold">{cleanName(s.name)}</span>
              <span className="truncate text-xs text-[#606060]">{where(s) || s.country}</span>
              {tagsOf(s) && <span className="truncate text-xs text-[#606060]">{tagsOf(s)}</span>}
            </span>
          </button>;
        })}
      </div>}
    <p className="mt-8 text-xs text-[#767676]">Station list from <a href="https://www.radio-browser.info" target="_blank" rel="noreferrer" className="underline">Radio Browser</a>, a free community directory.</p>
  </div>;
}

function Logo({ s, size }: { s: Station; size: number }) {
  const [bad, setBad] = useState(false);
  const src = /^https:\/\//i.test(s.favicon || "") ? s.favicon : "";
  const initials = cleanName(s.name).replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "FM";
  return <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-sm font-bold text-[#0f0f0f] ring-1 ring-black/5" style={{ width: size, height: size }}>
    {src && !bad ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className="h-full w-full object-contain p-1" /> : initials}
  </span>;
}

/** The bar at the bottom while a station plays. Stays while browsing the rest of the home page. */
export function RadioBar({ station, onStop, say }: { station: Station; onStop: () => void; say: (m: string) => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    setLoading(true); setTitle("");
    const a = audio.current; if (!a) return;
    a.src = station.url_resolved;
    a.play().catch(() => { setLoading(false); say("Tap play to start the station."); });
    // Counts a listen in the directory (it asks apps to, once per play).
    ask(`/json/url/${station.stationuuid}`).catch(() => {});
    try {
      if ("mediaSession" in navigator) {
        const art = /^https:\/\//i.test(station.favicon || "") ? station.favicon : "";
        navigator.mediaSession.metadata = new MediaMetadata({ title: cleanName(station.name), artist: where(station) || "Live radio", album: "Pod+ Radio", artwork: art ? [{ src: art }] : [] });
        navigator.mediaSession.setActionHandler("play", () => { audio.current?.play().catch(() => {}); });
        navigator.mediaSession.setActionHandler("pause", () => audio.current?.pause());
        navigator.mediaSession.setActionHandler("stop", () => onStop());
      }
    } catch { /* older browsers */ }
    return () => { a.pause(); a.removeAttribute("src"); a.load(); };
  }, [station, say, onStop]);

  const toggle = () => {
    const a = audio.current; if (!a) return;
    if (a.paused) {
      // Live radio: start again at the live edge, not where it was paused.
      setLoading(true); a.src = station.url_resolved;
      a.play().catch(() => { setLoading(false); say("This station isn't playing right now. Try another one."); });
    } else a.pause();
  };

  return <div role="region" aria-label="Now playing radio" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e5e5] bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur">
    <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2.5 sm:px-5">
      <Logo s={station} size={44} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#c2410c]"><span className={`h-2 w-2 rounded-full bg-[#ff3b30] ${playing ? "motion-safe:animate-pulse" : "opacity-40"}`} />Live</span>
        <span className="truncate text-sm font-semibold">{cleanName(station.name)}</span>
        <span className="truncate text-xs text-[#606060]">{title || where(station) || station.country}</span>
      </div>
      <button onClick={() => { const a = audio.current; if (a) { a.muted = !a.muted; setMuted(a.muted); } }} aria-label={muted ? "Unmute" : "Mute"} className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] sm:inline-flex">{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
      <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#0f0f0f] text-white">{loading && !playing ? <Loader2 className="animate-spin" size={20} /> : playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}</button>
      <button onClick={onStop} aria-label="Stop radio" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><Square size={16} fill="currentColor" /></button>
      <audio ref={audio} preload="none"
        onPlaying={() => { setPlaying(true); setLoading(false); }} onPause={() => setPlaying(false)} onWaiting={() => setLoading(true)}
        onError={() => { setPlaying(false); setLoading(false); if (audio.current?.getAttribute("src")) say("This station isn't playing right now. Try another one."); }}
        onLoadedMetadata={() => setTitle("")} />
    </div>
  </div>;
}
