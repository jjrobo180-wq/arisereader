// WorkHub caseload as a gallery of cards, like a compliance countdown board: each student's card has a cover,
// their name with the next review due ("IEP Review" or "REEVAL"), how many days away it is, and its date.
import type { Student } from "./teacherHub";

export type Review = { kind: "IEP Review" | "REEVAL"; date: string; days: number };

const DAY = 86_400_000;
const at = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const isDate = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Whole days from today to a YYYY-MM-DD date (negative once it has passed). */
export function daysUntil(date: string, today: string): number {
  return Math.round((at(date) - at(today)) / DAY);
}

/** The review the student has coming up next: the sooner of the IEP and the reevaluation. One that has passed
 *  still counts (it's overdue), so it's never hidden. */
export function nextReview(s: Pick<Student, "iepDate" | "reevalDate">, today: string): Review | null {
  const all: Review[] = [];
  if (isDate(s.iepDate)) all.push({ kind: "IEP Review", date: s.iepDate, days: daysUntil(s.iepDate, today) });
  if (isDate(s.reevalDate)) all.push({ kind: "REEVAL", date: s.reevalDate, days: daysUntil(s.reevalDate, today) });
  all.sort((a, b) => a.days - b.days);
  return all[0] ?? null;
}

/** "173 days away", "Tomorrow", "Today", "3 days overdue". */
export function daysWord(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "1 day overdue";
  return days < 0 ? `${-days} days overdue` : `${days} days away`;
}

/** "May 20, 2027". */
export function longDate(d: string): string {
  const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${M[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}`;
}

/** How soon it is: drives the little colored dot. */
export function urgency(days: number | null): "overdue" | "soon" | "near" | "later" | "none" {
  if (days === null) return "none";
  if (days < 0) return "overdue";
  if (days <= 30) return "soon";
  return days <= 90 ? "near" : "later";
}

/** Abstract cover art, drawn with gradients (no pictures to load): moon, ocean, forest, nebula and the rest. */
export const COVERS: { name: string; css: string }[] = [
  { name: "Moon", css: "radial-gradient(circle at 30% 40%, #8a8a8a 0 6%, transparent 7%), radial-gradient(circle at 70% 30%, #6f6f6f 0 9%, transparent 10%), radial-gradient(circle at 55% 75%, #7c7c7c 0 5%, transparent 6%), radial-gradient(ellipse at 60% 50%, #b9b9b9, #3a3a3a 70%, #0d0d0d)" },
  { name: "Ocean", css: "radial-gradient(ellipse at 20% 120%, #0f766e 0 30%, transparent 60%), radial-gradient(ellipse at 90% -20%, #a7f3d0 0 20%, transparent 55%), linear-gradient(160deg, #5eead4, #155e75 70%)" },
  { name: "Forest", css: "radial-gradient(ellipse at 50% 120%, #1f3b1f 0 40%, transparent 70%), radial-gradient(ellipse at 30% 10%, #e9d8c4 0 18%, transparent 50%), linear-gradient(180deg, #a3b18a, #4d6b3c 60%, #273d1f)" },
  { name: "Nebula", css: "radial-gradient(ellipse at 40% 50%, #f59e0b 0 12%, transparent 40%), radial-gradient(ellipse at 65% 40%, #b45309 0 15%, transparent 45%), radial-gradient(ellipse at 30% 70%, #60a5fa 0 10%, transparent 40%), linear-gradient(135deg, #1e3a8a, #0f172a)" },
  { name: "Earthrise", css: "radial-gradient(ellipse at 50% 140%, #e0f2fe 0 45%, #7dd3fc 55%, transparent 62%), linear-gradient(180deg, #000 0 40%, #0b1a33)" },
  { name: "Venice", css: "radial-gradient(ellipse at 50% 100%, #78716c 0 25%, transparent 55%), radial-gradient(ellipse at 70% 20%, #fde68a 0 15%, transparent 45%), linear-gradient(180deg, #bfdbfe, #e7e5e4 55%, #a8a29e)" },
  { name: "Silk", css: "radial-gradient(circle at 20% 30%, #a16207 0 4%, transparent 5%), radial-gradient(circle at 75% 60%, #854d0e 0 5%, transparent 6%), linear-gradient(135deg, #a1883f, #6b5a2a 55%, #4a3f1f)" },
  { name: "Tapestry", css: "repeating-radial-gradient(circle at 25% 25%, #1e3a5f 0 6px, #2c5282 7px 12px), linear-gradient(#1e3a5f, #1e3a5f)" },
  { name: "Fog", css: "radial-gradient(ellipse at 30% 40%, #e5e7eb 0 30%, transparent 60%), linear-gradient(180deg, #d1d5db, #9ca3af)" },
  { name: "Slate", css: "radial-gradient(ellipse at 70% 30%, #64748b 0 20%, transparent 60%), linear-gradient(135deg, #475569, #1e293b)" },
  { name: "Orchard", css: "radial-gradient(circle at 30% 70%, #f97316 0 7%, transparent 8%), radial-gradient(circle at 55% 65%, #facc15 0 6%, transparent 7%), radial-gradient(circle at 75% 75%, #ef4444 0 6%, transparent 7%), linear-gradient(180deg, #14532d, #3f6212 60%, #f5f5f4 61%)" },
  { name: "Koi", css: "radial-gradient(ellipse at 45% 55%, #422006 0 14%, transparent 30%), radial-gradient(ellipse at 60% 45%, #78350f 0 10%, transparent 28%), linear-gradient(135deg, #5eead4, #2dd4bf 50%, #0f766e)" },
  { name: "Dusk", css: "linear-gradient(180deg, #fbcfe8, #c4b5fd 45%, #6d28d9)" },
  { name: "Sunrise", css: "radial-gradient(circle at 50% 110%, #fde047 0 18%, transparent 40%), linear-gradient(180deg, #fb923c, #f472b6 60%, #7c3aed)" },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The student's cover: the one they picked, or one that comes from their id and never changes. */
export function coverFor(s: Pick<Student, "id"> & { cover?: number }): number {
  return typeof s.cover === "number" && s.cover >= 0 && s.cover < COVERS.length ? s.cover : hash(s.id) % COVERS.length;
}

export type CardSort = "soonest" | "latest" | "name";

/** Students in board order. Soonest review first by default; students with no dates go last either way. */
export function sortCards<T extends Pick<Student, "name" | "iepDate" | "reevalDate">>(list: T[], sort: CardSort, today: string): T[] {
  const key = (s: T) => nextReview(s, today)?.days ?? null;
  return [...list].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    const x = key(a), y = key(b);
    if (x === null || y === null) return x === y ? a.name.localeCompare(b.name) : x === null ? 1 : -1;
    return (sort === "soonest" ? x - y : y - x) || a.name.localeCompare(b.name);
  });
}

/** Search by name, grade, disability or review kind ("reeval", "iep"). */
export function matchCard(s: Pick<Student, "name" | "grade" | "iepDate" | "reevalDate"> & { disability1?: string; disability2?: string }, q: string, today: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const r = nextReview(s, today);
  return [s.name, s.grade && `grade ${s.grade}`, s.disability1, s.disability2, r?.kind, r && longDate(r.date)].some((x) => !!x && x.toLowerCase().includes(t));
}
