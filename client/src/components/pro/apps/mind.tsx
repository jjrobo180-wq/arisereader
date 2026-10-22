// Mind & wellbeing apps: breathing, mood, gratitude, a journal with AI reflection, a CBT thought
// record, worry time, a meditation timer, a calm corner for kids, affirmation cards, calm sounds,
// self-care bingo and a kindness challenge.
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Heart, Pause, Play, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { askAppAi } from "@/lib/cloudDocs";
import { SequencePlayer } from "../Sequence";
import { Btn, Card, Chart, Empty, Field, Heatmap, Modal, Stat, Tabs, addDays, audio, bell, fmtDay, fmtDuration, fmtTime, fit, inputCls, lastDays, nowTime, randInt, shuffle, streak, today, uid, usePro, useTick, useWakeLock, vibrate } from "../kit";

const PURPLE = "#7c3aed";

// ─── Breathing ───
const PATTERNS: { id: string; name: string; why: string; phases: [string, number][] }[] = [
  { id: "box", name: "Box breathing", why: "Steadies you before something stressful. Used by athletes and pilots.", phases: [["Breathe in", 4], ["Hold", 4], ["Breathe out", 4], ["Hold", 4]] },
  { id: "478", name: "4-7-8", why: "Slows everything down — good for falling asleep.", phases: [["Breathe in", 4], ["Hold", 7], ["Breathe out", 8]] },
  { id: "coherent", name: "Coherent breathing", why: "Five breaths a minute, the calmest rhythm for your heart.", phases: [["Breathe in", 6], ["Breathe out", 6]] },
  { id: "sigh", name: "Physiological sigh", why: "The fastest way to calm down: two quick breaths in, one long out.", phases: [["Breathe in", 2], ["A little more in", 1], ["Long breath out", 6]] },
  { id: "kids", name: "Balloon breaths (kids)", why: "Fill your tummy like a balloon, then let it float away.", phases: [["Fill the balloon", 3], ["Hold it", 2], ["Let it float away", 4]] },
];
function Breathe() {
  const { data, setData } = usePro<{ log: Record<string, number> }>("breathe", { log: {} });
  const [pat, setPat] = useState(PATTERNS[0]);
  const [mins, setMins] = useState(2);
  const [run, setRun] = useState<number | null>(null);
  useTick(run !== null, 50); useWakeLock(run !== null);
  const cycle = pat.phases.reduce((a, p) => a + p[1], 0);
  const elapsed = run !== null ? (Date.now() - run) / 1000 : 0;
  const t = elapsed % cycle;
  let acc = 0, phase = pat.phases[0], into = 0;
  for (const ph of pat.phases) { if (t < acc + ph[1]) { phase = ph; into = t - acc; break; } acc += ph[1]; }
  const isIn = /in|fill/i.test(phase[0]) && !/out/i.test(phase[0]), isOut = /out|away/i.test(phase[0]);
  const prevScale = useRef(0.45);
  const scale = isIn ? 0.45 + 0.55 * (into / phase[1]) : isOut ? 1 - 0.55 * (into / phase[1]) : prevScale.current;
  prevScale.current = scale;
  const lastPhase = useRef("");
  useEffect(() => { if (run === null) return; const key = `${Math.floor(elapsed / cycle)}-${phase[0]}`; if (key !== lastPhase.current) { lastPhase.current = key; vibrate(30); } });
  useEffect(() => { if (run !== null && elapsed >= mins * 60) { setRun(null); bell(); setData((d) => ({ log: { ...d.log, [today()]: (d.log[today()] || 0) + 1 } })); } });
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">{PATTERNS.map((p) => <button key={p.id} type="button" onClick={() => { setPat(p); setRun(null); }} className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${pat.id === p.id ? "bg-cyan-600 text-white ring-cyan-600" : "bg-white ring-slate-200"}`}>{p.name}</button>)}</div>
    <Card className="flex flex-col items-center gap-4 py-8" tint="linear-gradient(180deg,#ecfeff,#fff)">
      <div className="relative flex h-64 w-64 items-center justify-center">
        <div className="absolute rounded-full bg-cyan-400/30" style={{ width: 256 * scale, height: 256 * scale, transition: "width .06s linear, height .06s linear" }} />
        <div className="absolute rounded-full bg-cyan-500/80 shadow-lg" style={{ width: 200 * scale, height: 200 * scale, transition: "width .06s linear, height .06s linear" }} />
        <div className="relative text-center text-white drop-shadow"><p className="text-xl font-black">{run !== null ? phase[0] : "Ready"}</p>{run !== null && <p className="text-4xl font-black">{Math.ceil(phase[1] - into)}</p>}</div>
      </div>
      <p className="max-w-md text-center text-sm text-slate-600">{pat.why}</p>
      <div className="flex items-center gap-3">{run === null ? <><select value={mins} onChange={(e) => setMins(Number(e.target.value))} className={`${fit("w-28")}`}>{[1, 2, 3, 5, 10].map((m) => <option key={m} value={m}>{m} min</option>)}</select><Btn kind="primary" color="#0891b2" big onClick={() => { audio(); setRun(Date.now()); }}><Play size={18} />Start</Btn></> : <><span className="font-mono text-sm text-slate-500">{fmtDuration(mins * 60 - elapsed)} left</span><Btn onClick={() => setRun(null)}><Pause size={16} />Stop</Btn></>}</div>
    </Card>
    <div className="grid grid-cols-3 gap-2"><Stat label="Today" value={data.log[today()] || 0} sub="sessions" color="#0891b2" /><Stat label="This week" value={lastDays(7).reduce((a, d) => a + (data.log[d] || 0), 0)} /><Stat label="Streak" value={`${streak((d) => !!data.log[d])} days`} /></div>
  </div>;
}

// ─── Mood ───
const MOODS = [{ e: "😢", l: "Awful", c: "#ef4444" }, { e: "😕", l: "Bad", c: "#f97316" }, { e: "😐", l: "Okay", c: "#eab308" }, { e: "🙂", l: "Good", c: "#84cc16" }, { e: "😄", l: "Great", c: "#22c55e" }];
const MOOD_TAGS = ["Slept well", "Tired", "Exercise", "Outside", "Friends", "Family", "Work", "School", "Stress", "Anxious", "Sick", "Productive", "Creative", "Lonely", "Grateful", "Screen time"];
type MoodE = { id: string; date: string; time: string; mood: number; tags: string[]; note: string };
function Mood() {
  const { data, setData } = usePro<{ entries: MoodE[] }>("mood", { entries: [] });
  const [pick, setPick] = useState<number | null>(null); const [tags, setTags] = useState<string[]>([]); const [note, setNote] = useState("");
  const byDay = useMemo(() => { const m: Record<string, number[]> = {}; for (const e of data.entries) (m[e.date] ||= []).push(e.mood); return m; }, [data.entries]);
  const avg = (d: string) => (byDay[d] ? byDay[d].reduce((a, b) => a + b, 0) / byDay[d].length : null);
  const days = lastDays(30);
  const insights = useMemo(() => {
    const out: { tag: string; diff: number; n: number }[] = [];
    const all = data.entries; if (all.length < 5) return out;
    const base = all.reduce((a, e) => a + e.mood, 0) / all.length;
    for (const t of MOOD_TAGS) { const w = all.filter((e) => e.tags.includes(t)); if (w.length >= 2) out.push({ tag: t, diff: w.reduce((a, e) => a + e.mood, 0) / w.length - base, n: w.length }); }
    return out.sort((a, b) => b.diff - a.diff);
  }, [data.entries]);
  const save = () => { if (pick === null) return; setData((d) => ({ entries: [{ id: uid(), date: today(), time: nowTime(), mood: pick, tags, note }, ...d.entries].slice(0, 5000) })); setPick(null); setTags([]); setNote(""); };
  return <div className="space-y-4">
    <Card title="How are you feeling?">
      <div className="flex justify-between gap-1">{MOODS.map((m, i) => <button key={i} type="button" onClick={() => setPick(i + 1)} className={`flex flex-1 flex-col items-center rounded-2xl py-3 transition ${pick === i + 1 ? "scale-105 ring-4" : "hover:bg-slate-50"}`} style={pick === i + 1 ? { background: `${m.c}22`, boxShadow: `0 0 0 3px ${m.c}` } : undefined}><span className="text-4xl sm:text-5xl">{m.e}</span><span className="mt-1 text-xs font-bold text-slate-600">{m.l}</span></button>)}</div>
      {pick !== null && <div className="mt-4 space-y-3"><div className="flex flex-wrap gap-1.5">{MOOD_TAGS.map((t) => <button key={t} type="button" onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${tags.includes(t) ? "bg-amber-500 text-white ring-amber-500" : "bg-white text-slate-600 ring-slate-200"}`}>{t}</button>)}</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything on your mind? (optional)" className={`${inputCls} h-auto py-2`} /><Btn kind="primary" color="#f59e0b" onClick={save}>Save check-in</Btn></div>}
    </Card>
    <Card title="Last 30 days">{data.entries.length ? <Chart kind="line" labels={days.filter((d) => avg(d) !== null).map((d) => fmtDay(d, { month: "numeric", day: "numeric" }))} series={[{ name: "Mood", values: days.map(avg).filter((v): v is number => v !== null).map((v) => Number(v.toFixed(2))) }]} colors={["#f59e0b"]} legend={false} height={180} /> : <Empty>Check in a few times to see your mood over time.</Empty>}</Card>
    <Card title="Mood calendar"><Heatmap values={Object.fromEntries(Object.keys(byDay).map((d) => [d, avg(d)!]))} color="#22c55e" max={5} label={(d, v) => `${fmtDay(d)}: ${v ? MOODS[Math.round(v) - 1].l : "no check-in"}`} /></Card>
    {insights.length > 0 && <Card title="What goes with your better days"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{insights.slice(0, 3).filter((x) => x.diff > 0.1).map((x) => <p key={x.tag} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm"><b>{x.tag}</b> — mood {x.diff.toFixed(1)} higher ({x.n} times)</p>)}{insights.slice(-3).filter((x) => x.diff < -0.1).map((x) => <p key={x.tag} className="rounded-xl bg-rose-50 px-3 py-2 text-sm"><b>{x.tag}</b> — mood {Math.abs(x.diff).toFixed(1)} lower ({x.n} times)</p>)}</div></Card>}
    {data.entries.length > 0 && <Card title="Recent"><ul className="divide-y divide-slate-100">{data.entries.slice(0, 15).map((e) => <li key={e.id} className="flex items-start gap-3 py-2"><span className="text-2xl">{MOODS[e.mood - 1]?.e}</span><span className="min-w-0 flex-1 text-sm"><span className="text-xs text-slate-500">{fmtDay(e.date)} · {fmtTime(e.time)}</span>{e.tags.length > 0 && <span className="block text-xs text-slate-600">{e.tags.join(" · ")}</span>}{e.note && <span className="block">{e.note}</span>}</span><button type="button" aria-label="Delete" onClick={() => setData((d) => ({ entries: d.entries.filter((x) => x.id !== e.id) }))} className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button></li>)}</ul></Card>}
    <p className="text-xs text-slate-500">If you're struggling, you don't have to handle it alone. In the US, call or text 988 any time.</p>
  </div>;
}

// ─── Gratitude ───
function Gratitude() {
  const { data, setData } = usePro<{ days: Record<string, string[]> }>("gratitude", { days: {} });
  const d0 = today();
  const [items, setItems] = useState<string[]>(() => data.days[d0] || ["", "", ""]);
  const [memory, setMemory] = useState<{ d: string; t: string } | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { if (data.days[d0]) setItems([...data.days[d0], "", "", ""].slice(0, Math.max(3, data.days[d0].length))); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d0, Object.keys(data.days).length]);
  const save = (list: string[]) => { setItems(list); setData((d) => ({ days: { ...d.days, [d0]: list.filter((x) => x.trim()) } })); };
  const all = Object.entries(data.days).flatMap(([d, l]) => l.map((t) => ({ d, t })));
  const run = streak((d) => (data.days[d] || []).length > 0);
  const prompts = ["Someone who helped you", "Something that made you laugh", "A small comfort", "Something you're looking forward to", "Something your body let you do", "A place you love"];
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2"><Stat label="Streak" value={`${run} 🔥`} color="#ec4899" /><Stat label="Good things saved" value={all.length} /><Stat label="Days" value={Object.keys(data.days).length} /></div>
    <Card title={`Three good things · ${fmtDay(d0)}`}>
      <div className="space-y-2">{items.map((t, i) => <div key={i} className="flex items-center gap-2"><span className="text-xl">{["🌸", "🌼", "🌻", "🌷", "🌺"][i % 5]}</span><input value={t} onChange={(e) => save(items.map((x, j) => (j === i ? e.target.value : x)))} placeholder={prompts[(i + new Date().getDate()) % prompts.length]} className={inputCls} /></div>)}</div>
      <Btn className="mt-2" onClick={() => setItems([...items, ""])}><Plus size={14} />One more</Btn>
    </Card>
    <Card title="A happy memory" right={<Btn kind="soft" color="#ec4899" disabled={!all.length} onClick={() => setMemory(all[randInt(all.length)])}><Heart size={15} />Show me one</Btn>}>{memory ? <p className="text-lg">“{memory.t}” <span className="text-sm text-slate-500">— {fmtDay(memory.d, { month: "long", day: "numeric", year: "numeric" })}</span></p> : <p className="text-sm text-slate-500">Tap the button on a hard day.</p>}</Card>
    <Card title="Look back" right={<div className="relative w-48"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={`${inputCls} h-9 pl-8`} /></div>}>
      {Object.entries(data.days).filter(([d]) => d !== d0).sort((a, b) => b[0].localeCompare(a[0])).filter(([, l]) => !q || l.some((t) => t.toLowerCase().includes(q.toLowerCase()))).slice(0, 60).map(([d, l]) => <div key={d} className="border-b border-slate-100 py-2"><p className="text-xs font-bold text-slate-500">{fmtDay(d)}</p><ul className="text-sm">{l.map((t, i) => <li key={i}>• {t}</li>)}</ul></div>)}
      {Object.keys(data.days).length <= 1 && <Empty>Past days will show here.</Empty>}
    </Card>
  </div>;
}

// ─── Journal ───
const PROMPTS = ["What's one thing that went well today, and why?", "What's taking up the most space in your head right now?", "Describe a moment today you'd like to remember.", "What would make tomorrow a little better?", "Who made a difference to you recently?", "What are you proud of this week?", "What's something you're avoiding? What's the smallest first step?", "If your best friend had your day, what would you tell them?", "What did you learn today — about anything?", "What do you need more of right now?", "Write about a place where you feel calm.", "What are three things you're looking forward to?"];
type JE = { id: string; date: string; prompt: string; text: string; mood: number; ai?: { reflection: string; question: string } };
function Journal() {
  const { token } = useAuth();
  const { data, setData } = usePro<{ entries: JE[] }>("journal", { entries: [] });
  const d0 = today();
  const todays = data.entries.find((e) => e.date === d0);
  const [cur, setCur] = useState<JE>(() => todays || { id: uid(), date: d0, prompt: PROMPTS[new Date().getDate() % PROMPTS.length], text: "", mood: 0 });
  const [view, setView] = useState<"write" | "past">("write");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [q, setQ] = useState("");
  const save = (e: JE) => { setCur(e); setData((d) => ({ entries: [e, ...d.entries.filter((x) => x.id !== e.id)].sort((a, b) => b.date.localeCompare(a.date)) })); };
  const reflect = async () => { setBusy(true); setErr(""); try { const r = await askAppAi<{ reflection: string; question: string }>(token, "journal-reflect", { text: cur.text.slice(0, 6000) }); save({ ...cur, ai: r }); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const words = cur.text.trim() ? cur.text.trim().split(/\s+/).length : 0;
  return <div className="space-y-4">
    <Tabs value={view} onChange={setView} color={PURPLE} items={[{ id: "write", label: "Today" }, { id: "past", label: `Past entries (${data.entries.length})` }]} />
    {view === "write" ? <Card>
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-violet-700">{fmtDay(d0, { weekday: "long", month: "long", day: "numeric" })}</p><div className="flex gap-1">{MOODS.map((m, i) => <button key={i} type="button" onClick={() => save({ ...cur, mood: i + 1 })} className={`rounded-lg px-1.5 text-2xl ${cur.mood === i + 1 ? "bg-violet-100" : "opacity-60"}`} aria-label={m.l}>{m.e}</button>)}</div></div>
      <div className="mt-2 flex items-start gap-2 rounded-xl bg-violet-50 p-3"><p className="flex-1 text-base font-semibold text-violet-900">{cur.prompt}</p><button type="button" onClick={() => save({ ...cur, prompt: PROMPTS[randInt(PROMPTS.length)] })} className="text-xs font-bold text-violet-700">New prompt</button></div>
      <textarea value={cur.text} onChange={(e) => save({ ...cur, text: e.target.value })} rows={12} placeholder="Start writing…" className="mt-3 w-full resize-y rounded-xl border border-slate-200 p-3 text-[15px] leading-relaxed focus:border-violet-400 focus:outline-none" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">{words} words · saved</span><Btn kind="soft" color={PURPLE} disabled={busy || words < 15} onClick={() => void reflect()}><Sparkles size={15} />{busy ? "Reading…" : "Gentle reflection"}</Btn></div>
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      {cur.ai && <div className="mt-3 rounded-xl bg-violet-50 p-3 text-sm ring-1 ring-violet-200"><p>{cur.ai.reflection}</p><p className="mt-2 font-semibold text-violet-900">{cur.ai.question}</p></div>}
    </Card> : <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your journal" className={inputCls} />
      {data.entries.filter((e) => !q || e.text.toLowerCase().includes(q.toLowerCase())).map((e) => <Card key={e.id}><p className="text-xs font-bold text-slate-500">{fmtDay(e.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} {e.mood ? MOODS[e.mood - 1].e : ""}</p><p className="mt-1 text-sm font-semibold text-violet-800">{e.prompt}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{e.text}</p><button type="button" onClick={() => { if (window.confirm("Delete this entry?")) setData((d) => ({ entries: d.entries.filter((x) => x.id !== e.id) })); }} className="mt-2 text-xs font-bold text-slate-400 hover:text-rose-600">Delete</button></Card>)}
      {!data.entries.length && <Empty>Your entries will be here.</Empty>}
    </>}
    <p className="text-xs text-slate-500">Private to your account. If you're in crisis, call or text 988 (US).</p>
  </div>;
}

// ─── Thought record ───
const DISTORTIONS = ["All-or-nothing thinking", "Catastrophizing", "Mind reading", "Fortune telling", "Should statements", "Labeling", "Overgeneralizing", "Discounting the positive", "Emotional reasoning", "Personalizing"];
type TR = { id: string; date: string; situation: string; thought: string; feelings: string; before: number; traps: string[]; forT: string; against: string; balanced: string; after: number };
function Thoughts() {
  const { token } = useAuth();
  const { data, setData } = usePro<{ records: TR[] }>("thoughts", { records: [] });
  const blank = (): TR => ({ id: uid(), date: today(), situation: "", thought: "", feelings: "", before: 70, traps: [], forT: "", against: "", balanced: "", after: 40 });
  const [r, setR] = useState<TR | null>(null);
  const [ideas, setIdeas] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const steps: [keyof TR, string, string][] = [["situation", "1. What happened?", "Where were you, who was there, what happened?"], ["thought", "2. What went through your mind?", "The thought that hurt most, in your own words."], ["feelings", "3. What did you feel?", "Anxious, sad, angry, embarrassed…"], ["forT", "5. Evidence the thought is true", "Facts, not feelings."], ["against", "6. Evidence it isn't the whole story", "What would you tell a friend? Has it gone differently before?"], ["balanced", "7. A more balanced thought", "Something kinder and more accurate."]];
  const getIdeas = async () => { if (!r) return; setBusy(true); try { const x = await askAppAi<{ reframes: string[] }>(token, "thought-reframe", { situation: r.situation, thought: r.thought }); setIdeas(x.reframes || []); } catch (e: any) { setIdeas([e.message]); } finally { setBusy(false); } };
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color="#8b5cf6" onClick={() => { setR(blank()); setIdeas([]); }}><Plus size={16} />New thought record</Btn></div>
    {data.records.length ? data.records.map((x) => <Card key={x.id}><button type="button" onClick={() => { setR(x); setIdeas([]); }} className="w-full text-left"><p className="text-xs text-slate-500">{fmtDay(x.date)}</p><p className="font-bold">“{x.thought}”</p><p className="text-sm text-violet-800">→ {x.balanced || "…"}</p><p className="mt-1 text-xs text-slate-500">Feeling {x.before}% → {x.after}%</p></button></Card>) : <Empty>When a thought is getting you down, fill in a thought record. It helps you see it from all sides.</Empty>}
    {r && <Modal title="Thought record" wide onClose={() => setR(null)} footer={<>{data.records.some((x) => x.id === r.id) && <Btn kind="danger" onClick={() => { setData((d) => ({ records: d.records.filter((x) => x.id !== r.id) })); setR(null); }}>Delete</Btn>}<Btn kind="primary" color="#8b5cf6" onClick={() => { setData((d) => ({ records: [r, ...d.records.filter((x) => x.id !== r.id)] })); setR(null); }}>Save</Btn></>}>
      <div className="space-y-3">
        {steps.slice(0, 3).map(([k, l, ph]) => <Field key={k} label={l}><textarea value={r[k] as string} onChange={(e) => setR({ ...r, [k]: e.target.value })} placeholder={ph} rows={2} className={`${inputCls} h-auto py-2`} /></Field>)}
        <Field label={`How strong is the feeling? ${r.before}%`}><input type="range" min={0} max={100} value={r.before} onChange={(e) => setR({ ...r, before: Number(e.target.value) })} className="w-full" /></Field>
        <div><p className="mb-1 text-xs font-bold text-slate-600">4. Any thinking traps?</p><div className="flex flex-wrap gap-1.5">{DISTORTIONS.map((t) => <button key={t} type="button" onClick={() => setR({ ...r, traps: r.traps.includes(t) ? r.traps.filter((x) => x !== t) : [...r.traps, t] })} className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${r.traps.includes(t) ? "bg-violet-600 text-white ring-violet-600" : "bg-white ring-slate-200"}`}>{t}</button>)}</div></div>
        {steps.slice(3).map(([k, l, ph]) => <Field key={k} label={l}><textarea value={r[k] as string} onChange={(e) => setR({ ...r, [k]: e.target.value })} placeholder={ph} rows={2} className={`${inputCls} h-auto py-2`} /></Field>)}
        <Btn kind="soft" color={PURPLE} disabled={busy || !r.thought.trim()} onClick={() => void getIdeas()}><Sparkles size={15} />{busy ? "Thinking…" : "Ideas for a balanced thought"}</Btn>
        {ideas.length > 0 && <ul className="space-y-1">{ideas.map((x, i) => <li key={i}><button type="button" onClick={() => setR({ ...r, balanced: x })} className="w-full rounded-lg bg-violet-50 px-3 py-2 text-left text-sm hover:bg-violet-100">{x}</button></li>)}</ul>}
        <Field label={`8. How strong is the feeling now? ${r.after}%`}><input type="range" min={0} max={100} value={r.after} onChange={(e) => setR({ ...r, after: Number(e.target.value) })} className="w-full" /></Field>
      </div>
    </Modal>}
    <p className="text-xs text-slate-500">A self-help tool, not therapy. If you're in crisis, call or text 988 (US).</p>
  </div>;
}

// ─── Worry time ───
type Worry = { id: string; date: string; text: string; status: "parked" | "act" | "letgo"; step: string; happened?: boolean };
function WorryTime() {
  const { data, setData } = usePro<{ worries: Worry[]; time: string }>("worry", { worries: [], time: "17:00" });
  const [text, setText] = useState("");
  const parked = data.worries.filter((w) => w.status === "parked");
  const nowM = new Date().getHours() * 60 + new Date().getMinutes(); const [h, m] = data.time.split(":").map(Number);
  const isTime = nowM >= h * 60 + m && nowM <= h * 60 + m + 15;
  const upd = (id: string, p: Partial<Worry>) => setData((d) => ({ ...d, worries: d.worries.map((w) => (w.id === id ? { ...w, ...p } : w)) }));
  const decided = data.worries.filter((w) => w.status !== "parked" && w.happened !== undefined);
  return <div className="space-y-4">
    <Card title="Park a worry"><p className="mb-2 text-sm text-slate-600">Write it down so your brain can let go of it for now. You'll look at it during worry time.</p><div className="flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { setData((d) => ({ ...d, worries: [{ id: uid(), date: today(), text: text.trim(), status: "parked", step: "" }, ...d.worries] })); setText(""); } }} placeholder="I'm worried that…" className={inputCls} /><Btn kind="primary" color="#64748b" disabled={!text.trim()} onClick={() => { setData((d) => ({ ...d, worries: [{ id: uid(), date: today(), text: text.trim(), status: "parked", step: "" }, ...d.worries] })); setText(""); }}>Park it</Btn></div></Card>
    <Card title={`Worry time ${isTime ? "is now" : `at ${fmtTime(data.time)}`}`} right={<input type="time" value={data.time} onChange={(e) => setData((d) => ({ ...d, time: e.target.value }))} className="h-9 rounded-lg border border-slate-300 px-2 text-sm" />}>
      {parked.length ? <ul className="space-y-2">{parked.map((w) => <li key={w.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"><p className="font-semibold">{w.text}</p><p className="text-xs text-slate-500">{fmtDay(w.date)}</p>
        <div className="mt-2 flex flex-wrap gap-2"><Btn kind="soft" color="#2563eb" onClick={() => { const s = window.prompt("What's one small step you can take?"); upd(w.id, { status: "act", step: s || "" }); }}>I can do something</Btn><Btn kind="soft" color="#16a34a" onClick={() => upd(w.id, { status: "letgo" })}>Let it go 🎈</Btn></div></li>)}</ul> : <Empty>No parked worries. 🌤️</Empty>}
    </Card>
    {data.worries.some((w) => w.status !== "parked") && <Card title="Looking back"><p className="mb-2 text-xs text-slate-500">Did the worry come true? Most don't.</p><ul className="divide-y divide-slate-100">{data.worries.filter((w) => w.status !== "parked").slice(0, 30).map((w) => <li key={w.id} className="flex items-center gap-2 py-2 text-sm"><span className="flex-1">{w.status === "act" ? "✅" : "🎈"} {w.text}{w.step && <span className="block text-xs text-blue-700">Step: {w.step}</span>}</span><select value={w.happened === undefined ? "" : w.happened ? "y" : "n"} onChange={(e) => upd(w.id, { happened: e.target.value === "" ? undefined : e.target.value === "y" })} className="h-8 rounded border border-slate-300 text-xs"><option value="">Came true?</option><option value="n">No</option><option value="y">Yes</option></select></li>)}</ul>
      {decided.length > 0 && <p className="mt-2 text-sm font-bold text-emerald-700">{Math.round((decided.filter((w) => !w.happened).length / decided.length) * 100)}% of your worries didn't happen.</p>}</Card>}
  </div>;
}

// ─── Meditation timer ───
function Meditate() {
  const { data, setData } = usePro<{ log: { date: string; min: number }[]; interval: number }>("meditate", { log: [], interval: 0 });
  const [mins, setMins] = useState(10);
  const [endAt, setEndAt] = useState<number | null>(null);
  const lastBell = useRef(0);
  useTick(endAt !== null, 250); useWakeLock(endAt !== null);
  const left = endAt ? Math.max(0, endAt - Date.now()) : mins * 60_000;
  useEffect(() => {
    if (!endAt) return;
    if (left <= 0) { bell(396); window.setTimeout(() => bell(396), 1500); window.setTimeout(() => bell(396), 3000); setEndAt(null); setData((d) => ({ ...d, log: [{ date: today(), min: mins }, ...d.log].slice(0, 3000) })); return; }
    const gone = mins * 60 - Math.ceil(left / 1000);
    if (data.interval && gone > 0 && gone % (data.interval * 60) === 0 && lastBell.current !== gone) { lastBell.current = gone; bell(528); }
  });
  const total = data.log.reduce((a, l) => a + l.min, 0);
  const R = 120, C = 2 * Math.PI * R;
  return <div className="space-y-4">
    <Card className="flex flex-col items-center py-8" tint="linear-gradient(180deg,#f0fdfa,#fff)">
      <div className="relative" style={{ width: 280, height: 280 }}><svg width="280" height="280" className="-rotate-90"><circle cx="140" cy="140" r={R} fill="none" stroke="#ccfbf1" strokeWidth="10" /><circle cx="140" cy="140" r={R} fill="none" stroke="#0d9488" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - left / (mins * 60_000))} /></svg><div className="absolute inset-0 flex items-center justify-center font-mono text-5xl font-black text-teal-800">{fmtDuration(left / 1000)}</div></div>
      {endAt ? <Btn className="mt-4" onClick={() => setEndAt(null)}>End early</Btn> : <>
        <div className="mt-4 flex flex-wrap justify-center gap-2">{[3, 5, 10, 15, 20, 30].map((m) => <button key={m} type="button" onClick={() => setMins(m)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${mins === m ? "bg-teal-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>{m} min</button>)}</div>
        <label className="mt-3 flex items-center gap-2 text-sm">Interval bell every<select value={data.interval} onChange={(e) => setData((d) => ({ ...d, interval: Number(e.target.value) }))} className="h-9 rounded-lg border border-slate-300 px-2"><option value={0}>never</option>{[1, 2, 5, 10].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
        <Btn kind="primary" color="#0d9488" big className="mt-4" onClick={() => { bell(396); lastBell.current = 0; setEndAt(Date.now() + mins * 60_000); }}><Play size={18} />Begin</Btn></>}
    </Card>
    <div className="grid grid-cols-3 gap-2"><Stat label="Streak" value={`${streak((d) => data.log.some((l) => l.date === d))} days`} color="#0d9488" /><Stat label="This week" value={`${data.log.filter((l) => l.date >= addDays(today(), -6)).reduce((a, l) => a + l.min, 0)} min`} /><Stat label="All time" value={`${Math.floor(total / 60)}h ${total % 60}m`} /></div>
  </div>;
}

// ─── Calm corner ───
const ZONES = [{ c: "#2563eb", n: "Blue", f: "Sad, tired, bored, sick", e: "😔" }, { c: "#16a34a", n: "Green", f: "Calm, happy, ready to learn", e: "🙂" }, { c: "#eab308", n: "Yellow", f: "Worried, silly, frustrated, excited", e: "😬" }, { c: "#dc2626", n: "Red", f: "Angry, scared, out of control", e: "😡" }];
const CALM = [{ e: "🎈", t: "Balloon breaths", steps: [["Fill your belly like a balloon", 4], ["Hold", 2], ["Let it float away", 5]] as [string, number][], rounds: 5 }, { e: "🖐️", t: "Five-finger breathing", steps: [["Trace up a finger and breathe in", 3], ["Trace down and breathe out", 3]] as [string, number][], rounds: 5 }, { e: "🧱", t: "Wall push", steps: [["Push the wall hard!", 10], ["Relax", 5]] as [string, number][], rounds: 3 }, { e: "🍋", t: "Lemon squeeze", steps: [["Squeeze the lemons in your fists", 5], ["Drop them and relax", 5]] as [string, number][], rounds: 3 }, { e: "🔢", t: "Count to 10 slowly", steps: Array.from({ length: 10 }, (_, i) => [`${i + 1}`, 2] as [string, number]), rounds: 1 }, { e: "🐢", t: "Turtle time", steps: [["Go in your shell — hug your knees", 15], ["Come out slowly", 5]] as [string, number][], rounds: 2 }, { e: "👀", t: "5-4-3-2-1 senses", steps: [["Find 5 things you can see", 15], ["4 things you can touch", 12], ["3 things you can hear", 12], ["2 things you can smell", 10], ["1 thing you can taste", 8]] as [string, number][], rounds: 1 }, { e: "🙆", t: "Stretch it out", steps: [["Reach up high", 8], ["Touch your toes", 8], ["Big shoulder rolls", 8]] as [string, number][], rounds: 2 }];
function CalmCorner() {
  const { data, setData } = usePro<{ checkins: { date: string; time: string; zone: number; name: string }[] }>("calm-corner", { checkins: [] });
  const [zone, setZone] = useState<number | null>(null); const [name, setName] = useState("");
  const [play, setPlay] = useState<(typeof CALM)[number] | null>(null);
  return <div className="space-y-4">
    <Card title="How is your body feeling right now?"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{ZONES.map((z, i) => <button key={z.n} type="button" onClick={() => { setZone(i); setData((d) => ({ checkins: [{ date: today(), time: nowTime(), zone: i, name }, ...d.checkins].slice(0, 3000) })); }} className={`rounded-3xl p-4 text-center text-white transition ${zone === i ? "scale-105 ring-4 ring-offset-2" : ""}`} style={{ background: z.c }}><span className="text-5xl">{z.e}</span><span className="mt-1 block text-xl font-black">{z.n}</span><span className="block text-xs opacity-90">{z.f}</span></button>)}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className={`${inputCls} mt-3 max-w-xs`} /></Card>
    {zone !== null && <Card title={zone === 1 ? "You're ready! Want to stay calm and strong?" : "Pick something to help your body feel better"}><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{CALM.map((c) => <button key={c.t} type="button" onClick={() => setPlay(c)} className="rounded-2xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-100 hover:ring-emerald-300"><span className="text-4xl">{c.e}</span><span className="mt-1 block text-sm font-black">{c.t}</span></button>)}</div></Card>}
    {data.checkins.length > 0 && <Card title="Recent check-ins"><div className="flex flex-wrap gap-1.5">{data.checkins.slice(0, 40).map((c, i) => <span key={i} title={`${c.name || "Someone"} · ${fmtDay(c.date)} ${fmtTime(c.time)}`} className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: ZONES[c.zone].c }}>{c.name ? c.name.split(" ")[0] : ZONES[c.zone].n}</span>)}</div></Card>}
    {play && <SequencePlayer kid title={play.t} color="#22c55e" steps={Array.from({ length: play.rounds }).flatMap(() => play.steps.map(([l, s]) => ({ label: l, sec: s })))} onClose={() => setPlay(null)} />}
  </div>;
}

// ─── Affirmations ───
const AFF_ADULT = ["I am allowed to take up space.", "I can do hard things, one step at a time.", "My worth isn't measured by my productivity.", "I'm learning, and that's enough for today.", "I choose progress over perfection.", "I can handle whatever this day brings.", "I deserve rest without earning it.", "I am proud of how far I've come.", "My feelings are valid, and they will pass.", "I bring something good to the people around me.", "I can set boundaries with kindness.", "Today I'll notice what's going right.", "I'm doing better than I think I am.", "I trust myself to figure it out.", "I let go of what I can't control."];
const AFF_KIDS = ["I am brave!", "Mistakes help me learn.", "I am a good friend.", "I can try again.", "My brain is growing every day.", "I am kind to myself and others.", "I am loved.", "I believe in me!", "I can calm my body.", "I am strong.", "I make the world brighter.", "I can do hard things!"];
function Affirmations() {
  const { data, setData } = usePro<{ mine: string[]; favs: string[]; deck: "adult" | "kids" | "mine" }>("affirmations", { mine: [], favs: [], deck: "adult" });
  const deck = data.deck === "kids" ? AFF_KIDS : data.deck === "mine" ? data.mine : AFF_ADULT;
  const daily = deck.length ? deck[(Number(today().replace(/-/g, "")) * 7) % deck.length] : "";
  const [card, setCard] = useState(daily);
  const [mine, setMine] = useState("");
  const fav = data.favs.includes(card);
  return <div className="space-y-4">
    <Tabs value={data.deck} onChange={(v) => { setData((d) => ({ ...d, deck: v })); }} color="#f472b6" items={[{ id: "adult", label: "Everyday" }, { id: "kids", label: "For kids" }, { id: "mine", label: `My own (${data.mine.length})` }]} />
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl p-8 text-center text-white shadow-lg" style={{ background: "linear-gradient(135deg,#f472b6,#a855f7)" }}>
      <p className="text-xs font-bold uppercase tracking-[0.25em] opacity-80">{card === daily ? "Today's card" : "Your card"}</p>
      <p className="mt-3 max-w-xl text-3xl font-black leading-tight">{card || "Add your own affirmations below."}</p>
    </div>
    <div className="flex flex-wrap justify-center gap-2"><Btn kind="primary" color="#db2777" disabled={!deck.length} onClick={() => setCard(deck[randInt(deck.length)])}><Sparkles size={15} />Draw another</Btn><Btn disabled={!card} onClick={() => setData((d) => ({ ...d, favs: fav ? d.favs.filter((x) => x !== card) : [...d.favs, card] }))}><Heart size={15} className={fav ? "fill-pink-500 text-pink-500" : ""} />{fav ? "Saved" : "Save"}</Btn></div>
    <Card title="Write your own"><div className="flex gap-2"><input value={mine} onChange={(e) => setMine(e.target.value)} placeholder="I am…" className={inputCls} /><Btn onClick={() => { if (mine.trim()) setData((d) => ({ ...d, mine: [...d.mine, mine.trim()] })); setMine(""); }}><Plus size={15} />Add</Btn></div>
      {data.mine.length > 0 && <ul className="mt-2 space-y-1 text-sm">{data.mine.map((x, i) => <li key={i} className="flex justify-between"><span>{x}</span><button type="button" aria-label="Remove" onClick={() => setData((d) => ({ ...d, mine: d.mine.filter((_, j) => j !== i) }))} className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button></li>)}</ul>}</Card>
    {data.favs.length > 0 && <Card title="Favourites"><ul className="space-y-1 text-sm">{data.favs.map((x) => <li key={x}>💗 {x}</li>)}</ul></Card>}
  </div>;
}

// ─── Calm sounds (all generated on the device) ───
type SoundId = "rain" | "ocean" | "wind" | "brown" | "pink" | "white" | "fire";
const SOUNDS: { id: SoundId; e: string; l: string }[] = [{ id: "rain", e: "🌧️", l: "Rain" }, { id: "ocean", e: "🌊", l: "Ocean" }, { id: "wind", e: "🍃", l: "Wind" }, { id: "fire", e: "🔥", l: "Crackling fire" }, { id: "brown", e: "🟤", l: "Brown noise" }, { id: "pink", e: "🌸", l: "Pink noise" }, { id: "white", e: "⚪", l: "White noise" }];
function noiseBuffer(a: AudioContext, kind: "white" | "pink" | "brown") {
  const len = a.sampleRate * 4, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w * 0.5;
    else if (kind === "pink") { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
    else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  return buf;
}
function Sounds() {
  const { data, setData } = usePro<{ vol: Record<string, number> }>("sounds", { vol: { rain: 0.6 } });
  const [on, setOn] = useState(false);
  const [sleepMin, setSleepMin] = useState(0); const [sleepAt, setSleepAt] = useState<number | null>(null);
  const nodes = useRef<Record<string, { gain: GainNode; stop: () => void }>>({});
  useTick(sleepAt !== null, 1000);
  const build = (a: AudioContext, id: SoundId) => {
    const gain = a.createGain(); gain.gain.value = 0; gain.connect(a.destination);
    const src = a.createBufferSource(); src.loop = true;
    const stops: (() => void)[] = [() => src.stop()];
    if (id === "white" || id === "pink" || id === "brown") { src.buffer = noiseBuffer(a, id); src.connect(gain); }
    else {
      src.buffer = noiseBuffer(a, id === "rain" ? "pink" : id === "fire" ? "white" : "brown");
      const f = a.createBiquadFilter();
      if (id === "rain") { f.type = "highpass"; f.frequency.value = 800; src.connect(f).connect(gain); }
      else if (id === "fire") { f.type = "bandpass"; f.frequency.value = 2500; f.Q.value = 0.8; const crackle = a.createGain(); crackle.gain.value = 0.3; src.connect(f).connect(crackle).connect(gain); const t = window.setInterval(() => { crackle.gain.setTargetAtTime(Math.random() < 0.15 ? 1.6 : 0.25, a.currentTime, 0.01); }, 70); stops.push(() => window.clearInterval(t)); }
      else { f.type = "lowpass"; f.frequency.value = id === "ocean" ? 600 : 400; const swell = a.createGain(); swell.gain.value = 0.5; src.connect(f).connect(swell).connect(gain); const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = id === "ocean" ? 0.09 : 0.05; lg.gain.value = id === "ocean" ? 0.45 : 0.3; lfo.connect(lg).connect(swell.gain); lfo.start(); stops.push(() => lfo.stop()); }
    }
    src.start();
    return { gain, stop: () => stops.forEach((s) => { try { s(); } catch { /* stopped */ } }) };
  };
  const apply = () => { const a = audio(); if (!a) return; for (const s of SOUNDS) { const v = data.vol[s.id] || 0; if (v > 0 && !nodes.current[s.id]) nodes.current[s.id] = build(a, s.id); nodes.current[s.id]?.gain.gain.setTargetAtTime(on ? v * 0.6 : 0, a.currentTime, 0.4); } };
  useEffect(apply);
  useEffect(() => () => { for (const n of Object.values(nodes.current)) n.stop(); nodes.current = {}; }, []);
  useEffect(() => { if (sleepAt !== null && Date.now() >= sleepAt) { setOn(false); setSleepAt(null); } });
  return <div className="space-y-4">
    <Card className="flex flex-col items-center gap-3 py-6" tint="linear-gradient(180deg,#e0f2fe,#fff)">
      <button type="button" onClick={() => { audio(); setOn(!on); }} className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-sky-600 text-white shadow-xl" aria-label={on ? "Pause" : "Play"}>{on ? <Pause size={40} /> : <Play size={40} />}</button>
      <div className="flex items-center gap-2 text-sm">Sleep timer<select value={sleepMin} onChange={(e) => { const m = Number(e.target.value); setSleepMin(m); setSleepAt(m ? Date.now() + m * 60_000 : null); }} className="h-9 rounded-lg border border-slate-300 px-2"><option value={0}>off</option>{[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</select>{sleepAt && <span className="text-slate-500">{fmtDuration((sleepAt - Date.now()) / 1000)}</span>}</div>
    </Card>
    <Card title="Mix your sounds"><div className="space-y-3">{SOUNDS.map((s) => <label key={s.id} className="flex items-center gap-3"><span className="w-8 text-2xl">{s.e}</span><span className="w-32 text-sm font-bold">{s.l}</span><input type="range" min={0} max={1} step={0.05} value={data.vol[s.id] || 0} onChange={(e) => setData((d) => ({ vol: { ...d.vol, [s.id]: Number(e.target.value) } }))} className="flex-1 accent-sky-600" /></label>)}</div></Card>
    <p className="text-xs text-slate-500">All sounds are made on your device — nothing downloads. Brown noise is popular for focus; pink noise for sleep.</p>
  </div>;
}

// ─── Self-care bingo ───
const CARE = ["Drink a big glass of water", "10-minute walk outside", "Text a friend", "Stretch for 5 minutes", "Make your bed", "Eat a fruit or veggie", "Go to bed 30 min early", "Read for fun", "Listen to a favourite song", "Tidy one small space", "No phone for an hour", "Write 3 good things", "Take a shower or bath", "Cook something", "Say no to something", "Breathe deeply for 2 min", "Do something creative", "Get some sunlight", "Unfollow an account that stresses you", "Call someone you love", "Take a nap", "Laugh at something", "Wear something comfy", "Plan something fun", "Compliment yourself"];
function SelfCare() {
  const { data, setData } = usePro<{ card: string[]; done: number[]; week: string; mine: string[]; bingos: number }>("self-care", { card: [], done: [], week: "", mine: [], bingos: 0 });
  const wk = addDays(today(), -((new Date().getDay() + 6) % 7));
  const newCard = () => setData((d) => ({ ...d, card: shuffle([...CARE, ...d.mine]).slice(0, 25).map((x, i) => (i === 12 ? "🌟 Free: you showed up" : x)), done: [12], week: wk }));
  useEffect(() => { if (!data.card.length || data.week !== wk) newCard(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wk]);
  const lines = [...Array.from({ length: 5 }, (_, r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)), ...Array.from({ length: 5 }, (_, c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)), [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]];
  const bingo = lines.filter((l) => l.every((i) => data.done.includes(i))).length;
  const [mine, setMine] = useState("");
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><p className="text-sm text-slate-600">Week of {fmtDay(wk)} · {data.done.length - 1} done{bingo ? ` · ${bingo} BINGO${bingo > 1 ? "s" : ""}! 🎉` : ""}</p><Btn onClick={newCard}>New card</Btn></div>
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">{data.card.map((t, i) => { const on = data.done.includes(i); return <button key={i} type="button" onClick={() => i !== 12 && setData((d) => ({ ...d, done: on ? d.done.filter((x) => x !== i) : [...d.done, i] }))} className={`flex aspect-square items-center justify-center rounded-xl p-1 text-center text-[10px] font-bold leading-tight sm:text-xs ${on ? "bg-fuchsia-500 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-fuchsia-300"}`}>{t}</button>; })}</div>
    <Card title="Add your own ideas"><div className="flex gap-2"><input value={mine} onChange={(e) => setMine(e.target.value)} placeholder="Paint my nails, play guitar…" className={inputCls} /><Btn onClick={() => { if (mine.trim()) setData((d) => ({ ...d, mine: [...d.mine, mine.trim()] })); setMine(""); }}><Plus size={15} />Add</Btn></div>{data.mine.length > 0 && <p className="mt-2 text-xs text-slate-500">{data.mine.join(" · ")} — they'll be mixed into new cards.</p>}</Card>
  </div>;
}

// ─── Kindness challenge ───
const KIND = ["Hold the door for someone", "Write a thank-you note", "Compliment someone sincerely", "Help with a chore without being asked", "Pick up litter", "Let someone go ahead of you in line", "Sit with someone new at lunch", "Donate a book or toy", "Text someone 'thinking of you'", "Thank a school worker by name", "Share your snack", "Leave a kind sticky note", "Help a classmate with their work", "Say sorry and mean it", "Make someone laugh", "Ask someone how they're really doing", "Water a plant or feed the birds", "Give someone your full attention", "Thank your bus driver", "Draw a picture for someone", "Teach someone something you know", "Write a positive review for a local business", "Call a grandparent", "Clean up after others", "Include someone who looks left out"];
function Kindness() {
  const { data, setData } = usePro<{ acts: { id: string; date: string; text: string; who: string }[] }>("kindness", { acts: [] });
  const idea = KIND[(Number(today().replace(/-/g, "")) * 13) % KIND.length];
  const [text, setText] = useState(idea); const [who, setWho] = useState("");
  const goal = 100;
  return <div className="space-y-4">
    <Card tint="linear-gradient(135deg,#fff1f2,#fff)"><p className="text-xs font-bold uppercase tracking-wide text-rose-500">Today's kindness idea</p><p className="mt-1 text-2xl font-black">{idea}</p></Card>
    <Card title="I did a kind thing!"><div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]"><input value={text} onChange={(e) => setText(e.target.value)} className={inputCls} /><input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Who did it? (optional)" className={inputCls} /><Btn kind="primary" color="#f43f5e" disabled={!text.trim()} onClick={() => { setData((d) => ({ acts: [{ id: uid(), date: today(), text: text.trim(), who: who.trim() }, ...d.acts] })); setText(KIND[randInt(KIND.length)]); }}><Heart size={15} />Log it</Btn></div></Card>
    <Card title={`Kindness jar · ${data.acts.length} / ${goal}`}><div className="flex flex-wrap gap-1">{Array.from({ length: goal }, (_, i) => <span key={i} className="text-lg">{i < data.acts.length ? "💗" : "🤍"}</span>)}</div></Card>
    {data.acts.length > 0 && <Card title="Kind acts"><ul className="divide-y divide-slate-100 text-sm">{data.acts.slice(0, 40).map((a) => <li key={a.id} className="flex justify-between gap-2 py-1.5"><span>{a.text}{a.who && <b className="text-rose-600"> · {a.who}</b>}</span><span className="text-xs text-slate-400">{fmtDay(a.date)}</span></li>)}</ul></Card>}
  </div>;
}

// The Book Store is a big app of its own; its code (and its book list) loads only when it's opened.
const BookStoreLazy = lazy(() => import("../bookstore/BookStore"));
const BookStore = () => <Suspense fallback={<p className="py-12 text-center text-sm font-semibold text-slate-500">Opening the Book Store…</p>}><BookStoreLazy /></Suspense>;

export const MIND: Record<string, ComponentType> = {
  bookstore: BookStore,
  breathe: Breathe, mood: Mood, gratitude: Gratitude, journal: Journal, thoughts: Thoughts, worry: WorryTime, meditate: Meditate,
  "calm-corner": CalmCorner, affirmations: Affirmations, sounds: Sounds, "self-care": SelfCare, kindness: Kindness,
};

