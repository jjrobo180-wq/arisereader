// Arise Talk's look: calm and minimal. Soft paper background, white rounded tiles tinted by word
// color, one violet accent, big readable type (the system font). Light by default; Dark and Auto too.
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { hasNativePlugin, isNativeApp, nativeCall } from "@/lib/nativeApp";
import { KIND_INFO, type TalkKind } from "@shared/talk";

const TOKENS = {
  light: { bg: "#f5f4f1", card: "#ffffff", card2: "#eeede9", line: "rgba(20,20,30,.08)", text: "#16161d", dim: "#6f6f7b", accent: "#5b4cf0", "accent-soft": "#ecebff", "on-accent": "#ffffff", shadow: "0 1px 2px rgba(20,20,40,.05), 0 6px 18px rgba(20,20,40,.06)", danger: "#e5484d" },
  dark: { bg: "#111114", card: "#1c1c22", card2: "#26262e", line: "rgba(255,255,255,.08)", text: "#f4f4f6", dim: "#9d9daa", accent: "#8b7fff", "accent-soft": "#2a2650", "on-accent": "#0e0e12", shadow: "0 1px 0 rgba(255,255,255,.04) inset, 0 8px 20px rgba(0,0,0,.35)", danger: "#ff6b6b" },
} as const;
const vars = (t: Record<string, string>) => Object.entries(t).map(([k, x]) => `--tk-${k}:${x}`).join(";");
export const TALK_CSS = `:root{${vars(TOKENS.light)}}[data-talk-theme="light"]{color-scheme:light}[data-talk-theme="dark"]{${vars(TOKENS.dark)};color-scheme:dark}
.tk-press{transition:transform .12s ease, filter .12s ease}.tk-press:active{transform:scale(.96);filter:brightness(.97)}
.tk-in{animation:tkIn .28s cubic-bezier(.2,.9,.2,1) backwards}@keyframes tkIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.tk-sheet{animation:tkSheet .3s cubic-bezier(.2,.9,.2,1) backwards}@keyframes tkSheet{from{transform:translateY(40px);opacity:.3}to{transform:none;opacity:1}}
.tk-flash{animation:tkFlash .5s ease-out forwards}@keyframes tkFlash{0%{box-shadow:inset 0 0 0 3px var(--tk-accent);background:rgba(91,76,240,.12)}100%{box-shadow:inset 0 0 0 3px transparent;background:transparent}}
.tk-wave span{display:inline-block;width:3px;margin:0 1.5px;border-radius:3px;background:currentColor;animation:tkWave 1s ease-in-out infinite}
.tk-wave span:nth-child(2){animation-delay:.15s}.tk-wave span:nth-child(3){animation-delay:.3s}.tk-wave span:nth-child(4){animation-delay:.45s}
@keyframes tkWave{0%,100%{height:5px}50%{height:16px}}
@media (prefers-reduced-motion: reduce){.tk-in,.tk-sheet,.tk-flash,.tk-wave span{animation:none!important}}`;

const v = (k: string) => `var(--tk-${k})`;
export const T = { bg: v("bg"), card: v("card"), card2: v("card2"), line: v("line"), text: v("text"), dim: v("dim"), accent: v("accent"), accentSoft: v("accent-soft"), onAccent: v("on-accent"), shadow: v("shadow"), danger: v("danger") };
export const font = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif" };

export type ThemeChoice = "light" | "dark" | "auto";
const dark = (c: ThemeChoice) => c === "dark" || (c === "auto" && (() => { try { return matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; } })());
/** Puts the theme on the page (and the iPhone's clock color to match). */
export function useTalkTheme(choice: ThemeChoice) {
  const [isDark, setDark] = useState(() => dark(choice));
  useEffect(() => {
    if (!document.getElementById("arise-talk-css")) { const s = document.createElement("style"); s.id = "arise-talk-css"; s.textContent = TALK_CSS; document.head.appendChild(s); }
    const apply = () => {
      const d = dark(choice); setDark(d);
      document.documentElement.setAttribute("data-talk-theme", d ? "dark" : "light");
      if (hasNativePlugin(/statusbar/i)) void nativeCall(/statusbar/i, "StatusBar", "setStyle", { style: d ? "DARK" : "LIGHT" }).catch(() => {});
    };
    apply();
    let mq: MediaQueryList | null = null; try { mq = matchMedia("(prefers-color-scheme: dark)"); } catch { /* none */ }
    mq?.addEventListener?.("change", apply);
    return () => { mq?.removeEventListener?.("change", apply); };
  }, [choice]);
  useEffect(() => () => { document.documentElement.removeAttribute("data-talk-theme"); }, []);
  return isDark;
}

/** A word's tile colors in the current theme. */
export const tileColors = (k: TalkKind, isDark: boolean) => { const i = KIND_INFO[k]; return { background: isDark ? i.dark : i.light, borderColor: i.edge }; };

export function haptic(on = true, kind: "light" | "medium" | "success" = "light") {
  if (!on || !isNativeApp() || !hasNativePlugin(/haptics/i)) return;
  const c = kind === "success" ? nativeCall(/haptics/i, "Haptics", "notification", { type: "SUCCESS" }) : nativeCall(/haptics/i, "Haptics", "impact", { style: kind.toUpperCase() });
  void c.catch(() => {});
}

/** Over everything (sheets), so nothing behind shows through or scrolls. */
export function Layer({ children }: { children: ReactNode }) {
  if (typeof document === "undefined" || !document.body) return <>{children}</>;
  return createPortal(children, document.body);
}

export function Sheet({ title, onClose, children, right, full, testId }: { title: string; onClose: () => void; children: ReactNode; right?: ReactNode; full?: boolean; testId?: string }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <Layer><div className="fixed inset-0 z-[400] flex flex-col justify-end" style={{ ...font, color: T.text }} data-testid={testId}>
    <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={onClose} />
    <div className={`tk-sheet relative flex flex-col overflow-hidden rounded-t-[24px] ${full ? "h-[94dvh]" : "max-h-[90dvh]"}`} style={{ background: T.bg }}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <h2 className="min-w-0 flex-1 truncate text-[20px] font-bold tracking-[-.01em]">{title}</h2>
        {right}
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full" style={{ background: T.card2 }} data-testid={testId ? `${testId}-close` : undefined}><X className="h-5 w-5" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(24px,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  </div></Layer>;
}

export function Btn({ children, onClick, kind = "primary", className = "", disabled, testId }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "soft" | "ghost" | "danger"; className?: string; disabled?: boolean; testId?: string }) {
  const st = kind === "primary" ? { background: T.accent, color: T.onAccent } : kind === "soft" ? { background: T.card2, color: T.text } : kind === "danger" ? { background: "rgba(229,72,77,.12)", color: T.danger } : { background: "transparent", color: T.accent };
  return <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} className={`tk-press inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-5 text-[16px] font-semibold disabled:opacity-40 ${className}`} style={st}>{children}</button>;
}

export function Card({ children, className = "", onClick, testId }: { children: ReactNode; className?: string; onClick?: () => void; testId?: string }) {
  const st = { background: T.card, boxShadow: T.shadow };
  return onClick
    ? <button type="button" onClick={onClick} className={`tk-press block w-full rounded-[18px] p-4 text-left ${className}`} style={st} data-testid={testId}>{children}</button>
    : <div className={`rounded-[18px] p-4 ${className}`} style={st} data-testid={testId}>{children}</div>;
}

export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <div className="mb-2 mt-6 flex items-center justify-between px-1"><h3 className="text-[13px] font-semibold uppercase tracking-[.08em]" style={{ color: T.dim }}>{children}</h3>{right}</div>;
}

export function Toggle({ on, onChange, label, sub, testId }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string; testId?: string }) {
  return <button type="button" onClick={() => onChange(!on)} role="switch" aria-checked={on} className="flex w-full items-center gap-3 py-3 text-left" data-testid={testId}>
    <span className="min-w-0 flex-1"><span className="block text-[16px] font-medium">{label}</span>{sub && <span className="block text-[13px]" style={{ color: T.dim }}>{sub}</span>}</span>
    <span className="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors" style={{ background: on ? T.accent : T.card2 }}><span className="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 23 : 3 }} /></span>
  </button>;
}

export function Seg<V extends string | number>({ value, items, onChange, testId }: { value: V; items: { id: V; label: ReactNode }[]; onChange: (v: V) => void; testId?: string }) {
  return <div className="grid gap-1 rounded-[14px] p-1" style={{ background: T.card2, gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} data-testid={testId}>
    {items.map((i) => <button key={String(i.id)} type="button" aria-pressed={value === i.id} onClick={() => onChange(i.id)} className="h-10 truncate rounded-[10px] px-2 text-[14px] font-semibold transition-colors" style={value === i.id ? { background: T.card, color: T.text, boxShadow: T.shadow } : { color: T.dim }} data-testid={testId ? `${testId}-${i.id}` : undefined}>{i.label}</button>)}
  </div>;
}

export const inputCls = "h-12 w-full rounded-[14px] px-4 text-[16px] outline-none focus:ring-2 focus:ring-[color:var(--tk-accent)]";
export const inputStyle = { background: T.card, color: T.text, boxShadow: `inset 0 0 0 1px ${T.line}` };
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="mt-3 block"><span className="mb-1.5 block px-1 text-[13px] font-semibold" style={{ color: T.dim }}>{label}</span>{children}</label>;
}

/** "Premium" badge. */
export const PremiumTag = () => <span className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.06em]" style={{ background: T.accentSoft, color: T.accent }}>Premium</span>;
