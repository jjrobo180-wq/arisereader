// The prizes a reader can win, shown as tickets: from a parent, from their
// teacher, from their school. Shows nothing at all when there are none, so it
// can sit on any page. A.R.I.S.E. gives no prizes; these come from grown-ups.
import { useEffect, useState, type ReactNode } from "react";
import { Home, School, Trophy, Users } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { prettyDay, type PrizeScope, type PrizeView } from "@shared/prizes";
import "./prizes.css";

const STUB: Record<PrizeScope, { label: string; icon: ReactNode }> = {
  family: { label: "Home", icon: <Home aria-hidden /> },
  class: { label: "Class", icon: <Users aria-hidden /> },
  school: { label: "School", icon: <School aria-hidden /> },
};

/** The ticket shape. The stub says where the prize comes from. */
export function Ticket({ scope, state, won, children }: { scope: PrizeScope; state: string; won?: boolean; children: ReactNode }) {
  const stub = won ? { label: "Won", icon: <Trophy aria-hidden /> } : STUB[scope];
  return (
    <li className={`pz-ticket pz-${scope} is-${state}`}>
      <div className="pz-stub">{stub.icon}<span>{stub.label}</span></div>
      <div className="pz-body">{children}</div>
    </li>
  );
}

export function QuizProgress({ passed, goal }: { passed: number; goal: number }) {
  const shown = Math.min(passed, goal);
  return (
    <div className="pz-progress">
      <div className="pz-bar" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={shown} aria-label="Quizzes passed">
        <i style={{ width: `${goal ? Math.round((shown / goal) * 100) : 0}%` }} />
      </div>
      <span><b>{shown} of {goal}</b> {goal === 1 ? "quiz" : "quizzes"} passed</span>
    </div>
  );
}

/** The line under a ticket that says where things stand. `who` is null for the reader themself, or a child's name. */
function standing(p: PrizeView, who: string | null): { text: string; tone: "" | "good" | "gold" } | null {
  const giver = p.by || p.from;
  switch (p.state) {
    case "yours":
      return { tone: "gold", text: who ? `${who} won this.` : `You won this! Ask ${giver} how to collect it.` };
    case "won":
      return { tone: "", text: `Won by ${p.winner || "another reader"}.` };
    case "reached":
      return { tone: "good", text: who ? `${who} reached the goal.` : `You reached the goal! Let ${giver} know.` };
    case "ended":
      return { tone: "", text: `The last day has passed. ${giver} decides who gets it.` };
    default:
      return p.endsOn ? { tone: "", text: `Last day: ${prettyDay(p.endsOn)}` } : null;
  }
}

type Props = {
  token: string | null | undefined;
  /** A parent looking at one of their children. */
  studentId?: number | null;
  /** That child's name, so the wording is about them. */
  childName?: string;
  heading?: string;
  /** Shown when there is nothing to win. Left out, the board shows nothing at all. */
  emptyHint?: string;
  /** Only prizes from these places. */
  scopes?: PrizeScope[];
};

export function PrizeBoard({ token, studentId, childName, heading = "Prizes you can win", emptyHint, scopes }: Props) {
  const [prizes, setPrizes] = useState<PrizeView[] | null>(null);

  useEffect(() => {
    if (!token) { setPrizes(null); return; }
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/prizes${studentId ? `?studentId=${studentId}` : ""}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const data = res.ok ? await res.json() : null;
        if (alive) setPrizes(Array.isArray(data?.prizes) ? data.prizes : []);
      } catch { if (alive) setPrizes([]); }
    };
    load();
    // passing a quiz can move a prize's progress bar
    window.addEventListener("arise-points-updated", load);
    return () => { alive = false; window.removeEventListener("arise-points-updated", load); };
  }, [token, studentId]);

  const shown = (prizes || []).filter((p) => !scopes || scopes.includes(p.scope));
  if (!token || !prizes) return null;
  if (!shown.length) return emptyHint ? <p className="pz pz-empty">{emptyHint}</p> : null;

  const who = studentId ? childName || "Your child" : null;
  return (
    <section className="pz" aria-label={heading} data-testid="prize-board">
      <div className="pz-head">
        <h3>{heading}</h3>
        <p>{who ? "These come from their teacher or school." : "These come from your family, your teacher or your school."}</p>
      </div>
      <ul className="pz-list">
        {shown.map((p) => {
          const line = standing(p, who);
          return (
            <Ticket key={p.id} scope={p.scope} state={p.state} won={p.state === "yours"}>
              {p.state === "yours" && <span className="pz-stamp">{who ? "Won" : "Yours"}</span>}
              <h4 className="pz-title">{p.title}</h4>
              <p className="pz-from">From {p.from}</p>
              {p.how && <p className="pz-how">{p.how}</p>}
              {p.quizGoal > 0 && p.state !== "won" && p.state !== "yours" && <QuizProgress passed={p.passed ?? 0} goal={p.quizGoal} />}
              {line && <p className={`pz-note ${line.tone}`}>{line.text}</p>}
            </Ticket>
          );
        })}
      </ul>
    </section>
  );
}
