// Video form checks (November 2026): a client films a set in Arise Fit and sends it to their trainer. The trainer
// pauses on the frames that matter, draws on them (lines, circles, arrows), writes a note on each, and can add a
// voice note. The client plays it back with the drawings showing at those moments. Server: server/coach.ts.

/** One mark: a moment in the video, the strokes drawn on that frame (points 0..1 of the frame), and a note. */
export type Stroke = { color: string; pts: [number, number][] };
export type FormMark = { id: string; t: number; strokes: Stroke[]; text: string };
export type FormFeedback = { at: string; text: string; marks: FormMark[]; voice: string; rating: "good" | "fix" | "" };
export type FormCheck = { id: string; at: string; exName: string; note: string; video: string; secs: number; status: "new" | "reviewed"; feedback: FormFeedback | null };

export const FORM_LIMITS = { checks: 60, marks: 12, strokes: 24, points: 400, videoMb: 100, voiceMb: 12, videoSecs: 90 };
export const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
export const VOICE_TYPES: Record<string, string> = { "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/webm": "webm", "audio/mpeg": "mp3", "audio/aac": "aac", "audio/ogg": "ogg" };
export const MARK_COLORS = ["#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#ffffff"];

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const rid = (v: unknown) => (typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : Math.random().toString(36).slice(2, 12));
/** A stored file's path: "<linkId>/<kind>-<stamp>.<ext>" (only ever made by the server). */
export const filePathOk = (p: unknown, linkId: string): p is string => typeof p === "string" && p.length < 200 && p.startsWith(`${linkId}/`) && /^[\w-]+\/(video|voice)-[a-z0-9-]+\.(mp4|mov|webm|m4a|mp3|aac|ogg)$/.test(p);

export function cleanStroke(s: any): Stroke | null {
  const color = MARK_COLORS.includes(s?.color) ? s.color : MARK_COLORS[0];
  const pts = (Array.isArray(s?.pts) ? s.pts : []).slice(0, FORM_LIMITS.points)
    .map((p: any) => (Array.isArray(p) && p.length === 2 ? [Math.round(Math.min(1, Math.max(0, Number(p[0]) || 0)) * 1000) / 1000, Math.round(Math.min(1, Math.max(0, Number(p[1]) || 0)) * 1000) / 1000] : null))
    .filter(Boolean) as [number, number][];
  return pts.length >= 2 ? { color, pts } : null;
}
export function cleanFeedback(raw: any, linkId: string, at: string, secs = 3600): FormFeedback {
  const marks = (Array.isArray(raw?.marks) ? raw.marks : []).slice(0, FORM_LIMITS.marks).map((m: any) => {
    const strokes = (Array.isArray(m?.strokes) ? m.strokes : []).slice(0, FORM_LIMITS.strokes).map(cleanStroke).filter(Boolean) as Stroke[];
    const text = str(m?.text, 300);
    const t = Math.round(Math.min(secs, Math.max(0, Number(m?.t) || 0)) * 100) / 100;
    return strokes.length || text ? { id: rid(m?.id), t, strokes, text } : null;
  }).filter(Boolean).sort((a: FormMark, b: FormMark) => a.t - b.t) as FormMark[];
  return { at, text: str(raw?.text, 2000), marks, voice: filePathOk(raw?.voice, linkId) && raw.voice.includes("/voice-") ? raw.voice : "", rating: raw?.rating === "good" || raw?.rating === "fix" ? raw.rating : "" };
}
/** The mark showing at time t (each shows for 2.5 seconds, or until the next one). */
export const markAt = (marks: FormMark[], t: number) => { let cur: FormMark | null = null; for (const m of marks) if (m.t <= t + 0.05 && t - m.t < 2.5) cur = m; return cur; };
/** An SVG path for a stroke drawn on a w × h box. */
export const strokePath = (s: Stroke, w: number, h: number) => s.pts.map(([x, y], i) => `${i ? "L" : "M"}${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`).join(" ");
