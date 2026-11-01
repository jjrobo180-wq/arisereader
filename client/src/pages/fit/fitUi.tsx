// Arise Fit's look: bold condensed headings (Barlow Condensed), one blaze-orange accent, and motion
// on everything (screens slide in, rings and bars fill, the hero card shines). Two themes: Light, the
// default (clean white cards on soft gray), and Dark (graphite); "Auto" follows the iPhone. Every
// color is a CSS variable, so switching theme repaints the whole app at once. Shared by Arise Fit
// and Arise Trainer.
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Moon, Smartphone, Sun, X } from "lucide-react";
import { hasNativePlugin, isNativeApp, nativeCall } from "@/lib/nativeApp";

const TOKENS = {
  light: {
    bg: "#f2f2f4", glow: "radial-gradient(130% 40% at 50% -8%, #ffe2d3 0%, #f2f2f4 62%)",
    card: "#ffffff", "card-bg": "#ffffff", "card-shadow": "0 1px 2px rgba(17,24,39,.05), 0 8px 24px rgba(17,24,39,.06)",
    card2: "#ececf0", line: "rgba(17,19,24,.08)", text: "#111318", dim: "#6b717c", steel: "#3e444d",
    accent: "#ff5a1f", amber: "#f59e0b", blue: "#2f80ed", pink: "#e5484d", red: "#e5484d", green: "#16a34a",
    track: "rgba(17,19,24,.08)", nav: "rgba(255,255,255,.94)", "nav-border": "rgba(17,19,24,.07)", "nav-shadow": "0 10px 30px rgba(17,24,39,.12)",
    "ember-soft": "#fff1ea", body: "#e6e7eb", muscle: "#cfd2d8", gap: "#ffffff", tint: "rgba(255,90,31,.10)",
  },
  dark: {
    bg: "#15171b", glow: "radial-gradient(120% 55% at 50% -12%, #3b2415 0%, #15171b 60%)",
    card: "#202329", "card-bg": "linear-gradient(180deg, #262a30, #202329)", "card-shadow": "inset 0 1px 0 rgba(255,255,255,.07), 0 6px 18px rgba(0,0,0,.18)",
    card2: "#2b2f36", line: "rgba(255,255,255,.09)", text: "#f6f5f2", dim: "#a6acb5", steel: "#d6d6de",
    accent: "#ff5a1f", amber: "#ffb020", blue: "#4d9fff", pink: "#ef5a6e", red: "#ff5c5c", green: "#34d399",
    track: "rgba(255,255,255,.09)", nav: "rgba(32,35,41,.94)", "nav-border": "rgba(255,255,255,.06)", "nav-shadow": "inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.6)",
    "ember-soft": "#2e1d14", body: "#2a2e35", muscle: "#3d424a", gap: "#202329", tint: "rgba(255,90,31,.16)",
  },
} as const;
const v = (k: keyof typeof TOKENS.light) => `var(--fit-${k})`;
const vars = (t: Record<string, string>) => Object.entries(t).map(([k, x]) => `--fit-${k}:${x}`).join(";");
// The colors are always defined (Light by default); the page's color scheme is only set while Arise Fit
// is showing, so the rest of the site keeps its own once you leave.
export const THEME_CSS = `:root{${vars(TOKENS.light)}}[data-fit-theme="light"]{color-scheme:light}[data-fit-theme="dark"]{${vars(TOKENS.dark)};color-scheme:dark}`;

// "lime" is the accent's old name (it was lime green); every screen uses it, so it keeps the name.
export const C = { bg: v("bg"), card: v("card"), card2: v("card2"), line: v("line"), text: v("text"), dim: v("dim"), lime: v("accent"), orange: v("amber"), blue: v("blue"), pink: v("pink"), red: v("red"), steel: v("steel"), green: v("green"), track: v("track"), emberSoft: v("ember-soft"), tint: v("tint"), body: v("body"), muscle: v("muscle"), gap: v("gap"), nav: v("nav"), navBorder: v("nav-border"), navShadow: v("nav-shadow"), ink: "#0b0b0c" };
/** The glow behind every screen (soft peach in Light, ember in Dark). */
export const glowBg = v("glow");
export const font = { fontFamily: "'Barlow', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" };
/** Headings: heavy, condensed, upper case. */
export const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', 'Oswald', 'Arial Narrow', 'Helvetica Neue', sans-serif", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".01em" };

// ——— Theme ——————————————————————————————————————————————————————————————————————————————————————
export type ThemeChoice = "light" | "dark" | "auto";
const THEME_KEY = "arise-fit-theme";
export const themeChoice = (): ThemeChoice => { try { const x = localStorage.getItem(THEME_KEY); return x === "dark" || x === "auto" ? x : "light"; } catch { return "light"; } };
const systemDark = () => { try { return matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; } };
export const resolvedTheme = (c: ThemeChoice = themeChoice()): "light" | "dark" => (c === "auto" ? (systemDark() ? "dark" : "light") : c);
/** iPhone builds with the status bar plugin get dark clock text on Light; older builds can't change it. */
const statusBarAdjustable = () => hasNativePlugin(/statusbar/i);
function ensureStyles() {
  if (typeof document === "undefined" || !document.head) return;
  if (!document.getElementById("arise-fit-theme")) { const st = document.createElement("style"); st.id = "arise-fit-theme"; st.textContent = THEME_CSS; document.head.appendChild(st); }
  if (!document.getElementById("arise-fit-motion")) { const st = document.createElement("style"); st.id = "arise-fit-motion"; st.textContent = FIT_CSS; document.head.appendChild(st); }
}
export function applyTheme() {
  if (typeof document === "undefined" || !document.documentElement) return;
  ensureStyles();
  const t = resolvedTheme();
  document.documentElement.setAttribute("data-fit-theme", t);
  if (statusBarAdjustable()) void nativeCall(/statusbar/i, "StatusBar", "setStyle", { style: t === "light" ? "LIGHT" : "DARK" }).catch(() => {});
  try { window.dispatchEvent(new Event("fit-theme")); } catch { /* old browser */ }
}
export function setThemeChoice(c: ThemeChoice) { try { localStorage.setItem(THEME_KEY, c); } catch { /* private mode */ } applyTheme(); }
/** The theme chosen and the one showing, kept current when either changes. */
export function useFitTheme(): [ThemeChoice, "light" | "dark", (c: ThemeChoice) => void] {
  const [, tick] = useState(0);
  useEffect(() => {
    const on = () => tick((n) => n + 1);
    window.addEventListener("fit-theme", on);
    let mq: MediaQueryList | null = null; try { mq = matchMedia("(prefers-color-scheme: dark)"); } catch { /* none */ }
    const sys = () => { if (themeChoice() === "auto") applyTheme(); };
    mq?.addEventListener?.("change", sys);
    return () => { window.removeEventListener("fit-theme", on); mq?.removeEventListener?.("change", sys); };
  }, []);
  return [themeChoice(), resolvedTheme(), setThemeChoice];
}
/** Light, Dark or Auto, as three small previews (Settings in Arise Fit, Business in Arise Trainer). */
export function ThemePicker({ testId = "fit-theme" }: { testId?: string }) {
  const [choice, , setChoice] = useFitTheme();
  const opts: [ThemeChoice, string, typeof Sun][] = [["light", "Light", Sun], ["dark", "Dark", Moon], ["auto", "Auto", Smartphone]];
  return <>
    <div className="grid grid-cols-3 gap-2" data-testid={testId}>{opts.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => { setChoice(id); haptic("light"); }} aria-pressed={choice === id} className="overflow-hidden rounded-[14px] text-left transition-transform active:scale-[.97]" style={{ background: C.card, boxShadow: choice === id ? `inset 0 0 0 2px ${C.lime}, ${cardStyle.boxShadow}` : `inset 0 0 0 1px ${C.line}` }} data-testid={`${testId}-${id}`}>
      <span className="block h-14" style={{ background: id === "light" ? "linear-gradient(180deg,#ffe2d3,#f2f2f4)" : id === "dark" ? "linear-gradient(180deg,#3b2415,#15171b)" : "linear-gradient(90deg,#f2f2f4 50%,#15171b 50%)" }}><span className="m-2 block h-3 w-10 rounded-full" style={{ background: "#ff5a1f" }} /></span>
      <span className="flex items-center gap-1.5 px-2.5 py-2 text-[14px] font-semibold"><Icon className="h-4 w-4" />{label}</span></button>)}</div>
    <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Auto follows your iPhone's light or dark setting.</p>
  </>;
}

/** On iPhone builds that can't change the clock's color, a dark band behind it keeps it readable on Light. */
export function StatusShade() {
  const [, shown] = useFitTheme();
  if (!isNativeApp() || statusBarAdjustable() || shown !== "light") return null;
  return <Layer><div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[300]" style={{ height: "env(safe-area-inset-top)", background: "#111318" }} /></Layer>;
}

/** A light tap on iPhone (set checked, workout started, tab changed). Nothing elsewhere. */
export function haptic(kind: "light" | "medium" | "heavy" | "success" = "light") {
  if (!isNativeApp() || !hasNativePlugin(/haptics/i)) return;
  const call = kind === "success" ? nativeCall(/haptics/i, "Haptics", "notification", { type: "SUCCESS" }) : nativeCall(/haptics/i, "Haptics", "impact", { style: kind.toUpperCase() });
  void call.catch(() => {});
}

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

// The theme and motion styles go in before anything draws, so there's no flash of the wrong colors.
if (typeof document !== "undefined") applyTheme();

/** Loads the app's two typefaces, its theme and its motion styles once (the system face stands in until the fonts arrive, or offline). */
let themeUsers = 0;
export function useFitFonts() {
  useEffect(() => {
    themeUsers++;
    applyTheme();
    if (!document.getElementById("arise-fit-fonts")) {
      const l = document.createElement("link");
      l.id = "arise-fit-fonts"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap";
      document.head.appendChild(l);
    }
    // Leaving Arise Fit on the website hands the page back to the site's own theme.
    return () => { if (--themeUsers === 0) document.documentElement.removeAttribute("data-fit-theme"); };
  }, []);
}

/** White with a soft shadow in Light; charcoal lit from the top in Dark. */
export const cardStyle: React.CSSProperties = { background: v("card-bg"), boxShadow: v("card-shadow") };

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
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: C.track }} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={shown ? c * (1 - f) : c} style={{ stroke: value > goal ? C.orange : color, transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.9,.2,1)", ...(glow ? { filter: "drop-shadow(0 0 8px rgba(255,90,31,.45))" } : {}) }} />
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
  </div>;
}

export function Bar({ label, value, goal, color, unit = "g", delay = 0 }: { label: string; value: number; goal: number; color: string; unit?: string; delay?: number }) {
  return <div className="min-w-0 flex-1">
    <div className="flex items-baseline justify-between text-[12px]"><span style={{ color: C.dim }}>{label}</span><span className="font-semibold tabular-nums">{Math.round(value)}<span style={{ color: C.dim }}>/{goal}{unit}</span></span></div>
    <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: C.track }}><div className="fit-bar h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, goal ? (value / goal) * 100 : 0)}%`, background: color, animationDelay: `${delay}s` }} /></div>
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
      <defs><linearGradient id="fitspark" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: color, stopOpacity: 0.3 }} /><stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} /></linearGradient></defs>
      <path d={`${d} L${xy[xy.length - 1][0]},${h} L${xy[0][0]},${h} Z`} fill="url(#fitspark)" />
      <path d={d} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: color }} />
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="4" style={{ fill: color }} />
    </svg>
    <div className="mt-1 flex justify-between text-[11px]" style={{ color: C.dim }}><span>{points[0].x}</span><span>{last.x}</span></div>
  </div>;
}

/** Columns, e.g. volume per week. */
export function Columns({ items, color = C.lime }: { items: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return <div className="flex h-28 items-end gap-1.5">{items.map((i) => <div key={i.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
    <div className="w-full rounded-t-[6px] transition-[height] duration-700" style={{ height: `${Math.max(3, (i.value / max) * 92)}px`, background: i.value ? color : C.track }} />
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
      <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card, boxShadow: v("card-shadow") }}><X className="h-5 w-5" /></button>
      <h1 className="min-w-0 flex-1 truncate text-center text-[22px]" style={display}>{title}</h1>
      <div className="flex min-w-11 justify-end">{right}</div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))]">{children}</div>
  </div></Layer>;
}

export function Chips<T extends string>({ items, value, onChange, label }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
    {items.map((i) => <button key={i.id} type="button" onClick={() => onChange(i.id)} aria-pressed={value === i.id}
      className="h-9 shrink-0 whitespace-nowrap rounded-[10px] px-3.5 text-[13px] font-semibold transition-colors duration-200" style={value === i.id ? { background: C.lime, color: "#0b0b0c" } : { background: C.card, color: C.text, boxShadow: `inset 0 0 0 1px ${C.line}` }}>{i.label}</button>)}
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
