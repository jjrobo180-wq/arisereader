// Building blocks for the Arise LifeHub Family Hub, in the LifeHub's own look.
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Family, Member } from "@shared/familyHub";

export type SetFamily = (update: (family: Family) => Family) => void;
export type SectionProps = {
  family: Family;
  setFamily: SetFamily;
  today: string;
  makeId: () => string;
  say: (message: string) => void;
};

export const inputClass = "w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100";
export const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-50";
export const primary = buttonClass + " bg-[#6e5ae0] text-white hover:bg-[#5948c8]";
export const soft = buttonClass + " bg-violet-50 text-violet-700 hover:bg-violet-100";
export const plain = buttonClass + " border border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
export const danger = buttonClass + " border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100";

export function Panel({ title, eyebrow, right, children, className = "" }: { title?: ReactNode; eyebrow?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 shadow-[0_8px_28px_#17152b08] sm:p-5 ${className}`}>
    {(title || right) && <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">{eyebrow && <p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-violet-600">{eyebrow}</p>}{title && <h2 className="mt-0.5 text-lg font-black text-[#232139]">{title}</h2>}</div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>}
    {children}
  </section>;
}

export function PageHead({ eyebrow, title, blurb, action }: { eyebrow: string; title: string; blurb: string; action?: ReactNode }) {
  return <header className="flex flex-wrap items-start justify-between gap-4">
    <div className="min-w-0"><p className="mb-2 text-xs font-extrabold uppercase tracking-[.2em] text-[#7869d7]">{eyebrow}</p><h1 className="text-3xl font-black tracking-tight text-[#232139] sm:text-4xl">{title}<span className="text-[#7866e1]">.</span></h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{blurb}</p></div>
    {action}
  </header>;
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
    <span className="rounded-2xl bg-violet-50 p-4 text-violet-600">{icon}</span>
    <p className="mt-4 text-base font-extrabold text-slate-800">{title}</p>
    {children && <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{children}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>;
}

export function Modal({ title, eyebrow = "Family Hub", onClose, children, wide }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return <div className="fixed inset-0 z-[500] flex items-end justify-center bg-[#16152a]/65 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[94dvh] w-full overflow-y-auto rounded-t-[1.5rem] bg-white p-5 shadow-2xl sm:rounded-[1.5rem] sm:p-7 ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
      <div className="mb-5 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.15em] text-violet-600">{eyebrow}</p><h2 className="mt-1 text-xl font-black">{title}</h2></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}

export function Label({ text, children, className = "" }: { text: string; children: ReactNode; className?: string }) {
  return <label className={`block text-xs font-bold text-slate-600 ${className}`}>{text}<div className="mt-1.5">{children}</div></label>;
}

export function Avatar({ member, size = "md" }: { member?: Member; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "h-6 w-6 text-[11px]" : size === "lg" ? "h-12 w-12 text-xl" : "h-8 w-8 text-sm";
  if (!member) return <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-black text-slate-400 ${box}`}>?</span>;
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-black text-white ${box}`} style={{ background: member.color }} aria-hidden="true">{member.emoji || member.name.slice(0, 1).toUpperCase()}</span>;
}

export function MemberTag({ member, fallback = "Anyone" }: { member?: Member; fallback?: string }) {
  return <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold" style={member ? { background: member.color + "1f", color: member.color } : undefined}>
    {member ? <><Avatar member={member} size="sm" /><span className="truncate">{member.name}</span></> : <span className="text-slate-500">{fallback}</span>}
  </span>;
}

/** Tap-to-pick family members. `multi` lets more than one be chosen. */
export function MemberPicker({ members, value, onChange, multi, allowNone, noneLabel = "Anyone" }: {
  members: Member[]; value: string[]; onChange: (ids: string[]) => void; multi?: boolean; allowNone?: boolean; noneLabel?: string;
}) {
  if (!members.length) return <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-500">Add your family in “Family & settings” to assign people.</p>;
  return <div className="flex flex-wrap gap-2">
    {allowNone && !multi && <button type="button" aria-pressed={!value.length} onClick={() => onChange([])} className={`min-h-10 rounded-xl px-3 text-xs font-bold ring-1 transition ${!value.length ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"}`}>{noneLabel}</button>}
    {members.map((m) => {
      const on = value.includes(m.id);
      return <button key={m.id} type="button" aria-pressed={on} onClick={() => onChange(multi ? (on ? value.filter((v) => v !== m.id) : [...value, m.id]) : on && allowNone ? [] : [m.id])}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2.5 pr-3 text-xs font-bold ring-1 transition bg-white text-slate-600 ring-slate-200"
        style={on ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : undefined}>
        <span className="text-base leading-none">{m.emoji || "🙂"}</span>{m.name}
      </button>;
    })}
  </div>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-slate-300"}`}>
    <span className={`toggle-knob absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
  </button>;
}

export function Bar({ value, max, color = "#6e5ae0", warn }: { value: number; max: number; color?: string; warn?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: warn ? "#e0645a" : color }} /></div>;
}

export function Stat({ label, value, icon, tint }: { label: string; value: ReactNode; icon: ReactNode; tint: string }) {
  return <div className="rounded-2xl border border-[#e7e8ef] bg-white p-4 shadow-[0_3px_16px_#17152b08] sm:p-5">
    <div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-500">{label}</span><span className={`rounded-xl p-2 ${tint}`}>{icon}</span></div>
    <p className="text-2xl font-black text-[#242238] sm:text-3xl">{value}</p>
  </div>;
}

export const memberOf = (family: Family, id: string) => family.members.find((m) => m.id === id);
export const shortDate = (day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, opts);
export const clock12 = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
export const confirmed = (text: string) => typeof window === "undefined" || window.confirm(text);
