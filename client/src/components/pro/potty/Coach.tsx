// AI coach: ask anything. The coach sees the child's age, stage, method, additional needs,
// routine and a summary of the log (never other children's data), and answers with steps, things
// to try next, and a clear note when it's time to call the doctor.
import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { askAppAi } from "@/lib/cloudDocs";
import { uid } from "../kit";
import { NEEDS, STRATEGIES, contextFor, healthFlags, methodById, stageById, type ChatMsg } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Chip, Note, Panel, field, fieldStyle } from "./theme";

type Reply = { answer?: string; steps?: string[]; tryNext?: string[]; doctor?: string };

function suggestions(stage: string, needs: string[], flagged: string[], name: string): string[] {
  const out = [
    ...flagged.map((f) => `The app flagged "${f}". What should I do?`),
    stage === "ready" ? `Is ${name} ready to start, and how should we begin?` : "",
    stage === "launch" ? `It's our first week and there are lots of accidents. What should I change?` : "",
    stage === "poop" ? `${name} pees on the potty but won't poop there. What do I do?` : "",
    stage === "nights" ? `How do I help ${name} stay dry at night?` : "",
    needs.includes("autism") ? `How do I adapt potty training for autism and sensory issues?` : "",
    needs.includes("speech") || needs.includes("down") ? `${name} can't tell me when they need to go. How do we train?` : "",
    `Look at our log. What patterns do you see, and when should we sit?`,
    `${name} refuses to sit on the potty. What should I try?`,
    `How do I handle daycare so it matches home?`,
    `${name} was doing great and now has accidents again. Why?`,
  ];
  return out.filter(Boolean).slice(0, 6);
}

export default function Coach() {
  const { data, set, kid, token, go } = usePotty();
  const msgs = data.chats[kid.id] || [];
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [showCtx, setShowCtx] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, busy]);
  const stage = stageById(kid.stage);
  const context = contextFor(kid, data.logs, { readiness: (data.ready[kid.id] || []).length, stageTitle: stage.title, methodTitle: methodById(kid.method).name, needLabels: kid.needs.map((n) => NEEDS.find((x) => x.id === n)?.label || n) });
  const flags = healthFlags(data.logs, kid.id).filter((f) => f.level !== "info").map((f) => f.title);
  const push = (m: ChatMsg) => set((d) => ({ ...d, chats: { ...d.chats, [kid.id]: [...(d.chats[kid.id] || []), m].slice(-80) } }));
  const ask = async (question: string) => {
    const text = question.trim(); if (!text || busy) return;
    setErr(""); setQ(""); push({ id: uid(), role: "me", text, at: Date.now() }); setBusy(true);
    const history = msgs.slice(-8).map((m) => `${m.role === "me" ? "Parent" : "Coach"}: ${m.text.slice(0, 600)}`).join("\n");
    try {
      const r = await askAppAi<Reply>(token, "potty-coach", { question: text, text: context, notes: history });
      push({ id: uid(), role: "coach", text: String(r.answer || "I couldn't put an answer together — try asking another way."), steps: Array.isArray(r.steps) ? r.steps.map(String).slice(0, 8) : [], tryNext: Array.isArray(r.tryNext) ? r.tryNext.map(String).slice(0, 4) : [], doctor: r.doctor ? String(r.doctor) : "", at: Date.now() });
    } catch (e: any) { setErr(e?.message || "The coach couldn't answer right now. Try again in a moment."); }
    finally { setBusy(false); }
  };
  const findStrategy = (name: string) => STRATEGIES.find((s) => s.title.toLowerCase().includes(name.toLowerCase().slice(0, 18)) || name.toLowerCase().includes(s.title.toLowerCase().slice(0, 18)));
  return <div className="mx-auto max-w-3xl space-y-5">
    <Panel tone="night"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-extrabold">Ask the coach</h2><p className="mt-1 text-sm text-white/70">Anything about {kid.name}'s potty training. The coach knows {kid.name}'s age, stage, needs, routine and log, and answers from pediatric guidance.</p></div>
      <button type="button" onClick={() => setShowCtx(!showCtx)} className="text-[13px] font-bold underline" style={{ color: C.duck }}>{showCtx ? "Hide" : "See"} what the coach knows</button></div>
      {showCtx && <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-white/[.07] p-3 text-[12px] leading-relaxed text-white/80">{context}</pre>}
    </Panel>
    {!msgs.length && <div><p className="mb-2 text-[13px] font-bold" style={{ color: C.muted }}>Try asking</p><div className="flex flex-wrap gap-2">{suggestions(kid.stage, kid.needs, flags, kid.name).map((s) => <button key={s} type="button" onClick={() => void ask(s)} className="rounded-2xl bg-white px-3.5 py-2.5 text-left text-sm font-bold transition hover:-translate-y-0.5" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>{s}</button>)}</div></div>}
    <div className="space-y-4">{msgs.map((m) => m.role === "me"
      ? <div key={m.id} className="flex justify-end"><p className="max-w-[85%] rounded-[22px] rounded-br-md px-4 py-2.5 text-[15px]" style={{ background: C.ink, color: "#fff" }}>{m.text}</p></div>
      : <div key={m.id} className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: C.duck }}>🦆</span>
        <div className="min-w-0 flex-1 space-y-3 rounded-[22px] rounded-tl-md bg-white px-4 py-3.5" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>
          {m.text.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-wrap text-[15px] leading-relaxed">{p}</p>)}
          {!!m.steps?.length && <div><p className="mb-1 text-[13px] font-bold" style={{ color: C.muted }}>Steps</p><ol className="space-y-1.5">{m.steps.map((s, i) => <li key={i} className="flex gap-2 text-[14px]"><span className="font-extrabold tabular-nums" style={{ color: C.duckDeep }}>{i + 1}.</span>{s}</li>)}</ol></div>}
          {!!m.tryNext?.length && <div className="flex flex-wrap gap-1.5">{m.tryNext.map((t) => { const s = findStrategy(t); return <Chip key={t} onClick={() => go("try", s ? `s:${s.id}` : "")}>💡 {t}</Chip>; })}</div>}
          {m.doctor && <Note tone="doctor"><b>Talk to the doctor:</b> {m.doctor}</Note>}
        </div></div>)}
      {busy && <div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: C.duck }}>🦆</span><p className="pt-pulse rounded-[22px] bg-white px-4 py-3 text-sm" style={{ color: C.muted, boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>Looking at {kid.name}'s log and thinking…</p></div>}
      <div ref={end} />
    </div>
    {err && <Note tone="warn">{err}</Note>}
    <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} className="sticky bottom-3 flex items-end gap-2 rounded-[26px] bg-white p-2" style={{ boxShadow: `0 10px 30px -12px #1F254455, inset 0 0 0 1.5px ${C.line}` }}>
      <textarea value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(q); } }} rows={1} placeholder={`Ask about ${kid.name}…`} className={`${field} min-h-11 flex-1 resize-none border-0 !ring-0`} style={fieldStyle} aria-label="Your question" maxLength={1400} />
      <Btn2 kind="duck" type="submit" disabled={!q.trim() || busy} title="Send"><Send size={16} /></Btn2>
    </form>
    <div className="flex items-center justify-between gap-2"><p className="text-xs" style={{ color: C.muted }}>General guidance, not medical advice. For pain, blood, fever or anything worrying, call your child's doctor.</p>{msgs.length > 0 && <Btn2 kind="ghost" onClick={() => { if (window.confirm("Clear this conversation?")) set((d) => ({ ...d, chats: { ...d.chats, [kid.id]: [] } })); }}><Trash2 size={14} />Clear</Btn2>}</div>
  </div>;
}
