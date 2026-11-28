// Life Score's Health tab (client/src/components/family-hub/LifeScoreApp.tsx): the symptom tracker, the vitals log
// (blood pressure, heart rate, blood sugar, weight, temperature, blood oxygen) and the Prevention list of
// screenings, checkups and vaccines. The analysis is shared/lifeHealthLog.ts; prevention is shared/lifeScore.ts.
// Nothing here is a diagnosis; warning signs point to emergency care.
import HealthSources from "@/components/HealthSources";
import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, HeartPulse, Plus, ShieldCheck, Stethoscope, Trash2 } from "lucide-react";
import {
  BODY_AREAS, CONTEXTS, PARTS_OF_DAY, SYMPTOMS, SYMPTOM_GROUPS, TRIGGERS, VITALS, symptomDef, symptomFindings, symptomList, symptomName, symptomStats,
  vitalCategory, vitalStats, type CompareFacts, type Level, type SymptomEntry, type VitalContext, type VitalEntry, type VitalKind,
} from "@shared/lifeHealthLog";
import { SCREENINGS, factsFor, screeningStatus, type LifeInput, type LifeScoreData, type ScreeningId, type ScreeningKind } from "@shared/lifeScore";
import { inputClass } from "./ui";

type Update = (fn: (d: LifeScoreData) => LifeScoreData) => void;
export type HealthView = { kind: "health" } | { kind: "symptoms" } | { kind: "symptom"; id: string } | { kind: "log-symptom"; id?: string } | { kind: "vitals"; vital?: VitalKind } | { kind: "prevention" };

const Card = ({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) => onClick
  ? <button type="button" onClick={onClick} className={`block w-full rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 sm:p-5 ${className}`}>{children}</button>
  : <div className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>{children}</div>;
const Eyebrow = ({ children }: { children: ReactNode }) => <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{children}</p>;
const Back = ({ onClick, label }: { onClick: () => void; label: string }) => <button type="button" onClick={onClick} className="mb-3 inline-flex min-h-10 items-center gap-1 rounded-full pr-3 text-sm font-semibold text-slate-500 hover:text-slate-900"><ChevronLeft className="h-5 w-5" />{label}</button>;
const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-10 rounded-full border px-3.5 text-[13px] font-semibold transition ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{children}</button>
);
const LEVEL: Record<Level, string> = { good: "bg-emerald-50 text-emerald-800 ring-emerald-200", watch: "bg-amber-50 text-amber-900 ring-amber-200", high: "bg-orange-50 text-orange-900 ring-orange-200", urgent: "bg-rose-50 text-rose-900 ring-rose-300" };
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const nowLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const when = (at: string) => new Date(at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const sevColor = (v: number) => (v >= 8 ? "#e11d48" : v >= 5 ? "#f97316" : v >= 1 ? "#f59e0b" : "#e2e8f0");

/** Bars, labelled underneath (for parts of the day, weekdays and 30 days). */
function Bars({ values, labels, color = "#0f172a", max, title }: { values: (number | null)[]; labels?: string[]; color?: string | ((v: number) => string); max?: number; title: string }) {
  const top = max ?? Math.max(1, ...values.map((v) => v ?? 0));
  return (
    <div role="img" aria-label={`${title}: ${values.map((v, i) => `${labels?.[i] ?? i + 1} ${v ?? "none"}`).join(", ")}`}>
      <div className="flex h-24 items-end gap-[3px]">
        {values.map((v, i) => <div key={i} className="flex-1 rounded-t" style={{ height: `${v ? Math.max(4, (v / top) * 100) : 2}%`, background: v ? (typeof color === "function" ? color(v) : color) : "#e2e8f0" }} />)}
      </div>
      {labels && <div className="mt-1 flex gap-[3px]">{labels.map((l, i) => <span key={i} className="flex-1 truncate text-center text-[10px] font-semibold text-slate-500">{l}</span>)}</div>}
    </div>
  );
}

// ——— Health home ——————————————————————————————————————————————————————————————————————————————————————————————
export function HealthHome({ data, today, go }: { data: LifeScoreData; today: string; go: (v: HealthView) => void }) {
  const sym = symptomList(data.symptoms ?? [], today);
  const vit = data.vitals ?? [];
  const lastBp = [...vit].filter((v) => v.kind === "bp").sort((a, b) => a.at.localeCompare(b.at)).pop();
  const lastHr = [...vit].filter((v) => v.kind === "hr").sort((a, b) => a.at.localeCompare(b.at)).pop();
  const prev = screeningStatus(data.settings, today);
  const due = prev.filter((p) => p.due).length;
  return (
    <div className="space-y-4">
      <div className="px-1"><Eyebrow>Health</Eyebrow><h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.02em] text-slate-900">Your health log</h1>
        <p className="mt-1 text-sm text-slate-500">Symptoms, vitals and prevention, all counted in your Life Score.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card onClick={() => go({ kind: "log-symptom" })} className="!bg-slate-900 !border-slate-900 text-white"><Plus className="h-5 w-5" /><p className="mt-2 text-[15px] font-bold">Log a symptom</p><p className="text-xs text-white/70">How bad, when, what came before</p></Card>
        <Card onClick={() => go({ kind: "vitals", vital: "bp" })}><HeartPulse className="h-5 w-5 text-rose-500" /><p className="mt-2 text-[15px] font-bold text-slate-900">Log blood pressure</p><p className="text-xs text-slate-500">{lastBp ? `Last ${lastBp.value}/${lastBp.dia ?? "?"} · ${vitalCategory(lastBp).label}` : "No readings yet"}</p></Card>
        <Card onClick={() => go({ kind: "vitals", vital: "hr" })}><HeartPulse className="h-5 w-5 text-red-500" /><p className="mt-2 text-[15px] font-bold text-slate-900">Log heart rate</p><p className="text-xs text-slate-500">{lastHr ? `Last ${lastHr.value} bpm · ${vitalCategory(lastHr).label}` : "No readings yet"}</p></Card>
      </div>
      <Card onClick={() => go({ kind: "symptoms" })}>
        <div className="flex items-center gap-3"><Stethoscope className="h-6 w-6 text-violet-600" /><div className="min-w-0 flex-1"><p className="text-[17px] font-bold text-slate-900">Symptoms</p>
          <p className="text-sm text-slate-500">{sym.length ? `${sym.length} symptom${sym.length === 1 ? "" : "s"} in 90 days · most often ${sym[0].name.toLowerCase()} (${sym[0].last30} in 30 days)` : "Nothing logged. Log one when it happens to find its pattern."}</p></div><ChevronRight className="h-5 w-5 text-slate-300" /></div>
      </Card>
      <Card onClick={() => go({ kind: "vitals" })}>
        <div className="flex items-center gap-3"><HeartPulse className="h-6 w-6 text-rose-500" /><div className="min-w-0 flex-1"><p className="text-[17px] font-bold text-slate-900">Vitals</p>
          <p className="text-sm text-slate-500">Blood pressure, heart rate, blood sugar, weight, temperature and blood oxygen · {vit.length} reading{vit.length === 1 ? "" : "s"}</p></div><ChevronRight className="h-5 w-5 text-slate-300" /></div>
      </Card>
      <Card onClick={() => go({ kind: "prevention" })}>
        <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-pink-600" /><div className="min-w-0 flex-1"><p className="text-[17px] font-bold text-slate-900">Prevention</p>
          <p className="text-sm text-slate-500">{prev.length ? `${due ? `${due} due` : "All up to date"} · ${prev.length} screenings, checkups and vaccines for you` : "Add your birth year and sex to see the screenings, checkups and vaccines for you"}</p></div>
          {due > 0 && <span className="grid h-7 min-w-7 place-items-center rounded-full bg-rose-600 px-2 text-sm font-extrabold text-white">{due}</span>}<ChevronRight className="h-5 w-5 text-slate-300" /></div>
      </Card>
      <p className="px-2 text-center text-xs leading-5 text-slate-400">For tracking and talking with your doctor. It doesn't diagnose anything. In an emergency, call 911.</p>
    </div>
  );
}

// ——— Symptoms ——————————————————————————————————————————————————————————————————————————————————————————————————
export function SymptomsView({ data, today, go, back }: { data: LifeScoreData; today: string; go: (v: HealthView) => void; back: () => void }) {
  const list = symptomList(data.symptoms ?? [], today);
  const recent = [...(data.symptoms ?? [])].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const all30 = Array.from({ length: 30 }, (_, i) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() + i - 29); const k = d.toISOString().slice(0, 10); return Math.max(0, ...(data.symptoms ?? []).filter((e) => e.at.slice(0, 10) === k).map((e) => e.severity)); });
  return (
    <div className="space-y-4">
      <Back onClick={back} label="Health" />
      <HealthSources topics={["symptoms"]} label="Sources for this health information" />
      <div className="flex items-end justify-between gap-3 px-1"><div><Eyebrow>Symptom tracker</Eyebrow><h1 className="mt-1 text-[26px] font-extrabold text-slate-900">Symptoms</h1></div>
        <button type="button" onClick={() => go({ kind: "log-symptom" })} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" />Log one</button></div>
      <Card><Eyebrow>Last 30 days · worst each day</Eyebrow><div className="mt-3"><Bars values={all30.map((v) => v || null)} max={10} color={sevColor} title="Worst symptom each day" /></div>
        <p className="mt-2 text-xs text-slate-500">{all30.filter((v) => v === 0).length} symptom-free days of 30.</p></Card>
      <Card>
        <Eyebrow>Your symptoms (90 days)</Eyebrow>
        {list.length ? <ul className="mt-2 divide-y divide-slate-100">{list.map((s) => (
          <li key={s.symptom}><button type="button" onClick={() => go({ kind: "symptom", id: s.symptom })} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white" style={{ background: sevColor(s.avg) }}>{s.avg}</span>
            <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold text-slate-900">{s.name}</span><span className="block text-xs text-slate-500">{s.last30} in 30 days · last {when(s.last)}</span></span>
            <ChevronRight className="h-5 w-5 text-slate-300" /></button></li>))}</ul>
          : <p className="mt-2 text-sm text-slate-500">Nothing yet. When something comes up (a headache, heartburn, back pain, anxiety), log it with how bad it is and what came before. After a few, you'll see its pattern here.</p>}
      </Card>
      {recent.length > 0 && <Card><Eyebrow>Recent</Eyebrow><ul className="mt-2 divide-y divide-slate-100">{recent.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sevColor(e.severity) }} />
          <span className="min-w-0 flex-1 text-sm"><b className="text-slate-900">{symptomName(e.symptom)}</b> <span className="text-slate-500">· {e.severity}/10 · {when(e.at)}</span></span></li>))}</ul></Card>}
    </div>
  );
}

export function SymptomForm({ data, update, initial, done, back }: { data: LifeScoreData; update: Update; initial?: string; done: (symptom: string) => void; back: () => void }) {
  const [symptom, setSymptom] = useState(initial ?? "");
  const [custom, setCustom] = useState("");
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState(5);
  const [at, setAt] = useState(nowLocal());
  const [minutes, setMinutes] = useState<number | undefined>();
  const [where, setWhere] = useState("");
  const [triggers, setTriggers] = useState<string[]>([]);
  const [relief, setRelief] = useState("");
  const [helped, setHelped] = useState<boolean | undefined>();
  const [note, setNote] = useState("");
  const def = symptom ? symptomDef(symptom) : undefined;
  const pick = symptom || custom.trim();
  const shown = SYMPTOMS.filter((s) => !q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase()));
  const save = () => {
    if (!pick) return;
    const e: SymptomEntry = { id: newId(), at, symptom: pick.slice(0, 60), severity, ...(minutes ? { minutes } : {}), ...(where ? { where } : {}), ...(triggers.length ? { triggers } : {}), ...(relief.trim() ? { relief: relief.trim(), ...(helped !== undefined ? { helped } : {}) } : {}), ...(note.trim() ? { note: note.trim() } : {}) };
    update((d) => ({ ...d, symptoms: [...(d.symptoms ?? []), e] }));
    done(e.symptom);
  };
  return (
    <div className="space-y-4">
      <Back onClick={back} label="Symptoms" />
      <h1 className="px-1 text-[26px] font-extrabold text-slate-900">Log a symptom</h1>
      {def?.urgent && <div className="flex gap-3 rounded-2xl border-2 border-rose-400 bg-rose-50 p-4 text-rose-900" role="alert"><AlertTriangle className="h-6 w-6 shrink-0" /><div><p className="font-extrabold">{def.name}: this can be serious.</p><p className="mt-1 text-sm">{def.urgent}</p></div></div>}
      <Card>
        <Eyebrow>What is it?</Eyebrow>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symptoms" aria-label="Search symptoms" className={`${inputClass} mt-2`} />
        <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
          {SYMPTOM_GROUPS.map((g) => { const items = shown.filter((s) => s.group === g.id); return items.length ? (
            <div key={g.id}><p className="mb-1.5 text-xs font-bold text-slate-500">{g.name}</p><div className="flex flex-wrap gap-1.5">
              {items.map((s) => <Chip key={s.id} on={symptom === s.id} onClick={() => { setSymptom(symptom === s.id ? "" : s.id); setCustom(""); }}>{s.urgent ? "⚠ " : ""}{s.name}</Chip>)}</div></div>) : null; })}
        </div>
        <label className="mt-3 block text-xs font-bold text-slate-500" htmlFor="sym-custom">Not listed? Name it</label>
        <input id="sym-custom" value={custom} onChange={(e) => { setCustom(e.target.value); if (e.target.value) setSymptom(""); }} maxLength={60} placeholder="e.g. Jaw pain" className={`${inputClass} mt-1`} />
      </Card>
      <Card>
        <div className="flex items-baseline justify-between"><Eyebrow>How bad?</Eyebrow><span className="text-2xl font-extrabold tabular-nums" style={{ color: sevColor(severity) }}>{severity}<span className="text-sm text-slate-400">/10</span></span></div>
        <input type="range" min={1} max={10} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} aria-label="Severity, 1 to 10" className="mt-2 w-full accent-slate-900" />
        <div className="flex justify-between text-xs text-slate-500"><span>Barely</span><span>Worst ever</span></div>
      </Card>
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-slate-500">When it started<input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value.slice(0, 16))} className={`${inputClass} mt-1`} /></label>
          <label className="block text-xs font-bold text-slate-500">How long it lasted<select value={minutes ?? ""} onChange={(e) => setMinutes(e.target.value ? Number(e.target.value) : undefined)} className={`${inputClass} mt-1`}>
            <option value="">Not sure / still going</option>{[[5, "A few minutes"], [30, "About 30 minutes"], [60, "About an hour"], [180, "A few hours"], [720, "Half a day"], [1440, "All day"], [4320, "Several days"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="block text-xs font-bold text-slate-500 sm:col-span-2">Where on the body<select value={where} onChange={(e) => setWhere(e.target.value)} className={`${inputClass} mt-1`}><option value="">Not about one place</option>{BODY_AREAS.map((a) => <option key={a}>{a}</option>)}</select></label>
        </div>
      </Card>
      <Card>
        <Eyebrow>What came before it? (likely triggers)</Eyebrow>
        <div className="mt-2 flex flex-wrap gap-1.5">{TRIGGERS.map((t) => <Chip key={t} on={triggers.includes(t)} onClick={() => setTriggers(triggers.includes(t) ? triggers.filter((x) => x !== t) : [...triggers, t])}>{t}</Chip>)}</div>
      </Card>
      <Card>
        <label className="block text-xs font-bold text-slate-500" htmlFor="sym-relief">What you took or did for it</label>
        <input id="sym-relief" value={relief} onChange={(e) => setRelief(e.target.value)} maxLength={120} placeholder="e.g. Ibuprofen, rest, water, a walk" className={`${inputClass} mt-1`} />
        {relief.trim() && <div className="mt-2 flex items-center gap-2 text-sm"><span className="font-semibold text-slate-600">Did it help?</span><Chip on={helped === true} onClick={() => setHelped(helped === true ? undefined : true)}>Yes</Chip><Chip on={helped === false} onClick={() => setHelped(helped === false ? undefined : false)}>No</Chip></div>}
        <label className="mt-3 block text-xs font-bold text-slate-500" htmlFor="sym-note">Notes</label>
        <textarea id="sym-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={`${inputClass} mt-1 min-h-[64px] py-2`} />
      </Card>
      <button type="button" disabled={!pick} onClick={save} className="min-h-12 w-full rounded-2xl bg-slate-900 text-[15px] font-bold text-white disabled:opacity-40">Save{pick ? `: ${symptomDef(pick)?.name ?? pick}` : ""}</button>
      <p className="px-2 text-center text-xs text-slate-400">{data.symptoms?.length ?? 0} symptoms logged so far.</p>
    </div>
  );
}

export function SymptomDetail({ id, input, today, update, back, logAgain }: { id: string; input: LifeInput; today: string; update: Update; back: () => void; logAgain: () => void }) {
  const entries = input.data.symptoms ?? [];
  const facts = (d: string): CompareFacts => { const f = factsFor(input, d); return { sleep: f.sleep, stress: f.stress, alcohol: f.alcohol, caffeine: f.caffeine, screen: f.screen, exercise: f.exercise, water: f.water, steps: f.steps }; };
  const s = useMemo(() => symptomStats(entries, id, today, facts), [entries, id, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const findings = symptomFindings(s);
  const mine = entries.filter((e) => e.symptom === id).sort((a, b) => b.at.localeCompare(a.at));
  const remove = (eid: string) => update((d) => ({ ...d, symptoms: (d.symptoms ?? []).filter((e) => e.id !== eid) }));
  return (
    <div className="space-y-4">
      <Back onClick={back} label="Symptoms" />
      <HealthSources topics={["symptoms"]} label="Sources for this health information" />
      <div className="flex items-end justify-between gap-3 px-1"><div><Eyebrow>Symptom</Eyebrow><h1 className="mt-1 text-[26px] font-extrabold text-slate-900">{s.name}</h1></div>
        <button type="button" onClick={logAgain} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-slate-900 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" />Log it</button></div>
      {s.urgent && <div className="flex gap-3 rounded-2xl border-2 border-rose-400 bg-rose-50 p-4 text-rose-900" role="alert"><AlertTriangle className="h-6 w-6 shrink-0" /><p className="text-sm font-semibold">{s.urgent}</p></div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Last 30 days", String(s.last30)], ["Average severity", s.avgSeverity === null ? "—" : `${s.avgSeverity}/10`], ["Usually lasts", s.avgMinutes === null ? "—" : s.avgMinutes >= 120 ? `${Math.round(s.avgMinutes / 60)} h` : `${s.avgMinutes} min`], ["Days without it", String(s.freeStreak)]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-2xl font-extrabold tabular-nums text-slate-900">{v}</p><p className="text-xs font-semibold text-slate-500">{l}</p></div>))}
      </div>
      <Card><Eyebrow>What your log shows</Eyebrow><ul className="mt-2 space-y-2">{findings.map((f, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-6 text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />{f}</li>)}</ul>
        <p className="mt-3 text-xs text-slate-400">Patterns in your own log; they don't prove a cause.</p></Card>
      <Card><Eyebrow>Last 30 days · severity</Eyebrow><div className="mt-3"><Bars values={s.days.map((v) => v || null)} max={10} color={sevColor} title="Severity each day" /></div></Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card><Eyebrow>Time of day (90 days)</Eyebrow><div className="mt-3"><Bars values={s.byPart} labels={PARTS_OF_DAY.map((p) => p.split(" (")[0])} color="#7c6cf0" title="Times by part of day" /></div></Card>
        <Card><Eyebrow>Day of the week (90 days)</Eyebrow><div className="mt-3"><Bars values={s.byWeekday} labels={["S", "M", "T", "W", "T", "F", "S"]} color="#0ea5e9" title="Times by weekday" /></div></Card>
      </div>
      {(s.topTriggers.length > 0 || s.helped.length > 0) && <div className="grid gap-3 sm:grid-cols-2">
        {s.topTriggers.length > 0 && <Card><Eyebrow>Triggers you noted</Eyebrow><ul className="mt-2 space-y-1">{s.topTriggers.map((t) => <li key={t.name} className="flex justify-between text-sm"><span className="font-semibold text-slate-800">{t.name}</span><span className="tabular-nums text-slate-500">{t.times}×</span></li>)}</ul></Card>}
        {s.helped.length > 0 && <Card><Eyebrow>What helped</Eyebrow><ul className="mt-2 space-y-1">{s.helped.map((t) => <li key={t.name} className="flex justify-between text-sm"><span className="font-semibold text-slate-800">{t.name}</span><span className="tabular-nums text-slate-500">{t.times}×</span></li>)}</ul></Card>}
      </div>}
      <Card><Eyebrow>Every time ({mine.length})</Eyebrow><ul className="mt-2 divide-y divide-slate-100">{mine.slice(0, 60).map((e) => (
        <li key={e.id} className="flex items-start gap-3 py-2.5"><span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white" style={{ background: sevColor(e.severity) }}>{e.severity}</span>
          <span className="min-w-0 flex-1 text-sm"><span className="block font-semibold text-slate-900">{when(e.at)}{e.minutes ? ` · ${e.minutes >= 120 ? `${Math.round(e.minutes / 60)} h` : `${e.minutes} min`}` : ""}{e.where ? ` · ${e.where}` : ""}</span>
            {!!e.triggers?.length && <span className="block text-slate-500">After: {e.triggers.join(", ").toLowerCase()}</span>}
            {e.relief && <span className="block text-slate-500">Took: {e.relief}{e.helped === true ? " (helped)" : e.helped === false ? " (didn't help)" : ""}</span>}
            {e.note && <span className="block text-slate-500">{e.note}</span>}</span>
          <button type="button" onClick={() => remove(e.id)} aria-label="Delete this entry" className="grid h-10 w-10 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></li>))}</ul></Card>
    </div>
  );
}

// ——— Vitals ————————————————————————————————————————————————————————————————————————————————————————————————————
const KINDS = Object.keys(VITALS) as VitalKind[];
export function VitalsView({ data, today, update, start, back }: { data: LifeScoreData; today: string; update: Update; start?: VitalKind; back: () => void }) {
  const [kind, setKind] = useState<VitalKind>(start ?? "bp");
  const [value, setValue] = useState("");
  const [dia, setDia] = useState("");
  const [pulse, setPulse] = useState("");
  const [context, setContext] = useState<VitalContext | "">("");
  const [at, setAt] = useState(nowLocal());
  const [saved, setSaved] = useState<VitalEntry | null>(null);
  const v = data.vitals ?? [];
  const s = useMemo(() => vitalStats(v, kind, today), [v, kind, today]);
  const d = VITALS[kind];
  const ok = Number(value) >= d.lo && Number(value) <= d.hi && (kind !== "bp" || (Number(dia) >= 30 && Number(dia) <= 180));
  const save = () => {
    if (!ok) return;
    const e: VitalEntry = { id: newId(), at, kind, value: Number(value), ...(kind === "bp" ? { dia: Number(dia), ...(pulse ? { pulse: Number(pulse) } : {}) } : {}), ...(context ? { context } : {}) };
    // A cuff's pulse is also a heart rate reading.
    const extra: VitalEntry[] = kind === "bp" && pulse && Number(pulse) >= 20 ? [{ id: newId(), at, kind: "hr", value: Number(pulse), context: "resting" }] : [];
    update((x) => ({ ...x, vitals: [...(x.vitals ?? []), e, ...extra] }));
    setSaved(e); setValue(""); setDia(""); setPulse(""); setAt(nowLocal());
  };
  const remove = (id: string) => update((x) => ({ ...x, vitals: (x.vitals ?? []).filter((e) => e.id !== id) }));
  const show = (e: VitalEntry) => (e.kind === "bp" ? `${e.value}/${e.dia ?? "?"}${e.pulse ? ` · pulse ${e.pulse}` : ""}` : `${e.value} ${VITALS[e.kind].unit}`);
  const savedCat = saved ? vitalCategory(saved) : null;
  return (
    <div className="space-y-4">
      <Back onClick={back} label="Health" />
      <HealthSources topics={["vitals"]} label="Sources for this health information" />
      <div className="px-1"><Eyebrow>Vitals</Eyebrow><h1 className="mt-1 text-[26px] font-extrabold text-slate-900">{d.name}</h1></div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">{KINDS.map((k) => <Chip key={k} on={k === kind} onClick={() => { setKind(k); setSaved(null); }}>{VITALS[k].name}</Chip>)}</div>
      <Card>
        <Eyebrow>Add a reading</Eyebrow>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-bold text-slate-500">{kind === "bp" ? "Top number (systolic)" : `${d.name} (${d.unit})`}<input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))} className={`${inputClass} mt-1`} placeholder={kind === "bp" ? "120" : kind === "hr" ? "65" : ""} /></label>
          {kind === "bp" && <label className="block text-xs font-bold text-slate-500">Bottom number (diastolic)<input inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, ""))} className={`${inputClass} mt-1`} placeholder="80" /></label>}
          {kind === "bp" && <label className="block text-xs font-bold text-slate-500">Pulse (optional)<input inputMode="numeric" value={pulse} onChange={(e) => setPulse(e.target.value.replace(/\D/g, ""))} className={`${inputClass} mt-1`} placeholder="70" /></label>}
          <label className="block text-xs font-bold text-slate-500">When<input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value.slice(0, 16))} className={`${inputClass} mt-1`} /></label>
          {kind !== "weight" && <label className="block text-xs font-bold text-slate-500">Taken<select value={context} onChange={(e) => setContext(e.target.value as VitalContext | "")} className={`${inputClass} mt-1`}><option value="">Any time</option>{CONTEXTS.filter((c) => kind === "glucose" || !["fasting", "after-meal"].includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        </div>
        <button type="button" disabled={!ok} onClick={save} className="mt-3 min-h-11 w-full rounded-xl bg-slate-900 text-sm font-bold text-white disabled:opacity-40">Save reading</button>
        {saved && savedCat && <div className={`mt-3 rounded-xl px-3 py-2.5 text-sm ring-1 ${LEVEL[savedCat.level]}`} role="status"><b>{show(saved)}: {savedCat.label}.</b> {savedCat.advice}</div>}
        {kind === "bp" && <p className="mt-2 text-xs text-slate-500">For an accurate reading: sit quietly 5 minutes, feet flat, back supported, arm resting at heart level, no caffeine or exercise in the 30 minutes before.</p>}
      </Card>
      {s.latest && <Card>
        <Eyebrow>Your {d.name.toLowerCase()}</Eyebrow>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Latest", show(s.latest)], ["7-day average", s.avg7 === null ? "—" : kind === "bp" ? `${Math.round(s.avg7)}/${Math.round(s.dia7 ?? 0)}` : String(s.avg7)], ["30-day average", s.avg30 === null ? "—" : kind === "bp" ? `${Math.round(s.avg30)}/${Math.round(s.dia30 ?? 0)}` : String(s.avg30)], ["30-day range", s.min30 === null ? "—" : `${s.min30} to ${s.max30}`]].map(([l, x]) => (
            <div key={l} className="rounded-2xl bg-slate-50 p-3"><p className="text-lg font-extrabold tabular-nums text-slate-900">{x}</p><p className="text-xs font-semibold text-slate-500">{l}</p></div>))}
        </div>
        {s.latestCategory && <div className={`mt-3 rounded-xl px-3 py-2.5 text-sm ring-1 ${LEVEL[s.latestCategory.level]}`}><b>Latest: {s.latestCategory.label}.</b> {s.latestCategory.advice}</div>}
        {(kind === "bp" || kind === "hr") && (s.morning || s.evening) ? <p className="mt-3 text-sm text-slate-600">Mornings {s.morning ? Math.round(s.morning) : "—"} · evenings {s.evening ? Math.round(s.evening) : "—"} (30 days)</p> : null}
        <div className="mt-4"><Eyebrow>Last 30 days</Eyebrow><div className="mt-2"><Bars values={s.days} color={kind === "bp" ? (x: number) => (x >= 140 ? "#ea580c" : x >= 130 ? "#f59e0b" : x >= 120 ? "#facc15" : "#10b981") : "#e11d48"} title={`${d.name} each day`} /></div></div>
        {s.count30 > 0 && <div className="mt-4 flex h-3 overflow-hidden rounded-full" role="img" aria-label={`Readings: ${s.levels.good} normal, ${s.levels.watch} to watch, ${s.levels.high} high, ${s.levels.urgent} urgent`}>
          {(["good", "watch", "high", "urgent"] as Level[]).map((l) => s.levels[l] ? <div key={l} style={{ width: `${(s.levels[l] / s.count30) * 100}%`, background: { good: "#10b981", watch: "#f59e0b", high: "#ea580c", urgent: "#e11d48" }[l] }} /> : null)}</div>}
        <ul className="mt-3 space-y-1.5">{s.findings.map((f, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-6 text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />{f}</li>)}</ul>
      </Card>}
      {v.some((e) => e.kind === kind) && <Card><Eyebrow>Readings</Eyebrow><ul className="mt-2 divide-y divide-slate-100">
        {v.filter((e) => e.kind === kind).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60).map((e) => { const c = vitalCategory(e); return (
          <li key={e.id} className="flex items-center gap-3 py-2"><span className="min-w-0 flex-1 text-sm"><b className="tabular-nums text-slate-900">{show(e)}</b> <span className="text-slate-500">· {when(e.at)}{e.context ? ` · ${CONTEXTS.find((x) => x.id === e.context)?.name.toLowerCase()}` : ""}</span></span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${LEVEL[c.level]}`}>{c.label}</span>
            <button type="button" onClick={() => remove(e.id)} aria-label="Delete this reading" className="grid h-10 w-10 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></li>); })}</ul></Card>}
      <p className="px-2 text-center text-xs leading-5 text-slate-400">Adult reference ranges (American Heart Association, American Diabetes Association). Your doctor may set different targets for you.</p>
    </div>
  );
}

// ——— Prevention ————————————————————————————————————————————————————————————————————————————————————————————————
const KIND_NAME: Record<ScreeningKind, string> = { cancer: "Cancer screenings", checkup: "Checkups", vaccine: "Vaccines" };
export function PreventionView({ data, today, update, back }: { data: LifeScoreData; today: string; update: Update; back: () => void }) {
  const st = screeningStatus(data.settings, today);
  const set = (fn: (s: LifeScoreData["settings"]) => LifeScoreData["settings"]) => update((d) => ({ ...d, settings: fn(d.settings) }));
  const mark = (id: ScreeningId, date: string, years: number) => set((s) => ({ ...s, screenings: { ...s.screenings, [id]: { date, years } } }));
  const clear = (id: ScreeningId) => set((s) => { const x = { ...s.screenings }; delete x[id]; return { ...s, screenings: x }; });
  const due = st.filter((x) => x.due).length;
  return (
    <div className="space-y-4">
      <Back onClick={back} label="Health" />
      <HealthSources topics={["screenings"]} label="Sources for this health information" />
      <div className="px-1"><Eyebrow>Prevention</Eyebrow><h1 className="mt-1 text-[26px] font-extrabold text-slate-900">Screenings, checkups and vaccines</h1>
        <p className="mt-1 text-sm text-slate-500">What's recommended for people at average risk at your age and sex. Your doctor may advise a different plan.</p></div>
      {(!data.settings.birthYear || !data.settings.sex) && <Card>
        <Eyebrow>So the right ones show up</Eyebrow>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-slate-500">Birth year<input inputMode="numeric" defaultValue={data.settings.birthYear ?? ""} onBlur={(e) => { const y = Number(e.target.value); if (y >= 1900 && y <= Number(today.slice(0, 4))) set((s) => ({ ...s, birthYear: y })); }} className={`${inputClass} mt-1`} placeholder="1985" /></label>
          <div><p className="text-xs font-bold text-slate-500">Sex at birth</p><div className="mt-1 flex gap-2">{(["female", "male"] as const).map((x) => <Chip key={x} on={data.settings.sex === x} onClick={() => set((s) => ({ ...s, sex: x }))}>{x === "female" ? "Female" : "Male"}</Chip>)}</div></div>
        </div>
      </Card>}
      {st.length > 0 && <div className={`rounded-2xl border-2 p-4 text-[15px] font-bold ${due ? "border-rose-300 bg-rose-50 text-rose-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`} role="status">{due ? `${due} of ${st.length} due or not marked yet` : `All ${st.length} up to date`}</div>}
      {(["cancer", "checkup", "vaccine"] as ScreeningKind[]).map((k) => { const items = st.filter((x) => x.kind === k); return items.length ? (
        <Card key={k}><Eyebrow>{KIND_NAME[k]}</Eyebrow><ul className="mt-2 divide-y divide-slate-100">{items.map((x) => { const def = SCREENINGS[x.id]; const cur = data.settings.screenings[x.id]; return (
          <li key={x.id} className="py-3">
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${x.due ? "bg-rose-500" : "bg-emerald-500"}`} aria-hidden="true" />
              <div className="min-w-0 flex-1"><p className="text-[15px] font-bold text-slate-900">{x.name}</p><p className="text-xs text-slate-500">{x.who}</p>
                <p className={`mt-1 text-sm font-semibold ${x.due ? "text-rose-700" : "text-emerald-700"}`}>{x.done ? `Last done ${x.done}${x.next ? ` · ${x.due ? "due since" : "next"} ${x.next}` : ""}` : "Not marked yet"}</p></div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
              <button type="button" onClick={() => mark(x.id, today, cur?.years ?? def.years)} className="min-h-10 rounded-full bg-slate-900 px-3.5 text-[13px] font-bold text-white">Done today</button>
              <label className="text-xs font-semibold text-slate-500">or on<input type="date" max={today} value={cur?.date ?? ""} onChange={(e) => e.target.value && mark(x.id, e.target.value, cur?.years ?? def.years)} className="ml-1.5 min-h-10 rounded-lg border border-slate-200 px-2 text-sm" /></label>
              {def.options.length > 1 && <select aria-label={`How often: ${x.name}`} value={cur?.years ?? def.years} onChange={(e) => cur && mark(x.id, cur.date, Number(e.target.value))} disabled={!cur} className="min-h-10 rounded-lg border border-slate-200 px-2 text-sm disabled:opacity-50">{def.options.map((o) => <option key={o.years} value={o.years}>{o.label}</option>)}</select>}
              {cur && <button type="button" onClick={() => clear(x.id)} className="min-h-10 px-2 text-xs font-semibold text-slate-500 hover:text-rose-600">Clear</button>}
            </div>
          </li>); })}</ul></Card>) : null; })}
    </div>
  );
}
