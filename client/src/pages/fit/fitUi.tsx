// Arise Fit's look: a hard, dark gym app. Graphite and gunmetal, an ember-orange accent, a heavy
// condensed face for headings (Barlow Condensed, loaded from Google Fonts with system fallbacks) and
// tight corners. Small shared pieces used by every screen.
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

// "lime" is the accent's old name (it was lime green); every screen uses it, so it keeps the name.
export const C = { bg: "#0a0a0b", card: "#141518", card2: "#1e2024", line: "rgba(255,255,255,.07)", text: "#f2f1ee", dim: "#8d939b", lime: "#ff5a1f", orange: "#ffb020", blue: "#4d9fff", pink: "#e8455a", red: "#ff3b30", steel: "#b9c0c8" };
export const font = { fontFamily: "'Barlow', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" };
/** Headings: heavy, condensed, upper case. */
export const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', 'Oswald', 'Arial Narrow', 'Helvetica Neue', sans-serif", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".01em" };

/** Loads the app's two typefaces once (the system face stands in until they arrive, or offline). */
export function useFitFonts() {
  useEffect(() => {
    if (document.getElementById("arise-fit-fonts")) return;
    const l = document.createElement("link");
    l.id = "arise-fit-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }, []);
}

/** Gunmetal: a faint top light and a hairline edge, like machined steel. */
export const cardStyle: React.CSSProperties = { background: `linear-gradient(180deg, #17191c 0%, ${C.card} 60%)`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.05), 0 0 0 1px rgba(255,255,255,.04)" };

export function Card({ children, className = "", onClick, testId }: { children: ReactNode; className?: string; onClick?: () => void; testId?: string }) {
  const cls = `rounded-[14px] p-4 ${onClick ? "text-left w-full active:scale-[.99] transition" : ""} ${className}`;
  return onClick
    ? <button type="button" onClick={onClick} className={cls} style={cardStyle} data-testid={testId}>{children}</button>
    : <div className={cls} style={cardStyle} data-testid={testId}>{children}</div>;
}

export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <div className="mb-2 mt-6 flex items-center justify-between px-1"><h2 className="flex items-center gap-2 text-[15px] tracking-[.08em]" style={{ ...display, fontWeight: 700, color: C.steel }}><span aria-hidden className="h-3.5 w-1" style={{ background: C.lime }} />{children}</h2>{right}</div>;
}

export function Btn({ children, onClick, kind = "primary", className = "", disabled, testId, type = "button" }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "ghost" | "soft" | "danger"; className?: string; disabled?: boolean; testId?: string; type?: "button" | "submit" }) {
  const st = kind === "primary" ? { background: C.lime, color: "#0b0b0c" } : kind === "soft" ? { background: C.card2, color: C.text } : kind === "danger" ? { background: "rgba(255,77,77,.14)", color: C.red } : { background: "transparent", color: C.lime };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-[16px] uppercase tracking-[.04em] transition active:scale-[.98] disabled:opacity-40 ${className}`} style={{ ...st, fontFamily: display.fontFamily, fontWeight: 700 }}>{children}</button>;
}

/** A ring that fills as a number approaches its goal. */
export function Ring({ value, goal, size = 128, stroke = 12, color = C.lime, children }: { value: number; goal: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, f = goal > 0 ? Math.min(1, value / goal) : 0;
  return <div className="relative grid place-items-center" style={{ width: size, height: size }}>
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={value > goal ? C.orange : color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - f)} style={{ transition: "stroke-dashoffset .6s ease" }} />
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
  </div>;
}

export function Bar({ label, value, goal, color, unit = "g" }: { label: string; value: number; goal: number; color: string; unit?: string }) {
  return <div className="min-w-0 flex-1">
    <div className="flex items-baseline justify-between text-[12px]"><span style={{ color: C.dim }}>{label}</span><span className="font-semibold tabular-nums">{Math.round(value)}<span style={{ color: C.dim }}>/{goal}{unit}</span></span></div>
    <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.08)" }}><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, goal ? (value / goal) * 100 : 0)}%`, background: color }} /></div>
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
    <div className="w-full rounded-t-[6px]" style={{ height: `${Math.max(3, (i.value / max) * 92)}px`, background: i.value ? color : "rgba(255,255,255,.08)" }} />
    <span className="truncate text-[10px]" style={{ color: C.dim }}>{i.label}</span>
  </div>)}</div>;
}

/** A sheet that slides up over the screen (full height on phones). */
export function Sheet({ title, onClose, children, testId, right }: { title: string; onClose: () => void; children: ReactNode; testId?: string; right?: ReactNode }) {
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [onClose]);
  return <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: C.bg, color: C.text, ...font }} role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
    <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
      <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><X className="h-5 w-5" /></button>
      <h1 className="min-w-0 flex-1 truncate text-center text-[20px]" style={display}>{title}</h1>
      <div className="flex min-w-11 justify-end">{right}</div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))]">{children}</div>
  </div>;
}

export function Chips<T extends string>({ items, value, onChange, label }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
    {items.map((i) => <button key={i.id} type="button" onClick={() => onChange(i.id)} aria-pressed={value === i.id}
      className="h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[14px] font-semibold" style={value === i.id ? { background: C.text, color: C.bg } : { background: C.card, color: C.text }}>{i.label}</button>)}
  </div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[13px] font-semibold" style={{ color: C.dim }}>{label}</span>{children}</label>;
}
/** 17px text: iPhone doesn't zoom when it's tapped. */
export const inputCls = "h-12 w-full min-w-0 rounded-[8px] px-3 text-[17px] outline-none focus:ring-2";
export const inputStyle = { background: C.card2, color: C.text, "--tw-ring-color": C.lime } as React.CSSProperties;

export const fmtNum = (n: number) => (Math.round(n) >= 10000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString());
export const fmtDur = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60); return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };
