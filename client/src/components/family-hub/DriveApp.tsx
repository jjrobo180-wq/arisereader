// The Drive app (App Store add-on, shared/driveApp.ts): upload files — photos, PDFs, documents —
// from a phone or computer, browse them, open them, delete them. Metadata lives in family.drive; the actual bytes live in
// Supabase Storage via server/driveApp.ts's routes, signed URLs only.
import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, ImageOff, FileText } from "lucide-react";
import { addDriveFile, removeDriveFile, driveBytesUsed, driveMeter, FREE_STORAGE_BYTES, type DriveFile } from "@shared/driveApp";
import { API_BASE } from "@/lib/queryClient";

type Props = {
  files: DriveFile[];
  setFiles: (update: (all: DriveFile[]) => DriveFile[]) => void;
  say: (msg: string) => void;
  /** This account's own A.R.I.S.E. session token (see AuthContext) — the server checks for it as
   *  a Bearer header, not a cookie, so every request here has to attach it itself. */
  token: string | null;
};


/** A short word for what a file is, for the tile that stands in for a thumbnail. */
function kindOf(f: DriveFile): string {
  const byName = (f.name.match(/\.([A-Za-z0-9]{1,5})$/)?.[1] || "").toUpperCase();
  if (byName) return byName;
  const t = f.contentType || "";
  if (t.includes("pdf")) return "PDF";
  if (t.startsWith("video/")) return "VIDEO";
  if (t.startsWith("audio/")) return "AUDIO";
  if (t.startsWith("text/")) return "TEXT";
  return "FILE";
}

export default function DriveApp({ files, setFiles, say, token }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const used = driveBytesUsed(files);
  // The account's whole Drive space (free plus any storage add-on), from the server.
  const [limit, setLimit] = useState(FREE_STORAGE_BYTES);
  useEffect(() => {
    if (!token) return;
    let live = true;
    fetch(`${API_BASE}/api/lifehub/drive/quota`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && Number(j?.limit) > 0) setLimit(Number(j.limit)); }).catch(() => {});
    return () => { live = false; };
  }, [token]);
  const meter = driveMeter(used, limit);
  const [progress, setProgress] = useState("");

  const pickFiles = () => inputRef.current?.click();

  const upload = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    if (!token) { say("Sign in again to upload to Drive."); return; }
    setBusy(true);
    // Counted up as each file lands, so the next one is checked against the space really left.
    let usedNow = driveBytesUsed(files);
    const picked = Array.from(fileList).slice(0, 10);
    try {
      for (const [i, file] of picked.entries()) {
        setProgress(picked.length > 1 ? `Uploading ${i + 1} of ${picked.length}…` : "Uploading…");
        const body = await file.arrayBuffer();
        const res = await fetch(`${API_BASE}/api/lifehub/drive/upload`, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream", "x-drive-used-bytes": String(usedNow), "x-drive-name": encodeURIComponent(file.name), Authorization: `Bearer ${token}` },
          body,
        });
        if (!res.ok) { const j = await res.json().catch(() => null); say(j?.message || "Couldn't upload that file."); continue; }
        const meta: DriveFile = await res.json();
        const sized = { ...meta, size: Number(meta.size) > 0 ? Number(meta.size) : file.size };
        usedNow += sized.size;
        setFiles((all) => addDriveFile(all, sized));
      }
      say(fileList.length > 1 ? "Files added to Drive." : "Added to Drive.");
    } catch {
      say("Couldn't upload. Check your connection and try again.");
    } finally {
      setBusy(false);
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  /** Fetches a short-lived signed link for a file, reusing one already held. */
  const linkFor = async (f: DriveFile): Promise<string | null> => {
    if (urls[f.id]) return urls[f.id];
    if (!token) return null;
    const res = await fetch(`${API_BASE}/api/lifehub/drive/url`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ path: f.path }) });
    const j = await res.json().catch(() => null);
    if (!j?.url) return null;
    setUrls((u) => ({ ...u, [f.id]: j.url }));
    return j.url as string;
  };

  const view = (f: DriveFile) => { if (!urls[f.id]) void linkFor(f); };

  /** Opens a file that isn't a picture — a PDF, a document — in a new tab. */
  const open = async (f: DriveFile) => {
    const url = await linkFor(f);
    if (!url) { say("Couldn't open that file. Try again."); return; }
    window.open(url, "_blank", "noopener");
  };

  const del = async (f: DriveFile) => {
    setFiles((all) => removeDriveFile(all, f.id));
    if (token) await fetch(`${API_BASE}/api/lifehub/drive/delete`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ path: f.path }) }).catch(() => {});
    say("Deleted.");
  };

  return <div className="space-y-4" data-testid="drive-app">
    <div>
      <h2 className="text-lg font-black text-slate-900">Drive</h2>
      <p className="mt-1 text-sm text-slate-500">Photos, PDFs and documents from your phone or computer. Private to your hub.</p>
    </div>
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between text-xs font-bold text-slate-600" data-testid="drive-meter"><span>{meter.used} used</span><span>{meter.left} left of {meter.total}</span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200" role="meter" aria-label="Drive storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter.percent}><div className="h-full rounded-full bg-[#292446] transition-[width]" style={{ width: `${meter.percent}%` }} /></div>
      {progress && <p className="mt-1.5 text-xs font-semibold text-slate-600" aria-live="polite">{progress}</p>}
      {meter.nearlyFull && <p className="mt-1.5 text-xs font-semibold text-amber-700">Almost out of free storage. Add more space in Billing.</p>}
    </div>
    {/* No `accept` and no `capture`. `capture` opened the camera and offered nothing else, so on a
        phone there was no way to pick anything that already existed; and narrowing `accept` to
        images is what kept PDFs and documents out. Anything the server accepts can be chosen here,
        and anything it doesn't comes back with a plain reason. */}
    <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
    <button type="button" onClick={pickFiles} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#292446] px-4 text-sm font-bold text-white disabled:opacity-60" data-testid="drive-upload">
      <Upload size={16} /> {busy ? "Uploading…" : "Upload files"}
    </button>
    {files.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500"><ImageOff className="mx-auto mb-2 h-6 w-6 text-slate-300" />Nothing here yet.</p>
      : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{files.map((f) => {
        const isImage = (f.contentType || "").startsWith("image/");
        return <div key={f.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white" onMouseEnter={() => view(f)}>
          {isImage && urls[f.id]
            ? <img src={urls[f.id]} alt={f.name} className="aspect-square w-full object-cover" loading="lazy" />
            // Everything that isn't a picture gets a card with its kind and name. Tapping fetches
            // a signed link and opens it, which is how a PDF or a Word file is read.
            : <button type="button" onClick={() => void open(f)}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 bg-slate-50 p-2 text-center hover:bg-slate-100">
                <FileText className="h-7 w-7 text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">{kindOf(f)}</span>
                <span className="line-clamp-2 break-all text-[11px] font-semibold text-slate-600">{f.name}</span>
              </button>}
          <button type="button" onClick={() => del(f)} aria-label={`Delete ${f.name}`} className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition focus:opacity-100 group-hover:opacity-100"><Trash2 size={14} /></button>
        </div>;
      })}</div>}
  </div>;
}
