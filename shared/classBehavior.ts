// A.R.I.S.E. class behavior (WorkHub's Behavior tab), built like LiveSchool: teachers give points for the
// behaviors they choose to one student, a few, or the whole class; students ask for hall passes that the
// teacher approves, with a live timer; and parents see their child's points, notes and passes in LifeHub.

export type BehaviorDef = { id: string; label: string; points: number; emoji: string };
export type PassPlace = { id: string; label: string; minutes: number };
export type BehaviorSettings = {
  behaviors: BehaviorDef[];
  places: PassPlace[];
  /** How many students can be out on a pass at once. */
  maxOut: number;
  /** Whether students can ask for a pass from their own account. */
  studentAsk: boolean;
  /** Whether notes and points go to parents by default. */
  shareDefault: boolean;
};

export const DEFAULT_BEHAVIORS: BehaviorDef[] = [
  { id: "on-task", label: "On task", points: 1, emoji: "🎯" },
  { id: "helping", label: "Helping others", points: 2, emoji: "🤝" },
  { id: "participating", label: "Participating", points: 1, emoji: "🙋" },
  { id: "kind", label: "Kindness", points: 2, emoji: "💛" },
  { id: "great-work", label: "Great work", points: 3, emoji: "⭐" },
  { id: "prepared", label: "Prepared", points: 1, emoji: "🎒" },
  { id: "off-task", label: "Off task", points: -1, emoji: "💤" },
  { id: "disruptive", label: "Disrupting", points: -1, emoji: "📢" },
  { id: "unprepared", label: "Unprepared", points: -1, emoji: "📭" },
  { id: "unkind", label: "Unkind words", points: -2, emoji: "💬" },
];
export const DEFAULT_PLACES: PassPlace[] = [
  { id: "restroom", label: "Restroom", minutes: 5 },
  { id: "water", label: "Water", minutes: 3 },
  { id: "nurse", label: "Nurse", minutes: 15 },
  { id: "office", label: "Office", minutes: 10 },
  { id: "library", label: "Library", minutes: 10 },
  { id: "locker", label: "Locker", minutes: 4 },
];
export const defaultSettings = (): BehaviorSettings => ({ behaviors: DEFAULT_BEHAVIORS.map((b) => ({ ...b })), places: DEFAULT_PLACES.map((p) => ({ ...p })), maxOut: 2, studentAsk: true, shareDefault: true });

const text = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const int = (v: unknown, min: number, max: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";

/** Saved settings made safe; anything missing falls back to the defaults. */
export function cleanSettings(raw: any): BehaviorSettings {
  const d = defaultSettings();
  const seen = new Set<string>();
  const behaviors = (Array.isArray(raw?.behaviors) ? raw.behaviors : d.behaviors).slice(0, 40).map((b: any) => {
    const label = text(b?.label, 40); if (!label) return null;
    let id = text(b?.id, 40) || slug(label); while (seen.has(id)) id += "-2"; seen.add(id);
    return { id, label, points: int(b?.points, -10, 10, 1), emoji: text(b?.emoji, 8) || (int(b?.points, -10, 10, 1) >= 0 ? "⭐" : "⚠️") };
  }).filter(Boolean) as BehaviorDef[];
  const pseen = new Set<string>();
  const places = (Array.isArray(raw?.places) ? raw.places : d.places).slice(0, 20).map((p: any) => {
    const label = text(p?.label, 30); if (!label) return null;
    let id = text(p?.id, 40) || slug(label); while (pseen.has(id)) id += "-2"; pseen.add(id);
    return { id, label, minutes: int(p?.minutes, 1, 60, 5) };
  }).filter(Boolean) as PassPlace[];
  return {
    behaviors: behaviors.length ? behaviors : d.behaviors, places: places.length ? places : d.places,
    maxOut: int(raw?.maxOut, 1, 30, d.maxOut), studentAsk: raw?.studentAsk === undefined ? d.studentAsk : !!raw.studentAsk,
    shareDefault: raw?.shareDefault === undefined ? d.shareDefault : !!raw.shareDefault,
  };
}

export type BehaviorEvent = { id: string; teacher_id: number; student_id: number; points: number; label: string; note: string; share: boolean; created_at: string };
export type PassStatus = "asked" | "out" | "back" | "denied";
export type HallPass = { id: string; teacher_id: number; student_id: number; place: string; status: PassStatus; limit_min: number; asked_at: string; out_at: string | null; back_at: string | null };

/** Minutes a pass has been out (or was out), to the tenth. */
export function minutesOut(p: Pick<HallPass, "out_at" | "back_at">, now: number): number {
  if (!p.out_at) return 0;
  const end = p.back_at ? Date.parse(p.back_at) : now;
  return Math.max(0, Math.round((end - Date.parse(p.out_at)) / 6000) / 10);
}
export const overTime = (p: HallPass, now: number) => p.status === "out" && minutesOut(p, now) > p.limit_min;

/** Monday (YYYY-MM-DD) of the week a time falls in, in the school's time zone. */
export function weekStart(iso: string, tz = "America/Denver"): string {
  const day = new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export const dayOf = (iso: string, tz = "America/Denver") => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });

/** Point totals per student: all time, this week, today, and the share of positive points. */
export function totals(events: Pick<BehaviorEvent, "student_id" | "points" | "created_at">[], now: number, tz = "America/Denver") {
  const today = dayOf(new Date(now).toISOString(), tz), week = weekStart(new Date(now).toISOString(), tz);
  const out: Record<number, { all: number; week: number; today: number; pos: number; neg: number }> = {};
  for (const e of events) {
    const t = (out[e.student_id] ??= { all: 0, week: 0, today: 0, pos: 0, neg: 0 });
    t.all += e.points;
    if (e.points >= 0) t.pos += e.points; else t.neg += -e.points;
    const day = dayOf(e.created_at, tz);
    if (day >= week) t.week += e.points;
    if (day === today) t.today += e.points;
  }
  return out;
}
/** Percent of points that were positive (100 when there are none yet). */
export const positiveRate = (t?: { pos: number; neg: number }) => (!t || t.pos + t.neg === 0 ? 100 : Math.round((100 * t.pos) / (t.pos + t.neg)));
