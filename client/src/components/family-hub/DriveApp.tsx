// The Drive app (App Store add-on, shared/driveApp.ts): keep photos, videos, PDFs and documents from a phone or
// computer. Metadata lives in family.drive; the bytes live in Supabase Storage (server/driveApp.ts), signed URLs only.
// Big files go straight to storage with a signed upload link (any size up to 5 GB, with progress); the account's
// storage space still applies. Search, kinds, folders, stars, sort, grid or list, a viewer, select-many.
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  Upload, Trash2, Sparkles, Search, LayoutGrid, List, Star, FolderPlus, Folder, Download, Share2, Pencil, X,
  ChevronLeft, ChevronRight, Film, Music, FileText, Presentation, Image as ImageIcon, File as FileIcon, Check, Camera, Loader2,
} from "lucide-react";
import {
  addDriveFile, removeDriveFile, updateDriveFile, driveBytesUsed, driveMeter, driveKind, driveFolders, formatBytes,
  FREE_STORAGE_BYTES, type DriveFile, type DriveKind,
} from "@shared/driveApp";
import { API_BASE } from "@/lib/queryClient";

type Props = {
  /** WorkHub: read a document with AI (goals, reminders…) and link what it finds back to it. */
  onReadWithAI?: (file: DriveFile, blob: Blob) => void;
  files: DriveFile[];
  setFiles: (update: (all: DriveFile[]) => DriveFile[]) => void;
  say: (msg: string) => void;
  /** This account's own A.R.I.S.E. session token (see AuthContext): sent as a Bearer header. */
  token: string | null;
};

type Filter = "all" | "starred" | "photos" | "videos" | "docs" | "audio";
type Sort = "new" | "old" | "name" | "size";
type Job = { key: string; name: string; size: number; sent: number; state: "up" | "done" | "error"; note?: string; abort?: () => void };

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" }, { id: "starred", label: "Starred" }, { id: "photos", label: "Photos" },
  { id: "videos", label: "Videos" }, { id: "docs", label: "Documents" }, { id: "audio", label: "Audio" },
];
const inFilter = (k: DriveKind, f: Filter) =>
  f === "photos" ? k === "photo" : f === "videos" ? k === "video" : f === "audio" ? k === "audio" : f === "docs" ? ["pdf", "doc", "sheet", "slides", "zip", "other"].includes(k) : true;

const KIND_LOOK: Record<DriveKind, { tint: string; ink: string; label: string; icon: ReactNode }> = {
  photo: { tint: "#eef2ff", ink: "#4338ca", label: "Photo", icon: <ImageIcon className="h-6 w-6" /> },
  video: { tint: "#fdf2f8", ink: "#be185d", label: "Video", icon: <Film className="h-6 w-6" /> },
  audio: { tint: "#fff7ed", ink: "#c2410c", label: "Audio", icon: <Music className="h-6 w-6" /> },
  pdf: { tint: "#fef2f2", ink: "#b91c1c", label: "PDF", icon: <FileText className="h-6 w-6" /> },
  doc: { tint: "#eff6ff", ink: "#1d4ed8", label: "Document", icon: <FileText className="h-6 w-6" /> },
  sheet: { tint: "#ecfdf5", ink: "#047857", label: "Sheet", icon: <FileText className="h-6 w-6" /> },
  slides: { tint: "#fffbeb", ink: "#b45309", label: "Slides", icon: <Presentation className="h-6 w-6" /> },
  zip: { tint: "#f1f5f9", ink: "#334155", label: "Archive", icon: <FileIcon className="h-6 w-6" /> },
  other: { tint: "#f1f5f9", ink: "#334155", label: "File", icon: <FileIcon className="h-6 w-6" /> },
};
const ext = (name: string) => (name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] || "").toUpperCase();
const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }); };

/** Sends one file straight to storage with progress; resolves when it has landed. */
function putFile(url: string, file: File, type: string, onProgress: (sent: number) => void, onAbort: (abort: () => void) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 413 ? "too-big" : `status ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("cancelled"));
    onAbort(() => xhr.abort());
    xhr.send(file);
  });
}

export default function DriveApp({ files, setFiles, say, token, onReadWithAI }: Props) {
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState(FREE_STORAGE_BYTES);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [folder, setFolder] = useState<string>("");
  const [sort, setSort] = useState<Sort>("new");
  const [view, setView] = useState<"grid" | "list">(() => { try { return localStorage.getItem("drive-view") === "list" ? "list" : "grid"; } catch { return "grid"; } });
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState("");
  const selecting = picked.size > 0;

  useEffect(() => { try { localStorage.setItem("drive-view", view); } catch { /* private mode */ } }, [view]);
  useEffect(() => {
    if (!token) return;
    let live = true;
    fetch(`${API_BASE}/api/lifehub/drive/quota`, { headers: auth })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && Number(j?.limit) > 0) setLimit(Number(j.limit)); }).catch(() => {});
    return () => { live = false; };
  }, [token, auth]);

  const used = driveBytesUsed(files);
  const meter = driveMeter(used, limit);
  const folders = driveFolders(files);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = files.filter((f) => (filter !== "starred" || f.starred) && inFilter(driveKind(f), filter)
      && (!folder || (f.folder || "") === folder) && (!q || f.name.toLowerCase().includes(q) || (f.folder || "").toLowerCase().includes(q)));
    const by: Record<Sort, (a: DriveFile, b: DriveFile) => number> = {
      new: (a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""),
      old: (a, b) => (a.uploadedAt || "").localeCompare(b.uploadedAt || ""),
      name: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }),
      size: (a, b) => b.size - a.size,
    };
    return [...list].sort(by[sort]);
  }, [files, query, filter, folder, sort]);

  /** A short-lived signed link for a file, reusing one already held. */
  const linkFor = async (f: DriveFile): Promise<string | null> => {
    if (urls[f.id]) return urls[f.id];
    if (!token) return null;
    const res = await fetch(`${API_BASE}/api/lifehub/drive/url`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ path: f.path }) }).catch(() => null);
    const j = res ? await res.json().catch(() => null) : null;
    if (!j?.url) return null;
    setUrls((u) => ({ ...u, [f.id]: j.url }));
    return j.url as string;
  };
  // Picture thumbnails for what is on screen (the first 60 pictures), fetched quietly.
  useEffect(() => {
    if (!token) return;
    const need = shown.filter((f) => driveKind(f) === "photo" && !urls[f.id]).slice(0, 60);
    need.forEach((f) => { void linkFor(f); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, token]);

  // ───────── Uploading ─────────
  const upload = async (list: FileList | File[] | null) => {
    const chosen = Array.from(list || []);
    if (!chosen.length) return;
    if (!token) { say("Sign in again to upload to Drive."); return; }
    let usedNow = driveBytesUsed(files);
    const add = chosen.map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, name: file.name, size: file.size, sent: 0, state: "up" as const }));
    setJobs((j) => [...add, ...j.filter((x) => x.state === "up")]);
    const patch = (key: string, p: Partial<Job>) => setJobs((all) => all.map((x) => (x.key === key ? { ...x, ...p } : x)));
    let landed = 0;
    for (const [i, file] of chosen.entries()) {
      const key = add[i].key;
      try {
        const res = await fetch(`${API_BASE}/api/lifehub/drive/upload-url`, {
          method: "POST", headers: { "Content-Type": "application/json", ...auth },
          body: JSON.stringify({ name: file.name, size: file.size, type: file.type, usedBytes: usedNow }),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.signedUrl) { patch(key, { state: "error", note: j?.message || "Couldn't start the upload." }); continue; }
        await putFile(j.signedUrl, file, j.contentType, (sent) => patch(key, { sent }), (abort) => patch(key, { abort }));
        const meta: DriveFile = { id: j.id, path: j.path, name: j.name || file.name, size: file.size, contentType: j.contentType, uploadedAt: j.uploadedAt || new Date().toISOString(), ...(folder ? { folder } : {}) };
        usedNow += file.size;
        landed++;
        setFiles((all) => addDriveFile(all, meta));
        patch(key, { state: "done", sent: file.size });
      } catch (e: any) {
        const why = e?.message === "cancelled" ? "Cancelled." : e?.message === "too-big" ? "Too big for your storage settings." : "Upload failed. Check your connection.";
        patch(key, { state: "error", note: why });
      }
    }
    if (landed) say(landed > 1 ? `${landed} files added to Drive.` : "Added to Drive.");
    // Finished rows clear themselves after a moment; failed ones stay so you can see why.
    setTimeout(() => setJobs((all) => all.filter((x) => x.state !== "done")), 2500);
    if (pickRef.current) pickRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files); };

  // ───────── File actions ─────────
  const del = async (ids: string[]) => {
    const gone = files.filter((f) => ids.includes(f.id));
    if (!gone.length || !window.confirm(gone.length > 1 ? `Delete ${gone.length} files? This can't be undone.` : `Delete "${gone[0].name}"? This can't be undone.`)) return;
    setFiles((all) => ids.reduce((acc, id) => removeDriveFile(acc, id), all));
    setPicked(new Set()); setOpen(null);
    if (token) for (const f of gone) await fetch(`${API_BASE}/api/lifehub/drive/delete`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ path: f.path }) }).catch(() => {});
    say(gone.length > 1 ? `${gone.length} files deleted.` : "Deleted.");
  };
  const star = (f: DriveFile) => setFiles((all) => updateDriveFile(all, f.id, { starred: !f.starred }));
  const rename = (f: DriveFile) => {
    const next = window.prompt("Rename file", f.name)?.trim();
    if (next && next !== f.name) setFiles((all) => updateDriveFile(all, f.id, { name: next }));
  };
  const move = (ids: string[]) => {
    const to = window.prompt(`Move to which folder?${folders.length ? `\nYour folders: ${folders.join(", ")}` : ""}\n(Leave empty to take out of a folder)`, folder || "");
    if (to === null) return;
    const name = to.trim().slice(0, 60);
    setFiles((all) => ids.reduce((acc, id) => updateDriveFile(acc, id, { folder: name }), all));
    setPicked(new Set());
    say(name ? `Moved to ${name}.` : "Taken out of the folder.");
  };
  const newFolder = () => {
    const name = window.prompt("New folder name")?.trim().slice(0, 60);
    if (!name) return;
    setFolder(name);
    say(`Folder "${name}" ready. Files you upload now go in it.`);
  };
  const download = async (f: DriveFile) => {
    const res = await fetch(`${API_BASE}/api/lifehub/drive/download`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ path: f.path, name: f.name }) }).catch(() => null);
    const j = res ? await res.json().catch(() => null) : null;
    const url = j?.url || (await linkFor(f));
    if (!url) { say("Couldn't download that file. Try again."); return; }
    window.open(url, "_blank", "noopener");
  };
  const share = async (f: DriveFile) => {
    const url = await linkFor(f);
    if (!url) { say("Couldn't make a link. Try again."); return; }
    try {
      if (navigator.share) await navigator.share({ title: f.name, url });
      else { await navigator.clipboard.writeText(url); say("Link copied. It works for one hour."); }
    } catch { /* closed the share sheet */ }
  };
  const readWithAI = async (f: DriveFile) => {
    if (!onReadWithAI || reading) return;
    setReading(f.id);
    try {
      const url = await linkFor(f);
      const res = url ? await fetch(url) : null;
      if (!res?.ok) throw new Error();
      onReadWithAI(f, await res.blob());
    } catch { say("Couldn't open that file to read it. Try again."); }
    setReading("");
  };
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const tap = (f: DriveFile) => (selecting ? toggle(f.id) : setOpen(f.id));

  const opened = open ? shown.find((f) => f.id === open) || files.find((f) => f.id === open) || null : null;
  const step = (d: number) => { if (!opened) return; const i = shown.findIndex((f) => f.id === opened.id); const n = shown[(i + d + shown.length) % shown.length]; if (n) setOpen(n.id); };

  const thumb = (f: DriveFile, big = true) => {
    const k = driveKind(f), look = KIND_LOOK[k];
    if (k === "photo" && urls[f.id]) return <img src={urls[f.id]} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />;
    return <span className="flex h-full w-full flex-col items-center justify-center gap-1.5" style={{ background: look.tint, color: look.ink }}>
      {look.icon}{big && <span className="text-[10px] font-black tracking-[.14em]">{ext(f.name) || look.label.toUpperCase()}</span>}
    </span>;
  };

  return <div className="space-y-4 pb-8" data-testid="drive-app" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }} onDrop={onDrop}>
    {/* Header: name, storage, upload */}
    <section className="overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#1e1b3a] via-[#2b2556] to-[#3b2f7a] p-5 text-white shadow-[0_18px_40px_-24px_rgba(30,27,58,.8)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-white/60">Arise Drive</p>
          <h2 className="mt-1 text-[28px] font-black leading-none tracking-tight">Your files</h2>
          <p className="mt-2 text-sm text-white/75">{files.length} {files.length === 1 ? "file" : "files"} · private to your account</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()} aria-label="Take a photo or video" className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12 text-white ring-1 ring-white/20 hover:bg-white/20"><Camera className="h-5 w-5" /></button>
          <button type="button" onClick={() => pickRef.current?.click()} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-[#1e1b3a] hover:bg-white/90" data-testid="drive-upload"><Upload className="h-4 w-4" />Upload</button>
        </div>
      </div>
      <div className="mt-5" data-testid="drive-meter">
        <div className="flex items-baseline justify-between text-xs font-bold text-white/80"><span><b className="text-base font-black text-white">{meter.used}</b> used</span><span>{meter.left} free of {meter.total}</span></div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15" role="meter" aria-label="Drive storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter.percent}>
          <div className={`h-full rounded-full transition-[width] ${meter.nearlyFull ? "bg-amber-300" : "bg-gradient-to-r from-sky-300 to-violet-300"}`} style={{ width: `${meter.percent}%` }} />
        </div>
        {meter.nearlyFull && <p className="mt-2 text-xs font-semibold text-amber-200">Almost full. Add more space in Billing.</p>}
      </div>
    </section>
    <input ref={pickRef} type="file" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
    <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => void upload(e.target.files)} />

    {/* Uploads in progress */}
    {jobs.length > 0 && <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3" aria-live="polite" data-testid="drive-uploads">
      {jobs.map((j) => { const pct = j.size ? Math.round((j.sent / j.size) * 100) : 0; return <div key={j.key} className="flex items-center gap-3">
        <span className={`grid h-8 w-8 flex-none place-items-center rounded-xl ${j.state === "error" ? "bg-rose-50 text-rose-700" : j.state === "done" ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}>
          {j.state === "up" ? <Loader2 className="h-4 w-4 animate-spin" /> : j.state === "done" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-2 text-sm"><span className="truncate font-semibold text-slate-800">{j.name}</span><span className="flex-none text-xs font-bold tabular-nums text-slate-500">{j.state === "error" ? "" : `${pct}% · ${formatBytes(j.size)}`}</span></div>
          {j.state === "error" ? <p className="text-xs font-semibold text-rose-700">{j.note}</p>
            : <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600 transition-[width]" style={{ width: `${pct}%` }} /></div>}
        </div>
        {j.state === "up" && j.abort ? <button type="button" onClick={j.abort} className="text-xs font-bold text-slate-500 hover:text-slate-800">Cancel</button>
          : j.state === "error" && <button type="button" onClick={() => setJobs((all) => all.filter((x) => x.key !== j.key))} aria-label="Dismiss" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
      </div>; })}
    </section>}

    {/* Search, sort, view */}
    <div className="flex items-center gap-2">
      <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 focus-within:border-violet-400">
        <Search className="h-4 w-4 flex-none text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your files" aria-label="Search your files" className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400" />
        {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-slate-400"><X className="h-4 w-4" /></button>}
      </label>
      <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort files" className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
        <option value="new">Newest</option><option value="old">Oldest</option><option value="name">Name</option><option value="size">Largest</option>
      </select>
      <button type="button" onClick={() => setView(view === "grid" ? "list" : "grid")} aria-label={view === "grid" ? "Show as a list" : "Show as a grid"} className="grid h-11 w-11 flex-none place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700">
        {view === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}</button>
    </div>

    {/* Kinds */}
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Kinds of files">
      {FILTERS.map((f) => { const n = files.filter((x) => (f.id !== "starred" || x.starred) && inFilter(driveKind(x), f.id)).length;
        return <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
          className={`inline-flex h-9 flex-none items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition ${filter === f.id ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
          {f.id === "starred" && <Star className="h-3.5 w-3.5" />}{f.label}<span className={`text-xs ${filter === f.id ? "text-white/70" : "text-slate-400"}`}>{n}</span></button>; })}
    </div>

    {/* Folders */}
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <button type="button" onClick={() => setFolder("")} className={`inline-flex h-10 flex-none items-center gap-2 rounded-xl px-3 text-sm font-bold ${!folder ? "bg-violet-100 text-violet-800" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}><Folder className="h-4 w-4" />All folders</button>
      {[...new Set([...folders, ...(folder && !folders.includes(folder) ? [folder] : [])])].map((name) =>
        <button key={name} type="button" onClick={() => setFolder(name)} className={`inline-flex h-10 flex-none items-center gap-2 rounded-xl px-3 text-sm font-bold ${folder === name ? "bg-violet-100 text-violet-800" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
          <Folder className="h-4 w-4" />{name}<span className="text-xs text-slate-400">{files.filter((f) => f.folder === name).length}</span></button>)}
      <button type="button" onClick={newFolder} className="inline-flex h-10 flex-none items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50"><FolderPlus className="h-4 w-4" />New folder</button>
    </div>

    {/* Select-many bar */}
    {selecting && <div className="sticky top-2 z-20 flex items-center gap-2 rounded-2xl bg-slate-900 p-2 pl-4 text-white shadow-lg">
      <span className="flex-1 text-sm font-bold">{picked.size} selected</span>
      <button type="button" onClick={() => move([...picked])} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold hover:bg-white/10"><Folder className="h-4 w-4" />Move</button>
      <button type="button" onClick={() => void del([...picked])} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-rose-300 hover:bg-white/10"><Trash2 className="h-4 w-4" />Delete</button>
      <button type="button" onClick={() => setPicked(new Set())} aria-label="Stop selecting" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/10"><X className="h-4 w-4" /></button>
    </div>}

    {/* Files */}
    {files.length === 0
      ? <button type="button" onClick={() => pickRef.current?.click()} className={`flex w-full flex-col items-center gap-3 rounded-[1.6rem] border-2 border-dashed px-6 py-12 text-center transition ${dragging ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300"}`}>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Upload className="h-6 w-6" /></span>
          <span className="text-lg font-black text-slate-900">Drop files here or tap to upload</span>
          <span className="max-w-xs text-sm text-slate-500">Photos, videos, PDFs, documents, anything. Up to 5 GB a file.</span>
        </button>
      : shown.length === 0
        ? <p className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">No files match. Try another search or kind.</p>
        : view === "grid"
          ? <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="drive-grid">
              {shown.map((f) => <li key={f.id} className="relative">
                <button type="button" onClick={() => tap(f)} onContextMenu={(e) => { e.preventDefault(); toggle(f.id); }}
                  className={`group block w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:shadow-md ${picked.has(f.id) ? "border-violet-500 ring-2 ring-violet-500" : "border-slate-200"}`}>
                  <span className="block aspect-[4/3] overflow-hidden bg-slate-50">{thumb(f)}</span>
                  <span className="block px-3 py-2.5">
                    <span className="block truncate text-sm font-bold text-slate-900">{f.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{formatBytes(f.size)}{f.uploadedAt ? ` · ${when(f.uploadedAt)}` : ""}{f.folder ? ` · ${f.folder}` : ""}</span>
                  </span>
                </button>
                <button type="button" onClick={() => toggle(f.id)} aria-label={picked.has(f.id) ? `Unselect ${f.name}` : `Select ${f.name}`} aria-pressed={picked.has(f.id)}
                  className={`absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full border-2 transition ${picked.has(f.id) ? "border-violet-600 bg-violet-600 text-white" : "border-white/90 bg-black/25 text-transparent hover:text-white"}`}><Check className="h-4 w-4" /></button>
                {f.starred && <Star className="absolute right-2 top-2 h-5 w-5 fill-amber-400 text-amber-400 drop-shadow" />}
              </li>)}
            </ul>
          : <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="drive-list">
              {shown.map((f) => <li key={f.id} className={`flex items-center gap-3 px-3 py-2.5 ${picked.has(f.id) ? "bg-violet-50" : ""}`}>
                <button type="button" onClick={() => toggle(f.id)} aria-label={picked.has(f.id) ? `Unselect ${f.name}` : `Select ${f.name}`} aria-pressed={picked.has(f.id)}
                  className={`grid h-6 w-6 flex-none place-items-center rounded-full border-2 ${picked.has(f.id) ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 text-transparent"}`}><Check className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => tap(f)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="block h-11 w-11 flex-none overflow-hidden rounded-xl">{thumb(f, false)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold text-slate-900">{f.name}</span>
                    <span className="block truncate text-xs text-slate-500">{KIND_LOOK[driveKind(f)].label} · {formatBytes(f.size)}{f.uploadedAt ? ` · ${when(f.uploadedAt)}` : ""}{f.folder ? ` · ${f.folder}` : ""}</span></span>
                </button>
                <button type="button" onClick={() => star(f)} aria-label={f.starred ? "Unstar" : "Star"} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><Star className={`h-4 w-4 ${f.starred ? "fill-amber-400 text-amber-400" : ""}`} /></button>
              </li>)}
            </ul>}
    {files.length > 0 && <p className="text-center text-xs text-slate-400">Drag files anywhere here to upload. Long-press or right-click a file to select it.</p>}

    {/* Viewer */}
    {opened && <Viewer f={opened} url={urls[opened.id]} ensure={() => void linkFor(opened)} close={() => setOpen(null)} prev={() => step(-1)} next={() => step(1)} many={shown.length > 1}
      star={() => star(opened)} rename={() => rename(opened)} move={() => move([opened.id])} remove={() => void del([opened.id])} download={() => void download(opened)} share={() => void share(opened)}
      readWithAI={onReadWithAI ? () => void readWithAI(opened) : undefined} reading={reading === opened.id} />}
    {dragging && <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-violet-900/30 backdrop-blur-sm"><span className="rounded-3xl bg-white px-6 py-4 text-lg font-black text-violet-800 shadow-2xl">Drop to upload</span></div>}
  </div>;
}

function Viewer({ f, url, ensure, close, prev, next, many, star, rename, move, remove, download, share, readWithAI, reading }: {
  f: DriveFile; url?: string; ensure: () => void; close: () => void; prev: () => void; next: () => void; many: boolean;
  star: () => void; rename: () => void; move: () => void; remove: () => void; download: () => void; share: () => void; readWithAI?: () => void; reading: boolean;
}) {
  useEffect(() => { ensure(); }, [f.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); if (e.key === "ArrowLeft") prev(); if (e.key === "ArrowRight") next(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [close, prev, next]);
  const k = driveKind(f), look = KIND_LOOK[k];
  const Act = ({ label, onClick, children, danger }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean }) =>
    <button type="button" onClick={onClick} className={`flex min-w-[4.2rem] flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold ${danger ? "text-rose-300 hover:bg-rose-500/15" : "text-white/85 hover:bg-white/10"}`}>{children}{label}</button>;
  return <div className="fixed inset-0 z-[80] flex flex-col bg-[#0b0a14] text-white" role="dialog" aria-modal="true" aria-label={f.name} data-testid="drive-viewer">
    <div className="flex items-center gap-2 px-3 pb-2 pt-[max(.75rem,env(safe-area-inset-top))]">
      <button type="button" onClick={close} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10"><X className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-bold">{f.name}</p><p className="truncate text-xs text-white/55">{look.label} · {formatBytes(f.size)}{f.folder ? ` · ${f.folder}` : ""}</p></div>
      <button type="button" onClick={star} aria-label={f.starred ? "Unstar" : "Star"} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10"><Star className={`h-5 w-5 ${f.starred ? "fill-amber-400 text-amber-400" : ""}`} /></button>
    </div>
    <div className="relative min-h-0 flex-1">
      <div className="absolute inset-0 grid place-items-center overflow-auto p-3">
        {!url ? <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          : k === "photo" ? <img src={url} alt={f.name} className="max-h-full max-w-full rounded-xl object-contain" />
          : k === "video" ? <video src={url} controls playsInline className="max-h-full max-w-full rounded-xl bg-black" />
          : k === "audio" ? <div className="w-full max-w-md rounded-3xl p-6 text-center" style={{ background: look.tint, color: look.ink }}><Music className="mx-auto mb-3 h-10 w-10" /><p className="mb-4 truncate font-bold">{f.name}</p><audio src={url} controls className="w-full" /></div>
          : k === "pdf" ? <iframe src={url} title={f.name} className="h-full w-full rounded-xl bg-white" />
          : <div className="grid w-full max-w-sm place-items-center gap-3 rounded-3xl p-8 text-center" style={{ background: look.tint, color: look.ink }}>
              <span className="scale-150">{look.icon}</span><p className="mt-2 font-black">{ext(f.name) || look.label}</p><p className="text-sm opacity-80">Open or download it to view.</p>
              <button type="button" onClick={() => window.open(url, "_blank", "noopener")} className="mt-1 rounded-full bg-white px-4 py-2 text-sm font-bold" style={{ color: look.ink }}>Open</button></div>}
      </div>
      {many && <>
        <button type="button" onClick={prev} aria-label="Previous file" className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 hover:bg-black/70"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" onClick={next} aria-label="Next file" className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 hover:bg-black/70"><ChevronRight className="h-5 w-5" /></button>
      </>}
    </div>
    <div className="flex justify-center gap-1 overflow-x-auto px-2 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2">
      <Act label="Download" onClick={download}><Download className="h-5 w-5" /></Act>
      <Act label="Share" onClick={share}><Share2 className="h-5 w-5" /></Act>
      <Act label="Rename" onClick={rename}><Pencil className="h-5 w-5" /></Act>
      <Act label="Move" onClick={move}><Folder className="h-5 w-5" /></Act>
      {readWithAI && <Act label={reading ? "Opening…" : "Read with AI"} onClick={readWithAI}><Sparkles className="h-5 w-5" /></Act>}
      <Act label="Delete" onClick={remove} danger><Trash2 className="h-5 w-5" /></Act>
    </div>
  </div>;
}
