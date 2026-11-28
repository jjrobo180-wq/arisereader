// Where a tapped notification opens: always the exact place it's about, never just the app or a section's top.
// A dinner reminder opens the food log on dinner; a to-do opens that to-do; a habit, routine, chore, pill, bill or
// event opens on that one, lit up. The links are "<base>?go=<section>&…" (shared/todoReminders.ts goUrl); the app
// reads them in client/src/pages/AriseTodo.tsx (go, task, focus, log, who, date, do) and client/src/lib/deepLink.ts.
// Pure, so it's tested (tests/notify-links.test.ts).

/** The Health & Fitness actions a link can ask for (shared/fitLinks.ts SIRI_ACTIONS). */
export const MEAL_ACTION = { breakfast: "log-breakfast", lunch: "log-lunch", dinner: "log-dinner", snack: "log-snack", snacks: "log-snack" } as const;

const enc = encodeURIComponent;
const link = (base: string, section: string, extra: Record<string, string | undefined> = {}) => {
  const q = Object.entries(extra).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${enc(v as string)}`).join("&");
  return `${base}?go=${section}${q ? `&${q}` : ""}`;
};

/** A daily check-in's reminder (shared/dailyCheckins.ts ids): straight to doing it. */
export function checkinLink(base: string, id: string): string {
  const [kind, rest] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  if (kind === "cooked") {
    if (rest === "breakfast" || rest === "lunch" || rest === "dinner" || rest === "snack") return link(base, "cooked", { page: "food", do: MEAL_ACTION[rest] });
    const action: Record<string, string> = { workout: "train", weight: "weigh-in", sleep: "sleep", yoga: "yoga", breathe: "breathe", stretch: "stretch", fast: "fast" };
    if (action[rest]) return link(base, "cooked", { do: action[rest] });
  }
  if (kind === "habit") return link(base, "habits", { focus: `habit:${rest}` });
  if (kind === "routine") return link(base, "routines", { focus: `routine:${rest}` });
  if (kind === "chore") return link(base, "chores", { focus: `chore:${rest}` });
  if (kind === "acct") return link(base, "accountability", { task: rest });
  return link(base, "tasks", { view: "today", focus: `checkin:${id}` });
}

/** Food & fitness (the LifeHub Health section): log a meal, water, weight or exercise, for this person. */
export const healthLink = (base: string, log: "breakfast" | "lunch" | "dinner" | "snacks" | "water" | "weight" | "exercise", who?: string) => link(base, "health", { log, who });
/** One to-do, opened and lit up in Tasks. */
export const taskLink = (base: string, id: string) => link(base, "tasks", { view: "today", task: id });
/** One calendar event, on its day. */
export const eventLink = (base: string, id: string, date: string) => link(base, "calendar", { date, focus: `event:${id}` });
/** One pill (its dose), to tick it taken. */
export const pillLink = (base: string, pillId: string) => link(base, "pills", { focus: `pill:${pillId}` });
/** One bill, to mark it paid. */
export const billLink = (base: string, id: string) => link(base, "money", { focus: `bill:${id}` });
/** Any section on one item (habit:, routine:, chore:, goal:…), or a log form ("log"). */
export const focusLink = (base: string, section: string, focus: string) => link(base, section, { focus });
export const logLink = (base: string, section: string, log: string, who?: string) => link(base, section, { log, who });

/** What a tapped link asks for, read from "…?go=…&…". */
export function readNotifyLink(hashOrUrl: string): { go: string; task?: string; focus?: string; log?: string; who?: string; date?: string; action?: string; view?: string } | null {
  const q = hashOrUrl.indexOf("?");
  if (q < 0) return null;
  const p = new URLSearchParams(hashOrUrl.slice(q + 1));
  const go = p.get("go");
  if (!go) return null;
  const get = (k: string) => p.get(k) || undefined;
  return { go, task: get("task"), focus: get("focus"), log: get("log"), who: get("who"), date: get("date"), action: get("do"), view: get("view") };
}
