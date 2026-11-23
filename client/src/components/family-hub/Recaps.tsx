// The recap card on LifeHub/FamilyHub Home: what happened yesterday (or the last 7 days) in each app that's on
// (shared/recaps.ts). Yesterday / This week is one tap, and the gear lists every app's recap to switch on or off.
import { useMemo, useState } from "react";
import { History, Settings2, X } from "lucide-react";
import type { Family, FamilySection } from "@shared/familyHub";
import { isOn } from "@shared/familyHub";
import { DEFAULT_RECAPS, RECAP_APPS, buildRecaps, recapRange, type RecapPrefs } from "@shared/recaps";

const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function Recaps({ family, setFamily, tasks, go }: { family: Family; setFamily: (fn: (f: Family) => Family) => void; tasks: { title: string; done: boolean; completedAt?: string; due?: string }[]; go: (id: string) => void }) {
  const prefs = family.recaps ?? DEFAULT_RECAPS;
  const [edit, setEdit] = useState(false);
  const today = localDay();
  const recaps = useMemo(() => buildRecaps(family, tasks, today, prefs, (id) => isOn(id, family)), [family, tasks, today, prefs]);
  const save = (p: Partial<RecapPrefs>) => setFamily((f) => ({ ...f, recaps: { ...(f.recaps ?? DEFAULT_RECAPS), ...p } }));
  const toggle = (id: string) => save({ off: prefs.off.includes(id) ? prefs.off.filter((x) => x !== id) : [...prefs.off, id] });
  if (!prefs.on && !edit) return null;
  const apps = RECAP_APPS.filter((a) => a.id === "tasks" || isOn(a.id as FamilySection, family));
  return <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="recaps">
    <div className="mb-2 flex items-center gap-2">
      <History size={17} className="text-violet-600" />
      <h2 className="flex-1 text-sm font-black text-slate-900">{recapRange(today, prefs.period).label}</h2>
      <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-bold">
        {(["yesterday", "week"] as const).map((p) => <button key={p} type="button" onClick={() => save({ period: p })} aria-pressed={prefs.period === p} className={`rounded-full px-3 py-1 ${prefs.period === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`} data-testid={`recaps-${p}`}>{p === "yesterday" ? "Yesterday" : "This week"}</button>)}
      </div>
      <button type="button" onClick={() => setEdit((v) => !v)} aria-label="Choose recaps" className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100" data-testid="recaps-settings">{edit ? <X size={16} /> : <Settings2 size={16} />}</button>
    </div>
    {edit ? <div className="space-y-1" data-testid="recaps-list">
      <label className="flex min-h-11 items-center gap-3 border-b border-slate-100 pb-2 text-sm font-bold"><input type="checkbox" checked={prefs.on} onChange={(e) => save({ on: e.target.checked })} className="h-5 w-5 accent-violet-600" data-testid="recaps-on" /> Show recaps on Home</label>
      {apps.map((a) => <label key={a.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" disabled={!prefs.on} checked={!prefs.off.includes(a.id)} onChange={() => toggle(a.id)} className="h-5 w-5 accent-violet-600" data-testid={`recap-toggle-${a.id}`} /> {a.title}</label>)}
    </div> : recaps.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{recaps.map((r) => <button key={r.id} type="button" onClick={() => go(r.id)} className="rounded-2xl bg-slate-50 p-3 text-left hover:bg-slate-100" data-testid={`recap-${r.id}`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{r.title}</p>
      {r.lines.map((l, i) => <p key={i} className="mt-0.5 text-sm text-slate-800">{l}</p>)}
    </button>)}</div> : <p className="text-sm text-slate-500">Nothing logged {prefs.period === "week" ? "in the last 7 days" : "yesterday"}.</p>}
  </section>;
}
