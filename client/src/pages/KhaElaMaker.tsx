// Kha ELA Worksheet Maker (a view inside Math Lessons). A teacher sets who it is for and what to cover (or pastes a
// worksheet / poems to follow, or adds photos) and gets three documents: the WORKSHEET, a COMIC version and the TEACHER KEY.
// The rules the documents follow are in shared/khaEla.ts (KHA_REQUIREMENTS); the pictures are drawn in code
// (shared/khaElaArt.ts); the server builds and checks everything (server/khaEla.ts). After a build the teacher can
// type a change ("make it shorter") and get a new version.
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { KHA_DEFAULTS, KHA_LIMITS, KHA_REQUIREMENTS, comicHtml, keyHtml, worksheetHtml, type KhaPack, type KhaSettings } from "@shared/khaEla";
import UploadPicker from "@/components/UploadPicker";
import type { UploadedFile } from "@shared/uploads";
import { AI_MAX_PICTURES, pdfsForAi } from "@/lib/pdfPages";

type Mine = { id: string; title: string; status: string; createdAt: string };
type Job = { id: string; status: "working" | "done" | "failed"; stage: string; error?: string; pack?: KhaPack };
const JOB_KEY = "arise-kha-job";
const SETTINGS_KEY = "arise-kha-settings";
const CHANGES = ["Make it shorter", "Make the words simpler", "Add a rhyme question", "Use different animals", "Add more picture clues", "Make the poems funnier"];

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

function readSettings(): KhaSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (raw && typeof raw === "object") return { ...KHA_DEFAULTS, ...raw, extra: "" };
  } catch { /* fine */ }
  return KHA_DEFAULTS;
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

export default function KhaElaMaker() {
  const [s, setS] = useState<KhaSettings>(readSettings);
  const [text, setText] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [images, setImages] = useState<{ name: string; data: string }[]>([]);
  const [change, setChange] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Mine[]>([]);
  const [ai, setAi] = useState(true);
  const [tab, setTab] = useState<"worksheet" | "comic" | "key">("worksheet");
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  const set = <K extends keyof KhaSettings>(k: K, v: KhaSettings[K]) => setS((cur) => ({ ...cur, [k]: v }));

  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, extra: "" })); } catch { /* fine */ } }, [s]);

  const loadList = useCallback(async () => {
    try { const r = await (await apiRequest("GET", "/api/kha-ela")).json(); if (alive.current) { setMine(r.mine || []); setAi(r.ai !== false); } }
    catch (e) { if (alive.current) setError(messageOf(e)); }
  }, []);

  const poll = useCallback((id: string) => {
    window.clearTimeout(timer.current);
    const tick = async () => {
      try {
        const j: Job = await (await apiRequest("GET", `/api/kha-ela/${id}`)).json();
        if (!alive.current) return;
        setJob(j);
        if (j.status === "working") { timer.current = window.setTimeout(tick, 2500); return; }
        setBusy(false);
        try { localStorage.removeItem(JOB_KEY); } catch { /* fine */ }
        if (j.status === "failed") setError(j.error || "The build didn’t finish. Tap Make it again.");
        else { setTab("worksheet"); setChange(""); void loadList(); }
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
    const room = KHA_LIMITS.images - images.length;
    const picked = [...files].slice(0, Math.max(0, room));
    try {
      const next = [] as { name: string; data: string }[];
      for (const f of picked) next.push({ name: f.name, data: await shrink(f) });
      setImages((cur) => [...cur, ...next].slice(0, KHA_LIMITS.images));
      if (files.length > room) setError(`Up to ${KHA_LIMITS.images} photos at a time.`);
    } catch { setError("One of those photos couldn’t be read. Try a JPG or PNG."); }
  };

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { id } = await (await apiRequest("POST", "/api/kha-ela", body)).json();
      try { localStorage.setItem(JOB_KEY, id); } catch { /* fine */ }
      poll(id);
    } catch (e) { setBusy(false); setError(messageOf(e)); }
  };

  const build = async () => {
    setError(""); setJob(null);
    if (s.source === "asis" && !text.trim() && !links.trim() && !files.length && !images.length) { setError("Paste the poems or worksheet to use (or add a link, a file or photos), or switch to “Write new poems.”"); return; }
    // PDFs are read here first: their words go as text, a scan as pictures of its pages (the AI can't open PDFs).
    setBusy(true);
    const ready = await pdfsForAi(files, Math.min(KHA_LIMITS.images, AI_MAX_PICTURES) - images.length).catch(() => ({ files, images: [] as string[] }));
    await send({ settings: s, text, links, files: ready.files, images: [...images.map((i) => i.data), ...ready.images] });
  };
  const applyChange = async () => {
    if (!job?.pack) return;
    setError("");
    if (!change.trim()) { setError("Say what to change, or tap one of the ideas."); return; }
    await send({ settings: job.pack.settings, text: "", images: [], refineFrom: job.pack.id, change });
  };

  const open = async (id: string) => {
    setError(""); setBusy(true);
    try {
      const j: Job = await (await apiRequest("GET", `/api/kha-ela/${id}`)).json();
      setJob(j); setTab("worksheet");
      if (j.status === "working") poll(id); else setBusy(false);
      if (j.status === "failed") setError(j.error || "That build didn’t finish.");
    } catch (e) { setBusy(false); setError(messageOf(e)); }
  };
  const forget = async (id: string) => {
    try { await apiRequest("DELETE", `/api/kha-ela/${id}`); if (job?.id === id) setJob(null); await loadList(); } catch (e) { setError(messageOf(e)); }
  };

  const pack = job?.status === "done" ? job.pack : undefined;
  const safe = (pack?.title || "worksheet").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50) || "worksheet";
  const pics = pack?.settings.pictures ?? "auto";

  return (
    <div className="ml-lesson">
      <header className="ml-lhead">
        <p className="ml-kicker">Tool</p>
        <h2>Kha ELA Worksheet Maker</h2>
        <p className="ml-meta">Poems, questions, pictures and a comic, built around a student’s favorite animals. You get a worksheet, a comic and a teacher key, and you can change any of it.</p>
      </header>

      <section className="ml-card ml-first" aria-labelledby="kha-req">
        <h3 id="kha-req">What it builds, every time</h3>
        <ul className="ml-mk-req">{KHA_REQUIREMENTS.map((r) => <li key={r.id}>{r.text}</li>)}</ul>
      </section>

      <section className="ml-card" aria-labelledby="kha-in">
        <h3 id="kha-in">1. Set it up</h3>
        {!ai && <p className="ml-mk-warn" role="status">The AI isn’t turned on for this site yet, so building won’t work until it is.</p>}
        <div className="ml-form">
          <label>Student’s first name<input value={s.student} maxLength={20} onChange={(e) => set("student", e.target.value)} /></label>
          <label>Grade<select value={s.grade} onChange={(e) => set("grade", e.target.value)}>{["K", ...Array.from({ length: 12 }, (_, i) => String(i + 1))].map((g) => <option key={g} value={g}>{g === "K" ? "Kindergarten" : `Grade ${g}`}</option>)}</select></label>
          <label>Favorite animals or interests<input value={s.interests} maxLength={KHA_LIMITS.field} onChange={(e) => set("interests", e.target.value)} /></label>
          <label>What to practice<input value={s.focus} maxLength={KHA_LIMITS.field} onChange={(e) => set("focus", e.target.value)} /></label>
          <label>What the class is reading (the theme to follow)<input value={s.classText} maxLength={KHA_LIMITS.field * 2} onChange={(e) => set("classText", e.target.value)} /></label>
          <label>Number of poems<select value={s.poems} onChange={(e) => set("poems", Number(e.target.value))}>{Array.from({ length: KHA_LIMITS.poemsMax - KHA_LIMITS.poemsMin + 1 }, (_, i) => i + KHA_LIMITS.poemsMin).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Number of questions<select value={s.questions} onChange={(e) => set("questions", Number(e.target.value))}>{Array.from({ length: KHA_LIMITS.qMax - KHA_LIMITS.qMin + 1 }, (_, i) => i + KHA_LIMITS.qMin).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Poems<select value={s.source} onChange={(e) => set("source", e.target.value === "asis" ? "asis" : "new")}><option value="new">Write new poems</option><option value="asis">Use what I paste or photograph</option></select></label>
          <label>Pictures<select value={s.pictures} onChange={(e) => set("pictures", e.target.value === "box" ? "box" : "auto")}><option value="auto">Draw them (pigeons, flamingos, doves, crows)</option><option value="box">Leave a draw-it box (other animals)</option></select></label>
        </div>
        <label className="ml-mk-check"><input type="checkbox" checked={s.supports} onChange={(e) => set("supports", e.target.checked)} /> Autism-friendly supports (plain words, no idioms or sarcasm, one task at a time, sentence starters and word banks)</label>
        <label className="ml-mk-label">Anything else? (optional)
          <textarea value={s.extra} maxLength={KHA_LIMITS.extra} onChange={(e) => set("extra", e.target.value)} rows={2} placeholder="For example: include a rhyme question, keep the poems funny, add a word bank." />
        </label>
        <label className="ml-mk-label">{s.source === "asis" ? "Paste the poems or worksheet to use, word for word" : "Paste a worksheet or poems to follow (optional)"}
          <textarea value={text} maxLength={KHA_LIMITS.text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Paste text here. A worksheet you already like works well: the new one follows its style." />
        </label>
        <label className="ml-mk-label">Or paste a link to a worksheet or poems to follow (optional)
          <input value={links} maxLength={600} inputMode="url" autoComplete="off" onChange={(e) => setLinks(e.target.value)} placeholder="https://…  (the page must open without signing in)" data-testid="kha-links" />
        </label>
        <UploadPicker files={files} setFiles={setFiles} onError={setError} testId="kha-files" />
        <div className="ml-mk-photos">
          <label className="ml-mk-photo">Add photos or screenshots of a worksheet or poem (up to {KHA_LIMITS.images})
            <input type="file" accept="image/*" multiple onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
          </label>
          {images.length > 0 && <ul className="ml-mk-thumbs">{images.map((im, i) => <li key={i}><img src={im.data} alt={`Photo ${i + 1}`} /><button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}>×</button></li>)}</ul>}
        </div>
        <p className="ml-note">Only the first name is sent to the AI. A PDF can’t be read here: paste its text or add photos of its pages.</p>
        <div className="ml-mk-go">
          <button type="button" className="ml-primary" disabled={busy || !ai} onClick={build}>{busy ? "Building…" : "Make the worksheet, comic and key"}</button>
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
              ? <>All {pack.check.checked} questions were checked: a second reader answered each one from the poems and agreed.</>
              : <>{pack.check.checked - pack.check.flagged} of {pack.check.checked} questions were confirmed. {pack.check.flagged} could not be, and {pack.check.flagged === 1 ? "is" : "are"} marked “Double-check this one” on the key. Look at {pack.check.flagged === 1 ? "it" : "those"} before it goes to {pack.settings.student}.</>}</p>
          </section>
          <section className="ml-card" aria-labelledby="kha-change">
            <h3 id="kha-change">2. Change it</h3>
            <div className="ml-mk-chips">{CHANGES.map((c) => <button key={c} type="button" onClick={() => setChange(c)}>{c}</button>)}</div>
            <label className="ml-mk-label">What should be different?
              <textarea value={change} maxLength={KHA_LIMITS.change} onChange={(e) => setChange(e.target.value)} rows={2} placeholder="Say it in your own words, then tap the button." />
            </label>
            <div className="ml-mk-go">
              <button type="button" className="ml-primary" disabled={busy || !ai} onClick={applyChange}>{busy ? "Working…" : "Make this change"}</button>
              <span className="ml-note">Your first version stays in “Your recent worksheets.”</span>
            </div>
          </section>
          <div className="ml-tabs" role="tablist" aria-label="Documents">
            <button type="button" role="tab" aria-selected={tab === "worksheet"} className={tab === "worksheet" ? "is-on" : ""} onClick={() => setTab("worksheet")}>1. Worksheet</button>
            <button type="button" role="tab" aria-selected={tab === "comic"} className={tab === "comic" ? "is-on" : ""} onClick={() => setTab("comic")}>2. Comic</button>
            <button type="button" role="tab" aria-selected={tab === "key"} className={tab === "key" ? "is-on" : ""} onClick={() => setTab("key")}>3. Teacher key</button>
          </div>
          {tab === "worksheet" && <Doc key="w" title="Worksheet" name={`${safe}-worksheet`} html={worksheetHtml(pack.sheet, { pictures: pics })} />}
          {tab === "comic" && <Doc key="c" title="Comic" name={`${safe}-comic`} html={comicHtml(pack.sheet, { pictures: pics })} />}
          {tab === "key" && <Doc key="k" title="Teacher key" name={`${safe}-key`} html={keyHtml(pack.sheet, pack.settings, pack.check)} />}
        </>
      )}

      {mine.length > 0 && (
        <section className="ml-card" aria-labelledby="kha-mine">
          <h3 id="kha-mine">Your recent worksheets</h3>
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
