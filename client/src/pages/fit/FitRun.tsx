// Arise Fit outdoors: GPS run, walk and hike tracking on a live dark map, splits and pace, your route
// history, and a trail finder covering every trail mapped in OpenStreetMap (all over the US), by your
// location or any place you search. Maps: Leaflet with CARTO's dark tiles (© OpenStreetMap contributors).
import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Flag, Footprints, LocateFixed, MapPin, Mountain, Pause, Play, Route, Search, Square, Trophy } from "lucide-react";
import type { FitData } from "@shared/fit";
import { uid } from "@shared/fit";
import { MILE, NOMINATIM, OVERPASS, acceptFix, distLabel, haversine, pace, parseGeometry, parseTrails, runCalories, shrinkPath, splits, trailGeometryQuery, trailsQuery, type LatLng, type Run, type RunKind, type Trail } from "@shared/fitRun";
import { sayAI } from "@/lib/aiVoice";
import { saveToHealth } from "./fitNative";
import type { Update } from "./fitStore";
import { latestKg } from "./FitFood";
import { Btn, C, Card, Chips, Sheet, Title, display, fmtDur, font, inputCls, inputStyle } from "./fitUi";

// ——— Leaflet, loaded once from cdnjs ————————————————————————————————————————————————————————————
let leaflet: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  leaflet ??= new Promise((ok, fail) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
    const js = document.createElement("script"); js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"; js.async = true;
    js.onload = () => ok((window as any).L); js.onerror = () => { leaflet = null; fail(new Error("The map couldn't load. Check your connection.")); };
    document.head.appendChild(js);
  });
  return leaflet;
}

/** A dark map with an optional live route, trail lines and a "you are here" dot. */
function MapView({ path = [], lines = [], here, follow = false, className = "h-64", fit }: { path?: LatLng[]; lines?: LatLng[][]; here?: LatLng; follow?: boolean; className?: string; fit?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const layers = useRef<{ route?: any; trail?: any; dot?: any }>({});
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    loadLeaflet().then((L) => {
      if (!live || !box.current || map.current) return;
      map.current = L.map(box.current, { zoomControl: false, attributionControl: true }).setView(here ?? path[0] ?? lines[0]?.[0] ?? [39.5, -98.35], here || path.length || lines.length ? 15 : 4);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, subdomains: "abcd", attribution: "© OpenStreetMap contributors © CARTO" }).addTo(map.current);
      setTimeout(() => map.current?.invalidateSize(), 50);
    }).catch((e) => live && setErr(e.message));
    return () => { live = false; try { map.current?.remove(); } catch { /* gone */ } map.current = null; layers.current = {}; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const L = (window as any).L, m = map.current; if (!L || !m) return;
    const l = layers.current;
    l.trail?.remove(); l.trail = lines.length ? L.polyline(lines, { color: "#b9c0c8", weight: 5, opacity: 0.55, dashArray: "6 8" }).addTo(m) : undefined;
    // A finished route draws itself in (fit-route); a live one just grows as you move.
    l.route?.remove(); l.route = path.length > 1 ? L.polyline(path, { color: "#ff5a1f", weight: 5, opacity: 0.95, ...(fit ? { className: "fit-route" } : {}) }).addTo(m) : undefined;
    l.dot?.remove(); const at = here ?? path[path.length - 1];
    l.dot = at ? L.circleMarker(at, { radius: 8, color: "#fff", weight: 3, fillColor: "#ff5a1f", fillOpacity: 1 }).addTo(m) : undefined;
    if (fit && (l.trail || l.route)) { try { m.fitBounds((l.route ?? l.trail).getBounds(), { padding: [24, 24] }); } catch { /* empty */ } }
    else if (follow && at) m.setView(at, Math.max(m.getZoom(), 16), { animate: true });
  }, [path, lines, here, follow, fit]);
  return <div className={`relative overflow-hidden rounded-[14px] ${className}`} style={{ background: "#121316" }}>
    <div ref={box} className="absolute inset-0" />
    {err && <p className="absolute inset-0 grid place-items-center px-4 text-center text-[14px]" style={{ color: C.dim }}>{err}</p>}
  </div>;
}

const unitOf = (d: FitData): "mi" | "km" => (d.profile.units === "kg" ? "km" : "mi");
const KIND_LABEL: Record<RunKind, string> = { run: "Run", walk: "Walk", hike: "Hike" };

// ——— The tracker ——————————————————————————————————————————————————————————————————————————————————
export function RunTracker({ data, update, onClose, say, trail }: { data: FitData; update: Update; onClose: () => void; say: (m: string) => void; trail?: { name: string; lines: LatLng[][] } }) {
  const unit = unitOf(data);
  const [kind, setKind] = useState<RunKind>(trail ? "hike" : "run");
  const [state, setState] = useState<"ready" | "running" | "paused" | "done">("ready");
  const [points, setPoints] = useState<{ at: number; ll: LatLng }[]>([]);
  const [here, setHere] = useState<LatLng | undefined>();
  const [acc, setAcc] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const run = useRef({ started: 0, pausedMs: 0, pausedAt: 0 });
  const stateRef = useRef(state); stateRef.current = state;
  const meters = useMemo(() => points.reduce((t, p, i) => (i ? t + haversine(points[i - 1].ll, p.ll) : 0), 0), [points]);
  const secs = state === "ready" ? 0 : Math.max(0, ((state === "paused" || state === "done" ? run.current.pausedAt : now) - run.current.started - run.current.pausedMs) / 1000);
  const sp = useMemo(() => splits(points, unit), [points, unit]);
  const lastSplitAnnounced = useRef(0);

  // Location: watched the whole time this screen is open (so "ready" shows where you are).
  useEffect(() => {
    if (!navigator.geolocation) { setErr("This device can't share its location."); return; }
    const id = navigator.geolocation.watchPosition((pos) => {
      const ll: LatLng = [pos.coords.latitude, pos.coords.longitude];
      setHere(ll); setAcc(Math.round(pos.coords.accuracy)); setErr("");
      if (stateRef.current !== "running") return;
      setPoints((ps) => { const last = ps[ps.length - 1]; return acceptFix(last?.ll, ll, pos.coords.accuracy, last ? (pos.timestamp - last.at) / 1000 : 0) ? [...ps, { at: pos.timestamp, ll }] : ps; });
    }, (e) => setErr(e.code === 1 ? "Location is off for Arise Fit. Turn it on in Settings → Arise Fit → Location." : "Looking for GPS… step outside for a clear view of the sky."), { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    let lock: any = null; (navigator as any).wakeLock?.request?.("screen").then((l: any) => { lock = l; }).catch(() => {});
    return () => { navigator.geolocation.clearWatch(id); try { lock?.release?.(); } catch { /* gone */ } };
  }, []);
  useEffect(() => { if (state !== "running") return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [state]);
  useEffect(() => { if (sp.length > lastSplitAnnounced.current) { lastSplitAnnounced.current = sp.length; navigator.vibrate?.([200, 80, 200]); const line = `${unit === "mi" ? "Mile" : "Kilometer"} ${sp.length}: ${fmtDur(sp[sp.length - 1])}`; say(line); void sayAI(`${unit === "mi" ? "Mile" : "Kilometer"} ${sp.length}. Split ${Math.floor(sp[sp.length - 1] / 60)} minutes ${sp[sp.length - 1] % 60} seconds.`, { voice: "troy" }).catch(() => {}); } }, [sp, unit, say]);

  const start = () => { run.current = { started: Date.now(), pausedMs: 0, pausedAt: 0 }; setPoints(here ? [{ at: Date.now(), ll: here }] : []); setState("running"); navigator.vibrate?.(60); };
  const pause = () => { run.current.pausedAt = Date.now(); setState("paused"); };
  const resume = () => { run.current.pausedMs += Date.now() - run.current.pausedAt; setState("running"); };
  const finish = () => { if (state === "running") run.current.pausedAt = Date.now(); setState("done"); };
  const save = () => {
    const r: Run = { id: uid(), date: new Date(run.current.started).toISOString(), kind, secs: Math.round(secs), meters: Math.round(meters), path: shrinkPath(points.map((p) => p.ll)), ...(trail ? { trail: trail.name } : {}) };
    update((d) => ({ ...d, runs: [...(d.runs ?? []), r].slice(-300), workouts: [...d.workouts, { id: r.id, date: r.date, name: `${trail ? trail.name : `Outdoor ${KIND_LABEL[kind].toLowerCase()}`} · ${distLabel(r.meters, unit)} ${unit}`, programId: "outdoor", dayId: r.id, secs: r.secs, exercises: [] }] }));
    const started = new Date(run.current.started), ended = new Date(run.current.started + r.secs * 1000);
    saveToHealth("distance", r.meters, started, ended); saveToHealth("calories", runCalories(kind, r.meters, latestKg(data)), started, ended);
    say("Saved to your history."); onClose();
  };
  const path = points.map((p) => p.ll);

  return <div className="fit-sheet fixed inset-0 z-[85] flex flex-col" style={{ background: C.bg, color: C.text, ...font }} data-testid="fit-run">
    <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
      <button type="button" onClick={() => { if (state === "ready" || window.confirm("Stop tracking? This run won't be saved.")) onClose(); }} className="h-11 rounded-full px-4 text-[15px] font-semibold" style={{ background: C.card }}>{state === "ready" ? "Close" : "Discard"}</button>
      <p className="min-w-0 flex-1 truncate text-center text-[20px]" style={display}>{trail ? trail.name : `Outdoor ${KIND_LABEL[kind]}`}</p>
      <span className="flex h-11 items-center gap-1 rounded-full px-3 text-[12px] font-semibold" style={{ background: C.card, color: acc !== null && acc <= 20 ? "#4ade80" : acc !== null && acc <= 35 ? C.orange : C.dim }}><Crosshair className="h-4 w-4" />{acc !== null ? `±${acc}m` : "GPS"}</span>
    </div>
    <div className="px-3"><MapView path={path} lines={trail?.lines} here={here} follow={state === "running"} fit={state === "done"} className="h-[42vh]" /></div>
    {err && <p className="mx-3 mt-2 rounded-[10px] px-3 py-2 text-[13px]" style={{ background: "rgba(255,59,48,.12)", color: "#ff8a80" }}>{err}</p>}
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
      {state === "ready" && <div className="mt-3"><Chips label="Activity" value={kind} onChange={setKind} items={(["run", "walk", "hike"] as RunKind[]).map((k) => ({ id: k, label: KIND_LABEL[k] }))} /></div>}
      <div className="mt-4 text-center">
        <p className="text-[84px] leading-none tabular-nums transition-all" style={display} data-testid="fit-run-distance">{distLabel(meters, unit)}</p>
        <p className="text-[13px] uppercase tracking-[.2em]" style={{ color: C.dim }}>{unit === "mi" ? "miles" : "kilometers"}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {([[fmtDur(secs), "time"], [pace(secs, meters, unit), `pace /${unit}`], [String(runCalories(kind, meters, latestKg(data))), "kcal"]] as const).map(([v, l]) => <Card key={l} className="!px-1 !py-3"><p className="text-[28px] leading-none tabular-nums" style={display}>{v}</p><p className="mt-1 text-[11px] uppercase tracking-[.1em]" style={{ color: C.dim }}>{l}</p></Card>)}
      </div>
      {sp.length > 0 && <><Title>Splits</Title><Card className="!p-2">{sp.map((s, i) => <div key={i} className="flex items-center justify-between px-2 py-1.5 text-[15px]" style={i ? { borderTop: `1px solid ${C.line}` } : undefined}><span style={{ color: C.dim }}>{unit === "mi" ? "Mile" : "Km"} {i + 1}</span><span className="tabular-nums" style={display}>{fmtDur(s)}</span></div>)}</Card></>}
      {state === "done" && <div className="mt-5 space-y-2">
        <Btn className="w-full" onClick={save} disabled={meters < 20} testId="fit-run-save"><Trophy className="h-5 w-5" />Save {KIND_LABEL[kind].toLowerCase()}</Btn>
        {meters < 20 && <p className="text-center text-[13px]" style={{ color: C.dim }}>Too short to save.</p>}
        <Btn kind="soft" className="w-full" onClick={resume}>Keep going</Btn>
      </div>}
      <p className="mt-6 text-center text-[11px] leading-relaxed" style={{ color: C.dim }}>Keep Arise Fit open with the screen on while you track. Maps © OpenStreetMap contributors © CARTO.</p>
    </div>
    {state !== "done" && <div className="flex shrink-0 items-center justify-center gap-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-2">
      {state === "ready" && <button type="button" onClick={start} disabled={!here} className="fit-pop grid h-24 w-24 place-items-center rounded-full text-[26px] shadow-[0_12px_36px_rgba(255,90,31,.45)] active:scale-95 disabled:opacity-40" style={{ ...display, background: C.lime, color: "#0b0b0c" }} data-testid="fit-run-start">Go</button>}
      {state === "running" && <button type="button" onClick={pause} aria-label="Pause" className="grid h-20 w-20 place-items-center rounded-full" style={{ background: C.card2 }}><Pause className="h-9 w-9" fill="currentColor" /></button>}
      {state === "paused" && <><button type="button" onClick={resume} aria-label="Resume" className="grid h-20 w-20 place-items-center rounded-full" style={{ background: C.lime, color: "#0b0b0c" }}><Play className="ml-1 h-9 w-9" fill="currentColor" /></button>
        <button type="button" onClick={finish} aria-label="Finish" className="grid h-20 w-20 place-items-center rounded-full" style={{ background: C.red }} data-testid="fit-run-finish"><Square className="h-8 w-8" fill="currentColor" /></button></>}
    </div>}
  </div>;
}

// ——— Trails ————————————————————————————————————————————————————————————————————————————————————————
async function overpass(q: string): Promise<any> {
  const r = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: q }), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(r.status === 429 ? "The trail map is busy. Try again in a minute." : "Trails couldn't load right now.");
  return r.json();
}

export function TrailFinder({ data, onClose, onGo }: { data: FitData; onClose: () => void; onGo: (t: { name: string; lines: LatLng[][] }) => void }) {
  const unit = unitOf(data);
  const [from, setFrom] = useState<{ ll: LatLng; label: string } | null>(null);
  const [q, setQ] = useState("");
  const [radius, setRadius] = useState<"10" | "25" | "50">("25");
  const [trails, setTrails] = useState<Trail[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<{ t: Trail; lines: LatLng[][] } | null>(null);
  const [diff, setDiff] = useState<"all" | "Easy" | "Moderate" | "Hard">("all");

  const nearMe = () => {
    setErr(""); setBusy(true);
    navigator.geolocation?.getCurrentPosition((p) => setFrom({ ll: [p.coords.latitude, p.coords.longitude], label: "Near you" }), (e) => { setBusy(false); setErr(e.code === 1 ? "Location is off. Search for a town or park instead." : "Couldn't get your location. Search instead."); }, { enableHighAccuracy: false, timeout: 15000 });
  };
  const search = async () => {
    const t = q.trim(); if (t.length < 2) return;
    setErr(""); setBusy(true);
    try {
      const r = await fetch(`${NOMINATIM}?${new URLSearchParams({ q: t, format: "json", limit: "1", countrycodes: "us" })}`, { headers: { Accept: "application/json" } });
      const hit = (await r.json())?.[0];
      if (!hit) { setBusy(false); setErr(`Couldn't find "${t}". Try a town, park or zip code.`); return; }
      setFrom({ ll: [Number(hit.lat), Number(hit.lon)], label: String(hit.display_name).split(",").slice(0, 2).join(",") });
    } catch { setBusy(false); setErr("Search isn't reachable right now."); }
  };
  useEffect(() => {
    if (!from) return;
    let live = true; setBusy(true); setTrails(null);
    overpass(trailsQuery(from.ll[0], from.ll[1], Number(radius))).then((j) => live && setTrails(parseTrails(j, from.ll))).catch((e) => live && setErr(e.message)).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [from, radius]);
  useEffect(() => { nearMe(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const openTrail = async (t: Trail) => {
    setBusy(true); setErr("");
    try { setOpen({ t, lines: parseGeometry(await overpass(trailGeometryQuery(t))) }); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const shown = (trails ?? []).filter((t) => diff === "all" || t.difficulty === diff);
  const awayLabel = (m: number) => `${(m / (unit === "mi" ? MILE : 1000)).toFixed(1)} ${unit} away`;

  if (open) {
    const km = open.t.km ?? open.lines.reduce((t, l) => t + l.reduce((s, p, i) => (i ? s + haversine(l[i - 1], p) : 0), 0), 0) / 1000;
    return <Sheet title={open.t.name} onClose={() => setOpen(null)} testId="fit-trail">
      <MapView lines={open.lines} fit className="mt-1 h-72" />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {([[(unit === "mi" ? km / 1.609 : km).toFixed(1), unit], [open.t.difficulty ?? "—", "difficulty"], [open.t.surface ?? "trail", "surface"]] as const).map(([v, l]) => <Card key={l} className="!px-1 !py-3"><p className="truncate text-[22px] capitalize leading-none" style={display}>{v}</p><p className="mt-1 text-[11px] uppercase tracking-[.1em]" style={{ color: C.dim }}>{l}</p></Card>)}
      </div>
      <p className="mt-2 px-1 text-[13px]" style={{ color: C.dim }}>{awayLabel(open.t.away)} · {open.t.kind.replace("_", " ")}</p>
      <Btn className="mt-4 w-full" disabled={!open.lines.length} onClick={() => onGo({ name: open.t.name, lines: open.lines })} testId="fit-trail-go"><Footprints className="h-5 w-5" />Track this trail</Btn>
      <p className="mt-4 text-[11px] leading-relaxed" style={{ color: C.dim }}>Trail data © OpenStreetMap contributors (ODbL). Check conditions, closures and the weather before you go.</p>
    </Sheet>;
  }
  return <Sheet title="Trails" onClose={onClose} testId="fit-trails">
    <form onSubmit={(e) => { e.preventDefault(); void search(); }} className="mt-1 flex gap-2">
      <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: C.dim }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Town, park or zip code" className={`${inputCls} pl-10`} style={inputStyle} data-testid="fit-trail-search" /></div>
      <Btn type="submit" kind="soft">Find</Btn>
      <Btn kind="soft" onClick={nearMe} className="!px-3"><LocateFixed className="h-5 w-5" /></Btn>
    </form>
    <div className="mt-3 flex items-center justify-between gap-2">
      <p className="flex min-w-0 items-center gap-1.5 truncate text-[14px]" style={{ color: C.steel }}><MapPin className="h-4 w-4 shrink-0" style={{ color: C.lime }} />{from?.label ?? "Finding you…"}</p>
      <div className="flex shrink-0 gap-1">{(["10", "25", "50"] as const).map((r) => <button key={r} type="button" onClick={() => setRadius(r)} aria-pressed={radius === r} className="h-8 rounded-[6px] px-2 text-[12px] font-semibold" style={radius === r ? { background: C.lime, color: "#0b0b0c" } : { background: C.card }}>{r} km</button>)}</div>
    </div>
    <div className="mt-2"><Chips label="Difficulty" value={diff} onChange={setDiff} items={[{ id: "all", label: "All trails" }, { id: "Easy", label: "Easy" }, { id: "Moderate", label: "Moderate" }, { id: "Hard", label: "Hard" }]} /></div>
    {err && <p className="mt-3 rounded-[10px] px-3 py-2 text-[13px]" style={{ background: "rgba(255,59,48,.12)", color: "#ff8a80" }}>{err}</p>}
    {busy && <p className="mt-6 text-center text-[14px]" style={{ color: C.dim }}>Searching trails…</p>}
    {trails && !busy && <p className="mb-2 mt-3 text-[12px]" style={{ color: C.dim }}>{shown.length} trails</p>}
    <ul className="space-y-2">{shown.slice(0, 100).map((t) => <li key={`${t.type}${t.id}`}><button type="button" onClick={() => openTrail(t)} className="flex w-full items-center gap-3 rounded-[12px] p-3 text-left" style={{ background: C.card }} data-testid={`fit-trail-${t.id}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px]" style={{ background: C.card2, color: t.difficulty === "Hard" || t.difficulty === "Expert" ? C.red : t.difficulty === "Moderate" ? C.orange : C.lime }}><Mountain className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[18px] leading-tight" style={display}>{t.name}</span><span className="block truncate text-[12px] capitalize" style={{ color: C.dim }}>{awayLabel(t.away)}{t.km ? ` · ${(unit === "mi" ? t.km / 1.609 : t.km).toFixed(1)} ${unit}` : ""}{t.difficulty ? ` · ${t.difficulty}` : ""}</span></span>
    </button></li>)}</ul>
    {trails && !busy && !shown.length && <p className="mt-6 text-center text-[14px]" style={{ color: C.dim }}>No mapped trails here. Try a bigger radius or another place.</p>}
    <p className="mt-6 text-[11px]" style={{ color: C.dim }}>Trail data © OpenStreetMap contributors. Search by Nominatim.</p>
  </Sheet>;
}

// ——— Outdoor hub: start a run, your totals and route history ——————————————————————————————————————
export function OutdoorHub({ data, update, onClose, say, inline }: { data: FitData; update: Update; onClose: () => void; say: (m: string) => void; inline?: boolean }) {
  const unit = unitOf(data);
  const [tracking, setTracking] = useState<null | { trail?: { name: string; lines: LatLng[][] } }>(null);
  const [trails, setTrails] = useState(false);
  const [view, setView] = useState<Run | null>(null);
  const runs = [...(data.runs ?? [])].reverse();
  const weekAgo = Date.now() - 7 * 864e5;
  const week = runs.filter((r) => Date.parse(r.date) >= weekAgo);
  const best = (m: number) => runs.filter((r) => r.meters >= m && r.kind === "run").map((r) => (r.secs / r.meters) * m).sort((a, b) => a - b)[0];
  return <Sheet title={inline ? "Outdoor run" : "Outdoor"} onClose={onClose} testId="fit-outdoor" inline={inline}>
    <div className="mt-1 grid grid-cols-2 gap-2">
      <button type="button" onClick={() => setTracking({})} className="fit-in fit-shine flex min-h-[110px] flex-col justify-end rounded-[14px] p-4 text-left active:scale-[.98]" style={{ background: "linear-gradient(150deg, #ff5a1f, #b8360a)", color: "#0b0b0c" }} data-testid="fit-outdoor-start"><Route className="h-7 w-7" /><span className="mt-2 text-[26px] leading-none" style={display}>Start run</span><span className="text-[12px] font-semibold">GPS · live map</span></button>
      <button type="button" onClick={() => setTrails(true)} className="fit-in flex min-h-[110px] flex-col justify-end rounded-[14px] p-4 text-left active:scale-[.98]" style={{ background: C.card2, animationDelay: ".08s" }} data-testid="fit-outdoor-trails"><Mountain className="h-7 w-7" style={{ color: C.lime }} /><span className="mt-2 text-[26px] leading-none" style={display}>Trails</span><span className="text-[12px]" style={{ color: C.dim }}>Every US trail near you</span></button>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
      {([[distLabel(week.reduce((t, r) => t + r.meters, 0), unit), `${unit} this week`], [best(unit === "mi" ? MILE : 1000) ? fmtDur(best(unit === "mi" ? MILE : 1000)!) : "—", `best ${unit}`], [best(5000) ? fmtDur(best(5000)!) : "—", "best 5K"]] as const).map(([v, l]) => <Card key={l} className="!px-1 !py-3"><p className="text-[24px] leading-none tabular-nums" style={display}>{v}</p><p className="mt-1 text-[11px] uppercase tracking-[.08em]" style={{ color: C.dim }}>{l}</p></Card>)}
    </div>
    <Title>History</Title>
    {runs.length ? <div className="space-y-2">{runs.slice(0, 40).map((r) => <Card key={r.id} onClick={() => setView(r)} className="!p-3">
      <div className="flex items-center gap-3"><Flag className="h-5 w-5 shrink-0" style={{ color: C.lime }} />
        <div className="min-w-0 flex-1"><p className="truncate text-[18px] leading-tight" style={display}>{r.trail ?? KIND_LABEL[r.kind]} · {distLabel(r.meters, unit)} {unit}</p><p className="text-[12px]" style={{ color: C.dim }}>{new Date(r.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {fmtDur(r.secs)} · {pace(r.secs, r.meters, unit)}/{unit}</p></div></div>
    </Card>)}</div> : <p className="px-1 text-[14px]" style={{ color: C.dim }}>Your runs, walks and hikes show up here with their maps.</p>}
    {view && <Sheet title={`${view.trail ?? KIND_LABEL[view.kind]} · ${distLabel(view.meters, unit)} ${unit}`} onClose={() => setView(null)}>
      <MapView path={view.path} fit className="mt-1 h-72" />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">{([[fmtDur(view.secs), "time"], [pace(view.secs, view.meters, unit), `pace /${unit}`], [String(runCalories(view.kind, view.meters, latestKg(data))), "kcal"]] as const).map(([v, l]) => <Card key={l} className="!px-1 !py-3"><p className="text-[24px] leading-none tabular-nums" style={display}>{v}</p><p className="mt-1 text-[11px] uppercase tracking-[.1em]" style={{ color: C.dim }}>{l}</p></Card>)}</div>
      <button type="button" onClick={() => { if (window.confirm("Delete this from your history?")) { update((d) => ({ ...d, runs: (d.runs ?? []).filter((x) => x.id !== view.id), workouts: d.workouts.filter((w) => w.id !== view.id) })); setView(null); } }} className="mt-6 h-12 w-full text-[15px] font-semibold" style={{ color: C.red }}>Delete</button>
    </Sheet>}
    {trails && <TrailFinder data={data} onClose={() => setTrails(false)} onGo={(t) => { setTrails(false); setTracking({ trail: t }); }} />}
    {tracking && <RunTracker data={data} update={update} trail={tracking.trail} say={say} onClose={() => setTracking(null)} />}
  </Sheet>;
}
