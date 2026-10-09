// Grading reading comprehension: the written answers students sent at the end of a
// book quiz. Teachers see their own students; the admin sees everyone (and grades
// students who have no teacher). 0 to 10 extra points, plus an optional note.
import { useEffect, useState } from "react";
import { Check, Loader2, PenLine } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { COMPREHENSION } from "@shared/comprehension";
import "./comprehension-review.css";

type Item = {
  id: number;
  studentId: number;
  studentName: string;
  bookId: number;
  bookTitle: string;
  coverUrl: string | null;
  quiz: { score: number; total: number } | null;
  answers: { id: string; label: string; question: string; answer: string }[];
  proctor: string;
  status: "pending" | "graded";
  points: number | null;
  note: string;
  gradedBy: string | null;
  gradedAt: string | null;
  createdAt: string;
};

function cookieToken(): string | null {
  try {
    const c = document.cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith("arise_session="));
    return c ? JSON.parse(atob(c.substring("arise_session=".length))).token || null : null;
  } catch {
    return null;
  }
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const QUICK = [COMPREHENSION.bonusPoints, Math.round(COMPREHENSION.bonusPoints / 2), 0];

export default function ComprehensionReview({ title = "Reading comprehension", onPendingChange }: {
  title?: string;
  /** Tells the page how many are waiting (for the tab's number). */
  onPendingChange?: (n: number) => void;
}) {
  const { token } = useAuth();
  const headers = () => ({ Authorization: `Bearer ${token || cookieToken()}`, "Content-Type": "application/json" });
  const [view, setView] = useState<"pending" | "graded">("pending");
  const [items, setItems] = useState<Item[] | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async (which = view) => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/comprehension/review?status=${which}`, { headers: headers(), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load reading comprehension.");
      setItems(Array.isArray(data.items) ? data.items : []);
      setPending(Number(data.pending) || 0);
      onPendingChange?.(Number(data.pending) || 0);
    } catch (e: any) {
      setError(e?.message || "Could not load reading comprehension.");
      setItems((list) => list ?? []);
    }
  };
  useEffect(() => { setItems(null); void load(view); }, [view]);

  const graded = async (item: Item, points: number) => {
    setNotice(`${item.studentName}: ${points} extra point${points === 1 ? "" : "s"} for “${item.bookTitle}”. They got a message.`);
    await load(view);
  };

  return (
    <section className="cr" aria-labelledby="cr-title" data-testid="comprehension-review">
      <div className="cr-head">
        <div>
          <h2 id="cr-title"><PenLine /> {title}</h2>
          <p>Written answers students sent at the end of a book quiz. Give 0 to {COMPREHENSION.bonusPoints} extra points. The student gets a message with the points and your note.</p>
        </div>
        <div className="cr-tabs" role="tablist" aria-label="Which answers to show">
          <button type="button" role="tab" aria-selected={view === "pending"} className={view === "pending" ? "on" : ""} onClick={() => { setNotice(""); setView("pending"); }}>
            To grade{pending ? <span className="cr-count">{pending}</span> : null}
          </button>
          <button type="button" role="tab" aria-selected={view === "graded"} className={view === "graded" ? "on" : ""} onClick={() => { setNotice(""); setView("graded"); }}>Graded</button>
        </div>
      </div>

      {notice && <p className="cr-notice" role="status"><Check /> {notice}</p>}
      {error && <p className="cr-error" role="alert">{error} <button type="button" onClick={() => void load(view)}>Try again</button></p>}
      {!items && !error && <p className="cr-empty">Loading…</p>}
      {items && !items.length && !error && (
        <p className="cr-empty">
          {view === "pending"
            ? "Nothing to grade. When a student writes about the book at the end of a quiz, it shows up here."
            : "Nothing graded yet."}
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="cr-list">
          {items.map((item) => <ResponseCard key={item.id} item={item} headers={headers} onGraded={(points) => void graded(item, points)} />)}
        </ul>
      )}
    </section>
  );
}

function ResponseCard({ item, headers, onGraded }: { item: Item; headers: () => Record<string, string>; onGraded: (points: number) => void }) {
  const [editing, setEditing] = useState(item.status === "pending");
  const [points, setPoints] = useState<string>(item.points == null ? "" : String(item.points));
  const [note, setNote] = useState(item.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const n = points.trim() === "" ? NaN : Number(points);
  const valid = Number.isInteger(n) && n >= 0 && n <= COMPREHENSION.bonusPoints;

  const save = async () => {
    if (!valid) { setError(`Give 0 to ${COMPREHENSION.bonusPoints} points.`); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/comprehension/review/${item.id}/grade`, { method: "POST", headers: headers(), body: JSON.stringify({ points: n, note }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save the grade.");
      setEditing(false);
      onGraded(n);
    } catch (e: any) {
      setError(e?.message || "Could not save the grade.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="cr-card" data-testid="comprehension-item">
      <div className="cr-card-top">
        {item.coverUrl ? <img src={item.coverUrl} alt="" className="cr-cover" /> : <span className="cr-cover cr-cover-empty" aria-hidden="true">📖</span>}
        <div className="cr-who">
          <b>{item.studentName}</b>
          <span className="cr-book">{item.bookTitle}</span>
          <span className="cr-meta">
            {when(item.createdAt)}
            {item.quiz ? ` · Quiz ${item.quiz.score}/${item.quiz.total}` : ""}
            {` · ${item.proctor}`}
          </span>
        </div>
        {item.status === "graded" && !editing && (
          <span className="cr-score" aria-label={`${item.points} of ${COMPREHENSION.bonusPoints} points`}>{item.points}<small>/{COMPREHENSION.bonusPoints}</small></span>
        )}
      </div>

      <ol className="cr-answers">
        {item.answers.map((a) => (
          <li key={a.id}>
            <span className="cr-q"><b>{a.label}.</b> {a.question}</span>
            <p className="cr-a">{a.answer}</p>
          </li>
        ))}
      </ol>

      {editing ? (
        <div className="cr-grade">
          <div className="cr-grade-row">
            <span className="cr-grade-label" id={`cr-points-${item.id}`}>Extra points</span>
            <div className="cr-quick" role="group" aria-labelledby={`cr-points-${item.id}`}>
              {QUICK.map((q) => (
                <button key={q} type="button" className={points === String(q) ? "on" : ""} aria-pressed={points === String(q)} onClick={() => setPoints(String(q))}>{q}</button>
              ))}
              <input
                type="number" inputMode="numeric" min={0} max={COMPREHENSION.bonusPoints} step={1}
                aria-label={`Points, 0 to ${COMPREHENSION.bonusPoints}`} placeholder={`0–${COMPREHENSION.bonusPoints}`}
                value={points} onChange={(e) => setPoints(e.target.value)}
                className={points !== "" && !QUICK.map(String).includes(points) ? "on" : ""}
                data-testid="comprehension-points"
              />
            </div>
          </div>
          <textarea
            aria-label="Note to the student (optional)" placeholder="Note to the student (optional)"
            value={note} maxLength={COMPREHENSION.noteMax} rows={2} onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="cr-error" role="alert">{error}</p>}
          <div className="cr-actions">
            <button type="button" className="cr-save" disabled={busy || !valid} onClick={() => void save()} data-testid="comprehension-save">
              {busy ? <Loader2 className="cr-spin" /> : <Check />} {item.status === "graded" ? "Save new grade" : "Save grade"}
            </button>
            {item.status === "graded" && <button type="button" className="cr-link" onClick={() => { setEditing(false); setPoints(String(item.points ?? "")); setNote(item.note); setError(""); }}>Cancel</button>}
          </div>
        </div>
      ) : (
        <div className="cr-done">
          <span>
            {item.points ? `${item.points} extra point${item.points === 1 ? "" : "s"}` : "No extra points"}
            {item.gradedBy ? ` · ${item.gradedBy}` : ""}{item.gradedAt ? ` · ${when(item.gradedAt)}` : ""}
          </span>
          {item.note && <span className="cr-note">“{item.note}”</span>}
          <button type="button" className="cr-link" onClick={() => setEditing(true)}>Change grade</button>
        </div>
      )}
    </li>
  );
}
