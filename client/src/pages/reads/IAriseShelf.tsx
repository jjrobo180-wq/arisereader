// iARISE on Read on Arise: short real-life lessons (friendship, feelings, money,
// study skills…), each with a quiz, plus lessons a student makes from topics they pick.
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import QuizGeneratingOverlay from "@/components/QuizGeneratingOverlay";
import type { LibBook, QuizResult } from "./useReads";

const SUGGESTIONS = [
  "Being a Good Friend", "All About Feelings", "Bullying Prevention", "Conflict Resolution",
  "Study Skills", "Time Management", "Healthy Habits", "Sports and Fitness",
  "Cooking Basics", "Music Appreciation", "Art and Creativity", "Digital Citizenship",
  "Money Management", "Leadership", "Teamwork", "Environmental Awareness",
  "Community Service", "Career Exploration", "Cultural Diversity", "Stress Management",
  "Goal Setting", "Public Speaking", "Critical Thinking", "Problem Solving",
];

export default function IAriseShelf({ books, results }: { books: LibBook[] | null; results: QuizResult[] }) {
  const { token, user } = useAuth();
  const [, navigate] = useLocation();
  const [ids, setIds] = useState<number[]>([]);
  const [times, setTimes] = useState<Record<string, string>>({});
  const [topics, setTopics] = useState<string[]>([]);
  const [customIds, setCustomIds] = useState<number[]>([]);
  const [editing, setEditing] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // why a lesson couldn't be made, shown under "My lessons"
  const [makeNote, setMakeNote] = useState("");
  const [making, setMaking] = useState<{ topic: string; bookId: number | null; review: string | null } | null>(null);
  const isStudent = !(user as any)?.isAdmin && user?.role !== "teacher" && user?.role !== "parent";

  useEffect(() => {
    fetch(`${API_BASE}/api/i-arise-book-ids`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setIds(Array.isArray(d.bookIds) ? d.bookIds : [])).catch(() => {});
    fetch(`${API_BASE}/api/i-arise-est-times`).then((r) => (r.ok ? r.json() : {})).then(setTimes).catch(() => {});
    if (!token || !isStudent) return;
    fetch(`${API_BASE}/api/student/iarise-topics`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setTopics(d.topics || []); setCustomIds(d.bookIds || []); } }).catch(() => {});
  }, [token, isStudent]);

  const lessons = (books ?? []).filter((b) => ids.includes(b.id));
  const custom = (books ?? []).filter((b) => customIds.includes(b.id));
  const result = (id: number) => results.find((r) => r.bookId === id);

  const toggle = (t: string) => {
    setError("");
    if (picks.includes(t)) setPicks(picks.filter((p) => p !== t));
    else if (picks.length >= 5) setError("You can pick up to 5 topics.");
    else setPicks([...picks, t]);
  };
  const addSearch = () => {
    const t = search.trim(); if (!t) return;
    if (picks.some((p) => p.toLowerCase() === t.toLowerCase())) { setError("Already picked."); return; }
    if (picks.length >= 5) { setError("You can pick up to 5 topics."); return; }
    setPicks([...picks, t]); setSearch(""); setError("");
  };
  const save = async () => {
    if (!picks.length) { setError("Pick at least 1 topic."); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/student/iarise-topics`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ topics: picks }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "Couldn't save your topics.");
      setTopics(picks); setEditing(false);
    } catch (e: any) { setError(e.message || "Couldn't save your topics."); }
    setSaving(false);
  };
  const make = async (topic: string) => {
    setMaking({ topic, bookId: null, review: null });
    try {
      const r = await fetch(`${API_BASE}/api/student/iarise-quiz`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ topic }) });
      const d = await r.json();
      if (!r.ok) { setMaking(null); setMakeNote(r.status === 402 ? "Lessons from your own topics are part of A.R.I.S.E. Premium, which comes through your teacher." : d.message || "That lesson couldn't be made. Try again."); return; }
      setMakeNote("");
      setMaking({ topic, bookId: d.pendingReview ? null : d.bookId ?? null, review: d.pendingReview ? d.message : null });
    } catch { setMaking(null); }
  };

  const card = (b: LibBook, key: string) => {
    const r = result(b.id);
    return (
      <a key={key} href={`#/course/${b.id}`} onClick={(e) => { e.preventDefault(); navigate(`/course/${b.id}`); }} className="rd-book">
        <div className="rd-cover">
          {b.coverUrl ? <img src={`${API_BASE}/api/book-cover/${b.id}`} alt={`Cover of ${b.title}`} loading="lazy" /> : <div className="ia-cover-text">{b.title}</div>}
          {r && <span className="rd-flag done">✓ Quiz {r.score}/{r.total}</span>}
        </div>
        <h3>{b.title}</h3>
        <div className="nw-meta">{times[String(b.id)] && <span>{times[String(b.id)]}</span>}<span className="nw-pts">{b.pointsValue || 10} pts</span></div>
      </a>
    );
  };

  if (!lessons.length && !topics.length && !isStudent) return null;

  return (
    <section className="nw-block" id="iarise" aria-labelledby="iarise-h">
      <div className="nw-block-head">
        <h2 id="iarise-h">iARISE lessons</h2>
        <p>Short real-life lessons on friendship, feelings, money, study skills and more, each with a quiz.</p>
        {isStudent && <button type="button" className="rd-more ia-edit" onClick={() => { setPicks(topics); setError(""); setEditing(true); }}>{topics.length ? "Change my topics" : "Pick my topics"}</button>}
      </div>
      {lessons.length > 0 && <div className="rd-books">{lessons.map((b) => card(b, `l${b.id}`))}</div>}

      {isStudent && topics.length > 0 && (
        <>
          <h3 className="ia-sub">My lessons</h3>
          <div className="rd-books">
            {custom.map((b) => card(b, `c${b.id}`))}
            {topics.map((t) => {
              const has = custom.some((b) => b.title.toLowerCase() === t.toLowerCase());
              return (
                <button key={t} type="button" className="rd-book ia-new" onClick={() => make(t)}>
                  <div className="rd-cover ia-new-cover"><span aria-hidden="true">+</span><b>{t}</b><small>{has ? "Make another lesson" : "Make this lesson"}</small></div>
                  <h3>{t}</h3>
                </button>
              );
            })}
          </div>
        </>
      )}
      {makeNote && <p className="ia-empty" role="status">{makeNote}</p>}
      {!lessons.length && !topics.length && <p className="ia-empty">Pick a few topics you care about and we'll make lessons for you.</p>}

      {editing && (
        <div className="ia-modal" role="dialog" aria-modal="true" aria-labelledby="ia-modal-h" onClick={(e) => { if (e.target === e.currentTarget) setEditing(false); }}>
          <div className="ia-sheet">
            <h3 id="ia-modal-h">Your iARISE topics</h3>
            <p>Pick 1 to 5 topics you want to learn about.</p>
            <div className="ia-search">
              <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSearch(); } }} placeholder="Type any topic" aria-label="Type any topic" />
              <button type="button" onClick={addSearch} disabled={!search.trim() || picks.length >= 5}>Add</button>
            </div>
            {picks.length > 0 && <div className="ia-picks">{picks.map((p) => <button key={p} type="button" className="nw-chip" aria-pressed="true" onClick={() => toggle(p)} aria-label={`Remove ${p}`}>{p} ×</button>)}</div>}
            <div className="ia-picks">{SUGGESTIONS.filter((t) => !picks.includes(t)).map((t) => <button key={t} type="button" className="nw-chip" onClick={() => toggle(t)}>{t}</button>)}</div>
            {error && <p role="alert" className="ia-error">{error}</p>}
            <div className="ia-actions">
              <button type="button" className="ia-cancel" onClick={() => setEditing(false)}>Cancel</button>
              <button type="button" className="ia-save" onClick={save} disabled={saving || !picks.length}>{saving ? "Saving…" : "Save my topics"}</button>
            </div>
          </div>
        </div>
      )}
      {making && (
        <QuizGeneratingOverlay
          bookTitle={making.topic} author="" ready={!!making.bookId || !!making.review} pendingReview={making.review}
          onComplete={() => { const id = making.bookId; setMaking(null); if (id) navigate(`/course/${id}`); }}
        />
      )}
    </section>
  );
}
