import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, CalendarDays, Check, ChevronDown, Cloud, CloudDrizzle, CloudRain, CloudSnow, CloudSun, CloudLightning, Droplets, Home, LayoutGrid, MapPin, Maximize2, Minimize2, Moon, Pause, Play, RefreshCw, Settings2, Sun, Volume2, VolumeX, Waves, Wind, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { buildLifeBrief, buildWorkBrief, type Brief } from "@shared/dailyBrief";
import { weatherCode, type Forecast } from "@shared/lifePlugins";
import type { Family } from "@shared/familyHub";
import type { Workspace } from "@shared/teacherHub";
import { KITE_THEMES, KITE_THEME_ORDER, startKiteScene, type KiteThemeId, type ThemeId } from "./atmosphere/kiteScene";
import "./AmbientStandby.css";

type Quality = "cinematic" | "balanced";
type Scene = "clear" | "clouds" | "rain" | "snow" | "storm" | "fog";
type Mode = "standby" | "sleep";
type Source = "life" | "work";
type Soundscape = "rain" | "ocean" | "breeze" | "deep";
type Layout = "full" | "weather" | "clock";
type SleepScene = "rain" | "lantern" | "theme";
type Prefs = {
  city: string; coords: string; unit: "F" | "C"; mode: Mode; source: Source; quality: Quality; rain: number; sound: number; thunder: boolean; wind: boolean;
  minutes: number; showClock: boolean; keepAwake: boolean;
  theme: ThemeId; kites: number; breeze: number; strings: boolean; layout: Layout; hour24: boolean; seconds: boolean;
  font: "modern" | "elegant"; soundscape: Soundscape; sleepScene: SleepScene; nightDim: boolean; autoHide: boolean;
};
const DEFAULT: Prefs = {
  city: "", coords: "", unit: "F", mode: "standby", source: "life", quality: "cinematic", rain: 80, sound: 55, thunder: false, wind: false, minutes: 60, showClock: true, keepAwake: true,
  theme: "festival", kites: 7, breeze: 50, strings: true, layout: "full", hour24: false, seconds: false, font: "modern", soundscape: "rain", sleepScene: "rain", nightDim: true, autoHide: true,
};
const ICON = { clear: Sun, clouds: Cloud, rain: CloudRain, snow: CloudSnow, storm: CloudLightning, fog: CloudDrizzle };
const SOUNDS: { id: Soundscape; label: string; line: string }[] = [
  { id: "rain", label: "Rain", line: "Rain against the window. A quiet moment that belongs entirely to you." },
  { id: "ocean", label: "Ocean", line: "Slow waves rolling onto a quiet shore, again and again." },
  { id: "breeze", label: "Breeze", line: "A soft wind over the hills, and kites drifting high overhead." },
  { id: "deep", label: "Deep", line: "Deep, steady sound that hushes the room so you can settle in." },
];
const KITE_COUNTS = [{ n: 4, label: "Few" }, { n: 7, label: "Some" }, { n: 12, label: "Lots" }];
const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join("-");
const hashParams = () => new URLSearchParams(window.location.hash.split("?")[1] || "");
const safeRead = (key: string): Prefs => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch { return DEFAULT; } };
const themeName = (id: ThemeId) => id === "live" ? "Live Weather" : KITE_THEMES[id].name;
function swatch(id: ThemeId) {
  if (id === "live") return "linear-gradient(160deg,#3b6b80,#132b34 60%,#0a1622)";
  const t = KITE_THEMES[id];
  return `linear-gradient(180deg,${t.sky[0]},${t.sky[t.sky.length - 1]} 64%,${t.layers[1]} 65%,${t.layers[t.layers.length - 1]})`;
}
function sceneFor(code: number): Scene {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "clouds";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67 || code >= 80 && code <= 82) return "rain";
  if (code >= 71 && code <= 77 || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "clouds";
}

/** A tiny painted preview of a scene, for the theme picker. */
function ThemeArt({ id }: { id: ThemeId }) {
  if (id === "live") return <span className="ambient-theme-art ambient-theme-live"><CloudSun size={30} strokeWidth={1.4} /></span>;
  const t = KITE_THEMES[id], gid = "ambient-sky-" + id;
  return <svg viewBox="0 0 120 72" className="ambient-theme-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">{t.sky.map((c, i) => <stop key={i} offset={i / (t.sky.length - 1)} stopColor={c} />)}</linearGradient></defs>
    <rect width="120" height="72" fill={`url(#${gid})`} />
    {t.night && [[12, 8], [30, 16], [52, 6], [66, 20], [96, 10], [108, 26], [22, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r=".7" fill="#fff" opacity=".8" />)}
    {t.body && <circle cx={t.body.x * 120} cy={t.body.y * 72} r={t.body.kind === "moon" ? 5 : 7} fill={t.body.color} />}
    {t.land === "sea"
      ? <><rect y="47" width="120" height="25" fill={t.layers[1]} /><path d="M0 63 Q60 57 120 64 V72 H0Z" fill={t.layers[2]} /></>
      : <><path d="M0 52 Q30 42 60 50 T120 47 V72 H0Z" fill={t.layers[1]} /><path d="M0 61 Q40 53 80 61 T120 58 V72 H0Z" fill={t.layers[t.layers.length - 1]} /></>}
    <path d="M80 31 Q66 52 52 76" stroke={t.string} fill="none" strokeWidth=".7" />
    <g transform="translate(80 22) rotate(8)">
      <path d="M0 -10 L7 -2 L0 9 L-7 -2Z" fill={t.kites[0][0]} /><path d="M0 -10 L7 -2 L0 -2Z" fill={t.kites[0][1]} /><path d="M0 9 L-7 -2 L0 -2Z" fill={t.kites[0][1]} />
      <path d="M0 9 q-3 4 0 8 q3 4 -1 8" stroke={t.kites[0][1]} fill="none" strokeWidth=".9" />
    </g>
    <path transform="translate(103 36) rotate(-8) scale(.62)" d="M0 -10 L11 5 L0 2 L-11 5Z" fill={t.kites[1][0]} />
    <path transform="translate(60 14) rotate(4) scale(.45)" d="M-6 -9 H6 L8 -2 L6 9 H-6 L-8 -2Z" fill={t.kites[2][0]} />
  </svg>;
}

function KiteCanvas({ theme, kites, wind, strings, quality, sleepy }: { theme: KiteThemeId; kites: number; wind: number; strings: boolean; quality: Quality; sleepy: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return startKiteScene(ref.current, { theme: KITE_THEMES[theme], kites, wind, strings, quality, sleepy });
  }, [theme, kites, wind, strings, quality, sleepy]);
  return <canvas ref={ref} className="ambient-canvas ambient-kite-canvas" aria-hidden="true" />;
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
      const dpr = Math.min(window.devicePixelRatio || 1, high ? 2.5 : 1.25);
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
        // Near-field water on glass: translucent edges and an offset highlight make refractive beads.
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
      if (scene === "storm" && frame % 570 >= 558 && frame % 570 <= 560) {
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

/** Every soundscape is made live in the browser from shaped noise — no audio files to download. */
function useSoundscape() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ kind: Soundscape; sources: AudioScheduledSourceNode[]; layer: GainNode; windGain: GainNode; master: GainNode } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const stop = useCallback(async () => {
    const nodes = nodesRef.current; nodesRef.current = null;
    try { nodes?.sources.forEach(s => { s.stop(); s.disconnect(); }); nodes?.master.disconnect(); } catch {}
    try { await ctxRef.current?.close(); } catch {}
    ctxRef.current = null; setPlaying(false);
  }, []);
  const start = useCallback(async (kind: Soundscape, volume: number, windOn: boolean, rain: number) => {
    if (ctxRef.current) { try { await ctxRef.current.resume(); } catch {} setPlaying(true); return; }
    try {
      const Ctor: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ac = new Ctor(); ctxRef.current = ac;
      const len = Math.floor(ac.sampleRate * 8);
      const white = ac.createBuffer(2, len, ac.sampleRate), brown = ac.createBuffer(2, len, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const w = white.getChannelData(ch), b = brown.getChannelData(ch); let last = 0;
        for (let i = 0; i < len; i++) { const n = Math.random() * 2 - 1; last = (last + n * .09) / 1.018; w[i] = n * .5; b[i] = Math.max(-1, Math.min(1, last * 3.6)); }
      }
      const noise = (buffer: AudioBuffer) => { const s = ac.createBufferSource(); s.buffer = buffer; s.loop = true; return s; };
      const filter = (type: BiquadFilterType, hz: number) => { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = hz; return f; };
      const gain = (v: number) => { const g = ac.createGain(); g.gain.value = v; return g; };
      const lfo = (hz: number, depth: number, target: AudioParam) => { const o = ac.createOscillator(); o.frequency.value = hz; const d = gain(depth); o.connect(d).connect(target); return o; };
      const master = gain(Math.min(1, volume / 100) * .38), layer = gain(1), windGain = gain(windOn ? .42 : 0);
      const sources: AudioScheduledSourceNode[] = [];
      if (kind === "rain") {
        const s = noise(white); layer.gain.value = .3 + rain / 135; s.connect(filter("highpass", 460)).connect(layer).connect(master); sources.push(s);
      } else if (kind === "ocean") {
        const swell = gain(.55), hiss = gain(.06);
        const s = noise(brown), h = noise(white);
        s.connect(filter("lowpass", 700)).connect(swell).connect(layer);
        h.connect(filter("highpass", 1800)).connect(hiss).connect(layer);
        layer.gain.value = 1.15; layer.connect(master);
        sources.push(s, h, lfo(.085, .45, swell.gain), lfo(.085, .05, hiss.gain));
      } else if (kind === "breeze") {
        const f = filter("lowpass", 420); const s = noise(brown);
        s.connect(f).connect(layer).connect(master); layer.gain.value = 1;
        sources.push(s, lfo(.05, 260, f.frequency), lfo(.13, .25, layer.gain));
      } else {
        const s = noise(brown); s.connect(filter("lowpass", 380)).connect(layer).connect(master); layer.gain.value = 1.1; sources.push(s);
      }
      const w = noise(brown); w.connect(filter("lowpass", 230)).connect(windGain).connect(master); sources.push(w);
      master.connect(ac.destination); sources.forEach(s => s.start());
      nodesRef.current = { kind, sources, layer, windGain, master };
      await ac.resume(); setPlaying(true); setError("");
    } catch { setError("This browser could not start audio. Try tapping Play again."); void stop(); }
  }, [stop]);
  const setLevels = useCallback((volume: number, windOn: boolean, rain: number) => {
    const n = nodesRef.current; if (!n) return;
    const now = n.master.context.currentTime;
    n.master.gain.setTargetAtTime(volume / 100 * .38, now, .08);
    n.windGain.gain.setTargetAtTime(windOn ? .42 : 0, now, .08);
    if (n.kind === "rain") n.layer.gain.setTargetAtTime(.3 + rain / 135, now, .08);
  }, []);
  const rumble = useCallback(() => {
    const ac = ctxRef.current, nodes = nodesRef.current;
    if (!ac || !nodes) return;
    const len = Math.floor(ac.sampleRate * 3.6);
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const samples = buffer.getChannelData(0); let low = 0;
    for (let i = 0; i < len; i++) { low = (low + (Math.random() * 2 - 1) * .085) / 1.018; samples[i] = Math.max(-1, Math.min(1, low * 3)); }
    const src = ac.createBufferSource(); src.buffer = buffer;
    const filter = ac.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 105;
    const gain = ac.createGain(), time = ac.currentTime;
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(.72, time + .35);
    gain.gain.exponentialRampToValueAtTime(.0001, time + 3.5);
    src.connect(filter).connect(gain).connect(nodes.master);
    src.start(time); src.stop(time + 3.6);
    src.onended = () => { try { src.disconnect(); filter.disconnect(); gain.disconnect(); } catch {} };
  }, []);
  useEffect(() => () => { const n = nodesRef.current; try { n?.sources.forEach(s => s.stop()); } catch {} void ctxRef.current?.close(); }, []);
  return { playing, error, start, stop, setLevels, rumble };
}

export default function AmbientStandby() {
  const { user, token } = useAuth();
  const key = "arise-atmosphere-prefs:" + (user?.id ?? "guest");
  const params = hashParams();
  const origin: Source = params.get("hub") === "work" ? "work" : params.get("hub") === "life" ? "life" : user?.role === "teacher" ? "work" : "life";
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const saved = safeRead(key), mode = params.get("mode");
    return { ...saved, mode: mode === "sleep" || mode === "standby" ? mode : saved.mode, source: params.get("hub") ? origin : saved.source };
  });
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const [focus, setFocus] = useState(false);
  const [idle, setIdle] = useState(false);
  const [tip, setTip] = useState("");
  const sound = useSoundscape();
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const update = (p: Partial<Prefs>) => setPrefs(s => ({ ...s, ...p }));
  const city = prefs.city.trim();
  const immersive = full || focus;
  const sleeping = prefs.mode === "sleep";

  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(prefs)); } catch {} }, [key, prefs]);
  useEffect(() => {
    let alive = true;
    const request = async () => {
      if (!prefs.keepAwake || document.visibilityState !== "visible" || !(navigator as any).wakeLock) return;
      try { const lock = await (navigator as any).wakeLock.request("screen"); if (!alive) await lock.release(); else wake.current = lock; } catch { /* browser may disallow wake locks */ }
    };
    void request();
    const visible = () => { if (document.visibilityState === "visible") void request(); };
    document.addEventListener("visibilitychange", visible);
    return () => { alive = false; document.removeEventListener("visibilitychange", visible); void wake.current?.release(); wake.current = null; };
  }, [prefs.keepAwake]);
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { setCityDraft(prefs.city); }, [prefs.city]);
  useEffect(() => {
    if (!city) { setWeather(null); setWeatherError(""); return; }
    const controller = new AbortController();
    const read = async () => {
      setWeatherBusy(true); setWeatherError("");
      try {
        const [lat, lon] = prefs.coords.split(",");
        const response = await fetch(API_BASE + "/api/lifehub/weather?place=" + encodeURIComponent(city) + "&unit=" + prefs.unit + (lat && lon ? "&lat=" + lat + "&lon=" + lon : ""), { cache: "no-store", signal: controller.signal, headers: token ? { Authorization: "Bearer " + token } : undefined });
        if (response.status === 404) throw new Error("Couldn't find that place. Try a city and state, like Denver, Colorado.");
        if (!response.ok) throw new Error("Weather is unavailable right now. Try again in a minute.");
        const result: Forecast = await response.json();
        if (!controller.signal.aborted) { setWeather(result); setWeatherUpdated(new Date()); }
      } catch (err) { if (!controller.signal.aborted) { setWeather(null); setWeatherError(err instanceof Error ? err.message : "Unable to load weather."); } }
      finally { if (!controller.signal.aborted) setWeatherBusy(false); }
    };
    void read(); const interval = window.setInterval(() => { if (document.visibilityState === "visible") void read(); }, 5 * 60 * 1000);
    const onFocus = () => { if (document.visibilityState === "visible") void read(); };
    document.addEventListener("visibilitychange", onFocus);
    return () => { controller.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", onFocus); };
  }, [city, prefs.coords, prefs.unit, weatherRound, token]);
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
          if (!city && family.weather?.place) update({ city: family.weather.place, coords: "", unit: family.weather.unit || "F" });
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

  // Sound
  useEffect(() => { sound.setLevels(prefs.sound, prefs.wind, prefs.rain); }, [prefs.sound, prefs.wind, prefs.rain, sound.setLevels]);
  const firstScape = useRef(true);
  useEffect(() => {
    if (firstScape.current) { firstScape.current = false; return; }
    if (!sound.playing) return;
    void (async () => { await sound.stop(); await sound.start(prefs.soundscape, prefs.sound, prefs.wind, prefs.rain); })();
  }, [prefs.soundscape]);
  useEffect(() => { if (!prefs.thunder || !sound.playing || prefs.soundscape !== "rain") return; const first = window.setTimeout(sound.rumble, 6000); const loop = window.setInterval(sound.rumble, 26000); return () => { clearTimeout(first); clearInterval(loop); }; }, [prefs.thunder, prefs.soundscape, sound.playing, sound.rumble]);
  useEffect(() => {
    if (!endsAt || !sound.playing) return;
    if (Date.now() >= endsAt) { void sound.stop(); setEndsAt(null); return; }
    const timer = window.setInterval(() => { if (Date.now() >= endsAt) { void sound.stop(); setEndsAt(null); } }, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt, sound.playing, sound.stop]);
  const toggleAudio = async () => {
    if (sound.playing) { await sound.stop(); setEndsAt(null); }
    else { await sound.start(prefs.soundscape, prefs.sound, prefs.wind, prefs.rain); if (prefs.minutes) setEndsAt(Date.now() + prefs.minutes * 60000); }
  };

  // Full screen: the real thing where the browser allows it, otherwise a focus view with no controls.
  useEffect(() => {
    const sync = () => setFull(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener("fullscreenchange", sync); document.addEventListener("webkitfullscreenchange", sync);
    return () => { document.removeEventListener("fullscreenchange", sync); document.removeEventListener("webkitfullscreenchange", sync); };
  }, []);
  const toggleFull = async () => {
    setMenuOpen(false);
    const doc = document as any, el = document.documentElement as any;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) { await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())?.catch?.(() => {}); return; }
    if (focus) { setFocus(false); return; }
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    try {
      if (!request) throw new Error("unsupported");
      await request.call(el, { navigationUI: "hide" });
      try { await (screen.orientation as any)?.lock?.("landscape"); } catch {}
    } catch {
      setFocus(true);
      let seen = false; try { seen = localStorage.getItem("arise-atmosphere-focus-tip") === "1"; localStorage.setItem("arise-atmosphere-focus-tip", "1"); } catch {}
      if (!seen) { setTip("Full screen is on. Tap anywhere to show controls. For no browser bar at all on iPhone, tap Share → Add to Home Screen and open Atmosphere from there."); window.setTimeout(() => setTip(""), 9000); }
    }
  };

  // Controls fade away after a few quiet seconds and come back with any tap, move or key.
  useEffect(() => {
    if (!(prefs.autoHide || immersive) || settingsOpen || menuOpen) { setIdle(false); return; }
    let timer = window.setTimeout(() => setIdle(true), immersive ? 3500 : 6000);
    const wakeUp = () => { setIdle(false); clearTimeout(timer); timer = window.setTimeout(() => setIdle(true), immersive ? 3500 : 6000); };
    const events = ["pointerdown", "pointermove", "keydown", "wheel"] as const;
    events.forEach(e => window.addEventListener(e, wakeUp, { passive: true }));
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, wakeUp)); };
  }, [prefs.autoHide, immersive, settingsOpen, menuOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenuOpen(false); setSettingsOpen(false); if (focus) setFocus(false); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  const [locating, setLocating] = useState(false);
  const requestLocation = () => {
    if (!navigator.geolocation) { setWeatherError("This device can't share its location. Type your city instead."); return; }
    setLocating(true); setWeatherError("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const at = coords.latitude.toFixed(2) + "," + coords.longitude.toFixed(2);
      // The town name is only a label; weather comes from the coordinates even if no name is found.
      let place = "";
      try {
        const ctl = new AbortController(); const t = window.setTimeout(() => ctl.abort(), 6000);
        const data = await (await fetch("https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=" + coords.latitude + "&lon=" + coords.longitude, { signal: ctl.signal })).json();
        window.clearTimeout(t);
        const a = data?.address || {};
        const town = a.city || a.town || a.village || a.suburb || a.county;
        if (town) place = town + (a.state ? ", " + a.state : "");
      } catch { /* no name; coordinates still work */ }
      update({ city: place || "My location", coords: at }); setWeatherRound(r => r + 1); setLocating(false);
    }, (err) => {
      setLocating(false);
      setWeatherError(err.code === 1 ? "Location is turned off for this site. Allow it in your browser settings, or type your city." : "Couldn't get your location. Type your city instead.");
    }, { timeout: 15000, maximumAge: 10 * 60000 });
  };

  const liveScene: Scene = weather ? sceneFor(weather.current.code) : "clear";
  const kiteTheme: KiteThemeId | null = sleeping
    ? (prefs.sleepScene === "rain" ? null : prefs.sleepScene === "lantern" || prefs.theme === "live" ? "lantern" : prefs.theme)
    : prefs.theme === "live" ? null : prefs.theme;
  const scene: Scene = sleeping ? (prefs.thunder ? "storm" : "rain") : liveScene;
  const IconNow = weather ? ICON[liveScene] : CloudSun;
  const h = now.getHours();
  const clockText = prefs.hour24 ? pad(h) + ":" + pad(now.getMinutes()) : ((h % 12) || 12) + ":" + pad(now.getMinutes());
  const ampm = prefs.hour24 ? "" : h < 12 ? "AM" : "PM";
  const secs = prefs.seconds ? pad(now.getSeconds()) : "";
  const dayText = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const dim = prefs.nightDim && (h >= 21 || h < 6);
  const liveBriefLines = useMemo(() => brief?.sections.filter(s => s.lines.length).slice(0, 3) || [], [brief]);
  const sections = liveBriefLines.flatMap(s => s.lines.slice(0, 3).map(l => ({ ...l, section: s.title }))).slice(0, 6);
  const soundInfo = SOUNDS.find(s => s.id === prefs.soundscape) ?? SOUNDS[0];
  const hubs: { id: Source; label: string; href: string; Icon: typeof Home }[] = [
    { id: "work" as Source, label: "WorkHub", href: "#/workhub", Icon: BriefcaseBusiness },
    { id: "life" as Source, label: "LifeHub", href: "#/lifehub", Icon: Home },
  ].sort((a, b) => (a.id === origin ? -1 : b.id === origin ? 1 : 0));
  const statusText = sleeping ? "SLEEP STUDIO" : kiteTheme ? KITE_THEMES[kiteTheme].name.toUpperCase() : weather ? "LIVE WEATHER" : "STANDBY";
  const Clock = ({ big }: { big?: boolean }) => <div className={"ambient-clock" + (big ? " ambient-clock-xl" : "")}><span>{clockText}</span>{secs && <em>{secs}</em>}{ampm && <small>{ampm}</small>}</div>;

  const rootClass = [
    "ambient-root", kiteTheme ? "ambient-kites ambient-k-" + kiteTheme + (KITE_THEMES[kiteTheme].night ? " ambient-k-night" : " ambient-k-day") : "ambient-" + scene,
    sleeping ? "ambient-sleep" : "", prefs.quality === "balanced" ? "ambient-balanced" : "", idle ? "ambient-idle" : "",
    immersive ? "ambient-immersive" : "", dim ? "ambient-dim" : "", prefs.font === "elegant" ? "ambient-font-elegant" : "", "ambient-layout-" + (sleeping ? "sleep" : prefs.layout),
  ].join(" ");

  return <main className={rootClass} data-testid="arise-atmosphere">
    {!kiteTheme && <div className="ambient-photo" aria-hidden="true" />}
    <div className="ambient-wash" aria-hidden="true" />
    {kiteTheme
      ? <KiteCanvas theme={kiteTheme} kites={prefs.kites} wind={prefs.breeze} strings={prefs.strings} quality={prefs.quality} sleepy={sleeping} />
      : <AtmosphereCanvas scene={scene} sleep={sleeping} quality={prefs.quality} intensity={prefs.rain} />}
    <div className="ambient-vignette" aria-hidden="true" />
    <div className="ambient-screen">
      <header className="ambient-header ambient-chrome">
        <div className="ambient-menu-wrap">
          <button className="ambient-icon-action ambient-menu-btn" onClick={() => setMenuOpen(o => !o)} aria-label="Atmosphere menu" aria-haspopup="menu" aria-expanded={menuOpen} data-testid="atmosphere-menu"><LayoutGrid size={18} /></button>
          {menuOpen && <>
            <div className="ambient-menu-scrim" onClick={() => setMenuOpen(false)} />
            <div className="ambient-menu" role="menu" aria-label="Atmosphere menu">
              {hubs.map(({ id, label, href, Icon }) => <a key={id} role="menuitem" href={href} className="ambient-menu-item"><span className="ambient-menu-ico"><Icon size={16} /></span>{label}{id === origin && <small>Back</small>}</a>)}
              <div className="ambient-menu-label">Scene</div>
              <div className="ambient-menu-swatches">
                {(["live", ...KITE_THEME_ORDER] as ThemeId[]).map(id => <button key={id} type="button" title={themeName(id)} aria-label={themeName(id)} aria-pressed={prefs.theme === id} className={prefs.theme === id ? "selected" : ""} style={{ background: swatch(id) }} onClick={() => update({ theme: id })}>{prefs.theme === id && <Check size={13} />}</button>)}
              </div>
              <div className="ambient-menu-sep" />
              <button role="menuitem" className="ambient-menu-item" onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}><span className="ambient-menu-ico"><Settings2 size={16} /></span>Settings</button>
              <button role="menuitem" className="ambient-menu-item" onClick={() => void toggleFull()}><span className="ambient-menu-ico">{immersive ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</span>{immersive ? "Exit full screen" : "Full screen"}</button>
            </div>
          </>}
        </div>
        <div className="ambient-mark"><span className="ambient-mark-dot" /> A.R.I.S.E. <strong>ATMOSPHERE</strong></div>
        <div className="ambient-top-actions">
          <span className="ambient-live"><span />{statusText}</span>
          <button className="ambient-icon-action" onClick={() => setSettingsOpen(s => !s)} aria-label="Settings" aria-expanded={settingsOpen}><Settings2 size={18} /></button>
          <button className="ambient-icon-action" onClick={() => void toggleFull()} aria-label={immersive ? "Exit full screen" : "Enter full screen"}>{immersive ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
        </div>
      </header>
      <div className="ambient-main">
        {!sleeping ? <>
          <section className="ambient-clock-panel" aria-label="Current time and daily brief">
            <div className="ambient-eyebrow"><span className="ambient-hairline" /> THE MOMENT, RIGHT NOW</div>
            <Clock big={prefs.layout === "clock"} />
            <div className="ambient-date">{dayText}</div>
            {prefs.layout === "clock" && weather && <div className="ambient-chip"><IconNow size={18} strokeWidth={1.6} /> {weather.current.temp}° · {weatherCode(weather.current.code).text}</div>}
            {prefs.layout === "full" && <>
              <div className="ambient-divider" />
              <div className="ambient-greeting">{brief?.greeting || (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening")}<span className="ambient-accent-dot">.</span></div>
              <p className="ambient-summary">{brief?.summary || (briefBusy ? "Gathering your day…" : "Your day, at a glance.")}</p>
              <div className="ambient-agenda">
                <div className="ambient-agenda-heading"><CalendarDays size={15} /> YOUR DAILY BRIEF <button onClick={() => update({ source: prefs.source === "life" ? "work" : "life" })} title="Switch between your LifeHub and WorkHub brief">{prefs.source === "life" ? "LifeHub" : "WorkHub"} <ChevronDown size={12} /></button></div>
                {sections.length ? sections.map((item, i) => <div className="ambient-agenda-row" key={i}><span className="ambient-agenda-bullet" /><span className="ambient-agenda-text">{item.text}</span><span className="ambient-agenda-when">{item.when || item.section}</span></div>)
                  : <div className="ambient-agenda-empty">{briefBusy ? "Loading your saved schedule…" : brief ? "Your brief is clear today." : `Open ${prefs.source === "work" ? "WorkHub" : "LifeHub"} to add tasks and calendar events.`}</div>}
              </div>
            </>}
          </section>
          {prefs.layout !== "clock" && <section className="ambient-weather-panel" aria-label="Live weather">
            <div className="ambient-weather-heading"><MapPin size={14} /><span>{weather?.place || city || "CHOOSE YOUR LOCATION"}</span></div>
            {weather || weatherBusy ? <div className="ambient-weather-top">
              <div className="ambient-weather-art"><IconNow strokeWidth={.75} aria-hidden="true" /></div>
              <div className="ambient-weather-copy"><div className="ambient-temp">{weather ? weather.current.temp + "°" : "—"}</div><div className="ambient-weather-label">{weather ? weatherCode(weather.current.code).text : "Checking the forecast"}</div></div>
            </div> : <p className="ambient-weather-empty">{weatherError || "Add your city to see live weather and the next four days here."}</p>}
            {weather && <div className="ambient-weather-stats"><div><Droplets size={15} /> {weather.current.humidity}% <span>humidity</span></div><div><Wind size={15} /> {weather.current.wind} <span>{prefs.unit === "F" ? "mph" : "km/h"}</span></div><div><CloudSun size={15} /> {weather.current.feels}° <span>feels like</span></div></div>}
            {weather?.days?.length ? <div className="ambient-forecast">{weather.days.slice(0, 4).map(d => <div key={d.date}><span>{new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })}</span><strong>{d.high}°</strong><small>{d.low}°</small></div>)}</div> : <button className="ambient-place-inline" onClick={() => setSettingsOpen(true)}><MapPin size={15} /> Add a city</button>}
            <div className="ambient-weather-foot">{weatherUpdated ? "Updated " + weatherUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "Weather by Open-Meteo"} <button aria-label="Refresh weather" onClick={() => setWeatherRound(s => s + 1)} disabled={!city}><RefreshCw size={14} className={weatherBusy ? "ambient-spinning" : ""} /></button></div>
          </section>}
        </> : <>
          <section className="ambient-sleep-content">
            <div className="ambient-eyebrow"><span className="ambient-hairline" /> YOUR PERSONAL ESCAPE</div>
            <h1>Let the world<br /><em>slow down.</em></h1>
            <p>{soundInfo.line}</p>
            <div className="ambient-sleep-controls ambient-chrome-soft">
              <button className="ambient-audio-play" onClick={() => void toggleAudio()}>{sound.playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />} {sound.playing ? "Pause" : "Play " + soundInfo.label.toLowerCase()}</button>
              <div className="ambient-audio-state">{sound.playing ? <><span className="ambient-playing-indicator" /> NOW PLAYING{endsAt ? " · TIMER ON" : ""}</> : "AUDIO IS OFF"}</div>
            </div>
            <div className="ambient-sound-chips ambient-chrome-soft" role="group" aria-label="Soundscape">
              {SOUNDS.map(s => <button key={s.id} className={prefs.soundscape === s.id ? "selected" : ""} aria-pressed={prefs.soundscape === s.id} onClick={() => update({ soundscape: s.id })}>{s.id === "ocean" ? <Waves size={14} /> : s.id === "breeze" ? <Wind size={14} /> : s.id === "rain" ? <CloudRain size={14} /> : <Moon size={14} />}{s.label}</button>)}
            </div>
            {sound.error && <p role="alert" className="ambient-audio-error">{sound.error}</p>}
          </section>
          {prefs.showClock && <div className="ambient-sleep-clock"><Clock /><p>{dayText}</p></div>}
        </>}
      </div>
      <footer className="ambient-footer ambient-chrome">
        <div className="ambient-mode-switch" role="group" aria-label="Atmosphere mode">
          <button className={!sleeping ? "selected" : ""} aria-pressed={!sleeping} onClick={() => update({ mode: "standby" })}><CloudSun size={17} /> StandBy</button>
          <button className={sleeping ? "selected" : ""} aria-pressed={sleeping} onClick={() => update({ mode: "sleep" })}><Moon size={17} /> Sleep</button>
        </div>
        <div className="ambient-footer-note">{sleeping ? (endsAt && sound.playing ? "SLEEP TIMER ON" : "SOUND MADE LIVE ON THIS DEVICE") : kiteTheme ? "WIND " + (prefs.breeze < 34 ? "CALM" : prefs.breeze < 67 ? "BREEZY" : "GUSTY") + "  ·  " + prefs.kites + " KITES" : "LIVE CONDITIONS  ·  UPDATES EVERY 5 MIN"}</div>
        <button className="ambient-footer-sound" onClick={() => void toggleAudio()} aria-label={sound.playing ? "Stop " + soundInfo.label + " sound" : "Play " + soundInfo.label + " sound"} title={soundInfo.label + " sound"}>{sound.playing ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
      </footer>
    </div>
    {tip && <div className="ambient-tip" role="status" onClick={() => setTip("")}>{tip}</div>}
    {settingsOpen && <div className="ambient-settings-overlay" onClick={() => setSettingsOpen(false)}><aside className="ambient-settings" onClick={e => e.stopPropagation()} aria-label="Atmosphere settings"><div className="ambient-settings-head"><div><small>MAKE IT YOURS</small><h2>Atmosphere settings</h2></div><button className="ambient-icon-action" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={19} /></button></div>
      <div className="ambient-settings-scroll">
        <h3 className="ambient-settings-section">Scene</h3>
        <div className="ambient-theme-grid" role="group" aria-label="Scene">
          {(["live", ...KITE_THEME_ORDER] as ThemeId[]).map(id => <button key={id} className={"ambient-theme-card" + (prefs.theme === id ? " selected" : "")} aria-pressed={prefs.theme === id} onClick={() => update({ theme: id })}>
            <ThemeArt id={id} /><strong>{themeName(id)}</strong><span>{id === "live" ? "Scenery follows your weather" : KITE_THEMES[id].blurb}</span>
          </button>)}
        </div>
        {prefs.theme !== "live" && <>
          <div className="ambient-field"><label>Kites in the sky</label><div className="ambient-choice">{KITE_COUNTS.map(k => <button key={k.n} className={prefs.kites === k.n ? "selected" : ""} onClick={() => update({ kites: k.n })}>{k.label}</button>)}</div></div>
          <div className="ambient-field"><label htmlFor="ambient-breeze">Wind <strong>{prefs.breeze < 34 ? "Calm" : prefs.breeze < 67 ? "Breezy" : "Gusty"}</strong></label><input id="ambient-breeze" type="range" min="0" max="100" value={prefs.breeze} onChange={e => update({ breeze: Number(e.target.value) })} /></div>
          <div className="ambient-field ambient-toggle-row"><label htmlFor="ambient-strings">Show kite strings</label><input id="ambient-strings" type="checkbox" checked={prefs.strings} onChange={e => update({ strings: e.target.checked })} /></div>
        </>}

        <h3 className="ambient-settings-section">Clock and layout</h3>
        <div className="ambient-field"><label>On screen</label><div className="ambient-choice"><button className={prefs.layout === "full" ? "selected" : ""} onClick={() => update({ layout: "full" })}>Everything</button><button className={prefs.layout === "weather" ? "selected" : ""} onClick={() => update({ layout: "weather" })}>Clock + weather</button><button className={prefs.layout === "clock" ? "selected" : ""} onClick={() => update({ layout: "clock" })}>Big clock</button></div></div>
        <div className="ambient-field"><label>Clock</label><div className="ambient-choice"><button className={!prefs.hour24 ? "selected" : ""} onClick={() => update({ hour24: false })}>12-hour</button><button className={prefs.hour24 ? "selected" : ""} onClick={() => update({ hour24: true })}>24-hour</button></div></div>
        <div className="ambient-field"><label>Clock style</label><div className="ambient-choice"><button className={"ambient-font-sample-modern" + (prefs.font === "modern" ? " selected" : "")} onClick={() => update({ font: "modern" })}>Modern 9:41</button><button className={"ambient-font-sample-elegant" + (prefs.font === "elegant" ? " selected" : "")} onClick={() => update({ font: "elegant" })}>Elegant 9:41</button></div></div>
        <div className="ambient-field ambient-toggle-row"><label htmlFor="ambient-seconds">Show seconds</label><input id="ambient-seconds" type="checkbox" checked={prefs.seconds} onChange={e => update({ seconds: e.target.checked })} /></div>
        <div className="ambient-field"><label>Brief from</label><div className="ambient-choice"><button className={prefs.source === "life" ? "selected" : ""} onClick={() => update({ source: "life" })}>LifeHub</button><button className={prefs.source === "work" ? "selected" : ""} onClick={() => update({ source: "work" })}>WorkHub</button></div></div>

        <h3 className="ambient-settings-section">Weather</h3>
        <div className="ambient-field"><label htmlFor="ambient-place">Your city <span>Live weather</span></label><form className="ambient-location" onSubmit={e => { e.preventDefault(); if (cityDraft.trim()) { update({ city: cityDraft.trim(), coords: "" }); setWeatherRound(r => r + 1); } }}><input id="ambient-place" placeholder="Denver, Colorado" value={cityDraft} onChange={e => setCityDraft(e.target.value)} maxLength={80} /><button type="submit">Save</button></form><button className="ambient-location-link" onClick={requestLocation} disabled={locating}><MapPin size={14} /> {locating ? "Finding you…" : "Use my location"}</button>{weatherError && <p className="ambient-error" role="alert">{weatherError}</p>}</div>
        <div className="ambient-field"><label>Temperature</label><div className="ambient-choice"><button className={prefs.unit === "F" ? "selected" : ""} onClick={() => update({ unit: "F" })}>°F</button><button className={prefs.unit === "C" ? "selected" : ""} onClick={() => update({ unit: "C" })}>°C</button></div></div>

        <h3 className="ambient-settings-section">Sound and sleep</h3>
        <div className="ambient-field"><label>Soundscape</label><div className="ambient-choice ambient-choice-4">{SOUNDS.map(s => <button key={s.id} className={prefs.soundscape === s.id ? "selected" : ""} onClick={() => update({ soundscape: s.id })}>{s.label}</button>)}</div></div>
        <div className="ambient-field"><label htmlFor="ambient-volume">Volume <strong>{prefs.sound}%</strong></label><input id="ambient-volume" type="range" min="0" max="100" value={prefs.sound} onChange={e => update({ sound: Number(e.target.value) })} /></div>
        <div className="ambient-field"><label>Sleep Studio scene</label><div className="ambient-choice"><button className={prefs.sleepScene === "rain" ? "selected" : ""} onClick={() => update({ sleepScene: "rain" })}>Rain on glass</button><button className={prefs.sleepScene === "lantern" ? "selected" : ""} onClick={() => update({ sleepScene: "lantern" })}>Lantern kites</button><button className={prefs.sleepScene === "theme" ? "selected" : ""} onClick={() => update({ sleepScene: "theme" })}>My scene</button></div></div>
        {prefs.sleepScene === "rain" && <div className="ambient-field"><label htmlFor="ambient-rain">Rain on glass <strong>{prefs.rain}%</strong></label><input id="ambient-rain" type="range" min="20" max="100" value={prefs.rain} onChange={e => update({ rain: Number(e.target.value) })} /></div>}
        <div className="ambient-field ambient-toggle-row"><label htmlFor="ambient-wind">Add a soft wind layer</label><input id="ambient-wind" type="checkbox" checked={prefs.wind} onChange={e => update({ wind: e.target.checked })} /></div>
        {prefs.soundscape === "rain" && <div className="ambient-field ambient-toggle-row"><label htmlFor="ambient-thunder">Distant thunder and storm flashes</label><input id="ambient-thunder" type="checkbox" checked={prefs.thunder} onChange={e => update({ thunder: e.target.checked })} /></div>}
        <div className="ambient-field"><label htmlFor="ambient-duration">Sound timer</label><select id="ambient-duration" value={prefs.minutes} onChange={e => { const m = Number(e.target.value); update({ minutes: m }); if (sound.playing) setEndsAt(m ? Date.now() + m * 60000 : null); }}><option value={0}>Play until I stop it</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={120}>2 hours</option><option value={240}>4 hours</option><option value={480}>8 hours</option></select></div>
        <div className="ambient-field ambient-toggle-row"><label htmlFor="ambient-clock-toggle">Clock in Sleep Studio</label><input id="ambient-clock-toggle" type="checkbox" checked={prefs.showClock} onChange={e => update({ showClock: e.target.checked })} /></div>

        <h3 className="ambient-settings-section">Display</h3>
        <div className="ambient-field"><label>Graphics</label><div className="ambient-choice"><button className={prefs.quality === "cinematic" ? "selected" : ""} onClick={() => update({ quality: "cinematic" })}>Ultra</button><button className={prefs.quality === "balanced" ? "selected" : ""} onClick={() => update({ quality: "balanced" })}>Battery saver</button></div></div>
        <div className="ambient-field ambient-toggle-row"><label htmlFor="ambient-autohide">Hide controls when idle</label><input id="ambient-autohide" type="checkbox" checked={prefs.autoHide} onChange={e => update({ autoHide: e.target.checked })} /></div>
        <div className="ambient-field ambient-toggle-row"><label htmlFor="ambient-dim">Dim the screen at night (9 PM–6 AM)</label><input id="ambient-dim" type="checkbox" checked={prefs.nightDim} onChange={e => update({ nightDim: e.target.checked })} /></div>
        <div className="ambient-field ambient-toggle-row"><label htmlFor="ambient-awake">Keep screen awake when supported</label><input id="ambient-awake" type="checkbox" checked={prefs.keepAwake} onChange={e => update({ keepAwake: e.target.checked })} /></div>
        <p className="ambient-help">Weather comes from Open-Meteo and refreshes about every five minutes while Atmosphere is open. Sound starts only after you press Play. On iPhone, add A.R.I.S.E. to your Home Screen for full screen with no browser bar.</p>
      </div>
    </aside></div>}
  </main>;
}
