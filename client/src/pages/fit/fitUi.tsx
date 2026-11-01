// Arise Fit's look (matches the Arise Fit prototype): near-black with an ember glow at the top, charcoal
// cards, one blaze-orange accent, a heavy condensed face for headings (Barlow Condensed, from Google
// Fonts with system fallbacks), and motion on everything: screens slide in, rings and bars fill, the
// streak pulses, the hero card shines. Small shared pieces used by every screen.
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// "lime" is the accent's old name (it was lime green); every screen uses it, so it keeps the name.
export const C = { bg: "#15171b", card: "#202329", card2: "#2b2f36", line: "rgba(255,255,255,.09)", text: "#f6f5f2", dim: "#a6acb5", lime: "#ff5a1f", orange: "#ffb020", blue: "#4d9fff", pink: "#ef5a6e", red: "#ff5c5c", steel: "#d6d6de" };
/** The ember glow behind every screen. */
export const glowBg = "radial-gradient(120% 55% at 50% -12%, #3b2415 0%, #15171b 60%)";
export const font = { fontFamily: "'Barlow', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" };
/** Headings: heavy, condensed, upper case. */
export const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', 'Oswald', 'Arial Narrow', 'Helvetica Neue', sans-serif", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".01em" };

/** The app's motion: entrances, fills, the shine, the scan line. Turned off for Reduce Motion. */
export const FIT_CSS = `
.fit-in{animation:fitIn .45s cubic-bezier(.2,.9,.2,1) backwards}
@keyframes fitIn{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
.fit-slide{animation:fitSlide .4s cubic-bezier(.2,.9,.2,1) backwards}
@keyframes fitSlide{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}
.fit-sheet{animation:fitSheet .38s cubic-bezier(.2,.9,.2,1) backwards}
@keyframes fitSheet{from{opacity:.4;transform:translateX(100%)}to{opacity:1;transform:none}}
.fit-pop{animation:fitPop .6s cubic-bezier(.2,1.6,.4,1) backwards}
@keyframes fitPop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
.fit-tick{animation:fitTick .35s cubic-bezier(.2,1.6,.4,1) backwards}
@keyframes fitTick{from{transform:scale(.6)}to{transform:scale(1)}}
.fit-bar{animation:fitBar 1.1s cubic-bezier(.2,.9,.2,1) backwards;transform-origin:left}
@keyframes fitBar{from{transform:scaleX(0)}}
.fit-shine{position:relative;overflow:hidden}
.fit-shine::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.14) 50%,transparent 65%);animation:fitShine 2.8s ease-in-out infinite}
@keyframes fitShine{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
.fit-pulse{animation:fitPulse 1.6s ease-in-out infinite}
@keyframes fitPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.fit-scan{animation:fitScan 1.1s ease-in-out infinite alternate}
@keyframes fitScan{from{top:8%}to{top:88%}}
.fit-up{animation:fitUp .35s cubic-bezier(.2,.9,.2,1) backwards}
@keyframes fitUp{from{transform:translateY(110%)}to{transform:none}}
.fit-route{stroke-dasharray:4000;stroke-dashoffset:4000;animation:fitRoute 1.8s ease-out .2s forwards}
@keyframes fitRoute{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion: reduce){.fit-in,.fit-slide,.fit-sheet,.fit-pop,.fit-tick,.fit-bar,.fit-pulse,.fit-up,.fit-route{animation:none!important;stroke-dashoffset:0}.fit-shine::after,.fit-scan{animation:none!important}}
`;
/** A staggered entrance: item k starts a little after item k-1. */
export const stagger = (k: number, step = 0.06, from = 0) => ({ animationDelay: `${(from + k * step).toFixed(2)}s` });

/** Loads the app's two typefaces and its motion styles once (the system face stands in until the fonts arrive, or offline). */
export function useFitFonts() {
  useEffect(() => {
    if (!document.getElementById("arise-fit-motion")) { const st = document.createElement("style"); st.id = "arise-fit-motion"; st.textContent = FIT_CSS; document.head.appendChild(st); }
    if (document.getElementById("arise-fit-fonts")) return;
    const l = document.createElement("link");
    l.id = "arise-fit-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }, []);
}

/** Charcoal, lit faintly from the top. */
export const cardStyle: React.CSSProperties = { background: "linear-gradient(180deg, #262a30, #202329)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.07), 0 6px 18px rgba(0,0,0,.18)" };

export function Card({ children, className = "", onClick, testId, style }: { children: ReactNode; className?: string; onClick?: () => void; testId?: string; style?: React.CSSProperties }) {
  const cls = `fit-in rounded-[14px] p-4 ${onClick ? "text-left w-full active:scale-[.98] transition-transform" : ""} ${className}`;
  return onClick
    ? <button type="button" onClick={onClick} className={cls} style={{ ...cardStyle, ...style }} data-testid={testId}>{children}</button>
    : <div className={cls} style={{ ...cardStyle, ...style }} data-testid={testId}>{children}</div>;
}

export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <div className="mb-3 mt-8 flex items-center justify-between px-1"><h2 className="flex items-center gap-2 text-[13px] tracking-[.16em]" style={{ ...display, color: C.dim }}>{children}</h2>{right}</div>;
}

export function Btn({ children, onClick, kind = "primary", className = "", disabled, testId, type = "button" }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "ghost" | "soft" | "danger"; className?: string; disabled?: boolean; testId?: string; type?: "button" | "submit" }) {
  const st = kind === "primary" ? { background: C.lime, color: "#0b0b0c" } : kind === "soft" ? { background: C.card2, color: C.text } : kind === "danger" ? { background: "rgba(255,77,77,.14)", color: C.red } : { background: "transparent", color: C.lime };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] px-5 text-[18px] uppercase tracking-[.04em] transition active:scale-[.97] disabled:opacity-40 ${className}`} style={{ ...st, fontFamily: display.fontFamily, fontWeight: 800 }}>{children}</button>;
}

/** A ring that fills as a number approaches its goal. */
export function Ring({ value, goal, size = 128, stroke = 12, color = C.lime, glow, children }: { value: number; goal: number; size?: number; stroke?: number; color?: string; glow?: boolean; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, f = goal > 0 ? Math.min(1, value / goal) : 0;
  // Starts empty and sweeps to its value when it first appears.
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true))); return () => cancelAnimationFrame(t); }, []);
  return <div className="relative grid place-items-center" style={{ width: size, height: size }}>
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={value > goal ? C.orange : color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={shown ? c * (1 - f) : c} style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.9,.2,1)", ...(glow ? { filter: `drop-shadow(0 0 10px ${color}80)` } : {}) }} />
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
  </div>;
}

export function Bar({ label, value, goal, color, unit = "g", delay = 0 }: { label: string; value: number; goal: number; color: string; unit?: string; delay?: number }) {
  return <div className="min-w-0 flex-1">
    <div className="flex items-baseline justify-between text-[12px]"><span style={{ color: C.dim }}>{label}</span><span className="font-semibold tabular-nums">{Math.round(value)}<span style={{ color: C.dim }}>/{goal}{unit}</span></span></div>
    <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.08)" }}><div className="fit-bar h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, goal ? (value / goal) * 100 : 0)}%`, background: color, animationDelay: `${delay}s` }} /></div>
  </div>;
}

/** A small line chart (newest on the right). */
export function Spark({ points, height = 90, color = C.lime, label }: { points: { x: string; y: number }[]; height?: number; color?: string; label?: (y: number) => string }) {
  if (points.length < 2) return <p className="py-6 text-center text-[13px]" style={{ color: C.dim }}>Log a few more to see a chart.</p>;
  const w = 320, h = height, ys = points.map((p) => p.y), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * (w - 8) + 4, h - 10 - ((p.y - lo) / span) * (h - 26)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return <div>
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`Latest ${label ? label(last.y) : last.y}`}>
      <defs><linearGradient id="fitspark" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${xy[xy.length - 1][0]},${h} L${xy[0][0]},${h} Z`} fill="url(#fitspark)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="4" fill={color} />
    </svg>
    <div className="mt-1 flex justify-between text-[11px]" style={{ color: C.dim }}><span>{points[0].x}</span><span>{last.x}</span></div>
  </div>;
}

/** Columns, e.g. volume per week. */
export function Columns({ items, color = C.lime }: { items: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return <div className="flex h-28 items-end gap-1.5">{items.map((i) => <div key={i.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
    <div className="w-full rounded-t-[6px] transition-[height] duration-700" style={{ height: `${Math.max(3, (i.value / max) * 92)}px`, background: i.value ? color : "rgba(255,255,255,.08)" }} />
    <span className="truncate text-[10px]" style={{ color: C.dim }}>{i.label}</span>
  </div>)}</div>;
}

/** A sheet that slides up over the screen (full height on phones). */
/** Full-screen layers (sheets, the live workout, the run tracker) go straight onto the page body.
 *  Rendered inside the scrolling page, a moving parent (any animation with a transform) traps a
 *  "fixed" screen inside it: it opened partway down the list, with the screen behind showing at its
 *  sides. On the body nothing can. */
export function Layer({ children }: { children: ReactNode }) {
  if (typeof document === "undefined" || !document.body) return <>{children}</>;
  return createPortal(children, document.body);
}

/** A screen that slides in from the right over the app (full height on phones). With `inline`, the
 *  same content is drawn as a tab instead: a big heading, no close button. */
export function Sheet({ title, onClose, children, testId, right, inline }: { title: string; onClose: () => void; children: ReactNode; testId?: string; right?: ReactNode; inline?: boolean }) {
  useEffect(() => { if (inline) return; const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [onClose, inline]);
  if (inline) return <div data-testid={testId}>
    <div className="mb-3 flex items-end justify-between px-1"><h1 className="text-[46px] leading-[.95]" style={display}>{title}</h1>{right}</div>
    {children}
  </div>;
  return <Layer><div className="fit-sheet fixed inset-0 z-[80] flex flex-col" style={{ background: glowBg, backgroundColor: C.bg, color: C.text, ...font }} role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
    <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
      <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><X className="h-5 w-5" /></button>
      <h1 className="min-w-0 flex-1 truncate text-center text-[22px]" style={display}>{title}</h1>
      <div className="flex min-w-11 justify-end">{right}</div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))]">{children}</div>
  </div></Layer>;
}

export function Chips<T extends string>({ items, value, onChange, label }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
    {items.map((i) => <button key={i.id} type="button" onClick={() => onChange(i.id)} aria-pressed={value === i.id}
      className="h-9 shrink-0 whitespace-nowrap rounded-[10px] px-3.5 text-[13px] font-semibold transition-colors duration-200" style={value === i.id ? { background: C.lime, color: "#0b0b0c" } : { background: C.card, color: C.text }}>{i.label}</button>)}
  </div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[13px] font-semibold" style={{ color: C.dim }}>{label}</span>{children}</label>;
}
/** 17px text: iPhone doesn't zoom when it's tapped. */
export const inputCls = "h-12 w-full min-w-0 rounded-[12px] px-3 text-[17px] outline-none focus:ring-2";
export const inputStyle = { background: C.card2, color: C.text, "--tw-ring-color": C.lime } as React.CSSProperties;

export const fmtNum = (n: number) => (Math.round(n) >= 10000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString());
export const fmtDur = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60); return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };
