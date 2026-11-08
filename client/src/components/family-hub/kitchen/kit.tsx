// Shared look for the Kitchen planner screens: one dark accent, hairlines, plain type. No icons or emojis.
import type { ReactNode } from "react";
import { productsFor, type Kitchen, type KProduct } from "@shared/kitchen";

export const btn = "inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-30";
export const ghost = "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:opacity-30";
export const link = "text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900";
export const quiet = "text-sm font-medium text-slate-500 hover:text-slate-900";
export const label = "text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400";
export const field = "min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900";
export const chip = (on: boolean) => `rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`;

export function Segmented<T extends string>({ value, options, onChange, label: aria }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return <div role="tablist" aria-label={aria} className="grid gap-1 rounded-xl bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
    {options.map((o) => <button key={o.id} type="button" role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)} className={`truncate rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm ${value === o.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{o.label}</button>)}
  </div>;
}

export function Check({ on }: { on: boolean }) {
  return <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] leading-none ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-transparent"}`}>&#10003;</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}

/** Where a price comes from, in words. */
export const priceSource = (p: KProduct) => p.source === "store" ? `King Soopers price${p.at ? `, ${new Date(p.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}` : p.source === "you" ? "Your price" : "Estimate";
export const sizeOptions = (k: Kitchen, group: string) => productsFor(k, group);
