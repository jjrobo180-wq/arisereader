// The admin's view of what a student has been doing: sign-ins, quizzes, where
// their points came from, games and messages, newest first.
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { BookOpen, Gamepad2, LogIn, MessageSquare, Star, ShieldCheck, Flag } from "lucide-react";

type Kind = "login" | "quiz" | "points" | "game" | "message" | "review" | "proctor";
type Item = { at: string; kind: Kind; title: string; detail?: string; points?: number };
type Activity = {
  summary: {
    joined: string | null; totalPoints: number; lastLogin: string | null; loginsThisWeek: number;
    quizzesPassed: number; quizzesTaken: number; gamesPlayed: number;
    points: { onlineQuizzes: number; paperQuizzes: number; addedByStaff: number; dailyChallenge: number };
  };
  items: Item[];
};

const FILTERS: { id: "all" | Kind | "points-all"; label: string }[] = [
  { id: "all", label: "Everything" }, { id: "login", label: "Sign-ins" }, { id: "quiz", label: "Quizzes" },
  { id: "points-all", label: "Points" }, { id: "game", label: "Games" }, { id: "message", label: "Messages" },
];

const ICON: Record<Kind, typeof LogIn> = { login: LogIn, quiz: BookOpen, points: Star, game: Gamepad2, message: MessageSquare, review: Flag, proctor: ShieldCheck };
const TINT: Record<Kind, string> = {
  login: "text-sky-300 bg-sky-500/10", quiz: "text-emerald-300 bg-emerald-500/10", points: "text-amber-300 bg-amber-500/10",
  game: "text-fuchsia-300 bg-fuchsia-500/10", message: "text-slate-300 bg-slate-500/10", review: "text-orange-300 bg-orange-500/10", proctor: "text-violet-300 bg-violet-500/10",
};

const when = (iso: string | null) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric", hour: "numeric", minute: "2-digit" });
};
const dayLabel = (iso: string) => {
  const d = new Date(iso), today = new Date(), y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};

export default function StudentActivity({ studentId, token, refreshKey = 0 }: { studentId: number; token: string; refreshKey?: number }) {
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [shown, setShown] = useState(60);

  useEffect(() => {
    let alive = true;
    setError("");
    fetch(`${API_BASE}/api/admin/students/${studentId}/activity`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.message || "Could not load activity."); if (alive) setData(d); })
      .catch((e) => alive && setError(e.message || "Could not load activity."));
    return () => { alive = false; };
  }, [studentId, token, refreshKey]);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (filter === "all") return all;
    if (filter === "points-all") return all.filter((i) => i.kind === "points" || (i.kind === "quiz" && (i.points ?? 0) > 0));
    if (filter === "quiz") return all.filter((i) => i.kind === "quiz" || i.kind === "review" || i.kind === "proctor");
    return all.filter((i) => i.kind === filter);
  }, [data, filter]);

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground py-4">Loading activity…</p>;
  const s = data.summary;
  const groups: { day: string; list: Item[] }[] = [];
  for (const it of items.slice(0, shown)) {
    const day = dayLabel(it.at);
    if (groups[groups.length - 1]?.day !== day) groups.push({ day, list: [] });
    groups[groups.length - 1].list.push(it);
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="p-2 rounded-lg bg-muted/30"><dt className="text-[11px] text-muted-foreground">Last sign-in</dt><dd className="text-sm font-semibold">{when(s.lastLogin)}</dd></div>
        <div className="p-2 rounded-lg bg-muted/30"><dt className="text-[11px] text-muted-foreground">Sign-ins this week</dt><dd className="text-sm font-semibold">{s.loginsThisWeek}</dd></div>
        <div className="p-2 rounded-lg bg-muted/30"><dt className="text-[11px] text-muted-foreground">Quizzes passed</dt><dd className="text-sm font-semibold">{s.quizzesPassed} of {s.quizzesTaken}</dd></div>
        <div className="p-2 rounded-lg bg-muted/30"><dt className="text-[11px] text-muted-foreground">Games played</dt><dd className="text-sm font-semibold">{s.gamesPlayed}</dd></div>
      </dl>

      <div className="p-3 rounded-lg bg-muted/30">
        <p className="text-xs font-semibold mb-2">Where the {s.totalPoints} points came from</p>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <li><b>{s.points.onlineQuizzes}</b> <span className="text-muted-foreground text-xs block">Online quizzes</span></li>
          <li><b>{s.points.paperQuizzes}</b> <span className="text-muted-foreground text-xs block">Paper quizzes</span></li>
          <li><b>{s.points.addedByStaff}</b> <span className="text-muted-foreground text-xs block">Added by staff</span></li>
          <li><b>{s.points.dailyChallenge}</b> <span className="text-muted-foreground text-xs block">Daily Quick Challenge</span></li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Show activity">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => { setFilter(f.id); setShown(60); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === f.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? <p className="text-sm text-muted-foreground py-3">Nothing here yet.</p> : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.day}>
              <h5 className="text-[11px] font-semibold text-muted-foreground mb-1">{g.day}</h5>
              <ol className="space-y-1.5">
                {g.list.map((it, i) => {
                  const Icon = ICON[it.kind];
                  return (
                    <li key={i} className="flex gap-2.5 p-2 rounded-lg bg-muted/20">
                      <span className={`mt-0.5 grid place-items-center w-7 h-7 rounded-full flex-shrink-0 ${TINT[it.kind]}`}><Icon className="w-3.5 h-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{it.title}</p>
                        {it.detail && <p className="text-xs text-muted-foreground break-words">{it.detail}</p>}
                      </div>
                      <time className="text-[11px] text-muted-foreground whitespace-nowrap" dateTime={it.at}>{new Date(it.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {items.length > shown && <button type="button" className="w-full text-sm py-2 rounded-lg border border-border hover:bg-muted/30" onClick={() => setShown((n) => n + 100)}>Show more ({items.length - shown} older)</button>}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Sign-ins from before today are shown where the site still has a record of them; every new sign-in is logged with the device used.</p>
    </div>
  );
}
