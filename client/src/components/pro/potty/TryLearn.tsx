// Try & learn: trial and error, done properly. Pick the problem, pick a strategy from the library
// (or write your own), run it for a set number of days, and the app compares the log before and
// during so you can see whether it actually helped.
import { useState } from "react";
import { FlaskRound } from "./icons";
import { uid } from "../kit";
import { EVIDENCE, PROBLEMS, STRATEGIES, addDay, dayOf, daysBack, strategyById, sumStats, type Experiment, type Problem, type Strategy } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Chip, Empty2, Label, Note, Panel, Section, field, fieldStyle, pct } from "./theme";

const STATUS: Record<Experiment["status"], { label: string; color: string }> = {
  trying: { label: "Trying", color: C.duckDeep }, worked: { label: "Worked", color: C.good }, partly: { label: "Helped a bit", color: C.pee }, didnt: { label: "Didn't help", color: C.accident }, stopped: { label: "Stopped", color: C.muted },
};
const range = (start: string, days: number) => Array.from({ length: days }, (_, i) => addDay(start, i)).filter((d) => d <= dayOf(Date.now()));

export default function TryLearn() {
  const { data, set, kid, sub } = usePotty();
  const [problem, setProblem] = useState<Problem | "">("");
  const [open, setOpen] = useState<string>(sub.startsWith("s:") ? sub.slice(2) : "");
  const [custom, setCustom] = useState(""); const [days, setDays] = useState(7);
  const mine = data.experiments.filter((e) => e.kid === kid.id).sort((a, b) => b.start.localeCompare(a.start));
  const active = mine.filter((e) => e.status === "trying");
  const list = STRATEGIES.filter((s) => !problem || s.problems.includes(problem));
  const tried = (id: string) => mine.find((e) => e.strategy === id);
  const start = (s: Strategy | null, title: string, n: number) => set((d) => ({ ...d, experiments: [{ id: uid(), kid: kid.id, strategy: s?.id || "", title, start: dayOf(Date.now()), days: n, status: "trying", notes: "" }, ...d.experiments] }));
  const put = (e: Experiment) => set((d) => ({ ...d, experiments: d.experiments.map((x) => (x.id === e.id ? e : x)) }));
  const compare = (e: Experiment) => {
    const during = range(e.start, e.days); const before = daysBack(Math.max(3, e.days), addDay(e.start, -1));
    return { b: sumStats(data.logs, kid.id, before), d: sumStats(data.logs, kid.id, during), n: during.length };
  };
  const detail = open ? strategyById(open) : undefined;
  return <div className="space-y-7">
    <Panel tone="night"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: C.duck, color: C.ink }}><FlaskRound size={24} /></span><div><h2 className="text-2xl font-extrabold">Try one thing, see if it helps</h2><p className="mt-1 max-w-2xl text-sm text-white/75">Every child is different, so trial and error is normal. Change one thing at a time, give it a few days, and let the log show you what worked. {STRATEGIES.length} strategies, sorted by problem, each with how strong the evidence is.</p></div></div></Panel>

    {active.length > 0 && <Section title="Trying now">
      <div className="grid gap-4 lg:grid-cols-2">{active.map((e) => { const c = compare(e); const s = strategyById(e.strategy); const dayN = Math.min(e.days, c.n); return <Panel key={e.id}>
        <div className="flex items-start justify-between gap-2"><div><p className="ph text-lg font-extrabold">{e.title}</p><p className="text-xs" style={{ color: C.muted }}>Day {dayN} of {e.days}, started {e.start}</p></div><span className="rounded-full px-2.5 py-0.5 text-xs font-extrabold" style={{ background: C.duckSoft, color: C.duckDeep }}>Trying</span></div>
        {s && <ul className="mt-2 space-y-1">{s.how.map((h) => <li key={h} className="text-[13px]">• {h}</li>)}</ul>}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">{[["In potty", pct(c.b.rate), pct(c.d.rate)], ["Self-started", pct(c.b.selfRate), pct(c.d.selfRate)], ["Accidents/day", (c.b.accidents / Math.max(1, c.b.days.length)).toFixed(1), (c.d.accidents / Math.max(1, c.n)).toFixed(1)]].map(([l, b, d]) => <div key={l} className="rounded-2xl p-2" style={{ background: C.ground }}><p className="text-[11px] font-bold" style={{ color: C.muted }}>{l}</p><p className="text-sm"><span style={{ color: C.muted }}>{b}</span> → <b>{d}</b></p></div>)}</div>
        <p className="mt-1 text-[11px]" style={{ color: C.muted }}>Before → during, from your log.</p>
        <textarea rows={2} value={e.notes} onChange={(ev) => put({ ...e, notes: ev.target.value.slice(0, 600) })} placeholder="Notes: how is it going?" className={`${field} mt-3 h-auto py-2`} style={fieldStyle} aria-label="Notes" />
        <div className="mt-3 flex flex-wrap gap-1.5">{(["worked", "partly", "didnt", "stopped"] as const).map((st) => <Btn2 key={st} kind={st === "worked" ? "duck" : "plain"} onClick={() => put({ ...e, status: st, ended: dayOf(Date.now()) })}>{STATUS[st].label}</Btn2>)}</div>
      </Panel>; })}</div>
    </Section>}

    {detail ? <Section title={detail.title} action={<Btn2 kind="ghost" onClick={() => setOpen("")}>All strategies</Btn2>}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel><p className="text-[15px] leading-relaxed">{detail.why}</p><p className="mb-2 mt-4 text-[13px] font-bold" style={{ color: C.muted }}>How</p><ol className="space-y-2">{detail.how.map((h, i) => <li key={h} className="flex gap-3 text-[15px]"><span className="font-extrabold" style={{ color: C.duckDeep }}>{i + 1}</span>{h}</li>)}</ol>
          <div className="mt-4 flex flex-wrap gap-1.5">{detail.problems.map((p) => <span key={p} className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: C.ground }}>{PROBLEMS.find((x) => x.id === p)?.emoji} {PROBLEMS.find((x) => x.id === p)?.label}</span>)}</div></Panel>
        <Panel tone="soft"><p className="text-[13px] font-bold" style={{ color: C.muted }}>Evidence</p><p className="ph text-lg font-extrabold">{EVIDENCE[detail.evidence].label}</p><p className="text-sm">{EVIDENCE[detail.evidence].text}</p>
          <p className="mt-4 text-sm">Give it about <b>{detail.days} days</b> before judging.</p>
          {tried(detail.id) ? <Note tone="info">You tried this {tried(detail.id)!.start}: <b>{STATUS[tried(detail.id)!.status].label}</b>.</Note> : null}
          <Btn2 kind="duck" className="mt-3" onClick={() => { start(detail, detail.title, detail.days); setOpen(""); }}>Try this for {detail.days} days</Btn2></Panel>
      </div>
    </Section> : <Section title="What's the problem?" sub="Pick one to see what to try.">
      <div className="mb-5 flex flex-wrap gap-1.5"><Chip on={!problem} onClick={() => setProblem("")}>Everything</Chip>{PROBLEMS.map((p) => <Chip key={p.id} on={problem === p.id} onClick={() => setProblem(p.id)}>{p.emoji} {p.label}</Chip>)}</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map((s) => { const t = tried(s.id); return <button key={s.id} type="button" onClick={() => setOpen(s.id)} className="flex flex-col rounded-[20px] bg-white p-4 text-left transition hover:-translate-y-0.5" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>
        <div className="flex items-start justify-between gap-2"><p className="ph font-extrabold leading-snug">{s.title}</p>{t && <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white" style={{ background: STATUS[t.status].color }}>{STATUS[t.status].label}</span>}</div>
        <p className="mt-1 text-[13px] leading-snug" style={{ color: C.muted }}>{s.why}</p>
        <p className="mt-auto pt-2 text-[12px] font-bold" style={{ color: s.evidence === "research" ? C.good : s.evidence === "clinical" ? C.pee : C.duckDeep }}>{EVIDENCE[s.evidence].label} · {s.days} days</p></button>; })}</div>
    </Section>}

    <Section title="Your own idea" sub="Something a friend, a book or your gut suggested? Run it as an experiment too.">
      <Panel className="flex flex-wrap items-end gap-3"><Label text="What will you try?" className="min-w-[240px] flex-1"><input value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 80))} placeholder="Potty right after the bus every day" className={field} style={fieldStyle} /></Label>
        <Label text="For how many days?"><input type="number" min={2} max={30} value={days} onChange={(e) => setDays(Math.max(2, Math.min(30, Number(e.target.value) || 7)))} className={`${field} !w-24`} style={fieldStyle} /></Label>
        <Btn2 kind="ink" disabled={!custom.trim()} onClick={() => { start(null, custom.trim(), days); setCustom(""); }}>Start</Btn2></Panel>
    </Section>

    {mine.filter((e) => e.status !== "trying").length > 0 ? <Section title="What you've tried" sub="Your own record of what works for this child.">
      <Panel pad={false}><ul>{mine.filter((e) => e.status !== "trying").map((e) => { const c = compare(e); return <li key={e.id} className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-0" style={{ borderColor: C.line }}>
        <span className="rounded-full px-2.5 py-0.5 text-xs font-extrabold text-white" style={{ background: STATUS[e.status].color }}>{STATUS[e.status].label}</span><span className="min-w-0 flex-1"><span className="block font-bold">{e.title}</span><span className="text-xs" style={{ color: C.muted }}>{e.start} · in potty {pct(c.b.rate)} → {pct(c.d.rate)}{e.notes ? ` · ${e.notes}` : ""}</span></span>
        <button type="button" onClick={() => set((d) => ({ ...d, experiments: d.experiments.filter((x) => x.id !== e.id) }))} className="text-xs font-bold underline" style={{ color: C.muted }}>Remove</button></li>; })}</ul></Panel>
    </Section> : !active.length && <Empty2 icon="🧪" title="Nothing tried yet" text="Pick a problem above, open a strategy and tap “Try this”. The app tracks the before and after for you." />}
  </div>;
}
