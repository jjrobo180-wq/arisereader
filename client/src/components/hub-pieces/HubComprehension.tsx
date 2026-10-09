// Grading reading comprehension (written answers at the end of a book quiz), built from the hub's
// own parts. Same rules as the site's ComprehensionReview: 0 to 10 extra points and a note.
import { useEffect, useState } from "react";
import { BookOpen, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { COMPREHENSION } from "@shared/comprehension";
import { Pill, Segments, fmtWhen, kit, type Which } from "./kit";

type Item = {
  id: number; studentName: string; bookTitle: string; coverUrl: string | null; quiz: { score: number; total: number } | null;
  answers: { id: string; label: string; question: string; answer: string }[]; proctor: string;
  status: "pending" | "graded"; points: number | null; note: string; gradedBy: string | null; gradedAt: string | null; createdAt: string;
};
const MAX = COMPREHENSION.bonusPoints;
const QUICK = [MAX, Math.round(MAX / 2), 0];

export default function HubComprehension({ which, onPendingChange }: { which: Which; onPendingChange?: (n: number) => void }) {
  const { token } = useAuth();
  const k = kit(which);
  const headers = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
  const [view, setView] = useState<"pending" | "graded">("pending");
  const [items, setItems] = useState<Item[] | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async (which2 = view) => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/comprehension/review?status=${which2}`, { headers: headers(), cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Reading comprehension could not be loaded.");
      setItems(Array.isArray(d.items) ? d.items : []);
      setPending(Number(d.pending) || 0); onPendingChange?.(Number(d.pending) || 0);
    } catch (e: any) { setError(e?.message || "Reading comprehension could not be loaded."); setItems((l) => l ?? []); }
  };
  useEffect(() => { setItems(null); void load(view); }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="space-y-4" data-testid="hub-comprehension">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className={`${k.text} min-w-0 flex-1`}>Written answers students sent at the end of a book quiz. Give 0 to {MAX} extra points; the student gets a message with the points and your note.</p>
      <Segments which={which} label="Which answers" value={view} onChange={(v) => { setNotice(""); setView(v); }}
        options={[{ id: "pending", label: <>To grade{pending ? ` (${pending})` : ""}</> }, { id: "graded", label: "Graded" }]} />
    </div>
    {notice && <p role="status" className={k.ok}>{notice}</p>}
    {error && <p role="alert" className={k.bad}>{error} <button type="button" className="underline" onClick={() => void load(view)}>Try again</button></p>}
    {!items && !error && <p className={k.small}>Loading…</p>}
    {items && !items.length && !error && <p className={k.empty}>{view === "pending" ? "Nothing to grade. When a student writes about the book at the end of a quiz, it shows up here." : "Nothing graded yet."}</p>}
    {items && items.length > 0 && <ul className="space-y-3">{items.map((item) => <Answer key={item.id} which={which} item={item} headers={headers}
      onGraded={(n) => { setNotice(`${item.studentName}: ${n} extra point${n === 1 ? "" : "s"} for "${item.bookTitle}". They got a message.`); void load(view); }} />)}</ul>}
  </div>;
}

function Answer({ which, item, headers, onGraded }: { which: Which; item: Item; headers: () => Record<string, string>; onGraded: (n: number) => void }) {
  const k = kit(which);
  const [editing, setEditing] = useState(item.status === "pending");
  const [points, setPoints] = useState(item.points == null ? "" : String(item.points));
  const [note, setNote] = useState(item.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const n = points.trim() === "" ? NaN : Number(points);
  const valid = Number.isInteger(n) && n >= 0 && n <= MAX;
  const on = which === "work" ? "border-slate-950 bg-slate-950 text-white" : "border-[#6e5ae0] bg-[#6e5ae0] text-white";

  const save = async () => {
    if (!valid) { setError(`Give 0 to ${MAX} points.`); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/comprehension/review/${item.id}/grade`, { method: "POST", headers: headers(), body: JSON.stringify({ points: n, note }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "The grade could not be saved.");
      setEditing(false); onGraded(n);
    } catch (e: any) { setError(e?.message || "The grade could not be saved."); }
    finally { setBusy(false); }
  };

  return <li className={`${k.row} space-y-3`} data-testid="comprehension-item">
    <div className="flex items-start gap-3">
      {item.coverUrl ? <img src={item.coverUrl} alt="" className="h-16 w-11 shrink-0 rounded-lg object-cover" /> : <span className={`grid h-16 w-11 shrink-0 place-items-center ${k.tile}`}><BookOpen className="h-4 w-4" /></span>}
      <div className="min-w-0 flex-1"><p className={k.h}>{item.studentName}</p><p className={k.text}>{item.bookTitle}</p>
        <p className={k.small}>{fmtWhen(item.createdAt)}{item.quiz ? ` · quiz ${item.quiz.score}/${item.quiz.total}` : ""} · {item.proctor}</p></div>
      {item.status === "graded" && !editing && <Pill which={which} tone="brand">{item.points}/{MAX}</Pill>}
    </div>
    <ol className="space-y-2">{item.answers.map((a) => <li key={a.id} className={k.soft}><p className={k.small}><b className="text-slate-700">{a.label}.</b> {a.question}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{a.answer}</p></li>)}</ol>
    {editing ? <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Extra points">
        <span className={k.label + " !mb-0"}>Extra points</span>
        {QUICK.map((q) => <button key={q} type="button" aria-pressed={points === String(q)} onClick={() => setPoints(String(q))} className={`${k.segBtn} min-h-10 min-w-11 border ${points === String(q) ? on : "border-slate-200 bg-white text-slate-600"}`}>{q}</button>)}
        <input type="number" inputMode="numeric" min={0} max={MAX} step={1} aria-label={`Points, 0 to ${MAX}`} placeholder={`0–${MAX}`} value={points} onChange={(e) => setPoints(e.target.value)} className={k.input + " !w-20"} data-testid="comprehension-points" />
      </div>
      <textarea aria-label="Note to the student (optional)" placeholder="Note to the student (optional)" value={note} maxLength={COMPREHENSION.noteMax} rows={2} onChange={(e) => setNote(e.target.value)} className={k.input + " py-2"} />
      {error && <p role="alert" className={k.bad}>{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={k.accent} disabled={busy || !valid} onClick={() => void save()} data-testid="comprehension-save">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {item.status === "graded" ? "Save new grade" : "Save grade"}</button>
        {item.status === "graded" && <button type="button" className={k.ghost} onClick={() => { setEditing(false); setPoints(String(item.points ?? "")); setNote(item.note); setError(""); }}>Cancel</button>}
      </div>
    </div> : <div className="flex flex-wrap items-center justify-between gap-2">
      <p className={k.small}>{item.points ? `${item.points} extra point${item.points === 1 ? "" : "s"}` : "No extra points"}{item.gradedBy ? ` · ${item.gradedBy}` : ""}{item.gradedAt ? ` · ${fmtWhen(item.gradedAt)}` : ""}{item.note ? <span className="mt-1 block italic text-slate-600">"{item.note}"</span> : null}</p>
      <button type="button" className={k.ghost} onClick={() => setEditing(true)}>Change grade</button>
    </div>}
  </li>;
}
