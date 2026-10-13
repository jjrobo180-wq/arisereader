// School & study apps: spaced-repetition flashcards, a quiz maker, GPA and final-grade
// calculators, a citation maker, a study planner that plans backwards from the test, an essay
// outliner, a vocabulary builder and a reading log. Puzzles and practice live in school2.tsx.
import { useMemo, useState, type ComponentType } from "react";
import { BookOpen, Check, Copy, Pencil, Play, Plus, Printer, RotateCcw, Shuffle, Sparkles, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { askAppAi } from "@/lib/cloudDocs";
import { BOX_DAYS, CiteStyle, LETTERS, MAX_BOX, Source, SourceKind, blankSource, cite, citeHtml, citePlain, gpa, isDue, neededOnFinal, review, sortKey, spreadSessions, toLetter, weightedGrade, type ClassLevel } from "@shared/pro/school";
import { Bar, Btn, Card, Empty, Field, Heatmap, Modal, NumIn, Ring, Stat, Tabs, addDays, chime, daysBetween, esc, fit, fmtDay, fmtNum, inputCls, printPage, shuffle, streak, today, uid, usePro } from "../kit";
import { SCHOOL2 } from "./school2";

const GREEN = "#16a34a";
const AI = "#7c3aed";
const area = `${inputCls} h-auto py-2`;

/** A small "make it with AI" dialog used by several apps. */
function AiBox({ title, fields, onClose, run, cta }: { title: string; fields: { key: string; label: string; area?: boolean; placeholder?: string; options?: string[] }[]; onClose: () => void; run: (v: Record<string, string>) => Promise<void>; cta: string }) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, f.options ? f.options[0] : ""])));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const go = async () => { setBusy(true); setErr(""); try { await run(v); onClose(); } catch (e: any) { setErr(e?.message || "Something went wrong."); setBusy(false); } };
  const first = fields[0];
  return <Modal title={title} onClose={onClose} footer={<Btn kind="primary" color={AI} disabled={busy || !v[first.key]?.trim()} onClick={() => void go()}><Sparkles size={15} />{busy ? "Working…" : cta}</Btn>}>
    <div className="space-y-3">{fields.map((f) => <Field key={f.key} label={f.label}>{f.options ? <select value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} className={inputCls}>{f.options.map((o) => <option key={o}>{o}</option>)}</select> : f.area ? <textarea rows={4} value={v[f.key]} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} className={area} /> : <input value={v[f.key]} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} className={inputCls} />}</Field>)}{err && <p className="text-sm text-rose-600">{err}</p>}</div>
  </Modal>;
}
const LEVELS = ["middle school", "elementary", "high school", "college"];

// ─── Flashcards ───
type FCard = { id: string; front: string; back: string; box: number; due: string };
type Deck = { id: string; name: string; color: string; cards: FCard[] };
const DECK_COLORS = ["#16a34a", "#2563eb", "#db2777", "#ea580c", "#7c3aed", "#0891b2"];
/** "front - back", "front: back" or tab-separated, one per line. */
function parseCards(text: string): FCard[] {
  return text.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const m = /^(.*?)\s*(?:\t|\s[-–—]\s|:\s|=\s)\s*(.+)$/.exec(l); return m ? { id: uid(), front: m[1].trim(), back: m[2].trim(), box: 1, due: "" } : null; }).filter((x): x is FCard => !!x && !!x.front);
}
function Flashcards() {
  const { token } = useAuth();
  const { data, setData } = usePro<{ decks: Deck[]; log: Record<string, number> }>("flashcards", { decks: [], log: {} });
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"study" | "quiz" | "cards">("study");
  const [ai, setAi] = useState(false); const [bulk, setBulk] = useState<string | null>(null);
  const [draft, setDraft] = useState({ front: "", back: "" });
  const [session, setSession] = useState<{ queue: string[]; i: number; flipped: boolean; right: number; wrong: number } | null>(null);
  const [quiz, setQuiz] = useState<{ qs: { id: string; choices: string[] }[]; i: number; picked: number | null; score: number } | null>(null);
  const deck = data.decks.find((d) => d.id === openId) || null;
  const putDeck = (d: Deck) => setData((s) => ({ ...s, decks: s.decks.map((x) => (x.id === d.id ? d : x)) }));
  const t = today();
  const newDeck = () => { const d: Deck = { id: uid(), name: `Deck ${data.decks.length + 1}`, color: DECK_COLORS[data.decks.length % DECK_COLORS.length], cards: [] }; setData((s) => ({ ...s, decks: [d, ...s.decks] })); setOpenId(d.id); setTab("cards"); };
  const startStudy = (all = false) => { if (!deck) return; const q = shuffle(deck.cards.filter((c) => all || isDue(c, t))).sort((a, b) => a.box - b.box).map((c) => c.id); setSession({ queue: q, i: 0, flipped: false, right: 0, wrong: 0 }); };
  const answer = (ok: boolean) => {
    if (!deck || !session) return;
    const id = session.queue[session.i]; const c = deck.cards.find((x) => x.id === id); if (!c) return;
    const next = review(c, ok, t);
    putDeck({ ...deck, cards: deck.cards.map((x) => (x.id === id ? { ...x, ...next } : x)) });
    setData((s) => ({ ...s, log: { ...s.log, [t]: (s.log[t] || 0) + 1 } }));
    // A miss comes back again at the end of this session.
    const queue = ok ? session.queue : [...session.queue, id];
    setSession({ queue, i: session.i + 1, flipped: false, right: session.right + (ok ? 1 : 0), wrong: session.wrong + (ok ? 0 : 1) });
    if (session.i + 1 >= queue.length) chime();
  };
  const startQuiz = () => { if (!deck || deck.cards.length < 4) return; const pick = shuffle(deck.cards).slice(0, Math.min(10, deck.cards.length)); setQuiz({ qs: pick.map((c) => ({ id: c.id, choices: shuffle([c.back, ...shuffle(deck.cards.filter((x) => x.id !== c.id && x.back !== c.back).map((x) => x.back)).slice(0, 3)]) })), i: 0, picked: null, score: 0 }); };
  const makeAi = async (v: Record<string, string>) => {
    if (!deck) return;
    const r = await askAppAi<{ cards: { front: string; back: string }[] }>(token, "flashcards", { topic: v.topic, text: v.text, count: v.count, level: v.level });
    const cards = (r.cards || []).filter((c) => c.front && c.back).map((c) => ({ id: uid(), front: String(c.front), back: String(c.back), box: 1, due: "" }));
    if (!cards.length) throw new Error("No cards came back — try a more specific topic.");
    putDeck({ ...deck, cards: [...deck.cards, ...cards] });
  };

  if (!deck) {
    const st = streak((d) => !!data.log[d]);
    return <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3"><Stat label="Decks" value={data.decks.length} /><Stat label="Due today" value={data.decks.reduce((s, d) => s + d.cards.filter((c) => isDue(c, t)).length, 0)} color={GREEN} /><Stat label="Study streak" value={`${st} day${st === 1 ? "" : "s"}`} /></div>
      <div className="flex justify-end"><Btn kind="primary" color={GREEN} onClick={newDeck}><Plus size={16} />New deck</Btn></div>
      {data.decks.length ? <div className="grid gap-3 sm:grid-cols-2">{data.decks.map((d) => { const due = d.cards.filter((c) => isDue(c, t)).length; const m = d.cards.filter((c) => c.box >= 5).length; return <button key={d.id} type="button" onClick={() => { setOpenId(d.id); setTab(d.cards.length ? "study" : "cards"); setSession(null); setQuiz(null); }} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-2" style={{ borderTop: `5px solid ${d.color}` }}>
        <p className="text-lg font-black">{d.name}</p><p className="text-xs text-slate-500">{d.cards.length} cards · <b style={{ color: due ? d.color : undefined }}>{due} due</b> · {m} mastered</p><Bar value={m} max={d.cards.length || 1} color={d.color} className="mt-2" />
      </button>; })}</div> : <Empty>Make a deck for each subject. Cards you get right come back less often; ones you miss come back sooner — the fastest way to remember.</Empty>}
      {Object.keys(data.log).length > 0 && <Card title="Cards studied"><Heatmap values={data.log} color={GREEN} label={(d, v) => `${fmtDay(d)}: ${v} cards`} /></Card>}
    </div>;
  }

  const cur = session && session.i < session.queue.length ? deck.cards.find((c) => c.id === session.queue[session.i]) : null;
  const dueN = deck.cards.filter((c) => isDue(c, t)).length;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><Btn onClick={() => { setOpenId(null); setSession(null); setQuiz(null); }}>← Decks</Btn><input value={deck.name} onChange={(e) => putDeck({ ...deck, name: e.target.value })} className={`${fit("w-56")} font-black`} aria-label="Deck name" /><div className="flex gap-1">{DECK_COLORS.map((c) => <button key={c} type="button" aria-label="Colour" onClick={() => putDeck({ ...deck, color: c })} className={`h-6 w-6 rounded-full ${deck.color === c ? "ring-2 ring-slate-900 ring-offset-2" : ""}`} style={{ background: c }} />)}</div></div>
    <Tabs value={tab} onChange={(v) => { setTab(v); setSession(null); setQuiz(null); }} color={deck.color} items={[{ id: "study", label: `Study (${dueN} due)` }, { id: "quiz", label: "Quiz" }, { id: "cards", label: `Cards (${deck.cards.length})` }]} />
    {tab === "study" && (!session ? <Card><div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="flex flex-wrap justify-center gap-2">{Array.from({ length: MAX_BOX }, (_, i) => i + 1).map((b) => <div key={b} className="w-20 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200"><p className="text-xl font-black" style={{ color: deck.color }}>{deck.cards.filter((c) => Math.max(1, c.box) === b).length}</p><p className="text-[10px] font-bold uppercase text-slate-500">Box {b}</p><p className="text-[10px] text-slate-400">{b === 1 ? "every time" : `every ${BOX_DAYS[b]}d`}</p></div>)}</div>
      {deck.cards.length ? <>{dueN ? <Btn big kind="primary" color={deck.color} onClick={() => startStudy()}><Play size={18} />Study {dueN} due card{dueN === 1 ? "" : "s"}</Btn> : <p className="font-bold text-emerald-700">All caught up! Nothing is due today.</p>}<Btn onClick={() => startStudy(true)}><Shuffle size={14} />Practise all {deck.cards.length}</Btn></> : <Empty>Add some cards first.</Empty>}
    </div></Card> : cur ? <div className="mx-auto max-w-xl space-y-3">
      <div className="flex items-center justify-between text-sm text-slate-500"><span>Card {session.i + 1} of {session.queue.length}</span><span className="text-emerald-700">✓ {session.right}</span><span className="text-rose-600">✗ {session.wrong}</span><Btn onClick={() => setSession(null)}>End</Btn></div>
      <button type="button" onClick={() => setSession({ ...session, flipped: !session.flipped })} className="flex min-h-[260px] w-full flex-col items-center justify-center rounded-3xl p-8 text-center shadow-lg transition" style={{ background: session.flipped ? "white" : deck.color, color: session.flipped ? "#0f172a" : "white", border: `3px solid ${deck.color}` }}>
        <p className="text-xs font-bold uppercase opacity-70">{session.flipped ? "Answer" : "Question"} · box {Math.max(1, cur.box)}</p><p className="mt-3 whitespace-pre-wrap text-3xl font-black">{session.flipped ? cur.back : cur.front}</p>{!session.flipped && <p className="mt-6 text-sm opacity-80">Tap to flip</p>}
      </button>
      {session.flipped ? <div className="grid grid-cols-2 gap-3"><Btn big kind="danger" onClick={() => answer(false)}><X size={18} />Missed it</Btn><Btn big kind="primary" color={GREEN} onClick={() => answer(true)}><Check size={18} />Got it</Btn></div> : <Btn big kind="soft" color={deck.color} className="w-full" onClick={() => setSession({ ...session, flipped: true })}>Show answer</Btn>}
    </div> : <Card><div className="py-8 text-center"><p className="text-5xl">🎉</p><p className="mt-2 text-2xl font-black">Session done!</p><p className="text-slate-600">{session.right} right · {session.wrong} to practise again</p><div className="mt-4 flex justify-center gap-2"><Btn onClick={() => setSession(null)}>Back</Btn><Btn kind="primary" color={deck.color} onClick={() => startStudy(true)}><RotateCcw size={14} />Go again</Btn></div></div></Card>)}
    {tab === "quiz" && (deck.cards.length < 4 ? <Empty>A quiz needs at least 4 cards.</Empty> : !quiz ? <Card><div className="py-6 text-center"><p className="text-slate-600">Multiple choice from your cards — up to 10 questions.</p><Btn big kind="primary" color={deck.color} className="mt-3" onClick={startQuiz}><Play size={18} />Start quiz</Btn></div></Card> : quiz.i < quiz.qs.length ? (() => { const q = quiz.qs[quiz.i]; const c = deck.cards.find((x) => x.id === q.id)!; return <div className="mx-auto max-w-xl space-y-3">
      <p className="text-sm text-slate-500">Question {quiz.i + 1} of {quiz.qs.length} · score {quiz.score}</p>
      <div className="rounded-3xl p-6 text-center text-2xl font-black text-white" style={{ background: deck.color }}>{c.front}</div>
      <div className="grid gap-2">{q.choices.map((ch, i) => { const right = ch === c.back; const show = quiz.picked !== null; return <button key={i} type="button" disabled={show} onClick={() => setQuiz({ ...quiz, picked: i, score: quiz.score + (right ? 1 : 0) })} className={`rounded-xl p-3 text-left font-bold ring-1 ${show && right ? "bg-emerald-100 ring-emerald-400" : show && quiz.picked === i ? "bg-rose-100 ring-rose-400" : "bg-white ring-slate-200 hover:bg-slate-50"}`}>{ch}</button>; })}</div>
      {quiz.picked !== null && <Btn big kind="primary" color={deck.color} className="w-full" onClick={() => { if (quiz.i + 1 >= quiz.qs.length) chime(); setQuiz({ ...quiz, i: quiz.i + 1, picked: null }); }}>Next</Btn>}
    </div>; })() : <Card><div className="py-6 text-center"><Ring value={quiz.score} max={quiz.qs.length} color={deck.color}><p className="text-3xl font-black">{Math.round((quiz.score / quiz.qs.length) * 100)}%</p></Ring><p className="mt-2 font-bold">{quiz.score} of {quiz.qs.length} right</p><Btn className="mt-3" kind="primary" color={deck.color} onClick={startQuiz}><RotateCcw size={14} />New quiz</Btn></div></Card>)}
    {tab === "cards" && <>
      <Card><div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><textarea rows={2} value={draft.front} onChange={(e) => setDraft({ ...draft, front: e.target.value })} placeholder="Front (question or word)" className={area} /><textarea rows={2} value={draft.back} onChange={(e) => setDraft({ ...draft, back: e.target.value })} placeholder="Back (answer)" className={area} /><Btn kind="primary" color={deck.color} disabled={!draft.front.trim() || !draft.back.trim()} onClick={() => { putDeck({ ...deck, cards: [...deck.cards, { id: uid(), front: draft.front.trim(), back: draft.back.trim(), box: 1, due: "" }] }); setDraft({ front: "", back: "" }); }}><Plus size={15} />Add</Btn></div>
        <div className="mt-3 flex flex-wrap gap-2"><Btn kind="soft" color={AI} onClick={() => setAi(true)}><Sparkles size={14} />AI cards</Btn><Btn onClick={() => setBulk("")}>Paste a list</Btn><span className="flex-1" /><Btn onClick={() => printPage(deck.name, `<h1>${esc(deck.name)}</h1><table>${deck.cards.map((c) => `<tr><td style="width:45%"><b>${esc(c.front)}</b></td><td>${esc(c.back)}</td></tr>`).join("")}</table>`)}><Printer size={14} />Print</Btn><Btn kind="danger" onClick={() => { if (window.confirm(`Delete “${deck.name}”?`)) { setData((s) => ({ ...s, decks: s.decks.filter((d) => d.id !== deck.id) })); setOpenId(null); } }}><Trash2 size={14} />Deck</Btn></div></Card>
      {deck.cards.length ? <div className="space-y-2">{deck.cards.map((c) => <div key={c.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-200">
        <input value={c.front} onChange={(e) => putDeck({ ...deck, cards: deck.cards.map((x) => (x.id === c.id ? { ...x, front: e.target.value } : x)) })} className={`${inputCls} font-bold`} /><input value={c.back} onChange={(e) => putDeck({ ...deck, cards: deck.cards.map((x) => (x.id === c.id ? { ...x, back: e.target.value } : x)) })} className={inputCls} />
        <div className="flex items-center gap-1"><span className="rounded-full bg-slate-100 px-2 text-[10px] font-bold text-slate-500">box {Math.max(1, c.box)}</span><button type="button" aria-label="Delete card" onClick={() => putDeck({ ...deck, cards: deck.cards.filter((x) => x.id !== c.id) })} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button></div>
      </div>)}</div> : <Empty>No cards yet. Type them above, paste a list, or let AI make them from your notes.</Empty>}
    </>}
    {ai && <AiBox title="AI flashcards" cta="Make cards" onClose={() => setAi(false)} run={makeAi} fields={[{ key: "topic", label: "Topic", placeholder: "Parts of a cell" }, { key: "text", label: "Your notes (optional)", area: true, placeholder: "Paste class notes and the cards come from them" }, { key: "count", label: "How many", options: ["15", "10", "20", "30"] }, { key: "level", label: "Level", options: LEVELS }]} />}
    {bulk !== null && <Modal title="Paste a list" onClose={() => setBulk(null)} footer={<Btn kind="primary" color={deck.color} disabled={!parseCards(bulk).length} onClick={() => { putDeck({ ...deck, cards: [...deck.cards, ...parseCards(bulk)] }); setBulk(null); }}>Add {parseCards(bulk).length} cards</Btn>}><p className="mb-2 text-sm text-slate-600">One card per line: <code>front - back</code>, <code>front: back</code>, or copied from a spreadsheet (two columns).</p><textarea rows={10} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"photosynthesis - how plants make food from light\nmitochondria - powerhouse of the cell"} className={area} /></Modal>}
  </div>;
}

// ─── Quiz Maker ───
type QQ = { id: string; q: string; choices: string[]; answer: number; why: string };
type Quiz = { id: string; title: string; questions: QQ[]; results: { day: string; score: number; total: number }[] };
const blankQ = (): QQ => ({ id: uid(), q: "", choices: ["", "", "", ""], answer: 0, why: "" });
function QuizMaker() {
  const { token } = useAuth();
  const { data, setData } = usePro<{ quizzes: Quiz[] }>("quiz-maker", { quizzes: [] });
  const [id, setId] = useState<string | null>(null); const [ai, setAi] = useState(false);
  const [play, setPlay] = useState<{ order: string[]; i: number; picks: Record<string, number> } | null>(null);
  const quiz = data.quizzes.find((q) => q.id === id) || null;
  const put = (q: Quiz) => setData((s) => ({ quizzes: s.quizzes.some((x) => x.id === q.id) ? s.quizzes.map((x) => (x.id === q.id ? q : x)) : [q, ...s.quizzes] }));
  const ready = (q: Quiz) => q.questions.filter((x) => x.q.trim() && x.choices.filter((c) => c.trim()).length >= 2 && x.choices[x.answer]?.trim());
  const makeAi = async (v: Record<string, string>) => {
    const r = await askAppAi<{ questions: { q: string; choices: string[]; answer: number; why: string }[] }>(token, "quiz", { topic: v.topic, text: v.text, count: v.count, level: v.level });
    const qs = (r.questions || []).filter((x) => x.q && Array.isArray(x.choices)).map((x) => ({ id: uid(), q: String(x.q), choices: [...x.choices.map(String), "", "", "", ""].slice(0, 4), answer: Math.max(0, Math.min(3, Number(x.answer) || 0)), why: String(x.why || "") }));
    if (!qs.length) throw new Error("No questions came back — try again.");
    const q: Quiz = quiz ? { ...quiz, questions: [...quiz.questions.filter((x) => x.q.trim()), ...qs] } : { id: uid(), title: v.topic, questions: qs, results: [] };
    put(q); setId(q.id);
  };
  const printQuiz = (q: Quiz, key: boolean) => { const qs = ready(q); printPage(q.title, `<h1>${esc(q.title)}</h1><p class="muted">Name: ____________________ &nbsp; Date: __________ &nbsp; Score: ____ / ${qs.length}</p>${qs.map((x, n) => `<div style="margin:14px 0;page-break-inside:avoid"><b>${n + 1}. ${esc(x.q)}</b>${x.choices.map((c, i) => (c.trim() ? `<div style="margin:4px 0 0 18px">${"ABCD"[i]}. ${esc(c)}</div>` : "")).join("")}</div>`).join("")}${key ? `<h2 style="page-break-before:always">Answer key</h2><ol>${qs.map((x) => `<li><b>${"ABCD"[x.answer]}</b> — ${esc(x.choices[x.answer])}${x.why ? `<br><span class="muted">${esc(x.why)}</span>` : ""}</li>`).join("")}</ol>` : ""}`); };

  if (play && quiz) {
    const qs = play.order.map((i) => quiz.questions.find((x) => x.id === i)!).filter(Boolean);
    if (play.i >= qs.length) {
      const score = qs.filter((x) => play.picks[x.id] === x.answer).length;
      return <div className="space-y-4"><Card><div className="py-4 text-center"><Ring value={score} max={qs.length} color="#2563eb"><p className="text-3xl font-black">{Math.round((score / qs.length) * 100)}%</p></Ring><p className="mt-2 text-xl font-black">{score} of {qs.length}</p><div className="mt-3 flex justify-center gap-2"><Btn onClick={() => setPlay(null)}>Done</Btn><Btn kind="primary" color="#2563eb" onClick={() => setPlay({ order: shuffle(qs.map((x) => x.id)), i: 0, picks: {} })}><RotateCcw size={14} />Retake</Btn></div></div></Card>
        <Card title="Review">{qs.map((x, n) => { const ok = play.picks[x.id] === x.answer; return <div key={x.id} className={`mb-2 rounded-xl p-3 ${ok ? "bg-emerald-50" : "bg-rose-50"}`}><p className="font-bold">{n + 1}. {x.q}</p><p className="text-sm">{ok ? "✓" : "✗"} You said: {x.choices[play.picks[x.id]] ?? "—"}{!ok && <> · Answer: <b>{x.choices[x.answer]}</b></>}</p>{x.why && <p className="text-sm text-slate-600">{x.why}</p>}</div>; })}</Card></div>;
    }
    const x = qs[play.i]; const picked = play.picks[x.id];
    return <div className="mx-auto max-w-xl space-y-3">
      <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{quiz.title} · {play.i + 1} / {qs.length}</p><Btn onClick={() => setPlay(null)}>Quit</Btn></div><Bar value={play.i} max={qs.length} color="#2563eb" />
      <p className="rounded-2xl bg-blue-600 p-6 text-2xl font-black text-white">{x.q}</p>
      <div className="grid gap-2">{x.choices.map((c, i) => c.trim() && <button key={i} type="button" disabled={picked !== undefined} onClick={() => setPlay({ ...play, picks: { ...play.picks, [x.id]: i } })} className={`flex items-center gap-3 rounded-xl p-3 text-left font-bold ring-1 ${picked !== undefined && i === x.answer ? "bg-emerald-100 ring-emerald-400" : picked === i ? "bg-rose-100 ring-rose-400" : "bg-white ring-slate-200 hover:bg-slate-50"}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">{"ABCD"[i]}</span>{c}</button>)}</div>
      {picked !== undefined && <>{x.why && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{x.why}</p>}<Btn big kind="primary" color="#2563eb" className="w-full" onClick={() => { const nx = play.i + 1; if (nx >= qs.length) { const score = qs.filter((q) => (q.id === x.id ? picked : play.picks[q.id]) === q.answer).length; put({ ...quiz, results: [{ day: today(), score, total: qs.length }, ...quiz.results].slice(0, 30) }); chime(); } setPlay({ ...play, i: nx }); }}>{play.i + 1 >= qs.length ? "See score" : "Next"}</Btn></>}
    </div>;
  }
  if (quiz) {
    const ok = ready(quiz);
    return <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><Btn onClick={() => setId(null)}>← Quizzes</Btn><span className="flex-1" /><Btn kind="soft" color={AI} onClick={() => setAi(true)}><Sparkles size={14} />Add AI questions</Btn><Btn onClick={() => printQuiz(quiz, true)}><Printer size={14} />Print + key</Btn><Btn kind="primary" color="#2563eb" disabled={!ok.length} onClick={() => setPlay({ order: shuffle(ok.map((x) => x.id)), i: 0, picks: {} })}><Play size={15} />Take quiz</Btn></div>
      <Card><Field label="Quiz title"><input value={quiz.title} onChange={(e) => put({ ...quiz, title: e.target.value })} className={inputCls} /></Field>{quiz.results.length > 0 && <p className="mt-2 text-xs text-slate-500">Last scores: {quiz.results.slice(0, 6).map((r) => `${r.score}/${r.total}`).join(" · ")}</p>}</Card>
      {quiz.questions.map((x, n) => <Card key={x.id} title={`Question ${n + 1}`} right={<button type="button" aria-label="Delete question" onClick={() => put({ ...quiz, questions: quiz.questions.filter((y) => y.id !== x.id) })} className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>}>
        <textarea rows={2} value={x.q} onChange={(e) => put({ ...quiz, questions: quiz.questions.map((y) => (y.id === x.id ? { ...y, q: e.target.value } : y)) })} placeholder="Question" className={area} />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{x.choices.map((c, i) => <label key={i} className={`flex items-center gap-2 rounded-xl p-1 pl-2 ring-1 ${x.answer === i ? "bg-emerald-50 ring-emerald-300" : "ring-slate-200"}`}><input type="radio" checked={x.answer === i} onChange={() => put({ ...quiz, questions: quiz.questions.map((y) => (y.id === x.id ? { ...y, answer: i } : y)) })} aria-label={`Correct answer ${"ABCD"[i]}`} /><b className="text-slate-500">{"ABCD"[i]}</b><input value={c} onChange={(e) => put({ ...quiz, questions: quiz.questions.map((y) => (y.id === x.id ? { ...y, choices: y.choices.map((z, j) => (j === i ? e.target.value : z)) } : y)) })} placeholder={`Choice ${"ABCD"[i]}`} className={`${inputCls} border-0 bg-transparent`} /></label>)}</div>
        <input value={x.why} onChange={(e) => put({ ...quiz, questions: quiz.questions.map((y) => (y.id === x.id ? { ...y, why: e.target.value } : y)) })} placeholder="Why it's right (shown after answering) — optional" className={`${inputCls} mt-2`} />
      </Card>)}
      <div className="flex gap-2"><Btn kind="soft" color="#2563eb" onClick={() => put({ ...quiz, questions: [...quiz.questions, blankQ()] })}><Plus size={14} />Question</Btn><span className="flex-1" /><Btn kind="danger" onClick={() => { if (window.confirm("Delete this quiz?")) { setData((s) => ({ quizzes: s.quizzes.filter((q) => q.id !== quiz.id) })); setId(null); } }}>Delete quiz</Btn></div>
      {ai && <AiBox title="AI questions" cta="Write questions" onClose={() => setAi(false)} run={makeAi} fields={[{ key: "topic", label: "Topic", placeholder: quiz.title }, { key: "text", label: "From this text (optional)", area: true }, { key: "count", label: "How many", options: ["10", "5", "15", "20"] }, { key: "level", label: "Level", options: LEVELS }]} />}
    </div>;
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-end gap-2"><Btn kind="soft" color={AI} onClick={() => setAi(true)}><Sparkles size={15} />AI quiz</Btn><Btn kind="primary" color="#2563eb" onClick={() => { const q: Quiz = { id: uid(), title: "New quiz", questions: [blankQ()], results: [] }; put(q); setId(q.id); }}><Plus size={16} />New quiz</Btn></div>
    {data.quizzes.length ? <div className="grid gap-3 sm:grid-cols-2">{data.quizzes.map((q) => <div key={q.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"><button type="button" onClick={() => setId(q.id)} className="block w-full text-left"><p className="text-lg font-black">{q.title}</p><p className="text-xs text-slate-500">{ready(q).length} questions{q.results[0] ? ` · last score ${q.results[0].score}/${q.results[0].total}` : ""}</p></button><div className="mt-3 flex gap-2"><Btn kind="primary" color="#2563eb" disabled={!ready(q).length} onClick={() => { setId(q.id); setPlay({ order: shuffle(ready(q).map((x) => x.id)), i: 0, picks: {} }); }}><Play size={14} />Take</Btn><Btn onClick={() => setId(q.id)}><Pencil size={14} />Edit</Btn></div></div>)}</div> : <Empty>Write a quiz to study with — or let AI write one from a topic or your notes. Print it with an answer key for class.</Empty>}
    {ai && <AiBox title="AI quiz" cta="Write quiz" onClose={() => setAi(false)} run={makeAi} fields={[{ key: "topic", label: "Topic", placeholder: "The water cycle" }, { key: "text", label: "From this text (optional)", area: true }, { key: "count", label: "How many", options: ["10", "5", "15", "20"] }, { key: "level", label: "Level", options: LEVELS }]} />}
  </div>;
}

// ─── GPA ───
type GClass = { id: string; name: string; credits: number; grade: string; level: ClassLevel };
type Sem = { id: string; name: string; classes: GClass[] };
const newClass = (): GClass => ({ id: uid(), name: "", credits: 1, grade: "", level: "regular" });
function Gpa() {
  const { data, setData } = usePro<{ sems: Sem[] }>("gpa", { sems: [{ id: "s1", name: "Fall", classes: [newClass(), newClass(), newClass(), newClass()] }] });
  const all = data.sems.flatMap((s) => s.classes); const cum = gpa(all);
  const putSem = (s: Sem) => setData((d) => ({ sems: d.sems.map((x) => (x.id === s.id ? s : x)) }));
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-3"><Stat label="Unweighted GPA" value={cum.credits ? cum.unweighted.toFixed(2) : "—"} color="#7c3aed" /><Stat label="Weighted GPA" value={cum.credits ? cum.weighted.toFixed(2) : "—"} sub="Honors +0.5, AP/IB +1" /><Stat label="Credits" value={fmtNum(cum.credits, 2)} /></div>
    {data.sems.map((s) => { const g = gpa(s.classes); return <Card key={s.id} title={<input value={s.name} onChange={(e) => putSem({ ...s, name: e.target.value })} className="rounded-lg px-1 font-black hover:bg-slate-50" aria-label="Semester name" />} right={<span className="text-sm font-bold text-slate-600">{g.credits ? `${g.unweighted.toFixed(2)} · weighted ${g.weighted.toFixed(2)}` : ""}</span>}>
      <div className="hidden grid-cols-[1fr_80px_90px_110px_28px] gap-2 px-1 text-[11px] font-bold uppercase text-slate-500 sm:grid"><span>Class</span><span>Credits</span><span>Grade</span><span>Level</span><span /></div>
      {s.classes.map((c) => { const bad = c.grade.trim() && !toLetter(c.grade); return <div key={c.id} className="mb-2 grid grid-cols-[1fr_70px_80px] gap-2 sm:grid-cols-[1fr_80px_90px_110px_28px]">
        <input value={c.name} onChange={(e) => putSem({ ...s, classes: s.classes.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) })} placeholder="Class name" className={inputCls} />
        <NumIn value={c.credits} min={0} step={0.5} onChange={(v) => putSem({ ...s, classes: s.classes.map((x) => (x.id === c.id ? { ...x, credits: Number(v) || 0 } : x)) })} />
        <input value={c.grade} onChange={(e) => putSem({ ...s, classes: s.classes.map((x) => (x.id === c.id ? { ...x, grade: e.target.value } : x)) })} placeholder="A- or 91" className={`${inputCls} ${bad ? "border-rose-400" : ""}`} title={bad ? "Use a letter (A, B+…) or a percent" : toLetter(c.grade) ?? ""} />
        <select value={c.level} onChange={(e) => putSem({ ...s, classes: s.classes.map((x) => (x.id === c.id ? { ...x, level: e.target.value as ClassLevel } : x)) })} className={inputCls}><option value="regular">Regular</option><option value="honors">Honors</option><option value="ap">AP / IB</option></select>
        <button type="button" aria-label="Remove class" onClick={() => putSem({ ...s, classes: s.classes.filter((x) => x.id !== c.id) })} className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
      </div>; })}
      <div className="flex gap-2"><Btn onClick={() => putSem({ ...s, classes: [...s.classes, newClass()] })}><Plus size={14} />Class</Btn><span className="flex-1" />{data.sems.length > 1 && <Btn kind="danger" onClick={() => setData((d) => ({ sems: d.sems.filter((x) => x.id !== s.id) }))}>Remove semester</Btn>}</div>
    </Card>; })}
    <Btn kind="soft" color="#7c3aed" onClick={() => setData((d) => ({ sems: [...d.sems, { id: uid(), name: `Semester ${d.sems.length + 1}`, classes: [newClass(), newClass(), newClass(), newClass()] }] }))}><Plus size={14} />Semester</Btn>
    <Card title="Grade scale"><div className="grid grid-cols-4 gap-1 text-sm sm:grid-cols-7">{LETTERS.map(([l, p, m]) => <div key={l} className="rounded-lg bg-slate-50 p-1.5 text-center"><b>{l}</b><p className="text-xs text-slate-500">{p.toFixed(1)} · {m}%+</p></div>)}</div></Card>
  </div>;
}

// ─── Final grade ───
type Cat = { id: string; name: string; weight: number; score: number | "" };
function FinalGrade() {
  const { data, setData } = usePro<{ current: number | ""; weight: number | ""; target: number | ""; useCats: boolean; cats: Cat[] }>("final-grade", { current: "", weight: 20, target: 90, useCats: false, cats: [{ id: "c1", name: "Homework", weight: 20, score: "" }, { id: "c2", name: "Quizzes", weight: 30, score: "" }, { id: "c3", name: "Tests", weight: 50, score: "" }] });
  const set = (p: Partial<typeof data>) => setData((d) => ({ ...d, ...p }));
  const cur = data.useCats ? weightedGrade(data.cats) : data.current === "" ? null : Number(data.current);
  const w = Number(data.weight) || 0;
  const rows: [string, number][] = [["A", 90], ["B", 80], ["C", 70], ["D", 60]];
  if (data.target !== "" && !rows.some(([, v]) => v === Number(data.target))) rows.unshift([`${data.target}%`, Number(data.target)]);
  const verdict = (n: number) => (n <= 0 ? { t: "Already locked in", c: "#16a34a" } : n <= 100 ? { t: `${n.toFixed(1)}%`, c: n > 90 ? "#ea580c" : "#0f172a" } : { t: `${n.toFixed(1)}% — out of reach`, c: "#dc2626" });
  return <div className="space-y-4">
    <Card><div className="mb-3 flex gap-2"><Tabs value={data.useCats ? "cats" : "simple"} onChange={(v) => set({ useCats: v === "cats" })} color="#0ea5e9" items={[{ id: "simple", label: "I know my grade" }, { id: "cats", label: "Work it out from categories" }]} /></div>
      {data.useCats ? <div className="space-y-2">{data.cats.map((c) => <div key={c.id} className="grid grid-cols-[1fr_90px_90px_28px] gap-2"><input value={c.name} onChange={(e) => set({ cats: data.cats.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) })} className={inputCls} /><NumIn value={c.weight} placeholder="Weight %" onChange={(v) => set({ cats: data.cats.map((x) => (x.id === c.id ? { ...x, weight: Number(v) || 0 } : x)) })} /><NumIn value={c.score} placeholder="Score %" onChange={(v) => set({ cats: data.cats.map((x) => (x.id === c.id ? { ...x, score: v } : x)) })} /><button type="button" aria-label="Remove" onClick={() => set({ cats: data.cats.filter((x) => x.id !== c.id) })} className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button></div>)}<Btn onClick={() => set({ cats: [...data.cats, { id: uid(), name: "Category", weight: 10, score: "" }] })}><Plus size={14} />Category</Btn><p className="text-sm text-slate-600">Grade so far: <b>{cur === null ? "—" : `${cur.toFixed(1)}%`}</b></p></div>
        : <div className="grid gap-3 sm:grid-cols-3"><Field label="Current grade (%)"><NumIn value={data.current} onChange={(v) => set({ current: v })} placeholder="85" /></Field><Field label="Final is worth (%)"><NumIn value={data.weight} onChange={(v) => set({ weight: v })} /></Field><Field label="Grade I want (%)"><NumIn value={data.target} onChange={(v) => set({ target: v })} /></Field></div>}
      {data.useCats && <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Final is worth (%)"><NumIn value={data.weight} onChange={(v) => set({ weight: v })} /></Field><Field label="Grade I want (%)"><NumIn value={data.target} onChange={(v) => set({ target: v })} /></Field></div>}
    </Card>
    {cur !== null && w > 0 && w < 100 ? <Card title="You need on the final…"><div className="grid gap-2 sm:grid-cols-2">{rows.map(([l, v]) => { const n = neededOnFinal(cur, w, v); const vd = verdict(n); return <div key={l} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="font-black">For {/%$/.test(l) ? l : `a ${l} (${v}%)`}</span><span className="text-xl font-black" style={{ color: vd.c }}>{vd.t}</span></div>; })}</div>
      <p className="mt-3 text-sm text-slate-600">How: your grade so far ({cur.toFixed(1)}%) counts for {100 - w}% and the final for {w}%. Needed = (goal − {cur.toFixed(1)} × {((100 - w) / 100).toFixed(2)}) ÷ {(w / 100).toFixed(2)}.</p>
      {data.target !== "" && <p className="mt-1 text-sm text-slate-600">If you score 100% you finish with <b>{(cur * (1 - w / 100) + w).toFixed(1)}%</b>; if you score 0% you finish with <b>{(cur * (1 - w / 100)).toFixed(1)}%</b>.</p>}
    </Card> : <Empty>Enter your grade and how much the final is worth.</Empty>}
  </div>;
}

// ─── Citations ───
const KIND_FIELDS: Record<SourceKind, { key: keyof Source; label: string; hint?: string }[]> = {
  book: [{ key: "authors", label: "Author(s)", hint: "Jane A. Smith; John Doe" }, { key: "title", label: "Title" }, { key: "edition", label: "Edition", hint: "2" }, { key: "publisher", label: "Publisher" }, { key: "city", label: "City (Chicago)" }, { key: "date", label: "Year", hint: "2021" }, { key: "url", label: "URL or DOI (optional)" }],
  website: [{ key: "authors", label: "Author(s) or organisation", hint: "NASA" }, { key: "title", label: "Page title" }, { key: "container", label: "Website name" }, { key: "publisher", label: "Publisher (if different)" }, { key: "date", label: "Published", hint: "2023-05-04" }, { key: "accessed", label: "Accessed", hint: "2024-02-01" }, { key: "url", label: "URL" }],
  article: [{ key: "authors", label: "Author(s)" }, { key: "title", label: "Article title" }, { key: "container", label: "Journal / magazine" }, { key: "volume", label: "Volume" }, { key: "issue", label: "Issue" }, { key: "pages", label: "Pages", hint: "45-60" }, { key: "date", label: "Year (or date)" }, { key: "url", label: "DOI or URL" }],
  video: [{ key: "container", label: "Channel / uploader" }, { key: "authors", label: "Creator (if a person)" }, { key: "title", label: "Video title" }, { key: "publisher", label: "Site", hint: "YouTube" }, { key: "date", label: "Upload date", hint: "2022-09-15" }, { key: "url", label: "URL" }],
};
const STYLE_HEAD: Record<CiteStyle, string> = { apa: "References", mla: "Works Cited", chicago: "Bibliography" };
function Citations() {
  const { data, setData } = usePro<{ style: CiteStyle; sources: (Source & { id: string })[] }>("citations", { style: "apa", sources: [] });
  const [form, setForm] = useState<(Source & { id: string }) | null>(null);
  const [copied, setCopied] = useState("");
  const sorted = useMemo(() => [...data.sources].sort((a, b) => sortKey(a).localeCompare(sortKey(b))), [data.sources]);
  const copyRich = async (items: string[], k: string) => {
    const html = items.map((s) => `<p style="padding-left:0.5in;text-indent:-0.5in">${citeHtml(s)}</p>`).join(""); const text = items.map(citePlain).join("\n");
    try { const CI = (window as any).ClipboardItem; if (CI && navigator.clipboard?.write) await navigator.clipboard.write([new CI({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]); else await navigator.clipboard?.writeText(text); } catch { void navigator.clipboard?.writeText(text); }
    setCopied(k); window.setTimeout(() => setCopied(""), 1500);
  };
  const all = sorted.map((s) => cite(s, data.style));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><Tabs value={data.style} onChange={(v) => setData((d) => ({ ...d, style: v }))} color="#475569" items={[{ id: "apa", label: "APA 7" }, { id: "mla", label: "MLA 9" }, { id: "chicago", label: "Chicago 17" }]} /><span className="flex-1" /><Btn kind="primary" color="#475569" onClick={() => setForm({ ...blankSource("website"), id: uid(), accessed: today() })}><Plus size={16} />Add source</Btn></div>
    <Card title={STYLE_HEAD[data.style]} right={sorted.length > 0 && <div className="flex gap-2"><Btn onClick={() => void copyRich(all, "all")}><Copy size={14} />{copied === "all" ? "Copied!" : "Copy all"}</Btn><Btn onClick={() => printPage(STYLE_HEAD[data.style], `<h1 style="text-align:center">${STYLE_HEAD[data.style]}</h1>${all.map((s) => `<p style="padding-left:0.5in;text-indent:-0.5in;line-height:2;font-family:'Times New Roman',serif;font-size:12pt">${citeHtml(s)}</p>`).join("")}`)}><Printer size={14} />Print</Btn></div>}>
      {sorted.length ? <div className="space-y-2">{sorted.map((s, i) => <div key={s.id} className="group flex items-start gap-2 rounded-xl p-2 hover:bg-slate-50">
        <p className="flex-1 pl-8 -indent-8 font-serif text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: citeHtml(all[i]) }} />
        <div className="flex shrink-0 gap-1 opacity-60 group-hover:opacity-100"><button type="button" aria-label="Copy" onClick={() => void copyRich([all[i]], s.id)} className="p-1 text-slate-500 hover:text-slate-900">{copied === s.id ? <Check size={15} /> : <Copy size={15} />}</button><button type="button" aria-label="Edit" onClick={() => setForm(s)} className="p-1 text-slate-500 hover:text-slate-900"><Pencil size={15} /></button><button type="button" aria-label="Delete" onClick={() => setData((d) => ({ ...d, sources: d.sources.filter((x) => x.id !== s.id) }))} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button></div>
      </div>)}</div> : <Empty>Add books, websites, articles and videos. Switch between APA, MLA and Chicago any time — the list re-formats and stays alphabetical.</Empty>}
      {sorted.length > 0 && <p className="mt-3 text-xs text-slate-500">Copy keeps the italics and hanging indent when you paste into Docs or Word. Check capitalisation: APA uses sentence case for titles.</p>}
    </Card>
    {form && <Modal wide title={data.sources.some((x) => x.id === form.id) ? "Edit source" : "Add source"} onClose={() => setForm(null)} footer={<Btn kind="primary" color="#475569" disabled={!form.title.trim()} onClick={() => { setData((d) => ({ ...d, sources: d.sources.some((x) => x.id === form.id) ? d.sources.map((x) => (x.id === form.id ? form : x)) : [...d.sources, form] })); setForm(null); }}>Save</Btn>}>
      <Tabs value={form.kind} onChange={(k) => setForm({ ...form, kind: k })} color="#475569" items={[{ id: "website", label: "Website" }, { id: "book", label: "Book" }, { id: "article", label: "Article" }, { id: "video", label: "Video" }]} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{KIND_FIELDS[form.kind].map((f) => <Field key={f.key} label={f.label} className={f.key === "title" || f.key === "url" ? "sm:col-span-2" : ""}>{f.key === "date" || f.key === "accessed" ? <input value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.hint || "YYYY or YYYY-MM-DD"} className={inputCls} /> : <input value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.hint} className={inputCls} />}</Field>)}</div>
      <p className="mt-2 text-xs text-slate-500">Several authors: separate with semicolons. An organisation as author: just its name.</p>
      {form.title.trim() && <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Preview</p><p className="pl-8 -indent-8 font-serif" dangerouslySetInnerHTML={{ __html: citeHtml(cite(form, data.style)) }} /></div>}
    </Modal>}
  </div>;
}

// ─── Study planner ───
type Plan = { id: string; title: string; subject: string; kind: "test" | "assignment"; due: string; sessions: number; minutes: number; created: string; done: string[] };
const planDays = (p: Plan) => spreadSessions(p.created <= today() ? p.created : today(), p.due, p.sessions);
function StudyPlanner() {
  const { data, setData } = usePro<{ plans: Plan[] }>("study-planner", { plans: [] });
  const [form, setForm] = useState<Plan | null>(null);
  const t = today();
  const live = data.plans.filter((p) => p.due >= t).sort((a, b) => a.due.localeCompare(b.due));
  const sessions = live.flatMap((p) => planDays(p).map((d) => ({ p, d, done: p.done.includes(d) })));
  const todays = sessions.filter((s) => s.d === t); const behind = sessions.filter((s) => s.d < t && !s.done);
  const toggle = (p: Plan, d: string) => setData((s) => ({ plans: s.plans.map((x) => (x.id === p.id ? { ...x, done: x.done.includes(d) ? x.done.filter((y) => y !== d) : [...x.done, d] } : x)) }));
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i));
  const Row = ({ s }: { s: (typeof sessions)[number] }) => <button type="button" onClick={() => toggle(s.p, s.d)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 ${s.done ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200 hover:bg-slate-50"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>{s.done && <Check size={15} />}</span><span className="flex-1"><b className={s.done ? "line-through opacity-60" : ""}>{s.p.title}</b><span className="block text-xs text-slate-500">{s.p.subject && `${s.p.subject} · `}{s.p.minutes} min · {s.p.kind === "test" ? "test" : "due"} {fmtDay(s.p.due)} ({daysBetween(t, s.p.due)}d)</span></span></button>;
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color={GREEN} onClick={() => setForm({ id: uid(), title: "", subject: "", kind: "test", due: addDays(t, 7), sessions: 4, minutes: 30, created: t, done: [] })}><Plus size={16} />Test or assignment</Btn></div>
    <Card title={`Today · ${fmtDay(t)}`}>{todays.length ? <div className="space-y-2">{todays.map((s) => <Row key={s.p.id + s.d} s={s} />)}</div> : <Empty>{live.length ? "No study sessions today — enjoy it!" : "Add a test or assignment and the planner spreads study sessions over the days before it."}</Empty>}</Card>
    {behind.length > 0 && <Card title="Catch up" tint="#fff7ed"><div className="space-y-2">{behind.map((s) => <Row key={s.p.id + s.d} s={s} />)}</div></Card>}
    {live.length > 0 && <Card title="This week"><div className="grid grid-cols-7 gap-1">{week.map((d) => { const ss = sessions.filter((s) => s.d === d); const tests = live.filter((p) => p.due === d); return <div key={d} className={`min-h-[90px] rounded-xl p-1.5 ${d === t ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50"}`}><p className="text-[11px] font-bold text-slate-500">{fmtDay(d, { weekday: "short", day: "numeric" })}</p>{tests.map((p) => <p key={p.id} className="mt-1 truncate rounded bg-rose-500 px-1 text-[10px] font-bold text-white">{p.kind === "test" ? "📝" : "📌"} {p.title}</p>)}{ss.map((s) => <p key={s.p.id} className={`mt-1 truncate rounded px-1 text-[10px] font-bold ${s.done ? "bg-emerald-200 text-emerald-800 line-through" : "bg-white text-slate-700"}`}>{s.p.title}</p>)}</div>; })}</div></Card>}
    {live.length > 0 && <Card title="Coming up">{live.map((p) => { const ds = planDays(p); const n = ds.filter((d) => p.done.includes(d)).length; return <div key={p.id} className="mb-3 flex items-center gap-3"><div className="flex-1"><p className="font-bold">{p.title} <span className="text-xs font-normal text-slate-500">{p.subject} · {fmtDay(p.due)}</span></p><Bar value={n} max={ds.length || 1} color={GREEN} className="mt-1" /><p className="mt-0.5 text-xs text-slate-500">{n} of {ds.length} sessions done</p></div><button type="button" aria-label="Edit" onClick={() => setForm(p)} className="p-1 text-slate-500"><Pencil size={15} /></button><button type="button" aria-label="Delete" onClick={() => setData((s) => ({ plans: s.plans.filter((x) => x.id !== p.id) }))} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button></div>; })}</Card>}
    {form && <Modal title={form.title ? form.title : "What's coming up?"} onClose={() => setForm(null)} footer={<Btn kind="primary" color={GREEN} disabled={!form.title.trim() || form.due <= t} onClick={() => { setData((s) => ({ plans: s.plans.some((x) => x.id === form.id) ? s.plans.map((x) => (x.id === form.id ? form : x)) : [...s.plans, form] })); setForm(null); }}>Save plan</Btn>}>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="What" className="sm:col-span-2"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Chapter 5 test" className={inputCls} /></Field><Field label="Subject"><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Science" className={inputCls} /></Field><Field label="Kind"><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Plan["kind"] })} className={inputCls}><option value="test">Test / exam</option><option value="assignment">Assignment / project</option></select></Field><Field label="Date"><input type="date" value={form.due} min={addDays(t, 1)} onChange={(e) => setForm({ ...form, due: e.target.value })} className={inputCls} /></Field><Field label="Study sessions"><NumIn value={form.sessions} min={1} max={30} onChange={(v) => setForm({ ...form, sessions: Math.max(1, Math.min(30, Number(v) || 1)) })} /></Field><Field label="Minutes each"><NumIn value={form.minutes} min={5} onChange={(v) => setForm({ ...form, minutes: Math.max(5, Number(v) || 5) })} /></Field></div>
      {form.due > t && <p className="mt-3 text-sm text-slate-600">Sessions on: {planDays(form).map((d) => fmtDay(d, { weekday: "short", month: "short", day: "numeric" })).join(", ")}</p>}
    </Modal>}
  </div>;
}

// ─── Essay outliner ───
type Para = { id: string; point: string; evidence: string; explain: string };
type Outline = { id: string; title: string; type: string; hook: string; thesis: string; body: Para[]; counter: string; conclusion: string; updated: string };
const ESSAY_TYPES = ["argumentative", "persuasive", "informative", "compare and contrast", "literary analysis", "narrative"];
function outlineText(o: Outline) {
  return [`${o.title}`, "", "I. Introduction", `   Hook: ${o.hook}`, `   Thesis: ${o.thesis}`, ...o.body.flatMap((p, i) => ["", `${["II", "III", "IV", "V", "VI", "VII"][i] || i + 2}. ${p.point}`, ...p.evidence.split("\n").filter(Boolean).map((e) => `   • ${e}`), p.explain ? `   So what: ${p.explain}` : ""]), ...(o.counter ? ["", "Counterargument", `   ${o.counter}`] : []), "", "Conclusion", `   ${o.conclusion}`].filter((l) => l !== undefined).join("\n");
}
function Essay() {
  const { token } = useAuth();
  const { data, setData } = usePro<{ list: Outline[] }>("essay", { list: [] });
  const [id, setId] = useState<string | null>(null); const [ai, setAi] = useState(false);
  const o = data.list.find((x) => x.id === id) || null;
  const put = (x: Outline) => setData((d) => ({ list: d.list.some((y) => y.id === x.id) ? d.list.map((y) => (y.id === x.id ? { ...x, updated: today() } : y)) : [x, ...d.list] }));
  const blank = (): Outline => ({ id: uid(), title: "My essay", type: "argumentative", hook: "", thesis: "", body: [1, 2, 3].map(() => ({ id: uid(), point: "", evidence: "", explain: "" })), counter: "", conclusion: "", updated: today() });
  const makeAi = async (v: Record<string, string>) => {
    const r = await askAppAi<{ thesis: string; hook: string; body: { point: string; evidence: string[]; explain: string }[]; counter: string; conclusion: string }>(token, "essay-outline", { topic: v.topic, type: v.type, level: v.level });
    const x: Outline = { id: uid(), title: v.topic.slice(0, 80), type: v.type, hook: r.hook || "", thesis: r.thesis || "", body: (r.body || []).map((b) => ({ id: uid(), point: b.point || "", evidence: (b.evidence || []).join("\n"), explain: b.explain || "" })), counter: r.counter || "", conclusion: r.conclusion || "", updated: today() };
    put(x); setId(x.id);
  };
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  if (o) {
    const filled = [o.hook, o.thesis, ...o.body.map((p) => p.point), o.conclusion].filter((s) => s.trim()).length; const total = 3 + o.body.length;
    const tx = (k: "hook" | "thesis" | "counter" | "conclusion", label: string, hint: string, rows = 2) => <Field label={label} hint={hint}><textarea rows={rows} value={o[k]} onChange={(e) => put({ ...o, [k]: e.target.value })} className={area} /></Field>;
    return <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><Btn onClick={() => setId(null)}>← Outlines</Btn><span className="flex-1" /><Btn onClick={() => void navigator.clipboard?.writeText(outlineText(o))}><Copy size={14} />Copy</Btn><Btn onClick={() => printPage(o.title, `<pre style="font-family:Arial;font-size:14px;white-space:pre-wrap">${esc(outlineText(o))}</pre>`)}><Printer size={14} />Print</Btn></div>
      <Card><div className="grid gap-3 sm:grid-cols-[1fr_200px]"><Field label="Title or prompt"><input value={o.title} onChange={(e) => put({ ...o, title: e.target.value })} className={inputCls} /></Field><Field label="Type"><select value={o.type} onChange={(e) => put({ ...o, type: e.target.value })} className={inputCls}>{ESSAY_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field></div><div className="mt-3"><Bar value={filled} max={total} color="#4f46e5" /><p className="mt-1 text-xs text-slate-500">{filled} of {total} parts written</p></div></Card>
      <Card title="Introduction" tint="#eef2ff">{tx("hook", "Hook", "A question, fact or story that grabs the reader")}<div className="h-3" />{tx("thesis", "Thesis", "Your main claim in one sentence — what you'll prove")}{o.thesis && words(o.thesis) > 40 && <p className="mt-1 text-xs text-amber-700">Tip: a thesis is usually one sentence (yours is {words(o.thesis)} words).</p>}</Card>
      {o.body.map((p, i) => <Card key={p.id} title={`Body paragraph ${i + 1}`} right={<button type="button" aria-label="Remove paragraph" onClick={() => put({ ...o, body: o.body.filter((x) => x.id !== p.id) })} className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>}>
        <Field label="Topic sentence (point)"><input value={p.point} onChange={(e) => put({ ...o, body: o.body.map((x) => (x.id === p.id ? { ...x, point: e.target.value } : x)) })} className={inputCls} /></Field>
        <Field label="Evidence — one per line" className="mt-2"><textarea rows={3} value={p.evidence} onChange={(e) => put({ ...o, body: o.body.map((x) => (x.id === p.id ? { ...x, evidence: e.target.value } : x)) })} placeholder="A quote, fact, statistic or example" className={area} /></Field>
        <Field label="Explain — how does this prove your thesis?" className="mt-2"><textarea rows={2} value={p.explain} onChange={(e) => put({ ...o, body: o.body.map((x) => (x.id === p.id ? { ...x, explain: e.target.value } : x)) })} className={area} /></Field>
      </Card>)}
      <Btn onClick={() => put({ ...o, body: [...o.body, { id: uid(), point: "", evidence: "", explain: "" }] })}><Plus size={14} />Paragraph</Btn>
      {(o.type === "argumentative" || o.type === "persuasive") && <Card title="Counterargument">{tx("counter", "What would someone who disagrees say — and your answer", "Answering the other side makes your argument stronger", 3)}</Card>}
      <Card title="Conclusion" tint="#eef2ff">{tx("conclusion", "Restate the thesis in new words and say why it matters", "Don't add new evidence here", 3)}</Card>
      <Btn kind="danger" onClick={() => { setData((d) => ({ list: d.list.filter((x) => x.id !== o.id) })); setId(null); }}>Delete outline</Btn>
    </div>;
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-end gap-2"><Btn kind="soft" color={AI} onClick={() => setAi(true)}><Sparkles size={15} />AI outline</Btn><Btn kind="primary" color="#4f46e5" onClick={() => { const x = blank(); put(x); setId(x.id); }}><Plus size={16} />New outline</Btn></div>
    {data.list.length ? <div className="grid gap-3 sm:grid-cols-2">{data.list.map((x) => <button key={x.id} type="button" onClick={() => setId(x.id)} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-indigo-300"><p className="font-black">{x.title}</p><p className="text-xs capitalize text-slate-500">{x.type} · {x.body.length} body paragraphs · {fmtDay(x.updated)}</p>{x.thesis && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{x.thesis}</p>}</button>)}</div> : <Empty>Plan an essay before you write it: hook, thesis, body paragraphs with evidence, and a conclusion.</Empty>}
    {ai && <AiBox title="AI outline" cta="Make outline" onClose={() => setAi(false)} run={makeAi} fields={[{ key: "topic", label: "Essay prompt or topic", area: true, placeholder: "Should schools have a four-day week?" }, { key: "type", label: "Type", options: ESSAY_TYPES }, { key: "level", label: "Level", options: ["high school", "middle school", "elementary", "college"] }]} />}
  </div>;
}

// ─── Vocabulary ───
type Word = { id: string; word: string; pos: string; meaning: string; example: string; synonym: string; right: number; wrong: number };
const mastered = (w: Word) => w.right >= 3 && w.right >= w.wrong * 2;
function Vocab() {
  const { token } = useAuth();
  const { data, setData } = usePro<{ words: Word[] }>("vocab", { words: [] });
  const [tab, setTab] = useState<"words" | "match" | "quiz">("words");
  const [draft, setDraft] = useState({ word: "", meaning: "", example: "" }); const [ai, setAi] = useState(false); const [q, setQ] = useState("");
  const [match, setMatch] = useState<{ ids: string[]; meanings: string[]; pick: string | null; done: string[]; miss: number; start: number } | null>(null);
  const [quiz, setQuiz] = useState<{ id: string; choices: string[]; picked: string | null; n: number; score: number } | null>(null);
  const mark = (id: string, ok: boolean) => setData((d) => ({ words: d.words.map((w) => (w.id === id ? { ...w, right: w.right + (ok ? 1 : 0), wrong: w.wrong + (ok ? 0 : 1) } : w)) }));
  const startMatch = () => { const pick = shuffle(data.words.filter((w) => w.meaning)).sort((a, b) => Number(mastered(a)) - Number(mastered(b))).slice(0, 5); setMatch({ ids: shuffle(pick.map((w) => w.id)), meanings: shuffle(pick.map((w) => w.id)), pick: null, done: [], miss: 0, start: Date.now() }); };
  const nextQuiz = (n = 0, score = 0) => { const pool = data.words.filter((w) => w.meaning); const w = shuffle(pool).sort((a, b) => Number(mastered(a)) - Number(mastered(b)))[0]; setQuiz({ id: w.id, choices: shuffle([w.word, ...shuffle(pool.filter((x) => x.id !== w.id)).slice(0, 3).map((x) => x.word)]), picked: null, n, score }); };
  const makeAi = async (v: Record<string, string>) => {
    const r = await askAppAi<{ words: { word: string; pos: string; meaning: string; example: string; synonym: string }[] }>(token, "vocab", { words: v.words });
    const got = (r.words || []).filter((w) => w.word);
    if (!got.length) throw new Error("No words came back.");
    setData((d) => {
      const byWord = new Map(got.map((g) => [g.word.toLowerCase(), g]));
      const words = d.words.map((w) => { const g = byWord.get(w.word.toLowerCase()); if (!g) return w; byWord.delete(w.word.toLowerCase()); return { ...w, pos: g.pos || w.pos, meaning: g.meaning || w.meaning, example: g.example || w.example, synonym: g.synonym || w.synonym }; });
      const add: Word[] = [...byWord.values()].map((g) => ({ id: uid(), word: g.word, pos: g.pos || "", meaning: g.meaning || "", example: g.example || "", synonym: g.synonym || "", right: 0, wrong: 0 }));
      return { words: [...add, ...words] };
    });
  };
  const usable = data.words.filter((w) => w.meaning).length;
  const shown = data.words.filter((w) => !q || `${w.word} ${w.meaning}`.toLowerCase().includes(q.toLowerCase()));
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-3"><Stat label="Words" value={data.words.length} /><Stat label="Mastered" value={data.words.filter(mastered).length} color="#0d9488" /><Stat label="Practising" value={data.words.filter((w) => !mastered(w)).length} /></div>
    <Tabs value={tab} onChange={(v) => { setTab(v); setMatch(null); setQuiz(null); }} color="#0d9488" items={[{ id: "words", label: "Word bank" }, { id: "match", label: "Match" }, { id: "quiz", label: "Quiz" }]} />
    {tab === "words" && <>
      <Card><div className="grid gap-2 sm:grid-cols-[160px_1fr]"><input value={draft.word} onChange={(e) => setDraft({ ...draft, word: e.target.value })} placeholder="Word" className={`${inputCls} font-bold`} /><input value={draft.meaning} onChange={(e) => setDraft({ ...draft, meaning: e.target.value })} placeholder="Meaning (or leave blank and use AI)" className={inputCls} /><input value={draft.example} onChange={(e) => setDraft({ ...draft, example: e.target.value })} placeholder="Example sentence (optional)" className={`${inputCls} sm:col-span-2`} /></div>
        <div className="mt-2 flex flex-wrap gap-2"><Btn kind="primary" color="#0d9488" disabled={!draft.word.trim()} onClick={() => { setData((d) => ({ words: [{ id: uid(), word: draft.word.trim(), pos: "", meaning: draft.meaning.trim(), example: draft.example.trim(), synonym: "", right: 0, wrong: 0 }, ...d.words] })); setDraft({ word: "", meaning: "", example: "" }); }}><Plus size={14} />Add word</Btn><Btn kind="soft" color={AI} onClick={() => setAi(true)}><Sparkles size={14} />AI definitions</Btn></div></Card>
      {data.words.length > 6 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search words" className={inputCls} />}
      {shown.length ? <div className="grid gap-2 sm:grid-cols-2">{shown.map((w) => <div key={w.id} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"><div className="flex items-start gap-2"><div className="flex-1"><p className="text-lg font-black">{w.word} {w.pos && <span className="text-xs font-normal italic text-slate-500">{w.pos}</span>} {mastered(w) && <span className="rounded-full bg-teal-100 px-2 text-[10px] font-bold text-teal-700">mastered</span>}</p>{w.meaning ? <p className="text-sm">{w.meaning}</p> : <p className="text-sm italic text-slate-400">No meaning yet</p>}{w.example && <p className="mt-1 text-sm italic text-slate-600">“{w.example}”</p>}{w.synonym && <p className="mt-1 text-xs text-slate-500">Similar: {w.synonym}</p>}</div><button type="button" aria-label="Delete" onClick={() => setData((d) => ({ words: d.words.filter((x) => x.id !== w.id) }))} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></div></div>)}</div> : <Empty>Add words from your reading. Use AI to fill in kid-friendly meanings, examples and synonyms.</Empty>}
    </>}
    {tab === "match" && (usable < 3 ? <Empty>Add at least 3 words with meanings to play.</Empty> : !match ? <Card><div className="py-6 text-center"><p className="text-slate-600">Match each word to its meaning.</p><Btn big kind="primary" color="#0d9488" className="mt-3" onClick={startMatch}><Play size={18} />Play</Btn></div></Card> : match.done.length === match.ids.length ? <Card><div className="py-6 text-center"><p className="text-4xl">🏆</p><p className="text-xl font-black">All matched in {Math.round((Date.now() - match.start) / 1000)}s</p><p className="text-slate-600">{match.miss} wrong tries</p><Btn kind="primary" color="#0d9488" className="mt-3" onClick={startMatch}><RotateCcw size={14} />Again</Btn></div></Card> : <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">{match.ids.map((id) => { const w = data.words.find((x) => x.id === id)!; const done = match.done.includes(id); return <button key={id} type="button" disabled={done} onClick={() => setMatch({ ...match, pick: id })} className={`w-full rounded-xl p-3 text-left text-lg font-black ring-2 ${done ? "bg-teal-50 text-teal-300 ring-teal-100" : match.pick === id ? "bg-teal-600 text-white ring-teal-600" : "bg-white ring-slate-200"}`}>{w.word}</button>; })}</div>
      <div className="space-y-2">{match.meanings.map((id) => { const w = data.words.find((x) => x.id === id)!; const done = match.done.includes(id); return <button key={id} type="button" disabled={done || !match.pick} onClick={() => { const ok = match.pick === id; mark(match.pick!, ok); if (ok && match.done.length + 1 === match.ids.length) chime(); setMatch({ ...match, pick: null, done: ok ? [...match.done, id] : match.done, miss: match.miss + (ok ? 0 : 1) }); }} className={`w-full rounded-xl p-3 text-left text-sm ring-2 ${done ? "bg-teal-50 text-teal-300 ring-teal-100" : "bg-white ring-slate-200 hover:ring-teal-400"}`}>{w.meaning}</button>; })}</div>
    </div>)}
    {tab === "quiz" && (usable < 4 ? <Empty>Add at least 4 words with meanings for a quiz.</Empty> : !quiz ? <Card><div className="py-6 text-center"><p className="text-slate-600">Read the meaning, pick the word. 10 questions.</p><Btn big kind="primary" color="#0d9488" className="mt-3" onClick={() => nextQuiz()}><Play size={18} />Start</Btn></div></Card> : quiz.n >= 10 ? <Card><div className="py-6 text-center"><Ring value={quiz.score} max={10} color="#0d9488"><p className="text-3xl font-black">{quiz.score}/10</p></Ring><Btn kind="primary" color="#0d9488" className="mt-3" onClick={() => nextQuiz()}><RotateCcw size={14} />Again</Btn></div></Card> : (() => { const w = data.words.find((x) => x.id === quiz.id)!; return <div className="mx-auto max-w-xl space-y-3"><p className="text-sm text-slate-500">Question {quiz.n + 1} of 10 · score {quiz.score}</p><p className="rounded-2xl bg-teal-600 p-5 text-xl font-bold text-white">{w.meaning}</p><div className="grid grid-cols-2 gap-2">{quiz.choices.map((c) => <button key={c} type="button" disabled={!!quiz.picked} onClick={() => { const ok = c === w.word; mark(w.id, ok); setQuiz({ ...quiz, picked: c, score: quiz.score + (ok ? 1 : 0) }); }} className={`rounded-xl p-3 text-lg font-black ring-2 ${quiz.picked && c === w.word ? "bg-emerald-100 ring-emerald-400" : quiz.picked === c ? "bg-rose-100 ring-rose-400" : "bg-white ring-slate-200"}`}>{c}</button>)}</div>{quiz.picked && <>{w.example && <p className="text-sm italic text-slate-600">“{w.example}”</p>}<Btn big kind="primary" color="#0d9488" className="w-full" onClick={() => { if (quiz.n + 1 >= 10) { chime(); setQuiz({ ...quiz, n: 10 }); } else nextQuiz(quiz.n + 1, quiz.score); }}>Next</Btn></>}</div>; })())}
    {ai && <AiBox title="AI definitions" cta="Explain words" onClose={() => setAi(false)} run={makeAi} fields={[{ key: "words", label: "Words (comma separated)", area: true, placeholder: data.words.filter((w) => !w.meaning).map((w) => w.word).join(", ") || "reluctant, enormous, curious" }]} />}
  </div>;
}

// ─── Reading log ───
type Book = { id: string; title: string; author: string; status: "reading" | "done" | "want"; rating: number; color: string; finished: string };
type Read = { id: string; day: string; minutes: number; pages: number; bookId: string };
const SPINES = ["#ca8a04", "#2563eb", "#db2777", "#16a34a", "#7c3aed", "#ea580c", "#0891b2", "#dc2626"];
function ReadingLog() {
  const { data, setData } = usePro<{ books: Book[]; reads: Read[]; goal: number; reader: string }>("reading-log", { books: [], reads: [], goal: 600, reader: "" });
  const [log, setLog] = useState({ minutes: 20 as number | "", pages: "" as number | "", bookId: "", day: today() });
  const [bookForm, setBookForm] = useState<Book | null>(null);
  const t = today(); const month = t.slice(0, 7);
  const byDay: Record<string, number> = {}; for (const r of data.reads) byDay[r.day] = (byDay[r.day] || 0) + r.minutes;
  const monthMin = data.reads.filter((r) => r.day.startsWith(month)).reduce((s, r) => s + r.minutes, 0);
  const st = streak((d) => !!byDay[d]);
  const reading = data.books.filter((b) => b.status === "reading");
  const bookName = (id: string) => data.books.find((b) => b.id === id)?.title || "";
  const add = () => { if (!log.minutes) return; setData((d) => ({ ...d, reads: [{ id: uid(), day: log.day, minutes: Number(log.minutes), pages: Number(log.pages) || 0, bookId: log.bookId }, ...d.reads] })); setLog({ ...log, pages: "" }); };
  const printLog = () => { const rows = data.reads.filter((r) => r.day.startsWith(month)).sort((a, b) => a.day.localeCompare(b.day)); printPage("Reading log", `<h1>Reading log — ${esc(new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }))}</h1><p>Reader: <b>${esc(data.reader || "____________________")}</b></p><table><tr><th>Date</th><th>Book</th><th>Minutes</th><th>Pages</th><th>Initials</th></tr>${rows.map((r) => `<tr><td>${esc(fmtDay(r.day))}</td><td>${esc(bookName(r.bookId))}</td><td>${r.minutes}</td><td>${r.pages || ""}</td><td></td></tr>`).join("")}${Array.from({ length: Math.max(0, 12 - rows.length) }, () => "<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>").join("")}<tr><th colspan="2">Total</th><th>${rows.reduce((s, r) => s + r.minutes, 0)}</th><th>${rows.reduce((s, r) => s + r.pages, 0)}</th><th></th></tr></table><p style="margin-top:30px">Parent/guardian signature: ______________________________</p>`); };
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-[auto_1fr]"><Card className="flex items-center justify-center"><Ring value={monthMin} max={data.goal || 1} color="#ca8a04" size={140}><p className="text-3xl font-black">{monthMin}</p><p className="text-xs text-slate-500">of {data.goal} min</p></Ring></Card>
      <div className="grid grid-cols-2 gap-3"><Stat label="Streak" value={`${st} day${st === 1 ? "" : "s"}`} color="#ca8a04" /><Stat label="Books finished" value={data.books.filter((b) => b.status === "done").length} /><Stat label="Pages this month" value={data.reads.filter((r) => r.day.startsWith(month)).reduce((s, r) => s + r.pages, 0)} /><Stat label="All-time minutes" value={data.reads.reduce((s, r) => s + r.minutes, 0).toLocaleString()} /></div></div>
    <Card title="Log reading"><div className="flex flex-wrap items-end gap-2"><Field label="Minutes"><NumIn value={log.minutes} onChange={(v) => setLog({ ...log, minutes: v })} className="w-24" /></Field><Field label="Pages"><NumIn value={log.pages} onChange={(v) => setLog({ ...log, pages: v })} className="w-24" /></Field><Field label="Book"><select value={log.bookId} onChange={(e) => setLog({ ...log, bookId: e.target.value })} className={fit("w-52")}><option value="">—</option>{data.books.filter((b) => b.status !== "want").map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select></Field><Field label="Day"><input type="date" value={log.day} max={t} onChange={(e) => setLog({ ...log, day: e.target.value })} className={fit("w-40")} /></Field><Btn kind="primary" color="#ca8a04" disabled={!log.minutes} onClick={add}><Plus size={15} />Log</Btn></div>
      <div className="mt-2 flex flex-wrap gap-1">{[10, 15, 20, 30, 45, 60].map((m) => <button key={m} type="button" onClick={() => setLog({ ...log, minutes: m })} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{m} min</button>)}</div></Card>
    <Card title="Bookshelf" right={<Btn kind="soft" color="#ca8a04" onClick={() => setBookForm({ id: uid(), title: "", author: "", status: "reading", rating: 0, color: SPINES[data.books.length % SPINES.length], finished: "" })}><Plus size={14} />Book</Btn>}>
      {data.books.length ? (["reading", "want", "done"] as const).map((s) => { const bs = data.books.filter((b) => b.status === s); return bs.length ? <div key={s} className="mb-3"><p className="mb-1 text-xs font-bold uppercase text-slate-500">{s === "reading" ? "Reading now" : s === "want" ? "Want to read" : "Finished"}</p><div className="flex flex-wrap items-end gap-1.5">{bs.map((b) => <button key={b.id} type="button" onClick={() => setBookForm(b)} className="flex h-36 w-12 flex-col items-center justify-between rounded-md px-1 py-2 text-white shadow ring-1 ring-black/10" style={{ background: b.color }} title={`${b.title}${b.author ? ` by ${b.author}` : ""}`}><span className="text-[10px] font-bold [writing-mode:vertical-rl]">{b.title.slice(0, 28)}</span><span className="text-[9px]">{b.rating ? "★".repeat(b.rating) : ""}</span></button>)}</div></div> : null; }) : <Empty>Add the books you're reading and want to read.</Empty>}
      {reading.length > 0 && <p className="text-xs text-slate-500">Tap a book to edit it or mark it finished.</p>}
    </Card>
    <Card title="Reading days"><Heatmap values={byDay} color="#ca8a04" label={(d, v) => `${fmtDay(d)}: ${v} min`} /></Card>
    <Card title="Recent" right={<div className="flex gap-2"><input value={data.reader} onChange={(e) => setData((d) => ({ ...d, reader: e.target.value }))} placeholder="Reader's name" className={fit("w-36")} /><Btn onClick={printLog}><Printer size={14} />Print log</Btn></div>}>
      {data.reads.length ? data.reads.slice(0, 12).map((r) => <div key={r.id} className="flex items-center gap-2 border-b border-slate-100 py-1.5 text-sm last:border-0"><BookOpen size={14} className="text-amber-600" /><span className="w-28 text-slate-500">{fmtDay(r.day)}</span><span className="flex-1 truncate">{bookName(r.bookId) || "Reading"}</span><b>{r.minutes} min</b>{r.pages > 0 && <span className="text-slate-500">{r.pages} p</span>}<button type="button" aria-label="Delete" onClick={() => setData((d) => ({ ...d, reads: d.reads.filter((x) => x.id !== r.id) }))} className="text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button></div>) : <Empty>Nothing logged yet.</Empty>}
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">Monthly goal <NumIn value={data.goal} onChange={(v) => setData((d) => ({ ...d, goal: Number(v) || 0 }))} className="w-24" /> minutes</label>
    </Card>
    {bookForm && <Modal title={bookForm.title || "Add a book"} onClose={() => setBookForm(null)} footer={<>{data.books.some((b) => b.id === bookForm.id) && <Btn kind="danger" onClick={() => { setData((d) => ({ ...d, books: d.books.filter((b) => b.id !== bookForm.id) })); setBookForm(null); }}>Remove</Btn>}<Btn kind="primary" color="#ca8a04" disabled={!bookForm.title.trim()} onClick={() => { const b = { ...bookForm, finished: bookForm.status === "done" && !bookForm.finished ? today() : bookForm.finished }; if (b.status === "done" && !data.books.find((x) => x.id === b.id && x.status === "done")) chime(); setData((d) => ({ ...d, books: d.books.some((x) => x.id === b.id) ? d.books.map((x) => (x.id === b.id ? b : x)) : [...d.books, b] })); setBookForm(null); }}>Save</Btn></>}>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Title" className="sm:col-span-2"><input value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} className={inputCls} /></Field><Field label="Author"><input value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} className={inputCls} /></Field><Field label="Status"><select value={bookForm.status} onChange={(e) => setBookForm({ ...bookForm, status: e.target.value as Book["status"] })} className={inputCls}><option value="reading">Reading</option><option value="want">Want to read</option><option value="done">Finished</option></select></Field></div>
      <div className="mt-3 flex items-center gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} stars`} onClick={() => setBookForm({ ...bookForm, rating: bookForm.rating === n ? 0 : n })} className={`text-2xl ${n <= bookForm.rating ? "text-amber-500" : "text-slate-300"}`}>★</button>)}<span className="flex-1" />{SPINES.map((c) => <button key={c} type="button" aria-label="Colour" onClick={() => setBookForm({ ...bookForm, color: c })} className={`h-6 w-6 rounded ${bookForm.color === c ? "ring-2 ring-slate-900 ring-offset-1" : ""}`} style={{ background: c }} />)}</div>
    </Modal>}
  </div>;
}

export const SCHOOL: Record<string, ComponentType> = {
  flashcards: Flashcards, "quiz-maker": QuizMaker, gpa: Gpa, "final-grade": FinalGrade, citations: Citations, "study-planner": StudyPlanner, essay: Essay, vocab: Vocab, "reading-log": ReadingLog,
  ...SCHOOL2,
};
