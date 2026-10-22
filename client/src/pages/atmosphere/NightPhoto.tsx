import { useEffect, useRef, useState } from "react";
import { NIGHT_SCENES, photoUrl, photoWidth, type FxId, type NightScene, type NightSceneId } from "./nightScenery";
import { CROSSFADE, clipSources } from "./videoScenery";

type Quality = "cinematic" | "balanced";
const measure = () => ({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 });
const seeded = (seed: number) => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

/** The screen's size in real pixels, kept current as a phone turns or a window is resized. */
function useScreen() {
  const [size, setSize] = useState(measure);
  useEffect(() => {
    let timer = 0;
    const on = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setSize(measure()), 250); };
    window.addEventListener("resize", on); window.addEventListener("orientationchange", on);
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", on); window.removeEventListener("orientationchange", on); };
  }, []);
  return size;
}

/** A starry sky painted in the browser, shown when the photo cannot load. Sharp at any size. */
function FallbackSky({ scene }: { scene: NightScene }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(1, Math.round(rect.width * dpr)), H = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = W; canvas.height = H;
      const rand = seeded(scene.id.length * 977 + 31);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, scene.tint[0]); sky.addColorStop(.7, scene.tint[1]); sky.addColorStop(1, scene.tint[0]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // The Milky Way: a soft slanted band of light with many fine stars inside it.
      ctx.save(); ctx.translate(W * .5, H * .38); ctx.rotate(-.5);
      const band = ctx.createLinearGradient(0, -H * .28, 0, H * .28);
      band.addColorStop(0, "rgba(150,170,230,0)"); band.addColorStop(.5, "rgba(190,200,245,.24)"); band.addColorStop(1, "rgba(150,170,230,0)");
      ctx.fillStyle = band; ctx.fillRect(-W, -H * .28, W * 2, H * .56);
      for (let i = 0; i < 2600; i++) {
        const gx = (rand() + rand() + rand() - 1.5) * H * .22, gy = (rand() - .5) * W * 1.7;
        ctx.fillStyle = `rgba(225,232,255,${.08 + rand() * .32})`; ctx.fillRect(gy, gx, dpr * (.6 + rand() * .9), dpr * (.6 + rand() * .9));
      }
      ctx.restore();
      for (let i = 0; i < 700; i++) {
        const x = rand() * W, y = rand() * H * .78, r = (.4 + Math.pow(rand(), 3) * 1.8) * dpr;
        ctx.fillStyle = `rgba(255,252,240,${.35 + rand() * .65})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // A far ridge and a near one, dark against the glow at the horizon.
      for (const [base, rough, shade, seed] of [[.8, .09, "rgba(6,10,22,.72)", 3], [.9, .06, "rgba(2,4,12,.96)", 9]] as const) {
        const r2 = seeded(seed + scene.id.length); const phase = r2() * 6;
        ctx.fillStyle = shade; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 6 * dpr) ctx.lineTo(x, H * base - Math.sin(x / W * 5 + phase) * H * rough * .5 - Math.sin(x / W * 13 + phase * 2) * H * rough * .22);
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      }
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(canvas);
    return () => observer.disconnect();
  }, [scene]);
  return <canvas ref={ref} className="ambient-night-fallback" aria-hidden="true" />;
}

/** Soft round glow, drawn once and stamped many times. */
function glowSprite(size: number, color: string) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d")!; const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color); grad.addColorStop(.35, color.replace(/[\d.]+\)$/, ".35)")); grad.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  g.fillStyle = grad; g.fillRect(0, 0, size, size); return c;
}

/** The life laid over a photo: shooting stars, fireflies, snow, rain, mist, lanterns, lightning. */
function SceneLife({ fx, quality, intensity }: { fx: FxId[]; quality: Quality; intensity: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = fx.join(",");
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !fx.length) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    const high = quality === "cinematic", on = (id: FxId) => fx.includes(id);
    let W = 1, H = 1, raf = 0, last = performance.now(), t = 0;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const firefly = glowSprite(64, "rgba(214,255,140,1)"), lantern = glowSprite(96, "rgba(255,176,84,1)"), fog = glowSprite(256, "rgba(190,205,230,1)");
    type P = { x: number; y: number; z: number; v: number; a: number; s: number };
    let flakes: P[] = [], drops: P[] = [], flies: P[] = [], lanterns: P[] = [], banks: P[] = [];
    let star: { x: number; y: number; vx: number; vy: number; life: number; len: number } | null = null, nextStar = rand(3, 8), nextFlash = rand(9, 22), flash = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, high ? 2 : 1);
      W = Math.max(1, rect.width); H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const area = Math.min(2.2, (W * H) / (1280 * 720)), n = (base: number) => Math.round(base * Math.max(.6, area) * (high ? 1 : .55));
      const make = (count: number, f: () => P) => Array.from({ length: count }, f);
      flakes = make(n(150), () => ({ x: rand(0, W), y: rand(0, H), z: rand(.35, 1.4), v: rand(18, 46), a: rand(0, 6.28), s: rand(1, 2.6) }));
      drops = make(n(190), () => ({ x: rand(0, W), y: rand(0, H), z: rand(.4, 1.3), v: rand(520, 980), a: 0, s: rand(10, 26) }));
      flies = make(n(34), () => ({ x: rand(0, W), y: rand(H * .5, H * .95), z: rand(.5, 1.3), v: rand(6, 20), a: rand(0, 6.28), s: rand(1.5, 4) }));
      lanterns = make(n(16), () => ({ x: rand(0, W), y: rand(H * .2, H * 1.1), z: rand(.5, 1.3), v: rand(10, 26), a: rand(0, 6.28), s: rand(14, 34) }));
      banks = make(5, () => ({ x: rand(-W * .2, W), y: rand(H * .45, H * .95), z: rand(.8, 1.7), v: rand(3, 9), a: rand(.05, .1), s: rand(W * .45, W * .85) }));
    };
    const frame = (now: number) => {
      const dt = Math.min(.06, (now - last) / 1000); last = now; t += dt;
      ctx.clearRect(0, 0, W, H);
      if (on("mist")) for (const b of banks) {
        b.x += b.v * dt; if (b.x - b.s > W) b.x = -b.s;
        ctx.globalAlpha = b.a * (.8 + .2 * Math.sin(t * .2 + b.y)); ctx.drawImage(fog, b.x - b.s / 2, b.y - b.s * .18, b.s, b.s * .36);
      }
      if (on("snow")) { ctx.fillStyle = "#f4f9ff"; for (const p of flakes) {
        p.y += p.v * p.z * dt * Math.max(.5, intensity / 80); p.x += Math.sin(t * .8 + p.a) * 14 * dt * p.z;
        if (p.y > H + 6) { p.y = -6; p.x = rand(0, W); } if (p.x < -6) p.x = W + 6; if (p.x > W + 6) p.x = -6;
        ctx.globalAlpha = .35 + .5 * Math.min(1, p.z / 1.2); ctx.beginPath(); ctx.arc(p.x, p.y, p.s * p.z, 0, 6.283); ctx.fill();
      } }
      if (on("rain")) { ctx.strokeStyle = "rgba(205,225,250,1)"; ctx.lineCap = "round"; for (const p of drops) {
        const sp = p.v * Math.max(.5, intensity / 80); p.y += sp * dt; p.x -= sp * .12 * dt;
        if (p.y > H + 30) { p.y = -30; p.x = rand(0, W + 60); }
        ctx.globalAlpha = .12 + .26 * p.z; ctx.lineWidth = Math.max(.6, p.z * .9); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.s * .12 * p.z, p.y - p.s * p.z); ctx.stroke();
      } }
      if (on("fireflies")) for (const p of flies) {
        p.a += dt * (.4 + p.z * .3); p.x += Math.cos(p.a) * p.v * dt; p.y += Math.sin(p.a * 1.3) * p.v * .6 * dt;
        if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20; if (p.y < H * .4) p.y = H * .4; if (p.y > H) p.y = H * .98;
        const pulse = .5 + .5 * Math.sin(t * (1.1 + p.z) + p.s * 9); ctx.globalAlpha = pulse * pulse * .9;
        const r = p.s * 5 * p.z; ctx.drawImage(firefly, p.x - r, p.y - r, r * 2, r * 2);
      }
      if (on("lanterns")) for (const p of lanterns) {
        p.y -= p.v * p.z * dt; p.x += Math.sin(t * .5 + p.a) * 8 * dt;
        if (p.y < -60) { p.y = H + 60; p.x = rand(0, W); }
        const fade = Math.min(1, Math.max(0, (p.y + 40) / (H * .25))) * Math.min(1, (H + 60 - p.y) / 120);
        ctx.globalAlpha = .55 * fade; const r = p.s * p.z; ctx.drawImage(lantern, p.x - r, p.y - r, r * 2, r * 2);
      }
      if (on("shooting")) {
        nextStar -= dt;
        if (!star && nextStar <= 0) { const sp = rand(900, 1400), ang = rand(.35, .75); star = { x: rand(W * .15, W * .85), y: rand(H * .04, H * .35), vx: sp * Math.cos(ang), vy: sp * Math.sin(ang), life: 0, len: rand(120, 260) }; nextStar = rand(9, 24); }
        if (star) {
          star.life += dt; star.x += star.vx * dt; star.y += star.vy * dt;
          const fade = Math.sin(Math.min(1, star.life / .9) * Math.PI), m = Math.hypot(star.vx, star.vy), tx = star.x - star.vx / m * star.len, ty = star.y - star.vy / m * star.len;
          const g = ctx.createLinearGradient(star.x, star.y, tx, ty); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.globalAlpha = fade * .9; ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(star.x, star.y); ctx.lineTo(tx, ty); ctx.stroke();
          if (star.life > .9) star = null;
        }
      }
      if (on("flash")) {
        nextFlash -= dt; if (nextFlash <= 0) { flash = 1; nextFlash = rand(10, 26); }
        if (flash > 0) { ctx.globalAlpha = flash * .22 * (Math.random() > .35 ? 1 : .4); ctx.fillStyle = "#dce9ff"; ctx.fillRect(0, 0, W, H); flash -= dt * 2.4; }
      }
      ctx.globalAlpha = 1; raf = requestAnimationFrame(frame);
    };
    resize(); raf = requestAnimationFrame(frame);
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, quality, intensity]);
  return <canvas ref={ref} className="ambient-canvas ambient-life" aria-hidden="true" />;
}

/**
 * Video laid over the still photo. With several clips it plays them one after another, preloading the next on a
 * second player and crossfading into it, so a long scene never shows a gap. Each clip has a 4K and a 1080p file;
 * a file that fails falls back to the other, then that clip is skipped. If nothing can play (blocked autoplay,
 * no network) the layer stays invisible and the photograph underneath is what you see.
 */
function VideoLayer({ sources, focus }: { sources: string[][]; focus: string }) {
  const a = useRef<HTMLVideoElement>(null), b = useRef<HTMLVideoElement>(null);
  const [vis, setVis] = useState<[boolean, boolean]>([false, false]);
  const [front, setFront] = useState(0);
  const key = JSON.stringify(sources);
  useEffect(() => {
    const n = sources.length, v = [a.current, b.current] as HTMLVideoElement[];
    if (!n || !v[0] || !v[1]) return;
    const slot = [{ clip: 0, tryN: 0 }, { clip: 0, tryN: 0 }], solo = n === 1;
    let active = 0, switching = false, dead = false, failures = 0, hidden = false;
    const timers: number[] = [];
    const show = (i: number, on: boolean) => setVis((old) => { const c: [boolean, boolean] = [old[0], old[1]]; c[i] = on; return c; });
    const load = (i: number, clip: number) => { slot[i].clip = clip % n; slot[i].tryN = 0; v[i].src = sources[clip % n][0]; v[i].load(); };
    const play = (i: number) => { if (!hidden) void v[i].play().catch(() => {}); };
    const swap = () => {
      if (switching || solo || dead || v[1 - active].readyState < 3) return;
      const from = active, to = 1 - active;
      switching = true; active = to; setFront(to); play(to);
      timers.push(window.setTimeout(() => {   // once the new clip has faded in, retire the old one and queue the next
        if (dead) return;
        show(from, false); v[from].pause(); load(from, slot[to].clip + 1); switching = false;
      }, CROSSFADE * 1000 + 400));
    };
    const handlers = v.map((el, i) => {
      const onCanPlay = () => { if (i === active && el.paused && !el.ended) play(i); };
      const onPlaying = () => { if (i === active) show(i, true); };
      const onError = () => {
        if (dead) return;
        const list = sources[slot[i].clip];
        if (slot[i].tryN + 1 < list.length) { slot[i].tryN++; el.src = list[slot[i].tryN]; el.load(); return; }
        if (++failures > n * 2 + 2 || solo) { dead = true; setVis([false, false]); return; }
        if (i === active) { const to = 1 - i; active = to; setFront(to); play(to); load(i, slot[to].clip + 1); }
        else load(i, slot[i].clip + 1);
      };
      el.addEventListener("canplay", onCanPlay); el.addEventListener("playing", onPlaying); el.addEventListener("error", onError);
      return () => { el.removeEventListener("canplay", onCanPlay); el.removeEventListener("playing", onPlaying); el.removeEventListener("error", onError); };
    });
    const tick = window.setInterval(() => {
      const cur = v[active];
      if (!solo && (cur.ended || (isFinite(cur.duration) && cur.duration > 0 && cur.duration - cur.currentTime <= CROSSFADE))) swap();
    }, 400);
    const onVisible = () => { hidden = document.hidden; if (hidden) v[active].pause(); else play(active); };
    document.addEventListener("visibilitychange", onVisible);
    load(0, 0); if (!solo) load(1, 1);
    return () => {
      dead = true; window.clearInterval(tick); timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener("visibilitychange", onVisible); handlers.forEach((off) => off());
      v.forEach((el) => { el.pause(); el.removeAttribute("src"); el.load(); });
      setVis([false, false]); setFront(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const props = { muted: true, playsInline: true, preload: "auto" as const, disablePictureInPicture: true, disableRemotePlayback: true, tabIndex: -1, loop: sources.length === 1 };
  return <>
    <video ref={a} {...props} className={"ambient-night-video" + (vis[0] ? " ambient-video-on" : "")} style={{ objectPosition: focus, zIndex: front === 0 ? 3 : 2 }} />
    <video ref={b} {...props} className={"ambient-night-video" + (vis[1] ? " ambient-video-on" : "")} style={{ objectPosition: focus, zIndex: front === 1 ? 3 : 2 }} />
  </>;
}

/**
 * A YouTube video or playlist (any length) filling the screen. It shows only once YouTube reports it is playing,
 * so the photograph stays up while it loads, or if the video can't be embedded.
 */
function YouTubeLayer({ src }: { src: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== "string") return;
      let m: any; try { m = JSON.parse(e.data); } catch { return; }
      const state = m?.event === "onStateChange" ? m.info : m?.event === "infoDelivery" ? m.info?.playerState : undefined;
      if (state === 1) setOn(true);
      if (m?.event === "onError") setOn(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [src]);
  const hello = () => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
  return <iframe ref={frame} key={src} src={src} title="Background video" tabIndex={-1} aria-hidden="true" onLoad={hello}
    allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"
    className={"ambient-night-yt" + (on ? " ambient-video-on" : "")} />;
}

type Layer = { key: string; id: NightSceneId; url: string; width: number };

/**
 * A full-screen night photograph. A new scene fades in over the old one; a sharper copy of the same
 * photo replaces a softer one when the screen gets bigger; and the starry fallback sits behind it all.
 */
export default function NightPhoto({ sceneId, quality, motion, fx, intensity = 80, video, youtube }: { sceneId: NightSceneId; quality: Quality; motion: boolean; fx?: FxId[]; intensity?: number; video?: { files: string[] } | null; youtube?: string | null }) {
  const scene = NIGHT_SCENES[sceneId];
  const screen = useScreen();
  const width = photoWidth(screen.w, screen.h, screen.dpr, quality);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const layersRef = useRef<Layer[]>([]);
  layersRef.current = layers;

  useEffect(() => {
    const top = layersRef.current[layersRef.current.length - 1];
    if (top && top.id === sceneId && top.width >= width) return;
    let alive = true, retryTimer = 0, cleanTimer = 0;
    const url = photoUrl(scene.photo, width, quality === "cinematic" ? 82 : 74);
    const img = new Image(); img.decoding = "async";
    img.onload = () => {
      if (!alive) return;
      setFailed(false);
      setLayers((old) => [...old.slice(-1), { key: sceneId + ":" + width + ":" + Date.now(), id: sceneId, url, width }]);
      cleanTimer = window.setTimeout(() => alive && setLayers((old) => old.slice(-1)), 1800);
    };
    img.onerror = () => { if (!alive) return; setFailed(true); retryTimer = window.setTimeout(() => alive && setRetry((n) => n + 1), 30000); };
    img.src = url;
    return () => { alive = false; img.onload = null; img.onerror = null; window.clearTimeout(retryTimer); window.clearTimeout(cleanTimer); };
  }, [sceneId, width, quality, retry, scene.photo]);

  const showFallback = failed && !layers.length;
  const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const playable = motion && !calm;
  const opts = { viewW: screen.w, viewH: screen.h, dpr: screen.dpr, quality, saveData: !!(navigator as any).connection?.saveData };
  const clip = video && playable && video.files.length ? video.files.map((f) => clipSources(f, opts)) : null;
  const tube = youtube && playable ? youtube : null;
  const life = clip || tube ? [] : fx ?? scene.fx;
  return <div className={"ambient-night" + (motion && !clip && !tube ? " ambient-night-moving" : "")} aria-hidden="true" style={{ background: `linear-gradient(180deg, ${scene.tint[0]}, ${scene.tint[1]})` }}>
    {(showFallback || !layers.length) && <FallbackSky scene={scene} />}
    {layers.map((layer, i) => <img key={layer.key} src={layer.url} alt="" decoding="async" draggable={false}
      className={"ambient-night-img" + (i === layers.length - 1 ? " ambient-night-new" : "")} style={{ objectPosition: NIGHT_SCENES[layer.id].focus }} />)}
    {clip && <VideoLayer sources={clip} focus={scene.focus} />}
    {tube && <YouTubeLayer src={tube} />}
    {motion && !clip && !tube && <SceneLife fx={life} quality={quality} intensity={intensity} />}
  </div>;
}
