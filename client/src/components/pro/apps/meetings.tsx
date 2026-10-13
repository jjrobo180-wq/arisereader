// Meeting apps: timed agendas with a live run-through, minutes with action items, a stand-up
// timer, a quick pass-around poll, icebreaker questions, a retrospective board, a live meeting
// cost clock and a find-a-time availability grid.
import { useEffect, useState, type ComponentType } from "react";
import { Copy, Pause, Play, Plus, Printer, Shuffle, SkipForward, Sparkles, ThumbsUp, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { askAppAi } from "@/lib/cloudDocs";
import { Btn, Card, Chart, Empty, Field, FullScreen, Modal, NumIn, Stat, beep, chime, esc, fit, fmtDay, fmtDuration, inputCls, money, printPage, randInt, shuffle, today, uid, usePro, useTick, useWakeLock } from "../kit";

const TEAL = "#0891b2";

// ─── Agenda ───
type Item = { id: string; topic: string; minutes: number; owner: string; notes: string };
type Agenda = { id: string; title: string; goal: string; date: string; items: Item[] };
function AgendaApp() {
  const { token } = useAuth();
  const { data, setData } = usePro<{ agendas: Agenda[] }>("agenda", { agendas: [] });
  const [cur, setCur] = useState<Agenda | null>(null);
  const [run, setRun] = useState<{ i: number; startedAt: number; itemAt: number } | null>(null);
  const [ai, setAi] = useState({ open: false, purpose: "", minutes: "30", people: "", busy: false, err: "" });
  useTick(!!run, 500); useWakeLock(!!run);
  const blank = (): Agenda => ({ id: uid(), title: "Team meeting", goal: "", date: today(), items: [{ id: uid(), topic: "Welcome & goals", minutes: 5, owner: "", notes: "" }] });
  const save = (a: Agenda) => { setCur(a); setData((d) => ({ agendas: [a, ...d.agendas.filter((x) => x.id !== a.id)] })); };
  const total = (a: Agenda) => a.items.reduce((s, i) => s + i.minutes, 0);
  const text = (a: Agenda) => `${a.title} — ${fmtDay(a.date)}\n${a.goal ? `Goal: ${a.goal}\n` : ""}\n${a.items.map((i, n) => `${n + 1}. ${i.topic} (${i.minutes} min${i.owner ? `, ${i.owner}` : ""})`).join("\n")}\n\nTotal: ${total(a)} min`;
  const makeAi = async () => { setAi({ ...ai, busy: true, err: "" }); try { const r = await askAppAi<{ title: string; goal: string; items: { topic: string; minutes: number; owner: string; notes: string }[] }>(token, "meeting-agenda", { purpose: ai.purpose, minutes: ai.minutes, people: ai.people }); save({ id: uid(), title: r.title || "Meeting", goal: r.goal || "", date: today(), items: (r.items || []).map((i) => ({ id: uid(), topic: i.topic, minutes: Number(i.minutes) || 5, owner: i.owner || "", notes: i.notes || "" })) }); setAi({ open: false, purpose: "", minutes: "30", people: "", busy: false, err: "" }); } catch (e: any) { setAi({ ...ai, busy: false, err: e.message }); } };
  if (run && cur) {
    const it = cur.items[run.i]; const itemSec = (Date.now() - run.itemAt) / 1000; const left = it.minutes * 60 - itemSec; const over = left < 0;
    return <FullScreen bg={over ? "#7f1d1d" : "#0e7490"} onClose={() => setRun(null)}>
      <p className="text-lg opacity-80">{cur.title} · item {run.i + 1} of {cur.items.length}</p>
      <p className="mt-4 max-w-3xl text-center text-5xl font-black">{it.topic}</p>{it.owner && <p className="mt-2 text-xl opacity-80">{it.owner}</p>}
      <p className="mt-8 font-mono text-8xl font-black tabular-nums">{over ? "+" : ""}{fmtDuration(Math.abs(left))}</p>
      {cur.items[run.i + 1] && <p className="mt-4 opacity-75">Next: {cur.items[run.i + 1].topic}</p>}
      <p className="mt-2 text-sm opacity-60">Meeting time {fmtDuration((Date.now() - run.startedAt) / 1000)} of {total(cur)} min</p>
      <div className="mt-8 flex gap-3">{run.i + 1 < cur.items.length ? <button type="button" onClick={() => { beep(); setRun({ ...run, i: run.i + 1, itemAt: Date.now() }); }} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-lg font-black text-slate-900"><SkipForward size={20} />Next item</button> : <button type="button" onClick={() => { chime(); setRun(null); }} className="rounded-full bg-white px-6 py-3 text-lg font-black text-slate-900">Finish meeting</button>}</div>
    </FullScreen>;
  }
  if (cur) return <div className="space-y-4">
    <div className="flex flex-wrap gap-2"><Btn onClick={() => setCur(null)}>← All agendas</Btn><span className="flex-1" /><Btn onClick={() => void navigator.clipboard?.writeText(text(cur))}><Copy size={14} />Copy</Btn><Btn onClick={() => printPage(cur.title, `<h1>${esc(cur.title)}</h1><p class="muted">${esc(fmtDay(cur.date, { weekday: "long", month: "long", day: "numeric" }))} · ${total(cur)} minutes</p>${cur.goal ? `<p><b>Goal:</b> ${esc(cur.goal)}</p>` : ""}<table><tr><th>#</th><th>Topic</th><th>Time</th><th>Who</th><th>Notes</th></tr>${cur.items.map((i, n) => `<tr><td>${n + 1}</td><td><b>${esc(i.topic)}</b></td><td>${i.minutes} min</td><td>${esc(i.owner)}</td><td>${esc(i.notes)}</td></tr>`).join("")}</table>`)}><Printer size={14} />Print</Btn><Btn kind="primary" color={TEAL} disabled={!cur.items.length} onClick={() => setRun({ i: 0, startedAt: Date.now(), itemAt: Date.now() })}><Play size={15} />Run meeting</Btn></div>
    <Card><div className="grid gap-3 sm:grid-cols-3"><Field label="Meeting" className="sm:col-span-2"><input value={cur.title} onChange={(e) => save({ ...cur, title: e.target.value })} className={inputCls} /></Field><Field label="Date"><input type="date" value={cur.date} onChange={(e) => save({ ...cur, date: e.target.value })} className={inputCls} /></Field><Field label="Goal — what should be true when it ends?" className="sm:col-span-3"><input value={cur.goal} onChange={(e) => save({ ...cur, goal: e.target.value })} className={inputCls} /></Field></div></Card>
    <Card title={`Agenda · ${total(cur)} min`}>{cur.items.map((i, n) => <div key={i.id} className="mb-2 grid grid-cols-[24px_1fr_70px] gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-[24px_1fr_70px_140px_auto]">
      <span className="pt-2 text-center font-black text-cyan-700">{n + 1}</span><input value={i.topic} onChange={(e) => save({ ...cur, items: cur.items.map((x) => (x.id === i.id ? { ...x, topic: e.target.value } : x)) })} placeholder="Topic" className={inputCls} /><NumIn value={i.minutes} onChange={(v) => save({ ...cur, items: cur.items.map((x) => (x.id === i.id ? { ...x, minutes: Math.max(1, Number(v) || 1) } : x)) })} /><input value={i.owner} onChange={(e) => save({ ...cur, items: cur.items.map((x) => (x.id === i.id ? { ...x, owner: e.target.value } : x)) })} placeholder="Who leads" className={inputCls} />
      <button type="button" aria-label="Remove" onClick={() => save({ ...cur, items: cur.items.filter((x) => x.id !== i.id) })} className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
    </div>)}<Btn onClick={() => save({ ...cur, items: [...cur.items, { id: uid(), topic: "", minutes: 5, owner: "", notes: "" }] })}><Plus size={14} />Item</Btn></Card>
    <Btn kind="danger" onClick={() => { setData((d) => ({ agendas: d.agendas.filter((x) => x.id !== cur.id) })); setCur(null); }}>Delete agenda</Btn>
  </div>;
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-end gap-2"><Btn kind="soft" color="#7c3aed" onClick={() => setAi({ ...ai, open: true })}><Sparkles size={15} />AI agenda</Btn><Btn kind="primary" color={TEAL} onClick={() => save(blank())}><Plus size={16} />New agenda</Btn></div>
    {data.agendas.length ? <div className="grid gap-3 sm:grid-cols-2">{data.agendas.map((a) => <button key={a.id} type="button" onClick={() => setCur(a)} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-cyan-300"><p className="font-black">{a.title}</p><p className="text-xs text-slate-500">{fmtDay(a.date)} · {a.items.length} items · {total(a)} min</p></button>)}</div> : <Empty>Plan a meeting with timed items, then run it with a big timer so it ends on time.</Empty>}
    {ai.open && <Modal title="AI agenda" onClose={() => setAi({ ...ai, open: false })} footer={<Btn kind="primary" color="#7c3aed" disabled={ai.busy || !ai.purpose.trim()} onClick={() => void makeAi()}><Sparkles size={15} />{ai.busy ? "Planning…" : "Make agenda"}</Btn>}><div className="space-y-3"><Field label="What is the meeting for?"><textarea value={ai.purpose} onChange={(e) => setAi({ ...ai, purpose: e.target.value })} rows={3} placeholder="Plan the spring field trip and assign jobs" className={`${inputCls} h-auto py-2`} /></Field><div className="grid grid-cols-2 gap-2"><Field label="Minutes"><select value={ai.minutes} onChange={(e) => setAi({ ...ai, minutes: e.target.value })} className={inputCls}>{["15", "30", "45", "60", "90"].map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Who's coming"><input value={ai.people} onChange={(e) => setAi({ ...ai, people: e.target.value })} placeholder="4th grade team" className={inputCls} /></Field></div>{ai.err && <p className="text-rose-600">{ai.err}</p>}</div></Modal>}
  </div>;
}

// ─── Minutes ───
type Action = { id: string; task: string; owner: string; due: string; done: boolean };
type Minutes = { id: string; title: string; date: string; attendees: string; notes: string; decisions: string[]; actions: Action[] };
function MinutesApp() {
  const { data, setData } = usePro<{ list: Minutes[] }>("minutes", { list: [] });
  const [cur, setCur] = useState<Minutes | null>(null);
  const save = (m: Minutes) => { setCur(m); setData((d) => ({ list: [m, ...d.list.filter((x) => x.id !== m.id)] })); };
  const summary = (m: Minutes) => `${m.title} — ${fmtDay(m.date, { month: "long", day: "numeric", year: "numeric" })}\nAttendees: ${m.attendees}\n\nNotes:\n${m.notes}\n\nDecisions:\n${m.decisions.map((d) => `• ${d}`).join("\n")}\n\nAction items:\n${m.actions.map((a) => `☐ ${a.task} — ${a.owner || "?"}${a.due ? ` (due ${fmtDay(a.due)})` : ""}`).join("\n")}`;
  const open = data.list.flatMap((m) => m.actions.filter((a) => !a.done).map((a) => ({ m, a })));
  if (cur) return <div className="space-y-4">
    <div className="flex flex-wrap gap-2"><Btn onClick={() => setCur(null)}>← All minutes</Btn><span className="flex-1" /><Btn onClick={() => void navigator.clipboard?.writeText(summary(cur))}><Copy size={14} />Copy summary</Btn><Btn onClick={() => { window.location.href = `mailto:?subject=${encodeURIComponent(`Minutes: ${cur.title}`)}&body=${encodeURIComponent(summary(cur))}`; }}>Email</Btn><Btn onClick={() => printPage(cur.title, `<pre style="font-family:Arial;white-space:pre-wrap;font-size:14px">${esc(summary(cur))}</pre>`)}><Printer size={14} />Print</Btn></div>
    <Card><div className="grid gap-3 sm:grid-cols-3"><Field label="Meeting" className="sm:col-span-2"><input value={cur.title} onChange={(e) => save({ ...cur, title: e.target.value })} className={inputCls} /></Field><Field label="Date"><input type="date" value={cur.date} onChange={(e) => save({ ...cur, date: e.target.value })} className={inputCls} /></Field><Field label="Attendees" className="sm:col-span-3"><input value={cur.attendees} onChange={(e) => save({ ...cur, attendees: e.target.value })} placeholder="Names, separated by commas" className={inputCls} /></Field></div></Card>
    <Card title="Notes"><textarea value={cur.notes} onChange={(e) => save({ ...cur, notes: e.target.value })} rows={8} placeholder="What was discussed…" className={`${inputCls} h-auto py-2`} /></Card>
    <Card title="Decisions">{cur.decisions.map((d, i) => <div key={i} className="mb-1 flex gap-2"><input value={d} onChange={(e) => save({ ...cur, decisions: cur.decisions.map((x, j) => (j === i ? e.target.value : x)) })} className={inputCls} /><button type="button" aria-label="Remove" onClick={() => save({ ...cur, decisions: cur.decisions.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></div>)}<Btn onClick={() => save({ ...cur, decisions: [...cur.decisions, ""] })}><Plus size={14} />Decision</Btn></Card>
    <Card title="Action items">{cur.actions.map((a) => <div key={a.id} className="mb-1.5 grid grid-cols-[auto_1fr] gap-2 sm:grid-cols-[auto_1fr_140px_150px_auto]"><input type="checkbox" checked={a.done} onChange={(e) => save({ ...cur, actions: cur.actions.map((x) => (x.id === a.id ? { ...x, done: e.target.checked } : x)) })} className="mt-3" /><input value={a.task} onChange={(e) => save({ ...cur, actions: cur.actions.map((x) => (x.id === a.id ? { ...x, task: e.target.value } : x)) })} placeholder="Task" className={inputCls} /><input value={a.owner} onChange={(e) => save({ ...cur, actions: cur.actions.map((x) => (x.id === a.id ? { ...x, owner: e.target.value } : x)) })} placeholder="Owner" className={inputCls} /><input type="date" value={a.due} onChange={(e) => save({ ...cur, actions: cur.actions.map((x) => (x.id === a.id ? { ...x, due: e.target.value } : x)) })} className={inputCls} /><button type="button" aria-label="Remove" onClick={() => save({ ...cur, actions: cur.actions.filter((x) => x.id !== a.id) })} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></div>)}<Btn onClick={() => save({ ...cur, actions: [...cur.actions, { id: uid(), task: "", owner: "", due: "", done: false }] })}><Plus size={14} />Action item</Btn></Card>
    <Btn kind="danger" onClick={() => { setData((d) => ({ list: d.list.filter((x) => x.id !== cur.id) })); setCur(null); }}>Delete</Btn>
  </div>;
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color="#0e7490" onClick={() => save({ id: uid(), title: "Meeting", date: today(), attendees: "", notes: "", decisions: [], actions: [] })}><Plus size={16} />New minutes</Btn></div>
    {open.length > 0 && <Card title={`Open action items (${open.length})`}><ul className="divide-y divide-slate-100 text-sm">{open.map(({ m, a }) => <li key={a.id} className="flex items-center gap-2 py-1.5"><input type="checkbox" onChange={() => setData((d) => ({ list: d.list.map((x) => (x.id === m.id ? { ...x, actions: x.actions.map((y) => (y.id === a.id ? { ...y, done: true } : y)) } : x)) }))} /><span className="flex-1">{a.task} <span className="text-slate-500">— {a.owner || "?"}</span></span><span className={`text-xs ${a.due && a.due < today() ? "font-bold text-rose-600" : "text-slate-500"}`}>{a.due ? fmtDay(a.due) : ""}</span></li>)}</ul></Card>}
    {data.list.length ? <div className="grid gap-3 sm:grid-cols-2">{data.list.map((m) => <button key={m.id} type="button" onClick={() => setCur(m)} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-cyan-300"><p className="font-black">{m.title}</p><p className="text-xs text-slate-500">{fmtDay(m.date)} · {m.decisions.length} decisions · {m.actions.filter((a) => !a.done).length} open actions</p></button>)}</div> : <Empty>Take minutes during your next meeting.</Empty>}
  </div>;
}

// ─── Stand-up timer ───
function Standup() {
  const { data, setData } = usePro<{ teams: { id: string; name: string; people: string[] }[]; sec: number }>("standup", { teams: [{ id: "t", name: "My team", people: ["Alex", "Sam", "Jordan"] }], sec: 60 });
  const [team, setTeam] = useState(data.teams[0]?.id || "t");
  const t = data.teams.find((x) => x.id === team) || data.teams[0];
  const [order, setOrder] = useState<string[] | null>(null); const [i, setI] = useState(0); const [at, setAt] = useState(0); const [extra, setExtra] = useState(0);
  const [name, setName] = useState("");
  useTick(!!order, 250); useWakeLock(!!order);
  const left = order ? data.sec + extra - (Date.now() - at) / 1000 : data.sec;
  useEffect(() => { if (order && left <= 0 && left > -0.3) beep(440, 400, 0.3, "triangle"); });
  const next = () => { if (!order) return; if (i + 1 >= order.length) { chime(); setOrder(null); return; } setI(i + 1); setAt(Date.now()); setExtra(0); beep(880, 120); };
  if (!t) return null;
  return <div className="space-y-4">
    {order ? <Card className="text-center" tint={left < 0 ? "#fee2e2" : left < 10 ? "#fef9c3" : "#ecfeff"}>
      <p className="text-sm font-bold text-slate-500">{i + 1} of {order.length}</p><p className="text-4xl font-black">{order[i]}</p>
      <p className={`mt-2 font-mono text-7xl font-black ${left < 0 ? "text-rose-600" : "text-cyan-800"}`}>{left < 0 ? "+" : ""}{fmtDuration(Math.abs(left))}</p>
      <p className="mt-1 text-sm text-slate-500">Yesterday · Today · Blockers</p>
      <div className="mt-3 flex justify-center gap-2"><Btn onClick={() => setExtra(extra + 30)}>+30s</Btn><Btn kind="primary" color="#2563eb" big onClick={next}><SkipForward size={18} />{i + 1 < order.length ? `Next: ${order[i + 1]}` : "Finish"}</Btn><Btn onClick={() => setOrder(null)}>Stop</Btn></div>
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">{order.map((p, k) => <span key={k} className={`rounded-full px-2.5 py-1 text-xs font-bold ${k < i ? "bg-slate-200 text-slate-400 line-through" : k === i ? "bg-cyan-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>{p}</span>)}</div>
    </Card> : <Card className="text-center"><p className="text-sm text-slate-600">{t.people.length} people × {data.sec}s ≈ {Math.ceil((t.people.length * data.sec) / 60)} min</p><Btn kind="primary" color="#2563eb" big className="mt-3" disabled={!t.people.length} onClick={() => { setOrder(shuffle(t.people)); setI(0); setAt(Date.now()); setExtra(0); }}><Shuffle size={18} />Start in random order</Btn></Card>}
    <Card title="Team" right={<select value={team} onChange={(e) => setTeam(e.target.value)} className={fit("w-auto")}>{data.teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}>
      <div className="flex flex-wrap gap-2">{t.people.map((p) => <span key={p} className="flex items-center gap-1 rounded-full bg-cyan-50 px-3 py-1 text-sm font-bold">{p}<button type="button" aria-label={`Remove ${p}`} onClick={() => setData((d) => ({ ...d, teams: d.teams.map((x) => (x.id === t.id ? { ...x, people: x.people.filter((y) => y !== p) } : x)) }))} className="text-cyan-300 hover:text-rose-600">×</button></span>)}</div>
      <div className="mt-2 flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { setData((d) => ({ ...d, teams: d.teams.map((x) => (x.id === t.id ? { ...x, people: [...x.people, name.trim()] } : x)) })); setName(""); } }} placeholder="Add a person (Enter)" className={inputCls} /><Btn onClick={() => { const n = window.prompt("Team name"); if (n) { const id = uid(); setData((d) => ({ ...d, teams: [...d.teams, { id, name: n, people: [] }] })); setTeam(id); } }}><Plus size={14} />Team</Btn></div>
      <label className="mt-3 flex items-center gap-2 text-sm">Seconds each <NumIn value={data.sec} onChange={(n) => setData((d) => ({ ...d, sec: Math.max(10, Number(n) || 60) }))} className="w-24" /></label>
    </Card>
  </div>;
}

// ─── Quick poll ───
type Poll = { id: string; q: string; choices: string[]; votes: number[]; hidden: boolean; date: string };
function PollApp() {
  const { data, setData } = usePro<{ polls: Poll[] }>("poll", { polls: [] });
  const [cur, setCur] = useState<Poll | null>(null);
  const [voting, setVoting] = useState(false); const [flash, setFlash] = useState(false);
  const save = (p: Poll) => { setCur(p); setData((d) => ({ polls: [p, ...d.polls.filter((x) => x.id !== p.id)] })); };
  if (cur && voting) return <FullScreen bg="#4c1d95" onClose={() => setVoting(false)}>
    <p className="max-w-3xl px-6 text-center text-4xl font-black">{cur.q}</p>
    <div className="mt-8 grid w-full max-w-3xl gap-3 px-6">{cur.choices.map((c, i) => <button key={i} type="button" onClick={() => { save({ ...cur, votes: cur.votes.map((v, j) => (j === i ? v + 1 : v)) }); setFlash(true); beep(880, 120); window.setTimeout(() => setFlash(false), 900); }} className="rounded-2xl bg-white/15 px-6 py-5 text-left text-2xl font-black hover:bg-white/25">{String.fromCharCode(65 + i)}. {c}</button>)}</div>
    <p className="mt-6 text-lg opacity-80">{flash ? "✓ Vote counted — pass it on!" : `${cur.votes.reduce((a, b) => a + b, 0)} votes so far`}</p>
  </FullScreen>;
  if (cur) { const total = cur.votes.reduce((a, b) => a + b, 0); return <div className="space-y-4">
    <div className="flex flex-wrap gap-2"><Btn onClick={() => setCur(null)}>← All polls</Btn><span className="flex-1" /><Btn kind="primary" color="#7c3aed" disabled={cur.choices.filter((c) => c.trim()).length < 2 || !cur.q.trim()} onClick={() => setVoting(true)}><Play size={15} />Start voting</Btn></div>
    <Card><Field label="Question"><input value={cur.q} onChange={(e) => save({ ...cur, q: e.target.value })} className={`${inputCls} font-bold`} /></Field>
      <div className="mt-3 space-y-1.5">{cur.choices.map((c, i) => <div key={i} className="flex gap-2"><span className="pt-2 font-black text-violet-700">{String.fromCharCode(65 + i)}</span><input value={c} onChange={(e) => save({ ...cur, choices: cur.choices.map((x, j) => (j === i ? e.target.value : x)) })} className={inputCls} /><button type="button" aria-label="Remove" onClick={() => save({ ...cur, choices: cur.choices.filter((_, j) => j !== i), votes: cur.votes.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></div>)}</div>
      <div className="mt-2 flex flex-wrap gap-2"><Btn onClick={() => save({ ...cur, choices: [...cur.choices, ""], votes: [...cur.votes, 0] })}><Plus size={14} />Choice</Btn><Btn onClick={() => save({ ...cur, choices: ["Yes", "No", "Not sure"], votes: [0, 0, 0] })}>Yes / No</Btn><Btn onClick={() => save({ ...cur, choices: ["😀", "🙂", "😐", "🙁"], votes: [0, 0, 0, 0] })}>Faces</Btn></div></Card>
    <Card title={`Results · ${total} votes`} right={<div className="flex gap-2"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={cur.hidden} onChange={(e) => save({ ...cur, hidden: e.target.checked })} />Hide until reveal</label><Btn onClick={() => save({ ...cur, votes: cur.votes.map(() => 0) })}>Reset</Btn></div>}>
      {cur.hidden ? <p className="text-center text-sm text-slate-500">Results hidden. Untick to reveal.</p> : <Chart kind="bar" labels={cur.choices.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`)} series={[{ name: "Votes", values: cur.votes }]} colors={["#7c3aed"]} legend={false} height={Math.max(140, cur.choices.length * 44)} />}</Card>
  </div>; }
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color="#7c3aed" onClick={() => save({ id: uid(), q: "", choices: ["", ""], votes: [0, 0], hidden: false, date: today() })}><Plus size={16} />New poll</Btn></div>
    {data.polls.length ? <div className="grid gap-3 sm:grid-cols-2">{data.polls.map((p) => <button key={p.id} type="button" onClick={() => setCur(p)} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-violet-300"><p className="font-black">{p.q || "Untitled poll"}</p><p className="text-xs text-slate-500">{fmtDay(p.date)} · {p.votes.reduce((a, b) => a + b, 0)} votes</p></button>)}</div> : <Empty>Ask a question, then pass the device around or show it on the board.</Empty>}
  </div>;
}

// ─── Icebreakers ───
const ICE: Record<string, string[]> = {
  Fun: ["If you could have any superpower for a day, what would it be?", "What's the best snack of all time?", "Which fictional world would you live in?", "What's a skill you'd love to learn instantly?", "What's your go-to karaoke song?", "Cats, dogs, or something else?", "What would your autobiography be called?", "If you were a kitchen appliance, which one would you be?", "What's the weirdest food you've tried?", "Beach, mountains or city?", "What's your hidden talent?", "Which song is stuck in your head lately?", "If you won a free trip anywhere, where would you go?", "What was your first job?", "What's a movie you can watch again and again?"],
  Work: ["What's one win from this week?", "What's a tool or trick that saves you time?", "What's something you're learning right now?", "What does a perfect workday look like for you?", "Who helped you recently, and how?", "What's one thing you'd change about how we meet?", "What are you most looking forward to this month?", "What's the best advice you've received at work?", "What motivates you on a tough day?", "What's a small thing that makes a big difference for you?"],
  Deep: ["What's something you believed as a kid that you don't now?", "What are you grateful for today?", "What does a good life look like to you?", "Who has shaped you the most?", "What's a moment you were really proud of?", "What do you wish more people knew about you?", "What's a risk you're glad you took?", "What's something that always makes you feel at home?"],
  Kids: ["If you could be any animal, what would you be?", "What's your favourite thing to do at recess?", "If you could invent a new ice cream flavour, what would it be?", "What would you do if you were the teacher for a day?", "What's the funniest thing that ever happened to you?", "If your pet could talk, what would it say?", "What's your favourite book?", "If you could have any job, what would it be?", "What's one thing that makes you smile?", "Would you rather fly or be invisible?", "What's the best game ever?", "If you had a robot, what would it do?"],
  "Would you rather": ["Would you rather always be 10 minutes late or 20 minutes early?", "Would you rather explore space or the deep ocean?", "Would you rather have no homework or no chores?", "Would you rather talk to animals or speak every language?", "Would you rather live in a treehouse or a castle?", "Would you rather never be cold or never be hot?", "Would you rather have a rewind button or a pause button for life?", "Would you rather eat only pizza or only tacos forever?"],
};
function Icebreakers() {
  const { data, setData } = usePro<{ mine: string[]; used: string[] }>("icebreakers", { mine: [], used: [] });
  const decks = { ...ICE, ...(data.mine.length ? { "My own": data.mine } : {}) };
  const [deck, setDeck] = useState<string>("Fun");
  const [q, setQ] = useState("");
  const [full, setFull] = useState(false); const [mine, setMine] = useState("");
  const draw = () => { const list = (decks as Record<string, string[]>)[deck] || []; const fresh = list.filter((x) => !data.used.includes(x)); const pool = fresh.length ? fresh : list; const n = pool[randInt(pool.length)] || ""; setQ(n); setData((d) => ({ ...d, used: fresh.length ? [...d.used, n].slice(-500) : [n] })); };
  useEffect(() => { draw(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">{Object.keys(decks).map((d) => <button key={d} type="button" onClick={() => setDeck(d)} className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${deck === d ? "bg-amber-500 text-white ring-amber-500" : "bg-white ring-slate-200"}`}>{d}</button>)}</div>
    <div className="flex min-h-[240px] items-center justify-center rounded-3xl p-8 text-center shadow-lg" style={{ background: "linear-gradient(135deg,#fde68a,#fb923c)" }}><p className="max-w-2xl text-3xl font-black text-slate-900">{q}</p></div>
    <div className="flex justify-center gap-2"><Btn kind="primary" color="#ea580c" big onClick={draw}><Shuffle size={18} />Next question</Btn><Btn big onClick={() => setFull(true)}>Show on screen</Btn></div>
    <Card title="Add your own"><div className="flex gap-2"><input value={mine} onChange={(e) => setMine(e.target.value)} placeholder="Your question" className={inputCls} /><Btn onClick={() => { if (mine.trim()) setData((d) => ({ ...d, mine: [...d.mine, mine.trim()] })); setMine(""); }}><Plus size={14} />Add</Btn></div></Card>
    {full && <FullScreen bg="#ea580c" onClose={() => setFull(false)}><p className="max-w-5xl px-8 text-center text-6xl font-black leading-tight">{q}</p><button type="button" onClick={draw} className="mt-10 rounded-full bg-white px-8 py-4 text-xl font-black text-orange-600">Next question</button></FullScreen>}
  </div>;
}

// ─── Retrospective ───
type RCard = { id: string; col: number; text: string; votes: number };
type Retro = { id: string; title: string; date: string; cards: RCard[]; actions: string[] };
const RCOLS = [{ t: "Went well 😊", c: "#16a34a" }, { t: "To improve 🤔", c: "#f59e0b" }, { t: "Ideas 💡", c: "#2563eb" }];
function RetroApp() {
  const { data, setData } = usePro<{ retros: Retro[] }>("retro", { retros: [] });
  const [cur, setCur] = useState<Retro | null>(null);
  const [text, setText] = useState<Record<number, string>>({});
  const save = (r: Retro) => { setCur(r); setData((d) => ({ retros: [r, ...d.retros.filter((x) => x.id !== r.id)] })); };
  if (cur) return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><Btn onClick={() => setCur(null)}>← All retros</Btn><input value={cur.title} onChange={(e) => save({ ...cur, title: e.target.value })} className={fit("w-64 font-bold")} /><span className="text-sm text-slate-500">{fmtDay(cur.date)}</span></div>
    <div className="grid gap-3 md:grid-cols-3">{RCOLS.map((c, ci) => <div key={ci} className="rounded-2xl p-3" style={{ background: `${c.c}12` }}><p className="mb-2 font-black" style={{ color: c.c }}>{c.t}</p>
      <div className="space-y-2">{cur.cards.filter((x) => x.col === ci).sort((a, b) => b.votes - a.votes).map((x) => <div key={x.id} className="rounded-xl bg-white p-2.5 text-sm shadow-sm"><p>{x.text}</p><div className="mt-1 flex items-center gap-2"><button type="button" onClick={() => save({ ...cur, cards: cur.cards.map((y) => (y.id === x.id ? { ...y, votes: y.votes + 1 } : y)) })} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold"><ThumbsUp size={11} />{x.votes}</button><button type="button" onClick={() => save({ ...cur, actions: [...cur.actions, x.text] })} className="text-xs font-bold text-slate-500">→ action</button><button type="button" aria-label="Delete" onClick={() => save({ ...cur, cards: cur.cards.filter((y) => y.id !== x.id) })} className="ml-auto text-slate-300 hover:text-rose-600"><Trash2 size={12} /></button></div></div>)}</div>
      <input value={text[ci] || ""} onChange={(e) => setText({ ...text, [ci]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && (text[ci] || "").trim()) { save({ ...cur, cards: [...cur.cards, { id: uid(), col: ci, text: text[ci].trim(), votes: 0 }] }); setText({ ...text, [ci]: "" }); } }} placeholder="+ Add a card (Enter)" className="mt-2 w-full rounded-lg border border-dashed border-slate-300 bg-white/60 px-2 py-1.5 text-sm" />
    </div>)}</div>
    <Card title="Action items">{cur.actions.map((a, i) => <div key={i} className="mb-1 flex gap-2"><input value={a} onChange={(e) => save({ ...cur, actions: cur.actions.map((x, j) => (j === i ? e.target.value : x)) })} className={inputCls} /><button type="button" aria-label="Remove" onClick={() => save({ ...cur, actions: cur.actions.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></div>)}<Btn onClick={() => save({ ...cur, actions: [...cur.actions, ""] })}><Plus size={14} />Action</Btn></Card>
  </div>;
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color="#0d9488" onClick={() => save({ id: uid(), title: `Retro ${fmtDay(today(), { month: "short", day: "numeric" })}`, date: today(), cards: [], actions: [] })}><Plus size={16} />New retro</Btn></div>
    {data.retros.length ? <div className="grid gap-3 sm:grid-cols-2">{data.retros.map((r) => <button key={r.id} type="button" onClick={() => setCur(r)} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200"><p className="font-black">{r.title}</p><p className="text-xs text-slate-500">{r.cards.length} cards · {r.actions.length} actions</p></button>)}</div> : <Empty>Run a retrospective after a project, a unit or a term.</Empty>}
  </div>;
}

// ─── Meeting cost clock ───
function MeetingCost() {
  const { data, setData } = usePro<{ people: { role: string; count: number; rate: number }[]; salary: boolean }>("meeting-cost", { people: [{ role: "Team members", count: 6, rate: 45 }, { role: "Managers", count: 1, rate: 75 }], salary: false });
  const [start, setStart] = useState<number | null>(null); const [paused, setPaused] = useState(0); const [pauseAt, setPauseAt] = useState<number | null>(null);
  useTick(start !== null && pauseAt === null, 200);
  const perHour = data.people.reduce((a, p) => a + p.count * (data.salary ? p.rate / 2080 : p.rate), 0);
  const sec = start ? ((pauseAt ?? Date.now()) - start - paused) / 1000 : 0;
  const cost = (perHour * sec) / 3600;
  return <div className="space-y-4">
    <Card className="text-center" tint="linear-gradient(180deg,#fef2f2,#fff)"><p className="text-sm font-bold text-slate-500">This meeting has cost</p><p className="font-mono text-6xl font-black text-rose-600 tabular-nums sm:text-7xl">{money(cost)}</p><p className="mt-1 font-mono text-lg">{fmtDuration(sec)} · {money(perHour)} per hour · {data.people.reduce((a, p) => a + p.count, 0)} people</p>
      <div className="mt-4 flex justify-center gap-2">{start === null ? <Btn kind="primary" color="#dc2626" big onClick={() => { setStart(Date.now()); setPaused(0); setPauseAt(null); }}><Play size={18} />Start meeting</Btn> : pauseAt === null ? <Btn big onClick={() => setPauseAt(Date.now())}><Pause size={18} />Pause</Btn> : <Btn kind="primary" color="#dc2626" big onClick={() => { setPaused(paused + Date.now() - pauseAt); setPauseAt(null); }}><Play size={18} />Resume</Btn>}{start !== null && <Btn onClick={() => setStart(null)}>Reset</Btn>}</div></Card>
    <Card title="Who's in the room" right={<label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={data.salary} onChange={(e) => setData((d) => ({ ...d, salary: e.target.checked }))} />Enter yearly salaries</label>}>{data.people.map((p, i) => <div key={i} className="mb-2 grid grid-cols-[1fr_80px_120px_auto] gap-2"><input value={p.role} onChange={(e) => setData((d) => ({ ...d, people: d.people.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) }))} className={inputCls} /><NumIn value={p.count} onChange={(n) => setData((d) => ({ ...d, people: d.people.map((x, j) => (j === i ? { ...x, count: Number(n) || 0 } : x)) }))} /><NumIn value={p.rate} onChange={(n) => setData((d) => ({ ...d, people: d.people.map((x, j) => (j === i ? { ...x, rate: Number(n) || 0 } : x)) }))} placeholder={data.salary ? "$/year" : "$/hour"} /><button type="button" aria-label="Remove" onClick={() => setData((d) => ({ ...d, people: d.people.filter((_, j) => j !== i) }))} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></div>)}<Btn onClick={() => setData((d) => ({ ...d, people: [...d.people, { role: "Guests", count: 1, rate: 40 }] }))}><Plus size={14} />Add</Btn></Card>
    <div className="grid grid-cols-3 gap-2">{[15, 30, 60].map((m) => <Stat key={m} label={`A ${m}-minute meeting`} value={money((perHour * m) / 60)} />)}</div>
  </div>;
}

// ─── Find a time ───
function FindTime() {
  const { data, setData } = usePro<{ days: string[]; from: number; to: number; people: { name: string; free: string[] }[] }>("find-time", { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], from: 8, to: 17, people: [{ name: "Me", free: [] }] });
  const [who, setWho] = useState(0); const [name, setName] = useState("");
  const [painting, setPainting] = useState<boolean | null>(null);
  const hours = Array.from({ length: Math.max(1, data.to - data.from) }, (_, i) => data.from + i);
  const slots = data.days.flatMap((d) => hours.map((h) => `${d} ${h}`));
  const count = (s: string) => data.people.filter((p) => p.free.includes(s)).length;
  const set = (s: string, on: boolean) => setData((d) => ({ ...d, people: d.people.map((p, i) => (i === who ? { ...p, free: on ? [...new Set([...p.free, s])] : p.free.filter((x) => x !== s) } : p)) }));
  const best = [...slots].sort((a, b) => count(b) - count(a)).filter((s) => count(s) > 0).slice(0, 5);
  const label = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  const p = data.people[who];
  return <div className="space-y-4" onPointerUp={() => setPainting(null)}>
    <Card title="Who is marking their free time?"><div className="flex flex-wrap gap-2">{data.people.map((x, i) => <button key={i} type="button" onClick={() => setWho(i)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${who === i ? "bg-emerald-600 text-white" : "bg-slate-100"}`}>{x.name} <span className="opacity-70">{x.free.length}</span></button>)}<input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { setData((d) => ({ ...d, people: [...d.people, { name: name.trim(), free: [] }] })); setWho(data.people.length); setName(""); } }} placeholder="+ Person (Enter)" className="h-9 rounded-full border border-dashed border-slate-300 px-3 text-sm" /></div>
      <p className="mt-2 text-xs text-slate-500">{p ? <>Tap or drag across the hours <b>{p.name}</b> is free. Darker green = more people free.</> : null}</p></Card>
    <Card><div className="overflow-x-auto"><table className="select-none text-xs"><thead><tr><th />{data.days.map((d) => <th key={d} className="px-1 py-1 font-bold">{d}</th>)}</tr></thead><tbody>{hours.map((h) => <tr key={h}><td className="pr-2 text-right text-slate-500">{label(h)}</td>{data.days.map((d) => { const s = `${d} ${h}`, n = count(s), mine = p?.free.includes(s); return <td key={d} className="p-0.5"><div onPointerDown={() => { const on = !mine; setPainting(on); set(s, on); }} onPointerEnter={() => { if (painting !== null) set(s, painting); }} className={`h-8 w-16 cursor-pointer rounded-md text-center leading-8 ${mine ? "ring-2 ring-emerald-700" : ""}`} style={{ background: n ? `rgba(22,163,74,${0.15 + 0.85 * (n / data.people.length)})` : "#f1f5f9", color: n / data.people.length > 0.6 ? "#fff" : "#334155" }}>{n ? `${n}/${data.people.length}` : ""}</div></td>; })}</tr>)}</tbody></table></div></Card>
    <Card title="Best times">{best.length ? <ol className="space-y-1 text-sm">{best.map((s) => { const [d, h] = s.split(" "); return <li key={s}><b>{d} {label(Number(h))}</b> — {count(s)} of {data.people.length} free <span className="text-slate-500">({data.people.filter((x) => !x.free.includes(s)).map((x) => x.name).join(", ") || "everyone!"}{data.people.some((x) => !x.free.includes(s)) ? " can't" : ""})</span></li>; })}</ol> : <Empty>Mark some free times.</Empty>}
      {best.length > 0 && <Btn className="mt-2" onClick={() => void navigator.clipboard?.writeText(best.map((s) => { const [d, h] = s.split(" "); return `${d} ${label(Number(h))}: ${count(s)}/${data.people.length} free`; }).join("\n"))}><Copy size={14} />Copy</Btn>}</Card>
    <Card title="Settings"><div className="flex flex-wrap items-center gap-3 text-sm">From <NumIn value={data.from} onChange={(n) => setData((d) => ({ ...d, from: Math.max(0, Math.min(23, Number(n) || 0)) }))} className="w-20" /> to <NumIn value={data.to} onChange={(n) => setData((d) => ({ ...d, to: Math.max(d.from + 1, Math.min(24, Number(n) || 17)) }))} className="w-20" /><span>Days</span>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <label key={d} className="flex items-center gap-1"><input type="checkbox" checked={data.days.includes(d)} onChange={(e) => setData((x) => ({ ...x, days: e.target.checked ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].filter((y) => x.days.includes(y) || y === d) : x.days.filter((y) => y !== d) }))} />{d}</label>)}<Btn kind="danger" onClick={() => setData((d) => ({ ...d, people: d.people.map((x) => ({ ...x, free: [] })) }))}>Clear all</Btn></div></Card>
  </div>;
}

export const MEETINGS: Record<string, ComponentType> = {
  agenda: AgendaApp, minutes: MinutesApp, standup: Standup, poll: PollApp, icebreakers: Icebreakers, retro: RetroApp, "meeting-cost": MeetingCost, "find-time": FindTime,
};

