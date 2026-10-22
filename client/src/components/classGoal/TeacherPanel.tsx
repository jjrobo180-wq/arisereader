// The teacher's side: add points, change the goal, switch goals. Opens over the board (a hold on the
// gear), closes itself after a quiet minute, and on a phone is the whole screen, so a phone can act
// as the remote while the board shows on the classroom screen.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Maximize2, Minimize2, Plus, Undo2, Volume2, VolumeX, X } from "lucide-react";
import {
  AMOUNTS, MAX_ADD, MAX_GOALS, REASON_IDEAS, leftLabel, newGoalInput, paceOf, phaseOf, progressOf, totalsOf,
  type Goal, type GoalInput, type ClassGoals,
} from "@shared/classGoals";
import GoalForm, { type FormValue } from "./GoalForm";
import { newId, type Link } from "./useClassGoals";

type Send = (op: any) => string;
type Tab = "points" | "goal" | "goals";
const IDLE_MS = 90_000;

const LINK_TEXT: Record<Link, string> = { loading: "Loading…", saved: "Saved", saving: "Saving…", offline: "No connection. Your changes will send when it's back.", signin: "Sign in again to save.", error: "Couldn't save. Try again." };

function reasonsFor(name: string): string[] {
  const n = name.toLowerCase();
  return n.includes("behav") ? REASON_IDEAS.behavior : n.includes("acad") ? REASON_IDEAS.academics : REASON_IDEAS.other;
}

export default function TeacherPanel(props: {
  state: ClassGoals; goal: Goal | null; today: string; link: Link; send: Send; retry: () => void;
  sound: boolean; setSound: (on: boolean) => void; onClose: () => void; startOn?: Tab | "new"; fullBleed?: boolean;
}) {
  const { state, goal, today, link, send, sound, setSound, onClose } = props;
  const [tab, setTab] = useState<Tab | "new">(props.startOn ?? (goal ? "points" : "new"));
  const root = useRef<HTMLDivElement>(null);

  // Quiet for a minute and it closes, so it's never left open in front of the class.
  const idle = useRef(0);
  useEffect(() => {
    if (props.fullBleed) return;
    const reset = () => { window.clearTimeout(idle.current); idle.current = window.setTimeout(onClose, IDLE_MS); };
    reset();
    const el = root.current;
    el?.addEventListener("pointerdown", reset); el?.addEventListener("keydown", reset); el?.addEventListener("input", reset);
    return () => { window.clearTimeout(idle.current); el?.removeEventListener("pointerdown", reset); el?.removeEventListener("keydown", reset); el?.removeEventListener("input", reset); };
  }, [onClose, props.fullBleed]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !props.fullBleed) onClose(); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [onClose, props.fullBleed]);
  useEffect(() => { root.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true }); }, [tab]);

  const [full, setFull] = useState(!!document.fullscreenElement);
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener("fullscreenchange", f); return () => document.removeEventListener("fullscreenchange", f); }, []);
  const toggleFull = () => { try { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); } catch { /* not allowed here */ } };

  const create = (v: FormValue) => {
    const id = newId("g");
    send({ type: "goal.add", id, goal: v });
    send({ type: "board.set", goalId: id });
    setTab("points");
  };

  const tabs: Array<[Tab, string]> = [["points", "Add points"], ["goal", "Edit goal"], ["goals", "All goals"]];
  return (
    <div className="cg-panel-wrap" data-full={props.fullBleed ? "1" : undefined}>
      {!props.fullBleed && <button type="button" className="cg-scrim" aria-label="Close teacher controls" tabIndex={-1} onClick={onClose} />}
      <div className="cg-panel" ref={root} role="dialog" aria-label="Teacher controls">
        <header className="cg-panel-head">
          {props.fullBleed
            ? <a className="cg-back" href="#/workhub"><ArrowLeft size={18} /> WorkHub</a>
            : <button type="button" className="cg-close" onClick={onClose}><ArrowLeft size={18} /> Back to the board</button>}
          <span className={"cg-link is-" + link} role="status">{link === "saved" ? <><Check size={14} /> {LINK_TEXT.saved}</> : LINK_TEXT[link]}{(link === "offline" || link === "error") && <button type="button" onClick={props.retry}>Try now</button>}</span>
        </header>

        {tab === "new" ? (
          <div className="cg-panel-body">
            <h2 className="cg-h2">{goal ? "New class goal" : "Set a goal for your class"}</h2>
            {!goal && <p className="cg-lede">Pick what the class is working toward and the reward. The board for students shows up as soon as you save.</p>}
            <GoalForm mode="create" today={today} initial={newGoalInput(today)} onSubmit={create} onCancel={goal ? () => setTab("goals") : undefined} />
          </div>
        ) : (
          <>
            <nav className="cg-tabs" role="tablist">
              {tabs.map(([id, label]) => <button key={id} role="tab" type="button" aria-selected={tab === id} className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>{label}</button>)}
            </nav>
            <div className="cg-panel-body">
              {tab === "points" && goal && <AddPoints goal={goal} today={today} send={send} />}
              {tab === "goal" && goal && (
                <EditGoal goal={goal} today={today} send={send} onDeleted={() => setTab("goals")} />
              )}
              {tab === "goals" && <AllGoals state={state} today={today} send={send} onNew={() => setTab("new")} onEdit={(id) => { send({ type: "board.set", goalId: id }); setTab("goal"); }} />}
              {!goal && tab !== "goals" && <p className="cg-lede">No goal is on the board yet. <button type="button" className="cg-linkbtn" onClick={() => setTab("new")}>Set one up</button></p>}
            </div>
          </>
        )}

        <footer className="cg-panel-foot">
          <button type="button" className="cg-chip" onClick={() => setSound(!sound)} aria-pressed={sound}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />} Sound {sound ? "on" : "off"}</button>
          {document.documentElement.requestFullscreen && <button type="button" className="cg-chip" onClick={toggleFull}>{full ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {full ? "Exit full screen" : "Full screen"}</button>}
        </footer>
      </div>
    </div>
  );
}

// ── Add points ───────────────────────────────────────────────────────────────────────────────────
function AddPoints({ goal, today, send }: { goal: Goal; today: string; send: Send }) {
  const prog = progressOf(goal);
  const [catId, setCatId] = useState(goal.categories[0]?.id ?? "");
  const cat = goal.categories.find((c) => c.id === catId) ?? goal.categories[0];
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const [undo, setUndo] = useState<{ entryId: string; text: string } | null>(null);
  const undoTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);
  useEffect(() => { if (!goal.categories.some((c) => c.id === catId)) setCatId(goal.categories[0]?.id ?? ""); }, [goal.categories, catId]);

  const add = (amount: number) => {
    if (!cat || !(amount >= 1)) return;
    const entryId = newId("e");
    const n = Math.min(MAX_ADD, Math.round(amount));
    send({ type: "points.add", goalId: goal.id, entryId, amount: n, categoryId: cat.id, reason });
    setUndo({ entryId, text: `Added ${n} ${n === 1 ? "point" : "points"}${reason ? ` for “${reason}”` : ` to ${cat.name}`}` });
    window.clearTimeout(undoTimer.current); undoTimer.current = window.setTimeout(() => setUndo(null), 8000);
    setReason(""); setCustom("");
  };
  const reasons = reasonsFor(cat?.name ?? "");
  const recent = goal.entries.slice(-6).reverse();
  const pace = paceOf(goal, today);
  const phase = phaseOf(goal, today);

  return (
    <div className="cg-add">
      <div className="cg-now">
        <span className="cg-now-emoji" aria-hidden>{goal.reward.emoji}</span>
        <div><b>{goal.reward.name}</b><span>{prog.points} of {prog.target} points{leftLabel(goal, today) ? ` · ${leftLabel(goal, today)}` : ""}</span></div>
        <div className="cg-now-bar" aria-hidden><i style={{ width: `${prog.pct}%` }} /></div>
      </div>
      {phase === "reached" && <p className="cg-banner">The goal is reached. Points still count, or mark the reward as given under Edit goal.</p>}
      {pace && !pace.haveEnough && phase === "active" && <p className="cg-hint">About {pace.needPerDay} {pace.needPerDay === 1 ? "point" : "points"} a day to finish on time.</p>}

      <fieldset className="cg-set">
        <legend>What earned them points?</legend>
        <div className="cg-cat-pick">
          {goal.categories.map((c) => (
            <button type="button" key={c.id} aria-pressed={c.id === cat?.id} className={c.id === cat?.id ? "is-on" : ""} style={{ "--c": c.color } as React.CSSProperties} onClick={() => setCatId(c.id)}>
              <span aria-hidden>{c.emoji}</span>{c.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="cg-set">
        <legend>Why? <span>(optional, shows on the board)</span></legend>
        <div className="cg-chips">{reasons.map((r) => <button type="button" key={r} aria-pressed={reason === r} className={reason === r ? "is-on" : ""} onClick={() => setReason(reason === r ? "" : r)}>{r}</button>)}</div>
        <input aria-label="Your own reason" value={reasons.includes(reason) ? "" : reason} maxLength={80} placeholder="Or type your own" onChange={(e) => setReason(e.target.value)} />
      </fieldset>

      <fieldset className="cg-set">
        <legend>Add points</legend>
        <div className="cg-amounts">
          {AMOUNTS.map((a) => <button type="button" key={a} onClick={() => add(a)}>+{a}</button>)}
        </div>
        <form className="cg-row" onSubmit={(e) => { e.preventDefault(); add(Number(custom)); }}>
          <input aria-label="Another number of points" inputMode="numeric" value={custom} placeholder="Another number" onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          <button type="submit" className="cg-btn cg-btn-main" disabled={!(Number(custom) >= 1)}><Plus size={16} /> Add</button>
        </form>
      </fieldset>

      {undo && (
        <p className="cg-undo" role="status">
          <span>{undo.text}</span>
          <button type="button" onClick={() => { send({ type: "points.remove", goalId: goal.id, entryId: undo.entryId }); setUndo(null); }}><Undo2 size={15} /> Undo</button>
        </p>
      )}

      {recent.length > 0 && (
        <div className="cg-recent">
          <h3>Recent</h3>
          <ul>
            {recent.map((e) => (
              <li key={e.id}>
                <b>+{e.amount}</b><span>{e.category || "Other"}{e.reason ? ` · ${e.reason}` : ""}<time dateTime={e.at}>{new Date(e.at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</time></span>
                <button type="button" aria-label={`Remove ${e.amount} points`} onClick={() => send({ type: "points.remove", goalId: goal.id, entryId: e.id })}><X size={15} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Edit goal ────────────────────────────────────────────────────────────────────────────────────
function EditGoal({ goal, today, send, onDeleted }: { goal: Goal; today: string; send: Send; onDeleted: () => void }) {
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const phase = phaseOf(goal, today);
  useEffect(() => { setSaved(false); setConfirm(false); }, [goal.id]);
  return (
    <div>
      <GoalForm key={goal.id} mode="edit" today={today} previewPct={progressOf(goal).pct} initial={goal as GoalInput} onSubmit={(v) => { send({ type: "goal.update", id: goal.id, patch: v }); setSaved(true); window.setTimeout(() => setSaved(false), 2500); }} />
      {saved && <p className="cg-saved" role="status"><Check size={16} /> Saved. The board is updated.</p>}
      <div className="cg-danger-zone">
        {(phase === "reached" || phase === "given") && (
          <button type="button" className="cg-btn cg-btn-quiet" onClick={() => send({ type: "reward.given", goalId: goal.id, given: phase !== "given" })}>
            {phase === "given" ? "Undo: reward not given yet" : `Mark “${goal.reward.name}” as given`}
          </button>
        )}
        {!confirm
          ? <button type="button" className="cg-btn cg-btn-danger" onClick={() => setConfirm(true)}>Delete this goal</button>
          : <p className="cg-confirm">Delete “{goal.title || goal.reward.name}” and its {totalsOf(goal).points} points? <button type="button" className="cg-btn cg-btn-danger" onClick={() => { send({ type: "goal.delete", id: goal.id }); onDeleted(); }}>Yes, delete</button> <button type="button" className="cg-btn cg-btn-quiet" onClick={() => setConfirm(false)}>Keep it</button></p>}
      </div>
    </div>
  );
}

// ── All goals ────────────────────────────────────────────────────────────────────────────────────
const PHASE_TEXT = { upcoming: "Starts soon", active: "Active", reached: "Reached", given: "Reward given", ended: "Time's up" } as const;
function AllGoals({ state, today, send, onNew, onEdit }: { state: ClassGoals; today: string; send: Send; onNew: () => void; onEdit: (id: string) => void }) {
  const goals = useMemo(() => [...state.goals].reverse(), [state.goals]);
  return (
    <div className="cg-goals">
      <button type="button" className="cg-btn cg-btn-main" disabled={state.goals.length >= MAX_GOALS} onClick={onNew}><Plus size={16} /> New goal</button>
      {goals.length === 0 && <p className="cg-lede">No goals yet.</p>}
      <ul>
        {goals.map((g) => {
          const p = progressOf(g); const ph = phaseOf(g, today); const onBoard = g.id === state.boardId;
          return (
            <li key={g.id} className={onBoard ? "is-board" : ""}>
              <span className="cg-g-emoji" aria-hidden>{g.reward.emoji}</span>
              <div className="cg-g-main">
                <b>{g.title || g.reward.name}</b>
                <span>{g.className ? `${g.className} · ` : ""}{g.reward.name} · {p.points}/{p.target} · {PHASE_TEXT[ph]}</span>
                <div className="cg-now-bar" aria-hidden><i style={{ width: `${p.pct}%` }} /></div>
              </div>
              <div className="cg-g-actions">
                {onBoard ? <span className="cg-onboard"><Check size={14} /> On the board</span> : <button type="button" onClick={() => send({ type: "board.set", goalId: g.id })}>Show on board</button>}
                <button type="button" onClick={() => onEdit(g.id)}>Edit</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
