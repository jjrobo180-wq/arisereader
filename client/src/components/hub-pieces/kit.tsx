// The look of Arise WorkHub (slate and teal) and Arise LifeHub (violet), as class names, so the
// A.R.I.S.E. Reader pieces shown inside a hub are built from that hub's own parts.
import type { ReactNode } from "react";
import { HubModal } from "@/components/teacher-hub/HubModal";
import { Modal } from "@/components/family-hub/ui";

export type Which = "work" | "life";

const BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm transition disabled:cursor-not-allowed disabled:opacity-50";

const WORK = {
  box: "rounded-2xl border border-slate-200 bg-white p-4",
  row: "rounded-2xl border border-slate-200 bg-white p-3 sm:p-4",
  rowWarn: "rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4",
  rowGood: "rounded-2xl border border-teal-200 bg-teal-50 p-3 sm:p-4",
  soft: "rounded-2xl bg-slate-50 p-3 sm:p-4",
  h: "font-semibold text-slate-900",
  eyebrow: "text-xs font-semibold uppercase tracking-wide text-slate-500",
  text: "text-sm text-slate-600",
  small: "text-xs text-slate-500",
  primary: `${BTN} bg-slate-950 font-semibold text-white hover:bg-slate-800`,
  accent: `${BTN} bg-teal-700 font-semibold text-white hover:bg-teal-800`,
  ghost: `${BTN} border border-slate-200 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50`,
  danger: `${BTN} border border-red-200 bg-red-50 px-3 font-semibold text-red-700 hover:bg-red-100`,
  input: "w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:text-sm",
  seg: "inline-flex rounded-xl border border-slate-200 bg-white p-1",
  segBtn: "min-h-9 rounded-lg px-3 text-sm font-semibold",
  segOn: "bg-slate-950 text-white",
  segOff: "text-slate-600 hover:bg-slate-100",
  ok: "rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950",
  bad: "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700",
  empty: "rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500",
  tile: "rounded-xl bg-teal-50 p-2 text-teal-700",
  link: "font-semibold text-teal-800 underline decoration-teal-200 underline-offset-4",
  track: "bg-slate-100",
  fill: "bg-teal-600",
  label: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500",
};
const LIFE: typeof WORK = {
  box: "rounded-2xl border border-[#ececf3] bg-white p-4",
  row: "rounded-2xl border border-[#ececf3] bg-white p-3 sm:p-4",
  rowWarn: "rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4",
  rowGood: "rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4",
  soft: "rounded-2xl bg-[#f6f7fc] p-3 sm:p-4",
  h: "font-bold text-slate-800",
  eyebrow: "text-[11px] font-extrabold uppercase tracking-[.15em] text-violet-600",
  text: "text-sm leading-6 text-slate-600",
  small: "text-xs text-slate-500",
  primary: `${BTN} bg-[#6e5ae0] font-bold text-white hover:bg-[#5948c8]`,
  accent: `${BTN} bg-[#6e5ae0] font-bold text-white hover:bg-[#5948c8]`,
  ghost: `${BTN} border border-slate-200 bg-white px-3 font-semibold text-slate-600 hover:bg-slate-50`,
  danger: `${BTN} border border-rose-100 bg-rose-50 px-3 font-semibold text-rose-600 hover:bg-rose-100`,
  input: "w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100",
  seg: "inline-flex rounded-xl bg-slate-100 p-1",
  segBtn: "min-h-9 rounded-lg px-3 text-sm font-bold",
  segOn: "bg-white text-violet-700 shadow-sm",
  segOff: "text-slate-500",
  ok: "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800",
  bad: "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700",
  empty: "rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500",
  tile: "rounded-xl bg-violet-50 p-2 text-violet-600",
  link: "font-bold text-violet-700 underline underline-offset-4",
  track: "bg-slate-100",
  fill: "bg-[#6e5ae0]",
  label: "mb-1.5 block text-xs font-bold text-slate-600",
};

export const kit = (which: Which) => (which === "work" ? WORK : LIFE);
export type Kit = typeof WORK;

const PILLS = { green: "bg-emerald-50 text-emerald-800", amber: "bg-amber-100 text-amber-900", red: "bg-red-50 text-red-700", slate: "bg-slate-100 text-slate-600", brand: "" };
export function Pill({ which, tone, children }: { which: Which; tone: keyof typeof PILLS; children: ReactNode }) {
  const brand = which === "work" ? "bg-teal-50 text-teal-800" : "bg-violet-50 text-violet-700";
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone === "brand" ? brand : PILLS[tone]}`}>{children}</span>;
}

/** A segmented switch, the hub's way (WorkHub's slate pill row or LifeHub's grey tray). */
export function Segments<T extends string>({ which, value, options, onChange, label }: { which: Which; value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  const k = kit(which);
  return <div className={k.seg} role="tablist" aria-label={label}>
    {options.map((o) => <button key={o.id} type="button" role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)} className={`${k.segBtn} ${value === o.id ? k.segOn : k.segOff}`}>{o.label}</button>)}
  </div>;
}

/** A progress bar in the hub's colour. */
export function Meter({ which, value, max, warn }: { which: Which; value: number; max: number; warn?: boolean }) {
  const k = kit(which);
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return <div className={`h-2 overflow-hidden rounded-full ${k.track}`}><div className={`h-full rounded-full transition-all ${warn ? "bg-amber-500" : k.fill}`} style={{ width: `${pct}%` }} /></div>;
}

/** The hub's own pop-up: WorkHub's HubModal or LifeHub's Modal. */
export function KitModal({ which, title, onClose, wide, children }: { which: Which; title: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  return which === "work"
    ? <HubModal title={title} onClose={onClose} size={wide ? "lg" : "md"} closeOnBackdrop>{children}</HubModal>
    : <Modal eyebrow="A.R.I.S.E. Reader" title={title} onClose={onClose} wide={wide}>{children}</Modal>;
}

export const fmtWhen = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
export const fmtDay = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
