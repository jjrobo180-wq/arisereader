// Teacher Hub: the ten steps of getting an IEP or re-evaluation meeting done.
// A teacher can skip a step and come back to it; the meeting remembers where they are.

export type StepPlan = { done: number[]; skipped: number[] };
export const STEP_COUNT = 10;

export const MEETING_STEPS: readonly { n: number; title: string; short: string }[] = [
  { n: 1, title: "Add the meeting", short: "Add" },
  { n: 2, title: "Find a time that works for everyone", short: "Find a time" },
  { n: 3, title: "See who answered and book the time", short: "Book it" },
  { n: 4, title: "Tell everyone the final time", short: "Tell everyone" },
  { n: 5, title: "Start the guide", short: "Guide" },
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
  return { done, skipped: clean(raw?.skipped).filter((n) => !done.includes(n)) };
}

export const emptyPlan = (): StepPlan => ({ done: [], skipped: [] });

export function markDone(plan: StepPlan | undefined, n: number): StepPlan {
  const p = cleanPlan(plan);
  return cleanPlan({ done: [...p.done, n], skipped: p.skipped.filter((s) => s !== n) });
}

export function markSkipped(plan: StepPlan | undefined, n: number): StepPlan {
  const p = cleanPlan(plan);
  return p.done.includes(n) ? p : cleanPlan({ done: p.done, skipped: [...p.skipped, n] });
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

export const stepsDone = (plan: StepPlan | undefined) => cleanPlan(plan).done.length;
