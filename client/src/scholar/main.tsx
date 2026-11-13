// AriseScholar on the web (arisereader.com/scholar/): the academic leaderboard. Same A.R.I.S.E. accounts.
// Signed out it's a short welcome and sign-in. Teachers get "Give points" (tap a student to give a
// point for work, participation or focus) and the board; students get the board and their own rank.
// Server rules: server/scholar.ts.
import "../lib/accountStorageBoot";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { API_BASE, apiAuthToken } from "@/lib/queryClient";
import { PERIODS, SCHOLAR_CATEGORIES, boardName, type BoardRow, type ScholarPeriod } from "@shared/scholar";
import "./scholar.css";

type Me = { id: number; name: string; role: string; canGive: boolean; schoolId: number | null; schoolName: string };
type Student = { id: number; name: string; group: string };
type Tap = { id: string; studentId: number; category: string; at: string };
type Board = { period: ScholarPeriod; schoolName: string; rows: (BoardRow & { you?: boolean })[]; me: BoardRow | null; total: number };

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = apiAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method, credentials: "include",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Something went wrong. Try again.");
  return data as T;
}

function Crest({ size = 34 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="14" fill="#101a33" /><path d="M32 14 8 26l24 12 20-10v14h4V26z" fill="#e8b33a" /><path d="M18 34v9c0 4 6 8 14 8s14-4 14-8v-9l-14 7z" fill="#e8b33a" /></svg>;
}

function Root() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="sc-blank" />;
  return user ? <ScholarApp /> : <Welcome />;
}

// ---------- Signed out ----------
function Welcome() {
  const { login } = useAuth();
  const [username, setUsername] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await login(username.trim(), password); } catch (err: any) { setError(String(err?.message || "Couldn't sign in.").replace(/^\d+:\s*/, "").replace(/^\{"message":"(.*)"\}$/, "$1")); }
    finally { setBusy(false); }
  };
  return <div className="sc-welcome">
    <header className="sc-top"><Crest /><span className="sc-brand">AriseScholar</span></header>
    <main className="sc-hero">
      <div>
        <p className="sc-kicker">The academic leaderboard</p>
        <h1>Effort climbs the board.</h1>
        <p className="sc-lede">Finish your work, join in, stay focused. Every time a teacher sees it, you earn a point, and the whole school can see who's on top this week.</p>
        <ul className="sc-cats">{SCHOLAR_CATEGORIES.map((c) => <li key={c.id}><span>{c.emoji}</span>{c.label}</li>)}</ul>
      </div>
      <form className="sc-card sc-signin" onSubmit={submit}>
        <h2>Sign in</h2>
        <p className="sc-muted">Use your A.R.I.S.E. account, the same one as Arise Reader.</p>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <p className="sc-error">{error}</p>}
        <button className="sc-btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  </div>;
}

// ---------- Signed in ----------
function ScholarApp() {
  const { logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null), [error, setError] = useState("");
  const [tab, setTab] = useState<"give" | "board">("board");
  const [present, setPresent] = useState(false);
  useEffect(() => { api<Me>("GET", "/api/scholar/me").then((m) => { setMe(m); if (m.canGive) setTab("give"); }).catch((e) => setError(e.message)); }, []);
  if (error) return <Shell onLogout={logout}><div className="sc-card"><p className="sc-error">{error}</p></div></Shell>;
  if (!me) return <div className="sc-blank" />;
  if (present) return <BoardView me={me} big onExit={() => setPresent(false)} />;
  return <Shell me={me} onLogout={logout} tabs={me.canGive ? <nav className="sc-tabs">
    <button className={tab === "give" ? "on" : ""} onClick={() => setTab("give")}>Give points</button>
    <button className={tab === "board" ? "on" : ""} onClick={() => setTab("board")}>Leaderboard</button>
  </nav> : null}>
    {!me.schoolId ? <div className="sc-card"><h2>No school yet</h2><p className="sc-muted">Your account isn't connected to a school, so there's no board to show. Ask your teacher or the school's A.R.I.S.E. admin.</p></div>
      : tab === "give" && me.canGive ? <GiveView me={me} /> : <BoardView me={me} onPresent={me.canGive ? () => setPresent(true) : undefined} />}
  </Shell>;
}

function Shell({ me, onLogout, tabs, children }: { me?: Me; onLogout: () => void; tabs?: ReactNode; children: ReactNode }) {
  return <div className="sc-app">
    <header className="sc-top">
      <Crest /><span className="sc-brand">AriseScholar</span>
      {me?.schoolName && <span className="sc-school">{me.schoolName}</span>}
      <button className="sc-link" onClick={onLogout} style={{ marginLeft: "auto" }}>Sign out</button>
    </header>
    {tabs}
    <main className="sc-main">{children}</main>
  </div>;
}

// ---------- Teacher: tap to give ----------
function GiveView({ me }: { me: Me }) {
  const [students, setStudents] = useState<Student[] | null>(null), [today, setToday] = useState<Tap[]>([]);
  const [cat, setCat] = useState(SCHOLAR_CATEGORIES[0].id), [q, setQ] = useState(""), [group, setGroup] = useState("");
  const [toast, setToast] = useState<{ text: string; ids: string[] } | null>(null), [error, setError] = useState("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    api<{ students: Student[]; today: Tap[] }>("GET", "/api/scholar/students").then((r) => { setStudents(r.students); setToday(r.today); }).catch((e) => setError(e.message));
    try { const g = localStorage.getItem(`scholar-group:${me.id}`); if (g) setGroup(g); } catch { /* fine */ }
  }, [me.id]);
  const groups = useMemo(() => [...new Set((students || []).map((s) => s.group).filter(Boolean))].sort(), [students]);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (students || []).filter((s) => (!group || s.group === group) && words.every((w) => s.name.toLowerCase().includes(w)));
  }, [students, q, group]);
  const counts = useMemo(() => { const m = new Map<number, number>(); for (const t of today) m.set(t.studentId, (m.get(t.studentId) || 0) + 1); return m; }, [today]);
  const show = (text: string, ids: string[]) => { setToast({ text, ids }); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(null), 6000); };
  const c = SCHOLAR_CATEGORIES.find((x) => x.id === cat)!;

  const give = useCallback(async (ids: number[], label: string) => {
    setError("");
    try {
      const r = await api<{ given: Tap[]; skipped: number[] }>("POST", "/api/scholar/give", { studentIds: ids, category: cat });
      setToday((t) => [...t, ...r.given]);
      if (r.given.length) show(`+1 ${c.short} · ${label}`, r.given.map((g) => g.id));
      if (r.skipped.length) setError(r.given.length ? `${r.skipped.length} already had 5 ${c.short} points from you today.` : `Already 5 ${c.short} points from you today.`);
    } catch (e: any) { setError(e.message); }
  }, [cat, c.short]);
  const undo = async () => {
    if (!toast) return;
    const ids = toast.ids; setToast(null);
    for (const id of ids) { try { await api("POST", "/api/scholar/undo", { id }); setToday((t) => t.filter((x) => x.id !== id)); } catch (e: any) { setError(e.message); } }
  };

  if (error && !students) return <div className="sc-card"><p className="sc-error">{error}</p></div>;
  if (!students) return <p className="sc-muted">Loading students…</p>;
  return <div>
    <div className="sc-cat-pick" role="radiogroup" aria-label="What the point is for">
      {SCHOLAR_CATEGORIES.map((x) => <button key={x.id} role="radio" aria-checked={x.id === cat} className={x.id === cat ? "on" : ""} onClick={() => setCat(x.id)}><span>{x.emoji}</span>{x.label}</button>)}
    </div>
    <div className="sc-filters">
      <input className="sc-search" placeholder="Find a student" value={q} onChange={(e) => setQ(e.target.value)} />
      {groups.length > 0 && <select value={group} onChange={(e) => { setGroup(e.target.value); try { localStorage.setItem(`scholar-group:${me.id}`, e.target.value); } catch { /* fine */ } }}>
        <option value="">All students</option>{groups.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>}
    </div>
    <div className="sc-hint"><span>Tap a student to give +1 {c.label.toLowerCase()}.</span>{shown.length > 1 && (group || q) && <button className="sc-link" onClick={() => give(shown.map((s) => s.id), `${shown.length} students`)}>Give all {shown.length} shown</button>}</div>
    {error && <p className="sc-error">{error}</p>}
    {shown.length === 0 ? <p className="sc-muted">No students match.</p> : <div className="sc-grid">
      {shown.map((s) => <button key={s.id} className="sc-kid" onClick={() => give([s.id], boardName(s.name))}>
        <span className="sc-avatar">{s.name.trim().charAt(0).toUpperCase()}</span>
        <span className="sc-kid-name">{s.name}</span>
        {counts.get(s.id) ? <span className="sc-count" title="Points you gave today">+{counts.get(s.id)}</span> : null}
      </button>)}
    </div>}
    {toast && <div className="sc-toast" role="status"><span>{toast.text}</span><button onClick={undo}>Undo</button></div>}
  </div>;
}

// ---------- The board ----------
function BoardView({ me, big, onPresent, onExit }: { me: Me; big?: boolean; onPresent?: () => void; onExit?: () => void }) {
  const [period, setPeriod] = useState<ScholarPeriod>("week"), [board, setBoard] = useState<Board | null>(null), [error, setError] = useState("");
  const load = useCallback(() => api<Board>("GET", `/api/scholar/board?period=${period}`).then((b) => { setBoard(b); setError(""); }).catch((e) => setError(e.message)), [period]);
  useEffect(() => { setBoard(null); void load(); const t = window.setInterval(load, big ? 15_000 : 30_000); return () => window.clearInterval(t); }, [load, big]);
  const top3 = board?.rows.slice(0, 3) || [], rest = board?.rows.slice(3) || [];
  const order = [top3[1], top3[0], top3[2]];
  return <div className={big ? "sc-present" : ""}>
    {big && <header className="sc-top"><Crest size={44} /><span className="sc-brand">AriseScholar</span><span className="sc-school">{board?.schoolName}</span><button className="sc-link" style={{ marginLeft: "auto" }} onClick={onExit}>Close</button></header>}
    <div className="sc-board-head">
      <div className="sc-periods">{PERIODS.map((p) => <button key={p.id} className={p.id === period ? "on" : ""} onClick={() => setPeriod(p.id)}>{p.label}</button>)}</div>
      {onPresent && <button className="sc-btn sc-btn-quiet" onClick={onPresent}>Show on the board</button>}
    </div>
    {error && <p className="sc-error">{error}</p>}
    {board?.me && <div className="sc-mine">
      <div><p className="sc-kicker">You</p><p className="sc-mine-rank">{board.me.rank ? `#${board.me.rank}` : "Not on the board yet"}</p></div>
      <div className="sc-mine-pts"><b>{board.me.points}</b><span>points</span></div>
      <div className="sc-mine-split">{SCHOLAR_CATEGORIES.map((c) => <span key={c.id}>{c.emoji} {(board.me as any)[c.id] || 0}</span>)}</div>
    </div>}
    {!board ? <p className="sc-muted">Loading the board…</p> : board.rows.length === 0 ? <div className="sc-card sc-empty"><h2>The board is empty</h2><p className="sc-muted">{PERIODS.find((p) => p.id === period)?.label}: no points yet. The first point puts someone on top.</p></div> : <>
      <div className="sc-podium">{order.map((r, i) => r ? <div key={r.studentId + r.name} className={`sc-step sc-step-${r.rank <= 3 ? r.rank : 3} ${r.you ? "you" : ""}`} style={{ order: i }}>
        <span className="sc-medal">{r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}</span>
        <span className="sc-step-name">{r.name}{r.you ? " (you)" : ""}</span>
        <span className="sc-step-pts">{r.points}</span>
        <span className="sc-block" />
      </div> : <div key={i} style={{ order: i }} />)}</div>
      {rest.length > 0 && <ol className="sc-list">{rest.map((r) => <li key={`${r.rank}-${r.name}-${r.studentId}`} className={r.you ? "you" : ""}>
        <span className="sc-rank">{r.rank}</span><span className="sc-name">{r.name}{r.you ? " (you)" : ""}</span>
        <span className="sc-split">{SCHOLAR_CATEGORIES.map((c) => <span key={c.id} title={c.label}>{c.emoji}{(r as any)[c.id] || 0}</span>)}</span>
        <span className="sc-pts">{r.points}</span>
      </li>)}</ol>}
      {board.total > board.rows.length && <p className="sc-muted sc-center">Top {board.rows.length} of {board.total} students.</p>}
    </>}
  </div>;
}

createRoot(document.getElementById("root")!).render(<AuthProvider><Root /></AuthProvider>);
