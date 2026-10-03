import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, ChevronLeft, ChevronRight, Clock3, RotateCcw, ShieldCheck, Undo2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import "./noproctor-review.css";

type Flag = "clear" | "review" | "high";
type Reason = { level: "review" | "high"; text: string };
type SessionRow = {
  id: string;
  studentId: number;
  studentName: string;
  quizTitle: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  total: number | null;
  pointsAwarded: number;
  durationMs: number | null;
  leaves: number;
  awayMs: number;
  autoSubmitted: boolean;
  snapshotCount: number;
  flag: Flag;
  reasons: Reason[];
  voided: boolean;
  voidReason: string | null;
  snapshotsPurged: boolean;
};
type Picture = { at: string; reason: string; url: string };
type TimelineEvent = { at: string; type: string; detail: Record<string, any> | null };
type Detail = {
  canVoid: boolean;
  session: SessionRow & { answerTimes: Record<string, { first: number; changes: number }> | null; voidedAt: string | null };
  timeline: TimelineEvent[];
  snapshots: Picture[];
  earlierTries: { startedAt: string; leaves: number; snapshots: Picture[] }[];
};

function cookieToken(): string | null {
  try {
    const c = document.cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith("arise_session="));
    return c ? JSON.parse(atob(c.substring("arise_session=".length))).token || null : null;
  } catch {
    return null;
  }
}

const FLAG_LABEL: Record<Flag, string> = { high: "High concern", review: "Check this", clear: "Looks fine" };
const LEAVE_KIND: Record<string, string> = {
  hidden: "switched to another tab or app",
  window: "clicked outside the quiz window",
  closed: "closed or reloaded the page",
  page: "went to another page in the app",
};
const PICTURE_LABEL: Record<string, string> = { start: "Start", left: "Left the quiz", returned: "Came back", camera: "Camera back on", resumed: "Picked up again", end: "Turned in" };

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const seconds = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

function deviceLabel(ua: string | undefined) {
  if (!ua) return "";
  const kind = /iPad|Tablet/i.test(ua) ? "a tablet" : /iPhone|Android.+Mobile|Mobile/i.test(ua) ? "a phone" : /Android/i.test(ua) ? "a tablet" : /CrOS/.test(ua) ? "a Chromebook" : "a computer";
  const browser = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return `On ${kind}${browser ? ` in ${browser}` : ""}`;
}

function describe(e: TimelineEvent): { text: string; tone: "plain" | "warn" | "high" | "good" } {
  const d = e.detail || {};
  switch (e.type) {
    case "start": return { text: d.restarts ? `Started the quiz (try ${Number(d.restarts) + 1})` : "Started the quiz", tone: "plain" };
    case "left": return { text: `Left the quiz: ${LEAVE_KIND[d.kind] || "left the page"}`, tone: "warn" };
    case "returned": return { text: `Came back after ${seconds(Number(d.ms) || 0)}`, tone: "plain" };
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

/** Time since the start: the browser's own clock for its events, the server's for the rest. */
function offsetOf(e: { at: string; detail?: Record<string, any> | null }, startedAt: string) {
  const t = Number(e.detail?.t);
  return Number.isFinite(t) && t >= 0 ? t : Date.parse(e.at) - Date.parse(startedAt);
}

function useAuthHeaders() {
  const { token } = useAuth();
  return () => ({ Authorization: `Bearer ${token || cookieToken()}`, "Content-Type": "application/json" });
}

/**
 * Quizzes students took on their own with the camera on: who, what was flagged,
 * the pictures and what happened. Teachers and the admin can remove the points.
 */
export default function NoProctorReview({ studentId, hideWhenEmpty = false, title = "Camera quizzes" }: {
  /** Only this student (the parent dashboard's selected child). */
  studentId?: number;
  /** Render nothing when there are no camera quizzes yet. */
  hideWhenEmpty?: boolean;
  title?: string;
}) {
  const headers = useAuthHeaders();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"check" | "all" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setError("");
    try {
      const qs = studentId ? `?studentId=${studentId}` : "";
      const res = await fetch(`${API_BASE}/api/integrity/review${qs}`, { headers: headers(), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load camera quizzes.");
      setRows(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (e: any) {
      setError(e?.message || "Could not load camera quizzes.");
      setRows((r) => r ?? []);
    }
  };
  useEffect(() => { setRows(null); setOpenId(null); void load(); }, [studentId]);

  const toCheck = useMemo(
    () => (rows || []).filter((r) => r.flag !== "clear" && !r.voided).sort((a, b) => (a.flag === b.flag ? 0 : a.flag === "high" ? -1 : 1)),
    [rows],
  );
  const view = filter ?? (toCheck.length ? "check" : "all");
  const shown = view === "check" ? toCheck : rows || [];

  if (hideWhenEmpty && rows && !rows.length && !error) return null;

  return (
    <section className="np-r" aria-labelledby="np-r-title">
      <div className="np-r-head">
        <div>
          <h2 id="np-r-title"><Camera /> {title}</h2>
          <p>Quizzes taken on their own with the camera on, instead of with a proctor. Pictures are kept for 30 days.</p>
        </div>
        {!!rows?.length && (
          <div className="np-r-tabs" role="tablist" aria-label="Which quizzes to show">
            <button type="button" role="tab" aria-selected={view === "check"} className={view === "check" ? "on" : ""} onClick={() => setFilter("check")}>
              To check{toCheck.length ? ` (${toCheck.length})` : ""}
            </button>
            <button type="button" role="tab" aria-selected={view === "all"} className={view === "all" ? "on" : ""} onClick={() => setFilter("all")}>
              All ({rows.length})
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="np-r-error" role="alert">
          {error} <button type="button" onClick={() => void load()}>Try again</button>
        </div>
      )}
      {!rows && !error && <p className="np-r-empty">Loading…</p>}
      {rows && !rows.length && !error && <p className="np-r-empty">No camera quizzes yet. They show up here after a student takes a quiz on their own.</p>}
      {rows && !!rows.length && !shown.length && <p className="np-r-empty">Nothing to check. Every camera quiz looks fine.</p>}

      {!!shown.length && (
        <ul className="np-r-list">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" className="np-r-row" onClick={() => setOpenId(r.id)} data-testid="np-review-row">
                <span className={`np-r-flag ${r.flag}`}>{FLAG_LABEL[r.flag]}</span>
                <span className="np-r-main">
                  <b>{studentId ? r.quizTitle : `${r.studentName} · ${r.quizTitle}`}</b>
                  <span>{r.reasons[0]?.text || `${r.snapshotCount} pictures, stayed on the quiz`}{r.reasons.length > 1 ? ` (+${r.reasons.length - 1} more)` : ""}</span>
                </span>
                <span className="np-r-side">
                  <b>{r.score ?? "–"}/{r.total ?? "–"}</b>
                  <span className={r.voided ? "removed" : ""}>{r.voided ? "Points removed" : `${r.pointsAwarded} pts`}</span>
                  <span>{when(r.submittedAt)}</span>
                </span>
                <ChevronRight className="np-r-chev" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {openId && <ReviewDialog id={openId} headers={headers} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
    </section>
  );
}

function ReviewDialog({ id, headers, onClose, onChanged }: { id: string; headers: () => Record<string, string>; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrity/review/${id}`, { headers: headers(), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load this quiz.");
      setDetail(data);
    } catch (e: any) {
      setError(e?.message || "Could not load this quiz.");
    }
  };
  useEffect(() => { void load(); }, [id]);

  // Read by the key handler, which is set up once.
  const zoomRef = useRef<{ zoom: number | null; count: number }>({ zoom: null, count: 0 });
  zoomRef.current = { zoom, count: detail?.snapshots.length || 0 };

  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      const z = zoomRef.current;
      if (e.key === "Escape") { if (z.zoom !== null) setZoom(null); else onClose(); }
      if (z.zoom !== null && e.key === "ArrowLeft" && z.zoom > 0) setZoom(z.zoom - 1);
      if (z.zoom !== null && e.key === "ArrowRight" && z.zoom < z.count - 1) setZoom(z.zoom + 1);
      if (e.key === "Tab" && boxRef.current) {
        const items = Array.from(boxRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, [href]"));
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changePoints = async (remove: boolean) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/integrity/review/${id}/${remove ? "void" : "restore"}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(remove ? { reason: reason.trim() } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not change the points.");
      setRemoving(false);
      setReason("");
      await load();
      onChanged();
    } catch (e: any) {
      setError(e?.message || "Could not change the points.");
    } finally {
      setBusy(false);
    }
  };

  const s = detail?.session;
  const pictures = detail?.snapshots || [];
  const start = detail?.timeline.find((e) => e.type === "start");
  const pace = useMemo(() => {
    const times = Object.values(s?.answerTimes || {}).map((v) => v.first).sort((a, b) => a - b);
    if (!times.length) return null;
    const gaps = times.map((t, i) => t - (i ? times[i - 1] : 0));
    const changed = Object.values(s?.answerTimes || {}).reduce((n, v) => n + (v.changes > 0 ? 1 : 0), 0);
    return { avg: gaps.reduce((a, b) => a + b, 0) / gaps.length, fastest: Math.min(...gaps), changed, count: times.length };
  }, [s]);

  return (
    <div className="np-r-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={boxRef} className="np-r-dialog" role="dialog" aria-modal="true" aria-labelledby="np-r-dialog-title">
        <div className="np-r-dialog-top">
          <div>
            <h3 id="np-r-dialog-title">{s ? `${s.studentName} · ${s.quizTitle}` : "Camera quiz"}</h3>
            {s && (
              <p>
                {when(s.submittedAt)} · took {seconds(s.durationMs || 0)}
                {start?.detail?.device ? ` · ${deviceLabel(start.detail.device)}` : ""}
              </p>
            )}
          </div>
          <button ref={closeRef} type="button" className="np-r-close" onClick={onClose} aria-label="Close"><X /></button>
        </div>

        {error && <div className="np-r-error" role="alert">{error}</div>}
        {!detail && !error && <p className="np-r-empty">Loading…</p>}

        {s && detail && (
          <div className="np-r-dialog-body">
            <div className="np-r-summary">
              <span className={`np-r-flag ${s.flag}`}>{FLAG_LABEL[s.flag]}</span>
              <span><b>{s.score ?? "–"}/{s.total ?? "–"}</b> correct</span>
              <span>{s.voided ? <b className="removed">Points removed</b> : <><b>{s.pointsAwarded}</b> points</>}</span>
              <span><b>{s.leaves}</b> {s.leaves === 1 ? "leave" : "leaves"}{s.awayMs ? ` (${seconds(s.awayMs)} away)` : ""}</span>
              <span><b>{s.snapshotCount}</b> pictures</span>
            </div>

            {s.reasons.length > 0 ? (
              <ul className="np-r-reasons">
                {s.reasons.map((r, i) => <li key={i} className={r.level}><AlertTriangle /> {r.text}</li>)}
              </ul>
            ) : (
              <p className="np-r-fine"><ShieldCheck /> Stayed on the quiz the whole time, with the camera on.</p>
            )}
            {s.voided && (
              <p className="np-r-voided">Points removed{s.voidedAt ? ` on ${when(s.voidedAt)}` : ""}{s.voidReason ? `: “${s.voidReason}”` : "."}</p>
            )}

            <h4>Pictures</h4>
            {s.snapshotsPurged ? (
              <p className="np-r-muted">The pictures were deleted after 30 days.</p>
            ) : pictures.length ? (
              <div className="np-r-film">
                {pictures.map((p, i) => (
                  <button key={p.url} type="button" className={"np-r-shot" + (p.reason === "left" ? " left" : "")} onClick={() => setZoom(i)} aria-label={`Picture at ${clock(offsetOf(p, s.startedAt))}`}>
                    <img src={p.url} alt="" loading="lazy" />
                    <span><b>{clock(offsetOf(p, s.startedAt))}</b>{PICTURE_LABEL[p.reason] ? ` ${PICTURE_LABEL[p.reason]}` : ""}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="np-r-muted">No pictures came through for this quiz.</p>
            )}

            <div className="np-r-cols">
              <div>
                <h4>What happened</h4>
                <ol className="np-r-timeline">
                  {detail.timeline.map((e, i) => {
                    const d = describe(e);
                    return (
                      <li key={i} className={d.tone}>
                        <time>{clock(offsetOf(e, s.startedAt))}</time>
                        <span>{d.text}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div>
                {pace && (
                  <>
                    <h4>Answer pace</h4>
                    <p className="np-r-pace">
                      <Clock3 />
                      <span>
                        About <b>{seconds(pace.avg)}</b> per question, quickest <b>{seconds(pace.fastest)}</b>.{" "}
                        {pace.changed ? `Changed ${pace.changed} ${pace.changed === 1 ? "answer" : "answers"}.` : "Didn't change any answers."}
                      </span>
                    </p>
                  </>
                )}
                {detail.earlierTries.length > 0 && (
                  <>
                    <h4>Earlier tries that weren't turned in</h4>
                    <ul className="np-r-tries">
                      {detail.earlierTries.map((t, i) => (
                        <li key={i}>
                          <span><RotateCcw /> Started {when(t.startedAt)}{t.leaves ? `, left ${t.leaves === 1 ? "once" : `${t.leaves} times`}` : ""}</span>
                          {t.snapshots.length > 0 && (
                            <div className="np-r-film small">
                              {t.snapshots.map((p) => <a key={p.url} className="np-r-shot" href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="" loading="lazy" /></a>)}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {s && detail && (
          <div className="np-r-actions">
            {!detail.canVoid ? (
              <p className="np-r-muted">Only the teacher and the site admin can change points.</p>
            ) : s.voided ? (
              <button type="button" className="np-r-btn" disabled={busy} onClick={() => void changePoints(false)}>
                <Undo2 /> {busy ? "Saving…" : `Give the ${s.pointsAwarded} points back`}
              </button>
            ) : removing ? (
              <div className="np-r-remove">
                <label htmlFor="np-r-reason">Reason (optional, for your records)</label>
                <textarea id="np-r-reason" rows={2} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="For example: was looking at a phone" />
                <div>
                  <button type="button" className="np-r-btn danger" disabled={busy} onClick={() => void changePoints(true)}>{busy ? "Removing…" : "Remove points"}</button>
                  <button type="button" className="np-r-link" onClick={() => setRemoving(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className="np-r-btn danger" disabled={s.pointsAwarded <= 0} onClick={() => setRemoving(true)} data-testid="np-review-remove">
                {s.pointsAwarded > 0 ? `Remove the ${s.pointsAwarded} points` : "No points to remove"}
              </button>
            )}
          </div>
        )}

        {zoom !== null && pictures[zoom] && s && (
          <div className="np-r-zoom" onClick={(e) => { if (e.target === e.currentTarget) setZoom(null); }}>
            <figure>
              <img src={pictures[zoom].url} alt={`Picture at ${clock(offsetOf(pictures[zoom], s.startedAt))}`} />
              <figcaption>
                <b>{clock(offsetOf(pictures[zoom], s.startedAt))}</b> {PICTURE_LABEL[pictures[zoom].reason] || "Every 30 seconds"} · {zoom + 1} of {pictures.length}
              </figcaption>
            </figure>
            <button type="button" className="np-r-nav prev" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)} aria-label="Previous picture"><ChevronLeft /></button>
            <button type="button" className="np-r-nav next" disabled={zoom === pictures.length - 1} onClick={() => setZoom(zoom + 1)} aria-label="Next picture"><ChevronRight /></button>
            <button type="button" className="np-r-close zoom" onClick={() => setZoom(null)} aria-label="Close picture"><X /></button>
          </div>
        )}
      </div>
    </div>
  );
}
