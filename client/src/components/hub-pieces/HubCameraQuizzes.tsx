// Camera quizzes (quizzes taken alone with the camera on), built from the hub's own parts.
// Same as the site's NoProctorReview: what was flagged, the pictures, what happened, answer pace,
// earlier tries, and (for the teacher or admin) removing or giving back the points.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Clock3, RotateCcw, ShieldCheck, Undo2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { KitModal, Pill, Segments, fmtWhen, kit, type Which } from "./kit";

type Flag = "clear" | "review" | "high";
type Row = {
  id: string; studentId: number; studentName: string; quizTitle: string; startedAt: string; submittedAt: string | null; score: number | null; total: number | null;
  pointsAwarded: number; durationMs: number | null; leaves: number; awayMs: number; snapshotCount: number; flag: Flag; reasons: { level: "review" | "high"; text: string }[];
  voided: boolean; voidReason: string | null; snapshotsPurged: boolean;
};
type Picture = { at: string; reason: string; url: string };
type Event = { at: string; type: string; detail: Record<string, any> | null };
type Detail = { canVoid: boolean; session: Row & { answerTimes: Record<string, { first: number; changes: number }> | null; voidedAt: string | null }; timeline: Event[]; snapshots: Picture[]; earlierTries: { startedAt: string; leaves: number; snapshots: Picture[] }[] };

const FLAG: Record<Flag, { label: string; tone: "red" | "amber" | "green" }> = { high: { label: "High concern", tone: "red" }, review: { label: "Check this", tone: "amber" }, clear: { label: "Looks fine", tone: "green" } };
const LEAVE: Record<string, string> = { hidden: "switched to another tab or app", window: "clicked outside the quiz window", closed: "closed or reloaded the page", page: "went to another page in the app" };
const SHOT: Record<string, string> = { start: "Start", left: "Left the quiz", returned: "Came back", camera: "Camera back on", resumed: "Picked up again", end: "Turned in" };
const clock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const secs = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`; };
const offset = (e: { at: string; detail?: Record<string, any> | null }, start: string) => { const t = Number(e.detail?.t); return Number.isFinite(t) && t >= 0 ? t : Date.parse(e.at) - Date.parse(start); };
function device(ua?: string) {
  if (!ua) return "";
  const kind = /iPad|Tablet/i.test(ua) ? "a tablet" : /iPhone|Android.+Mobile|Mobile/i.test(ua) ? "a phone" : /Android/i.test(ua) ? "a tablet" : /CrOS/.test(ua) ? "a Chromebook" : "a computer";
  const browser = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return `on ${kind}${browser ? ` in ${browser}` : ""}`;
}
function describe(e: Event): { text: string; tone: "plain" | "warn" | "high" | "good" } {
  const d = e.detail || {};
  switch (e.type) {
    case "start": return { text: d.restarts ? `Started the quiz (try ${Number(d.restarts) + 1})` : "Started the quiz", tone: "plain" };
    case "left": return { text: `Left the quiz: ${LEAVE[d.kind] || "left the page"}`, tone: "warn" };
    case "returned": return { text: `Came back after ${secs(Number(d.ms) || 0)}`, tone: "plain" };
    case "warned": return { text: "Saw the one-time warning", tone: "plain" };
    case "copy": return { text: "Tried to copy or paste", tone: "warn" };
    case "camera_off": return { text: "The camera turned off", tone: "warn" };
    case "camera_on": return { text: "Turned the camera back on", tone: "plain" };
    case "resumed": return { text: "Picked the quiz up again after the page reloaded", tone: "plain" };
    case "stopped": return { text: "Stopped the quiz", tone: "plain" };
    case "submitted": return d.auto ? { text: "Turned in automatically after leaving a second time", tone: "high" } : { text: "Turned in", tone: "good" };
    default: return { text: e.type, tone: "plain" };
  }
}
const TONE = { plain: "text-slate-700", warn: "text-amber-800", high: "text-red-700 font-semibold", good: "text-emerald-700" };

export default function HubCameraQuizzes({ which, studentId, hideWhenEmpty = false, onCount }: { which: Which; studentId?: number; hideWhenEmpty?: boolean; /** How many camera quizzes there are, once loaded. */ onCount?: (n: number) => void }) {
  const { token } = useAuth();
  const k = kit(which);
  const headers = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"check" | "all" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/integrity/review${studentId ? `?studentId=${studentId}` : ""}`, { headers: headers(), cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Camera quizzes could not be loaded.");
      const list = Array.isArray(d.sessions) ? d.sessions : [];
      setRows(list); onCount?.(list.length);
    } catch (e: any) { setError(e?.message || "Camera quizzes could not be loaded."); setRows((r) => r ?? []); }
  };
  useEffect(() => { setRows(null); setOpenId(null); void load(); }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toCheck = useMemo(() => (rows || []).filter((r) => r.flag !== "clear" && !r.voided).sort((a, b) => (a.flag === b.flag ? 0 : a.flag === "high" ? -1 : 1)), [rows]);
  const view = filter ?? (toCheck.length ? "check" : "all");
  const shown = view === "check" ? toCheck : rows || [];
  if (hideWhenEmpty && rows && !rows.length && !error) return null;

  return <div className="space-y-4" data-testid="hub-camera-quizzes">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className={`${k.text} min-w-0 flex-1`}>Quizzes taken alone with the camera on, instead of with a proctor. Pictures are kept for 30 days.</p>
      {!!rows?.length && <Segments which={which} label="Which quizzes" value={view} onChange={setFilter}
        options={[{ id: "check", label: `To check${toCheck.length ? ` (${toCheck.length})` : ""}` }, { id: "all", label: `All (${rows.length})` }]} />}
    </div>
    {error && <p role="alert" className={k.bad}>{error} <button type="button" className="underline" onClick={() => void load()}>Try again</button></p>}
    {!rows && !error && <p className={k.small}>Loading…</p>}
    {rows && !rows.length && !error && <p className={k.empty}>No camera quizzes yet. They show up here after a student takes a quiz on their own.</p>}
    {rows && !!rows.length && !shown.length && <p className={k.empty}>Nothing to check. Every camera quiz looks fine.</p>}
    {!!shown.length && <ul className="space-y-2">{shown.map((r) => <li key={r.id}>
      <button type="button" onClick={() => setOpenId(r.id)} className={`${k.row} flex w-full items-center gap-3 text-left hover:bg-slate-50`} data-testid="np-review-row">
        <Pill which={which} tone={FLAG[r.flag].tone}>{FLAG[r.flag].label}</Pill>
        <span className="min-w-0 flex-1"><span className={`block truncate ${k.h}`}>{studentId ? r.quizTitle : `${r.studentName} · ${r.quizTitle}`}</span>
          <span className={`block truncate ${k.small}`}>{r.reasons[0]?.text || `${r.snapshotCount} pictures, stayed on the quiz`}{r.reasons.length > 1 ? ` (+${r.reasons.length - 1} more)` : ""}</span></span>
        <span className="shrink-0 text-right"><span className={`block ${k.h}`}>{r.score ?? "–"}/{r.total ?? "–"}</span><span className={`block text-xs ${r.voided ? "font-semibold text-red-700" : "text-slate-500"}`}>{r.voided ? "Points removed" : `${r.pointsAwarded} pts`}</span><span className="block text-xs text-slate-500">{fmtWhen(r.submittedAt)}</span></span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    </li>)}</ul>}
    {openId && <Review which={which} id={openId} headers={headers} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
  </div>;
}

function Review({ which, id, headers, onClose, onChanged }: { which: Which; id: string; headers: () => Record<string, string>; onClose: () => void; onChanged: () => void }) {
  const k = kit(which);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrity/review/${id}`, { headers: headers(), cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "This quiz could not be loaded.");
      setDetail(d);
    } catch (e: any) { setError(e?.message || "This quiz could not be loaded."); }
  };
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (zoom === null) return;
    const key = (e: KeyboardEvent) => {
      const n = detail?.snapshots.length || 0;
      if (e.key === "ArrowLeft" && zoom > 0) setZoom(zoom - 1);
      if (e.key === "ArrowRight" && zoom < n - 1) setZoom(zoom + 1);
      if (e.key === "Escape") { e.stopPropagation(); setZoom(null); }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [zoom, detail]);

  const change = async (remove: boolean) => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/integrity/review/${id}/${remove ? "void" : "restore"}`, { method: "POST", headers: headers(), body: JSON.stringify(remove ? { reason: reason.trim() } : {}) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "The points could not be changed.");
      setRemoving(false); setReason(""); await load(); onChanged();
    } catch (e: any) { setError(e?.message || "The points could not be changed."); }
    finally { setBusy(false); }
  };

  const s = detail?.session, pics = detail?.snapshots || [];
  const start = detail?.timeline.find((e) => e.type === "start");
  const pace = useMemo(() => {
    const answers: { first: number; changes: number }[] = Object.values(s?.answerTimes || {});
    const times = answers.map((v) => v.first).sort((a, b) => a - b);
    if (!times.length) return null;
    const gaps = times.map((t, i) => t - (i ? times[i - 1] : 0));
    return { avg: gaps.reduce((a, b) => a + b, 0) / gaps.length, fastest: Math.min(...gaps), changed: answers.filter((v) => v.changes > 0).length };
  }, [s]);

  return <KitModal which={which} wide title={s ? `${s.studentName} · ${s.quizTitle}` : "Camera quiz"} onClose={onClose}>
    <div className="space-y-4">
      {s && <p className={k.small}>{fmtWhen(s.submittedAt)} · took {secs(s.durationMs || 0)}{start?.detail?.device ? ` · ${device(start.detail.device)}` : ""}</p>}
      {error && <p role="alert" className={k.bad}>{error}</p>}
      {!detail && !error && <p className={k.small}>Loading…</p>}
      {s && detail && <>
        <div className="flex flex-wrap items-center gap-2">
          <Pill which={which} tone={FLAG[s.flag].tone}>{FLAG[s.flag].label}</Pill>
          <Pill which={which} tone="slate">{s.score ?? "–"}/{s.total ?? "–"} correct</Pill>
          <Pill which={which} tone={s.voided ? "red" : "slate"}>{s.voided ? "Points removed" : `${s.pointsAwarded} points`}</Pill>
          <Pill which={which} tone="slate">{s.leaves} {s.leaves === 1 ? "leave" : "leaves"}{s.awayMs ? ` (${secs(s.awayMs)} away)` : ""}</Pill>
          <Pill which={which} tone="slate">{s.snapshotCount} pictures</Pill>
        </div>
        {s.reasons.length ? <ul className="space-y-1.5">{s.reasons.map((r, i) => <li key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${r.level === "high" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{r.text}</li>)}</ul>
          : <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><ShieldCheck className="h-4 w-4" /> Stayed on the quiz the whole time, with the camera on.</p>}
        {s.voided && <p className={k.bad}>Points removed{s.voidedAt ? ` on ${fmtWhen(s.voidedAt)}` : ""}{s.voidReason ? `: "${s.voidReason}"` : "."}</p>}

        <section><h3 className={`mb-2 ${k.h}`}>Pictures</h3>
          {s.snapshotsPurged ? <p className={k.small}>The pictures were deleted after 30 days.</p>
            : pics.length ? <div className="flex gap-2 overflow-x-auto pb-1">{pics.map((p, i) => <button key={p.url} type="button" onClick={() => setZoom(i)} aria-label={`Picture at ${clock(offset(p, s.startedAt))}`}
              className={`w-28 shrink-0 overflow-hidden rounded-xl border text-left ${p.reason === "left" ? "border-amber-400" : "border-slate-200"}`}>
              <img src={p.url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <span className="block px-2 py-1 text-[11px] text-slate-600"><b>{clock(offset(p, s.startedAt))}</b>{SHOT[p.reason] ? ` ${SHOT[p.reason]}` : ""}</span>
            </button>)}</div> : <p className={k.small}>No pictures came through for this quiz.</p>}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section><h3 className={`mb-2 ${k.h}`}>What happened</h3>
            <ol className="space-y-1">{detail.timeline.map((e, i) => { const d = describe(e); return <li key={i} className="flex gap-3 text-sm"><time className="w-12 shrink-0 font-mono text-xs text-slate-500">{clock(offset(e, s.startedAt))}</time><span className={TONE[d.tone]}>{d.text}</span></li>; })}</ol>
          </section>
          <section className="space-y-4">
            {pace && <div><h3 className={`mb-2 ${k.h}`}>Answer pace</h3><p className={`flex items-start gap-2 ${k.text}`}><Clock3 className="mt-0.5 h-4 w-4 shrink-0" /><span>About <b>{secs(pace.avg)}</b> per question, quickest <b>{secs(pace.fastest)}</b>. {pace.changed ? `Changed ${pace.changed} ${pace.changed === 1 ? "answer" : "answers"}.` : "Didn't change any answers."}</span></p></div>}
            {detail.earlierTries.length > 0 && <div><h3 className={`mb-2 ${k.h}`}>Earlier tries that weren't turned in</h3>
              <ul className="space-y-2">{detail.earlierTries.map((t, i) => <li key={i} className={k.soft}><p className={`flex items-center gap-2 ${k.small}`}><RotateCcw className="h-3.5 w-3.5" /> Started {fmtWhen(t.startedAt)}{t.leaves ? `, left ${t.leaves === 1 ? "once" : `${t.leaves} times`}` : ""}</p>
                {t.snapshots.length > 0 && <div className="mt-2 flex gap-1.5 overflow-x-auto">{t.snapshots.map((p) => <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200"><img src={p.url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" /></a>)}</div>}
              </li>)}</ul></div>}
          </section>
        </div>

        <div className="border-t border-slate-100 pt-4">
          {!detail.canVoid ? <p className={k.small}>Only the teacher and the site admin can change points.</p>
            : s.voided ? <button type="button" className={k.ghost} disabled={busy} onClick={() => void change(false)}><Undo2 className="h-4 w-4" /> {busy ? "Saving…" : `Give the ${s.pointsAwarded} points back`}</button>
            : removing ? <div className="space-y-2">
              <label className="block"><span className={k.label}>Reason (optional, for your records)</span><textarea rows={2} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="For example: was looking at a phone" className={k.input + " py-2"} /></label>
              <div className="flex flex-wrap gap-2"><button type="button" className={k.danger} disabled={busy} onClick={() => void change(true)}>{busy ? "Removing…" : "Remove points"}</button><button type="button" className={k.ghost} onClick={() => setRemoving(false)}>Cancel</button></div>
            </div>
            : <button type="button" className={k.danger} disabled={s.pointsAwarded <= 0} onClick={() => setRemoving(true)} data-testid="np-review-remove">{s.pointsAwarded > 0 ? `Remove the ${s.pointsAwarded} points` : "No points to remove"}</button>}
        </div>
      </>}
    </div>
    {zoom !== null && pics[zoom] && s && <div className="fixed inset-0 z-[700] flex items-center justify-center bg-slate-950/90 p-4" onClick={(e) => { if (e.target === e.currentTarget) setZoom(null); }} role="dialog" aria-label="Picture">
      <figure className="max-h-full max-w-3xl"><img src={pics[zoom].url} alt={`Picture at ${clock(offset(pics[zoom], s.startedAt))}`} className="max-h-[80vh] rounded-2xl" />
        <figcaption className="mt-2 text-center text-sm text-white"><b>{clock(offset(pics[zoom], s.startedAt))}</b> {SHOT[pics[zoom].reason] || "Every 30 seconds"} · {zoom + 1} of {pics.length}</figcaption></figure>
      <button type="button" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)} aria-label="Previous picture" className="absolute left-3 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-30"><ChevronLeft /></button>
      <button type="button" disabled={zoom === pics.length - 1} onClick={() => setZoom(zoom + 1)} aria-label="Next picture" className="absolute right-3 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-30"><ChevronRight /></button>
      <button type="button" onClick={() => setZoom(null)} aria-label="Close picture" className="absolute right-3 top-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white"><X /></button>
    </div>}
  </KitModal>;
}

