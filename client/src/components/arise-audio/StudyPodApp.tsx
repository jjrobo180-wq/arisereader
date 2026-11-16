// Study Podster, a Premium plugin of its own in To Duo (it was a page inside Podster until Nov 15, 2026).
// Notes in (typed, a PDF, photos of a page, or a recorded class) and an episode out that two AI hosts talk
// through, with a summary, key points and a quiz. Meeting Pod does the same for a meeting, and its action
// items go straight into To Duo as tasks. Drawn with To Duo's own cards; the AI and voices are Podster's
// (podscroll/Studio.tsx), and what's made stays on this device, the same list as in Podster.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookOpen, Briefcase, Camera, Check, ChevronDown, ChevronLeft, Copy, FileText, GraduationCap, ListPlus, Loader2, Mic, Pause, Play, Share2, Sparkles, Square, Trash2, Upload } from "lucide-react";
import { superAppOf } from "@shared/superApps";
import { HOSTS, asText, load, save, shrinkPhoto, toBase64, usePodPlayer, useRecorder, type Made } from "../../../../podscroll/Studio";
import { Empty, danger, inputClass, plain, primary, soft } from "@/components/family-hub/ui";
import { PageStrip, SuperHead } from "@/components/super-apps/SuperShell";
import { usePodApi } from "./podApi";

type Kind = "study" | "meeting";
const COPY: Record<Kind, { name: string; help: string; placeholder: string; go: string; busy: string }> = {
  study: {
    name: "Study Pod", help: "Paste your class notes, add a PDF or photos of your notes, or record a class. AI writes a short episode that explains it, then gives you the key points and a quick quiz.",
    placeholder: "Paste your notes here…\n\nExample: Photosynthesis happens in the chloroplasts. Light reactions make ATP and NADPH…", go: "Make my Study Pod", busy: "Writing your episode…",
  },
  meeting: {
    name: "Meeting Pod", help: "Paste your meeting notes (rough is fine), add a PDF or photos, or record the meeting. AI pulls out the summary, the decisions, who's doing what by when and what's still open, with a one-minute recap to listen to.",
    placeholder: "Paste your meeting notes here…\n\nExample: Budget review with Sam and Priya. Agreed to move launch to May 12. Sam to send revised numbers by Friday…", go: "Summarize my meeting", busy: "Reading your notes…",
  },
};
const when = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 shadow-[0_8px_28px_#17152b08] sm:p-5">
    {title && <h3 className="mb-3 text-lg font-bold text-[#232139]">{title}</h3>}{children}
  </section>;
}

function Seg<T extends string>({ label, value, set, options }: { label: string; value: T; set: (v: T) => void; options: [T, string][] }) {
  return <div><p className="mb-1.5 text-xs font-bold text-slate-500">{label}</p>
    <div className="inline-flex w-full rounded-xl bg-slate-100 p-1">{options.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => set(v)}
      className={`min-h-9 flex-1 rounded-lg px-2 text-sm font-bold ${value === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{l}</button>)}</div></div>;
}

function Quiz({ n, q, a }: { n: number; q: string; a: string }) {
  const [show, setShow] = useState(false);
  return <li className="rounded-2xl bg-slate-50 p-3">
    <p className="text-sm font-bold text-slate-800">{n}. {q}</p>
    {show ? <p className="mt-1.5 text-sm text-slate-600">{a}</p> : <button type="button" onClick={() => setShow(true)} className="mt-1.5 text-sm font-bold text-violet-700">Show the answer</button>}
  </li>;
}

export default function StudyPodApp({ say, start, onAddTask }: { say: (m: string) => void; start?: string | null; onAddTask: (title: string, notes: string) => void }) {
  const app = superAppOf("studypod")!;
  const { api, base } = usePodApi();
  const [page, setPage] = useState<string>(start && app.pages.some((p) => p.id === start) ? start : "study");
  const kind: Kind = page === "meeting" ? "meeting" : "study";
  const c = COPY[kind];
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [length, setLength] = useState<"quick" | "full">("quick");
  const [style, setStyle] = useState<"duo" | "solo">("duo");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [reading, setReading] = useState("");
  const [all, setAll] = useState<Made[]>(load);
  const [openId, setOpenId] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const photo = useRef<HTMLInputElement>(null);
  const player = usePodPlayer(api, base);
  const addNotes = (t: string) => setNotes((n) => (n.trim() ? `${n.trim()}\n\n${t.trim()}` : t.trim()).slice(0, 20000));
  const recorder = useRecorder(api, addNotes);
  const open = useMemo(() => all.find((m) => m.id === openId) ?? null, [all, openId]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [openId]);

  const readFiles = async (list: FileList | null) => {
    const files = Array.from(list || []).slice(0, 10);
    if (!files.length || reading) return;
    setErr("");
    const photos = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(f.name));
    try {
      for (const f of files) {
        if (photos.includes(f)) {
          setReading(photos.length > 1 ? `Reading photo ${photos.indexOf(f) + 1} of ${photos.length}…` : "Reading your photo…");
          addNotes((await api("/api/earshot/studio/read", { method: "POST", body: { kind: "image", image: await shrinkPhoto(f) } })).text);
        } else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
          if (f.size > 10e6) throw new Error("That PDF is too big (10 MB at most). Try a smaller one, or photos of the pages you need.");
          setReading("Reading your PDF…");
          addNotes((await api("/api/earshot/studio/read", { method: "POST", body: { kind: "pdf", data: await toBase64(f) } })).text);
        } else {
          if (f.size > 2e6 || (!/^text\/|json|csv|markdown/.test(f.type || "text/") && !/\.(txt|md|markdown|csv|text|rtf)$/i.test(f.name))) throw new Error("Pick a PDF, a photo, or a text file (.txt or .md). Word files: save as PDF first.");
          addNotes((await f.text()).replace(/\{\\[^}]*\}|\\[a-z]+\d* ?/g, " "));
        }
        if (!title && files.length === 1) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 80));
      }
    } catch (e: any) { setErr(e?.message || "That couldn't be read. Try again."); }
    finally { setReading(""); }
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
  const remove = (id: string) => { if (player.state?.id === id) player.stop(); const next = all.filter((m) => m.id !== id); setAll(next); save(next); setOpenId(null); };
  const share = async (m: Made) => {
    const text = asText(m);
    try { if (navigator.share) { await navigator.share({ title: m.title, text }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(text); say("Copied."); } catch { say("Couldn't copy on this device."); }
  };

  const strip = <PageStrip app={app} pages={app.pages.map((p) => p.id)} current={open ? (open.kind === "meeting" ? "meeting" : "made") : page} onPick={(id) => { setOpenId(null); setPage(id); setErr(""); }} badges={{ made: all.length }} />;

  if (open) {
    const st = player.state?.id === open.id ? player.state.status : null;
    return <div data-testid="super-app-studypod">
      <SuperHead app={app} />{strip}
      <button type="button" onClick={() => setOpenId(null)} className="-ml-2 mb-3 inline-flex min-h-10 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-bold text-slate-600 hover:bg-slate-100"><ChevronLeft size={18} />Back</button>
      <div className="space-y-4" data-testid="studypod-result">
        <Card>
          <p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-violet-600">{open.kind === "study" ? "Study Pod" : "Meeting Pod"} · {when(open.at)}</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[#232139] sm:text-3xl">{open.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{open.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void player.play(open, say)} className={`${primary} min-h-11 px-5`} data-testid="studypod-play">
              {st === "loading" ? <Loader2 size={17} className="animate-spin" /> : st === "playing" ? <Pause size={17} /> : <Play size={17} />}
              {st === "loading" ? "Making the audio…" : st === "playing" ? "Pause" : st === "paused" ? "Resume" : open.kind === "study" ? "Listen" : "Listen to the recap"}
            </button>
            <button type="button" onClick={() => void share(open)} className={plain}><Share2 size={16} />Share</button>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(asText(open)).then(() => say("Copied."), () => say("Couldn't copy on this device."))} className={plain}><Copy size={16} />Copy</button>
          </div>
          {st && st !== "loading" && player.pos.d > 0 && <input type="range" min={0} max={player.pos.d} step={1} value={player.pos.t} onChange={(e) => player.seek(Number(e.target.value))} aria-label="Position" className="mt-4 w-full accent-[#6e5ae0]" />}
          <p className="mt-3 text-xs text-slate-400">Made by AI from your notes. Check anything important against them.</p>
        </Card>
        {open.kind === "study" ? <>
          {open.keyPoints.length > 0 && <Card title="Key points"><ul className="space-y-2">{open.keyPoints.map((k, i) => <li key={i} className="flex gap-2.5 text-sm text-slate-700"><Check size={17} className="mt-0.5 shrink-0 text-violet-600" />{k}</li>)}</ul></Card>}
          {open.quiz.length > 0 && <Card title="Quiz yourself"><ol className="space-y-2">{open.quiz.map((x, i) => <Quiz key={i} n={i + 1} q={x.q} a={x.a} />)}</ol></Card>}
        </> : <>
          {open.actions.length > 0 && <Card title="Action items"><ul className="space-y-2">{open.actions.map((a, i) => <li key={i} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-800">{a.task}</span>{(a.owner || a.due) && <span className="block text-xs text-slate-500">{[a.owner, a.due].filter(Boolean).join(" · ")}</span>}</span>
            <button type="button" onClick={() => onAddTask(a.task, [open.title, a.owner && `Owner: ${a.owner}`, a.due && `Due: ${a.due}`].filter(Boolean).join("\n"))} className={soft} data-testid="studypod-add-task"><ListPlus size={16} />Add to tasks</button>
          </li>)}</ul></Card>}
          {open.decisions.length > 0 && <Card title="Decisions"><ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">{open.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul></Card>}
          {open.questions.length > 0 && <Card title="Still open"><ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">{open.questions.map((d, i) => <li key={i}>{d}</li>)}</ul></Card>}
        </>}
        <details className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 sm:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-bold text-[#232139]">{open.kind === "study" ? "Read the episode" : "Read the recap"}<ChevronDown size={18} className="text-slate-400" /></summary>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">{open.lines.map((l, i) => <p key={i}>{!open.solo && <b className="mr-1.5 text-slate-900">{HOSTS[l.speaker]}:</b>}{l.text}</p>)}</div>
        </details>
        <button type="button" onClick={() => remove(open.id)} className={danger}><Trash2 size={16} />Delete</button>
      </div>
    </div>;
  }

  if (page === "made") return <div data-testid="super-app-studypod">
    <SuperHead app={app} />{strip}
    {all.length ? <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{all.map((m) => <button key={m.id} type="button" onClick={() => setOpenId(m.id)}
      className="flex min-w-0 items-center gap-3 rounded-[1.25rem] border border-[#e7e8f0] bg-white p-3 text-left hover:border-violet-200">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${m.kind === "study" ? "bg-violet-50 text-violet-700" : "bg-teal-50 text-teal-700"}`}>{m.kind === "study" ? <BookOpen size={20} /> : <FileText size={20} />}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#232139]">{m.title}</span><span className="block truncate text-xs text-slate-500">{when(m.at)} · {m.summary}</span></span>
    </button>)}</div> : <Empty icon={<GraduationCap size={26} />} title="Nothing made yet">Your Study Pods and Meeting Pods show up here.</Empty>}
  </div>;

  return <div data-testid="super-app-studypod">
    <SuperHead app={app} />{strip}
    <Card>
      <div className="mb-3 flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${kind === "study" ? "bg-violet-50 text-violet-700" : "bg-teal-50 text-teal-700"}`}>{kind === "study" ? <GraduationCap size={22} /> : <Briefcase size={22} />}</span>
        <p className="text-sm leading-6 text-slate-600">{c.help}</p>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} aria-label="Title" placeholder={kind === "study" ? "Title (optional), e.g. Biology chapter 4" : "Meeting name (optional)"} className={inputClass} />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 20000))} rows={9} aria-label="Notes" placeholder={c.placeholder} data-testid="studypod-notes"
        className="mt-2 block w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => file.current?.click()} disabled={!!reading} className={plain}><Upload size={16} />PDF or file</button>
          <button type="button" onClick={() => photo.current?.click()} disabled={!!reading} className={plain}><Camera size={16} />Photos</button>
          {recorder.state === "off"
            ? <button type="button" onClick={() => void recorder.start()} className={plain}><Mic size={16} />{kind === "study" ? "Record a class" : "Record the meeting"}</button>
            : <button type="button" onClick={recorder.stop} disabled={recorder.state !== "recording"} className={danger}><Square size={14} fill="currentColor" />Stop · {Math.floor(recorder.secs / 60)}:{String(recorder.secs % 60).padStart(2, "0")}</button>}
        </div>
        <span className="text-xs font-semibold text-slate-400">{notes.length.toLocaleString()} / 20,000</span>
        <input ref={file} type="file" multiple accept=".pdf,application/pdf,.txt,.md,.markdown,.csv,.rtf,text/*,image/*" className="hidden" onChange={(e) => { void readFiles(e.target.files); e.target.value = ""; }} />
        <input ref={photo} type="file" multiple accept="image/*" className="hidden" onChange={(e) => { void readFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {reading && <p role="status" className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600"><Loader2 size={14} className="animate-spin" />{reading}</p>}
      {recorder.state === "recording" && <p role="status" className="mt-2 flex items-center gap-2 text-sm text-slate-600"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />Recording. Keep To Duo open; it's written down as you go.</p>}
      {recorder.note && recorder.state !== "recording" && <p role="status" className="mt-2 text-sm text-slate-600">{recorder.note}</p>}
      {kind === "study" && <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Seg label="Length" value={length} set={setLength} options={[["quick", "Quick · ~3 min"], ["full", "Full · ~6 min"]]} />
        <Seg label="Hosts" value={style} set={setStyle} options={[["duo", "Two hosts"], ["solo", "One teacher"]]} />
      </div>}
      {err && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{err}</p>}
      <button type="button" onClick={() => void make()} disabled={busy} className={`${primary} mt-4 min-h-12 w-full`} data-testid="studypod-make">
        {busy ? <><Loader2 size={17} className="animate-spin" />{c.busy}</> : <><Sparkles size={17} />{c.go}</>}
      </button>
      <p className="mt-2 text-center text-xs text-slate-400">Your notes go to the AI to write this and aren't posted anywhere. What's made stays on this device.</p>
    </Card>
  </div>;
}
