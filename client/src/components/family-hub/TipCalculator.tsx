// Tip & split (a Plugin Store add-on): the tip, the total, and what each person owes.
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { PageHead, Panel, inputClass, type SectionProps } from "./ui";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const TIPS = [0, 10, 15, 18, 20, 25];

export default function TipCalculator(_: SectionProps) {
  const [bill, setBill] = useState("");
  const [tip, setTip] = useState(18);
  const [people, setPeople] = useState(2);
  const [roundUp, setRoundUp] = useState(false);
  const b = Math.max(0, Number(bill) || 0);
  const tipAmt = (b * tip) / 100;
  let total = b + tipAmt;
  let each = people > 0 ? total / people : total;
  if (roundUp && people > 0) { each = Math.ceil(each); total = each * people; }
  const shownTip = total - b;

  return <div className="space-y-6">
    <PageHead eyebrow="Tip & split" title="Who owes what" blurb="Work out the tip and split the bill evenly, in seconds." />
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <label className="block text-xs font-bold text-slate-500">Bill
          <div className="relative mt-1"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">$</span><input value={bill} onChange={(e) => setBill(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0.00" className={inputClass + " min-h-14 pl-8 text-2xl font-black"} aria-label="Bill amount" autoFocus /></div>
        </label>
        <p className="mb-2 mt-5 text-xs font-bold text-slate-500">Tip</p>
        <div className="grid grid-cols-6 gap-1.5">{TIPS.map((t) => <button key={t} type="button" onClick={() => setTip(t)} aria-pressed={tip === t} className={`min-h-11 rounded-xl text-sm font-black ${tip === t ? "bg-[#292446] text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>{t}%</button>)}</div>
        <input type="range" min={0} max={40} value={tip} onChange={(e) => setTip(Number(e.target.value))} className="mt-3 w-full accent-violet-600" aria-label="Custom tip percent" />
        <p className="mb-2 mt-5 text-xs font-bold text-slate-500">Split between</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setPeople((p) => Math.max(1, p - 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100" aria-label="One fewer person"><Minus size={17} /></button>
          <span className="w-16 text-center text-2xl font-black tabular-nums">{people}</span>
          <button type="button" onClick={() => setPeople((p) => Math.min(50, p + 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100" aria-label="One more person"><Plus size={17} /></button>
          <span className="text-sm font-bold text-slate-500">{people === 1 ? "person" : "people"}</span>
        </div>
        <label className="mt-5 flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" checked={roundUp} onChange={(e) => setRoundUp(e.target.checked)} className="h-4 w-4 accent-violet-600" />Round each share up to the dollar</label>
      </Panel>
      <section className="flex flex-col justify-center rounded-[1.5rem] bg-gradient-to-br from-[#2d2555] to-[#6d5ce7] p-8 text-white shadow-[0_18px_40px_#4b3fa033]" aria-live="polite">
        <p className="text-sm font-bold text-violet-200">{people > 1 ? "Each person pays" : "You pay"}</p>
        <p className="text-6xl font-black tracking-tight">{money(each)}</p>
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3"><dt className="text-violet-200">Tip ({b > 0 ? Math.round((shownTip / b) * 1000) / 10 : tip}%)</dt><dd className="text-xl font-black">{money(shownTip)}</dd></div>
          <div className="rounded-2xl bg-white/10 p-3"><dt className="text-violet-200">Total</dt><dd className="text-xl font-black">{money(total)}</dd></div>
        </dl>
      </section>
    </div>
  </div>;
}
