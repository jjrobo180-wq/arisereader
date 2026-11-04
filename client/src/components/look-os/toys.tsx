// The moving parts of the interactive looks: a fidget spinner, bubble wrap, a lava lamp, a jar of
// marbles, a synth keyboard, jelly blocks, an orrery, a radio dial, ferrofluid and a slot machine.
// Each runs on touch with real momentum, and clicks, pops and buzzes (feel.ts). With `energy` set
// (0 to 1), a toy also moves on its own, which is how Arise Notes shows a recording's loudness.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { buzz, play, reducedMotion } from "./feel";
import "./toys.css";

/** Runs `fn(dt)` every frame while `on`. */
function useFrame(fn: (dt: number) => void, on = true) {
  const cb = useRef(fn); cb.current = fn;
  useEffect(() => {
    if (!on) return;
    let raf = 0, last = performance.now();
    const loop = (t: number) => { const dt = Math.min(0.05, (t - last) / 1000); last = t; cb.current(dt); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
}
const angleAt = (e: { clientX: number; clientY: number }, el: Element) => { const r = el.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ─── 1. Fidget spinner ───
export function Spinner({ arms, center, kick = 0, energy, size = 270 }: { arms: { label: string; value: string | number; onOpen?: () => void }[]; center?: ReactNode; kick?: number; energy?: number; size?: number }) {
  const el = useRef<HTMLDivElement>(null), rot = useRef<SVGGElement>(null);
  const s = useRef({ a: 0, v: 0, drag: false, last: 0, lastT: 0, moved: 0, seg: 0 });
  const [rpm, setRpm] = useState(0);
  useEffect(() => { if (kick) { s.current.v += 14; play.whoosh(0.8); buzz("medium"); } }, [kick]);
  useFrame((dt) => {
    const x = s.current;
    if (energy != null) x.v = x.v * 0.9 + energy * 30 * 0.1;
    else if (!x.drag) x.v *= Math.pow(0.55, dt); // bearings: a long, smooth spin-down
    if (!x.drag) x.a += x.v * dt;
    const seg = Math.floor(x.a / ((2 * Math.PI) / 3));
    if (seg !== x.seg) { x.seg = seg; if (energy == null) { play.tick(1 + Math.min(1, Math.abs(x.v) / 40) * .6); if (Math.abs(x.v) < 30) buzz("tick"); } }
    if (rot.current) rot.current.style.transform = `rotate(${x.a}rad)`;
    const r = Math.round(Math.abs(x.v) * 60 / (2 * Math.PI));
    setRpm((p) => (Math.abs(p - r) > 3 || (r === 0 && p !== 0) ? r : p));
  });
  const down = (e: RPointerEvent) => { const x = s.current; x.drag = true; x.last = angleAt(e, el.current!); x.lastT = performance.now(); x.moved = 0; x.v = 0; (e.target as Element).setPointerCapture?.(e.pointerId); buzz("light"); };
  const move = (e: RPointerEvent) => { const x = s.current; if (!x.drag) return; const a = angleAt(e, el.current!), d = wrap(a - x.last), t = performance.now(); x.a += d; x.moved += Math.abs(d); x.v = d / Math.max(0.008, (t - x.lastT) / 1000); x.last = a; x.lastT = t; };
  const up = (e: RPointerEvent) => {
    const x = s.current; if (!x.drag) return; x.drag = false;
    if (x.moved < 0.12) { // a tap: open the arm under your finger
      const a = wrap(angleAt(e, el.current!) + Math.PI / 2), i = ((Math.round(a / ((2 * Math.PI) / 3)) % 3) + 3) % 3;
      const r = el.current!.getBoundingClientRect(), dist = Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
      if (dist > r.width * 0.18) { buzz("medium"); play.click(); arms[i]?.onOpen?.(); }
      x.v = 0; return;
    }
    if (Math.abs(x.v) > 6) { play.whoosh(Math.abs(x.v) / 40); buzz("medium"); }
  };
  const lobe = (i: number) => { const a = (i * 2 * Math.PI) / 3 - Math.PI / 2, cx = 100 + Math.cos(a) * 58, cy = 100 + Math.sin(a) * 58; return { cx, cy, a }; };
  return <div ref={el} className="ty-spinner" style={{ width: size, height: size }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="group" aria-label="Fidget spinner. Flick to spin, tap an arm to open it">
    <svg viewBox="0 0 200 200" aria-hidden>
      <defs><radialGradient id="ty-bear" cx="40%" cy="35%"><stop offset="0" stopColor="#fff" /><stop offset=".45" stopColor="#b9c3d6" /><stop offset="1" stopColor="#4a5568" /></radialGradient>
        <linearGradient id="ty-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--an-violet)" /><stop offset="1" stopColor="color-mix(in srgb, var(--an-violet) 40%, #000)" /></linearGradient></defs>
      <g ref={rot} style={{ transformOrigin: "100px 100px" }}>
        <path d="M100 30 C128 30 136 58 130 72 C146 66 176 74 164 104 C156 126 128 122 118 112 C120 130 112 160 100 160 C88 160 80 130 82 112 C72 122 44 126 36 104 C24 74 54 66 70 72 C64 58 72 30 100 30Z" transform="rotate(0 100 100)" fill="url(#ty-body)" stroke="rgba(255,255,255,.25)" strokeWidth="1.2" />
        {[0, 1, 2].map((i) => { const { cx, cy } = lobe(i); return <g key={i}><circle cx={cx} cy={cy} r="21" fill="#0b0e14" /><circle cx={cx} cy={cy} r="17" fill="url(#ty-bear)" /><circle cx={cx} cy={cy} r="8" fill="#1b2230" />{[0, 1, 2, 3, 4, 5].map((k) => <circle key={k} cx={cx + Math.cos(k) * 12.5} cy={cy + Math.sin(k) * 12.5} r="2.2" fill="#e8edf7" />)}</g>; })}
        <circle cx="100" cy="100" r="26" fill="url(#ty-bear)" /><circle cx="100" cy="100" r="18" fill="var(--an-card)" />
      </g>
    </svg>
    {/* The arms' words stay upright: they sit outside the spinning part. */}
    {arms.slice(0, 3).map((arm, i) => { const { a } = lobe(i); return <span key={i} className="ty-arm" style={{ left: `${50 + Math.cos(a) * 44}%`, top: `${50 + Math.sin(a) * 44}%` }}><b>{arm.value}</b><small>{arm.label}</small></span>; })}
    <span className="ty-center">{center}<small>{rpm} rpm</small></span>
  </div>;
}

// ─── 2. Bubble wrap ───
export function BubbleWrap({ items, onPop, energy }: { items: { id: string; title: string }[]; onPop?: (id: string) => void; energy?: number }) {
  const [popped, setPopped] = useState<Record<number, number>>({});
  useEffect(() => { const t = window.setInterval(() => setPopped((p) => { const now = Date.now(), n: Record<number, number> = {}; for (const [k, v] of Object.entries(p)) if (now - v < 4500) n[+k] = v; return n; }), 1000); return () => window.clearInterval(t); }, []);
  const cells = Array.from({ length: 16 }, (_, i) => items[i]);
  return <div className="ty-wrap" data-live={energy != null ? "1" : undefined} style={{ "--e": energy ?? 0 } as CSSProperties}>
    {cells.map((it, i) => { const p = popped[i] != null; return <button key={i} type="button" className="ty-bubble" data-popped={p || undefined} data-task={it ? "1" : undefined} style={{ animationDelay: `${(i % 4) * 0.13 + Math.floor(i / 4) * 0.07}s` }}
      aria-label={it ? `Pop to finish ${it.title}` : "Pop a bubble"} onPointerDown={() => { if (p) return; play.pop(); buzz("medium"); setPopped((x) => ({ ...x, [i]: Date.now() })); if (it && onPop) window.setTimeout(() => onPop(it.id), 260); }}>
      {it && <span>{it.title}</span>}</button>; })}
  </div>;
}

// ─── 3. Lava lamp ───
export function LavaLamp({ count = 5, energy, label }: { count?: number; energy?: number; label?: ReactNode }) {
  const blobs = useRef(Array.from({ length: Math.min(9, Math.max(3, count + 2)) }, (_, i) => ({ y: Math.random(), x: 0.25 + Math.random() * 0.5, r: 14 + Math.random() * 16, sp: 0.04 + Math.random() * 0.05, ph: i * 1.7, dir: i % 2 ? 1 : -1 })));
  const g = useRef<SVGGElement>(null), heat = useRef(0);
  useFrame((dt) => {
    const h = energy != null ? energy : (heat.current = Math.max(0, heat.current - dt * 0.25));
    const kids = g.current?.children; if (!kids) return;
    blobs.current.forEach((b, i) => {
      b.y += b.dir * b.sp * dt * (1 + h * 5); if (b.y > 1.05) b.dir = -1; if (b.y < -0.05) b.dir = 1; b.ph += dt * (0.6 + h * 2);
      const c = kids[i] as SVGCircleElement | undefined; if (!c) return;
      c.setAttribute("cy", String(260 - b.y * 220)); c.setAttribute("cx", String(60 + (b.x - 0.5) * 50 + Math.sin(b.ph) * 10)); c.setAttribute("r", String(b.r * (1 + Math.sin(b.ph * 0.7) * 0.15)));
    });
  }, !reducedMotion() || energy != null);
  const touch = () => { heat.current = Math.min(1, heat.current + 0.5); play.bubble(); buzz("light"); };
  return <button type="button" className="ty-lava" onPointerDown={touch} aria-label="Lava lamp. Touch to warm it up">
    <svg viewBox="0 0 120 330" aria-hidden><defs><filter id="ty-goo"><feGaussianBlur in="SourceGraphic" stdDeviation="7" /><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -10" /></filter>
      <linearGradient id="ty-glass" x1="0" x2="1"><stop offset="0" stopColor="#5b1d6b" /><stop offset=".5" stopColor="#9b2d7a" /><stop offset="1" stopColor="#4a1458" /></linearGradient>
      <linearGradient id="ty-wax" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd25c" /><stop offset=".5" stopColor="#ff8a3d" /><stop offset="1" stopColor="#ff4f6d" /></linearGradient>
      <clipPath id="ty-bottle"><path d="M40 20 L80 20 L104 270 L16 270 Z" /></clipPath></defs>
      <path d="M44 4 L76 4 L80 20 L40 20 Z" fill="#c9c2d6" /><path d="M40 20 L80 20 L104 270 L16 270 Z" fill="url(#ty-glass)" />
      <g clipPath="url(#ty-bottle)"><g ref={g} filter="url(#ty-goo)" fill="url(#ty-wax)">{blobs.current.map((_, i) => <circle key={i} cx="60" cy="200" r="20" />)}<rect x="0" y="252" width="120" height="30" /></g></g>
      <path d="M44 22 L52 22 L30 262 L22 262 Z" fill="rgba(255,255,255,.14)" />
      <path d="M12 270 L108 270 L96 326 L24 326 Z" fill="#c9c2d6" /><path d="M12 270 L108 270 L106 280 L14 280 Z" fill="#e8e2f0" />
    </svg>{label && <span className="ty-lavalabel">{label}</span>}</button>;
}

// ─── 4. Marbles in a jar ───
type Ball = { x: number; y: number; vx: number; vy: number; r: number; c: string; id?: string };
const MARBLE = ["#ff6b6b", "#ffd166", "#06d6a0", "#4cc9f0", "#b388ff", "#ff8fab", "#f4a261", "#80ed99"];
export function MarbleJar({ items, onTap, energy, height = 280 }: { items: { id: string; title: string; color?: string }[]; onTap?: (id: string) => void; energy?: number; height?: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const balls = useRef<Ball[]>([]);
  const g = useRef({ x: 0, y: 900 }), drag = useRef<{ x: number; y: number; t: number } | null>(null);
  useEffect(() => {
    const n = Math.max(3, Math.min(18, items.length || 6));
    balls.current = Array.from({ length: n }, (_, i) => ({ x: 60 + (i % 5) * 34, y: 30 + Math.floor(i / 5) * 30, vx: 0, vy: 0, r: 15, c: items[i]?.color && /^#/.test(items[i].color!) ? items[i].color! : MARBLE[i % MARBLE.length], id: items[i]?.id }));
  }, [items.map((i) => i.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  // Tilting the phone tips the jar (where the browser shares it without asking).
  useEffect(() => {
    const tilt = (e: DeviceOrientationEvent) => { if (e.gamma == null || e.beta == null) return; g.current = { x: Math.max(-1, Math.min(1, e.gamma / 45)) * 900, y: 900 * Math.cos(Math.min(1.2, Math.max(-1.2, (e.beta - 60) / 60))) }; };
    window.addEventListener("deviceorientation", tilt);
    return () => window.removeEventListener("deviceorientation", tilt);
  }, []);
  useFrame((dt) => {
    const c = cv.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const x = c.getContext("2d")!; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    const L = 18, R = W - 18, B = H - 14, T = 20;
    if (energy != null) for (const b of balls.current) { b.vy -= Math.random() * energy * 900 * dt * 3; b.vx += (Math.random() - 0.5) * energy * 900 * dt; }
    let hit = 0;
    for (let step = 0; step < 2; step++) {
      for (const b of balls.current) {
        b.vx += g.current.x * dt / 2; b.vy += g.current.y * dt / 2; b.vx *= 0.995; b.vy *= 0.995;
        b.x += b.vx * dt / 2; b.y += b.vy * dt / 2;
        if (b.x < L + b.r) { b.x = L + b.r; if (Math.abs(b.vx) > 80) hit = Math.max(hit, Math.abs(b.vx)); b.vx *= -0.55; } if (b.x > R - b.r) { b.x = R - b.r; if (Math.abs(b.vx) > 80) hit = Math.max(hit, Math.abs(b.vx)); b.vx *= -0.55; }
        if (b.y > B - b.r) { b.y = B - b.r; if (Math.abs(b.vy) > 80) hit = Math.max(hit, Math.abs(b.vy)); b.vy *= -0.45; b.vx *= 0.96; } if (b.y < T + b.r) { b.y = T + b.r; b.vy *= -0.5; }
      }
      const bs = balls.current;
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
        if (d > 0 && d < min) { const nx = dx / d, ny = dy / d, o = (min - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rel < 0) { const imp = -rel * 0.9; a.vx -= imp * nx / 2; a.vy -= imp * ny / 2; b.vx += imp * nx / 2; b.vy += imp * ny / 2; if (imp > 120) hit = Math.max(hit, imp); } }
      }
    }
    if (hit && energy == null) { play.clack(hit / 600); if (hit > 260) buzz("tick"); }
    // The jar, then each marble with its glassy shine.
    x.fillStyle = "rgba(255,255,255,.06)"; x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 2;
    x.beginPath(); x.roundRect(L - 4, T - 6, R - L + 8, B - T + 12, 22); x.fill(); x.stroke();
    for (const b of balls.current) {
      const gr = x.createRadialGradient(b.x - b.r * .35, b.y - b.r * .4, b.r * .1, b.x, b.y, b.r);
      gr.addColorStop(0, "#ffffff"); gr.addColorStop(.25, b.c); gr.addColorStop(1, "rgba(0,0,0,.55)");
      x.fillStyle = gr; x.beginPath(); x.arc(b.x, b.y, b.r, 0, Math.PI * 2); x.fill();
      x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.ellipse(b.x - b.r * .35, b.y - b.r * .45, b.r * .28, b.r * .16, -.6, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = "rgba(255,255,255,.12)"; x.fillRect(L + 6, T + 4, 6, B - T - 30);
  });
  const down = (e: RPointerEvent<HTMLCanvasElement>) => { const r = cv.current!.getBoundingClientRect(); drag.current = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e: RPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current; if (!d) return; const r = cv.current!.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, t = performance.now(), dt = Math.max(0.008, (t - d.t) / 1000);
    const vx = (x - d.x) / dt, vy = (y - d.y) / dt; for (const b of balls.current) { b.vx += vx * 0.12; b.vy += vy * 0.12; } drag.current = { x, y, t };
  };
  const up = (e: RPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current; drag.current = null; if (!d) return;
    const r = cv.current!.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const b = balls.current.find((b) => Math.hypot(b.x - x, b.y - y) < b.r + 4);
    if (b?.id && onTap) { buzz("medium"); play.click(); onTap(b.id); }
  };
  return <canvas ref={cv} className="ty-jar" style={{ height }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }} aria-label="A jar of marbles, one for each open task. Shake it, or tap a marble to open its task" role="img" />;
}

// ─── 5. Synth ───
export function SynthKeys({ energy, onPlay }: { energy?: number; onPlay?: (i: number) => void }) {
  const [lit, setLit] = useState<number | null>(null);
  const bars = useRef<HTMLDivElement>(null), level = useRef(0);
  useFrame((dt) => {
    level.current = energy != null ? energy : Math.max(0, level.current - dt * 1.4);
    const kids = bars.current?.children; if (!kids) return;
    const t = performance.now() / 1000;
    for (let i = 0; i < kids.length; i++) (kids[i] as HTMLElement).style.transform = `scaleY(${0.08 + level.current * (0.5 + 0.5 * Math.abs(Math.sin(t * 6 + i * 0.9)))})`;
  });
  const hit = (i: number) => { play.note(i); buzz("light"); level.current = 1; setLit(i); window.setTimeout(() => setLit((l) => (l === i ? null : l)), 220); onPlay?.(i); };
  return <div className="ty-synth">
    <div ref={bars} className="ty-viz" aria-hidden>{Array.from({ length: 24 }, (_, i) => <i key={i} />)}</div>
    <div aria-hidden className="ty-sun" />
    <div className="ty-keys" role="group" aria-label="Keyboard">{Array.from({ length: 8 }, (_, i) => <button key={i} type="button" aria-label={`Note ${i + 1}`} data-lit={lit === i || undefined} onPointerDown={() => hit(i)} />)}</div>
  </div>;
}

// ─── 6. Jelly ───
export function Jelly({ label, value, color, onOpen, energy, pitch = 1 }: { label: string; value: ReactNode; color: string; onOpen?: () => void; energy?: number; pitch?: number }) {
  const el = useRef<HTMLButtonElement>(null), s = useRef({ x: 0, v: 0, press: false });
  useFrame((dt) => {
    const st = s.current, target = st.press ? -0.22 : energy != null ? Math.sin(performance.now() / 120) * energy * 0.18 : 0;
    st.v += (target - st.x) * 260 * dt; st.v *= Math.pow(0.02, dt); st.x += st.v * dt;
    if (el.current) el.current.style.transform = `scale(${1 - st.x * 0.6}, ${1 + st.x})`;
  });
  return <button ref={el} type="button" className="ty-jelly" style={{ "--jc": color } as CSSProperties}
    onPointerDown={() => { s.current.press = true; buzz("light"); }} onPointerLeave={() => { s.current.press = false; }}
    onPointerUp={() => { if (!s.current.press) return; s.current.press = false; s.current.v -= 9; play.boing(pitch); buzz("medium"); if (onOpen) window.setTimeout(onOpen, 240); }}>
    <b>{value}</b><small>{label}</small></button>;
}

// ─── 7. Orrery ───
export function Orrery({ days, onDay, energy, size = 300 }: { days: { label: string; count: number; title?: string }[]; onDay?: (i: number) => void; energy?: number; size?: number }) {
  const el = useRef<HTMLDivElement>(null), sys = useRef<SVGGElement>(null);
  const s = useRef({ a: 0, v: 0.15, drag: false, last: 0, lastT: 0, moved: 0, t: 0 });
  const [pick, setPick] = useState<number | null>(null);
  useFrame((dt) => {
    const x = s.current; x.t += dt * (1 + (energy ?? 0) * 4);
    if (!x.drag) { x.v += ((energy != null ? 0.2 + energy * 2 : 0.15) - x.v) * dt * 0.6; x.a += x.v * dt; }
    if (!sys.current) return;
    sys.current.style.transform = `rotate(${x.a}rad)`;
    const ps = sys.current.querySelectorAll<SVGGElement>("[data-planet]");
    ps.forEach((p, i) => { const sp = 1.4 / (i + 1.2); p.style.transform = `rotate(${x.t * sp + i * 0.9}rad)`; });
  });
  const down = (e: RPointerEvent) => { const x = s.current; x.drag = true; x.last = angleAt(e, el.current!); x.lastT = performance.now(); x.moved = 0; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const move = (e: RPointerEvent) => { const x = s.current; if (!x.drag) return; const a = angleAt(e, el.current!), d = wrap(a - x.last), t = performance.now(); x.a += d; x.moved += Math.abs(d); x.v = d / Math.max(0.008, (t - x.lastT) / 1000); x.last = a; x.lastT = t; if (Math.abs(d) > 0.05) buzz("tick"); };
  const up = () => { const x = s.current; if (!x.drag) return; x.drag = false; if (Math.abs(x.v) > 2) { play.whoosh(Math.min(1, Math.abs(x.v) / 8)); buzz("light"); } };
  return <div ref={el} className="ty-orrery" style={{ width: size, height: size }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
    <svg viewBox="0 0 300 300" aria-hidden><defs><radialGradient id="ty-sun"><stop offset="0" stopColor="#fff6d8" /><stop offset=".4" stopColor="#ffc54d" /><stop offset="1" stopColor="#ff7a1a" /></radialGradient></defs>
      {days.map((_, i) => <circle key={i} cx="150" cy="150" r={42 + i * 15} fill="none" stroke="rgba(214,181,106,.22)" strokeWidth="1" strokeDasharray={i % 2 ? "2 4" : undefined} />)}
      <g ref={sys} style={{ transformOrigin: "150px 150px" }}>{days.map((d, i) => <g key={i} data-planet style={{ transformOrigin: "150px 150px" }}><circle cx={150 + 42 + i * 15} cy="150" r={4 + Math.min(d.count, 4) * 1.6} fill={["#9ad1ff", "#ffb48a", "#c7a6ff", "#8ef0c2", "#ffd36b", "#ff8fb1", "#b8c7ff"][i % 7]} stroke="rgba(255,255,255,.5)" strokeWidth=".6" /></g>)}</g>
      <circle cx="150" cy="150" r="26" fill="url(#ty-sun)" /><circle cx="150" cy="150" r="34" fill="none" stroke="rgba(255,197,77,.25)" strokeWidth="6" />
    </svg>
    <div className="ty-orrery-days">{days.map((d, i) => <button key={i} type="button" onClick={() => { setPick(i); play.chime(); buzz("light"); onDay?.(i); }} aria-pressed={pick === i} aria-label={`${d.label}: ${d.count} event${d.count === 1 ? "" : "s"}`}>{d.label}</button>)}</div>
    {pick != null && <p className="ty-orrery-pick"><b>{days[pick].label}</b> · {days[pick].count ? days[pick].title : "Nothing planned"}</p>}
  </div>;
}

// ─── 8. Radio dial ───
export function RadioDial({ items, onSelect, energy }: { items: string[]; onSelect?: (i: number) => void; energy?: number }) {
  const el = useRef<HTMLDivElement>(null), knob = useRef<HTMLDivElement>(null), needle = useRef<HTMLDivElement>(null);
  const s = useRef({ a: 0, drag: false, last: 0, det: 0 });
  const [at, setAt] = useState(0);
  const step = (2 * Math.PI) / Math.max(1, items.length);
  useFrame(() => {
    const x = s.current;
    if (energy != null) x.a = Math.sin(performance.now() / 700) * (0.4 + energy * 1.4);
    if (knob.current) knob.current.style.transform = `rotate(${x.a}rad)`;
    const i = ((Math.round(x.a / step) % items.length) + items.length) % items.length;
    if (needle.current) needle.current.style.left = `${6 + (((x.a / (2 * Math.PI)) % 1 + 1) % 1) * 88}%`;
    if (i !== x.det) { x.det = i; setAt(i); if (energy == null) { play.tick(0.55); buzz("tick"); } }
  });
  const down = (e: RPointerEvent) => { s.current.drag = true; s.current.last = angleAt(e, el.current!); (e.target as Element).setPointerCapture?.(e.pointerId); };
  const move = (e: RPointerEvent) => { const x = s.current; if (!x.drag) return; const a = angleAt(e, el.current!); x.a += wrap(a - x.last); x.last = a; };
  const up = () => { const x = s.current; if (!x.drag) return; x.drag = false; x.a = Math.round(x.a / step) * step; play.click(); };
  return <div className="ty-radio">
    <div className="ty-band" aria-hidden><div className="ty-scale">{items.map((l, i) => <span key={i} data-on={i === at || undefined}>{l}</span>)}</div><div ref={needle} className="ty-needle" /></div>
    <div ref={el} className="ty-dialwrap" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div ref={knob} className="ty-knob" aria-hidden><i /></div>
      <button type="button" className="ty-select" onClick={() => { play.chime(); buzz("medium"); onSelect?.(at); }} aria-label={`Open ${items[at]}`}>{items[at]}</button>
    </div>
  </div>;
}

// ─── 9. Ferrofluid ───
export function Ferro({ energy, children, onTap, size = 270 }: { energy?: number; children?: ReactNode; onTap?: () => void; size?: number }) {
  const cv = useRef<HTMLCanvasElement>(null), p = useRef<{ x: number; y: number } | null>(null), ripple = useRef(0), near = useRef(false);
  const spikes = useRef(Array.from({ length: 56 }, () => 0));
  useFrame((dt) => {
    const c = cv.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const x = c.getContext("2d")!; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.27, t = performance.now() / 1000;
    ripple.current = Math.max(0, ripple.current - dt * 1.6);
    const n = spikes.current.length, pts: [number, number][] = [];
    let anyNear = false;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      let want = 0.06 + Math.sin(t * 2 + i * 1.3) * 0.02 + (energy ?? 0) * (0.35 + 0.3 * Math.abs(Math.sin(t * 7 + i)));
      if (p.current) { const da = Math.abs(wrap(Math.atan2(p.current.y - cy, p.current.x - cx) - a)), d = Math.hypot(p.current.x - cx, p.current.y - cy); const pull = Math.max(0, 1 - da / 0.9) * Math.max(0, 1 - Math.max(0, d - R) / (R * 2.2)); want += pull * 0.75; if (pull > 0.5) anyNear = true; }
      want += ripple.current * 0.4 * Math.abs(Math.sin(i * 2.1));
      spikes.current[i] += (want - spikes.current[i]) * Math.min(1, dt * 9);
      const r = R * (1 + spikes.current[i]);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r], [cx + Math.cos(a + Math.PI / n) * R * 1.02, cy + Math.sin(a + Math.PI / n) * R * 1.02]);
    }
    if (anyNear && !near.current) { buzz("tick"); play.hum(0.6); } near.current = anyNear;
    const gr = x.createRadialGradient(cx - R * .4, cy - R * .5, R * .1, cx, cy, R * 1.8);
    gr.addColorStop(0, "#9aa3ad"); gr.addColorStop(.25, "#2b2f35"); gr.addColorStop(.7, "#0a0b0d"); gr.addColorStop(1, "#000");
    x.fillStyle = gr; x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill();
    x.fillStyle = "rgba(255,255,255,.22)"; x.beginPath(); x.ellipse(cx - R * .35, cy - R * .45, R * .35, R * .16, -.5, 0, Math.PI * 2); x.fill();
  });
  const at = (e: RPointerEvent<HTMLCanvasElement>) => { const r = cv.current!.getBoundingClientRect(); p.current = { x: e.clientX - r.left, y: e.clientY - r.top }; };
  return <div className="ty-ferro" style={{ width: size, height: size }}>
    <canvas ref={cv} onPointerMove={at} onPointerDown={(e) => { at(e); }} onPointerLeave={() => { p.current = null; }} onPointerUp={() => { ripple.current = 1; play.boing(0.5); buzz("medium"); onTap?.(); }} aria-hidden />
    {children && <span className="ty-ferro-label">{children}</span>}
  </div>;
}

// ─── 10. Slot machine ───
const SYMBOLS = ["★", "♦", "✓", "7", "♥", "◆"];
export function Slots({ items, onPick, energy }: { items: { id: string; title: string }[]; onPick?: (id: string | null) => void; energy?: number }) {
  const [rolling, setRolling] = useState([false, false, false]), [res, setRes] = useState<string[]>(["★", "Pull the lever", "★"]), [lever, setLever] = useState(false);
  const busy = rolling.some(Boolean) || (energy != null && energy > 0.02);
  const pull = () => {
    if (rolling.some(Boolean)) return;
    setRolling([true, true, true]); setLever(true); buzz("heavy"); play.click();
    window.setTimeout(() => setLever(false), 380);
    const pick = items.length ? items[Math.floor(Math.random() * items.length)] : null;
    const out = [SYMBOLS[Math.floor(Math.random() * 6)], pick ? pick.title : "All clear!", SYMBOLS[Math.floor(Math.random() * 6)]];
    let n = 0; const iv = window.setInterval(() => { play.tick(0.7 + Math.random() * 0.3); if (n++ % 2 === 0) buzz("tick"); }, 70);
    [700, 1050, 1400].forEach((ms, i) => window.setTimeout(() => {
      setRes((r) => { const x = [...r]; x[i] = out[i]; return x; }); setRolling((r) => { const x = [...r]; x[i] = false; return x; }); play.click(); buzz("medium");
      if (i === 2) { window.clearInterval(iv); play.ding(); buzz("success"); onPick?.(pick?.id ?? null); }
    }, ms));
  };
  const strip = <span className="ty-strip">{[...SYMBOLS, ...SYMBOLS].map((x, k) => <b key={k}>{x}</b>)}</span>;
  return <div className="ty-slots" data-spin={busy || undefined}>
    <div className="ty-marquee" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.1}s` }} />)}</div>
    <div className="ty-reels" aria-live="polite">{res.map((r, i) => <div key={i} className={`ty-reel${i === 1 ? " ty-reel-main" : ""}`}>{rolling[i] || (energy != null && energy > 0.02) ? strip : <span className="ty-land">{r}</span>}</div>)}</div>
    <button type="button" className="ty-lever" data-down={lever || undefined} onClick={pull} aria-label="Pull the lever to pick what to do next" data-testid="ty-lever"><i /></button>
  </div>;
}
