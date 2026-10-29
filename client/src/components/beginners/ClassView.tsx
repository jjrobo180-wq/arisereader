// A.R.I.S.E. Beginners for teachers, parents and the administrator: each child's lessons, stars, read-aloud accuracy
// and words a minute, the words they're practicing, and where they start (the start unit opens every unit before it).
import { useEffect, useState } from "react";
import { Stars } from "./parts";

type Api = (path: string, init?: RequestInit) => Promise<any>;
type Row = {
  id: number; name: string; grade: string | null; startUnit: number; passed: number; lessons: number; stars: number; points: number;
  next: { id: string; title: string; unit: number } | null;
  reading: { accuracy: number; wcpm: number; count: number } | null;
  readings: { lesson: string; at: string; accuracy: number; wcpm: number }[];
  practice: string[]; lastAt: string | null;
};

export function ClassView({ api, parent }: { api: Api; parent: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [units, setUnits] = useState<{ n: number; title: string; grade: string }[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const load = async () => {
    try { const r = await api("/api/beginners/students"); setRows(r.students); setUnits(r.units); setError(""); }
    catch (e: any) { setError(e?.message || "Couldn't load your students."); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setStart = async (id: number, unit: number) => {
    setSaving(id);
    try { await api(`/api/beginners/students/${id}/start-unit`, { method: "POST", body: JSON.stringify({ unit }) }); await load(); }
    catch (e: any) { setError(e?.message || "Couldn't save that."); }
    finally { setSaving(null); }
  };
  const who = parent ? "your children" : "your students";
  if (error) return <p className="bg-note" role="alert">{error}</p>;
  if (!rows) return <div className="bg-loading" aria-label="Loading" />;
  if (!rows.length) return <div className="bg-empty"><p>None of {who} {parent ? "are linked yet" : "have joined your class yet"}. When they read in Beginners, their lessons, reading scores and practice words show up here.</p></div>;
  return (
    <div className="bg-class">
      <p className="bg-step-hint">Beginners points go on the same Reader leaderboard and count toward the same prizes. A lesson's first pass counts as a passed quiz toward prize goals.</p>
      <div className="bg-class-list">
        {rows.map((r) => (
          <article key={r.id} className="bg-kid">
            <header className="bg-kid-head">
              <span className="bg-kid-avatar" aria-hidden="true">{r.name.charAt(0).toUpperCase()}</span>
              <div>
                <h3>{r.name}</h3>
                <p>{r.grade ? `Grade ${r.grade}` : "Grade not set"}{r.lastAt ? `, last read ${new Date(r.lastAt).toLocaleDateString()}` : ", hasn't started yet"}</p>
              </div>
            </header>
            <dl className="bg-kid-facts">
              <div><dt>Lessons passed</dt><dd>{r.passed} of {r.lessons}</dd></div>
              <div><dt>Stars</dt><dd><Stars n={Math.min(3, Math.round((r.stars / Math.max(1, r.passed * 3)) * 3))} size={16} label={`${r.stars} stars`} /> {r.stars}</dd></div>
              <div><dt>Read-aloud accuracy</dt><dd>{r.reading ? `${r.reading.accuracy}%` : "Not yet"}</dd></div>
              <div><dt>Words a minute</dt><dd>{r.reading ? r.reading.wcpm : "Not yet"}</dd></div>
              <div><dt>Beginners points</dt><dd>{r.points}</dd></div>
              <div><dt>Up next</dt><dd>{r.next ? `Unit ${r.next.unit}: ${r.next.title}` : "Everything passed!"}</dd></div>
            </dl>
            {r.readings.length > 1 && (
              <div className="bg-kid-chart" aria-label="Recent read-aloud accuracy, oldest to newest">
                {r.readings.slice().reverse().map((x, i) => <i key={i} title={`${x.accuracy}% · ${x.wcpm} words a minute`} style={{ height: `${Math.max(8, x.accuracy)}%` }} className={x.accuracy >= 90 ? "is-good" : x.accuracy >= 75 ? "is-ok" : "is-low"} />)}
              </div>
            )}
            {r.practice.length > 0 && <p className="bg-kid-practice">Practicing: {r.practice.map((w) => <span key={w} className="bg-chip">{w}</span>)}</p>}
            <label className="bg-kid-start">Starts at
              <select value={r.startUnit} disabled={saving === r.id} onChange={(e) => void setStart(r.id, Number(e.target.value))}>
                {units.map((u) => <option key={u.n} value={u.n}>Unit {u.n}: {u.title} (grade {u.grade})</option>)}
              </select>
            </label>
          </article>
        ))}
      </div>
    </div>
  );
}
