// A.R.I.S.E. Office: account-saved Sheets, Docs and Slides.
// Kept separate from the hubs' small JSON records so large documents don't consume hub storage.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { askAppAi, docsApi, saveLabel, useCloudDoc, type DocEntry, type DocKind } from "@/lib/cloudDocs";
import { colName, evalFormula, isErr, type Scalar } from "@shared/office/formula";
import { ArrowLeft, FileText, Presentation, Table2, Plus, Trash2, RotateCcw, Sparkles, Printer, Download, AlertTriangle } from "lucide-react";

type Tab = { id: string; name: string; cells: string[][] };
type OfficeSheet = { tabs: Tab[] };
type OfficeDoc = { text: string };
type Slide = { id: string; title: string; bullets: string[]; notes: string };
type OfficeSlides = { slides: Slide[] };
type OfficeContent = OfficeSheet | OfficeDoc | OfficeSlides;
const rid = () => Math.random().toString(36).slice(2, 11);
const grid = (rows = 24, cols = 10) => Array.from({ length: rows }, () => Array(cols).fill("") as string[]);
const initial = (kind: DocKind): OfficeContent => kind === "sheet"
  ? { tabs: [{ id: rid(), name: "Sheet 1", cells: grid() }] }
  : kind === "doc" ? { text: "" }
  : { slides: [{ id: rid(), title: "My presentation", bullets: [], notes: "" }] };
const clean = (kind: DocKind, raw: unknown): OfficeContent => {
  const v = raw && typeof raw === "object" ? raw as any : {};
  if (kind === "sheet") return { tabs: Array.isArray(v.tabs) && v.tabs.length
    ? v.tabs.slice(0, 30).map((t: any) => ({
      id: String(t.id || rid()), name: String(t.name || "Sheet").slice(0, 80),
      cells: Array.isArray(t.cells) && t.cells.length ? t.cells.slice(0, 250).map((r: any) =>
        Array.isArray(r) ? r.slice(0, 30).map((c: any) => typeof c === "string" ? c.slice(0, 5000) : "") : []) : grid()
    })) : (initial("sheet") as OfficeSheet).tabs };
  if (kind === "doc") return { text: String(v.text || "").slice(0, 300000) };
  return { slides: Array.isArray(v.slides) && v.slides.length
    ? v.slides.slice(0, 100).map((s: any) => ({ id: String(s.id || rid()), title: String(s.title || "").slice(0, 160),
      bullets: Array.isArray(s.bullets) ? s.bullets.slice(0, 12).map((b: any) => String(b).slice(0, 500)) : [],
      notes: String(s.notes || "").slice(0, 5000) }))
    : (initial("slides") as OfficeSlides).slides };
};
const classes = {
  button: "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50",
  primary: "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50",
  input: "min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
};
function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function sheetDisplay(tab: Tab, tabs: Tab[], r: number, c: number): string {
  function evalAt(t: Tab, row: number, col: number, stack: Set<string>): Scalar {
    if (row < 0 || col < 0 || row >= t.cells.length || col >= (t.cells[0]?.length || 0)) return { err: "#REF!" };
    const key = t.id + ":" + row + ":" + col;
    if (stack.has(key)) return { err: "#CYCLE!" };
    const raw = t.cells[row]?.[col] || "";
    if (!raw.startsWith("=")) {
      if (raw === "") return null;
      if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw.trim())) return Number(raw);
      return raw;
    }
    const next = new Set(stack); next.add(key);
    return evalFormula(raw, {
      cell: (name, rr, cc) => {
        const target = name ? tabs.find((s) => s.name.toLowerCase() === name.toLowerCase()) : t;
        return target ? evalAt(target, rr, cc, next) : { err: "#REF!" };
      },
      bounds: (name) => {
        const target = name ? tabs.find((s) => s.name.toLowerCase() === name.toLowerCase()) : t;
        return target ? { rows: target.cells.length, cols: target.cells[0]?.length || 0 } : null;
      },
      here: { r: row, c: col }, now: new Date(), rand: Math.random
    });
  }
  const value = evalAt(tab, r, c, new Set());
  return value === null ? "" : isErr(value) ? value.err : typeof value === "boolean" ? (value ? "TRUE" : "FALSE") : String(value);
}
function SheetEditor({ content, update, token }: { content: OfficeSheet; update: (next: OfficeSheet) => void; token: string | null }) {
  const [tabId, setTabId] = useState<string | null>(null);
  const [at, setAt] = useState({ r: 0, c: 0 });
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState("");
  const tab = content.tabs.find((t) => t.id === tabId) || content.tabs[0];
  const selected = tab.cells[at.r]?.[at.c] || "";
  const changeTab = (next: Tab) => update({ tabs: content.tabs.map((t) => t.id === tab.id ? next : t) });
  const setCell = (value: string) => {
    const cells = tab.cells.map((row, ri) => ri === at.r ? row.map((v, ci) => ci === at.c ? value : v) : row);
    changeTab({ ...tab, cells });
  };
  // The formula engine is deliberately independent of the editor and accepts cell references.
  const evaluated = useMemo(() => tab.cells.map((row, r) => row.map((_, c) => sheetDisplay(tab, content.tabs, r, c))), [tab, content.tabs]);
  const changeSize = (which: "row" | "col") => {
    if (which === "row" && tab.cells.length < 250) changeTab({ ...tab, cells: [...tab.cells, Array(tab.cells[0]?.length || 10).fill("")] });
    if (which === "col" && (tab.cells[0]?.length || 0) < 30) changeTab({ ...tab, cells: tab.cells.map((row) => [...row, ""]) });
  };
  const exportCsv = () => download("arise-" + tab.name.replace(/[^\w-]/g, "_") + ".csv",
    evaluated.map((row) => row.map((v) => '"' + v.replace(/"/g, '""') + '"').join(",")).join("\r\n"), "text/csv");
  const generate = async () => {
    if (!ask.trim()) return;
    setBusy(true); setHelp("");
    try {
      const result = await askAppAi<{ formula: string; explain: string }>(token, "sheet-formula", { ask, headers: tab.cells[0]?.join(", ") || "" });
      if (result.formula?.startsWith("=")) { setCell(result.formula); setHelp(result.explain || "Formula inserted."); }
      else setHelp("The AI did not return a usable formula.");
    } catch (e: any) { setHelp(e.message || "Unable to generate formula."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      {content.tabs.map((t) => <button key={t.id} onClick={() => { setTabId(t.id); setAt({ r: 0, c: 0 }); }} className={t.id === tab.id ? classes.primary : classes.button}>{t.name}</button>)}
      <button className={classes.button} onClick={() => update({ tabs: [...content.tabs, { id: rid(), name: "Sheet " + (content.tabs.length + 1), cells: grid() }] })} disabled={content.tabs.length >= 30}><Plus size={15} /> Tab</button>
      <button className={classes.button} onClick={exportCsv}><Download size={15} /> CSV</button>
    </div>
    <label className="block max-w-sm text-xs font-semibold text-slate-600">Tab name<input className={classes.input} value={tab.name} onChange={(e) => changeTab({ ...tab, name: e.target.value })} /></label>
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">{colName(at.c)}{at.r + 1}</span>
      <input className={classes.input + " min-w-[220px] flex-1 font-mono"} aria-label="Selected cell value or formula" value={selected} onChange={(e) => setCell(e.target.value)} placeholder="Enter a value or =SUM(A1:A5)" />
    </div>
    <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="border-collapse text-sm"><thead><tr><th className="sticky left-0 top-0 z-20 bg-slate-100 px-3 py-2" />
        {tab.cells[0]?.map((_, c) => <th key={c} className="sticky top-0 z-10 min-w-24 border border-slate-200 bg-slate-100 px-3 py-2">{colName(c)}</th>)}</tr></thead>
        <tbody>{tab.cells.map((row, r) => <tr key={r}><th className="sticky left-0 z-10 border border-slate-200 bg-slate-100 px-2 text-slate-500">{r + 1}</th>
          {row.map((_, c) => <td key={c} className="border border-slate-200 p-0">
            <button type="button" onClick={() => setAt({ r, c })} className={"h-9 w-full min-w-24 max-w-48 truncate px-2 text-left text-slate-800 " + (at.r === r && at.c === c ? "bg-indigo-100 outline outline-2 outline-indigo-600" : "hover:bg-slate-50")} title={evaluated[r]?.[c] || ""}>{evaluated[r]?.[c] || "\u00a0"}</button>
          </td>)}</tr>)}</tbody></table>
    </div>
    <div className="flex flex-wrap gap-2"><button className={classes.button} onClick={() => changeSize("row")}><Plus size={14}/> Row</button><button className={classes.button} onClick={() => changeSize("col")}><Plus size={14}/> Column</button></div>
    <div className="rounded-xl border border-violet-100 bg-violet-50 p-3">
      <p className="mb-2 text-sm font-bold text-violet-900">AI formula helper</p>
      <div className="flex flex-wrap gap-2"><input className={classes.input + " min-w-48 flex-1"} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="e.g. Add numbers in column B" /><button className={classes.primary} onClick={generate} disabled={busy || !ask.trim()}><Sparkles size={15}/>{busy ? "Working…" : "Insert formula"}</button></div>
      {help && <p className="mt-2 text-sm text-violet-900" role="status">{help}</p>}
    </div>
  </div>;
}
function DocEditor({ content, update, token }: { content: OfficeDoc; update: (next: OfficeDoc) => void; token: string | null }) {
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const generate = async () => {
    if (!ask.trim()) return;
    setBusy(true); setMessage("");
    try {
      const r = await askAppAi<{ html: string }>(token, "doc-write", { topic: ask });
      // Text, not injected AI HTML: generated markup cannot execute on this page.
      const safeText = new DOMParser().parseFromString(r.html || "", "text/html").body.textContent || "";
      update({ text: content.text ? content.text + "\n\n" + safeText : safeText }); setMessage("Draft added to your document.");
    } catch (e: any) { setMessage(e.message || "AI draft unavailable."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2"><button className={classes.button} onClick={() => download("arise-document.txt", content.text, "text/plain")}><Download size={15}/> Download text</button>
      <button className={classes.button} onClick={() => window.print()}><Printer size={15}/> Print</button></div>
    <textarea className={classes.input + " min-h-[50vh] resize-y bg-white p-5 text-base leading-7"} aria-label="Document editor" placeholder="Start writing your document…" value={content.text} onChange={(e) => update({ text: e.target.value })} />
    <div className="rounded-xl border border-violet-100 bg-violet-50 p-3"><p className="mb-2 text-sm font-bold text-violet-900">AI writing assistant</p>
      <div className="flex flex-wrap gap-2"><input className={classes.input + " min-w-48 flex-1"} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Describe what you want written…" />
        <button className={classes.primary} disabled={!ask.trim() || busy} onClick={generate}><Sparkles size={15}/>{busy ? "Writing…" : "Add draft"}</button></div>
      {message && <p role="status" className="mt-2 text-sm text-violet-900">{message}</p>}
    </div>
  </div>;
}
function SlidesEditor({ content, update, token }: { content: OfficeSlides; update: (next: OfficeSlides) => void; token: string | null }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [message, setMessage] = useState("");
  const slide = content.slides.find((s) => s.id === selected) || content.slides[0];
  const index = content.slides.indexOf(slide);
  const change = (next: Slide) => update({ slides: content.slides.map((s) => s.id === slide.id ? next : s) });
  const add = () => { const s = { id: rid(), title: "", bullets: [], notes: "" }; update({ slides: [...content.slides, s] }); setSelected(s.id); };
  const remove = () => { if (content.slides.length === 1) return; update({ slides: content.slides.filter((s) => s.id !== slide.id) }); setSelected(null); };
  const generate = async () => {
    if (!ask.trim()) return;
    setBusy(true); setMessage("");
    try {
      const r = await askAppAi<{ slides: { title: string; bullets: string[]; notes: string }[] }>(token, "slides-deck", { topic: ask, count: "8" });
      if (!Array.isArray(r.slides) || !r.slides.length) throw Error("No slides returned.");
      const next = clean("slides", { slides: r.slides.map((s) => ({ ...s, id: rid() })) }) as OfficeSlides;
      update(next); setSelected(null); setMessage("Draft slide deck created.");
    } catch (e: any) { setMessage(e.message || "AI slides unavailable."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2"><button className={classes.button} onClick={add} disabled={content.slides.length >= 100}><Plus size={15}/> Add slide</button>
      <button className={classes.button} onClick={remove} disabled={content.slides.length <= 1}><Trash2 size={15}/> Delete slide</button>
      <button className={classes.primary} onClick={() => setPresenting(!presenting)}><Presentation size={15}/>{presenting ? "Edit slides" : "Present"}</button></div>
    <div className="grid gap-4 lg:grid-cols-[12rem_1fr]">
      <div className="flex gap-2 overflow-x-auto lg:flex-col">{content.slides.map((s, i) =>
        <button key={s.id} className={"min-w-36 rounded-xl border p-3 text-left text-xs " + (s.id === slide.id ? "border-indigo-600 bg-indigo-50" : "border-slate-200 bg-white")} onClick={() => setSelected(s.id)}><span className="text-slate-500">Slide {i + 1}</span><strong className="mt-1 block truncate text-sm">{s.title || "Untitled"}</strong></button>)}</div>
      <div className="space-y-3">
        <div className="flex aspect-video flex-col justify-center rounded-2xl bg-gradient-to-br from-indigo-950 to-violet-700 px-6 py-6 text-center text-white shadow-lg sm:px-12" aria-label="Slide preview">
          <h2 className="mb-4 text-2xl font-extrabold sm:text-4xl">{slide.title || "Slide title"}</h2>
          <ul className="mx-auto list-disc space-y-2 text-left text-sm sm:text-xl">{slide.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
        {!presenting && <div className="space-y-2"><label className="block text-sm font-semibold">Title<input className={classes.input} value={slide.title} onChange={(e) => change({ ...slide, title: e.target.value })} /></label>
          <label className="block text-sm font-semibold">Bullets (one per line)<textarea rows={5} className={classes.input} value={slide.bullets.join("\n")} onChange={(e) => change({ ...slide, bullets: e.target.value.split("\n") })} /></label>
          <label className="block text-sm font-semibold">Presenter notes<textarea rows={3} className={classes.input} value={slide.notes} onChange={(e) => change({ ...slide, notes: e.target.value })} /></label></div>}
        {presenting && <div className="flex gap-2"><button className={classes.button} disabled={index === 0} onClick={() => setSelected(content.slides[index - 1].id)}>Previous</button><button className={classes.primary} disabled={index === content.slides.length - 1} onClick={() => setSelected(content.slides[index + 1].id)}>Next slide</button></div>}
      </div>
    </div>
    {!presenting && <div className="rounded-xl border border-violet-100 bg-violet-50 p-3"><p className="mb-2 text-sm font-bold text-violet-900">AI slide deck</p>
      <div className="flex flex-wrap gap-2"><input className={classes.input + " min-w-48 flex-1"} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Topic for a new presentation…" /><button className={classes.primary} disabled={!ask.trim() || busy} onClick={generate}><Sparkles size={15}/>{busy ? "Creating…" : "Create draft"}</button></div>
      {message && <p className="mt-2 text-sm text-violet-900" role="status">{message}</p>}
    </div>}
  </div>;
}
function Editor({ entry, onBack }: { entry: DocEntry; onBack: () => void }) {
  const { token } = useAuth();
  const normalizer = useCallback((raw: unknown) => clean(entry.kind, raw), [entry.kind]);
  const doc = useCloudDoc<OfficeContent>(entry.id, normalizer);
  const update = doc.setContent;
  if (doc.loading) return <p role="status">Opening file…</p>;
  if (doc.error && !doc.content) return <p className="text-rose-700">{doc.error} <button className={classes.button} onClick={onBack}>Back</button></p>;
  const value = doc.content || initial(entry.kind);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-2">
      <button className={classes.button} onClick={() => { void doc.flush(); onBack(); }}><ArrowLeft size={16}/> Files</button>
      <input className={classes.input + " min-w-52 flex-1 text-lg font-bold"} aria-label="File name" value={doc.name} onChange={(e) => doc.setName(e.target.value)} />
      <span className="text-xs font-semibold text-slate-600" role="status">{saveLabel(doc.state)}</span>
    </div>
    {doc.state === "conflict" && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={16} className="inline"/> This file also changed on another device. Choose which version to use.
      <div className="mt-2 flex gap-2"><button className={classes.button} onClick={doc.keepMine}>Keep my changes</button><button className={classes.button} onClick={() => void doc.reload()}>Load other version</button></div></div>}
    {entry.kind === "sheet" ? <SheetEditor content={value as OfficeSheet} update={update} token={token}/> :
      entry.kind === "doc" ? <DocEditor content={value as OfficeDoc} update={update} token={token}/> :
      <SlidesEditor content={value as OfficeSlides} update={update} token={token}/>}
  </div>;
}
const kindLabels: Record<DocKind, string> = { sheet: "Sheets", doc: "Docs", slides: "Slides" };
const kindIcons = { sheet: Table2, doc: FileText, slides: Presentation };
export default function AriseOffice() {
  const { token, user } = useAuth();
  const [entries, setEntries] = useState<DocEntry[]>([]);
  const [trash, setTrash] = useState(false);
  const [kind, setKind] = useState<DocKind | "all">(() => { const requested = new URLSearchParams(window.location.hash.split("?")[1] || "").get("kind"); return requested === "sheet" || requested === "doc" || requested === "slides" ? requested : "all"; });
  const [open, setOpen] = useState<DocEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    try { setEntries(await docsApi(token).list(undefined, trash)); setMessage(""); }
    catch (e: any) { setMessage(e.message || "Could not load files."); }
  }, [token, trash]);
  useEffect(() => { if (token) void refresh(); }, [refresh, token]);
  const create = async (k: DocKind) => {
    setBusy(true); setMessage("");
    try { setOpen(await docsApi(token).create(k, "Untitled " + kindLabels[k].slice(0, -1), initial(k))); }
    catch (e: any) { setMessage(e.message || "Could not create file."); }
    finally { setBusy(false); }
  };
  const move = async (id: string, restore: boolean) => {
    setBusy(true);
    try { if (restore) await docsApi(token).restore(id); else await docsApi(token).trash(id); await refresh(); }
    catch (e: any) { setMessage(e.message || "Could not change file."); }
    finally { setBusy(false); }
  };
  const visible = entries.filter((e) => kind === "all" || e.kind === kind);
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><a href={user?.role === "parent" ? "#/lifehub" : "#/workhub"} className="text-sm font-semibold text-indigo-700 hover:underline">← Back to my hub</a><h1 className="mt-2 text-3xl font-extrabold">A.R.I.S.E. Office</h1><p className="mt-1 text-sm text-slate-600">Your spreadsheets, documents and presentations, saved to your account.</p></div>
        {open ? null : <button className={classes.button} onClick={() => { setTrash(!trash); setKind("all"); }}><Trash2 size={16}/>{trash ? "My files" : "Trash"}</button>}
      </header>
      {open ? <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><Editor key={open.id} entry={open} onBack={() => { setOpen(null); void refresh(); }}/></section> :
      <>
        {!trash && <div className="grid gap-3 sm:grid-cols-3">{(["sheet", "doc", "slides"] as DocKind[]).map((k) => {
          const Icon = kindIcons[k]; return <button key={k} disabled={busy} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-indigo-400" onClick={() => void create(k)}><Icon size={27} className="text-indigo-700"/><span className="flex-1"><strong className="block">{kindLabels[k]}</strong><span className="text-xs text-slate-500">Create new</span></span><Plus size={18}/></button>;
        })}</div>}
        <div className="flex flex-wrap gap-2">{(["all", "sheet", "doc", "slides"] as const).map((k) => <button key={k} className={kind === k ? classes.primary : classes.button} onClick={() => setKind(k)}>{k === "all" ? "All files" : kindLabels[k]}</button>)}</div>
        {message && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{message}</p>}
        {visible.length ? <ul className="grid gap-3 sm:grid-cols-2">{visible.map((e) => { const Icon = kindIcons[e.kind]; return <li key={e.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <Icon size={24} className="shrink-0 text-indigo-700"/>
          <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(e)} disabled={trash}><strong className="block truncate text-sm">{e.name}</strong><span className="text-xs text-slate-500">{kindLabels[e.kind]} · Updated {new Date(e.updatedAt).toLocaleDateString()}</span></button>
          <button className={classes.button} disabled={busy} onClick={() => void move(e.id, trash)} aria-label={trash ? "Restore " + e.name : "Move " + e.name + " to trash"}>{trash ? <RotateCcw size={16}/> : <Trash2 size={16}/>}</button>
        </li>; })}</ul> : <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">{trash ? "Your trash is empty." : "No files here yet. Create one above."}</p>}
      </>}
    </div>
  </main>;
}
