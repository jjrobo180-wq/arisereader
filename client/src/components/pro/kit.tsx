// The building blocks every Arise premium app is made from: saved data, cards and fields, charts,
// a calendar heat map, sounds, speech, keeping the screen awake, printing and CSV downloads.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useAppData } from "@/lib/cloudDocs";
import { ChartSvg, type ChartKindName } from "@/components/office/ChartSvg";

// ─── Saved data ──────────────────────────────────────────────────────────────

/** Makes saved data match the shape of the defaults: wrong types fall back, missing keys are filled. */
export function shapeLike<T>(defaults: T, raw: unknown): T {
  if (raw === null || raw === undefined) return defaults;
  if (Array.isArray(defaults)) return (Array.isArray(raw) ? raw : defaults) as T;
  if (typeof defaults === "object" && defaults !== null) {
    if (typeof raw !== "object" || Array.isArray(raw)) return defaults;
    const out: any = { ...(raw as object) };
    for (const [k, v] of Object.entries(defaults as object)) out[k] = shapeLike(v, (raw as any)[k]);
    return out;
  }
  return (typeof raw === typeof defaults ? raw : defaults) as T;
}

/** An app's own saved data (account + this device). */
export function usePro<T>(app: string, defaults: T) {
  const d = useRef(defaults);
  const { data, setData, state, loaded } = useAppData<T>(`pro-${app}`, (raw) => shapeLike(d.current, raw));
  return { data, setData, state, loaded };
}

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ─── Dates ───────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dayKey();
export const parseDay = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const addDays = (k: string, n: number) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };
export const daysBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
export const lastDays = (n: number, end = today()) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
export const fmtDay = (k: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) => parseDay(k).toLocaleDateString(undefined, opts);
export const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fmtTime = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); if (!Number.isFinite(h)) return hhmm; return `${h % 12 || 12}:${pad(m || 0)} ${h >= 12 ? "PM" : "AM"}`; };
export const fmtDuration = (sec: number) => { const s = Math.max(0, Math.round(sec)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`; };
export const fmtNum = (n: number, d = 1) => (Number.isFinite(n) ? Number(n.toFixed(d)).toLocaleString() : "—");
export const money = (n: number, cur = "USD") => (Number.isFinite(n) ? n.toLocaleString(undefined, { style: "currency", currency: cur }) : "—");

/** How many days in a row (ending today or yesterday) a test was true. */
export function streak(has: (day: string) => boolean, from = today()): number {
  let n = 0, d = from;
  if (!has(d)) d = addDays(d, -1);
  while (has(d) && n < 3650) { n++; d = addDays(d, -1); }
  return n;
}

// ─── Look ────────────────────────────────────────────────────────────────────

export function Card({ children, className = "", title, right, tint }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode; tint?: string }) {
  return <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${className}`} style={tint ? { background: tint } : undefined}>
    {(title || right) && <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-black text-slate-800">{title}</h3>{right}</div>}
    {children}
  </section>;
}
export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-0.5 text-xl font-black" style={{ color }}>{value}</p>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>;
}
export const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;

type BtnKind = "primary" | "ghost" | "danger" | "soft";
export function Btn({ children, onClick, kind = "ghost", color, disabled, className = "", type = "button", title, big }: { children: ReactNode; onClick?: () => void; kind?: BtnKind; color?: string; disabled?: boolean; className?: string; type?: "button" | "submit"; title?: string; big?: boolean }) {
  const base = `inline-flex ${big ? "min-h-12 px-5 text-base" : "min-h-10 px-3.5 text-sm"} items-center justify-center gap-1.5 rounded-xl font-bold transition active:scale-[.98] disabled:opacity-40`;
  const style = kind === "primary" ? { background: color || "#0f172a" } : kind === "soft" ? { background: `${color || "#0f172a"}14`, color: color || "#0f172a" } : undefined;
  const cls = kind === "primary" ? "text-white shadow-sm hover:brightness-110" : kind === "danger" ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100" : kind === "soft" ? "hover:brightness-95" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50";
  return <button type={type} title={title} aria-label={title} disabled={disabled} onClick={onClick} className={`${base} ${cls} ${className}`} style={style}>{children}</button>;
}
export const inputCls = "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100";
/** An input with its own width instead of the full row. */
export const fit = (w: string) => inputCls.replace("w-full", w);
export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>{children}{hint && <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span>}</label>;
}
export function NumIn({ value, onChange, min, max, step, placeholder, className = "" }: { value: number | ""; onChange: (n: number | "") => void; min?: number; max?: number; step?: number; placeholder?: string; className?: string }) {
  return <input type="number" inputMode="decimal" value={value} min={min} max={max} step={step ?? "any"} placeholder={placeholder} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className={/\bw-/.test(className) ? `${fit("")} ${className}` : `${inputCls} ${className}`} />;
}
export function Tabs<T extends string>({ value, onChange, items, color }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[]; color?: string }) {
  return <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist">{items.map((it) => <button key={it.id} type="button" role="tab" aria-selected={value === it.id} onClick={() => onChange(it.id)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${value === it.id ? "bg-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`} style={value === it.id && color ? { color } : undefined}>{it.label}</button>)}</div>;
}
export function Ring({ value, max, size = 132, color = "#0ea5e9", children, stroke = 12 }: { value: number; max: number; size?: number; color?: string; children?: ReactNode; stroke?: number }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
    <svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}22`} strokeWidth={stroke} /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: "stroke-dashoffset .5s" }} /></svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
  </div>;
}
export function Bar({ value, max, color = "#0ea5e9", className = "" }: { value: number; max: number; color?: string; className?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return <div className={`h-2.5 overflow-hidden rounded-full bg-slate-100 ${className}`}><div className="h-full rounded-full transition-all" style={{ width: `${p * 100}%`, background: color }} /></div>;
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return createPortal(<div className="fixed inset-0 z-[900] flex items-end justify-center bg-slate-900/40 text-slate-900 sm:items-center sm:p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-label={title} className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h2 className="text-base font-black">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-4 text-sm">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
    </div>
  </div>, document.body);
}

// ─── Charts ──────────────────────────────────────────────────────────────────

export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, []);
  return [ref, w];
}
export function Chart({ labels, series, kind = "column", height = 220, colors, title, stacked, legend }: { labels: string[]; series: { name: string; values: number[] }[]; kind?: ChartKindName; height?: number; colors?: string[]; title?: string; stacked?: boolean; legend?: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  return <div ref={ref} className="w-full overflow-hidden rounded-xl">{w > 0 && <ChartSvg kind={kind} labels={labels} series={series} width={w} height={height} colors={colors} title={title} stacked={stacked} legend={legend ?? series.length > 1} />}</div>;
}

/** A GitHub-style grid of the last weeks, coloured by a value per day. */
export function Heatmap({ values, color = "#16a34a", weeks = 18, max, label }: { values: Record<string, number>; color?: string; weeks?: number; max?: number; label?: (day: string, v: number) => string }) {
  const end = today();
  const endD = parseDay(end);
  const start = addDays(end, -(weeks * 7 - 1) - endD.getDay() + 6 - 6);
  const top = max ?? Math.max(1, ...Object.values(values));
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  return <div className="overflow-x-auto"><div className="inline-grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, 12px)" }}>
    {days.map((d) => { const v = values[d] || 0; const future = d > end; return <span key={d} title={label ? label(d, v) : `${fmtDay(d)}: ${v}`} className="h-3 w-3 rounded-[3px]" style={{ background: future ? "transparent" : v <= 0 ? "#f1f5f9" : color, opacity: future ? 0 : v <= 0 ? 1 : 0.25 + 0.75 * Math.min(1, v / top) }} />; })}
  </div></div>;
}

// ─── Sound, speech, screen ───────────────────────────────────────────────────

let ctx: AudioContext | null = null;
export function audio(): AudioContext | null {
  try { ctx ||= new (window.AudioContext || (window as any).webkitAudioContext)(); if (ctx.state === "suspended") void ctx.resume(); return ctx; } catch { return null; }
}
/** A short tone. */
export function beep(freq = 880, ms = 160, volume = 0.25, type: OscillatorType = "sine") {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(volume, a.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + ms / 1000 + 0.02);
}
export function chime() { beep(660, 220, 0.2); window.setTimeout(() => beep(880, 260, 0.2), 180); window.setTimeout(() => beep(1320, 420, 0.18), 380); }
/** A soft bell (for meditation). */
export function bell(freq = 528) {
  const a = audio(); if (!a) return;
  [1, 2.01, 3.03].forEach((mult, i) => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = freq * mult; g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(0.18 / (i + 1), a.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 4 / (i + 1)); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 4.2); });
}
export function speak(text: string, rate = 1) {
  try { const s = window.speechSynthesis; if (!s) return; s.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = rate; s.speak(u); } catch { /* no speech */ }
}
export function vibrate(ms: number | number[]) { try { navigator.vibrate?.(ms); } catch { /* none */ } }

/** Keeps the screen on while something is running (timers, presenting). */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let lock: any = null, alive = true;
    const get = async () => { try { lock = await (navigator as any).wakeLock?.request("screen"); } catch { /* not allowed */ } };
    void get();
    const vis = () => { if (alive && document.visibilityState === "visible") void get(); };
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; document.removeEventListener("visibilitychange", vis); try { void lock?.release(); } catch { /* fine */ } };
  }, [on]);
}
/** Re-renders every `ms` while `on`. */
export function useTick(on: boolean, ms = 250) {
  const [, set] = useState(0);
  useEffect(() => { if (!on) return; const t = window.setInterval(() => set((x) => x + 1), ms); return () => window.clearInterval(t); }, [on, ms]);
}

/** A countdown that keeps true time even if the tab sleeps. */
export function useCountdown(onDone?: () => void) {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [paused, setPaused] = useState<number | null>(null);
  const done = useRef(onDone); done.current = onDone;
  useTick(endAt !== null && paused === null, 100);
  const remaining = paused !== null ? paused : endAt !== null ? Math.max(0, endAt - Date.now()) : left * 1000;
  useEffect(() => { if (endAt !== null && paused === null && remaining <= 0) { setEndAt(null); setLeft(0); done.current?.(); } }, [remaining, endAt, paused]);
  return {
    ms: remaining, running: endAt !== null && paused === null, paused: paused !== null,
    start: (sec: number) => { setPaused(null); setEndAt(Date.now() + sec * 1000); },
    pause: () => { if (endAt !== null && paused === null) setPaused(Math.max(0, endAt - Date.now())); },
    resume: () => { if (paused !== null) { setEndAt(Date.now() + paused); setPaused(null); } },
    stop: () => { setEndAt(null); setPaused(null); setLeft(0); },
    set: (sec: number) => { setEndAt(null); setPaused(null); setLeft(sec); },
  };
}

// ─── Printing and files ──────────────────────────────────────────────────────

export function printPage(title: string, body: string, css = "") {
  const w = window.open("", "_blank");
  if (!w) { window.alert("Allow pop-ups to print."); return; }
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title><style>body{font-family:Arial,sans-serif;color:#111;margin:24px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:18px 0 6px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;font-size:13px}th{background:#f1f5f9}.muted{color:#64748b;font-size:12px}@page{margin:0.5in}${css}</style></head><body>${body}</body></html>`);
  w.document.close(); w.focus();
  window.setTimeout(() => { try { w.print(); } catch { /* still open */ } }, 400);
}
export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function downloadText(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  downloadText(name.endsWith(".csv") ? name : `${name}.csv`, "﻿" + rows.map((r) => r.map((c) => { const t = String(c ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(",")).join("\r\n"), "text/csv");
}

/** A list of things with add / edit / delete, used by many apps. */
export function useList<T extends { id: string }>(list: T[], set: (fn: (all: T[]) => T[]) => void) {
  return {
    add: useCallback((item: T) => set((all) => [item, ...all]), [set]),
    put: useCallback((item: T) => set((all) => (all.some((x) => x.id === item.id) ? all.map((x) => (x.id === item.id ? item : x)) : [item, ...all])), [set]),
    remove: useCallback((id: string) => set((all) => all.filter((x) => x.id !== id)), [set]),
    list,
  };
}

/** Shuffles a copy of a list (Fisher–Yates, using the browser's random numbers). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function randInt(n: number): number {
  try { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] % n; } catch { return Math.floor(Math.random() * n); }
}

/** Big, readable full-screen view for projecting to a class. */
export function FullScreen({ onClose, children, bg = "#0f172a" }: { onClose: () => void; children: ReactNode; bg?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { void ref.current?.requestFullscreen?.().catch(() => {}); const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => { window.removeEventListener("keydown", k); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); }; }, [onClose]);
  return createPortal(<div ref={ref} className="fixed inset-0 z-[1500] flex flex-col items-center justify-center text-white" style={{ background: bg }}>
    <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"><X size={22} /></button>
    {children}
  </div>, document.body);
}
