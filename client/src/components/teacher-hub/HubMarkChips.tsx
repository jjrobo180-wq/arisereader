// Arise WorkHub: the Participation and Behavior chips for one student. Used on the Minutes page (a class's page
// and its push-in note) and in a lesson's Students tab, so the weekly parent update (HubParentUpdate.tsx) can read them.
import { BEHAVIOR_LABEL, BEHAVIOR_MARKS, PARTICIPATION, PARTICIPATION_LABEL, type BehaviorMark, type Participation } from "@shared/lessonPlanner";

const ON: Record<"great" | "middle" | "low", string> = {
  great: "border-emerald-600 bg-emerald-600 text-white",
  middle: "border-sky-600 bg-sky-600 text-white",
  low: "border-amber-500 bg-amber-500 text-slate-950",
};
const tone = (i: number) => (i === 0 ? ON.great : i === 1 ? ON.middle : ON.low);

export function MarkChips({ name, participation, behavior, onChange, compact }: {
  name: string;
  participation?: Participation;
  behavior?: BehaviorMark;
  onChange: (change: { participation?: Participation; behavior?: BehaviorMark }) => void;
  /** Smaller chips, for the lesson's student list. */
  compact?: boolean;
}) {
  const chip = `inline-flex ${compact ? "min-h-8 px-2.5" : "min-h-9 px-3"} items-center rounded-full border text-xs font-semibold transition`;
  const off = "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
  const label = "w-[5.5rem] shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-500";
  return (
    <div className="mt-2 space-y-1.5" data-testid="mark-chips">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${name}: participation`}>
        <span className={label}>Participation</span>
        {PARTICIPATION.map((p, i) => {
          const on = participation === p;
          return <button key={p} type="button" aria-pressed={on} data-participation={p} onClick={() => onChange({ participation: on ? undefined : p })} className={`${chip} ${on ? tone(i) : off}`}>{PARTICIPATION_LABEL[p]}</button>;
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${name}: behavior`}>
        <span className={label}>Behavior</span>
        {BEHAVIOR_MARKS.map((b, i) => {
          const on = behavior === b;
          return <button key={b} type="button" aria-pressed={on} data-behavior={b} onClick={() => onChange({ behavior: on ? undefined : b })} className={`${chip} ${on ? tone(i) : off}`}>{BEHAVIOR_LABEL[b]}</button>;
        })}
      </div>
    </div>
  );
}
