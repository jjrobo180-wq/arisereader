// Plan: where the child is on the ten-stage map, exactly what to do at this stage, whether the log
// says it's time to move on, what to try when it's stuck — plus the readiness check and methods.
import { useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { METHOD_LIST, READINESS, STAGES, articleById, dayOf, readinessVerdict, stageById, stageChecks, stageIndex, strategyById, videoById, ytThumb, type StageId } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Chip, Note, Panel, Section } from "./theme";

export default function Program() {
  const { data, set, kid, putKid, go, months, sub } = usePotty();
  const [view, setView] = useState<"stage" | "ready" | "methods">(sub === "ready" ? "ready" : sub === "methods" ? "methods" : "stage");
  const [look, setLook] = useState<StageId>(kid.stage);
  const stage = stageById(look); const cur = stageIndex(kid.stage);
  const done = data.done[kid.id] || [];
  const toggle = (key: string) => set((d) => { const l = d.done[kid.id] || []; return { ...d, done: { ...d.done, [kid.id]: l.includes(key) ? l.filter((x) => x !== key) : [...l, key] } }; });
  const ready = data.ready[kid.id] || [];
  const checks = stageChecks(look, data.logs, kid.id, ready.length);
  const today = dayOf(Date.now());
  const moveTo = (id: StageId) => { putKid({ ...kid, stage: id, start: kid.start || (stageIndex(id) >= 2 ? today : "") }); setLook(id); };
  const next = STAGES[stageIndex(look) + 1];
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-1.5"><Chip on={view === "stage"} onClick={() => setView("stage")}>Step-by-step plan</Chip><Chip on={view === "ready"} onClick={() => setView("ready")}>Readiness check</Chip><Chip on={view === "methods"} onClick={() => setView("methods")}>Methods</Chip></div>

    {view === "stage" && <>
      {/* The map */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1"><ol className="flex w-max gap-2">{STAGES.map((s, i) => { const on = s.id === look, mine = s.id === kid.stage, past = i < cur; return <li key={s.id}><button type="button" onClick={() => setLook(s.id)} aria-current={mine ? "step" : undefined} className="flex w-[118px] flex-col items-start rounded-2xl p-3 text-left transition" style={on ? { background: C.ink, color: "#fff" } : { background: "#fff", boxShadow: `inset 0 0 0 1.5px ${mine ? C.duck : C.line}` }}>
        <span className="flex w-full items-center justify-between"><span className="text-xl">{s.emoji}</span>{past ? <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px]" style={{ background: C.good, color: "#fff" }}>✓</span> : mine ? <span className="rounded-full px-1.5 text-[10px] font-extrabold" style={{ background: C.duck, color: C.ink }}>Now</span> : null}</span>
        <span className="ph mt-1.5 text-[13px] font-extrabold leading-tight">{s.title}</span><span className="mt-0.5 text-[11px] opacity-60">Stage {i + 1}</span></button></li>; })}</ol></div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Section title={<span className="text-2xl">{stage.emoji} {stage.title}</span>} sub={stage.summary}>
            <div className="grid gap-2 sm:grid-cols-2"><Note tone="info"><b>When:</b> {stage.when}</Note><Note tone="tip"><b>Goal:</b> {stage.goal}</Note></div>
          </Section>
          <Section title="Do this" sub="Tick steps off as you go. The why is under each one.">
            <Panel pad={false}><ol>{stage.steps.map((st, i) => { const key = `${stage.id}:${i}`, on = done.includes(key); return <li key={key} className="flex gap-3 border-b px-4 py-3 last:border-0" style={{ borderColor: C.line }}>
              <button type="button" onClick={() => toggle(key)} aria-pressed={on} aria-label={on ? "Mark not done" : "Mark done"} className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition" style={on ? { background: C.good, color: "#fff" } : { boxShadow: `inset 0 0 0 2px ${C.line}` }}>{on && <Check size={15} />}</button>
              <div className="min-w-0"><p className={`text-[15px] font-bold leading-snug ${on ? "line-through opacity-50" : ""}`}><span className="mr-1.5 tabular-nums" style={{ color: C.duckDeep }}>{i + 1}.</span>{st.t}</p>{st.why && <p className="mt-0.5 text-[13px] leading-snug" style={{ color: C.muted }}>{st.why}</p>}</div></li>; })}</ol></Panel>
          </Section>
          <Section title="When it isn't working" sub="Trial and error is normal. Try these in order; run one as an experiment in Try & learn to see if it helps.">
            <div className="space-y-2">{stage.stuck.map((s) => <details key={s.when} className="group rounded-2xl bg-white px-4 py-3" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}><summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-extrabold">{s.when}<ChevronDown size={16} className="transition group-open:rotate-180" /></summary><ul className="mt-2 space-y-1.5">{s.try.map((t) => <li key={t} className="flex gap-2 text-sm"><span style={{ color: C.duckDeep }}>→</span>{t}</li>)}</ul></details>)}</div>
            <Btn2 className="mt-3" onClick={() => go("try")}>See every strategy for this problem</Btn2>
          </Section>
        </div>
        <div className="space-y-6">
          {look === kid.stage ? <Section title="Ready to move on?" sub="Worked out from your log.">
            <Panel>{checks.map((c) => <div key={c.id} className="mb-2 flex items-center gap-3 last:mb-0"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm" style={{ background: c.met ? C.good : "#E8ECF4", color: c.met ? "#fff" : C.muted }}>{c.met ? "✓" : "…"}</span><span className="flex-1 text-sm font-bold">{c.text}</span><span className="text-xs" style={{ color: C.muted }}>{c.detail}</span></div>)}
              {next && <div className="mt-4 border-t pt-4" style={{ borderColor: C.line }}>{checks.every((c) => c.met) ? <Note tone="tip">Your log says {kid.name} is ready for <b>{next.title}</b>.</Note> : <p className="text-sm" style={{ color: C.muted }}>You can move on whenever you feel ready — the checks are a guide, not a rule.</p>}<Btn2 kind={checks.every((c) => c.met) ? "duck" : "plain"} className="mt-3" onClick={() => moveTo(next.id)}>Move to {next.emoji} {next.title}</Btn2></div>}
              {stageIndex(look) > 0 && <button type="button" onClick={() => moveTo(STAGES[stageIndex(look) - 1].id)} className="mt-3 block text-xs font-bold underline" style={{ color: C.muted }}>Go back a stage (it's fine — setbacks happen)</button>}
            </Panel></Section>
            : <Panel tone="soft"><p className="text-sm">{kid.name} is at <b>{stageById(kid.stage).title}</b>. You're previewing a {stageIndex(look) < cur ? "past" : "later"} stage.</p><Btn2 className="mt-3" onClick={() => moveTo(look)}>Make this {kid.name}'s stage</Btn2></Panel>}
          <Section title="Every day at this stage">
            <Panel>{stage.daily.map((d, i) => { const key = `daily:${today}:${stage.id}:${i}`, on = done.includes(key); return <label key={key} className="flex cursor-pointer items-center gap-3 py-1.5"><input type="checkbox" checked={on} onChange={() => toggle(key)} className="h-5 w-5" style={{ accentColor: C.good }} /><span className={`text-sm font-bold ${on ? "line-through opacity-50" : ""}`}>{d}</span></label>; })}<p className="mt-2 text-xs" style={{ color: C.muted }}>Resets every day.</p></Panel>
          </Section>
          <Section title="Avoid"><ul className="space-y-1.5">{stage.avoid.map((a) => <li key={a} className="flex gap-2 text-sm"><span style={{ color: C.accident }}>✕</span>{a}</li>)}</ul></Section>
          <Section title="Read and watch">
            <div className="space-y-2">{stage.articles.map((id) => { const a = articleById(id); return a ? <button key={id} type="button" onClick={() => go("learn", `a:${id}`)} className="flex w-full items-center gap-3 rounded-2xl bg-white px-3 py-2.5 text-left" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}><span className="text-lg">📖</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-snug">{a.title}</span><span className="text-xs" style={{ color: C.muted }}>{a.minutes} min read</span></span><ChevronRight size={16} /></button> : null; })}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">{stage.videos.slice(0, 4).map((id) => { const v = videoById(id); return v ? <button key={id} type="button" onClick={() => go("videos", `v:${id}`)} className="overflow-hidden rounded-2xl bg-white text-left" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}><img src={ytThumb(v.playlist ? "QeDuo3ZjVl4" : v.yt)} alt="" loading="lazy" className="aspect-video w-full object-cover" /><span className="block p-2 text-xs font-bold leading-tight">{v.title}</span></button> : null; })}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">{stage.strategies.slice(0, 6).map((id) => { const s = strategyById(id); return s ? <Chip key={id} onClick={() => go("try", `s:${id}`)}>💡 {s.title}</Chip> : null; })}</div>
          </Section>
        </div>
      </div>
    </>}

    {view === "ready" && (() => { const v = readinessVerdict(ready.length, months); return <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Section title={`Is ${kid.name} ready?`} sub="Tick what's true most days. Readiness depends on skills, not age (Mayo Clinic).">
        <div className="space-y-2">{READINESS.map((r) => { const on = ready.includes(r.id); return <label key={r.id} className="flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 transition" style={on ? { background: "#E6F6EE" } : { background: "#fff", boxShadow: `inset 0 0 0 1.5px ${C.line}` }}><input type="checkbox" checked={on} onChange={() => set((d) => ({ ...d, ready: { ...d.ready, [kid.id]: on ? ready.filter((x) => x !== r.id) : [...ready, r.id] } }))} className="mt-0.5 h-5 w-5" style={{ accentColor: C.good }} /><span><span className="block text-[15px] font-bold">{r.sign}</span><span className="text-[13px]" style={{ color: C.muted }}>{r.why}</span></span></label>; })}</div>
      </Section>
      <div className="space-y-4"><Panel tone={v.tone === "go" ? undefined : "soft"}><p className="ph text-4xl font-extrabold" style={{ color: v.tone === "go" ? C.good : C.ink }}>{ready.length}<span className="text-xl" style={{ color: C.muted }}> / 10</span></p><p className="ph mt-1 text-xl font-extrabold">{v.title}</p><p className="mt-1 text-sm" style={{ color: C.inkSoft }}>{v.text}</p>
        {v.tone === "go" && kid.stage === "ready" && <Btn2 kind="duck" className="mt-3" onClick={() => { moveTo("sits"); setView("stage"); }}>Start practice sits</Btn2>}</Panel>
        {kid.needs.length > 0 && <Note tone="info">ERIC notes that many children with additional needs never show classic readiness signs. Don't wait for all ten — start the groundwork and practice sits, and use the Additional needs tab.</Note>}
        <Note tone="tip">Mayo Clinic: talk to the doctor if your child is over 2½ with no interest, or over 3 and not trained in the day.</Note></div>
    </div>; })()}

    {view === "methods" && <Section title="Methods" sub="Pick the one that fits your child and your week. Consistency matters more than which you choose.">
      <div className="grid gap-4 lg:grid-cols-2">{METHOD_LIST.map((m) => { const mine = m.id === kid.method; return <Panel key={m.id} tone={mine ? "duck" : undefined}>
        <div className="flex items-start justify-between gap-2"><div><h3 className="text-lg font-extrabold">{m.name}</h3><p className="text-xs font-bold" style={{ color: C.muted }}>{m.also}</p></div>{mine ? <span className="rounded-full px-2.5 py-1 text-xs font-extrabold" style={{ background: C.ink, color: "#fff" }}>{kid.name}'s method</span> : <Btn2 onClick={() => putKid({ ...kid, method: m.id })}>Use this</Btn2>}</div>
        <p className="mt-2 text-sm">{m.summary}</p>
        <p className="mt-2 text-[13px]"><b>Best for:</b> {m.bestFor}</p>
        <p className="mt-1 text-[13px]" style={{ color: C.inkSoft }}><b>Evidence:</b> {m.evidence}</p>
        <ol className="mt-3 space-y-1">{m.how.map((h, i) => <li key={h} className="flex gap-2 text-[13px]"><span className="font-extrabold" style={{ color: C.duckDeep }}>{i + 1}</span>{h}</li>)}</ol>
      </Panel>; })}</div>
    </Section>}
  </div>;
}
