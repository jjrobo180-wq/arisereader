// Arise Fit AI form check: turns the body points from a pose model (MediaPipe's 33-point skeleton,
// coordinates 0–1) into joint angles, counts reps and spots common faults for each lift. Pure math,
// shared by the camera screen and the tests.

export type Pt = { x: number; y: number; visibility?: number };
/** MediaPipe pose landmark numbers. */
export const LM = { nose: 0, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28 } as const;
/** Lines to draw for the skeleton. */
export const BONES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

/** The angle at b (degrees, 0–180) between a–b–c. */
export function angle(a: Pt, b: Pt, c: Pt): number {
  const v1 = Math.atan2(a.y - b.y, a.x - b.x), v2 = Math.atan2(c.y - b.y, c.x - b.x);
  let d = Math.abs(((v1 - v2) * 180) / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}
/** How far a segment leans from straight up (degrees): 0 = vertical, 90 = flat. */
export function lean(top: Pt, bottom: Pt): number {
  return Math.abs((Math.atan2(Math.abs(top.x - bottom.x), Math.abs(bottom.y - top.y)) * 180) / Math.PI);
}

/** The side of the body facing the camera better (sideways filming), as its points. */
export function side(lm: Pt[]) {
  const vis = (i: number) => lm[i]?.visibility ?? 1;
  const left = vis(11) + vis(23) + vis(25) + vis(27) + vis(13) >= vis(12) + vis(24) + vis(26) + vis(28) + vis(14);
  const g = (l: number, r: number) => lm[left ? l : r];
  return { shoulder: g(11, 12), elbow: g(13, 14), wrist: g(15, 16), hip: g(23, 24), knee: g(25, 26), ankle: g(27, 28), seen: Math.min(vis(left ? 11 : 12), vis(left ? 23 : 24), vis(left ? 25 : 26)) };
}

export type Angles = { knee: number; hip: number; elbow: number; body: number; torsoLean: number; shinLean: number; seen: number };
export function anglesOf(lm: Pt[]): Angles {
  const s = side(lm);
  return { knee: angle(s.hip, s.knee, s.ankle), hip: angle(s.shoulder, s.hip, s.knee), elbow: angle(s.shoulder, s.elbow, s.wrist), body: angle(s.shoulder, s.hip, s.ankle),
    torsoLean: lean(s.shoulder, s.hip), shinLean: lean(s.knee, s.ankle), seen: s.seen };
}

export type FormLift = "squat" | "pushup" | "lunge" | "hinge" | "press" | "curl" | "plank";
type Rule = {
  name: string; setup: string;
  /** The angle that moves through each rep, and where "down" and "up" are. */
  drive: keyof Angles; down: number; up: number; downIsSmaller: boolean;
  /** Faults checked over the whole rep (worst values seen while down) → the cue to fix it. */
  faults: (worst: Angles, best: Angles) => string[];
  hold?: boolean;
};
export const LIFTS: Record<FormLift, Rule> = {
  squat: { name: "Squat", setup: "Film from the side, whole body in frame, phone at hip height.", drive: "knee", down: 100, up: 160, downIsSmaller: true,
    faults: (w) => [w.knee > 95 ? "Go deeper: hips to knee height" : "", w.torsoLean > 50 ? "Chest up, don't fold forward" : "", w.shinLean > 40 ? "Sit back more; knees are drifting far forward" : ""].filter(Boolean) },
  pushup: { name: "Push-up", setup: "Film from the side, phone on the floor a few feet away.", drive: "elbow", down: 100, up: 155, downIsSmaller: true,
    faults: (w, b) => [w.elbow > 95 ? "Lower your chest closer to the floor" : "", Math.min(w.body, b.body) < 160 ? "Hips sagging or piking: keep a straight line" : "", b.elbow < 150 ? "Lock out fully at the top" : ""].filter(Boolean) },
  lunge: { name: "Lunge", setup: "Film from the side, whole body in frame.", drive: "knee", down: 105, up: 160, downIsSmaller: true,
    faults: (w) => [w.knee > 100 ? "Drop the back knee lower" : "", w.torsoLean > 25 ? "Stay tall through your torso" : ""].filter(Boolean) },
  hinge: { name: "Hinge (deadlift / RDL)", setup: "Film from the side, whole body and the bar in frame.", drive: "hip", down: 110, up: 165, downIsSmaller: true,
    faults: (w, b) => [w.knee < 120 ? "Less knee bend: push your hips back, not down" : "", w.hip > 105 ? "Hinge further: hips back until you feel your hamstrings" : "", b.hip < 160 ? "Stand all the way up and squeeze your glutes" : ""].filter(Boolean) },
  press: { name: "Overhead press", setup: "Film from the side, arms and bar in frame.", drive: "elbow", down: 90, up: 160, downIsSmaller: true,
    faults: (w, b) => [b.elbow < 160 ? "Press to a full lockout overhead" : "", b.torsoLean > 15 ? "Don't lean back: squeeze glutes and abs" : ""].filter(Boolean) },
  curl: { name: "Biceps curl", setup: "Film from the side, arm in frame.", drive: "elbow", down: 60, up: 150, downIsSmaller: true,
    faults: (w, b) => [w.elbow > 55 ? "Curl all the way up" : "", b.elbow < 150 ? "Lower all the way down each rep" : "", b.torsoLean > 12 ? "No swinging: keep your body still" : ""].filter(Boolean) },
  plank: { name: "Plank", setup: "Film from the side, phone on the floor.", drive: "body", down: 0, up: 0, downIsSmaller: true, hold: true,
    faults: (w) => [w.body < 160 ? "Hips are off line: squeeze glutes and brace" : ""].filter(Boolean) },
};

export type RepResult = { n: number; faults: string[]; good: boolean };
const maxEach = (x: Angles, y: Angles): Angles => Object.fromEntries((Object.keys(x) as (keyof Angles)[]).map((k) => [k, Math.max(x[k], y[k])])) as Angles;

/** Counts reps for one lift from a stream of angle frames and grades each rep. */
export class RepCounter {
  lift: Rule; reps: RepResult[] = [];
  private phase: "up" | "down" = "up";
  /** The bottom of the rep (deepest drive angle), with the worst lean and body line seen on the way. */
  private bottom: Angles | null = null;
  /** The highest value of every angle over the rep (the top position). */
  private top: Angles | null = null;
  constructor(public which: FormLift) { this.lift = LIFTS[which]; }
  /** Feed a frame; returns the rep when one completes. */
  push(a: Angles): RepResult | null {
    if (a.seen < 0.5 || this.lift.hold) return null;
    const { drive, down, up, downIsSmaller } = this.lift;
    const v = a[drive];
    const isDown = downIsSmaller ? v <= down : v >= down;
    const isUp = downIsSmaller ? v >= up : v <= up;
    this.top = this.top ? maxEach(this.top, a) : { ...a };
    if (this.phase === "up") {
      if (isDown) { this.phase = "down"; this.bottom = { ...a }; }
      return null;
    }
    const b = this.bottom!;
    const deeper = downIsSmaller ? v < b[drive] : v > b[drive];
    this.bottom = { ...(deeper ? a : b), torsoLean: Math.max(b.torsoLean, a.torsoLean), shinLean: Math.max(b.shinLean, a.shinLean), body: Math.min(b.body, a.body) };
    if (!isUp) return null;
    this.phase = "up";
    const faults = this.lift.faults(this.bottom, this.top);
    const r = { n: this.reps.length + 1, faults, good: !faults.length };
    this.reps.push(r); this.bottom = null; this.top = { ...a };
    return r;
  }
  get score(): number { return this.reps.length ? Math.round((this.reps.filter((r) => r.good).length / this.reps.length) * 100) : 0; }
}

/** For a plank: is this frame in a good line? */
export const plankOk = (a: Angles) => a.seen >= 0.5 && a.body >= 160 && a.body <= 195;
