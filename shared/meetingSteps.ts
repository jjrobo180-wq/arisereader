// Arise WorkHub: the ten steps of getting an IEP or re-evaluation meeting done.
// A teacher can skip a step and come back to it; the meeting remembers where they are.

/** `at` is the step the teacher last had open, so the steps open right back where they left them. */
export type StepPlan = { done: number[]; skipped: number[]; at?: number };
export const STEP_COUNT = 10;

export const MEETING_STEPS: readonly { n: number; title: string; short: string }[] = [
  { n: 1, title: "Add the meeting and who is coming", short: "Add" },
  { n: 2, title: "Find a time that works for everyone", short: "Find a time" },
  { n: 3, title: "See who answered and book the time", short: "Book it" },
  { n: 4, title: "Tell everyone the final time, and the gen ed teacher", short: "Tell everyone" },
  { n: 5, title: "Work through the checklist", short: "Checklist" },
  { n: 6, title: "Gather data and work samples", short: "Gather" },
  { n: 7, title: "Draft the goals and reports", short: "Draft" },
  { n: 8, title: "Send the drafts to parents and the team", short: "Send drafts" },
  { n: 9, title: "Hold the meeting", short: "Meeting" },
  { n: 10, title: "Finish up and send the final copy", short: "Finish" },
];

export type StepState = "current" | "done" | "skipped" | "todo";

const clean = (list: unknown): number[] => (Array.isArray(list) ? [...new Set(list.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= STEP_COUNT))].sort((a, b) => a - b) : []);

/** A saved plan made safe. */
export function cleanPlan(raw: any): StepPlan {
  const done = clean(raw?.done);
  const at = Number(raw?.at);
  return { done, skipped: clean(raw?.skipped).filter((n) => !done.includes(n)), ...(Number.isInteger(at) && at >= 1 && at <= STEP_COUNT ? { at } : {}) };
}

export const emptyPlan = (): StepPlan => ({ done: [], skipped: [] });

export function markDone(plan: StepPlan | undefined, n: number): StepPlan {
  const p = cleanPlan(plan);
  return cleanPlan({ ...p, done: [...p.done, n], skipped: p.skipped.filter((s) => s !== n) });
}

export function markSkipped(plan: StepPlan | undefined, n: number): StepPlan {
  const p = cleanPlan(plan);
  return p.done.includes(n) ? p : cleanPlan({ ...p, skipped: [...p.skipped, n] });
}

/** Takes a step back to "not done yet": for a step that was marked done or skipped by accident. */
export function markOpen(plan: StepPlan | undefined, n: number): StepPlan {
  const p = cleanPlan(plan);
  return cleanPlan({ ...p, done: p.done.filter((d) => d !== n), skipped: p.skipped.filter((s) => s !== n) });
}

/** Remembers the step the teacher is on. */
export function withAt(plan: StepPlan | undefined, n: number): StepPlan {
  const p = cleanPlan(plan);
  return p.at === n ? p : cleanPlan({ ...p, at: n });
}

export function stepState(plan: StepPlan | undefined, n: number, current: number): StepState {
  const p = cleanPlan(plan);
  if (n === current) return "current";
  if (p.done.includes(n)) return "done";
  return p.skipped.includes(n) ? "skipped" : "todo";
}

/** Where to pick up: the first step not done or skipped, else the first skipped one, else the last step. */
export function firstOpen(plan: StepPlan | undefined): number {
  const p = cleanPlan(plan);
  for (let n = 1; n <= STEP_COUNT; n++) if (!p.done.includes(n) && !p.skipped.includes(n)) return n;
  return p.skipped[0] ?? STEP_COUNT;
}

/**
 * Where the steps open: the step the teacher was last on, so going back to a step and leaving it there sticks.
 * Finding and booking a time are over once a time is booked (the booking marks them done), so a meeting left on
 * one of those goes straight to telling everyone and the gen ed teacher. A meeting never opened before starts at
 * the first step not done.
 */
export function resumeStep(plan: StepPlan | undefined, booked = false): number {
  const p = cleanPlan(plan);
  if (!p.at) return firstOpen(p);
  return booked && (p.at === 2 || p.at === 3) ? 4 : p.at;
}

export const stepsDone = (plan: StepPlan | undefined) => cleanPlan(plan).done.length;

/** The prep to-dos a meeting needs, each due a set number of days before (or after) the meeting or deadline. */
export const PREP_TODOS: readonly { step: number; title: string; days: number }[] = [
  { step: 6, title: "Gather data and work samples", days: -14 },
  { step: 7, title: "Draft goals and reports", days: -10 },
  { step: 8, title: "Send drafts to parents and the team", days: -5 },
  { step: 10, title: "Finish paperwork and send the final copy", days: 3 },
];

const shift = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Dated prep to-dos for a meeting on (or due by) `when`. A date already past moves up to `today`. */
export function prepTodos(student: string, when: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(when)) return [];
  return PREP_TODOS.map((t) => { const due = shift(when, t.days); return { step: t.step, title: `${t.title}: ${student}`, dueDate: due < today ? today : due }; });
}
