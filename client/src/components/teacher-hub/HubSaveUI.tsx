// What the teacher sees about saving: a status in the header, a notice when a save did not go
// through, the question when two devices changed the Hub, how full the Hub is, and the copies.
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, RotateCcw, Save } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import type { SaveView } from "@/lib/hubSaver";
import { blockMessage, sizeLevel, sizePercent } from "@shared/hubSave";
import type { Workspace } from "@shared/teacherHub";
import { HubModal } from "./HubModal";

/** Saves a copy of the whole Hub to the phone or computer, as a file. */
export function downloadHubCopy(workspace: Workspace) {
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `teacher-hub-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function SaveBadge({ view }: { view: SaveView }) {
  const bad = view.kind === "retrying" || view.kind === "blocked";
  const busy = view.kind === "waiting" || view.kind === "saving";
  const text = bad ? "Not saved" : busy ? "Saving…" : "Saved";
  return (
    <div
      role="status"
      title={text}
      aria-label={text}
      data-testid="hub-save-status"
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium sm:px-3 ${bad ? "bg-red-50 font-semibold text-red-700" : "bg-slate-100 text-slate-600"}`}
    >
      {bad ? <AlertTriangle className="h-4 w-4" /> : busy ? <Save className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
      <span className={bad ? "" : "hidden sm:inline"}>{text}</span>
    </div>
  );
}

const bar = "pointer-events-auto flex w-full max-w-xl flex-col gap-2 rounded-2xl border p-3 text-sm shadow-xl sm:flex-row sm:items-center";
const button = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold";

/** Shown at the bottom of the screen while a save is not going through. The two-devices question has its own pop-up. */
export function SaveNotice({ view, onRetry, onDownload }: { view: SaveView; onRetry(): void; onDownload(): void }) {
  if (view.kind === "retrying") {
    return (
      <div role="alert" className={`${bar} border-red-200 bg-red-50 text-red-900`} data-testid="hub-save-notice">
        <span className="flex-1"><strong>Not saved yet.</strong> {view.reason} What you changed is kept on this screen and will save by itself when it can.</span>
        <button type="button" onClick={onRetry} className={`${button} bg-red-700 text-white hover:bg-red-800`}>Try now</button>
      </div>
    );
  }
  if (view.kind !== "blocked" || view.block === "conflict") return null;
  const message = blockMessage(view.block, view.message);
  return (
    <div role="alert" className={`${bar} border-red-200 bg-red-50 text-red-900`} data-testid="hub-save-notice">
      <span className="flex-1"><strong>Not saved.</strong> {message}</span>
      <span className="flex flex-wrap gap-2">
        {(view.block === "seats_full" || view.block === "plan") && <a href="#/billing" className={`${button} bg-red-700 text-white hover:bg-red-800`}>Your plan</a>}
        {view.block === "rejected" && <button type="button" onClick={onRetry} className={`${button} bg-red-700 text-white hover:bg-red-800`}>Try again</button>}
        <button type="button" onClick={onDownload} className={`${button} border border-red-300 bg-white text-red-800 hover:bg-red-100`}><Download className="h-4 w-4" /> Download a copy</button>
      </span>
    </div>
  );
}

/** Two devices changed the Hub. Nothing is written over until the teacher picks. */
export function ConflictDialog({ onUseNewest, onKeepMine, onDownload }: { onUseNewest(): Promise<void>; onKeepMine(): void; onDownload(): void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function newest() {
    setBusy(true);
    setError("");
    try {
      await onUseNewest();
    } catch (err: any) {
      setError(err?.message || "Could not load the newest copy. Try again.");
      setBusy(false);
    }
  }
  return (
    <HubModal
      title="Your Hub was changed somewhere else"
      label="Choose which copy of your Hub to keep"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" data-autofocus onClick={newest} disabled={busy} className={`${button} bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-60`} data-testid="hub-use-newest">
            {busy ? "Opening…" : "Use the newest copy"}
          </button>
          <button type="button" onClick={onKeepMine} disabled={busy} className={`${button} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`} data-testid="hub-keep-mine">Keep what is on this screen</button>
        </div>
      }
    >
      <div className="space-y-3 text-sm leading-6 text-slate-700">
        <p>Another phone or computer saved changes to your Hub while this screen was open. Pick the copy to keep. Nothing is deleted until you choose.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Use the newest copy</strong> shows what was saved on the other device. What you changed on this screen since then is dropped.</li>
          <li><strong>Keep what is on this screen</strong> saves this screen's copy over the other one.</li>
        </ul>
        <button type="button" onClick={onDownload} className="inline-flex min-h-11 items-center gap-2 font-semibold text-teal-800 underline decoration-teal-200 underline-offset-4"><Download className="h-4 w-4" /> Download this screen's copy first</button>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-red-700" role="alert">{error}</p>}
      </div>
    </HubModal>
  );
}

/** A banner once the Hub is getting full. */
export function SizeNotice({ bytes, onDownload }: { bytes: number; onDownload(): void }) {
  const level = sizeLevel(bytes);
  if (level === "ok") return null;
  const pct = sizePercent(bytes);
  const hot = level !== "warn";
  return (
    <div className={`flex flex-col gap-2 rounded-2xl border p-4 text-sm sm:flex-row sm:items-center sm:justify-between ${hot ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-950"}`} role="status" data-testid="hub-size-notice">
      <span>
        <strong>Your Hub is {level === "full" ? "full" : `${pct}% full`}.</strong>{" "}
        {level === "full" ? "New changes can't be saved until there is room." : "When it is full, new changes can't be saved."} Deleting old attendance, notes and saved emails makes room.
      </span>
      <button type="button" onClick={onDownload} className={`${button} border bg-white ${hot ? "border-red-300 text-red-800" : "border-amber-300 text-amber-900"}`}><Download className="h-4 w-4" /> Download a copy</button>
    </div>
  );
}

type Copy = { day: string; kind: "daily" | "restore"; students: number; savedAt: string };

function dayLabel(day: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Under "Customize tabs": how full the Hub is, a copy to keep, and the daily copies the site keeps. */
export function HubDataPanel({ workspace, bytes, token, onAdopt }: { workspace: Workspace; bytes: number; token: string | null; onAdopt(workspace: Workspace, updatedAt: string | null): void }) {
  const [copies, setCopies] = useState<Copy[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const pct = sizePercent(bytes);
  const level = sizeLevel(bytes);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/teacher-hub/backups`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok || !data) throw new Error(data?.message || "Could not look up your saved copies.");
        return data;
      })
      .then((data) => { if (!cancelled) { setAvailable(data.available !== false); setCopies(Array.isArray(data.backups) ? data.backups : []); } })
      .catch((err) => { if (!cancelled) setError(err.message || "Could not look up your saved copies."); });
    return () => { cancelled = true; };
  }, [token, done]);

  async function bringBack(copy: Copy) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${API_BASE}/api/teacher-hub/backups/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ day: copy.day, kind: copy.kind }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.workspace) throw new Error(data?.message || "Could not bring that copy back.");
      onAdopt(data.workspace, typeof data.updatedAt === "string" ? data.updatedAt : null);
      setAsking(null);
      setDone(`Brought back the copy from ${dayLabel(copy.day)}. What was here before is kept as a copy too.`);
    } catch (err: any) {
      setError(err?.message || "Could not bring that copy back.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-5" data-testid="hub-data-panel">
      <h3 className="text-sm font-semibold text-slate-900">Your data</h3>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-600"><span>Space used</span><span className={level === "ok" ? "" : "font-semibold text-red-700"}>{pct}% full</span></div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="How full your Hub is">
          <div className={`h-full rounded-full ${level === "ok" ? "bg-teal-600" : level === "warn" ? "bg-amber-500" : "bg-red-600"}`} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      </div>
      <button type="button" onClick={() => downloadHubCopy(workspace)} className={`${button} mt-3 border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`} data-testid="hub-download"><Download className="h-4 w-4" /> Download a copy of my Hub</button>

      <h4 className="mt-5 text-sm font-semibold text-slate-900">Earlier copies</h4>
      <p className="mt-1 text-xs leading-5 text-slate-500">Before the first change each day, a copy is kept for two weeks. Bring one back if something went wrong.</p>
      {done && <p className="mt-2 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900" role="status">{done}</p>}
      {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      {copies === null && !error && <p className="mt-2 text-sm text-slate-500">Looking…</p>}
      {copies !== null && !available && <p className="mt-2 text-sm text-slate-500">Daily copies are not switched on yet. The site owner can turn them on from the setup notice.</p>}
      {copies !== null && available && !copies.length && <p className="mt-2 text-sm text-slate-500">Copies show up here after your first day of changes.</p>}
      {copies !== null && available && copies.length > 0 && (
        <ul className="mt-2 space-y-2">
          {copies.map((copy) => {
            const key = `${copy.day}-${copy.kind}`;
            return (
              <li key={key} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900">{copy.kind === "restore" ? `Just before you brought a copy back (${dayLabel(copy.day)})` : dayLabel(copy.day)}</span>
                    <span className="block text-xs text-slate-500">{copy.students} {copy.students === 1 ? "student" : "students"}</span>
                  </span>
                  {asking !== key && <button type="button" onClick={() => { setAsking(key); setDone(""); }} className={`${button} border border-slate-200 bg-white px-3 text-slate-800 hover:bg-slate-50`}><RotateCcw className="h-4 w-4" /> Bring back</button>}
                </div>
                {asking === key && (
                  <div className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-950">
                    <p>Bring back this copy? Your Hub will look the way it did then. What is in it right now is kept as a copy too, so you can undo this.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => bringBack(copy)} className={`${button} bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-60`}>{busy ? "Bringing it back…" : "Bring it back"}</button>
                      <button type="button" disabled={busy} onClick={() => setAsking(null)} className={`${button} border border-slate-200 bg-white text-slate-800`}>Cancel</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
