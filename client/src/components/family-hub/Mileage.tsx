// Mileage log (a Plugin Store add-on): business or volunteer miles with a running total and what
// they're worth at your per-mile rate.
import { useState, type FormEvent } from "react";
import { Copy, Gauge, Trash2 } from "lucide-react";
import { Empty, PageHead, Panel, danger, inputClass, plain, primary, type SectionProps } from "./ui";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function Mileage({ family, setFamily, today, makeId, say }: SectionProps) {
  const [date, setDate] = useState(today);
  const [miles, setMiles] = useState("");
  const [purpose, setPurpose] = useState("");
  const [route, setRoute] = useState("");
  const year = today.slice(0, 4);
  const [shown, setShown] = useState(year);
  const add = (e: FormEvent) => {
    e.preventDefault();
    const m = Math.max(0, Number(miles) || 0);
    if (!m) return;
    setFamily((f) => ({ ...f, mileage: [...f.mileage, { id: makeId(), date, miles: m, purpose: purpose.trim(), route: route.trim() }].sort((a, b) => a.date.localeCompare(b.date)) }));
    setMiles(""); setPurpose(""); setRoute("");
  };
  const years = [...new Set([year, ...family.mileage.map((t) => t.date.slice(0, 4))])].sort().reverse();
  const trips = family.mileage.filter((t) => t.date.startsWith(shown));
  const total = trips.reduce((s, t) => s + t.miles, 0);
  const copy = async () => {
    const text = ["Date,Miles,Purpose,Route", ...trips.map((t) => [t.date, t.miles, `"${t.purpose.replace(/"/g, "'")}"`, `"${t.route.replace(/"/g, "'")}"`].join(",")), `Total,${total},,`].join("\n");
    try { await navigator.clipboard.writeText(text); say("Copied as a spreadsheet. Paste it into Excel or Google Sheets."); } catch { say("Couldn't copy on this device."); }
  };

  return <div className="space-y-6">
    <PageHead eyebrow="Mileage log" title="Every mile counts" blurb="Log business, medical or volunteer miles as you go, so tax time is easy." action={trips.length > 0 ? <button type="button" onClick={copy} className={plain}><Copy size={15} />Copy for a spreadsheet</button> : undefined} />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5"><p className="text-2xl font-black">{total.toLocaleString()} mi</p><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{shown} so far</p></div>
      <div className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5"><p className="text-2xl font-black text-emerald-700">{money(total * family.mileageRate)}</p><p className="text-xs font-bold uppercase tracking-wide text-slate-400">At your rate</p></div>
      <label className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 text-xs font-bold uppercase tracking-wide text-slate-400">Rate per mile<div className="mt-1 flex items-center gap-1 text-2xl font-black normal-case tracking-normal text-slate-900">$<input value={family.mileageRate} onChange={(e) => setFamily((f) => ({ ...f, mileageRate: Math.max(0, Math.min(10, Number(e.target.value) || 0)) }))} type="number" step="0.005" min={0} className="w-24 rounded-lg border border-slate-200 px-2 text-xl" aria-label="Rate per mile" /></div><span className="mt-1 block normal-case tracking-normal font-medium">Check the current IRS rate each year.</span></label>
    </div>
    <Panel title="Log a trip">
      <form onSubmit={add} className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_7rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className={inputClass} aria-label="Date" />
        <input value={miles} onChange={(e) => setMiles(e.target.value)} inputMode="decimal" placeholder="Miles" className={inputClass} aria-label="Miles" />
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={120} placeholder="Purpose (client visit…)" className={inputClass} aria-label="Purpose" />
        <input value={route} onChange={(e) => setRoute(e.target.value)} maxLength={120} placeholder="From → to (optional)" className={inputClass} aria-label="Route" />
        <button type="submit" className={primary} disabled={!Number(miles)}>Log</button>
      </form>
    </Panel>
    <Panel title="Trips" right={years.length > 1 ? <select value={shown} onChange={(e) => setShown(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold" aria-label="Year">{years.map((y) => <option key={y}>{y}</option>)}</select> : undefined}>
      {trips.length ? <ul className="divide-y divide-slate-100">{[...trips].reverse().map((t) => <li key={t.id} className="flex items-center gap-3 py-2 text-sm"><span className="w-20 text-xs font-bold text-slate-400">{new Date(`${t.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold">{t.purpose || "Trip"}</span>{t.route && <span className="block truncate text-xs text-slate-500">{t.route}</span>}</span><span className="font-black">{t.miles} mi</span>
        <button type="button" onClick={() => setFamily((f) => ({ ...f, mileage: f.mileage.filter((x) => x.id !== t.id) }))} className={danger + " px-2"} aria-label="Delete"><Trash2 size={13} /></button></li>)}</ul> : <Empty icon={<Gauge />} title="No trips this year.">Log your first trip above.</Empty>}
    </Panel>
  </div>;
}
