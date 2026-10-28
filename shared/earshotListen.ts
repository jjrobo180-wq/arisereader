// Pod+ / Earshot listening extras, the parts both the server and the app use:
// - Fit my drive: picks episodes that fill a drive's minutes as closely as possible.
// - Hours back: a weekly tally of the time skipped ads, intros and a faster speed gave back.
// - Ask the episode and Catch me up: the transcript sent to the AI, and its answer checked.
// - Timestamped comments: a comment's moment, cleaned.
import type { TxSegment } from "./earshot";

// ---------------------------------------------------------------------------
// Fit my drive
// ---------------------------------------------------------------------------

/** An episode that could go in the drive. left: seconds still to hear (less than secs when part-heard). */
export type DriveCandidate = { id: string; secs: number; left?: number };
export type DrivePlan<T extends DriveCandidate> = { picks: T[]; secs: number; target: number };

/** How long an episode takes to hear at this speed, from where they left off. */
export const driveSecs = (c: DriveCandidate, speed = 1) => Math.max(0, (c.left && c.left > 0 && c.left < c.secs ? c.left : c.secs) / (speed > 0 ? speed : 1));

/**
 * The episodes that fill `minutes` as closely as possible without going over by more than `overBy`
 * (a little over is fine: you finish the sentence in the driveway). Earlier candidates are preferred
 * when two fills tie, and the picks keep the candidates' order.
 */
export function fitDrive<T extends DriveCandidate>(candidates: T[], minutes: number, speed = 1, overBy = 0.05): DrivePlan<T> {
  const target = Math.max(60, Math.round(minutes * 60));
  const STEP = 15; // seconds per bucket
  const cap = Math.floor((target * (1 + overBy)) / STEP);
  const list = candidates.slice(0, 80).map((c, i) => ({ c, i, b: Math.max(1, Math.round(driveSecs(c, speed) / STEP)) })).filter((x) => x.b <= cap && x.c.secs > 0);
  // best[b]: the earliest-preferred set of candidates that adds up to b buckets.
  const best: (number[] | null)[] = Array(cap + 1).fill(null);
  best[0] = [];
  for (const x of list) {
    for (let b = cap; b >= x.b; b--) {
      const from = best[b - x.b];
      if (from && !best[b]) best[b] = [...from, x.i];
    }
  }
  // Closest to the target: a fill under or over counts the same distance.
  let pick = 0, gap = Infinity;
  for (let b = 0; b <= cap; b++) {
    if (!best[b]) continue;
    const g = Math.abs(b * STEP - target);
    if (g < gap) { gap = g; pick = b; }
  }
  const picks = (best[pick] || []).sort((a, z) => a - z).map((i) => candidates[i]);
  return { picks, secs: Math.round(picks.reduce((n, c) => n + driveSecs(c, speed), 0)), target };
}

// ---------------------------------------------------------------------------
// Hours back
// ---------------------------------------------------------------------------

export type SavedKind = "ads" | "intros" | "speed";
/** Seconds given back, all time and per week (weeks start on Monday, keyed "2026-10-26"). */
export type HoursBack = { total: Record<SavedKind, number>; weeks: Record<string, Record<SavedKind, number>> };
export const emptyHoursBack = (): HoursBack => ({ total: { ads: 0, intros: 0, speed: 0 }, weeks: {} });

/** The Monday that starts the week holding this moment, in the listener's own time zone. */
export function weekKey(at = new Date()): string {
  const d = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Adds seconds of one kind (negative takes them back: an undone skip). Keeps the last 12 weeks. */
export function addHoursBack(h: HoursBack, kind: SavedKind, secs: number, at = new Date()): HoursBack {
  if (!Number.isFinite(secs) || !secs) return h;
  const wk = weekKey(at);
  const week = { ...(h.weeks[wk] || { ads: 0, intros: 0, speed: 0 }) };
  week[kind] = Math.max(0, week[kind] + secs);
  const weeks = { ...h.weeks, [wk]: week };
  const keep = Object.keys(weeks).sort().slice(-12);
  return { total: { ...h.total, [kind]: Math.max(0, h.total[kind] + secs) }, weeks: Object.fromEntries(keep.map((k) => [k, weeks[k]])) };
}

export function cleanHoursBack(v: unknown): HoursBack {
  const out = emptyHoursBack();
  const r = v && typeof v === "object" ? (v as any) : null;
  if (!r) return out;
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : 0);
  const kinds = (x: any) => ({ ads: n(x?.ads), intros: n(x?.intros), speed: n(x?.speed) });
  out.total = kinds(r.total);
  if (r.weeks && typeof r.weeks === "object") for (const [k, w] of Object.entries(r.weeks)) if (/^\d{4}-\d{2}-\d{2}$/.test(k)) out.weeks[k] = kinds(w);
  return out;
}

export const sumKinds = (k: Record<SavedKind, number> | undefined) => (k ? k.ads + k.intros + k.speed : 0);

/** "2h 15m", "45 min", "under a minute". */
export function hoursWords(secs: number): string {
  const m = Math.floor(Math.max(0, secs) / 60);
  if (m < 1) return "under a minute";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Ask the episode and Catch me up
// ---------------------------------------------------------------------------

const mmss = (t: number) => { const s = Math.max(0, Math.floor(t)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };

/** The transcript as timed lines for the AI ("[12:34] words"), lines joined into ~20-second stretches,
 *  cut to `maxChars` (the start is kept: the end of an episode matters least for most questions). */
export function transcriptForAi(segments: TxSegment[], maxChars = 140_000, upTo?: number): string {
  const out: string[] = [];
  let cur: { s: number; t: string[] } | null = null, len = 0;
  for (const seg of segments) {
    if (upTo !== undefined && seg.s > upTo) break;
    if (!cur || seg.s - cur.s > 20) {
      if (cur) { const line = `[${mmss(cur.s)}] ${cur.t.join(" ")}`; if (len + line.length > maxChars) break; out.push(line); len += line.length + 1; }
      cur = { s: seg.s, t: [] };
    }
    cur.t.push(seg.t.trim());
  }
  if (cur) { const line = `[${mmss(cur.s)}] ${cur.t.join(" ")}`; if (len + line.length <= maxChars) out.push(line); }
  return out.join("\n");
}

/** "12:34" or "1:02:03" → seconds; a number is taken as seconds. */
export function parseStamp(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);
}

export type AskMoment = { t: number; label: string };
export type AskAnswer = { answer: string; moments: AskMoment[]; found: boolean };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** The AI's answer, checked: moments must be real places in what was read, snapped to the line that starts there. */
export function cleanAskAnswer(raw: unknown, segments: TxSegment[], readTo: number): AskAnswer {
  const r = raw && typeof raw === "object" ? (raw as any) : {};
  const answer = text(r.answer, 900) || "I couldn't find that in this episode.";
  const starts = segments.map((s) => s.s);
  const snap = (t: number) => { let best = t, gap = Infinity; for (const s of starts) { const g = Math.abs(s - t); if (g < gap) { gap = g; best = s; } if (s > t + 60) break; } return gap <= 30 ? best : t; };
  const seen = new Set<number>();
  const moments: AskMoment[] = [];
  for (const m of Array.isArray(r.moments) ? r.moments : []) {
    const t = parseStamp(m?.t ?? m?.time ?? m?.at);
    if (t === null || t < 0 || t > readTo + 5) continue;
    const at = Math.floor(snap(t));
    if ([...seen].some((x) => Math.abs(x - at) < 15)) continue;
    seen.add(at);
    moments.push({ t: at, label: text(m?.label ?? m?.what, 120) || "This part" });
    if (moments.length >= 4) break;
  }
  return { answer, moments: moments.sort((a, z) => a.t - z.t), found: r.found !== false && (moments.length > 0 || r.found === true) };
}

export type CatchUp = { recap: string; points: string[] };
export function cleanCatchUp(raw: unknown): CatchUp {
  const r = raw && typeof raw === "object" ? (raw as any) : {};
  const points = (Array.isArray(r.points) ? r.points : []).map((p: unknown) => text(p, 200)).filter(Boolean).slice(0, 6);
  return { recap: text(r.recap, 1200), points };
}

export const cleanQuestion = (v: unknown) => text(v, 300);

// ---------------------------------------------------------------------------
// Timestamped comments
// ---------------------------------------------------------------------------

/** A comment's moment in the episode, in whole seconds (null: about the whole episode). */
export function cleanMoment(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 12 * 3600) return null;
  return Math.floor(n);
}

/** The timed comments to show as this moment is reached: said between `from` (exclusive) and `to`. */
export function momentsBetween<T extends { t?: number | null }>(list: T[], from: number, to: number): T[] {
  if (!(to > from) || to - from > 3) return []; // a jump, not listening: show nothing
  return list.filter((c) => typeof c.t === "number" && c.t > from && c.t <= to);
}
