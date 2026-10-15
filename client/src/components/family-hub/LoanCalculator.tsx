// Loan calculator (a Plugin Store add-on): the monthly payment and total interest for a car loan,
// a mortgage or any loan, and how much paying extra each month saves.
import { useState } from "react";
import { loanPayment } from "@shared/lifePlugins";
import { PageHead, Panel, inputClass, type SectionProps } from "./ui";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const PRESETS = [{ label: "Car", amount: 30000, rate: 7, years: 5 }, { label: "Home", amount: 350000, rate: 6.5, years: 30 }, { label: "Student", amount: 25000, rate: 5.5, years: 10 }];

/** Months to pay off with an extra amount each month, and the interest that costs. */
function withExtra(principal: number, yearlyRate: number, monthly: number) {
  const r = yearlyRate / 100 / 12;
  let bal = principal, months = 0, interest = 0;
  while (bal > 0.005 && months < 1200) { const i = bal * r; interest += i; bal = bal + i - monthly; months++; }
  return { months, interest };
}

export default function LoanCalculator(_: SectionProps) {
  const [amount, setAmount] = useState(30000);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(5);
  const [extra, setExtra] = useState(0);
  const base = loanPayment(amount, rate, years);
  const sped = extra > 0 && base.monthly > 0 ? withExtra(amount, rate, base.monthly + extra) : null;
  const num = (v: string) => Math.max(0, Number(v) || 0);

  return <div className="space-y-6">
    <PageHead eyebrow="Loan calculator" title="What will it cost?" blurb="See the monthly payment and total interest for a car, home or any loan, and what paying a little extra saves. Estimates only." />
    <div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => <button key={p.label} type="button" onClick={() => { setAmount(p.amount); setRate(p.rate); setYears(p.years); }} className="min-h-10 rounded-xl bg-white px-4 text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:text-slate-900">{p.label} loan</button>)}</div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel>
        <div className="space-y-4">
          <label className="block text-xs font-bold text-slate-500">Loan amount<input type="number" min={0} value={amount} onChange={(e) => setAmount(num(e.target.value))} className={inputClass + " mt-1 text-lg font-black"} /></label>
          <label className="block text-xs font-bold text-slate-500">Interest rate (% a year)<input type="number" min={0} step="0.125" value={rate} onChange={(e) => setRate(Math.min(50, num(e.target.value)))} className={inputClass + " mt-1 text-lg font-black"} /></label>
          <label className="block text-xs font-bold text-slate-500">Years: {years}<input type="range" min={1} max={40} value={years} onChange={(e) => setYears(Number(e.target.value))} className="mt-2 w-full accent-violet-600" /></label>
          <label className="block text-xs font-bold text-slate-500">Extra each month<input type="number" min={0} value={extra} onChange={(e) => setExtra(num(e.target.value))} className={inputClass + " mt-1"} /></label>
        </div>
      </Panel>
      <section className="rounded-[1.5rem] bg-gradient-to-br from-[#2d2555] to-[#6d5ce7] p-8 text-white shadow-[0_18px_40px_#4b3fa033]" aria-live="polite">
        <p className="text-sm font-bold text-violet-200">Monthly payment</p>
        <p className="text-5xl font-black tracking-tight">{money(base.monthly + extra)}</p>
        {extra > 0 && <p className="text-sm text-violet-200">{money(base.monthly)} + {money(extra)} extra</p>}
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3"><dt className="text-violet-200">Total interest</dt><dd className="text-xl font-black">{money(sped ? sped.interest : base.interest)}</dd></div>
          <div className="rounded-2xl bg-white/10 p-3"><dt className="text-violet-200">Paid off in</dt><dd className="text-xl font-black">{sped ? `${Math.floor(sped.months / 12)}y ${sped.months % 12}m` : `${years} years`}</dd></div>
        </dl>
        {sped && <p className="mt-4 rounded-2xl bg-emerald-400/20 p-3 text-sm font-bold">Paying {money(extra)} extra saves {money(base.interest - sped.interest)} in interest and finishes {Math.round(years * 12 - sped.months)} months early.</p>}
        <p className="mt-4 text-xs text-violet-200">Taxes, insurance and fees aren't included.</p>
      </section>
    </div>
  </div>;
}
