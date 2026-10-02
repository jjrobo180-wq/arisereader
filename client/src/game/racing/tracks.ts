// Aurora Racers — track definitions and the spline "track space" used for physics.
import * as THREE from "three";

export type ThemeId = "shores" | "books" | "neon" | "frost";

export interface TrackDef {
  id: string;
  name: string;
  theme: ThemeId;
  blurb: string;
  /** closed loop control points: [x, z, height] */
  points: [number, number, number][];
  width: number;
  laps: number;
  /** boost pads: [fraction of lap, lateral offset (-1..1 of half width)] */
  boosts: [number, number][];
  /** item box rows at these fractions of the lap */
  items: number[];
  /** coin lines: [fraction start, lateral offset, count] */
  coins: [number, number, number][];
  /** jump ramps at these fractions of the lap */
  jumps: number[];
}

export const TRACKS: TrackDef[] = [
  {
    id: "shores", name: "Sunny Shores", theme: "shores", width: 17, laps: 3,
    blurb: "Palm trees, sand dunes and a big jump by the waves.",
    points: [[0, 0, 0], [110, -6, 0], [185, 22, 1], [222, 92, 5], [196, 162, 9], [128, 186, 4], [70, 150, 0], [20, 182, 5], [-55, 214, 9], [-138, 186, 6], [-180, 112, 2], [-158, 42, 0], [-88, 8, 0]],
    boosts: [[0.12, 0], [0.43, -0.35], [0.71, 0.35]], items: [0.06, 0.36, 0.62, 0.86],
    jumps: [0.27], coins: [[0.18, 0.4, 6], [0.5, -0.4, 6], [0.78, 0, 6]],
  },
  {
    id: "books", name: "Book Canyon", theme: "books", width: 16, laps: 3,
    blurb: "Race between towering books, over pencil bridges and paper hills.",
    points: [[0, 0, 0], [96, -12, 3], [168, 32, 10], [172, 112, 17], [110, 152, 13], [50, 120, 6], [-6, 146, 3], [-30, 212, 11], [-112, 214, 15], [-170, 150, 9], [-156, 66, 3], [-84, 14, 0]],
    boosts: [[0.1, 0], [0.4, 0.3], [0.68, -0.3], [0.9, 0]], items: [0.05, 0.33, 0.58, 0.8],
    jumps: [0.5], coins: [[0.2, -0.3, 6], [0.47, 0.3, 6], [0.74, 0, 7]],
  },
  {
    id: "neon", name: "Neon City", theme: "neon", width: 18, laps: 3,
    blurb: "Glowing streets, skyscrapers and a lightning-fast straight at night.",
    points: [[0, 0, 0], [150, 0, 0], [200, 34, 0], [206, 128, 6], [170, 176, 8], [80, 182, 4], [36, 150, 0], [28, 96, 0], [-24, 66, 0], [-104, 70, 5], [-150, 30, 6], [-124, -24, 2], [-60, -24, 0]],
    boosts: [[0.08, 0], [0.3, 0], [0.55, -0.3], [0.82, 0.3]], items: [0.04, 0.27, 0.5, 0.75],
    jumps: [0.36], coins: [[0.14, 0, 8], [0.42, 0.35, 6], [0.66, -0.35, 6]],
  },
  {
    id: "frost", name: "Frosty Peaks", theme: "frost", width: 17, laps: 3,
    blurb: "Climb a snowy mountain, then fly down icy switchbacks.",
    points: [[0, 0, 0], [88, 18, 7], [150, 86, 18], [126, 166, 28], [44, 192, 24], [-28, 156, 15], [-24, 96, 11], [-92, 62, 16], [-164, 92, 22], [-206, 22, 13], [-158, -48, 4], [-66, -42, 0]],
    boosts: [[0.14, 0], [0.47, 0.3], [0.62, -0.3], [0.88, 0]], items: [0.07, 0.34, 0.6, 0.83],
    jumps: [0.7], coins: [[0.22, 0, 6], [0.52, -0.35, 6], [0.76, 0.35, 6]],
  },
];

export interface TrackSample {
  p: THREE.Vector3; // centre
  t: THREE.Vector3; // tangent (horizontal-ish, normalised)
  n: THREE.Vector3; // lateral (left), horizontal unit
  bank: number; // radians, positive tilts the left side up
  s: number; // distance from start
  curv: number; // signed curvature
}

export const SHOULDER = 5.5; // grass between road edge and barrier
export const RAMP_LEN = 8;
export const RAMP_H = 1.7;

export class TrackSpace {
  readonly samples: TrackSample[] = [];
  readonly length: number;
  readonly half: number;
  readonly limit: number;
  readonly curve: THREE.CatmullRomCurve3;
  private step: number;

  constructor(readonly def: TrackDef) {
    this.half = def.width / 2;
    this.limit = this.half + SHOULDER;
    this.curve = new THREE.CatmullRomCurve3(def.points.map(([x, z, y]) => new THREE.Vector3(x, y, z)), true, "centripetal");
    const total = this.curve.getLength();
    const N = Math.max(200, Math.round(total / 1.5));
    const pts = this.curve.getSpacedPoints(N).slice(0, N);
    let s = 0;
    for (let i = 0; i < N; i++) {
      const p = pts[i], q = pts[(i + 1) % N], r = pts[(i - 1 + N) % N];
      const t = new THREE.Vector3().subVectors(q, r).normalize();
      const flat = new THREE.Vector3(t.x, 0, t.z).normalize();
      const n = new THREE.Vector3(-flat.z, 0, flat.x); // points to the right of travel
      if (i > 0) s += p.distanceTo(pts[i - 1]);
      this.samples.push({ p: p.clone(), t, n, bank: 0, s, curv: 0 });
    }
    this.length = s + pts[N - 1].distanceTo(pts[0]);
    this.step = this.length / N;
    // curvature & banking (smoothed)
    const raw: number[] = [];
    for (let i = 0; i < N; i++) {
      const a = this.samples[(i - 3 + N) % N].t, b = this.samples[(i + 3) % N].t;
      const ang = Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z);
      raw.push(ang / (6 * this.step));
    }
    for (let i = 0; i < N; i++) {
      let acc = 0;
      for (let k = -8; k <= 8; k++) acc += raw[(i + k + N) % N];
      const curv = acc / 17;
      this.samples[i].curv = curv;
      this.samples[i].bank = THREE.MathUtils.clamp(-curv * 7, -0.2, 0.2); // outside of the turn is raised
    }
  }

  /** extra height from jump ramps at distance s (ramp rises over 8 m then drops away) */
  rampHeight(s: number) {
    for (const f of this.def.jumps) {
      const d = s - f * this.length;
      if (d >= 0 && d < RAMP_LEN) return (d / RAMP_LEN) * RAMP_H;
    }
    return 0;
  }

  sample(i: number) { const N = this.samples.length; return this.samples[((i % N) + N) % N]; }

  /** Interpolated frame at distance s along the track. */
  at(s: number) {
    const N = this.samples.length;
    const f = (((s % this.length) + this.length) % this.length) / this.step;
    const i = Math.floor(f) % N, k = f - Math.floor(f);
    const a = this.samples[i], b = this.samples[(i + 1) % N];
    const p = a.p.clone().lerp(b.p, k);
    const t = a.t.clone().lerp(b.t, k).normalize();
    const n = a.n.clone().lerp(b.n, k).normalize();
    return { p, t, n, bank: a.bank + (b.bank - a.bank) * k, index: i };
  }

  /** Project a world position onto the track near a hint index. */
  project(x: number, z: number, hint: number, range = 40) {
    const N = this.samples.length;
    let best = hint, bestD = Infinity;
    for (let k = -range; k <= range; k++) {
      const i = (((hint + k) % N) + N) % N;
      const p = this.samples[i].p;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    // refine on the segment toward the nearer neighbour
    const a = this.samples[best];
    const along = (x - a.p.x) * a.t.x + (z - a.p.z) * a.t.z;
    const fl = Math.hypot(a.t.x, a.t.z) || 1;
    const ds = along / fl;
    const s = a.s + ds;
    const fr = this.at(s);
    const lat = (x - fr.p.x) * fr.n.x + (z - fr.p.z) * fr.n.z;
    const sm = ((s % this.length) + this.length) % this.length;
    const onRoad = Math.abs(lat) < this.half;
    const height = fr.p.y + Math.tan(fr.bank) * THREE.MathUtils.clamp(lat, -this.half, this.half) + (onRoad ? this.rampHeight(sm) : 0);
    return { index: best, s: ((s % this.length) + this.length) % this.length, lat, height, frame: fr };
  }

  /** Full search (used once when placing things). */
  projectGlobal(x: number, z: number) {
    let best = 0, bestD = Infinity;
    this.samples.forEach((smp, i) => { const d = (smp.p.x - x) ** 2 + (smp.p.z - z) ** 2; if (d < bestD) { bestD = d; best = i; } });
    return this.project(x, z, best, 4);
  }

  /** World point at (s, lateral offset). */
  point(s: number, lat: number, lift = 0) {
    const f = this.at(s);
    const h = Math.tan(f.bank) * THREE.MathUtils.clamp(lat, -this.half, this.half);
    return new THREE.Vector3(f.p.x + f.n.x * lat, f.p.y + h + lift, f.p.z + f.n.z * lat);
  }
}
