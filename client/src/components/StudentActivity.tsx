// A student's activity for the admin: when they signed in, which quizzes they
// started and took, and exactly how every point was earned.
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/queryClient";

type Item = { at: string; kind: string; title: string; detail?: string; points?: number; tone?: "pass" | "fail" | "flag" | "info" };
type Activity = {
  summary: {
    lastLogin: string | null; loginsLast30: number; quizzesTaken: number; quizzesPassed: number; passedThisWeek: number; lastQuiz: string | null;
    points: { quizzes: number; recordedQuizzes: number; manual: number }; loginHistoryComplete: boolean;
  };
  items: Item[];
};

const FILTERS = [
  { id: "all", label: "Everything", kinds: null },
  { id: "logins", label: "Sign-ins", kinds: ["login", "logout", "signup"] },
  { id: "quizzes", label: "Quizzes", kinds: ["quiz_taken", "quiz_started", "quiz_recorded", "reading_test"] },
  { id: "points", label: "Points", kinds: null },
  { id: "play", label: "Games & worlds", kinds: ["game", "world"] },
] as const;

const KIND_LABEL: Record<string, string> = {
  login: "Sign-in", logout: "Sign-out", signup: "New account", quiz_started: "Quiz", quiz_taken: "Quiz", quiz_recorded: "Recorded quiz",
  points_added: "Points", reading_test: "Reading test", message: "Message", world: "World", game: "Game",
};

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const ago = (iso: string | null) => {
  if (!iso) return "Never";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
};

export default function StudentActivity({ studentId, token, refreshKey = 0 }: { studentId: number; token: string; refreshKey?: number }) {
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [shown, setShown] = useState(40);

  useEffect(() => {
    let alive = true;
    setData(null); setError(""); setShown(40);
    fetch(`${API_BASE}/api/admin/students/${studentId}/activity`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!alive) return; if (r.ok) setData(d); else setError(d.message || "Could not load activity."); })
      .catch(() => alive && setError("Could not load activity."));
    return () => { alive = false; };
  }, [studentId, token, refreshKey]);

  const items = useMemo(() => {
    if (!data) return [];
    const f = FILTERS.find((x) => x.id === filter)!;
    if (filter === "points") return data.items.filter((i) => (i.points ?? 0) > 0);
    return f.kinds ? data.items.filter((i) => (f.kinds as readonly string[]).includes(i.kind)) : data.items;
  }, [data, filter]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground py-3">Loading activity…</p>;
  const s = data.summary, totalPts = s.points.quizzes + s.points.recordedQuizzes + s.points.manual;

  // group the timeline by day
  const groups: { day: string; items: Item[] }[] = [];
  for (const i of items.slice(0, shown)) {
    const d = day(i.at);
    if (groups[groups.length - 1]?.day !== d) groups.push({ day: d, items: [] });
    groups[groups.length - 1].items.push(i);
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="rounded-lg bg-muted/30 p-2"><dt className="text-[11px] text-muted-foreground">Last signed in</dt><dd className="text-sm font-semibold" title={s.lastLogin ? when(s.lastLogin) : undefined}>{ago(s.lastLogin)}</dd></div>
        <div className="rounded-lg bg-muted/30 p-2"><dt className="text-[11px] text-muted-foreground">Sign-ins, last 30 days</dt><dd className="text-sm font-semibold">{s.loginsLast30}</dd></div>
        <div className="rounded-lg bg-muted/30 p-2"><dt className="text-[11px] text-muted-foreground">Quizzes passed</dt><dd className="text-sm font-semibold">{s.quizzesPassed} of {s.quizzesTaken}</dd></div>
        <div className="rounded-lg bg-muted/30 p-2"><dt className="text-[11px] text-muted-foreground">Passed this week</dt><dd className={`text-sm font-semibold ${s.passedThisWeek ? "text-green-400" : "text-amber-300"}`}>{s.passedThisWeek ? `${s.passedThisWeek} · games unlocked` : "0 · games locked"}</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Points from sources here: <b className="text-foreground">{totalPts}</b> = {s.points.quizzes} from quizzes on the site
        {s.points.recordedQuizzes ? ` + ${s.points.recordedQuizzes} from quizzes recorded by staff` : ""}
        {s.points.manual ? ` + ${s.points.manual} added by staff` : ""}. Eye-gaze activities and older imported totals aren't listed here.
      </p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => { setFilter(f.id); setShown(40); }} aria-pressed={filter === f.id}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${filter === f.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? <p className="text-sm text-muted-foreground py-3 text-center">Nothing to show yet.</p> : (
        <ol className="space-y-3">
          {groups.map((g) => (
            <li key={g.day}>
              <h5 className="text-[11px] font-semibold text-muted-foreground mb-1">{g.day}</h5>
              <ol className="border-l border-border ml-1.5 space-y-2">
                {g.items.map((i, k) => (
                  <li key={k} className="relative pl-4">
                    <span aria-hidden className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${i.tone === "pass" ? "bg-green-400" : i.tone === "fail" ? "bg-red-400" : i.tone === "flag" ? "bg-amber-400" : "bg-slate-400"}`} />
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm"><span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1.5">{KIND_LABEL[i.kind] ?? i.kind}</span>{i.title}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{new Date(i.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    {(i.detail || i.points) && (
                      <p className="text-xs text-muted-foreground">
                        {i.points ? <b className="text-green-400 mr-1.5">+{i.points} pts</b> : null}{i.detail}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
      {items.length > shown && <button type="button" className="text-xs font-medium text-primary" onClick={() => setShown((n) => n + 60)}>Show older activity</button>}
      {!s.loginHistoryComplete && <p className="text-[11px] text-muted-foreground">Full sign-in history starts today. Earlier sign-ins only show when that device is still signed in.</p>}
    </div>
  );
}
