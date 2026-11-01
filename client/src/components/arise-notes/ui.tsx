// Small building blocks for the Arise Notes screens (classes in notes.css).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2, Lock, X } from "lucide-react";

type BtnKind = "primary" | "soft" | "plain" | "danger" | "record" | "ghost";
export function Btn({ kind = "plain", busy, children, className = "", ...rest }: { kind?: BtnKind; busy?: boolean; children: ReactNode; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...rest} disabled={rest.disabled || busy} className={`an-btn an-${kind} ${className}`}>
    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{children}
  </button>;
}

export function IconBtn({ label, children, className = "", ...rest }: { label: string; children: ReactNode; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" aria-label={label} title={label} {...rest} className={`an-icon-btn grid h-11 w-11 place-items-center rounded-2xl text-[var(--an-muted)] transition hover:bg-[var(--an-violet-soft)] hover:text-[var(--an-violet-ink)] disabled:opacity-40 ${className}`}>{children}</button>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <div role="status" className="grid place-items-center py-10 text-[var(--an-faint)]"><Loader2 className="h-6 w-6 animate-spin" aria-hidden /><span className="sr-only">{label}</span></div>;
}

export function Section({ title, icon, right, children, className = "" }: { title?: ReactNode; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`an-card p-4 sm:p-5 ${className}`}>
    {(title || right) && <div className="mb-3 flex items-center gap-2">
      {icon && <span className="text-[var(--an-violet)]" aria-hidden>{icon}</span>}
      {title && <h3 className="min-w-0 flex-1 text-[15px] font-bold tracking-tight">{title}</h3>}
      {right}
    </div>}
    {children}
  </section>;
}

/** A sheet that slides up from the bottom (a centered card on wide screens). Esc or the backdrop closes it. */
export function Sheet({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input, textarea, select, button:not([data-close])")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); before?.focus?.(); };
  }, [onClose]);
  return <div className="fixed inset-0 kb-sheet z-[400] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
    <button type="button" aria-label="Close" data-close className="an-sheet-back absolute inset-0 h-full w-full cursor-default" onClick={onClose} />
    <div ref={ref} className={`an-fade relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[26px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[26px] ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="min-w-0 flex-1 text-lg font-bold tracking-tight">{title}</h2>
        <IconBtn label="Close" data-close onClick={onClose}><X className="h-5 w-5" /></IconBtn>
      </div>
      {children}
    </div>
  </div>;
}

export function Toggle({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return <label className={`flex min-h-12 items-center gap-3 py-1 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
    <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{label}</span>{hint && <span className="mt-0.5 block text-[13px] leading-snug text-[var(--an-muted)]">{hint}</span>}</span>
    <input type="checkbox" role="switch" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
    <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition peer-focus-visible:ring-4 peer-focus-visible:ring-violet-200 ${on ? "bg-[var(--an-violet)]" : "bg-slate-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-6" : "left-1"}`} /></span>
  </label>;
}

export function PlanLock({ plan, onClick }: { plan: string; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-full bg-[var(--an-amber-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--an-amber)]" aria-label={`Needs Arise Notes ${plan}`}><Lock className="h-3 w-3" aria-hidden />{plan}</button>;
}

export function Notice({ tone = "info", children, action }: { tone?: "info" | "warn" | "bad" | "good"; children: ReactNode; action?: ReactNode }) {
  const t = tone === "warn" ? "bg-[var(--an-amber-soft)] text-[#7a4a04]" : tone === "bad" ? "bg-[var(--an-coral-soft)] text-[#9c1c2a]" : tone === "good" ? "bg-[var(--an-green-soft)] text-[#0d5c3d]" : "bg-[var(--an-violet-soft)] text-[var(--an-violet-ink)]";
  return <div role={tone === "bad" ? "alert" : "status"} className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-medium leading-snug ${t}`}><div className="min-w-0 flex-1">{children}</div>{action}</div>;
}

// ─── Toasts ───────────────────────────────────────────────────────────────────
const ToastCtx = createContext<(m: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  const say = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { id, text }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3600);
  }, []);
  return <ToastCtx.Provider value={say}>
    {children}
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[500] flex flex-col items-center gap-2 px-4">
      {items.map((i) => <div key={i.id} className="an-fade rounded-2xl bg-[#18172a] px-4 py-3 text-[14px] font-semibold text-white shadow-xl">{i.text}</div>)}
    </div>
  </ToastCtx.Provider>;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
export const shortDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
};
export const longDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
export const minutesText = (secs: number) => { const m = Math.round(secs / 60); return m < 1 ? `${Math.max(1, Math.round(secs))} sec` : m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60 ? `${m % 60} min` : ""}`.trim(); };
