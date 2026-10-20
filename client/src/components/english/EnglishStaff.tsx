// "English learners" in the Reader (pages/TeacherReader.tsx): English Explorer for teachers and the
// administrator. Turn it on for the students who need it, set where they start and their home language,
// and follow every English learner at the school (not only your own class): level, words mastered,
// accuracy by skill (listening, reading, writing, speaking), time spent, streaks and the words they miss.
// Server: server/ariseEnglish.ts. Colors are the Reader's dark ones.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { appHref } from "@/lib/hubs";
import { LEVELS } from "@shared/ariseEnglish";

const C = { card: "#151326", raised: "#1d1a33", line: "rgba(255,255,255,0.09)", text: "#ece9f7", soft: "#a29fb8", accent: "#7c3aed", bar: "#8b5cf6", good: "#34d399", warn: "#fbbf24" };
const card = { background: C.card, borderColor: C.line };

type Learner = {
  id: number; name: string; username: string; teacherName: string; grade: string | null; enabled: boolean; startLevel: number; homeLanguage: string | null; homeLanguageName: string; helpOn: boolean;
  note: string; enabledBy: string; enabledAt: string; level: number; levelTitle: string; unitsDone: number; unitsInLevel: number; unitsDoneAll: number; unitsAll: number;
  wordsMastered: number; wordsLearning: number; due: number; accuracy7: number | null; accuracy: number | null; minutes7: number; sessions7: number; sessions: number;
  streak: number; lastActive: string | null; points: number; points7: number; mine: boolean;
};
type Overview = { learners: Learner[]; totals: { learners: number; active7: number; mastered: number; minutes7: number; accuracy7: number | null; points7: number; levels: number[] }; languages: { id: string; name: string }[] };
type Detail = {
  summary: Learner;
  skills: { skill: string; right30: number; total30: number; right: number; total: number }[];
  levels: { n: number; title: string; wida: string; color: string; units: { id: string; title: string; icon: string; stars: number; best: number; plays: number; mastered: number; learning: number; words: number }[] }[];
  words: { mastered: { w: string; e: string }[]; learning: { w: string; e: string; box: number }[] };
  trouble: { w: string; e: string; es: string; wrong: number; right: number; box: number }[];
  days: { day: string; minutes: number; sessions: number; points: number }[];
  speaking: { tried: number; right: number; recent: { word: string; heard: string; ok: boolean; at: string }[] };
  sessions: { at: string; kind: string; unit: string; score: number; total: number; stars: number; points: number; minutes: number }[];
};

const ago = (iso: string | null) => {
  if (!iso) return "Not yet";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400_000);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : `${d} days ago`;
};
const pctText = (n: number | null) => (n === null ? "None yet" : `${n}%`);
const isPic = (e: string) => !e.startsWith("scene:") && !e.startsWith("cal:");

export default function EnglishStaff() {
  const { token } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [who, setWho] = useState<"all" | "mine">("all");
  const [q, setQ] = useState("");
  const [level, setLevel] = useState(0);
  const [sort, setSort] = useState<"name" | "active" | "level" | "mastered" | "accuracy">("active");
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [how, setHow] = useState(false);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || "Something went wrong. Please try again.");
    return d;
  }, [token]);
  const load = useCallback(() => request("/api/english/staff/overview").then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message)), [request]);
  useEffect(() => { void load(); }, [load]);
  const say = (t: string) => { setFlash(t); window.setTimeout(() => setFlash((f) => (f === t ? "" : f)), 3500); };

  const download = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/english/staff/export.csv`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error("The download didn't work. Try again.");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a"); a.href = url; a.download = `english-learners-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.message); }
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (data?.learners || []).filter((l) => (who === "all" || l.mine) && (!level || l.level === level) && (!needle || l.name.toLowerCase().includes(needle) || l.username.toLowerCase().includes(needle) || l.teacherName.toLowerCase().includes(needle)));
    const by: Record<typeof sort, (a: Learner, b: Learner) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      active: (a, b) => String(b.lastActive || "").localeCompare(String(a.lastActive || "")) || a.name.localeCompare(b.name),
      level: (a, b) => b.level - a.level || b.unitsDoneAll - a.unitsDoneAll,
      mastered: (a, b) => b.wordsMastered - a.wordsMastered,
      accuracy: (a, b) => (b.accuracy7 ?? -1) - (a.accuracy7 ?? -1),
    };
    return list.sort((a, b) => Number(b.enabled) - Number(a.enabled) || by[sort](a, b));
  }, [data, who, q, level, sort]);

  const t = data?.totals;
  return <div className="flex min-w-0 flex-col gap-4" data-testid="reader-english">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[30px] font-black tracking-[-0.02em]">English learners</h1>
        <p className="max-w-[640px] text-[15px]" style={{ color: C.soft }}>English Explorer teaches English words from a student's very first words up to academic words, with the AI voice, pictures and games. Turn it on for the students who need it. Every teacher at your school sees every English learner here.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setAdding(true)} className="min-h-11 rounded-xl px-4 text-sm font-extrabold text-white" style={{ background: C.accent }}>Turn on for students</button>
        <a href={appHref("/english")} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold" style={{ borderColor: "rgba(255,255,255,0.16)", color: "#ddd6fe" }}>Try it as a student</a>
        <button type="button" onClick={() => void download()} className="min-h-11 rounded-xl border px-4 text-sm font-bold" style={{ borderColor: "rgba(255,255,255,0.16)", color: "#ddd6fe" }}>Download CSV</button>
      </div>
    </div>

    {flash && <div role="status" className="rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: "rgba(52,211,153,.4)", background: "rgba(52,211,153,.1)", color: "#a7f3d0" }}>{flash}</div>}
    {error && <div role="alert" className="rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: "rgba(251,191,36,.4)", background: "rgba(251,191,36,.08)", color: "#fde68a" }}>{error}</div>}

    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
      {([["English learners", t ? t.learners : "…"], ["Played this week", t ? t.active7 : "…"], ["Words mastered", t ? t.mastered.toLocaleString() : "…"], ["Right the first time, this week", t ? pctText(t.accuracy7) : "…"], ["Minutes this week", t ? t.minutes7.toLocaleString() : "…"]] as const).map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1 rounded-2xl border p-4" style={card}>
          <span className="text-[28px] font-black leading-none">{value}</span>
          <span className="text-sm font-bold" style={{ color: C.soft }}>{label}</span>
        </div>
      ))}
    </div>

    {t && t.learners > 0 && <section className="rounded-[18px] border p-4" style={card} aria-label="Learners by level">
      <h2 className="mb-2 text-base font-extrabold">Learners by level</h2>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {LEVELS.map((l, i) => <button key={l.n} type="button" onClick={() => setLevel(level === l.n ? 0 : l.n)} aria-pressed={level === l.n}
          className="flex items-center gap-3 rounded-xl border px-3 py-2 text-left" style={{ borderColor: level === l.n ? l.color : C.line, background: level === l.n ? "rgba(255,255,255,0.05)" : "transparent" }}>
          <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: l.color }} />
          <span className="min-w-0"><span className="block text-lg font-black leading-tight">{t.levels[i]}</span><span className="block truncate text-xs font-semibold" style={{ color: C.soft }}>Level {l.n}: {l.title}</span></span>
        </button>)}
      </div>
    </section>}

    <section className="flex flex-col gap-3 rounded-[18px] border p-4" style={card}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border p-1" style={{ borderColor: C.line }} role="tablist" aria-label="Which students">
          {(["all", "mine"] as const).map((w) => <button key={w} type="button" role="tab" aria-selected={who === w} onClick={() => setWho(w)} className="min-h-9 rounded-lg px-3 text-sm font-bold" style={who === w ? { background: C.accent, color: "#fff" } : { color: C.soft }}>{w === "all" ? "Everyone at school" : "My class"}</button>)}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by student or teacher" aria-label="Search" className="min-h-11 min-w-0 flex-1 rounded-xl border bg-transparent px-3 text-sm outline-none focus:border-violet-400" style={{ borderColor: C.line, color: C.text }} />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="min-h-11 rounded-xl border px-3 text-sm" style={{ borderColor: C.line, background: C.raised, color: C.text }}>
          <option value="active">Most recently active</option><option value="name">Name</option><option value="level">Level</option><option value="mastered">Words mastered</option><option value="accuracy">Accuracy this week</option>
        </select>
      </div>
      {!data ? <p className="text-sm" style={{ color: C.soft }}>Loading…</p>
        : !data.learners.length ? <div className="rounded-xl border border-dashed p-6 text-center" style={{ borderColor: C.line }}>
          <p className="text-[15px] font-bold">No English learners yet.</p>
          <p className="mt-1 text-sm" style={{ color: C.soft }}>Turn on English Explorer for the students who are learning English. They'll see it in their library.</p>
          <button type="button" onClick={() => setAdding(true)} className="mt-3 min-h-11 rounded-xl px-4 text-sm font-extrabold text-white" style={{ background: C.accent }}>Turn on for students</button>
        </div>
        : !rows.length ? <p className="text-sm" style={{ color: C.soft }}>No one matches. Try "Everyone at school" or another search.</p>
        : <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr style={{ color: C.soft }} className="text-xs">
              <th className="py-2 pr-3 font-bold">Student</th><th className="py-2 pr-3 font-bold">Level</th><th className="py-2 pr-3 font-bold">Words mastered</th>
              <th className="py-2 pr-3 font-bold">Right first time (7 days)</th><th className="py-2 pr-3 font-bold">Minutes (7 days)</th><th className="py-2 pr-3 font-bold">Streak</th><th className="py-2 pr-3 font-bold">Last played</th><th className="py-2" />
            </tr></thead>
            <tbody>{rows.map((l) => {
              const lv = LEVELS[l.level - 1];
              return <tr key={l.id} className="border-t" style={{ borderColor: C.line, opacity: l.enabled ? 1 : 0.55 }}>
                <td className="py-2.5 pr-3"><button type="button" onClick={() => setOpen(l.id)} className="text-left font-bold hover:underline">{l.name}</button>
                  <div className="text-xs" style={{ color: C.soft }}>{l.teacherName || "No teacher"}{l.grade ? `, grade ${l.grade}` : ""}{l.homeLanguageName ? `, ${l.homeLanguageName}` : ""}{l.enabled ? "" : ", turned off"}</div></td>
                <td className="py-2.5 pr-3"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: lv.color }} /><span className="font-semibold">{l.level}: {l.levelTitle}</span></div>
                  <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} title={`${l.unitsDone} of ${l.unitsInLevel} lessons done in this level`}><div className="h-full rounded-full" style={{ width: `${(l.unitsDone / l.unitsInLevel) * 100}%`, background: lv.color }} /></div></td>
                <td className="py-2.5 pr-3 font-semibold">{l.wordsMastered}<span style={{ color: C.soft }}> + {l.wordsLearning} learning</span></td>
                <td className="py-2.5 pr-3 font-semibold">{pctText(l.accuracy7)}</td>
                <td className="py-2.5 pr-3 font-semibold">{l.minutes7}</td>
                <td className="py-2.5 pr-3 font-semibold">{l.streak ? `${l.streak} ${l.streak === 1 ? "day" : "days"}` : "None"}</td>
                <td className="py-2.5 pr-3" style={{ color: C.soft }}>{ago(l.lastActive)}</td>
                <td className="py-2.5 text-right"><button type="button" onClick={() => setOpen(l.id)} className="min-h-9 rounded-[10px] border px-3 text-sm font-bold" style={{ borderColor: "rgba(255,255,255,0.14)", color: "#ddd6fe" }}>Open</button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
    </section>

    <section className="rounded-[18px] border p-4" style={card}>
      <button type="button" onClick={() => setHow(!how)} aria-expanded={how} className="flex w-full items-center justify-between gap-3 text-left text-base font-extrabold">How English Explorer teaches<span aria-hidden="true">{how ? "−" : "+"}</span></button>
      {how && <div className="mt-3 grid gap-3 text-sm leading-relaxed md:grid-cols-2" style={{ color: "#d4d1e6" }}>
        <HowItem title="Six levels that follow WIDA">Level 1 First Words (Entering) up to level 6 Word Master (Reaching): 324 words and phrases in 40 lessons. Each level is a small step past what the student already knows. You choose where each student starts.</HowItem>
        <HowItem title="Picture, sound and word together">Every word comes with a picture, the AI voice (normal and slow) and a short sentence, so meaning never depends on reading alone. Level 1 starts every word with listening.</HowItem>
        <HowItem title="Practice that makes them remember">Students pull the word from memory: hear it and find the picture, read it, spell it, fill the blank, put a sentence in order. Feedback comes right away. Only the first try counts for the score.</HowItem>
        <HowItem title="Words come back at the right time">Spaced repetition: a word answered right comes back after 1, 2, 4, 8, then 16 days. A missed word comes back the next day. A word is "mastered" after it has been right several times over more than a week.</HowItem>
        <HowItem title="Home language help">With Spanish help on, students can see and hear each word in Spanish, and look-alike words (planet and planeta) are pointed out. Other home languages are recorded for you, and support stays in English with pictures.</HowItem>
        <HowItem title="Speaking, tracked like the other skills">Students say words into the microphone and hear whether they were understood. Recordings are never saved. You see listening, reading, writing and speaking separately.</HowItem>
        <HowItem title="Points on the leaderboard">A new lesson passed earns 15 points, plus 5 for each extra star. Replays, reviews and speaking earn a little more, and finishing a level earns 25. English points can go up to 60 a day. They count on the A.R.I.S.E. leaderboards and the Advisory Challenge.</HowItem>
        <HowItem title="Turning it on and off">Any teacher can turn it on for students at their school, and the administrator for anyone. Turning it off keeps the student's progress in case it is turned on again.</HowItem>
      </div>}
    </section>

    {adding && <AddStudents request={request} languages={data?.languages || []} onClose={() => setAdding(false)} onDone={(text) => { say(text); void load(); }} />}
    {open !== null && <LearnerPanel id={open} request={request} languages={data?.languages || []} onClose={() => setOpen(null)} onSaved={(text) => { say(text); void load(); }} />}
  </div>;
}

function HowItem({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-xl border p-3" style={{ borderColor: C.line }}><h3 className="mb-1 text-[15px] font-extrabold" style={{ color: C.text }}>{title}</h3><p>{children}</p></div>;
}

function Overlay({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
    <div className={`w-full ${wide ? "max-w-[980px]" : "max-w-[620px]"} rounded-[20px] border p-4 sm:p-5`} style={{ background: "#110f20", borderColor: C.line, color: C.text }} onClick={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-start justify-between gap-3"><h2 className="text-[22px] font-black leading-tight">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" style={{ color: C.soft }}>✕</button></div>
      {children}
    </div>
  </div>;
}

const field = "min-h-11 rounded-xl border px-3 text-sm";
const fieldStyle = { borderColor: C.line, background: C.raised, color: C.text };

function AddStudents({ request, languages, onClose, onDone }: { request: (p: string, i?: RequestInit) => Promise<any>; languages: { id: string; name: string }[]; onClose: () => void; onDone: (text: string) => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<{ id: number; name: string; username: string; teacherName: string; mine: boolean; enabled: boolean; added: boolean }[] | null>(null);
  const [startLevel, setStartLevel] = useState(1);
  const [lang, setLang] = useState("es");
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { request(`/api/english/staff/students?q=${encodeURIComponent(q)}`).then((d) => setList(d.students || [])).catch((e) => setErr(e.message)); }, 250);
    return () => clearTimeout(t);
  }, [q, request]);
  const turnOn = async (s: { id: number; name: string }) => {
    setBusy(s.id); setErr("");
    try {
      await request(`/api/english/staff/learners/${s.id}`, { method: "POST", body: JSON.stringify({ enabled: true, startLevel, homeLanguage: lang || null, helpOn: lang === "es" }) });
      setList((l) => (l || []).map((x) => (x.id === s.id ? { ...x, enabled: true, added: true } : x)));
      onDone(`English Explorer is on for ${s.name}.`);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };
  return <Overlay title="Turn on English Explorer" onClose={onClose}>
    <p className="mb-3 text-sm" style={{ color: C.soft }}>Choose where new students start and their home language, then turn it on for each student. They'll see English Explorer in their library right away.</p>
    <div className="mb-3 grid gap-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: C.soft }}>Starts at
        <select value={startLevel} onChange={(e) => setStartLevel(Number(e.target.value))} className={field} style={fieldStyle}>{LEVELS.map((l) => <option key={l.n} value={l.n}>Level {l.n}: {l.title} ({l.wida.split(" · ")[1]})</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: C.soft }}>Home language
        <select value={lang} onChange={(e) => setLang(e.target.value)} className={field} style={fieldStyle}><option value="">Not set</option>{languages.map((l) => <option key={l.id} value={l.id}>{l.name}{l.id === "es" ? " (with Spanish help)" : ""}</option>)}</select></label>
    </div>
    <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Search students by name or username" aria-label="Search students" className={`${field} mb-3 w-full`} style={fieldStyle} />
    {err && <p role="alert" className="mb-2 text-sm font-semibold" style={{ color: "#fde68a" }}>{err}</p>}
    {!list ? <p className="text-sm" style={{ color: C.soft }}>Loading…</p> : !list.length ? <p className="text-sm" style={{ color: C.soft }}>No students match that search.</p>
      : <ul className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">{list.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2" style={{ borderColor: C.line }}>
        <span className="min-w-0"><span className="block font-bold">{s.name}</span><span className="block text-xs" style={{ color: C.soft }}>@{s.username}{s.teacherName ? `, ${s.teacherName}` : ""}{s.mine ? " (your class)" : ""}</span></span>
        {s.enabled ? <span className="shrink-0 text-sm font-bold" style={{ color: C.good }}>On</span>
          : <button type="button" disabled={busy === s.id} onClick={() => void turnOn(s)} className="min-h-10 shrink-0 rounded-[10px] px-3 text-sm font-extrabold text-white disabled:opacity-60" style={{ background: C.accent }}>{busy === s.id ? "Turning on…" : s.added ? "Turn on again" : "Turn on"}</button>}
      </li>)}</ul>}
  </Overlay>;
}

function LearnerPanel({ id, request, languages, onClose, onSaved }: { id: number; request: (p: string, i?: RequestInit) => Promise<any>; languages: { id: string; name: string }[]; onClose: () => void; onSaved: (text: string) => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ enabled: boolean; startLevel: number; homeLanguage: string; helpOn: boolean; note: string } | null>(null);
  const load = useCallback(() => request(`/api/english/staff/learners/${id}`).then((x: Detail) => {
    setD(x); setForm({ enabled: x.summary.enabled, startLevel: x.summary.startLevel, homeLanguage: x.summary.homeLanguage || "", helpOn: x.summary.helpOn, note: x.summary.note });
  }).catch((e) => setErr(e.message)), [id, request]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (!form || !d) return;
    setSaving(true); setErr("");
    try {
      await request(`/api/english/staff/learners/${id}`, { method: "POST", body: JSON.stringify({ ...form, homeLanguage: form.homeLanguage || null }) });
      onSaved(`Saved ${d.summary.name}'s English Explorer settings.`); void load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };
  const s = d?.summary;
  return <Overlay title={s ? s.name : "English learner"} onClose={onClose} wide>
    {err && <p role="alert" className="mb-3 text-sm font-semibold" style={{ color: "#fde68a" }}>{err}</p>}
    {!d || !s || !form ? <p className="text-sm" style={{ color: C.soft }}>Loading…</p> : <div className="flex flex-col gap-4">
      <p className="-mt-2 text-sm" style={{ color: C.soft }}>@{s.username}{s.teacherName ? `, ${s.teacherName}'s class` : ""}{s.grade ? `, grade ${s.grade}` : ""}{s.enabledBy ? `. Turned on by ${s.enabledBy}` : ""}{s.enabledAt ? ` on ${new Date(s.enabledAt).toLocaleDateString()}` : ""}.</p>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        {([["Level", `${s.level}: ${s.levelTitle}`], ["Lessons done", `${s.unitsDoneAll} of ${s.unitsAll}`], ["Words mastered", `${s.wordsMastered}`], ["Still learning", `${s.wordsLearning}`], ["Right first time", pctText(s.accuracy)], ["English points", `${s.points}`]] as const).map(([k, v]) => (
          <div key={k} className="rounded-xl border p-3" style={card}><div className="text-lg font-black leading-tight">{v}</div><div className="text-xs font-bold" style={{ color: C.soft }}>{k}</div></div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[16px] border p-4" style={card}>
          <h3 className="text-base font-extrabold">Skills, last 30 days</h3>
          <p className="mb-3 text-xs" style={{ color: C.soft }}>Share of questions right the first time. Speaking counts what the microphone understood.</p>
          <SkillBars skills={d.skills} />
        </section>
        <section className="rounded-[16px] border p-4" style={card}>
          <h3 className="text-base font-extrabold">Minutes a day, last 2 weeks</h3>
          <p className="mb-3 text-xs" style={{ color: C.soft }}>{s.minutes7} minutes and {s.sessions7} lessons this week. Streak: {s.streak ? `${s.streak} ${s.streak === 1 ? "day" : "days"}` : "none right now"}.</p>
          <DayColumns days={d.days} />
        </section>
      </div>

      <section className="rounded-[16px] border p-4" style={card}>
        <h3 className="mb-2 text-base font-extrabold">Lessons</h3>
        <div className="flex flex-col gap-3">{d.levels.filter((l) => (l.n >= s.startLevel && l.n <= s.level) || l.units.some((u) => u.plays > 0)).map((l) => <div key={l.n}>
          <div className="mb-1.5 flex items-center gap-2 text-sm font-bold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />Level {l.n}: {l.title} <span className="font-semibold" style={{ color: C.soft }}>({l.wida})</span></div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>{l.units.map((u) => (
            <div key={u.id} className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: C.line, opacity: u.plays ? 1 : 0.55 }} title={u.plays ? `Best ${u.best}%, played ${u.plays} ${u.plays === 1 ? "time" : "times"}` : "Not played yet"}>
              <div className="truncate text-sm font-semibold">{u.icon} {u.title}</div>
              <div className="text-xs" style={{ color: C.soft }}><span style={{ color: C.warn }}>{"★".repeat(u.stars)}</span><span style={{ color: "#4b4864" }}>{"★".repeat(3 - u.stars)}</span> {u.mastered}/{u.words} mastered</div>
            </div>))}</div>
        </div>)}</div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[16px] border p-4" style={card}>
          <h3 className="text-base font-extrabold">Words to work on</h3>
          <p className="mb-2 text-xs" style={{ color: C.soft }}>Missed most and not mastered yet. Good ones to practice together.</p>
          {d.trouble.length ? <ul className="flex flex-col gap-1">{d.trouble.map((w) => <li key={w.w} className="flex items-center justify-between gap-2 text-sm"><span>{isPic(w.e) ? w.e : ""} <b>{w.w}</b> <span style={{ color: C.soft }}>({w.es})</span></span><span className="shrink-0 text-xs" style={{ color: C.soft }}>missed {w.wrong}, right {w.right}</span></li>)}</ul>
            : <p className="text-sm" style={{ color: C.soft }}>No trouble words yet.</p>}
        </section>
        <section className="rounded-[16px] border p-4" style={card}>
          <h3 className="text-base font-extrabold">Speaking</h3>
          <p className="mb-2 text-xs" style={{ color: C.soft }}>{d.speaking.tried ? `${d.speaking.right} of ${d.speaking.tried} words were understood.` : "No speaking tries yet."} Recordings are never saved, only what was heard.</p>
          <ul className="flex flex-col gap-1">{d.speaking.recent.map((r, k) => <li key={k} className="flex items-center justify-between gap-2 text-sm"><span><b>{r.word}</b> <span style={{ color: C.soft }}>heard “{r.heard || "nothing"}”</span></span><span className="shrink-0 text-xs font-bold" style={{ color: r.ok ? C.good : C.warn }}>{r.ok ? "Understood" : "Not yet"}</span></li>)}</ul>
        </section>
      </div>

      {(d.words.mastered.length > 0 || d.words.learning.length > 0) && <section className="rounded-[16px] border p-4" style={card}>
        <h3 className="mb-2 text-base font-extrabold">Words mastered ({d.words.mastered.length})</h3>
        <p className="text-sm leading-relaxed">{d.words.mastered.map((w) => w.w).join(", ") || "None yet."}</p>
        <h3 className="mb-2 mt-3 text-base font-extrabold">Still learning ({d.words.learning.length})</h3>
        <p className="text-sm leading-relaxed" style={{ color: "#d4d1e6" }}>{d.words.learning.map((w) => w.w).join(", ") || "None."}</p>
      </section>}

      <section className="rounded-[16px] border p-4" style={card}>
        <h3 className="mb-2 text-base font-extrabold">Recent lessons</h3>
        {d.sessions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm">
          <thead><tr className="text-xs" style={{ color: C.soft }}><th className="py-1.5 pr-3 font-bold">When</th><th className="py-1.5 pr-3 font-bold">Lesson</th><th className="py-1.5 pr-3 font-bold">Right first time</th><th className="py-1.5 pr-3 font-bold">Stars</th><th className="py-1.5 pr-3 font-bold">Minutes</th><th className="py-1.5 font-bold">Points</th></tr></thead>
          <tbody>{d.sessions.map((x, k) => <tr key={k} className="border-t" style={{ borderColor: C.line }}>
            <td className="py-1.5 pr-3" style={{ color: C.soft }}>{x.at ? new Date(x.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</td>
            <td className="py-1.5 pr-3 font-semibold">{x.unit}</td><td className="py-1.5 pr-3">{x.score}/{x.total}</td>
            <td className="py-1.5 pr-3" style={{ color: C.warn }}>{x.kind === "lesson" ? "★".repeat(x.stars) || "None" : "Review"}</td><td className="py-1.5 pr-3">{x.minutes}</td><td className="py-1.5">{x.points}</td>
          </tr>)}</tbody></table></div> : <p className="text-sm" style={{ color: C.soft }}>No lessons played yet.</p>}
      </section>

      <section className="rounded-[16px] border p-4" style={card}>
        <h3 className="mb-3 text-base font-extrabold">Settings</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> English Explorer is on</label>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" disabled={form.homeLanguage !== "es"} checked={form.helpOn && form.homeLanguage === "es"} onChange={(e) => setForm({ ...form, helpOn: e.target.checked })} /> Show Spanish help</label>
          <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: C.soft }}>Starts at
            <select value={form.startLevel} onChange={(e) => setForm({ ...form, startLevel: Number(e.target.value) })} className={field} style={fieldStyle}>{LEVELS.map((l) => <option key={l.n} value={l.n}>Level {l.n}: {l.title}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: C.soft }}>Home language
            <select value={form.homeLanguage} onChange={(e) => setForm({ ...form, homeLanguage: e.target.value })} className={field} style={fieldStyle}><option value="">Not set</option>{languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-xs font-bold sm:col-span-2" style={{ color: C.soft }}>Note for other teachers (optional)
            <input value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="For example: newcomer from Venezuela, started in October" className={field} style={fieldStyle} /></label>
        </div>
        <p className="mt-2 text-xs" style={{ color: C.soft }}>Starting at a higher level opens every lesson below it. Turning English Explorer off keeps the student's progress.</p>
        <button type="button" disabled={saving} onClick={() => void save()} className="mt-3 min-h-11 rounded-xl px-4 text-sm font-extrabold text-white disabled:opacity-60" style={{ background: C.accent }}>{saving ? "Saving…" : "Save settings"}</button>
      </section>
    </div>}
  </Overlay>;
}

/** Share right the first time for each skill: one hue, value at the bar's end. */
function SkillBars({ skills }: { skills: Detail["skills"] }) {
  const label: Record<string, string> = { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" };
  return <ul className="flex flex-col gap-2.5">{skills.map((k) => {
    const p = k.total30 ? Math.round((k.right30 / k.total30) * 100) : null;
    return <li key={k.skill} className="grid items-center gap-3" style={{ gridTemplateColumns: "84px minmax(0,1fr) 92px" }} title={p === null ? "No questions yet" : `${k.right30} of ${k.total30} right the first time`}>
      <span className="text-sm font-semibold">{label[k.skill]}</span>
      <span className="relative h-4" style={{ borderLeft: `1px solid ${C.line}` }}>{p !== null && <span className="absolute left-0 top-0 h-4 rounded-r-[4px]" style={{ width: `${Math.max(p, 2)}%`, background: C.bar }} />}</span>
      <span className="text-sm font-bold">{p === null ? <span style={{ color: C.soft }}>No data</span> : <>{p}% <span className="text-xs font-semibold" style={{ color: C.soft }}>of {k.total30}</span></>}</span>
    </li>;
  })}</ul>;
}

/** Minutes each day: thin columns from one baseline, the busiest day labeled, the rest on hover. */
function DayColumns({ days }: { days: Detail["days"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(5, ...days.map((x) => x.minutes));
  const top = days.reduce((m, x, i) => (x.minutes > days[m].minutes ? i : m), 0);
  const H = 96;
  const shown = hover ?? null;
  return <div>
    <div className="relative flex items-end gap-0.5" style={{ height: H + 18, borderBottom: `1px solid rgba(255,255,255,0.18)` }}>
      {days.map((x, i) => {
        const h = x.minutes ? Math.max(3, (x.minutes / max) * H) : 0;
        return <div key={x.day} className="relative flex h-full flex-1 cursor-default items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}
          aria-label={`${new Date(`${x.day}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}: ${x.minutes} minutes, ${x.sessions} lessons`}>
          {i === top && x.minutes > 0 && hover === null && <span className="absolute text-[11px] font-bold" style={{ bottom: h + 3, color: C.text }}>{x.minutes}</span>}
          <span className="block w-full max-w-[20px] rounded-t-[4px]" style={{ height: h, background: hover === i ? "#a78bfa" : C.bar }} />
        </div>;
      })}
      {shown !== null && <div className="pointer-events-none absolute -top-2 z-10 rounded-lg border px-2.5 py-1.5 text-xs shadow-lg" style={{ left: `clamp(0px, calc(${(shown / days.length) * 100}% - 40px), calc(100% - 150px))`, background: "#0b0a16", borderColor: C.line, color: C.text, width: 150 }}>
        <div className="font-bold">{new Date(`${days[shown].day}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</div>
        <div>{days[shown].minutes} min, {days[shown].sessions} {days[shown].sessions === 1 ? "lesson" : "lessons"}, {days[shown].points} pts</div>
      </div>}
    </div>
    <div className="mt-1 flex justify-between text-[11px]" style={{ color: C.soft }}><span>{new Date(`${days[0].day}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}</span><span>Today</span></div>
  </div>;
}
