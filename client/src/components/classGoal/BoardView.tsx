// What the students see on the classroom board: the reward filling up, the points, and a cheer
// whenever the teacher adds some. Reads nothing but the goal; the teacher's controls live elsewhere.
import { useEffect, useMemo, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { leftLabel, milestonesOf, phaseOf, progressOf, type Goal } from "@shared/classGoals";
import Vessel from "./Vessel";
import { chime, confetti, prefersReducedMotion } from "./effects";

type Cheer = { key: number; amount: number; emoji: string; color: string; name: string; reason: string };
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

function saying(pct: number): string {
  if (pct >= 90) return "So close!";
  if (pct >= 75) return "Almost there!";
  if (pct >= 50) return "Past halfway!";
  if (pct >= 25) return "Great start!";
  if (pct > 0) return "We're on our way!";
  return "Let's get started!";
}

/** A number that counts up to its new value instead of jumping. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion() || from.current === value) { from.current = value; setShown(value); return; }
    const start = performance.now(), a = from.current, ms = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(Math.round(a + (value - a) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value]);
  return <>{shown}</>;
}

export default function BoardView({ goal, today, sound, onOpenControls }: { goal: Goal; today: string; sound: boolean; onOpenControls: () => void }) {
  const prog = useMemo(() => progressOf(goal), [goal]);
  const phase = phaseOf(goal, today);
  const left = leftLabel(goal, today);
  const marks = useMemo(() => milestonesOf(goal), [goal]);
  const reached = phase === "reached" || phase === "given";

  // ── Moments: a cheer for new points, a toast at each quarter, confetti when the goal is met ──
  const [cheer, setCheer] = useState<Cheer | null>(null);
  const [toast, setToast] = useState<string>("");
  const seen = useRef<{ goalId: string; ids: Set<string>; points: number; reached: boolean } | null>(null);
  const confettiCanvas = useRef<HTMLCanvasElement>(null);
  const stopConfetti = useRef<() => void>(() => {});
  const keyN = useRef(0);
  useEffect(() => {
    const ids = new Set(goal.entries.map((e) => e.id));
    const prev = seen.current;
    seen.current = { goalId: goal.id, ids, points: prog.points, reached };
    if (!prev || prev.goalId !== goal.id) return;           // first look at this goal: no fuss
    const fresh = goal.entries.filter((e) => !prev.ids.has(e.id));
    if (fresh.length && prog.points > prev.points) {
      const total = fresh.reduce((s, e) => s + e.amount, 0);
      const last = fresh[fresh.length - 1];
      const cat = prog.byCategory.find((c) => c.id === last.categoryId);
      setCheer({ key: ++keyN.current, amount: total, emoji: cat?.emoji ?? "⭐", color: cat?.color ?? "#FFC933", name: cat?.name ?? (last.category || "Other"), reason: fresh.length === 1 ? last.reason : "" });
      if (sound && !(reached && !prev.reached)) chime("small");
    }
    if (reached && !prev.reached) {
      setToast("");
      if (sound) chime("big");
      stopConfetti.current(); stopConfetti.current = confetti(confettiCanvas.current, 3);
    } else if (prog.points > prev.points) {
      const crossed = marks.filter((m) => m.pct < 100 && m.reached && prev.points < m.at).pop();
      if (crossed) setToast(crossed.pct === 50 ? "Halfway there!" : crossed.pct === 25 ? "A quarter of the way!" : "Three quarters done!");
    }
  }, [goal, prog.points, reached]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!cheer) return; const t = window.setTimeout(() => setCheer(null), 9000); return () => window.clearTimeout(t); }, [cheer]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(""), 6000); return () => window.clearTimeout(t); }, [toast]);
  useEffect(() => () => stopConfetti.current(), []);

  // ── Words ──
  const name = goal.reward.name;
  let headline = name, sub = goal.reward.note, togo: React.ReactNode, say = saying(prog.pct);
  if (phase === "given") { headline = "We earned it!"; sub = `${name}, enjoy!`; togo = <>Goal complete</>; say = ""; }
  else if (phase === "reached") { headline = "We did it!"; sub = `${name} time!` + (goal.reward.note ? ` ${goal.reward.note}` : ""); togo = <>Goal reached</>; say = ""; }
  else if (phase === "ended") { togo = <>Time's up, we got {prog.points} of {prog.target}</>; say = "Great effort, class!"; }
  else if (phase === "upcoming") { togo = <>{plural(prog.target, "point")} to earn</>; say = `Starts ${new Date(`${goal.startsOn}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}`; }
  else togo = <><b><CountUp value={prog.remaining} /></b> {prog.remaining === 1 ? "point" : "points"} to go</>;

  // Category slices of the track, scaled down if the class went past the goal.
  const scale = prog.points > prog.target ? prog.target / prog.points : 1;
  const slices = prog.byCategory.filter((c) => c.points > 0).map((c) => ({ ...c, w: (c.points / prog.target) * 100 * scale }));

  return (
    <main className={`cg-board cg-phase-${phase}`} aria-label="Class goal board">
      <canvas ref={confettiCanvas} className="cg-confetti" aria-hidden />
      <header className="cg-top">
        <p className="cg-goal">{goal.className && <b>{goal.className}</b>}<span>{goal.title || "Class goal"}</span></p>
        {left && phase === "active" && <span className={"cg-days" + (left === "Last day!" ? " is-last" : "")}>{left}</span>}
      </header>

      <section className="cg-stage">
        <Vessel emoji={goal.reward.emoji} pct={prog.pct} reached={reached} />
        <div className="cg-info">
          <h1 className="cg-reward" data-size={headline.length > 22 ? "l" : headline.length > 12 ? "m" : "s"}>{headline}</h1>
          {sub && <p className="cg-sub">{sub}</p>}

          <div className="cg-score" aria-live="polite">
            <span className="cg-score-n"><CountUp value={prog.points} /></span>
            <span className="cg-score-of">of {prog.target} points</span>
          </div>

          <div className="cg-track" role="progressbar" aria-valuemin={0} aria-valuemax={prog.target} aria-valuenow={Math.min(prog.points, prog.target)} aria-label="Points toward the goal">
            <div className="cg-slices">{slices.map((c) => <i key={c.id} style={{ width: `${c.w}%`, background: c.color }} />)}</div>
            {marks.map((m) => m.pct < 100
              ? <span key={m.pct} className={"cg-mark" + (m.reached ? " is-on" : "")} style={{ left: `${m.pct}%` }}><em>{m.at}</em></span>
              : <span key={m.pct} className={"cg-mark cg-mark-end" + (m.reached ? " is-on" : "")} style={{ left: "100%" }}><u>{goal.reward.emoji}</u></span>)}
          </div>

          <p className="cg-togo">{togo}{say && <span className="cg-say">{say}</span>}</p>

          <ul className="cg-legend">
            {prog.byCategory.map((c) => (
              <li key={c.id} style={{ "--c": c.color } as React.CSSProperties}><i aria-hidden />{c.emoji} <span>{c.name}</span> <b>{c.points}</b></li>
            ))}
          </ul>
        </div>
      </section>

      <div className="cg-floor" aria-live="polite">
        {toast && <p key={toast} className="cg-toast">{toast}</p>}
        {cheer && !toast && (
          <p key={cheer.key} className="cg-cheer" style={{ "--c": cheer.color } as React.CSSProperties}>
            <b>+{cheer.amount}</b> <span>{cheer.emoji} {cheer.name}</span>{cheer.reason && <em>{cheer.reason}</em>}
          </p>
        )}
      </div>

      <HoldButton onOpen={onOpenControls} />
    </main>
  );
}

/** Opens the teacher's controls. Students tapping the board by accident get nothing: it takes a
 *  hold of about a second (or the keyboard) so the goal isn't changed by mistake. */
function HoldButton({ onOpen }: { onOpen: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef(0);
  const cancel = () => { window.clearTimeout(timer.current); setHolding(false); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button" className={"cg-gear" + (holding ? " is-holding" : "")} aria-label="Teacher controls (press and hold)" title="Teacher controls: press and hold"
      onPointerDown={(e) => { if (e.pointerType === "mouse" && e.button !== 0) return; setHolding(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { setHolding(false); onOpen(); }, 900); }}
      onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel} onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
    >
      <svg className="cg-gear-ring" viewBox="0 0 44 44" aria-hidden><circle cx="22" cy="22" r="20" /></svg>
      <Settings size={22} aria-hidden />
    </button>
  );
}
