// Pod+ Studio: Study Pod+ (study notes → a podcast episode with key points and a quiz) and Meeting Pod
// (meeting notes → summary, decisions, action items, open questions and a spoken recap).
// The words are written by AI on the server (server/podcastStudio.ts); what's made is kept on this
// device only. Listening uses AI voices only (Orpheus, then Aura); never the phone's robot voice.
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Briefcase, Check, ChevronDown, ChevronLeft, Copy, FileText, GraduationCap, Loader2, Pause, Play, Share2, Sparkles, Trash2, Upload } from "lucide-react";
import { onOtherSound, soundStarted } from "../client/src/components/family-hub/earshot/soundBus";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
type Line = { speaker: "A" | "B"; text: string };
export type StudioKind = "study" | "meeting";
type Study = { kind: "study"; title: string; summary: string; keyPoints: string[]; lines: Line[]; quiz: { q: string; a: string }[] };
type Meeting = { kind: "meeting"; title: string; summary: string; decisions: string[]; actions: { task: string; owner: string; due: string }[]; questions: string[]; lines: Line[] };
type Made = (Study | Meeting) & { id: string; at: number; solo: boolean };

const KEY = "podplus.studio";
const HOSTS = { A: "Maya", B: "Leo" };
const load = (): Made[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => x && x.id && Array.isArray(x.lines)) : []; } catch { return []; } };
const save = (list: Made[]) => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40))); } catch { /* full or private */ } };
const when = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const COPY = {
  study: {
    name: "Study Pod+", icon: GraduationCap, color: "#6d28d9",
    tag: "Turn your study notes into a podcast you can listen to.",
    help: "Paste your class notes, a study guide or a chapter summary. AI writes a short episode that explains it, then gives you the key points and a quick quiz.",
    placeholder: "Paste your notes here…\n\nExample: Photosynthesis happens in the chloroplasts. Light reactions make ATP and NADPH…",
    go: "Make my Study Pod", saved: "Your Study Pods",
  },
  meeting: {
    name: "Meeting Pod", icon: Briefcase, color: "#0f766e",
    tag: "Meeting notes in, the summary and to-dos out.",
    help: "Paste your meeting notes (rough is fine). AI pulls out the summary, decisions, who's doing what by when, and what's still open, plus a one-minute recap to listen to.",
    placeholder: "Paste your meeting notes here…\n\nExample: Budget review w/ Sam & Priya. Agreed to move launch to May 12. Sam to send revised numbers by Fri…",
    go: "Summarize my meeting", saved: "Your Meeting Pods",
  },
} as const;

/** The pod as plain text, for copying or sharing. */
function asText(m: Made): string {
  if (m.kind === "study") return [m.title, "", m.summary, "", "Key points:", ...m.keyPoints.map((k) => `• ${k}`), "", "Quiz:", ...m.quiz.map((x, i) => `${i + 1}. ${x.q}\n   ${x.a}`)].join("\n");
  return [m.title, "", m.summary, ...(m.decisions.length ? ["", "Decisions:", ...m.decisions.map((d) => `• ${d}`)] : []),
    ...(m.actions.length ? ["", "Action items:", ...m.actions.map((a) => `• ${a.task}${a.owner ? ` (${a.owner}` : ""}${a.owner && a.due ? `, ${a.due})` : a.owner ? ")" : a.due ? ` (${a.due})` : ""}`)] : []),
    ...(m.questions.length ? ["", "Open questions:", ...m.questions.map((q) => `• ${q}`)] : [])].join("\n");
}

/** A tenth of a second of silence. Played straight from the tap so iPhone lets the same player
 *  start the real audio a few seconds later, once it has been made. */
let silence = "";
function silentClip(): string {
  if (silence) return silence;
  const n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
  silence = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return silence;
}

/** Plays a pod in AI voices. The server makes the sound one line at a time; playing starts as soon
 *  as the first line is ready and carries on line by line while the rest is made. If the next line
 *  isn't ready yet it just waits for it (a busy voice service is a short pause, never an error). */
type VoiceStatus = { id: string; whole?: boolean; parts: number; made: boolean[]; secs: number[]; done: boolean; failed?: boolean };
function usePodPlayer(api: Api, apiBase: string) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<{ id: string; status: "loading" | "playing" | "paused" } | null>(null);
  const [pos, setPos] = useState({ t: 0, d: 0 });
  const speaking = useRef(false);
  const run = useRef(0); // which play this is; an older one stops when a newer one starts
  const cur = useRef<{ m: Made; st: VoiceStatus; n: number } | null>(null);
  const stop = () => {
    run.current++;
    cur.current = null;
    audio.current?.pause();
    setState(null);
  };
  useEffect(() => onOtherSound("studio", () => { audio.current?.pause(); }), []);
  useEffect(() => () => { run.current++; audio.current?.pause(); }, []);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const ask = async (m: Made): Promise<VoiceStatus> => {
    for (let tries = 0; ; tries++) {
      try { return await api("/api/earshot/studio/voice", { method: "POST", body: { lines: m.lines, solo: m.solo } }); }
      catch (e: any) { if (tries >= 2 || /set up|a lot in the last hour/i.test(String(e?.message))) throw e; await sleep(2000); }
    }
  };
  const before = (st: VoiceStatus, n: number) => st.secs.slice(0, n).reduce((a, b) => a + b, 0);
  const total = (st: VoiceStatus) => st.secs.reduce((a, b) => a + b, 0);

  /** Plays line `n` (and the ones after it), waiting for each to be made. */
  const playFrom = async (mine: number, m: Made, n: number, at = 0) => {
    let st = cur.current!.st;
    while (!st.made[n]) {
      if (run.current !== mine) return;
      if (st.failed) throw new Error("Couldn't reach the voices. Tap Listen to try again.");
      setState({ id: m.id, status: "loading" });
      await sleep(1500);
      if (run.current !== mine) return;
      st = await ask(m);
      if (cur.current) cur.current.st = st;
    }
    if (run.current !== mine || !cur.current) return;
    cur.current.n = n;
    const a = audio.current!;
    a.onended = () => {
      if (run.current !== mine || !cur.current) return;
      const next = cur.current.n + 1;
      if (next >= cur.current.st.parts) { cur.current = null; setState(null); setPos({ t: 0, d: 0 }); return; }
      void playFrom(mine, m, next).catch((e: any) => { if (run.current === mine) { setState(null); sayRef.current(e?.message || "Couldn't reach the voices. Tap Listen to try again."); } });
    };
    a.ontimeupdate = () => { const c = cur.current; if (c && run.current === mine) setPos({ t: before(c.st, c.n) + a.currentTime, d: Math.max(total(c.st), before(c.st, c.n) + (Number.isFinite(a.duration) ? a.duration : 0)) }); };
    a.src = `${apiBase}/api/podscroll/studio/audio/${st.id}/${n}`;
    if (at > 0) a.addEventListener("loadedmetadata", () => { try { a.currentTime = at; } catch { /* starts at the top */ } }, { once: true });
    await a.play();
    // Keep the made-so-far list fresh while this line plays, so the position bar and the next line are ready.
    if (!st.done) void ask(m).then((s) => { if (run.current === mine && cur.current) cur.current.st = s; }).catch(() => {});
  };
  const sayRef = useRef<(s: string) => void>(() => {});

  const play = async (m: Made, say: (s: string) => void) => {
    sayRef.current = say;
    if (state?.id === m.id && audio.current && !speaking.current) {
      if (state.status === "playing") { audio.current.pause(); return; }
      if (state.status === "paused") { void audio.current.play(); return; }
    }
    stop();
    const mine = run.current;
    setState({ id: m.id, status: "loading" });
    if (!audio.current) audio.current = new Audio();
    try { audio.current.onpause = null; audio.current.onplaying = null; audio.current.onended = null; audio.current.ontimeupdate = null; audio.current.src = silentClip(); void audio.current.play().catch(() => {}); } catch { /* no audio here */ }
    try {
      const st = await ask(m);
      if (run.current !== mine) return;
      const a = audio.current!;
      a.onplaying = () => { if (run.current === mine) { setState({ id: m.id, status: "playing" }); soundStarted("studio"); } };
      a.onpause = () => setState((s) => (s && s.id === m.id && s.status === "playing" && !a.ended ? { ...s, status: "paused" } : s));
      if (st.whole) {
        a.onended = () => { if (run.current === mine) setState(null); };
        a.ontimeupdate = () => setPos({ t: a.currentTime, d: Number.isFinite(a.duration) ? a.duration : 0 });
        a.src = `${apiBase}/api/podscroll/studio/audio/${st.id}`;
        await a.play();
        return;
      }
      cur.current = { m, st, n: 0 };
      await playFrom(mine, m, 0);
    } catch (e: any) {
      // AI voices only: no robot-voice fallback.
      if (run.current !== mine) return;
      setState(null); say(e?.message || "Couldn't reach the voices. Tap Listen to try again.");
    }
  };
  const seek = (t: number) => {
    const a = audio.current, c = cur.current;
    if (!a) return;
    if (!c) { a.currentTime = t; return; }
    // Find the line that time falls in; if it isn't made yet, go to the last one that is.
    let n = 0;
    while (n < c.st.parts - 1 && before(c.st, n + 1) <= t) n++;
    while (n > 0 && !c.st.made[n]) n--;
    const at = Math.max(0, t - before(c.st, n));
    if (n === c.n) { a.currentTime = at; return; }
    const mine = run.current;
    void playFrom(mine, c.m, n, at).catch(() => {});
  };
  return { state, pos, play, stop, seek };
}

export function StudioView({ kind, api, apiBase, say, onBack, onSwitch }: { kind: StudioKind; api: Api; apiBase: string; say: (m: string) => void; onBack: () => void; onSwitch: (k: StudioKind) => void }) {
  const c = COPY[kind];
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [length, setLength] = useState<"quick" | "full">("quick");
  const [style, setStyle] = useState<"duo" | "solo">("duo");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [all, setAll] = useState<Made[]>(load);
  const [openId, setOpenId] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const player = usePodPlayer(api, apiBase);
  const mine = useMemo(() => all.filter((m) => m.kind === kind), [all, kind]);
  const open = mine.find((m) => m.id === openId) || null;
  useEffect(() => { setOpenId(null); setErr(""); }, [kind]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [openId]);

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2e6 || !/^text\/|json|csv|markdown/.test(f.type || "text/") && !/\.(txt|md|markdown|csv|text|rtf)$/i.test(f.name)) { say("Pick a text file (.txt or .md), or paste the notes."); return; }
    const t = (await f.text()).replace(/\{\\[^}]*\}|\\[a-z]+\d* ?/g, " ");
    setNotes((n) => (n.trim() ? `${n.trim()}\n\n${t.trim()}` : t.trim()).slice(0, 20000));
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 80));
  };

  const make = async () => {
    setErr("");
    if (notes.trim().length < 40) { setErr(kind === "study" ? "Add a few more lines of notes first." : "Add the meeting notes first (a few lines at least)."); return; }
    setBusy(true);
    try {
      const r = await api(`/api/earshot/studio/${kind}`, { method: "POST", body: { notes, title, length, style } });
      const made: Made = kind === "study"
        ? { kind, id: `s${Date.now()}`, at: Date.now(), solo: style === "solo", title: r.title, summary: r.summary, keyPoints: r.keyPoints || [], lines: r.lines || [], quiz: r.quiz || [] }
        : { kind, id: `m${Date.now()}`, at: Date.now(), solo: true, title: r.title, summary: r.summary, decisions: r.decisions || [], actions: r.actions || [], questions: r.questions || [], lines: r.lines || [] };
      const next = [made, ...all];
      setAll(next); save(next); setOpenId(made.id); setNotes(""); setTitle("");
    } catch (e: any) { setErr(e?.message || "Something went wrong. Try again."); }
    finally { setBusy(false); }
  };
  const remove = (id: string) => { if (player.state?.id === id) player.stop(); const next = all.filter((m) => m.id !== id); setAll(next); save(next); if (openId === id) setOpenId(null); };
  const share = async (m: Made) => {
    const text = asText(m);
    try { if (navigator.share) { await navigator.share({ title: m.title, text }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(text); say("Copied."); } catch { say("Couldn't copy on this device."); }
  };

  const Icon = c.icon;
  const tabs = <div className="mb-5 inline-flex rounded-full bg-[#f2f2f2] p-1" role="tablist" aria-label="Studio">
    {(["study", "meeting"] as const).map((k) => <button key={k} role="tab" aria-selected={kind === k} onClick={() => onSwitch(k)} data-testid={`studio-switch-${k}`}
      className={`h-9 rounded-full px-4 text-sm font-semibold ${kind === k ? "bg-[#0f0f0f] text-white" : "text-[#0f0f0f]"}`}>{COPY[k].name}</button>)}
  </div>;

  if (open) {
    const st = player.state?.id === open.id ? player.state.status : null;
    return <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 sm:px-6" data-testid="studio-result">
      <button onClick={() => setOpenId(null)} className="mb-3 inline-flex h-9 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-medium hover:bg-[#f2f2f2]"><ChevronLeft size={18} />{c.name}</button>
      <div className="overflow-hidden rounded-3xl text-white" style={{ background: `linear-gradient(140deg, ${c.color}, #0f0f0f)` }}>
        <div className="p-5 sm:p-6">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-white/70"><Icon size={14} />{c.name} · {when(open.at)}</p>
          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{open.title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-white/85">{open.summary}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button onClick={() => void player.play(open, say)} data-testid="studio-play" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-[#0f0f0f]">
              {st === "loading" ? <Loader2 size={18} className="animate-spin" /> : st === "playing" ? <Pause size={18} /> : <Play size={18} />}
              {st === "loading" ? "Making the audio…" : st === "playing" ? "Pause" : st === "paused" ? "Resume" : kind === "study" ? "Listen" : "Listen to the recap"}
            </button>
            <button onClick={() => void share(open)} className="inline-flex h-12 items-center gap-2 rounded-full bg-white/15 px-5 text-sm font-semibold"><Share2 size={17} />Share</button>
          </div>
          {st && st !== "loading" && player.pos.d > 0 && <input type="range" min={0} max={player.pos.d} step={1} value={player.pos.t} onChange={(e) => player.seek(Number(e.target.value))} aria-label="Position" className="mt-4 w-full accent-white" />}
          {st === "loading" && <p className="mt-3 text-xs text-white/70">Starts in a few seconds.</p>}
        </div>
      </div>
      <p className="mt-2 text-xs text-[#606060]">Made by AI from your notes. Check anything important against them.</p>

      {open.kind === "study" ? <>
        {open.keyPoints.length > 0 && <Section title="Key points"><ul className="space-y-2">{open.keyPoints.map((k, i) => <li key={i} className="flex gap-2.5"><Check size={18} className="mt-0.5 shrink-0" style={{ color: c.color }} /><span>{k}</span></li>)}</ul></Section>}
        {open.quiz.length > 0 && <Section title="Quiz yourself">{open.quiz.map((x, i) => <QuizItem key={i} n={i + 1} q={x.q} a={x.a} />)}</Section>}
      </> : <>
        {open.actions.length > 0 && <Section title="Action items"><ul className="space-y-2">{open.actions.map((a, i) => <ActionItem key={i} task={a.task} owner={a.owner} due={a.due} />)}</ul></Section>}
        {open.decisions.length > 0 && <Section title="Decisions"><ul className="list-disc space-y-1.5 pl-5">{open.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul></Section>}
        {open.questions.length > 0 && <Section title="Still open"><ul className="list-disc space-y-1.5 pl-5">{open.questions.map((d, i) => <li key={i}>{d}</li>)}</ul></Section>}
      </>}
      <details className="mt-6 rounded-2xl bg-[#f2f2f2] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-semibold">{kind === "study" ? "Read the episode" : "Read the recap"}<ChevronDown size={18} /></summary>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
          {open.lines.map((l, i) => <p key={i}>{!open.solo && <b className="mr-1.5">{HOSTS[l.speaker]}:</b>}{l.text}</p>)}
        </div>
      </details>
      <div className="mt-6 flex flex-wrap gap-2">
        <button onClick={() => void navigator.clipboard?.writeText(asText(open)).then(() => say("Copied."), () => say("Couldn't copy on this device."))} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#f2f2f2] px-4 text-sm font-semibold"><Copy size={16} />Copy text</button>
        <button onClick={() => remove(open.id)} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-[#cc0000] hover:bg-[#fff0f0]"><Trash2 size={16} />Delete</button>
      </div>
    </div>;
  }

  return <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 sm:px-6" data-testid={`studio-${kind}`}>
    <button onClick={onBack} className="mb-3 inline-flex h-9 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-medium hover:bg-[#f2f2f2]"><ChevronLeft size={18} />Home</button>
    {tabs}
    <div className="flex items-start gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: c.color }}><Icon size={24} /></span>
      <div><h1 className="text-2xl font-bold tracking-tight">{c.name}</h1><p className="text-[15px] text-[#606060]">{c.tag}</p></div>
    </div>
    <p className="mt-4 text-sm leading-relaxed text-[#3f3f3f]">{c.help}</p>

    <div className="mt-4 rounded-2xl border border-[#e5e5e5] bg-white p-3 sm:p-4">
      <label className="sr-only" htmlFor="studio-title">Title</label>
      <input id="studio-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={kind === "study" ? "Title (optional), e.g. Biology chapter 4" : "Meeting name (optional)"} className="h-11 w-full rounded-xl bg-[#f6f6f6] px-3 text-[15px] outline-none focus:ring-2 focus:ring-[#0f0f0f]/20" />
      <label className="sr-only" htmlFor="studio-notes">Notes</label>
      <textarea id="studio-notes" data-testid="studio-notes" value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 20000))} rows={9} placeholder={c.placeholder}
        className="mt-2 w-full resize-y rounded-xl bg-[#f6f6f6] p-3 text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-[#0f0f0f]/20" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => file.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#f2f2f2] px-4 text-sm font-semibold"><Upload size={16} />Add a text file</button>
        <input ref={file} type="file" accept=".txt,.md,.markdown,.csv,.rtf,text/*" className="hidden" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ""; }} />
        <span className="text-xs text-[#606060]">{notes.length.toLocaleString()} / 20,000</span>
      </div>
      {kind === "study" && <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Choice label="Length" value={length} set={setLength} options={[["quick", "Quick · ~3 min"], ["full", "Full · ~6 min"]]} />
        <Choice label="Hosts" value={style} set={setStyle} options={[["duo", "Two hosts"], ["solo", "One teacher"]]} />
      </div>}
      {err && <p role="alert" className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-sm text-[#cc0000]">{err}</p>}
      <button onClick={() => void make()} disabled={busy} data-testid="studio-make" className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white disabled:opacity-70" style={{ background: c.color }}>
        {busy ? <><Loader2 size={18} className="animate-spin" />{kind === "study" ? "Writing your episode…" : "Reading your notes…"}</> : <><Sparkles size={18} />{c.go}</>}
      </button>
      <p className="mt-2 text-center text-xs text-[#606060]">Your notes go to the AI to write this and aren't posted anywhere. What's made stays on this device.</p>
    </div>

    <h2 className="mb-3 mt-8 text-lg font-bold">{c.saved}</h2>
    {mine.length ? <ul className="space-y-2">{mine.map((m) => <li key={m.id}>
      <button onClick={() => setOpenId(m.id)} className="flex w-full items-center gap-3 rounded-2xl border border-[#e5e5e5] bg-white p-3 text-left hover:bg-[#f9f9f9]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: c.color }}>{kind === "study" ? <BookOpen size={20} /> : <FileText size={20} />}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{m.title}</span><span className="block truncate text-xs text-[#606060]">{when(m.at)} · {m.summary}</span></span>
      </button>
    </li>)}</ul> : <p className="text-sm text-[#606060]">{kind === "study" ? "Your episodes show up here." : "Your meeting summaries show up here."}</p>}
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6"><h2 className="mb-3 text-lg font-bold">{title}</h2><div className="text-[15px] leading-relaxed">{children}</div></section>;
}
function QuizItem({ n, q, a }: { n: number; q: string; a: string }) {
  const [show, setShow] = useState(false);
  return <div className="mb-2 rounded-2xl border border-[#e5e5e5] p-3">
    <p className="font-semibold">{n}. {q}</p>
    {show ? <p className="mt-2 text-[#3f3f3f]">{a}</p> : <button onClick={() => setShow(true)} className="mt-2 h-9 rounded-full bg-[#f2f2f2] px-4 text-sm font-semibold">Show answer</button>}
  </div>;
}
function ActionItem({ task, owner, due }: { task: string; owner: string; due: string }) {
  const [done, setDone] = useState(false);
  return <li><label className="flex cursor-pointer gap-3 rounded-2xl border border-[#e5e5e5] p-3">
    <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#0f766e]" />
    <span className={done ? "text-[#909090] line-through" : ""}><span className="block">{task}</span>{(owner || due) && <span className="mt-0.5 block text-xs text-[#606060]">{[owner, due].filter(Boolean).join(" · ")}</span>}</span>
  </label></li>;
}
function Choice<T extends string>({ label, value, set, options }: { label: string; value: T; set: (v: T) => void; options: [T, string][] }) {
  return <div role="radiogroup" aria-label={label} className="flex rounded-full bg-[#f2f2f2] p-1">
    {options.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => set(v)} className={`h-9 flex-1 rounded-full text-sm font-semibold ${value === v ? "bg-white shadow-sm" : "text-[#606060]"}`}>{l}</button>)}
  </div>;
}
