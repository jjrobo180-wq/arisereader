// Cooked AI form check: turns the body points from a pose model (MediaPipe's 33-point skeleton,
// coordinates 0–1) into joint angles, counts reps and spots common faults for each lift. Pure math,
// shared by the camera screen and the tests.
// Accuracy: joint angles are measured in 3D (MediaPipe's world points, in meters) when they're there, so
// they're right whatever angle the phone sees you from; the points are smoothed (a One Euro filter) so
// shaking points don't make false reps; and a framing check makes sure the whole body is in view first.

export type Pt = { x: number; y: number; z?: number; visibility?: number };
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
/** The angle at b (degrees) in 3D, for world points. */
export function angle3(a: Pt, b: Pt, c: Pt): number {
  const u = [a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)], v = [c.x - b.x, c.y - b.y, (c.z ?? 0) - (b.z ?? 0)];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2], lu = Math.hypot(...u), lv = Math.hypot(...v);
  if (!lu || !lv) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (lu * lv)))) * 180) / Math.PI;
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

export type Angles = { knee: number; hip: number; elbow: number; body: number; torsoLean: number; shinLean: number; seen: number;
  /** Knee gap ÷ ankle gap (front view; under ~0.75 the knees are caving in). */
  kneeCave?: number;
  /** Left vs right knee bend difference in degrees (shifting to one side). */
  asym?: number;
  /** 0 = filmed from the side, 1 = from the front. */
  front?: number };
/** Joint angles. With `world` (MediaPipe world points, meters) the bends are measured in 3D. */
export function anglesOf(lm: Pt[], world?: Pt[]): Angles {
  const s = side(lm);
  const w = world && world.length >= 29 ? world : null;
  const left = s.shoulder === lm[11];
  const W = (l: number, r: number) => (w ? w[left ? l : r] : null);
  const ang = (a: [number, number], b: [number, number], c: [number, number], flat: number) => {
    const A = W(...a), B = W(...b), C = W(...c);
    return A && B && C ? angle3(A, B, C) : flat;
  };
  const out: Angles = { knee: ang([23, 24], [25, 26], [27, 28], angle(s.hip, s.knee, s.ankle)), hip: ang([11, 12], [23, 24], [25, 26], angle(s.shoulder, s.hip, s.knee)),
    elbow: ang([11, 12], [13, 14], [15, 16], angle(s.shoulder, s.elbow, s.wrist)), body: ang([11, 12], [23, 24], [27, 28], angle(s.shoulder, s.hip, s.ankle)),
    torsoLean: lean(s.shoulder, s.hip), shinLean: lean(s.knee, s.ankle), seen: s.seen };
  // Front-on or side-on: shoulder width against torso length in the picture.
  const sw = Math.abs(lm[11].x - lm[12].x), torso = Math.abs((lm[11].y + lm[12].y) / 2 - (lm[23].y + lm[24].y) / 2) || 1;
  out.front = Math.max(0, Math.min(1, (sw / torso - 0.15) / 0.5));
  const vis = (i: number) => lm[i]?.visibility ?? 1;
  if (w && Math.min(vis(25), vis(26), vis(27), vis(28)) > 0.5) {
    const kg = Math.hypot(w[25].x - w[26].x, (w[25].z ?? 0) - (w[26].z ?? 0)), ag = Math.hypot(w[27].x - w[28].x, (w[27].z ?? 0) - (w[28].z ?? 0));
    out.kneeCave = ag > 0.05 ? kg / ag : undefined;
    out.asym = Math.abs(angle3(w[23], w[25], w[27]) - angle3(w[24], w[26], w[28]));
  }
  return out;
}

// ── Smoothing ───────────────────────────────────────────────────────────────────────────────────────
// The One Euro filter (Casiez et al., 2012): smooths hard when a point is still (no jitter) and follows
// fast when it moves (no lag on a quick rep). Used on every point of every frame.
class OneEuro {
  private x: number | null = null; private dx = 0; private t = 0;
  constructor(private minCutoff = 1.2, private beta = 0.02, private dCutoff = 1) {}
  private static a(cut: number, dt: number) { const r = 2 * Math.PI * cut * dt; return r / (r + 1); }
  filter(v: number, tMs: number): number {
    if (this.x == null) { this.x = v; this.t = tMs; return v; }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000); this.t = tMs;
    const d = (v - this.x) / dt;
    this.dx += OneEuro.a(this.dCutoff, dt) * (d - this.dx);
    const cut = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.a(cut, dt) * (v - this.x);
    return this.x;
  }
}
/** Smooths a stream of skeletons (x, y, z each filtered; visibility is averaged a little). */
export class PoseSmoother {
  private f: OneEuro[][] = []; private vis: number[] = [];
  constructor(private minCutoff = 1.2, private beta = 0.02) {}
  push(pts: Pt[], tMs: number): Pt[] {
    return pts.map((p, i) => {
      const f = (this.f[i] ??= [new OneEuro(this.minCutoff, this.beta), new OneEuro(this.minCutoff, this.beta), new OneEuro(this.minCutoff, this.beta)]);
      const v = p.visibility ?? 1; this.vis[i] = this.vis[i] == null ? v : this.vis[i] * 0.6 + v * 0.4;
      return { x: f[0].filter(p.x, tMs), y: f[1].filter(p.y, tMs), z: p.z == null ? undefined : f[2].filter(p.z, tMs), visibility: this.vis[i] };
    });
  }
}

// ── Framing ─────────────────────────────────────────────────────────────────────────────────────────
export type FramingCheck = { id: "body" | "distance" | "view" | "light"; ok: boolean; text: string };
/** Is the phone set up right? Every check has to pass before reps count. `brightness` 0–255 from the video. */
export function framing(lm: Pt[] | undefined, lift: FormLift, brightness?: number): { ok: boolean; checks: FramingCheck[]; tip: string } {
  const rule = LIFTS[lift];
  const need = rule.upper ? [11, 12, 13, 14, 15, 16, 23, 24] : [11, 12, 23, 24, 25, 26, 27, 28];
  const lit = brightness == null || brightness >= 55;
  const viewWord = rule.view === "front" ? "Face the phone" : rule.view === "side" ? "Turn sideways" : "Any angle";
  if (!lm) return { ok: false, checks: [{ id: "body", ok: false, text: "Step into view" }, { id: "distance", ok: false, text: "Right distance" }, { id: "view", ok: false, text: viewWord }, { id: "light", ok: lit, text: lit ? "Good light" : "Too dark" }],
    tip: lit ? "Step back until the camera sees you" : "It's too dark. Turn on a light in front of you." };
  const vis = (i: number) => lm[i]?.visibility ?? 1;
  const inside = (i: number) => lm[i].x > 0.02 && lm[i].x < 0.98 && lm[i].y > 0.01 && lm[i].y < 0.99;
  // From the side the far limbs hide behind the near ones, so only one side has to be clearly seen.
  const pairs = need.filter((i) => i % 2 === 1);
  const seenSide = (off: 0 | 1) => pairs.every((i) => vis(i + off) > 0.55 && inside(i + off));
  const body = seenSide(0) || seenSide(1);
  const ys = need.map((i) => lm[i].y), xs = need.map((i) => lm[i].x);
  const span = Math.max(Math.max(...ys) - Math.min(...ys), (Math.max(...xs) - Math.min(...xs)) * 0.75);
  const far = span < (rule.upper ? 0.28 : 0.4), near = span > 0.94;
  const front = anglesOf(lm).front ?? 0;
  const viewOk = rule.view === "either" || (rule.view === "side" ? front < 0.55 : front > 0.45);
  const checks: FramingCheck[] = [
    { id: "body", ok: body, text: body ? (rule.upper ? "Upper body in view" : "Whole body in view") : rule.upper ? "Get your arms and hips in view" : "Get head to feet in view" },
    { id: "distance", ok: body && !far && !near, text: far ? "Come closer" : near ? "Step back" : "Right distance" },
    { id: "view", ok: viewOk, text: viewOk ? (rule.view === "side" ? "Side-on" : rule.view === "front" ? "Facing the phone" : "Good angle") : rule.view === "side" ? "Turn sideways" : "Face the phone" },
    { id: "light", ok: lit, text: lit ? "Good light" : "Too dark" },
  ];
  const bad = checks.find((c) => !c.ok);
  const tip = !bad ? "Perfect. Get into your start position."
    : bad.id === "body" ? (near ? "Step back a little" : "Move so all of you is on screen")
    : bad.id === "distance" ? (far ? "Come a step or two closer" : "Take a step back")
    : bad.id === "view" ? (rule.view === "side" ? "Turn so your side faces the phone" : "Face the phone") : "Turn on a light in front of you, not behind you";
  return { ok: !bad, checks, tip };
}

export type FormLift = "squat" | "pushup" | "lunge" | "hinge" | "press" | "curl" | "plank";
type Rule = {
  name: string; setup: string;
  /** Where the phone goes: which way you face it, how high, how far. */
  view: "side" | "front" | "either"; phone: string; upper?: boolean;
  /** The angle that moves through each rep, and where "down" and "up" are. */
  drive: keyof Angles; down: number; up: number; downIsSmaller: boolean;
  /** Faults checked over the whole rep (worst values seen while down) → the cue to fix it. */
  faults: (worst: Angles, best: Angles) => string[];
  hold?: boolean;
};
export const LIFTS: Record<FormLift, Rule> = {
  squat: { name: "Squat", view: "either", phone: "On the floor or a shelf about knee to hip height, 7-9 ft (2-3 m) away, standing upright. Side-on is best for depth; facing it also checks your knees.", setup: "Film from the side, whole body in frame, phone at hip height.", drive: "knee", down: 100, up: 160, downIsSmaller: true,
    faults: (w) => [w.knee > 95 ? "Go deeper: hips to knee height" : "", w.torsoLean > 50 ? "Chest up, don't fold forward" : "", w.shinLean > 40 ? "Sit back more; knees are drifting far forward" : "", w.kneeCave != null && w.kneeCave < 0.75 ? "Push your knees out over your toes" : "", (w.asym ?? 0) > 18 ? "Sit evenly on both legs" : ""].filter(Boolean) },
  pushup: { name: "Push-up", view: "side", phone: "On the floor, standing upright, 5-6 ft (1.5-2 m) to your side, so your head to heels fit across the screen.", setup: "Film from the side, phone on the floor a few feet away.", drive: "elbow", down: 100, up: 155, downIsSmaller: true,
    faults: (w, b) => [w.elbow > 95 ? "Lower your chest closer to the floor" : "", Math.min(w.body, b.body) < 160 ? "Hips sagging or piking: keep a straight line" : "", b.elbow < 150 ? "Lock out fully at the top" : ""].filter(Boolean) },
  lunge: { name: "Lunge", view: "side", phone: "Knee to hip height, 7-9 ft (2-3 m) away, side-on, with room to step.", setup: "Film from the side, whole body in frame.", drive: "knee", down: 105, up: 160, downIsSmaller: true,
    faults: (w) => [w.knee > 100 ? "Drop the back knee lower" : "", w.torsoLean > 25 ? "Stay tall through your torso" : "", w.kneeCave != null && w.kneeCave < 0.7 ? "Keep your front knee in line with your toes" : ""].filter(Boolean) },
  hinge: { name: "Hinge (deadlift / RDL)", view: "side", phone: "Knee to hip height, 7-9 ft (2-3 m) away, side-on, the bar and your whole body in view.", setup: "Film from the side, whole body and the bar in frame.", drive: "hip", down: 110, up: 165, downIsSmaller: true,
    faults: (w, b) => [w.knee < 120 ? "Less knee bend: push your hips back, not down" : "", w.hip > 105 ? "Hinge further: hips back until you feel your hamstrings" : "", b.hip < 160 ? "Stand all the way up and squeeze your glutes" : ""].filter(Boolean) },
  press: { name: "Overhead press", view: "side", phone: "Chest height, 5-7 ft (1.5-2 m) away, side-on, with room above your head for the lockout.", upper: true, setup: "Film from the side, arms and bar in frame.", drive: "elbow", down: 90, up: 160, downIsSmaller: true,
    faults: (w, b) => [b.elbow < 160 ? "Press to a full lockout overhead" : "", b.torsoLean > 15 ? "Don't lean back: squeeze glutes and abs" : ""].filter(Boolean) },
  curl: { name: "Biceps curl", view: "side", phone: "Chest height, 4-6 ft (1.2-2 m) away, side-on, your curling arm nearest the phone.", upper: true, setup: "Film from the side, arm in frame.", drive: "elbow", down: 60, up: 150, downIsSmaller: true,
    faults: (w, b) => [w.elbow > 55 ? "Curl all the way up" : "", b.elbow < 150 ? "Lower all the way down each rep" : "", b.torsoLean > 12 ? "No swinging: keep your body still" : ""].filter(Boolean) },
  plank: { name: "Plank", view: "side", phone: "On the floor, standing upright, 5-6 ft (1.5-2 m) to your side.", setup: "Film from the side, phone on the floor.", drive: "body", down: 0, up: 0, downIsSmaller: true, hold: true,
    faults: (w) => [w.body < 160 ? "Hips are off line: squeeze glutes and brace" : ""].filter(Boolean) },
};

export type RepResult = { n: number; faults: string[]; good: boolean;
  /** The bottom of the rep (the drive angle, degrees), seconds down and up, and tips that don't fail the rep. */
  depth?: number; downS?: number; upS?: number; tips?: string[] };
const maxEach = (x: Angles, y: Angles): Angles => Object.fromEntries((Object.keys(x) as (keyof Angles)[]).map((k) => [k, Math.max(x[k], y[k])])) as Angles;

/** Counts reps for one lift from a stream of angle frames and grades each rep. */
export class RepCounter {
  lift: Rule; reps: RepResult[] = [];
  private phase: "up" | "down" = "up";
  /** The bottom of the rep (deepest drive angle), with the worst lean and body line seen on the way. */
  private bottom: Angles | null = null;
  /** The highest value of every angle over the rep (the top position). */
  private top: Angles | null = null;
  private tTop: number | null = null; private tBottom: number | null = null; private tStart: number | null = null;
  constructor(public which: FormLift) { this.lift = LIFTS[which]; }
  /** Feed a frame; returns the rep when one completes. */
  push(a: Angles, tMs?: number): RepResult | null {
    if (a.seen < 0.5 || this.lift.hold) return null;
    const { drive, down, up, downIsSmaller } = this.lift;
    const v = a[drive];
    const isDown = downIsSmaller ? v <= down : v >= down;
    const isUp = downIsSmaller ? v >= up : v <= up;
    this.top = this.top ? maxEach(this.top, a) : { ...a };
    if (this.phase === "up") {
      if (tMs != null && (downIsSmaller ? v >= up - 5 : v <= up + 5)) this.tStart = tMs;
      if (isDown) { this.phase = "down"; this.bottom = { ...a }; this.tBottom = tMs ?? null; this.tTop = this.tStart ?? tMs ?? null; }
      return null;
    }
    const b = this.bottom!;
    const deeper = downIsSmaller ? v < b[drive] : v > b[drive];
    if (deeper && tMs != null) this.tBottom = tMs;
    const minOf = (x?: number, y?: number) => (x == null ? y : y == null ? x : Math.min(x, y));
    this.bottom = { ...(deeper ? a : b), torsoLean: Math.max(b.torsoLean, a.torsoLean), shinLean: Math.max(b.shinLean, a.shinLean), body: Math.min(b.body, a.body),
      kneeCave: minOf(b.kneeCave, a.kneeCave), asym: Math.max(b.asym ?? 0, a.asym ?? 0) };
    if (!isUp) return null;
    // A "rep" faster than a third of a second is the points jumping, not a rep.
    if (tMs != null && this.tTop != null && tMs - this.tTop < 330) { this.phase = "up"; this.bottom = null; return null; }
    this.phase = "up";
    const faults = this.lift.faults(this.bottom, this.top);
    const downS = tMs != null && this.tTop != null && this.tBottom != null ? Math.round((this.tBottom - this.tTop) / 100) / 10 : undefined;
    const upS = tMs != null && this.tBottom != null ? Math.round((tMs - this.tBottom) / 100) / 10 : undefined;
    const tips: string[] = [];
    if (downS != null && downS < 0.6 && this.which !== "curl") tips.push("Control the way down: about 2 seconds");
    if (upS != null && upS > 3.5) tips.push("That one was a grind. Rest a little longer next set");
    const r: RepResult = { n: this.reps.length + 1, faults, good: !faults.length, depth: Math.round(this.bottom[drive] ?? 0), downS, upS, tips };
    this.reps.push(r); this.bottom = null; this.top = { ...a }; this.tStart = tMs ?? null;
    return r;
  }
  get score(): number { return this.reps.length ? Math.round((this.reps.filter((r) => r.good).length / this.reps.length) * 100) : 0; }
}

/** For a plank: is this frame in a good line? */
export const plankOk = (a: Angles) => a.seen >= 0.5 && a.body >= 160 && a.body <= 195;

/** The camera rep counter that fits an exercise, or null when the camera can't follow it. */
const LIFT_OF: Record<string, FormLift> = {
  "back-squat": "squat", "front-squat": "squat", "goblet-squat": "squat", "bodyweight-squat": "squat", "kb-goblet-squat": "squat", "jump-squat": "squat", "band-squat": "squat", thruster: "squat",
  "push-up": "pushup", "incline-push-up": "pushup",
  lunge: "lunge", "bulgarian-split-squat": "lunge", "step-up": "lunge",
  deadlift: "hinge", rdl: "hinge", "db-rdl": "hinge", "sumo-deadlift": "hinge", "good-morning": "hinge", "kb-swing": "hinge",
  ohp: "press", "db-shoulder-press": "press", "arnold-press": "press",
  "barbell-curl": "curl", "db-curl": "curl", "hammer-curl": "curl", "cable-curl": "curl",
  plank: "plank",
};
export const formLiftFor = (exId: string): FormLift | null => LIFT_OF[exId] ?? null;
