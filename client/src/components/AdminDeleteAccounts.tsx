// Admin: delete many accounts at once (Admin → People → Delete accounts). Pick the kinds, see the exact count
// and a few names, type DELETE and the number, and it runs. Admins, your own account and sample (App Review)
// accounts are never included. This can't be undone.
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

const KINDS: { id: string; label: string; detail: string }[] = [
  { id: "student", label: "Students", detail: "A.R.I.S.E. Reader students" },
  { id: "eyegazer", label: "Eye Gazers", detail: "Eye Gazer accounts" },
  { id: "teacher", label: "Teachers", detail: "Teachers and their WorkHub" },
  { id: "parent", label: "Parents", detail: "Parent accounts" },
  { id: "todo", label: "Arise To Duo & Pod+", detail: "To Duo, LifeHub and Pod+ accounts" },
];
type Preview = { count: number; byKind: Record<string, number>; sample: string[] };
type Job = { running: boolean; total: number; done: number; deleted?: number; blocked?: string[]; failed?: string[] };

export default function AdminDeleteAccounts() {
  const { token } = useAuth();
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [kinds, setKinds] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [open, setOpen] = useState(false);
  const poll = () => fetch(`${API_BASE}/api/admin/accounts/bulk-delete`, { headers: auth, cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.total) setJob(j); return j; }).catch(() => null);
  useEffect(() => { void poll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!job?.running) return; const t = setInterval(() => void poll(), 1500); return () => clearInterval(t); }, [job?.running]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPreview(null); setTyped(""); setError("");
    if (!kinds.length) return;
    let live = true;
    fetch(`${API_BASE}/api/admin/accounts/bulk-preview`, { method: "POST", headers: auth, body: JSON.stringify({ kinds }) })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.message); if (live) setPreview(d); }).catch((e) => live && setError(e.message || "Couldn't count."));
    return () => { live = false; };
  }, [kinds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const phrase = preview ? `DELETE ${preview.count}` : "";
  const run = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/accounts/bulk-delete`, { method: "POST", headers: auth, body: JSON.stringify({ kinds, confirm: typed.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "Couldn't start.");
      setJob({ running: true, total: d.total, done: 0 }); setKinds([]);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  if (!open && !job?.running) return <div className="flex justify-end"><button type="button" onClick={() => setOpen(true)} className="min-h-9 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-rose-700" data-testid="admin-delete-open">Delete accounts…</button></div>;
  return <section className="rounded-2xl border border-rose-200 bg-card p-4" data-testid="admin-delete-accounts">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700"><Trash2 className="h-5 w-5" /></span>
      <div className="min-w-0"><h2 className="text-base font-bold">Delete accounts</h2>
        <p className="text-sm text-muted-foreground">Delete every account of the kinds you pick, across Arise To Duo, Pod+, A.R.I.S.E. Reader and Eye Gazer, with everything that belongs to them. Admins, your own account and sample (App Review) accounts are never included. This can't be undone.</p></div>
    </div>
    {job && (job.running || job.total > 0) && <div className="mt-3 rounded-xl bg-muted px-3 py-2 text-sm" role="status" data-testid="admin-delete-progress">
      {job.running ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Deleting… {job.done} of {job.total}</span>
        : <span>Done: {job.deleted ?? 0} of {job.total} deleted.{job.blocked?.length ? ` ${job.blocked.length} couldn't be deleted yet (still linked to something; archive them instead): ${job.blocked.slice(0, 5).join(", ")}${job.blocked.length > 5 ? "…" : ""}.` : ""}{job.failed?.length ? ` ${job.failed.length} failed: ${job.failed.slice(0, 5).join(", ")}.` : ""}</span>}
    </div>}
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Which accounts">
      {KINDS.map((k) => { const on = kinds.includes(k.id); return <label key={k.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${on ? "border-rose-300 bg-rose-50/60" : "border-border"}`}>
        <input type="checkbox" checked={on} disabled={job?.running} onChange={() => setKinds((x) => (on ? x.filter((y) => y !== k.id) : [...x, k.id]))} className="h-4 w-4" />
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{k.label}{preview && on ? <span className="ml-1 font-normal text-muted-foreground">· {preview.byKind[k.id] ?? 0}</span> : null}</span><span className="block text-xs text-muted-foreground">{k.detail}</span></span>
      </label>; })}
    </div>
    {preview && preview.count > 0 && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-rose-900"><AlertTriangle className="h-4 w-4" />{preview.count} account{preview.count === 1 ? "" : "s"} will be deleted for good</p>
      {preview.sample.length > 0 && <p className="mt-1 text-xs text-rose-900/80">Including {preview.sample.join(", ")}{preview.count > preview.sample.length ? "…" : ""}</p>}
      <label className="mt-3 block text-xs font-semibold text-rose-900">Type <span className="font-mono">{phrase}</span> to confirm
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className="mt-1 block min-h-11 w-full rounded-xl border border-rose-300 bg-white px-3 font-mono text-sm" aria-label="Confirm" data-testid="admin-delete-confirm" /></label>
      <button type="button" disabled={busy || typed.trim() !== phrase} onClick={() => void run()} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-40" data-testid="admin-delete-go"><Trash2 className="h-4 w-4" />Delete {preview.count} account{preview.count === 1 ? "" : "s"}</button>
    </div>}
    {preview && preview.count === 0 && <p className="mt-3 text-sm text-muted-foreground">No accounts of those kinds.</p>}
    {error && <p className="mt-2 text-sm text-rose-700" role="alert">{error}</p>}
  </section>;
}
