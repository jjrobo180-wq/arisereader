// Arise WorkHub: Coach (rules in shared/hubCoach.ts). Three parts:
//   Live         help explaining right now, for one student and one topic, read into an AirPod if wanted
//   What works   the help tracker: what got each student going, and an IEP progress note from it
//   Lesson prep  how to explain each problem in a lesson, before class
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Check, ClipboardCopy, Ear, Eye, Hand, Image as ImageIcon, Loader2, Mic, MicOff, Sparkles, Star, Volume2, VolumeX, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import {
  PROMPT_LADDER, SITUATIONS, STRATEGIES, cleanHelpLogs, cleanSavedPreps, logsFor, progressNote, strategyLabel, whatWorks, whatWorksSentence, liveCoachSpeech,
  type HelpLog, type LessonPrep, type LiveCoach, type SituationId, type StrategyId,
} from "@shared/hubCoach";
import type { Workspace } from "@shared/teacherHub";

type Props = { workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; today: string; makeId: () => string; say: (text: string) => void; token: string | null; initialStudent?: string };
type Part = "live" | "works" | "prep";

const pill = (on: boolean) => `inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${on ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
const card = "rounded-3xl border border-slate-200 bg-white p-4 sm:p-5";
const eyebrow = "text-[11px] font-black uppercase tracking-[.12em] text-slate-500";

async function post<T>(token: string | null, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api/teacher-hub/coach/${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.message || "The coach couldn't answer right now. Try again in a moment.");
  return j as T;
}

// ── Speaking (into AirPods when they're connected: the phone sends speech there by itself) ──
const WHISPER_KEY = "workhub-coach-whisper";
function speakOut(text: string) {
  try {
    const s = window.speechSynthesis;
    if (!s || !text) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02; u.pitch = 1; u.volume = 1;
    const voice = s.getVoices().find((v) => /en[-_]US/i.test(v.lang) && /Samantha|Ava|Allison|Google US English/i.test(v.name)) || s.getVoices().find((v) => /^en/i.test(v.lang));
    if (voice) u.voice = voice;
    s.speak(u);
  } catch { /* no speech here */ }
}
const stopSpeaking = () => { try { window.speechSynthesis?.cancel(); } catch { /* none */ } };

// ── Dictation (where the browser has it; otherwise the keyboard's own mic works in the box) ──
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };
const Recognizer = (): (new () => Recognition) | null => { const w = window as any; return w.SpeechRecognition || w.webkitSpeechRecognition || null; };

export default function HubCoach({ workspace, setWorkspace, today, makeId, say, token, initialStudent }: Props) {
  const [part, setPart] = useState<Part>("live");
  const logs = useMemo(() => cleanHelpLogs((workspace as any).helpLogs), [(workspace as any).helpLogs]);
  const students = useMemo(() => [...(workspace.students || [])].sort((a, b) => a.name.localeCompare(b.name)), [workspace.students]);
  const addLog = (l: Omit<HelpLog, "id" | "date">) => {
    setWorkspace((w) => ({ ...w, helpLogs: [...cleanHelpLogs((w as any).helpLogs), { ...l, id: makeId(), date: today }] } as any));
    say(l.worked ? `Saved: ${strategyLabel(l.strategy).toLowerCase()} worked.` : `Saved: ${strategyLabel(l.strategy).toLowerCase()} didn't work this time.`);
  };
  const undoLast = () => setWorkspace((w) => ({ ...w, helpLogs: cleanHelpLogs((w as any).helpLogs).slice(0, -1) } as any));

  return <div className="mx-auto max-w-4xl space-y-5 pb-10" data-testid="teach-coach">
    <div>
      <h1 className="text-2xl font-black tracking-tight text-slate-950">Coach</h1>
      <p className="mt-1 text-sm text-slate-600">Help explaining it right now, what works for each student, and how to explain a lesson before you teach it.</p>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Coach">
      {([["live", "Live coach", <Sparkles key="a" className="h-4 w-4" />], ["works", "What works", <Star key="b" className="h-4 w-4" />], ["prep", "Lesson prep", <Eye key="c" className="h-4 w-4" />]] as const).map(([id, label, icon]) =>
        <button key={id} type="button" role="tab" aria-selected={part === id} onClick={() => setPart(id)} className={pill(part === id)} data-testid={`coach-tab-${id}`}>{icon}{label}</button>)}
    </div>
    {part === "live" && <Live workspace={workspace} students={students} logs={logs} token={token} addLog={addLog} undoLast={undoLast} initialStudent={initialStudent} />}
    {part === "works" && <Works students={students} logs={logs} today={today} addLog={addLog} say={say} />}
    {part === "prep" && <Prep workspace={workspace} setWorkspace={setWorkspace} students={students} token={token} say={say} />}
  </div>;
}

// ───────────────────────────── Live coach ─────────────────────────────

function Live({ workspace, students, logs, token, addLog, undoLast, initialStudent }: { workspace: Workspace; students: Workspace["students"]; logs: HelpLog[]; token: string | null; addLog: (l: Omit<HelpLog, "id" | "date">) => void; undoLast: () => void; initialStudent?: string }) {
  const [who, setWho] = useState(initialStudent || "");
  const [topic, setTopic] = useState("");
  const [situation, setSituation] = useState<SituationId>("wont-start");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [coach, setCoach] = useState<LiveCoach | null>(null);
  const [step, setStep] = useState(0);
  const [whisper, setWhisper] = useState(() => { try { return localStorage.getItem(WHISPER_KEY) === "1"; } catch { return false; } });
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const student = students.find((s) => s.name === who);
  useEffect(() => () => { stopSpeaking(); rec.current?.stop(); }, []);

  const listen = () => {
    const R = Recognizer();
    if (!R) { (document.getElementById("coach-topic") as HTMLInputElement | null)?.focus(); setError("Tap the mic on your keyboard to say it."); return; }
    if (listening) { rec.current?.stop(); return; }
    const r = new R(); rec.current = r;
    r.lang = "en-US"; r.interimResults = true; r.continuous = false;
    r.onresult = (e: any) => { const text = Array.from(e.results as ArrayLike<any>).map((x: any) => x[0]?.transcript || "").join(" ").trim(); if (text) setTopic(text); };
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    setListening(true); setError("");
    try { r.start(); } catch { setListening(false); }
  };

  const ask = async () => {
    if (!student || !topic.trim() || busy) return;
    setBusy(true); setError(""); setCoach(null); setStep(0); stopSpeaking();
    try {
      const { coach } = await post<{ coach: LiveCoach }>(token, "live", {
        topic: topic.trim(), situation, detail: detail.trim(), subject: workspace.profile?.subject || "",
        student: {
          name: student.name, grade: student.grade, disability: [student.disability1, student.disability2].filter(Boolean).join(", "),
          readingLevel: student.readingLevel, mathLevel: student.mathLevel, accommodations: student.accommodations, notes: student.notes,
          whatWorks: whatWorksSentence(logs, student.name),
        },
      });
      setCoach(coach);
      if (whisper) speakOut(liveCoachSpeech(coach));
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };
  const toggleWhisper = () => { const v = !whisper; setWhisper(v); try { localStorage.setItem(WHISPER_KEY, v ? "1" : "0"); } catch { /* fine */ } if (!v) stopSpeaking(); else if (coach) speakOut(liveCoachSpeech(coach)); };
  const best = student ? whatWorks(logs, student.name, situation).filter((w) => w.worked > 0).slice(0, 3) : [];

  return <div className="space-y-4" data-testid="coach-live">
    <section className={card}>
      <p className={eyebrow}>Who</p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Student">
        {students.length ? students.map((s) => <button key={s.id} type="button" onClick={() => setWho(s.name)} aria-pressed={who === s.name} className={pill(who === s.name)}>{s.name}</button>)
          : <p className="text-sm text-slate-500">Add students on the Caseload tab first.</p>}
      </div>
      {student && best.length > 0 && <p className="mt-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900" data-testid="coach-best">
        <b>What's worked for {student.name.split(" ")[0]}:</b> {best.map((w) => `${w.label.toLowerCase()} (${w.worked}/${w.tries})`).join(", ")}</p>}

      <p className={`${eyebrow} mt-4`}>What they're working on</p>
      <div className="mt-2 flex gap-2">
        <input id="coach-topic" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void ask(); }} placeholder="Finding area, main idea, 2-digit subtraction…" maxLength={120}
          className="min-h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-slate-400" data-testid="coach-topic" />
        <button type="button" onClick={listen} aria-label={listening ? "Stop listening" : "Say it"} className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${listening ? "bg-rose-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
      </div>

      <p className={`${eyebrow} mt-4`}>What's happening</p>
      <div className="mt-2 flex flex-wrap gap-2">{SITUATIONS.map((s) => <button key={s.id} type="button" onClick={() => setSituation(s.id)} aria-pressed={situation === s.id} className={pill(situation === s.id)}>{s.label}</button>)}</div>
      <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Anything else? (optional: “keeps erasing”, “says it's boring”)" maxLength={300} className="mt-3 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400" />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void ask()} disabled={!student || !topic.trim() || busy} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-base font-bold text-white disabled:opacity-40 sm:flex-none" data-testid="coach-ask">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}{busy ? "Coaching…" : "Coach me"}</button>
        <button type="button" onClick={toggleWhisper} aria-pressed={whisper} className={pill(whisper)} data-testid="coach-whisper" title="Reads the coaching aloud. With AirPods in, only you hear it.">
          {whisper ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}{whisper ? "Whisper on" : "Whisper off"}</button>
      </div>
      {whisper && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Ear className="h-3.5 w-3.5" />Put an AirPod in: the coaching is read to you, and nobody else hears it.</p>}
      {error && <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{error}</p>}
    </section>

    {coach && student && <section className="space-y-3" data-testid="coach-answer" aria-live="polite">
      <div className="rounded-3xl bg-slate-900 p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[.14em] text-white/60">Say this</p>
          <button type="button" onClick={() => speakOut(liveCoachSpeech(coach))} aria-label="Read it to me" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"><Volume2 className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-2xl font-black leading-snug sm:text-3xl" data-testid="coach-direction">“{coach.direction}”</p>
        {coach.firstStep && <p className="mt-3 text-base text-white/85"><b className="text-white">First step only:</b> {coach.firstStep}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">{coach.ways.map((w) => <div key={w.kind} className={card}>
        <p className="flex items-center gap-2 text-sm font-black text-slate-900">
          <span className={`grid h-8 w-8 place-items-center rounded-xl ${w.kind === "hands-on" ? "bg-amber-100 text-amber-700" : w.kind === "picture" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"}`}>
            {w.kind === "hands-on" ? <Hand className="h-4 w-4" /> : w.kind === "picture" ? <ImageIcon className="h-4 w-4" /> : <Star className="h-4 w-4" />}</span>
          {w.kind === "hands-on" ? "Hands-on" : w.kind === "picture" ? "Picture" : "Their interests"}
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-900">{w.title}</p>
        {w.do && <p className="mt-1 text-sm text-slate-700"><b>Do:</b> {w.do}</p>}
        {w.say && <p className="mt-1 text-sm text-slate-700"><b>Say:</b> “{w.say}”</p>}
      </div>)}</div>

      <div className="grid gap-3 sm:grid-cols-2">
        {coach.showMe && <div className={card}><p className={eyebrow}>Check (not “does that make sense?”)</p><p className="mt-1 text-base font-semibold text-slate-900">“{coach.showMe}”</p></div>}
        {coach.watchFor && <div className={card}><p className={eyebrow}>Watch for</p><p className="mt-1 text-sm text-slate-800">{coach.watchFor}</p></div>}
      </div>

      {coach.ladder.length > 0 && <div className={card} data-testid="coach-ladder">
        <p className={eyebrow}>Still stuck? Go one step up (least help first)</p>
        <ol className="mt-2 space-y-1.5">{coach.ladder.map((l, i) => <li key={i}>
          <button type="button" onClick={() => setStep(i)} className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left text-sm ${i === step ? "bg-indigo-50 text-indigo-950 ring-1 ring-indigo-200" : i < step ? "text-slate-400" : "text-slate-800 hover:bg-slate-50"}`}>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${i === step ? "bg-indigo-600 text-white" : i < step ? "bg-slate-200 text-slate-500" : "bg-slate-100 text-slate-700"}`}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
            <span><span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">{PROMPT_LADDER[Math.min(i, PROMPT_LADDER.length - 1)]}</span>{l}</span>
          </button></li>)}</ol>
      </div>}
      {coach.praise && <p className="rounded-3xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><b>The moment they try, say:</b> “{coach.praise}”</p>}

      <WhatWorked student={student.name} topic={topic} situation={situation} addLog={addLog} undoLast={undoLast} />
    </section>}

    {!coach && student && <WhatWorked student={student.name} topic={topic} situation={situation} addLog={addLog} undoLast={undoLast} quick />}
  </div>;
}

/** The help tracker's one tap: what you tried, then whether it worked. */
function WhatWorked({ student, topic, situation, addLog, undoLast, quick }: { student: string; topic: string; situation: SituationId; addLog: (l: Omit<HelpLog, "id" | "date">) => void; undoLast: () => void; quick?: boolean }) {
  const [tried, setTried] = useState<StrategyId | null>(null);
  const [saved, setSaved] = useState<string>("");
  const first = student.split(" ")[0];
  const log = (worked: boolean) => { if (!tried) return; addLog({ student, topic: topic.trim(), situation, strategy: tried, worked }); setSaved(`${strategyLabel(tried)} · ${worked ? "worked" : "didn't work"}`); setTried(null); };
  return <section className={card} data-testid="coach-tracker">
    <p className={eyebrow}>{quick ? `Log what you tried with ${first} (no coaching needed)` : `What did you try with ${first}?`}</p>
    <div className="mt-2 flex flex-wrap gap-2">{STRATEGIES.map((s) => <button key={s.id} type="button" onClick={() => { setTried(s.id); setSaved(""); }} aria-pressed={tried === s.id} className={pill(tried === s.id)} data-testid="coach-strategy"><span aria-hidden>{s.emoji}</span>{s.label}</button>)}</div>
    {tried && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-3">
      <span className="text-sm font-semibold text-slate-800">Did it work?</span>
      <button type="button" onClick={() => log(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white" data-testid="coach-worked"><Check className="h-4 w-4" />Yes, they got going</button>
      <button type="button" onClick={() => log(false)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700" data-testid="coach-didnt"><X className="h-4 w-4" />Not this time</button>
    </div>}
    {saved && <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Check className="h-4 w-4 text-emerald-600" />Saved: {saved}. <button type="button" onClick={() => { undoLast(); setSaved(""); }} className="font-semibold underline">Undo</button></p>}
  </section>;
}

// ───────────────────────────── What works ─────────────────────────────

function Works({ students, logs, today, addLog: _addLog, say }: { students: Workspace["students"]; logs: HelpLog[]; today: string; addLog: (l: Omit<HelpLog, "id" | "date">) => void; say: (t: string) => void }) {
  const withLogs = students.filter((s) => logsFor(logs, s.name).length);
  const [who, setWho] = useState(withLogs[0]?.name || "");
  const back = (n: number) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const [from, setFrom] = useState(back(30));
  const [to, setTo] = useState(today);
  if (!withLogs.length) return <div className={card}><p className="text-sm text-slate-600">Nothing logged yet. After you help a student in <b>Live coach</b>, tap what you tried and whether it worked. In a few weeks this shows what gets each student going, and writes it up for their IEP progress notes.</p></div>;
  const mine = logsFor(logs, who);
  const ranked = whatWorks(logs, who);
  const note = progressNote(logs, who, from, to);
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); say("Copied."); } catch { say("Couldn't copy. Select the text and copy it."); } };
  return <div className="space-y-4" data-testid="coach-works">
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{withLogs.map((s) => <button key={s.id} type="button" onClick={() => setWho(s.name)} aria-pressed={who === s.name} className={pill(who === s.name)}>{s.name} <span className="opacity-60">{logsFor(logs, s.name).length}</span></button>)}</div>
    <section className={card}>
      <p className="text-base font-semibold text-slate-900">{whatWorksSentence(logs, who)}</p>
      <ul className="mt-4 space-y-2.5">{ranked.map((w) => <li key={w.strategy}>
        <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-800">{STRATEGIES.find((s) => s.id === w.strategy)?.emoji} {w.label}</span><span className="tabular-nums text-slate-500">{w.worked} of {w.tries}</span></div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${w.rate >= 0.67 ? "bg-emerald-500" : w.rate >= 0.34 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${Math.max(6, w.rate * 100)}%` }} /></div>
      </li>)}</ul>
    </section>
    <section className={card} data-testid="coach-progress-note">
      <p className={eyebrow}>IEP progress note</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 min-h-10 rounded-xl border border-slate-200 px-2" /></label><label>to <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 min-h-10 rounded-xl border border-slate-200 px-2" /></label></div>
      <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">{note || "Nothing logged in those dates."}</p>
      {note && <button type="button" onClick={() => void copy(note)} className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"><ClipboardCopy className="h-4 w-4" />Copy</button>}
    </section>
    <details className={card}><summary className="cursor-pointer text-sm font-semibold text-slate-700">Every entry for {who.split(" ")[0]} ({mine.length})</summary>
      <ul className="mt-3 divide-y divide-slate-100 text-sm">{[...mine].reverse().slice(0, 100).map((l) => <li key={l.id} className="flex items-center justify-between gap-3 py-2">
        <span className="min-w-0"><span className="font-semibold text-slate-800">{strategyLabel(l.strategy)}</span>{l.topic && <span className="text-slate-500"> · {l.topic}</span>}<span className="block text-xs text-slate-400">{l.date}{l.situation ? ` · ${SITUATIONS.find((s) => s.id === l.situation)?.label}` : ""}</span></span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${l.worked ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{l.worked ? "Worked" : "Didn't"}</span>
      </li>)}</ul>
    </details>
  </div>;
}

// ───────────────────────────── Lesson prep ─────────────────────────────

function Prep({ workspace, setWorkspace, students, token, say }: { workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; students: Workspace["students"]; token: string | null; say: (t: string) => void }) {
  const lessons = useMemo(() => [...(workspace.lessons || [])].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))), [workspace.lessons]);
  const saved = useMemo(() => cleanSavedPreps((workspace as any).coachPreps), [(workspace as any).coachPreps]);
  const [lessonId, setLessonId] = useState(lessons[0]?.id || "");
  const [extra, setExtra] = useState("");
  const [forWho, setForWho] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lesson = lessons.find((l) => l.id === lessonId);
  const prep: LessonPrep | null = saved.find((p) => p.lessonId === lessonId)?.prep ?? null;
  const run = async () => {
    if (!lesson || busy) return;
    setBusy(true); setError("");
    try {
      const studentsText = students.filter((s) => forWho.includes(s.name)).map((s) => [s.name.split(" ")[0], s.grade && `grade ${s.grade}`, s.readingLevel && `reads at ${s.readingLevel}`, s.mathLevel && `math at ${s.mathLevel}`, [s.disability1, s.disability2].filter(Boolean).join("/")].filter(Boolean).join(", ")).join("; ");
      const { prep } = await post<{ prep: LessonPrep }>(token, "lesson", { lesson, extra: extra.trim(), students: studentsText });
      setWorkspace((w) => ({ ...w, coachPreps: [...cleanSavedPreps((w as any).coachPreps).filter((p) => p.lessonId !== lesson.id), { lessonId: lesson.id, at: new Date().toISOString(), prep }] } as any));
      say("Lesson prep is ready.");
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };
  if (!lessons.length) return <div className={card}><p className="text-sm text-slate-600">Add a lesson in the <b>Lessons</b> tab, then come back here to get ready to explain it.</p></div>;
  return <div className="space-y-4" data-testid="coach-prep">
    <section className={card}>
      <label className="block"><span className={eyebrow}>Lesson</span>
        <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base" data-testid="coach-lesson">
          {lessons.map((l) => <option key={l.id} value={l.id}>{l.title || "Untitled lesson"}{l.date ? ` · ${l.date}` : ""}{saved.some((p) => p.lessonId === l.id) ? " ✓" : ""}</option>)}
        </select></label>
      <label className="mt-3 block"><span className={eyebrow}>The problems they'll do (optional)</span>
        <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3} maxLength={2000} placeholder="Paste or type the problems, or leave this empty and the coach picks typical ones." className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400" /></label>
      {students.length > 0 && <><p className={`${eyebrow} mt-3`}>For (optional)</p>
        <div className="mt-2 flex flex-wrap gap-2">{students.map((s) => <button key={s.id} type="button" onClick={() => setForWho((f) => (f.includes(s.name) ? f.filter((x) => x !== s.name) : [...f, s.name]))} aria-pressed={forWho.includes(s.name)} className={pill(forWho.includes(s.name))}>{s.name}</button>)}</div></>}
      <button type="button" onClick={() => void run()} disabled={!lesson || busy} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-indigo-600 px-5 text-base font-bold text-white disabled:opacity-40" data-testid="coach-prep-run">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}{busy ? "Preparing…" : prep ? "Prepare again" : "Prepare me"}</button>
      {error && <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{error}</p>}
    </section>

    {prep && <section className="space-y-3" data-testid="coach-prep-result">
      {prep.bigIdea && <div className="rounded-3xl bg-slate-900 p-5 text-white"><p className="text-[11px] font-black uppercase tracking-[.14em] text-white/60">The big idea, in their words</p><p className="mt-1 text-xl font-black leading-snug">{prep.bigIdea}</p></div>}
      {prep.vocab.length > 0 && <div className={card}><p className={eyebrow}>Words to teach first</p><ul className="mt-2 grid gap-2 sm:grid-cols-2">{prep.vocab.map((v) => <li key={v.word} className="text-sm"><b>{v.word}</b>: {v.kidWords}</li>)}</ul></div>}
      {prep.problems.map((p, i) => <article key={i} className={card}>
        <p className="text-xs font-black uppercase tracking-wide text-indigo-600">Problem {i + 1}</p>
        <h3 className="mt-1 text-base font-bold text-slate-900">{p.problem}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-950"><b>Likely mistake:</b> {p.mistake}{p.catchIt && <><br /><b>Catch it:</b> {p.catchIt}</>}</div>
          <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-950"><b>Just do this part:</b> {p.firstStep}{p.showMe && <><br /><b>Show me:</b> “{p.showMe}”</>}</div>
        </div>
        {p.worked.length > 0 && <div className="mt-3"><p className={eyebrow}>Worked example (do this one out loud)</p><ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-slate-800">{p.worked.map((s, j) => <li key={j}>{s}</li>)}</ol></div>}
        {p.partial.problem && <div className="mt-3 rounded-2xl border border-dashed border-slate-300 p-3"><p className={eyebrow}>Partly done (they finish it)</p><p className="mt-1 text-sm font-semibold text-slate-900">{p.partial.problem}</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-slate-600">{p.partial.done.map((s, j) => <li key={j}>{s} <span className="text-emerald-600">✓</span></li>)}<li className="font-semibold text-slate-900">{p.partial.left} ← their turn</li></ol></div>}
      </article>)}
    </section>}
  </div>;
}
