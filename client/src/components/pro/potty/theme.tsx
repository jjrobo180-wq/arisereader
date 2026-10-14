// Potty Training's own look: porcelain ground, bedtime-navy ink, duck-yellow as the one bold
// accent, and a colour for each thing you log (pee blue, poop brown, food green, drink teal,
// accident coral, sleep indigo). Headings in Plus Jakarta Sans, text in DM Sans (both already
// loaded by the site).
import { useMemo, type ReactNode } from "react";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";
import { randInt } from "../kit";

export const C = {
  ink: "#1F2544", inkSoft: "#4A5070", muted: "#6B7290", line: "#E3E8F1", ground: "#F4F7FB", card: "#FFFFFF",
  duck: "#FFC83D", duckDeep: "#B7860B", duckSoft: "#FFF4D1",
  pee: "#3D8BFD", poop: "#9A6B47", food: "#43A047", drink: "#17A2B8", accident: "#E26D5A", sleep: "#5B5FC7", good: "#22A06B",
  night: "#1B2140",
};
export const FONT_HEAD = "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif";
export const FONT_BODY = "'DM Sans', system-ui, sans-serif";

/** Scoped styles: fonts, focus rings, the few animations (all off for reduced motion). */
export const PottyStyles = () => <style>{`
.potty-app { font-family: ${FONT_BODY}; color: ${C.ink}; }
.potty-app h1, .potty-app h2, .potty-app h3, .potty-app .ph { font-family: ${FONT_HEAD}; letter-spacing: -0.01em; }
/* Phones: grid columns shrink to the screen instead of growing to their longest line, and a long word wraps rather than pushing past the edge. */
.potty-app .grid > * { min-width: 0; }
.potty-app { overflow-wrap: break-word; }
.potty-app :focus-visible { outline: 3px solid ${C.duck}; outline-offset: 2px; border-radius: 10px; }
@keyframes pt-fall { 0% { transform: translateY(-10vh) rotate(0) } 100% { transform: translateY(110vh) rotate(720deg) } }
@keyframes pt-rise { 0% { transform: translateY(0); opacity: .9 } 100% { transform: translateY(-70vh); opacity: 0 } }
@keyframes pt-pop { 0% { transform: scale(.4); opacity: 0 } 70% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1) } }
@keyframes pt-bob { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-8%) } }
@keyframes pt-pulse { 0%, 100% { opacity: .55 } 50% { opacity: 1 } }
.pt-pop { animation: pt-pop .5s ease-out both } .pt-bob { animation: pt-bob 2.4s ease-in-out infinite } .pt-pulse { animation: pt-pulse 2.2s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .potty-app *, .potty-kid * { animation: none !important; transition: none !important } }
@media print { .potty-noprint { display: none !important } }
`}</style>;

/** A section with a heading and optional action — the default container (not every section is a card). */
export function Section({ title, sub, action, children, className = "" }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`min-w-0 ${className}`}>
    {(title || action) && <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div className="min-w-0">{title && <h2 className="text-lg font-extrabold">{title}</h2>}{sub && <p className="text-sm" style={{ color: C.muted }}>{sub}</p>}</div>{action}</div>}
    {children}
  </section>;
}
/** A raised panel for things that are one unit (a chart, a form, a stage). */
export function Panel({ children, className = "", tone, pad = true }: { children: ReactNode; className?: string; tone?: "duck" | "night" | "soft"; pad?: boolean }) {
  const bg = tone === "duck" ? C.duckSoft : tone === "night" ? C.night : tone === "soft" ? "#EEF2F8" : C.card;
  return <div className={`rounded-[22px] ${pad ? "p-4 sm:p-5" : ""} ${className}`} style={{ background: bg, color: tone === "night" ? "#fff" : undefined, boxShadow: tone ? undefined : `0 1px 0 ${C.line}, 0 10px 30px -18px #1F254433`, border: tone ? undefined : `1px solid ${C.line}` }}>{children}</div>;
}
export function Btn2({ children, onClick, kind = "plain", disabled, className = "", title, type = "button", big }: { children: ReactNode; onClick?: () => void; kind?: "duck" | "ink" | "plain" | "soft" | "danger" | "ghost"; disabled?: boolean; className?: string; title?: string; type?: "button" | "submit"; big?: boolean }) {
  const s: Record<string, { bg: string; fg: string; ring?: string }> = {
    duck: { bg: C.duck, fg: C.ink }, ink: { bg: C.ink, fg: "#fff" }, plain: { bg: "#fff", fg: C.ink, ring: C.line },
    soft: { bg: "#EEF2F8", fg: C.ink }, danger: { bg: "#FDECEA", fg: "#B4402E" }, ghost: { bg: "transparent", fg: C.inkSoft },
  };
  const t = s[kind];
  return <button type={type} title={title} aria-label={title} disabled={disabled} onClick={onClick}
    className={`inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition active:scale-[.97] disabled:opacity-40 ${big ? "min-h-12 px-6 text-base" : "min-h-10 px-4 text-sm"} ${className}`}
    style={{ background: t.bg, color: t.fg, boxShadow: t.ring ? `inset 0 0 0 1.5px ${t.ring}` : undefined }}>{children}</button>;
}
export const field = "h-11 w-full rounded-2xl border bg-white px-3.5 text-[15px] outline-none transition focus:border-[#1F2544] focus:ring-4 focus:ring-[#FFC83D55]";
export const fieldStyle = { borderColor: C.line, color: C.ink } as const;
export function Label({ text, children, hint, className = "" }: { text: string; children: ReactNode; hint?: string; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-[13px] font-bold" style={{ color: C.inkSoft }}>{text}</span>{children}{hint && <span className="mt-1 block text-xs" style={{ color: C.muted }}>{hint}</span>}</label>;
}
export function Chip({ on, children, onClick, color = C.ink }: { on?: boolean; children: ReactNode; onClick?: () => void; color?: string }) {
  return <button type="button" onClick={onClick} aria-pressed={on} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition"
    style={on ? { background: color, color: "#fff" } : { background: "#fff", color: C.inkSoft, boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>{children}</button>;
}
export function Dot({ color, size = 10 }: { color: string; size?: number }) { return <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />; }
export function Meter({ value, max, color = C.ink, className = "" }: { value: number; max: number; color?: string; className?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return <div className={`h-2 overflow-hidden rounded-full ${className}`} style={{ background: "#E8ECF4" }}><div className="h-full rounded-full transition-all" style={{ width: `${p * 100}%`, background: color }} /></div>;
}
export function Note({ tone = "info", children }: { tone?: "info" | "warn" | "doctor" | "tip"; children: ReactNode }) {
  const m = { info: ["#EEF2F8", C.inkSoft], tip: [C.duckSoft, "#6B5205"], warn: ["#FFF1E6", "#9A4A12"], doctor: ["#FDECEA", "#9F2F1F"] }[tone];
  return <div className="rounded-2xl px-4 py-3 text-[14px] leading-relaxed" style={{ background: m[0], color: m[1] }}>{children}</div>;
}
export function Empty2({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center rounded-[22px] border-2 border-dashed px-6 py-8 text-center" style={{ borderColor: C.line }}>
    <span className="text-4xl">{icon}</span><p className="ph mt-2 text-base font-extrabold">{title}</p><p className="mt-1 max-w-md text-sm" style={{ color: C.muted }}>{text}</p>{action && <div className="mt-4">{action}</div>}
  </div>;
}

export function Confetti({ n = 70 }: { n?: number }) {
  const bits = useMemo(() => Array.from({ length: n }, (_, i) => ({ i, left: randInt(100), delay: Math.random() * 1.2, dur: 2.4 + Math.random() * 1.8, color: [C.duck, C.pee, C.accident, C.good, C.sleep, "#FF8FB1"][i % 6], size: 7 + randInt(8), round: i % 3 === 0 })), [n]);
  return <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">{bits.map((b) => <span key={b.i} className="absolute top-0" style={{ left: `${b.left}%`, width: b.size, height: b.round ? b.size : b.size * 0.55, borderRadius: b.round ? 999 : 2, background: b.color, animation: `pt-fall ${b.dur}s linear ${b.delay}s infinite` }} />)}</div>;
}

/** Speaks to the child: the site's natural voice when available, the device's voice otherwise. */
export function say(text: string, on: boolean) {
  if (!on || !text.trim()) return;
  const fallback = () => { try { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.92; u.pitch = 1.1; window.speechSynthesis.speak(u); } catch { /* no voice */ } };
  try { void speakCharacterAI(text, { calmMode: true, onFallback: fallback }).catch(fallback); } catch { fallback(); }
}
export function hush() { try { stopSpeaking(); window.speechSynthesis?.cancel(); } catch { /* none */ } }
export function notify(title: string, body: string) {
  try { if ("Notification" in window && Notification.permission === "granted" && document.hidden) new Notification(title, { body }); } catch { /* none */ }
}
export const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
