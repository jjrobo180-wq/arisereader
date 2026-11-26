// Google Docs on the site: your Docs listed, opened and edited right here (shared/googleDocText.ts, server routes in
// server/googleConnect.ts). Tap a paragraph to change it, add a paragraph under it, or add to the end; edits only
// touch that paragraph's words, so pictures, tables and formatting elsewhere stay as they were. The site can open the
// Docs made here and the ones you add with Google's own file picker ("Add from Google Drive"): Google gives it those
// files only (drive.file), never the rest of your Drive.
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FilePlus2, FileText, FolderOpen, Loader2, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import type { GoogleFeature, GoogleFile } from "@shared/googleConnect";
import type { DocPara } from "@shared/googleDocText";
import { api } from "./HubAvailability";
import { Card } from "./ui";
import { isNativeApp, openOutside } from "@/lib/nativeApp";

type Status = { configured: boolean; connected: boolean; email: string; features: GoogleFeature[] };
type OpenDoc = { id: string; title: string; link: string; paras: DocPara[] };

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-bold transition disabled:opacity-50";
const primary = `${btn} bg-violet-600 text-white hover:bg-violet-700`;
const ghost = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const box = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[15px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100";
const open = (link: string) => { if (isNativeApp()) void openOutside(link); else window.open(link, "_blank", "noopener"); };

/** Google's file picker, loaded the first time it's needed. */
async function loadPicker(): Promise<any> {
  const w = window as any;
  if (w.google?.picker) return w.google.picker;
  if (!w.gapi) {
    await new Promise<void>((ok, bad) => {
      const s = document.createElement("script");
      s.src = "https://apis.google.com/js/api.js"; s.async = true;
      s.onload = () => ok(); s.onerror = () => bad(new Error("Couldn't load Google's file picker. Check your connection."));
      document.head.appendChild(s);
    });
  }
  await new Promise<void>((ok) => w.gapi.load("picker", ok));
  return w.google.picker;
}

export default function GoogleDocsPanel({ token, status }: { token: string | null; status: Status }) {
  const [files, setFiles] = useState<GoogleFile[] | null>(null);
  const [q, setQ] = useState("");
  const [doc, setDoc] = useState<OpenDoc | null>(null);
  const [loading, setLoading] = useState("");
  const [note, setNote] = useState("");
  const [making, setMaking] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const on = status.features.includes("docs");

  const list = useCallback(async (words = q) => {
    try { const r = await api(token, "GET", `/api/google/drive/files${words.trim() ? `?q=${encodeURIComponent(words.trim())}` : ""}`); setFiles((r.files || []).filter((f: GoogleFile) => f.kind === "doc")); }
    catch (e: any) { setNote(e?.message || "Couldn't load your Docs."); setFiles([]); }
  }, [token, q]);
  useEffect(() => { if (on) void list(""); }, [on, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDoc = useCallback(async (id: string) => {
    setLoading(id); setNote("");
    try { setDoc(await api(token, "GET", `/api/google/docs/${id}`)); }
    catch (e: any) { setNote(e?.message || "Couldn't open that Doc."); }
    finally { setLoading(""); }
  }, [token]);

  const pick = async () => {
    setNote("");
    try {
      const cfg = await api(token, "GET", "/api/google/picker");
      const p = await loadPicker();
      const view = new p.DocsView(p.ViewId.DOCUMENTS).setMode(p.DocsViewMode.LIST).setOwnedByMe(false);
      new p.PickerBuilder()
        .addView(view).addView(new p.DocsView(p.ViewId.DOCUMENTS).setOwnedByMe(true))
        .enableFeature(p.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(cfg.token).setDeveloperKey(cfg.apiKey).setAppId(cfg.appId)
        .setTitle("Pick Docs to use here")
        .setCallback((d: any) => {
          if (d?.action !== p.Action.PICKED) return;
          const picked: { id: string }[] = d.docs || [];
          void list("").then(() => { if (picked.length === 1) void openDoc(picked[0].id); else setNote(`Added ${picked.length} Docs.`); });
        })
        .build().setVisible(true);
    } catch (e: any) { setNote(e?.message || "Couldn't open Google's file picker."); }
  };

  const make = async () => {
    if (!newTitle.trim()) return;
    setMaking(true);
    try { const r = await api(token, "POST", "/api/google/docs/create", { title: newTitle.trim() }); setNewTitle(""); void list(""); await openDoc(r.file.id); }
    catch (e: any) { setNote(e?.message || "Couldn't make the Doc."); }
    finally { setMaking(false); }
  };

  if (!on) return null;
  if (doc) return <DocView token={token} doc={doc} reload={() => openDoc(doc.id)} close={() => { setDoc(null); void list(); }} />;

  return <Card title="Your Google Docs" right={<FileText className="h-5 w-5 text-slate-500" aria-hidden />}>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void pick()} className={primary} data-testid="gdocs-pick"><FolderOpen size={17} aria-hidden />Add from Google Drive</button>
      <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); void make(); }}>
        <input className={`${box} min-w-0 flex-1`} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New Doc's name" aria-label="New Doc's name" maxLength={200} />
        <button type="submit" disabled={!newTitle.trim() || making} className={ghost}>{making ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <FilePlus2 size={17} aria-hidden />}New Doc</button>
      </form>
    </div>
    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void list(); }}>
      <label className="relative min-w-0 flex-1"><span className="sr-only">Search your Docs</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <input className={`${box} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your Docs" /></label>
      <button type="button" onClick={() => void list()} className={ghost} aria-label="Refresh"><RefreshCw size={16} aria-hidden /></button>
    </form>
    {note && <p className="mt-2 text-sm font-semibold text-slate-600" role="status">{note}</p>}
    {files === null ? <p className="mt-3 text-sm text-slate-500">Loading your Docs…</p>
      : files.length ? <ul className="mt-3 divide-y divide-slate-100">{files.map((f) => <li key={f.id}>
        <button type="button" onClick={() => void openDoc(f.id)} className="flex min-h-12 w-full items-center gap-3 py-2 text-left hover:bg-slate-50" data-testid="gdocs-file">
          <FileText size={20} className="shrink-0 text-blue-600" aria-hidden />
          <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold text-slate-800">{f.name}</span>
            {f.modified && <span className="block text-xs text-slate-500">Changed {new Date(f.modified).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}</span>
          {loading === f.id && <Loader2 size={17} className="animate-spin text-slate-400" aria-hidden />}
        </button></li>)}</ul>
      : <p className="mt-3 text-sm text-slate-500">No Docs here yet. Tap <b>Add from Google Drive</b> to bring in the Docs you already have, or make a new one.</p>}
  </Card>;
}

const STYLE: Record<DocPara["style"], string> = {
  title: "text-2xl font-black", subtitle: "text-lg text-slate-500", h1: "text-xl font-black", h2: "text-lg font-extrabold",
  h3: "text-base font-extrabold", h4: "text-[15px] font-bold", text: "text-[15px]",
};

function DocView({ token, doc, reload, close }: { token: string | null; doc: OpenDoc; reload: () => Promise<void>; close: () => void }) {
  const [editing, setEditing] = useState<{ start: number; mode: "edit" | "add" } | null>(null);
  const [text, setText] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const save = async (p: DocPara, mode: "edit" | "add", words: string) => {
    setBusy(true); setNote("");
    try {
      await api(token, "POST", `/api/google/docs/${doc.id}/paragraph`, { start: p.start, old: p.text, text: words, add: mode === "add" });
      setEditing(null); await reload(); setNote(mode === "add" ? "Added." : words.trim() ? "Saved to Google Docs." : "Removed.");
    } catch (e: any) { setNote(e?.message || "Couldn't save. Try again."); }
    finally { setBusy(false); }
  };
  const addEnd = async () => {
    if (!end.trim()) return;
    setBusy(true); setNote("");
    try { await api(token, "POST", `/api/google/docs/${doc.id}/append`, { text: end.trim() }); setEnd(""); await reload(); setNote("Added to the end."); }
    catch (e: any) { setNote(e?.message || "Couldn't add it."); }
    finally { setBusy(false); }
  };

  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={close} className={ghost}><ArrowLeft size={17} aria-hidden />All Docs</button>
      <button type="button" onClick={() => open(doc.link)} className={ghost}><ExternalLink size={16} aria-hidden />Open in Google Docs</button>
    </div>
    <h2 className="mt-3 text-2xl font-black text-slate-900">{doc.title}</h2>
    <p className="text-xs text-slate-500">Tap any paragraph to change it. Changes save straight to Google Docs.</p>
    {note && <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700" role="status">{note}</p>}
    <div className="mt-3 space-y-1" data-testid="gdocs-body">
      {doc.paras.map((p) => {
        if (p.other === "table") return <p key={p.start} className="rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-slate-500">A table · change it in Google Docs</p>;
        const here = editing?.start === p.start;
        if (here && editing) return <div key={p.start} className="space-y-2 rounded-xl bg-violet-50 p-2.5">
          {editing.mode === "add" && <p className={`${STYLE[p.style]} whitespace-pre-wrap text-slate-800`}>{p.text}</p>}
          <textarea autoFocus className={`${box} min-h-24`} value={text} onChange={(e) => setText(e.target.value)} aria-label={editing.mode === "add" ? "New paragraph" : "Paragraph"} placeholder={editing.mode === "add" ? "Type the new paragraph" : ""} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || (editing.mode === "add" && !text.trim())} onClick={() => void save(p, editing.mode, text)} className={primary}>{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}{editing.mode === "add" ? "Add it" : "Save"}</button>
            {editing.mode === "edit" && <button type="button" disabled={busy} onClick={() => { setEditing({ start: p.start, mode: "add" }); setText(""); }} className={ghost}><Plus size={16} aria-hidden />Add one below</button>}
            {editing.mode === "edit" && p.text && <button type="button" disabled={busy} onClick={() => void save(p, "edit", "")} className={`${ghost} text-rose-700`}>Delete</button>}
            <button type="button" disabled={busy} onClick={() => setEditing(null)} className={ghost}>Cancel</button>
          </div>
        </div>;
        return <button key={p.start} type="button" disabled={!!editing || p.other === "picture"} onClick={() => { setEditing({ start: p.start, mode: "edit" }); setText(p.text); }}
          className={`group block w-full rounded-lg px-2 py-1 text-left text-slate-800 hover:bg-slate-50 disabled:hover:bg-transparent ${STYLE[p.style]}`}>
          {p.other === "picture" ? <span className="text-sm italic text-slate-500">A picture{p.text.trim() ? `: ${p.text}` : ""} · change it in Google Docs</span>
            : <span className="whitespace-pre-wrap">{p.bullet ? "• " : ""}{p.text || <span className="text-slate-300">(empty line)</span>}<Pencil size={13} className="ml-1.5 inline text-slate-300 opacity-0 group-hover:opacity-100" aria-hidden /></span>}
        </button>;
      })}
    </div>
    <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
      <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-500" htmlFor="gdocs-end">Add to the end</label>
      <textarea id="gdocs-end" className={`${box} min-h-20`} value={end} onChange={(e) => setEnd(e.target.value)} placeholder="Type here, then Add" />
      <button type="button" disabled={busy || !end.trim()} onClick={() => void addEnd()} className={primary}>{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Plus size={16} aria-hidden />}Add</button>
    </div>
  </Card>;
}
