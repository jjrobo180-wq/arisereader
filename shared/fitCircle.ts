// Arise Fit: workout circles (server/fitCircle.ts, client/src/pages/fit/FitCircle.tsx).
// A circle is a group of friends, each on their own Arise Fit account, who keep each other on track.
// Anyone in a circle can invite more people with the circle's code or link. Everyone sees everyone's
// training (workouts, streak, new records) as it happens, gets a notification when someone finishes
// a workout, and can send a cheer or a nudge. Only training is shared: never food, weight or photos.
// (Sharing Arise Fit+ with someone is a different thing: the guest pass, shared/fitPlus.ts.)
import { CATALOG_BY_ID, records, streak, type FitData } from "./fit";

/** Most people in one circle, the person who started it included. */
export const MAX_CIRCLE = 10;
export const CODE_LEN = 6;
/** No 0/O or 1/I/L, so a code read aloud or typed from a text is never ambiguous. */
const CODE_ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const makeCode = (rand: () => number = Math.random) => Array.from({ length: CODE_LEN }, () => CODE_ABC[Math.floor(rand() * CODE_ABC.length)]).join("");
export const cleanCode = (raw: unknown): string | null => {
  const s = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === CODE_LEN && [...s].every((ch) => CODE_ABC.includes(ch)) ? s : null;
};
/** The link a friend opens to join (the website and the iPhone app both read ?circle=CODE). */
export const circleLink = (base: string, code: string) => `${base.replace(/\/$/, "")}#/fit?circle=${code}`;

export type MemberStats = {
  /** Workouts in the last 7 days. */ week: number;
  minutes7: number;
  sets7: number;
  streak: number;
  last: { name: string; date: string; mins: number; exercises: string[] } | null;
  /** Personal records set in the last 7 days. */
  prs: { name: string; weight: number; reps: number; date: string }[];
  units: "lb" | "kg";
  goal: string;
};
export type Member = { id: number; name: string; owner: boolean; me: boolean; stats: MemberStats | null };
export type CheerKind = "cheer" | "nudge" | "fire" | "strong";
export const CHEERS: Record<CheerKind, { e: string; label: string; body: (from: string) => string }> = {
  cheer: { e: "👏", label: "Cheer", body: (n) => `${n} cheered you on. Keep it up!` },
  fire: { e: "🔥", label: "On fire", body: (n) => `${n} says you're on fire 🔥` },
  strong: { e: "💪", label: "Strong", body: (n) => `${n} saw your workout: strong work 💪` },
  nudge: { e: "⏰", label: "Nudge", body: (n) => `${n} nudged you: time for a workout?` },
};
export type Cheer = { from: number; name: string; kind: CheerKind; at: number };

const GOAL_WORDS: Record<string, string> = { lose: "Losing fat", maintain: "Staying fit", gain: "Building muscle" };

/** What the circle sees about someone: training only. */
export function memberStats(d: Pick<FitData, "workouts" | "foods" | "profile">, now = Date.now()): MemberStats {
  const weekAgo = now - 7 * 864e5;
  const recent = d.workouts.filter((w) => { const t = Date.parse(w.date); return t >= weekAgo && t <= now + 864e5; });
  const sets = (w: FitData["workouts"][number]) => w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done !== false && !s.warm).length, 0);
  const last = [...d.workouts].sort((a, b) => b.date.localeCompare(a.date))[0];
  const before = records(d.workouts.filter((w) => Date.parse(w.date) < weekAgo));
  const prs = [...records(d.workouts).entries()]
    .filter(([id, b]) => Date.parse(b.date) >= weekAgo && b.weight > 0 && b.e1rm > (before.get(id)?.e1rm ?? 0) && before.has(id))
    .sort((a, b) => b[1].e1rm - a[1].e1rm).slice(0, 3)
    .map(([id, b]) => ({ name: CATALOG_BY_ID.get(id)?.name ?? d.workouts.flatMap((w) => w.exercises).find((e) => e.exId === id)?.name ?? id, weight: b.weight, reps: b.reps, date: b.date }));
  return {
    week: recent.length,
    minutes7: Math.round(recent.reduce((t, w) => t + w.secs, 0) / 60),
    sets7: recent.reduce((t, w) => t + sets(w), 0),
    streak: streak({ workouts: d.workouts, foods: [] } as unknown as FitData, new Date(now)),
    last: last ? { name: last.name.slice(0, 60), date: last.date, mins: Math.round(last.secs / 60), exercises: last.exercises.slice(0, 6).map((e) => e.name.slice(0, 40)) } : null,
    prs,
    units: d.profile.units,
    goal: GOAL_WORDS[d.profile.goal] ?? "",
  };
}

/** Workouts in `after` that weren't in `before` and happened in the last 12 hours (to tell the circle). */
export function newWorkouts(before: Pick<FitData, "workouts"> | null, after: Pick<FitData, "workouts">, now = Date.now()) {
  const had = new Set((before?.workouts ?? []).map((w) => w.id));
  return after.workouts.filter((w) => !had.has(w.id) && now - Date.parse(w.date) < 12 * 3600_000 && w.exercises.length > 0);
}

/** "2h ago", "yesterday", "Mon". */
export function agoWords(iso: string | number, now = Date.now()): string {
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  const m = Math.max(0, Math.round((now - t) / 60_000));
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 20) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days <= 1) return "yesterday";
  if (days < 7) return new Date(t).toLocaleDateString(undefined, { weekday: "short" });
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
