// Unit converter (a Plugin Store add-on): cooking, length, weight, temperature, speed and area.
import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { UNITS, convertUnit } from "@shared/lifePlugins";
import { PageHead, Panel, inputClass, type SectionProps } from "./ui";

const GROUPS = Object.keys(UNITS);
const QUICK: Record<string, [number, string, string][]> = {
  Cooking: [[1, "Cups", "Tablespoons"], [1, "Tablespoons", "Teaspoons"], [1, "Cups", "Milliliters"], [1, "Gallons", "Cups"]],
  Length: [[1, "Inches", "Centimeters"], [1, "Miles", "Kilometers"], [1, "Feet", "Meters"]],
  Weight: [[1, "Pounds", "Kilograms"], [1, "Ounces", "Grams"]],
  Temperature: [[350, "Fahrenheit", "Celsius"], [98.6, "Fahrenheit", "Celsius"], [0, "Celsius", "Fahrenheit"]],
  Speed: [[60, "Miles per hour", "Kilometers per hour"]],
  Area: [[1, "Acres", "Square feet"]],
};
const fmt = (n: number) => (Number.isFinite(n) ? (Math.abs(n) >= 1e6 || (Math.abs(n) < 0.001 && n !== 0) ? n.toExponential(3) : String(Math.round(n * 10000) / 10000)) : "—");

export default function Converter(_: SectionProps) {
  const [group, setGroup] = useState("Cooking");
  const names = Object.keys(UNITS[group]);
  const [from, setFrom] = useState("Cups");
  const [to, setTo] = useState("Tablespoons");
  const [value, setValue] = useState("1");
  const pickGroup = (g: string) => { const n = Object.keys(UNITS[g]); setGroup(g); setFrom(n[0]); setTo(n[1]); };
  const result = convertUnit(group, Number(value), from, to);

  return <div className="space-y-6">
    <PageHead eyebrow="Unit converter" title="Convert anything" blurb="Cups to tablespoons, miles to kilometers, oven temperatures and more." />
    <div className="flex flex-wrap gap-1.5">{GROUPS.map((g) => <button key={g} type="button" onClick={() => pickGroup(g)} aria-pressed={group === g} className={`min-h-10 rounded-xl px-4 text-sm font-bold ${group === g ? "bg-[#292446] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"}`}>{g}</button>)}</div>
    <Panel>
      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="space-y-2"><input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className={inputClass + " min-h-14 text-2xl font-black"} aria-label="Amount" />
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} aria-label="From">{names.map((n) => <option key={n}>{n}</option>)}</select></div>
        <button type="button" onClick={() => { setFrom(to); setTo(from); }} className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 text-violet-700 hover:bg-violet-100" aria-label="Swap"><ArrowLeftRight size={18} /></button>
        <div className="space-y-2"><p className="flex min-h-14 items-center rounded-xl bg-violet-50 px-3 text-2xl font-black text-violet-800" aria-live="polite">{value.trim() === "" ? "—" : fmt(result)}</p>
          <select value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} aria-label="To">{names.map((n) => <option key={n}>{n}</option>)}</select></div>
      </div>
    </Panel>
    {QUICK[group] && <Panel title="Handy ones">
      <ul className="grid gap-2 sm:grid-cols-2">{QUICK[group].map(([v, a, b]) => <li key={`${v}${a}${b}`}><button type="button" onClick={() => { setValue(String(v)); setFrom(a); setTo(b); }} className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-left text-sm hover:bg-violet-50"><span className="font-bold">{v} {a.toLowerCase()}</span> = {fmt(convertUnit(group, v, a, b))} {b.toLowerCase()}</button></li>)}</ul>
    </Panel>}
  </div>;
}
