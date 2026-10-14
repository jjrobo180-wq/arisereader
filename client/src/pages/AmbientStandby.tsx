import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Check, ChevronDown, Cloud, CloudDrizzle, CloudRain, CloudSnow, CloudSun, CloudLightning, Droplets, Expand, Heart, MapPin, Maximize2, Minimize2, Moon, Pause, Play, RefreshCw, Settings2, Sun, Volume2, VolumeX, Wind, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { buildLifeBrief, buildWorkBrief, type Brief } from "@shared/dailyBrief";
import { weatherCode, type Forecast } from "@shared/lifePlugins";
import type { Family } from "@shared/familyHub";
import type { Workspace } from "@shared/teacherHub";
import "./AmbientStandby.css";

type Quality = "cinematic" | "balanced";
type Scene = "clear" | "clouds" | "rain" | "snow" | "storm" | "fog";
type Mode = "standby" | "sleep";
type Source = "life" | "work";
type Prefs = { city: string; unit: "F" | "C"; mode: Mode; source: Source; quality: Quality; rain: number; sound: number; thunder: boolean; wind: boolean; minutes: number; showClock: boolean };
const DEFAULT: Prefs = { city: "", unit: "F", mode: "standby", source: "life", quality: "cinematic", rain: 80, sound: 55, thunder: false, wind: false, minutes: 60, showClock: true };
const ICON = { clear: Sun, clouds: Cloud, rain: CloudRain, snow: CloudSnow, storm: CloudLightning, fog: CloudDrizzle };
const localDay = (d: Date) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
const safeRead = (key: string): Prefs => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch { return DEFAULT; } };
function sceneFor(code: number): Scene {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "clouds";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67 || code >= 80 && code <= 82) return "rain";
  if (code >= 71 && code <= 77 || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "clouds";
}
function AtmosphereCanvas({ scene, sleep, quality, intensity }: { scene: Scene; sleep: boolean; quality: Quality; intensity: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true }); if (!ctx) return;
    let width = 0, height = 0, raf = 0, frame = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const high = quality === "cinematic";
    const random = (min: number, max: number) => min + Math.random() * (max - min);
    type Particle = { x: number; y: number; z: number; r: number; speed: number; age: number; trail: number };
    let particles: Particle[] = [];
    let drops: Particle[] = [];
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, high ? 3 : 1.5);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = sleep ? (high ? 280 : 125) : scene === "clear" ? 55 : high ? 330 : 115;
      particles = Array.from({ length: count }, () => ({ x: random(0, width), y: random(0, height), z: random(.25, 1.8), r: random(.5, 2.1), speed: random(1, 4.8), age: random(0, 360), trail: random(7, 30) }));
      drops = Array.from({ length: high ? 100 : 45 }, () => ({ x: random(0, width), y: random(0, height), z: random(.5, 1.6), r: random(1.5, 7.5), speed: random(.03, .8), age: random(0, 360), trail: random(5, 50) }));
    };
    const drawCloud = (x: number, y: number, scale: number, opacity: number) => {
      ctx.save(); ctx.globalAlpha = opacity; ctx.filter = "blur(" + (14 * scale) + "px)";
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 120 * scale);
      grad.addColorStop(0, sleep ? "rgba(156,177,197,.55)" : "rgba(236,245,255,.70)");
      grad.addColorStop(1, "rgba(200,222,250,0)");
      ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(x, y, 140 * scale, 46 * scale, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    };
    const paint = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);
      const cloudy = sleep || scene === "clouds" || scene === "rain" || scene === "storm" || scene === "fog";
      if (cloudy) {
        for (let i = 0; i < 6; i++) {
          const drift = reduced ? 0 : (frame * (i % 2 ? .065 : -.04));
          drawCloud(((width * (i + .1) / 5 + drift) % (width + 240) + width + 240) % (width + 240) - 120, height * (.12 + i % 3 * .21), .8 + (i % 3) * .5, sleep ? .26 : .55);
        }
      }
      if (scene === "clear" && !sleep) {
        for (const p of particles) {
          const a = .12 + Math.abs(Math.sin(p.age / 40)) * .43;
          ctx.fillStyle = "rgba(255,255,240," + a + ")";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * .75, 0, Math.PI * 2); ctx.fill();
          if (!reduced) p.age += .45;
        }
      }
      if (sleep || scene === "rain" || scene === "storm" || scene === "snow") {
        const snow = !sleep && scene === "snow";
        for (const p of particles) {
          ctx.globalAlpha = snow ? .55 * p.z : Math.min(.67, .16 + p.z * .25);
          if (snow) {
            ctx.fillStyle = "#f4f9ff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.75, 0, Math.PI * 2); ctx.fill();
          } else {
            const grad = ctx.createLinearGradient(p.x, p.y, p.x - 2.2 * p.z, p.y + p.trail * p.z);
            grad.addColorStop(0, "rgba(207,229,250,0)"); grad.addColorStop(1, "rgba(218,238,255,.94)");
            ctx.strokeStyle = grad; ctx.lineWidth = Math.max(.55, p.z * .8);
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 2.2 * p.z, p.y + p.trail * p.z); ctx.stroke();
          }
          if (!reduced) { p.y += (snow ? .5 : p.speed * (sleep ? 2 : 2.6)) * p.z * Math.max(.4, intensity / 90); p.x += snow ? Math.sin(frame / 55 + p.age) * .3 : -p.z; }
          if (p.y > height + 35 || p.x < -25) { p.y = -35; p.x = random(0, width + 30); }
        }
        ctx.globalAlpha = 1;
      }
      if (sleep) {
        // Near-field water on glass: several translucent edges and an offset highlight create refractive beads.
        for (const d of drops) {
          const radius = d.r * d.z;
          ctx.save(); ctx.translate(d.x, d.y); ctx.scale(.8, 1.55);
          ctx.shadowColor = "rgba(0,0,0,.50)"; ctx.shadowBlur = 5; ctx.shadowOffsetX = 2;
          const water = ctx.createRadialGradient(-radius * .25, -radius * .35, .2, 0, 0, radius * 1.4);
          water.addColorStop(0, "rgba(250,255,255,.24)"); water.addColorStop(.55, "rgba(196,222,240,.07)"); water.addColorStop(.87, "rgba(13,25,42,.14)"); water.addColorStop(1, "rgba(235,250,255,.68)");
          ctx.fillStyle = water; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
          ctx.shadowColor = "transparent"; ctx.strokeStyle = "rgba(242,251,255,.42)"; ctx.lineWidth = .72;
          ctx.beginPath(); ctx.arc(-radius * .18, -radius * .1, radius * .62, Math.PI * 1.12, Math.PI * 1.66); ctx.stroke(); ctx.restore();
          if (d.r > 5 && d.speed > .5) {
            ctx.strokeStyle = "rgba(207,234,250,.18)"; ctx.lineWidth = radius * .4;
            ctx.beginPath(); ctx.moveTo(d.x, d.y - radius * 2); ctx.lineTo(d.x + .35, d.y - radius * 2 - d.trail); ctx.stroke();
          }
          if (!reduced) d.y += d.speed * (d.r > 5 ? 1.5 : .22) * (intensity / 80);
          if (d.y > height + 25) { d.y = -25; d.x = random(0, width); }
        }
      }
      if (scene === "storm" && !sleep && frame % 570 >= 558 && frame % 570 <= 560) {
        ctx.fillStyle = "rgba(226,241,255,.24)"; ctx.fillRect(0, 0, width, height);
      }
      if (!reduced) raf = requestAnimationFrame(paint);
    };
    resize(); paint();
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [scene, sleep, quality, intensity]);
  return <canvas ref={ref} className="ambient-canvas" aria-hidden="true" />;
}
function useRainAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ src: AudioBufferSourceNode; wind: AudioBufferSourceNode; rainGain: GainNode; windGain: GainNode; master: GainNode } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const stop = useCallback(async () => {
    const nodes = nodesRef.current; nodesRef.current = null;
    try { nodes?.src.stop(); nodes?.wind.stop(); nodes?.src.disconnect(); nodes?.wind.disconnect(); nodes?.master.disconnect(); } catch {}
    try { await ctxRef.current?.close(); } catch {}
    ctxRef.current = null; setPlaying(false);
  }, []);
  const start = useCallback(async (volume: number, windOn: boolean) => {
    if (ctxRef.current) { try { await ctxRef.current.resume(); } catch {} setPlaying(true); return; }
    try {
      const ac = new AudioContext(); ctxRef.current = ac;
      const seconds = 7; const len = Math.floor(ac.sampleRate * seconds);
      const rainBuffer = ac.createBuffer(2, len, ac.sampleRate);
      const windBuffer = ac.createBuffer(2, len, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const rainSamples = rainBuffer.getChannelData(ch), windSamples = windBuffer.getChannelData(ch); let brown = 0;
        for (let i = 0; i < len; i++) { const white = Math.random() * 2 - 1; brown = (brown + white * .09) / 1.018; rainSamples[i] = white * .5; windSamples[i] = Math.max(-1, Math.min(1, brown * 3.6)); }
      }
      const src = ac.createBufferSource(); src.buffer = rainBuffer; src.loop = true;
      const rainFilter = ac.createBiquadFilter(); rainFilter.type = "highpass"; rainFilter.frequency.value = 460;
      const rainGain = ac.createGain(); rainGain.gain.value = .8;
      const wind = ac.createBufferSource(); wind.buffer = windBuffer; wind.loop = true;
      const lowpass = ac.createBiquadFilter(); lowpass.type = "lowpass"; lowpass.frequency.value = 230;
      const windGain = ac.createGain(); windGain.gain.value = windOn ? .42 : 0;
      const master = ac.createGain(); master.gain.value = Math.min(1, volume / 100) * .38;
      src.connect(rainFilter).connect(rainGain).connect(master);
      wind.connect(lowpass).connect(windGain).connect(master);
      master.connect(ac.destination); src.start(); wind.start();
      nodesRef.current = { src, wind, rainGain, windGain, master };
      await ac.resume(); setPlaying(true); setError("");
    } catch { setError("This browser could not start audio. Try tapping Play again."); void stop(); }
  }, [stop]);
  const setLevels = useCallback((volume: number, windOn: boolean, rain: number) => {
    const n = nodesRef.current; if (!n) return;
    n.master.gain.setTargetAtTime(volume / 100 * .38, n.master.context.currentTime, .08);
    n.windGain.gain.setTargetAtTime(windOn ? .42 : 0, n.master.context.currentTime, .08);
    n.rainGain.gain.setTargetAtTime(.3 + rain / 135, n.master.context.currentTime, .08);
  }, []);
  useEffect(() => () => { const n = nodesRef.current; try { n?.src.stop(); n?.wind.stop(); } catch {} void ctxRef.current?.close(); }, []);
  return { playing, error, start, stop, setLevels };
}
export default function AmbientStandby() {
  const { user, token } = useAuth();
  const key = "arise-atmosphere-prefs:" + (user?.id ?? "guest");
  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...safeRead(key), mode: window.location.hash.includes("mode=sleep") ? "sleep" : window.location.hash.includes("mode=standby") ? "standby" : safeRead(key).mode }));
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<Forecast | null>(null);
  const [weatherError, setWeatherError] = useState("");
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherUpdated, setWeatherUpdated] = useState<Date | null>(null);
  const [weatherRound, setWeatherRound] = useState(0);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [cityDraft, setCityDraft] = useState(prefs.city);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const sound = useRainAudio();
  const update = (p: Partial<Prefs>) => setPrefs(s => ({ ...s, ...p }));
  const city = prefs.city.trim();
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(prefs)); } catch {} }, [key, prefs]);
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { setCityDraft(prefs.city); }, [prefs.city]);
  useEffect(() => {
    if (!city) { setWeather(null); setWeatherError(""); return; }
    const controller = new AbortController();
    const read = async () => {
      setWeatherBusy(true); setWeatherError("");
      try {
        const response = await fetch(API_BASE + "/api/lifehub/weather?place=" + encodeURIComponent(city) + "&unit=" + prefs.unit, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Weather is unavailable for this place.");
        const result: Forecast = await response.json();
        if (!controller.signal.aborted) { setWeather(result); setWeatherUpdated(new Date()); }
      } catch (err) { if (!controller.signal.aborted) { setWeather(null); setWeatherError(err instanceof Error ? err.message : "Unable to load weather."); } }
      finally { if (!controller.signal.aborted) setWeatherBusy(false); }
    };
    void read(); const interval = window.setInterval(() => { if (document.visibilityState === "visible") void read(); }, 5 * 60 * 1000);
    const onFocus = () => { if (document.visibilityState === "visible") void read(); };
    document.addEventListener("visibilitychange", onFocus);
    return () => { controller.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", onFocus); };
  }, [city, prefs.unit, weatherRound]);
  useEffect(() => {
    if (!token) return;
    let active = true;
    const read = async () => {
      setBriefBusy(true);
      try {
        const url = prefs.source === "work" ? "/api/teacher-hub/workspace" : "/api/arise-todo/workspace";
        const result = await fetch(API_BASE + url, { cache: "no-store", headers: { Authorization: "Bearer " + token } });
        if (!result.ok) throw new Error("Brief unavailable");
        const json = await result.json();
        if (!active) return;
        const workspace = json?.workspace;
        if (prefs.source === "work" && workspace) {
          setBrief(buildWorkBrief(workspace as Workspace, localDay(new Date()), new Date().getHours(), (user?.displayName || "").split(" ")[0]));
        } else if (workspace?.family && Array.isArray(workspace?.tasks)) {
          const family = workspace.family as Family;
          setBrief(buildLifeBrief(family, workspace.tasks, localDay(new Date()), new Date().getHours(), (user?.displayName || "").split(" ")[0]));
          if (!city && family.weather?.place) update({ city: family.weather.place, unit: family.weather.unit || "F" });
        } else setBrief(null);
      } catch { if (active) setBrief(null); }
      finally { if (active) setBriefBusy(false); }
    };
    void read();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void read(); }, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") void read(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [prefs.source, token, user?.displayName, city]);
  useEffect(() => { sound.setLevels(prefs.sound, prefs.wind, prefs.rain); }, [prefs.sound, prefs.wind, prefs.rain, sound.setLevels]);
  useEffect(() => {
    if (!endsAt || !sound.playing) return;
    if (Date.now() >= endsAt) { void sound.stop(); setEndsAt(null); return; }
    const timer = window.setInterval(() => { if (Date.now() >= endsAt) { void sound.stop(); setEndsAt(null); } }, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt, sound.playing, sound.stop]);
  const liveScene: Scene = weather ? sceneFor(weather.current.code) : "clear";
  const scene = prefs.mode === "sleep" ? "rain" : liveScene;
  const IconNow = weather ? ICON[liveScene] : CloudSun;
  const formattedTime = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const [clockText, ampm] = formattedTime.split(" ");
  const dayText = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const liveBriefLines = useMemo(() => brief?.sections.filter(s => s.lines.length).slice(0, 3) || [], [brief]);
  const toggleAudio = async () => {
    if (sound.playing) { await sound.stop(); setEndsAt(null); }
    else { await sound.start(prefs.sound, prefs.wind); if (prefs.minutes) setEndsAt(Date.now() + prefs.minutes * 60000); }
  };
  const toggleFull = async () => {
    if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); setFull(false); return; }
    try { await document.documentElement.requestFullscreen(); setFull(true); try { await (screen.orientation as any)?.lock?.("landscape"); } catch {} }
    catch { setFull(false); }
  };
  const requestLocation = () => {
    if (!navigator.geolocation) { setWeatherError("Location is not supported; enter a city instead."); return; }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const geo = await fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + coords.latitude + "&lon=" + coords.longitude + "&zoom=10");
        const data = await geo.json();
        const place = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.county;
        if (place) update({ city: place + (data?.address?.state ? ", " + data.address.state : "") });
        else setWeatherError("Could not find a nearby city. Enter one below.");
      } catch { setWeatherError("Location lookup failed. Enter your city manually."); }
    }, () => setWeatherError("Location permission was not granted. Enter a city instead."), { timeout: 12000 });
  };
  const sections = liveBriefLines.flatMap(s => s.lines.slice(0, 3).map(l => ({ ...l, section: s.title }))).slice(0, 6);
  return <main className={["ambient-root", "ambient-" + scene, prefs.mode === "sleep" ? "ambient-sleep" : "", prefs.quality === "balanced" ? "ambient-balanced" : ""].join(" ")} data-testid="arise-atmosphere">
    <div className="ambient-photo" aria-hidden="true" />
    <div className="ambient-wash" aria-hidden="true" />
    <AtmosphereCanvas scene={scene} sleep={prefs.mode === "sleep"} quality={prefs.quality} intensity={prefs.rain} />
    <div className="ambient-vignette" aria-hidden="true" />
    <div className="ambient-screen">
      <header className="ambient-header">
        <a className="ambient-top-action" href={user?.role === "teacher" ? "#/workhub" : "#/lifehub"} aria-label="Back to your hub"><ArrowLeft size={18} /><span>My Apps</span></a>
        <div className="ambient-mark"><span className="ambient-mark-dot" /> A.R.I.S.E. <strong>ATMOSPHERE</strong></div>
        <div className="ambient-top-actions">
          <span className="ambient-live"><span />{prefs.mode === "standby" ? (weather ? "LIVE WEATHER" : "STANDBY") : "SLEEP STUDIO"}</span>
          <button className="ambient-icon-action" onClick={() => setSettingsOpen(s => !s)} aria-label="Settings" aria-expanded={settingsOpen}><Settings2 size={18}/></button>
          <button className="ambient-icon-action" onClick={() => void toggleFull()} aria-label={full ? "Exit full screen" : "Enter full screen"}>{full ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}</button>
        </div>
      </header>
      <div className="ambient-main">
        {prefs.mode === "standby" ? <>
          <section className="ambient-clock-panel" aria-label="Current time and daily brief">
            <div className="ambient-eyebrow"><span className="ambient-hairline" /> THE MOMENT, RIGHT NOW</div>
            <div className="ambient-clock"><span>{clockText}</span><small>{ampm}</small></div>
            <div className="ambient-date">{dayText}</div>
            <div className="ambient-divider" />
            <div className="ambient-greeting">{brief?.greeting || (now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening")}<span className="ambient-accent-dot">.</span></div>
            <p className="ambient-summary">{brief?.summary || (briefBusy ? "Gathering your day…" : "Your day, at a glance.")}</p>
            <div className="ambient-agenda">
              <div className="ambient-agenda-heading"><CalendarDays size={15}/> YOUR DAILY BRIEF <button onClick={() => update({ source: prefs.source === "life" ? "work" : "life" })} title="Change brief source">{prefs.source === "life" ? "LifeHub" : "WorkHub"} <ChevronDown size={12}/></button></div>
              {sections.length ? sections.map((item, i) => <div className="ambient-agenda-row" key={i}><span className="ambient-agenda-bullet"/><span className="ambient-agenda-text">{item.text}</span><span className="ambient-agenda-when">{item.when || item.section}</span></div>)
                : <div className="ambient-agenda-empty">{briefBusy ? "Loading your saved schedule…" : brief ? "Your brief is clear today." : "Open your hub to add tasks and calendar events."}</div>}
            </div>
          </section>
          <section className="ambient-weather-panel" aria-label="Live weather">
            <div className="ambient-weather-heading"><MapPin size={14}/><span>{weather?.place || city || "CHOOSE YOUR LOCATION"}</span></div>
            <div className="ambient-weather-art"><IconNow strokeWidth={.75} size={170} aria-hidden="true" /></div>
            <div className="ambient-weather-copy"><div className="ambient-temp">{weather ? weather.current.temp + "°" : "—"}</div><div className="ambient-weather-label">{weather ? weatherCode(weather.current.code).text : weatherBusy ? "Checking the forecast" : "Set your city for live weather"}</div></div>
            {weather && <div className="ambient-weather-stats"><div><Droplets size={15}/> {weather.current.humidity}% <span>humidity</span></div><div><Wind size={15}/> {weather.current.wind} <span>{prefs.unit === "F" ? "mph" : "km/h"}</span></div><div><CloudSun size={15}/> {weather.current.feels}° <span>feels like</span></div></div>}
            {weather?.days?.length ? <div className="ambient-forecast">{weather.days.slice(0, 4).map(d => <div key={d.date}><span>{new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })}</span><strong>{d.high}°</strong><small>{d.low}°</small></div>)}</div> : <button className="ambient-place-inline" onClick={() => setSettingsOpen(true)}><MapPin size={15}/> Add a city</button>}
            <div className="ambient-weather-foot">{weatherUpdated ? "Updated " + weatherUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "Weather by Open-Meteo"} <button aria-label="Refresh weather" onClick={() => setWeatherRound(s => s + 1)} disabled={!city}><RefreshCw size={14} className={weatherBusy ? "ambient-spinning" : ""}/></button></div>
          </section>
        </> : <>
          <section className="ambient-sleep-content">
            <div className="ambient-eyebrow"><span className="ambient-hairline" /> YOUR PERSONAL ESCAPE</div>
            <h1>Let the world<br/><em>slow down.</em></h1>
            <p>Rain against the window. A quiet moment that belongs entirely to you.</p>
            <div className="ambient-sleep-controls">
              <button className="ambient-audio-play" onClick={() => void toggleAudio()}>{sound.playing ? <Pause size={22} fill="currentColor"/> : <Play size={22} fill="currentColor"/>} {sound.playing ? "Pause atmosphere" : "Play rain sounds"}</button>
              <div className="ambient-audio-state">{sound.playing ? <><span className="ambient-playing-indicator"/> NOW PLAYING</> : "AUDIO IS OFF"}</div>
            </div>
            {sound.error && <p role="alert" className="ambient-audio-error">{sound.error}</p>}
          </section>
          {prefs.showClock && <div className="ambient-sleep-clock"><span>{clockText}</span><small>{ampm}</small><p>{dayText}</p></div>}
        </>}
      </div>
      <footer className="ambient-footer">
        <div className="ambient-mode-switch" role="group" aria-label="Atmosphere mode">
          <button className={prefs.mode === "standby" ? "selected" : ""} aria-pressed={prefs.mode === "standby"} onClick={() => update({ mode: "standby" })}><CloudSun size={17}/> StandBy</button>
          <button className={prefs.mode === "sleep" ? "selected" : ""} aria-pressed={prefs.mode === "sleep"} onClick={() => update({ mode: "sleep" })}><Moon size={17}/> Sleep Studio</button>
        </div>
        <div className="ambient-footer-note">{prefs.mode === "standby" ? "LIVE CONDITIONS  ·  UPDATES EVERY 5 MIN" : (endsAt && sound.playing ? "SLEEP TIMER ON" : "SLEEP SOUND ENGINE  ·  SPATIAL AMBIENCE")}</div>
        {prefs.mode === "sleep" && <button className="ambient-footer-sound" onClick={() => void toggleAudio()} aria-label={sound.playing ? "Stop rain audio" : "Start rain audio"}>{sound.playing ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>}
      </footer>
    </div>
    {settingsOpen && <div className="ambient-settings-overlay" onClick={() => setSettingsOpen(false)}><aside className="ambient-settings" onClick={e => e.stopPropagation()} aria-label="Atmosphere settings"><div className="ambient-settings-head"><div><small>MAKE IT YOURS</small><h2>Atmosphere settings</h2></div><button className="ambient-icon-action" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={19}/></button></div>
      <div className="ambient-settings-scroll">
        <div className="ambient-field"><label htmlFor="ambient-place">Your city <span>Live weather</span></label><form className="ambient-location" onSubmit={e => { e.preventDefault(); if (cityDraft.trim()) { update({ city: cityDraft.trim() }); setWeatherRound(r => r + 1); } }}><input id="ambient-place" placeholder="Denver, Colorado" value={cityDraft} onChange={e => setCityDraft(e.target.value)} maxLength={80}/><button type="submit">Save</button></form><button className="ambient-location-link" onClick={requestLocation}><MapPin size={14}/> Use my location</button>{weatherError && <p className="ambient-error" role="alert">{weatherError}</p>}</div>
        <div className="ambient-field"><label>Temperature</label><div className="ambient-choice"><button className={prefs.unit === "F" ? "selected" : ""} onClick={() => update({ unit: "F" })}>°F Fahrenheit</button><button className={prefs.unit === "C" ? "selected" : ""} onClick={() => update({ unit: "C" })}>°C Celsius</button></div></div>
        <div className="ambient-field"><label>Graphics quality</label><div className="ambient-choice"><button className={prefs.quality === "cinematic" ? "selected" : ""} onClick={() => update({ quality: "cinematic" })}>Ultra cinematic</button><button className={prefs.quality === "balanced" ? "selected" : ""} onClick={() => update({ quality: "balanced" })}>Battery saver</button></div><p className="ambient-help">Ultra uses high-resolution layers and more particles. Battery saver lowers the rendering load.</p></div>
        <div className="ambient-field"><label>Brief from</label><div className="ambient-choice"><button className={prefs.source === "life" ? "selected" : ""} onClick={() => update({ source: "life" })}>LifeHub</button><button className={prefs.source === "work" ? "selected" : ""} onClick={() => update({ source: "work" })}>WorkHub</button></div></div>
        <div className="ambient-settings-separator"/>
        <div className="ambient-field"><label>Rain intensity <strong>{prefs.rain}%</strong></label><input type="range" min="20" max="100" value={prefs.rain} onChange={e => update({ rain: Number(e.target.value) })}/></div>
        <div className="ambient-field"><label>Audio volume <strong>{prefs.sound}%</strong></label><input type="range" min="0" max="100" value={prefs.sound} onChange={e => update({ sound: Number(e.target.value) })}/></div>
        <div className="ambient-field ambient-toggle-row"><label htmlFor="ambient-wind">Layer soft wind ambience</label><input id="ambient-wind" type="checkbox" checked={prefs.wind} onChange={e => update({ wind: e.target.checked })}/></div>
        <div className="ambient-field"><label htmlFor="ambient-duration">Sound sleep timer</label><select id="ambient-duration" value={prefs.minutes} onChange={e => { const m = Number(e.target.value); update({ minutes: m }); if (sound.playing) setEndsAt(m ? Date.now() + m * 60000 : null); }}><option value={0}>Play until I stop it</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={120}>2 hours</option><option value={240}>4 hours</option><option value={480}>8 hours</option></select></div>
        <div className="ambient-field ambient-toggle-row"><label htmlFor="ambient-clock-toggle">Clock visible in Sleep Studio</label><input id="ambient-clock-toggle" type="checkbox" checked={prefs.showClock} onChange={e => update({ showClock: e.target.checked })}/></div>
        <p className="ambient-help">Weather reflects Open-Meteo forecasts, refreshed approximately every five minutes while the app is open. Sleep rain is a separate cinematic simulation. Audio begins only after you press Play. Browser fullscreen and landscape locking depend on the device.</p>
      </div>
    </aside></div>}
    <div className="ambient-rotate"><Moon size={26}/><strong>Made for landscape.</strong><span>Rotate your phone sideways for the full cinematic experience.</span></div>
  </main>;
}
