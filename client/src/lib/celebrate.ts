// Small rewards for finishing things (Chores, the self-help feed): a burst of confetti and a light tap on the
// phone. Both are skipped for people who ask their device for less motion, and the tap only runs in the iPhone
// apps that have Capacitor's Haptics plugin. Never an error.
import { hasNativePlugin, nativeCall } from "@/lib/nativeApp";

export const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function tap(kind: "light" | "success" = "light"): void {
  try {
    if (!hasNativePlugin(/haptics/i)) return;
    if (kind === "success") void nativeCall(/haptics/i, "Haptics", "notification", { type: "SUCCESS" }).catch(() => {});
    else void nativeCall(/haptics/i, "Haptics", "impact", { style: "LIGHT" }).catch(() => {});
  } catch { /* no haptics here */ }
}

const COLORS = ["#7c5cff", "#ffc933", "#35d0a0", "#ff6b8a", "#4cc9f0", "#ffffff"];

/** Confetti over the whole screen for about two seconds. */
export function confetti(bursts = 1): void {
  if (typeof document === "undefined" || reducedMotion()) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "9999" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = (canvas.width = Math.floor(window.innerWidth * dpr)), h = (canvas.height = Math.floor(window.innerHeight * dpr));
  type P = { x: number; y: number; vx: number; vy: number; r: number; vs: number; c: string; s: number };
  const parts: P[] = [];
  const burst = () => {
    for (let i = 0; i < 70; i++) {
      for (const left of [true, false]) {
        const a = (left ? -Math.PI / 3 : -Math.PI + Math.PI / 3) + (Math.random() - 0.5) * 0.9, v = (14 + Math.random() * 18) * dpr;
        parts.push({ x: left ? w * 0.05 : w * 0.95, y: h * 0.85, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, vs: (Math.random() - 0.5) * 0.4, c: COLORS[i % COLORS.length], s: (5 + Math.random() * 6) * dpr });
      }
    }
  };
  let fired = 0;
  const started = performance.now();
  const frame = (now: number) => {
    if (fired < bursts && now - started > fired * 700) { burst(); fired++; }
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vy += 0.55 * dpr; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vs;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    if (now - started < 2600) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}
