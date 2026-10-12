// The Drive app (App Store add-on, shared/driveApp.ts): upload photos from a camera roll or
// device, browse them, delete them. Metadata lives in family.drive; the actual bytes live in
// Supabase Storage via server/driveApp.ts's routes, signed URLs only.
import { useRef, useState } from "react";
import { Upload, Trash2, ImageOff } from "lucide-react";
import { addDriveFile, removeDriveFile, driveBytesUsed, FREE_STORAGE_BYTES, type DriveFile } from "@shared/driveApp";
import { API_BASE } from "@/lib/queryClient";

type Props = {
  files: DriveFile[];
  setFiles: (update: (all: DriveFile[]) => DriveFile[]) => void;
  say: (msg: string) => void;
  /** This account's own A.R.I.S.E. session token (see AuthContext) — the server checks for it as
   *  a Bearer header, not a cookie, so every request here has to attach it itself. */
  token: string | null;
};

const fmtBytes = (n: number) => n >= 1024 * 1024 * 1024 ? `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB` : `${(n / (1024 * 1024)).toFixed(0)} MB`;

export default function DriveApp({ files, setFiles, say, token }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const used = driveBytesUsed(files);
  const pct = Math.min(100, Math.round((used / FREE_STORAGE_BYTES) * 100));

  const pickFiles = () => inputRef.current?.click();

  const upload = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    if (!token) { say("Sign in again to upload to Drive."); return; }
    setBusy(true);
    try {
      for (const file of Array.from(fileList).slice(0, 10)) {
        const body = await file.arrayBuffer();
        const res = await fetch(`${API_BASE}/api/lifehub/drive/upload`, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream", "x-drive-used-bytes": String(driveBytesUsed(files)), "x-drive-name": encodeURIComponent(file.name), Authorization: `Bearer ${token}` },
          body,
        });
        if (!res.ok) { const j = await res.json().catch(() => null); say(j?.message || "Couldn't upload that photo."); continue; }
        const meta: DriveFile = await res.json();
        setFiles((all) => addDriveFile(all, meta));
      }
      say("Photos added to Drive.");
    } catch {
      say("Couldn't upload. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const view = async (f: DriveFile) => {
    if (urls[f.id] || !token) return;
    const res = await fetch(`${API_BASE}/api/lifehub/drive/url`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ path: f.path }) });
    const j = await res.json().catch(() => null);
    if (j?.url) setUrls((u) => ({ ...u, [f.id]: j.url }));
  };

  const del = async (f: DriveFile) => {
    setFiles((all) => removeDriveFile(all, f.id));
    if (token) await fetch(`${API_BASE}/api/lifehub/drive/delete`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ path: f.path }) }).catch(() => {});
    say("Photo deleted.");
  };

  return <div className="space-y-4" data-testid="drive-app">
    <div>
      <h2 className="text-lg font-black text-slate-900">Drive</h2>
      <p className="mt-1 text-sm text-slate-500">Upload photos from your camera roll or computer. Private to your hub.</p>
    </div>
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between text-xs font-bold text-slate-600"><span>{fmtBytes(used)} used</span><span>{fmtBytes(FREE_STORAGE_BYTES)} free</span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#292446]" style={{ width: `${pct}%` }} /></div>
      {pct >= 90 && <p className="mt-1.5 text-xs font-semibold text-amber-700">Almost out of free storage. Add more space in Billing.</p>}
    </div>
    {/* No `capture`: that attribute opens the camera and offers nothing else, so on a phone there
        was no way to pick a photo already on it, or one in Files, iCloud or Google Drive — only to
        take a new picture. The extensions are spelled out because an iPhone HEIC often arrives
        with no MIME type at all, which `image/*` alone then filters out of the picker. */}
    <input ref={inputRef} type="file" accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
    <button type="button" onClick={pickFiles} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#292446] px-4 text-sm font-bold text-white disabled:opacity-60" data-testid="drive-upload">
      <Upload size={16} /> {busy ? "Uploading…" : "Upload photos"}
    </button>
    {files.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500"><ImageOff className="mx-auto mb-2 h-6 w-6 text-slate-300" />No photos yet.</p>
      : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{files.map((f) => <div key={f.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white" onMouseEnter={() => view(f)}>
        {urls[f.id]
          ? <img src={urls[f.id]} alt={f.name} className="aspect-square w-full object-cover" loading="lazy" />
          : <button type="button" onClick={() => view(f)} className="flex aspect-square w-full items-center justify-center bg-slate-100 text-xs font-semibold text-slate-400">{f.name}</button>}
        <button type="button" onClick={() => del(f)} aria-label={`Delete ${f.name}`} className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"><Trash2 size={14} /></button>
      </div>)}</div>}
  </div>;
}
