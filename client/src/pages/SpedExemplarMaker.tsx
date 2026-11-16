// SPED Exemplar Maker (a view inside Math Lessons). A teacher pastes one lesson (or adds photos of it) and gets
// two separate documents: the teacher EXEMPLAR and a PRACTICE PACK. The rules the documents follow are in
// shared/spedExemplar.ts (SPED_REQUIREMENTS); the server builds and checks them (server/spedExemplar.ts).
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { SPED_LIMITS, SPED_REQUIREMENTS, exemplarHtml, practiceHtml, type SpedPack } from "@shared/spedExemplar";
import UploadPicker from "@/components/UploadPicker";
import type { UploadedFile } from "@shared/uploads";

type Mine = { id: string; title: string; status: string; createdAt: string };
type Job = { id: string; status: "working" | "done" | "failed"; stage: string; error?: string; pack?: SpedPack };
const JOB_KEY = "arise-sped-job";

/** The server's plain-English message out of an apiRequest error ("403: {"message":"..."}"). */
function messageOf(e: unknown): string {
  const raw = String((e as any)?.message || "");
  const json = raw.slice(raw.indexOf("{"));
  try { const m = JSON.parse(json)?.message; if (typeof m === "string" && m) return m; } catch { /* not JSON */ }
  return /Failed to fetch|NetworkError/i.test(raw) ? "Can’t reach the site right now. Check your connection and try again." : "Something went wrong. Try again in a moment.";
}

/** A photo shrunk to 1600 px, so a phone picture doesn't take minutes to upload. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img: HTMLImageElement = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("bad image")); i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

function Doc({ html, name, title }: { html: string; name: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const print = () => { const w = frame.current?.contentWindow; if (w) { w.focus(); w.print(); } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a"); a.href = url; a.download = `${name}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <section className="ml-card ml-mk-doc" aria-label={title}>
      <div className="ml-mk-docbar">
        <h3>{title}</h3>
        <div className="ml-mk-actions">
          <button type="button" className="ml-primary" onClick={print}>Print / Save as PDF</button>
          <button type="button" onClick={download}>Download</button>
        </div>
      </div>
      <iframe ref={frame} title={title} srcDoc={html} sandbox="allow-same-origin allow-modals" className="ml-mk-frame" />
    </section>
  );
}

export default function SpedExemplarMaker() {
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [text, setText] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [images, setImages] = useState<{ name: string; data: string }[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Mine[]>([]);
  const [ai, setAi] = useState(true);
  const [tab, setTab] = useState<"exemplar" | "practice">("exemplar");
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);

  const loadList = useCallback(async () => {
    try { const r = await (await apiRequest("GET", "/api/sped-exemplar")).json(); if (alive.current) { setMine(r.mine || []); setAi(r.ai !== false); } }
    catch (e) { if (alive.current) setError(messageOf(e)); }
  }, []);

  const poll = useCallback((id: string) => {
    window.clearTimeout(timer.current);
    const tick = async () => {
      try {
        const j: Job = await (await apiRequest("GET", `/api/sped-exemplar/${id}`)).json();
        if (!alive.current) return;
        setJob(j);
        if (j.status === "working") { timer.current = window.setTimeout(tick, 2500); return; }
        setBusy(false);
        try { localStorage.removeItem(JOB_KEY); } catch { /* fine */ }
        if (j.status === "failed") setError(j.error || "The build didn’t finish. Tap Build again.");
        else { setTab("exemplar"); void loadList(); }
      } catch (e) { if (alive.current) { setBusy(false); setError(messageOf(e)); } }
    };
    void tick();
  }, [loadList]);

  useEffect(() => {
    alive.current = true;
    void loadList();
    // A build that was running when the teacher left the page picks up where it was.
    try { const id = localStorage.getItem(JOB_KEY); if (id) { setBusy(true); poll(id); } } catch { /* fine */ }
    return () => { alive.current = false; window.clearTimeout(timer.current); };
  }, [loadList, poll]);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const room = SPED_LIMITS.images - images.length;
    const picked = [...files].slice(0, Math.max(0, room));
    try {
      const next = [] as { name: string; data: string }[];
      for (const f of picked) next.push({ name: f.name, data: await shrink(f) });
      setImages((cur) => [...cur, ...next].slice(0, SPED_LIMITS.images));
      if (files.length > room) setError(`Up to ${SPED_LIMITS.images} photos at a time.`);
    } catch { setError("One of those photos couldn’t be read. Try a JPG or PNG."); }
  };

  const build = async () => {
    setError(""); setJob(null);
    if (!images.length && !files.length && !links.trim() && text.trim().length < 20) { setError("Paste a link to the lesson, paste the lesson (at least a few lines), add a file, or add photos of it."); return; }
    setBusy(true);
    try {
      const { id } = await (await apiRequest("POST", "/api/sped-exemplar", { title, grade, text, links, files, images: images.map((i) => i.data) })).json();
      try { localStorage.setItem(JOB_KEY, id); } catch { /* fine */ }
      poll(id);
    } catch (e) { setBusy(false); setError(messageOf(e)); }
  };

  const open = async (id: string) => {
    setError(""); setBusy(true);
    try {
      const j: Job = await (await apiRequest("GET", `/api/sped-exemplar/${id}`)).json();
      setJob(j); setTab("exemplar");
      if (j.status === "working") poll(id); else setBusy(false);
      if (j.status === "failed") setError(j.error || "That build didn’t finish.");
    } catch (e) { setBusy(false); setError(messageOf(e)); }
  };
  const forget = async (id: string) => {
    try { await apiRequest("DELETE", `/api/sped-exemplar/${id}`); if (job?.id === id) setJob(null); await loadList(); } catch (e) { setError(messageOf(e)); }
  };

  const pack = job?.status === "done" ? job.pack : undefined;
  const safe = (pack?.title || "lesson").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50) || "lesson";

  return (
    <div className="ml-lesson">
      <header className="ml-lhead">
        <p className="ml-kicker">Tool</p>
        <h2>SPED Exemplar Maker</h2>
        <p className="ml-meta">Paste one math lesson. You get two separate documents: a teacher exemplar for someone who has never taught it, and a practice pack.</p>
      </header>

      <section className="ml-card ml-first" aria-labelledby="mk-req">
        <h3 id="mk-req">What it builds, every time</h3>
        <ul className="ml-mk-req">{SPED_REQUIREMENTS.map((r) => <li key={r.id}>{r.text}</li>)}</ul>
      </section>

      <section className="ml-card" aria-labelledby="mk-in">
        <h3 id="mk-in">1. Give it the lesson</h3>
        {!ai && <p className="ml-mk-warn" role="status">The AI isn’t turned on for this site yet, so building won’t work until it is.</p>}
        <div className="ml-form">
          <label>Lesson name (optional)<input value={title} maxLength={SPED_LIMITS.title} onChange={(e) => setTitle(e.target.value)} placeholder="Grade 7 · Unit 4 · Lesson 8" /></label>
          <label>Grade (optional)<select value={grade} onChange={(e) => setGrade(e.target.value)}><option value="">Let it figure it out</option>{["K", ...Array.from({ length: 12 }, (_, i) => String(i + 1))].map((g) => <option key={g} value={g}>{g === "K" ? "Kindergarten" : `Grade ${g}`}</option>)}</select></label>
        </div>
        <label className="ml-mk-label">Paste a link to the lesson (a web page, up to 3 links)
          <input value={links} maxLength={600} inputMode="url" autoComplete="off" onChange={(e) => setLinks(e.target.value)} placeholder="https://…  (the page must open without signing in)" data-testid="sped-links" />
        </label>
        <p className="ml-note">I read the page for you. If it needs a sign-in or won’t open, I’ll say so, and you can paste the text or add photos instead.</p>
        <label className="ml-mk-label">Or paste the lesson: the warm-up, the activities, the problems and the cool-down
          <textarea value={text} maxLength={SPED_LIMITS.text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste the lesson text here. Include every problem you want solved, and the lesson’s own practice problems if it has them." />
        </label>
        <UploadPicker files={files} setFiles={setFiles} onError={setError} testId="sped-files" />
        <div className="ml-mk-photos">
          <label className="ml-mk-photo">Add photos or screenshots instead (up to {SPED_LIMITS.images})
            <input type="file" accept="image/*" multiple onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
          </label>
          {images.length > 0 && <ul className="ml-mk-thumbs">{images.map((im, i) => <li key={i}><img src={im.data} alt={`Photo ${i + 1}`} /><button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}>×</button></li>)}</ul>}
        </div>
        <div className="ml-mk-go">
          <button type="button" className="ml-primary" disabled={busy || !ai} onClick={build}>{busy ? "Building…" : "Build my exemplar and practice pack"}</button>
          <span className="ml-note">It takes a few minutes. You can leave this page and come back.</span>
        </div>
        {busy && <p className="ml-mk-stage" role="status" aria-live="polite">{job?.stage || "Starting"}…</p>}
        {error && <p className="ml-mk-warn" role="alert">{error}</p>}
      </section>

      {pack && (
        <>
          <section className="ml-card ml-big" aria-live="polite">
            <h3>{pack.title}</h3>
            <p>{pack.check.flagged === 0
              ? <>All {pack.check.checked} answers were checked: the arithmetic was redone in code and a second solver worked each problem on its own.</>
              : <>{pack.check.checked - pack.check.flagged} of {pack.check.checked} answers were confirmed. {pack.check.flagged} could not be, and {pack.check.flagged === 1 ? "is" : "are"} marked “Double-check this one” in the documents. Check {pack.check.flagged === 1 ? "it" : "those"} against your own copy before you teach.</>}</p>
          </section>
          <div className="ml-tabs" role="tablist" aria-label="Documents">
            <button type="button" role="tab" aria-selected={tab === "exemplar"} className={tab === "exemplar" ? "is-on" : ""} onClick={() => setTab("exemplar")}>1. Exemplar (teacher guide)</button>
            <button type="button" role="tab" aria-selected={tab === "practice"} className={tab === "practice" ? "is-on" : ""} onClick={() => setTab("practice")}>2. Practice Pack</button>
          </div>
          {tab === "exemplar"
            ? <Doc key="e" title="Exemplar (teacher guide)" name={`${safe}-exemplar`} html={exemplarHtml(pack.exemplar)} />
            : <Doc key="p" title="Practice Pack" name={`${safe}-practice-pack`} html={practiceHtml(pack.exemplar, pack.practice)} />}
        </>
      )}

      {mine.length > 0 && (
        <section className="ml-card" aria-labelledby="mk-mine">
          <h3 id="mk-mine">Your recent exemplars</h3>
          <ul className="ml-mk-mine">{mine.map((m) => (
            <li key={m.id}>
              <span>{m.title}<small> · {new Date(m.createdAt).toLocaleDateString()}{m.status !== "done" ? ` · ${m.status}` : ""}</small></span>
              <span><button type="button" onClick={() => void open(m.id)}>Open</button> <button type="button" onClick={() => void forget(m.id)} aria-label={`Delete ${m.title}`}>Delete</button></span>
            </li>
          ))}</ul>
        </section>
      )}
    </div>
  );
}
