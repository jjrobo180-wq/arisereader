// Small celebrations for the board: a burst of confetti and a short chime. Both are skipped for
// people who ask their device for less motion, and the chime waits until the page has been touched
// (browsers don't allow sound before that).

export const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const COLORS = ["#FFC933", "#35D0A0", "#7B8CFF", "#FF6B57", "#FF8FC7", "#F4F6FF"];

/** Confetti over the whole screen for a few seconds; returns a function that stops it early. */
export function confetti(canvas: HTMLCanvasElement | null, bursts = 2): () => void {
  if (!canvas || prefersReducedMotion()) return () => {};
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = (canvas.width = Math.floor(canvas.clientWidth * dpr)), h = (canvas.height = Math.floor(canvas.clientHeight * dpr));
  type P = { x: number; y: number; vx: number; vy: number; r: number; spin: number; vs: number; c: string; w: number; hgt: number; life: number };
  const parts: P[] = [];
  const burst = (fromLeft: boolean) => {
    for (let i = 0; i < 90; i++) {
      const angle = (fromLeft ? -Math.PI / 3.2 : -Math.PI + Math.PI / 3.2) + (Math.random() - 0.5) * 0.8;
      const speed = (15 + Math.random() * 20) * dpr;
      parts.push({ x: fromLeft ? w * 0.08 : w * 0.92, y: h * 0.9, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: Math.random() * Math.PI, spin: 0, vs: (Math.random() - 0.5) * 0.4, c: COLORS[i % COLORS.length], w: (7 + Math.random() * 8) * dpr, hgt: (4 + Math.random() * 6) * dpr, life: 1 });
    }
  };
  let raf = 0, stopped = false, start = performance.now(), fired = 0;
  const fire = () => { burst(true); burst(false); fired++; };
  fire();
  const frame = (now: number) => {
    if (stopped) return;
    if (fired < bursts && now - start > fired * 1100) fire();
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vy += 0.5 * dpr; p.vx *= 0.985; p.vy *= 0.99;
      p.x += p.vx; p.y += p.vy; p.r += p.vs; p.life -= 0.0034;
      if (p.life <= 0 || p.y > h + 40) continue;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.hgt / 2, p.w, p.hgt); ctx.restore();
    }
    if (parts.some((p) => p.life > 0 && p.y <= h + 40) || fired < bursts) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, w, h);
  };
  raf = requestAnimationFrame(frame);
  return () => { stopped = true; cancelAnimationFrame(raf); ctx.clearRect(0, 0, w, h); };
}

let audio: AudioContext | null = null;
let touched = false;
if (typeof window !== "undefined") {
  const unlock = () => {
    touched = true;
    try { audio = audio ?? new (window.AudioContext || (window as any).webkitAudioContext)(); void audio.resume(); } catch { /* no sound on this device */ }
    window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock);
}

/** A bright little chime: "small" for points, "big" for a goal reached. */
export function chime(kind: "small" | "big") {
  if (!touched || !audio || audio.state === "suspended") return;
  const notes = kind === "big" ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [880, 1318.5];
  const t0 = audio.currentTime + 0.02;
  notes.forEach((f, i) => {
    const o = audio!.createOscillator(), g = audio!.createGain();
    o.type = "triangle"; o.frequency.value = f;
    const at = t0 + i * (kind === "big" ? 0.11 : 0.09);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(kind === "big" ? 0.22 : 0.16, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + (kind === "big" ? 0.7 : 0.35));
    o.connect(g); g.connect(audio!.destination); o.start(at); o.stop(at + 0.8);
  });
}
