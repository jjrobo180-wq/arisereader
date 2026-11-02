// Arise Coaching: real, human personal trainers (no AI) and the people they train.
//
//  • Trainers list themselves in the directory ("Find a trainer" in Arise Fit, and /#/trainers on the
//    website) with their own prices for in-person, live-video or online coaching, their website,
//    certifications and reviews. A listing shows while the trainer's monthly listing plan is paid.
//  • A person asks a trainer to coach them from Arise Fit and chooses what Arise Fit shares (their
//    profile, body weight, workouts, food, steps and fasting, runs, progress photos). Once the trainer
//    accepts, that data goes to them automatically, with nothing to type again, until the person stops
//    sharing or ends the coaching.
//  • In the Arise Trainer app, the trainer builds workouts and programs, puts them on the client's
//    calendar, sets habits, nutrition targets, goals and check-in forms, books sessions, keeps private
//    notes and messages the client. In Arise Fit the client sees it all and does it.
//
// Everything here is pure (cleaning, filtering, sorting, the shared snapshot), so the server, both apps
// and the tests use the same rules. Server: server/coach.ts.
import type { FitData, Workout } from "./fit";
import { goals as fitGoals } from "./fit";

export type Mode = "inPerson" | "virtual" | "remote";
export const MODES: Mode[] = ["inPerson", "virtual", "remote"];
export const MODE_LABEL: Record<Mode, string> = { inPerson: "In person", virtual: "Live video", remote: "Online coaching" };
export const MODE_BLURB: Record<Mode, string> = {
  inPerson: "Train together at a gym, a park or your home.",
  virtual: "Live one-on-one sessions over video.",
  remote: "Workouts, check-ins and messages through the app, on your own schedule.",
};
export type Per = "session" | "week" | "month" | "package";
export const PER_LABEL: Record<Per, string> = { session: "session", week: "week", month: "month", package: "package" };

export type Price = { id: string; label: string; mode: Mode; cents: number; per: Per; sessions?: number; note?: string };

export const SPECIALTIES = [
  "Strength", "Muscle building", "Fat loss", "Powerlifting", "Olympic lifting", "Bodybuilding", "Running", "Marathon", "HIIT", "Mobility",
  "Yoga", "Pilates", "Boxing", "Martial arts", "Sports performance", "Seniors", "Pre and postnatal", "Injury recovery", "Beginners", "Nutrition",
  "Calisthenics", "CrossFit", "Endurance", "Weight gain", "Golf fitness", "Youth athletes", "Adaptive fitness",
] as const;

export const US_STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"], ["PR", "Puerto Rico"],
];
const STATE_CODES = new Set(US_STATES.map(([c]) => c));

/** What a trainer writes about themselves. */
export type TrainerProfile = {
  name: string; headline: string; bio: string;
  /** A small square photo (data:image/jpeg, shrunk on the phone) or an https link. */
  photo: string;
  specialties: string[]; certifications: string[]; years: number; languages: string[];
  city: string; state: string; zip: string;
  modes: Mode[]; prices: Price[];
  website: string; instagram: string; email: string; phone: string;
  /** Where clients book or pay: the trainer is paid directly (Arise only charges the listing fee). */
  bookingUrl: string; payUrl: string;
  accepting: boolean;
  /** Shown to a client after they connect. */
  welcome: string;
};

/** A listing as the directory shows it. */
export type PublicTrainer = TrainerProfile & { id: number; rating: number; reviews: number; since: string; fromCents: number; clients: number };

export type Review = { id: string; trainerId: number; name: string; stars: number; text: string; date: string; reply?: string };

/** What a client lets Arise Fit share with their trainer. */
export type Consent = { profile: boolean; body: boolean; workouts: boolean; food: boolean; health: boolean; runs: boolean; photos: boolean };
export const CONSENT_LABEL: Record<keyof Consent, [string, string]> = {
  profile: ["Profile and goal", "Age, height, sex, goal, activity level, calorie and macro goals"],
  body: ["Body weight", "Your weigh-ins and the trend"],
  workouts: ["Workouts", "Every workout you log: exercises, sets, weights, records"],
  food: ["Food", "What you eat each day, calories and macros, water"],
  health: ["Steps and fasting", "Daily steps from Apple Health and your fasts"],
  runs: ["Runs", "Outdoor runs, walks and hikes with distance and pace"],
  photos: ["Progress photos", "Photos you add to show your trainer"],
};
export const ALL_CONSENT: Consent = { profile: true, body: true, workouts: true, food: true, health: true, runs: true, photos: true };

// ——— What the trainer sets for a client ——————————————————————————————————————————————————————————

export type PlanItem = { exId: string; name: string; sets: number; reps: string; rest: number; note?: string };
/** A workout template in the trainer's library, or one put on a client's calendar (with its date). */
export type PlanWorkout = { id: string; name: string; note?: string; items: PlanItem[]; mins?: number };
export type Assigned = PlanWorkout & { date: string; done?: string };
/** A program: workouts on days counted from the day it starts (0 = the first day). */
export type CoachProgram = { id: string; name: string; weeks: number; note?: string; days: { day: number; workoutId: string }[] };
export type Habit = { id: string; name: string; days: number[] };
export type Question = { id: string; q: string; kind: "text" | "scale" | "number" | "yesno" };
export type CheckinForm = { id: string; title: string; questions: Question[]; weekday: number };
export type Goal = { id: string; text: string; due?: string; done?: boolean };
export type Appointment = { id: string; at: string; mins: number; mode: Mode; place: string; note: string; status: "booked" | "done" | "cancelled"; requested?: boolean };
export type Nutrition = { kcal?: number; p?: number; c?: number; f?: number; waterL?: number; note?: string };

/** The plan a trainer keeps for one client (the client sees all of it except `notes`). */
export type Coaching = {
  assigned: Assigned[]; habits: Habit[]; goals: Goal[]; appts: Appointment[];
  checkin?: CheckinForm; nutrition?: Nutrition; phase?: string; tags: string[];
  /** Private: only the trainer ever sees these. */
  notes: string;
};
export const emptyCoaching = (): Coaching => ({ assigned: [], habits: [], goals: [], appts: [], tags: [], notes: "" });

export type Photo = { id: string; date: string; pose: "front" | "side" | "back" | "other"; img: string };
export type CheckinAnswer = { formId: string; date: string; answers: Record<string, string | number> };
/** What the client adds for their trainer. */
export type ClientSide = { habitLog: Record<string, string[]>; checkins: CheckinAnswer[]; photos: Photo[]; health: { steps: Record<string, number>; active: Record<string, number> } };
export const emptyClientSide = (): ClientSide => ({ habitLog: {}, checkins: [], photos: [], health: { steps: {}, active: {} } });

/** The trainer's library: workout templates, their own exercises (with a video link) and programs. */
export type OwnExercise = { id: string; name: string; muscle: string; video: string; cues: string };
export type Library = { workouts: PlanWorkout[]; exercises: OwnExercise[]; programs: CoachProgram[]; forms: CheckinForm[]; quickReplies: string[] };
export const emptyLibrary = (): Library => ({ workouts: [], exercises: [], programs: [], forms: [], quickReplies: [] });

export type LinkStatus = "requested" | "active" | "declined" | "ended";
export type Message = { id: number; from: number; body: string; img?: string; at: string; read?: boolean };

// ——— Cleaning (everything that comes from a phone goes through these) ———————————————————————————————

const str = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
const num = (v: unknown, lo: number, hi: number, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const arr = <T>(v: unknown, max: number, f: (x: any) => T | null): T[] => (Array.isArray(v) ? v : []).slice(0, max).map(f).filter((x): x is T => x !== null);
const id = (v: unknown) => { const s = str(v, 40).replace(/[^A-Za-z0-9_-]/g, ""); return s || Math.random().toString(36).slice(2, 12); };
const day = (v: unknown) => { const s = str(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : ""; };
const iso = (v: unknown) => { const s = str(v, 40); return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : ""; };
/** A link people can open: https only (http is upgraded), nothing that runs script. */
export function cleanUrl(v: unknown): string {
  let s = str(v, 300);
  if (!s) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
  try { const u = new URL(s); if (u.protocol === "http:") u.protocol = "https:"; return u.protocol === "https:" && u.hostname.includes(".") && !u.username ? u.toString() : ""; } catch { return ""; }
}
/** A photo: a small JPEG/PNG/WebP data URL (kept under `max` characters) or an https link. */
export function cleanImg(v: unknown, max = 240_000): string {
  const s = String(v ?? "");
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= max) return s;
  return s.startsWith("https://") ? cleanUrl(s) : "";
}
const cleanHandle = (v: unknown) => str(v, 40).replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");
const cleanEmail = (v: unknown) => { const s = str(v, 120).toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : ""; };
const cleanPhone = (v: unknown) => str(v, 24).replace(/[^\d+()\-. ]/g, "");
const isMode = (m: unknown): m is Mode => MODES.includes(m as Mode);

export function cleanPrice(p: any): Price | null {
  if (!p || !isMode(p.mode)) return null;
  const cents = Math.round(num(p.cents, 0, 10_000_00));
  const per: Per = (["session", "week", "month", "package"] as Per[]).includes(p.per) ? p.per : "session";
  return { id: id(p.id), label: str(p.label, 60) || `${MODE_LABEL[p.mode as Mode]} ${PER_LABEL[per]}`, mode: p.mode, cents, per,
    ...(per === "package" && num(p.sessions, 1, 200) > 0 ? { sessions: Math.round(num(p.sessions, 1, 200)) } : {}),
    ...(str(p.note, 160) ? { note: str(p.note, 160) } : {}) };
}

export function emptyTrainer(name = ""): TrainerProfile {
  return { name, headline: "", bio: "", photo: "", specialties: [], certifications: [], years: 0, languages: ["English"], city: "", state: "", zip: "",
    modes: [], prices: [], website: "", instagram: "", email: "", phone: "", bookingUrl: "", payUrl: "", accepting: true, welcome: "" };
}

export function cleanTrainer(raw: any): TrainerProfile {
  const t = raw && typeof raw === "object" ? raw : {};
  const prices = arr(t.prices, 20, cleanPrice);
  const modes = [...new Set([...arr(t.modes, 3, (m) => (isMode(m) ? m : null)), ...prices.map((p) => p.mode)])];
  const state = str(t.state, 2).toUpperCase();
  return {
    name: str(t.name, 60), headline: str(t.headline, 90), bio: str(t.bio, 2000), photo: cleanImg(t.photo),
    specialties: [...new Set(arr(t.specialties, 12, (s) => str(s, 40) || null))],
    certifications: arr(t.certifications, 10, (s) => str(s, 80) || null),
    years: Math.round(num(t.years, 0, 60)), languages: [...new Set(arr(t.languages, 8, (s) => str(s, 30) || null))],
    city: str(t.city, 60), state: STATE_CODES.has(state) ? state : "", zip: str(t.zip, 5).replace(/\D/g, ""),
    modes, prices,
    website: cleanUrl(t.website), instagram: cleanHandle(t.instagram), email: cleanEmail(t.email), phone: cleanPhone(t.phone),
    bookingUrl: cleanUrl(t.bookingUrl), payUrl: cleanUrl(t.payUrl), accepting: t.accepting !== false, welcome: str(t.welcome, 600),
  };
}

/** What's still missing before a listing can go live (empty = ready). */
export function listingProblems(t: TrainerProfile): string[] {
  const out: string[] = [];
  if (t.name.length < 2) out.push("Add your name");
  if (t.headline.length < 6) out.push("Add a headline");
  if (t.bio.length < 40) out.push("Write a short bio (at least 40 characters)");
  if (!t.prices.length) out.push("Add at least one price");
  if (t.modes.includes("inPerson") && (!t.city || !t.state)) out.push("Add your city and state for in-person training");
  if (!t.email && !t.phone && !t.website && !t.bookingUrl) out.push("Add a way to reach you (email, phone, website or booking link)");
  return out;
}

export const fromCents = (t: Pick<TrainerProfile, "prices">) => (t.prices.length ? Math.min(...t.prices.map((p) => (p.per === "package" && p.sessions ? Math.round(p.cents / p.sessions) : p.cents))) : 0);
export const money = (cents: number) => (cents % 100 ? `$${(cents / 100).toFixed(2)}` : `$${Math.round(cents / 100).toLocaleString("en-US")}`);
export const priceText = (p: Price) => `${money(p.cents)} / ${p.per === "package" && p.sessions ? `${p.sessions} sessions` : PER_LABEL[p.per]}`;

export function cleanReview(r: any): { stars: number; text: string } | null {
  const stars = Math.round(num(r?.stars, 0, 5));
  if (stars < 1) return null;
  return { stars, text: str(r?.text, 1200) };
}

export function cleanConsent(c: any): Consent {
  const o = c && typeof c === "object" ? c : {};
  return { profile: o.profile !== false, body: !!o.body, workouts: !!o.workouts, food: !!o.food, health: !!o.health, runs: !!o.runs, photos: !!o.photos };
}

const cleanItem = (x: any): PlanItem | null => {
  const exId = str(x?.exId, 60); const name = str(x?.name, 80);
  if (!exId || !name) return null;
  return { exId, name, sets: Math.round(num(x.sets, 1, 20, 3)), reps: str(x.reps, 16) || "10", rest: Math.round(num(x.rest, 0, 900, 90)), ...(str(x.note, 200) ? { note: str(x.note, 200) } : {}) };
};
export function cleanPlanWorkout(w: any): PlanWorkout | null {
  const name = str(w?.name, 80); const items = arr(w?.items, 30, cleanItem);
  if (!name) return null;
  return { id: id(w.id), name, items, ...(str(w.note, 600) ? { note: str(w.note, 600) } : {}), ...(num(w.mins, 0, 600) ? { mins: Math.round(num(w.mins, 0, 600)) } : {}) };
}
const cleanAssigned = (w: any): Assigned | null => { const p = cleanPlanWorkout(w); const d = day(w?.date); return p && d ? { ...p, date: d, ...(iso(w.done) ? { done: iso(w.done) } : {}) } : null; };
const cleanQuestion = (q: any): Question | null => { const t = str(q?.q, 200); return t ? { id: id(q.id), q: t, kind: (["text", "scale", "number", "yesno"] as const).includes(q.kind) ? q.kind : "text" } : null; };
export function cleanForm(f: any): CheckinForm | null {
  const title = str(f?.title, 80); const questions = arr(f?.questions, 20, cleanQuestion);
  return title && questions.length ? { id: id(f.id), title, questions, weekday: Math.round(num(f.weekday, 0, 6, 0)) } : null;
}
const cleanAppt = (a: any): Appointment | null => {
  const at = iso(a?.at); if (!at || !isMode(a.mode)) return null;
  return { id: id(a.id), at, mins: Math.round(num(a.mins, 10, 480, 60)), mode: a.mode, place: str(a.place, 200), note: str(a.note, 400),
    status: (["booked", "done", "cancelled"] as const).includes(a.status) ? a.status : "booked", ...(a.requested ? { requested: true } : {}) };
};
const opt = (v: unknown, lo: number, hi: number) => (v === undefined || v === null || v === "" ? undefined : Math.round(num(v, lo, hi)));

export function cleanCoaching(raw: any): Coaching {
  const c = raw && typeof raw === "object" ? raw : {};
  const n = c.nutrition && typeof c.nutrition === "object" ? c.nutrition : null;
  const nutrition: Nutrition | undefined = n ? Object.fromEntries(Object.entries({ kcal: opt(n.kcal, 800, 8000), p: opt(n.p, 0, 600), c: opt(n.c, 0, 1000), f: opt(n.f, 0, 400), waterL: opt(n.waterL, 0, 10), note: str(n.note, 800) || undefined }).filter(([, v]) => v !== undefined)) as Nutrition : undefined;
  return {
    assigned: arr(c.assigned, 500, cleanAssigned).sort((a, b) => a.date.localeCompare(b.date)),
    habits: arr(c.habits, 20, (h) => { const name = str(h?.name, 80); return name ? { id: id(h.id), name, days: [...new Set(arr(h.days, 7, (d) => (Number.isInteger(d) && d >= 0 && d <= 6 ? d : null)))].sort() } : null; }),
    goals: arr(c.goals, 30, (g) => { const text = str(g?.text, 200); return text ? { id: id(g.id), text, ...(day(g.due) ? { due: day(g.due) } : {}), ...(g.done ? { done: true } : {}) } : null; }),
    appts: arr(c.appts, 300, cleanAppt).sort((a, b) => a.at.localeCompare(b.at)),
    ...(cleanForm(c.checkin) ? { checkin: cleanForm(c.checkin)! } : {}),
    ...(nutrition && Object.keys(nutrition).length ? { nutrition } : {}),
    ...(str(c.phase, 80) ? { phase: str(c.phase, 80) } : {}),
    tags: [...new Set(arr(c.tags, 10, (t) => str(t, 24) || null))],
    notes: str(c.notes, 8000),
  };
}
/** The coaching plan as the client sees it (no private notes, no tags). */
export const forClient = (c: Coaching): Omit<Coaching, "notes" | "tags"> & { notes?: never; tags?: never } => { const { notes: _n, tags: _t, ...rest } = c; return rest; };

export function cleanClientSide(raw: any): ClientSide {
  const c = raw && typeof raw === "object" ? raw : {};
  const log: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(c.habitLog && typeof c.habitLog === "object" ? c.habitLog : {}).slice(-120)) if (day(k)) log[k] = arr(v, 20, (x) => str(x, 40) || null);
  const counts = (o: any) => { const out: Record<string, number> = {}; for (const [k, v] of Object.entries(o && typeof o === "object" ? o : {}).slice(-60)) if (day(k)) out[k] = Math.round(num(v, 0, 200_000)); return out; };
  return {
    habitLog: log,
    checkins: arr(c.checkins, 200, (x) => {
      const formId = str(x?.formId, 40); const date = day(x?.date); if (!formId || !date) return null;
      const answers: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(x.answers && typeof x.answers === "object" ? x.answers : {}).slice(0, 20)) answers[str(k, 40)] = typeof v === "number" ? num(v, -1e6, 1e6) : str(v, 1000);
      return { formId, date, answers };
    }),
    photos: arr(c.photos, 60, (p) => { const img = cleanImg(p?.img, 400_000); const date = day(p?.date); return img && date ? { id: id(p.id), date, pose: (["front", "side", "back", "other"] as const).includes(p.pose) ? p.pose : "other", img } : null; }),
    health: { steps: counts(c.health?.steps), active: counts(c.health?.active) },
  };
}

export function cleanLibrary(raw: any): Library {
  const l = raw && typeof raw === "object" ? raw : {};
  return {
    workouts: arr(l.workouts, 300, cleanPlanWorkout),
    exercises: arr(l.exercises, 300, (e) => { const name = str(e?.name, 80); return name ? { id: id(e.id), name, muscle: str(e.muscle, 30), video: cleanUrl(e.video), cues: str(e.cues, 1200) } : null; }),
    programs: arr(l.programs, 60, (p) => {
      const name = str(p?.name, 80); if (!name) return null;
      return { id: id(p.id), name, weeks: Math.round(num(p.weeks, 1, 52, 4)), ...(str(p.note, 600) ? { note: str(p.note, 600) } : {}),
        days: arr(p.days, 400, (d) => { const w = str(d?.workoutId, 40); return w ? { day: Math.round(num(d.day, 0, 400)), workoutId: w } : null; }) };
    }),
    forms: arr(l.forms, 30, cleanForm),
    quickReplies: arr(l.quickReplies, 30, (s) => str(s, 300) || null),
  };
}

export function cleanMessage(body: unknown, img: unknown): { body: string; img?: string } | null {
  const b = str(body, 4000); const i = cleanImg(img, 400_000);
  return b || i ? { body: b, ...(i ? { img: i } : {}) } : null;
}

// ——— The directory ————————————————————————————————————————————————————————————————————————————————

export type Sort = "best" | "rating" | "reviews" | "priceLow" | "priceHigh" | "newest" | "experience";
export const SORT_LABEL: Record<Sort, string> = { best: "Best match", rating: "Highest rated", reviews: "Most reviews", priceLow: "Price: low to high", priceHigh: "Price: high to low", newest: "Newest", experience: "Most experience" };
export type Filter = { q?: string; mode?: Mode | ""; state?: string; specialty?: string; maxCents?: number; minStars?: number; accepting?: boolean };

export function filterTrainers(list: PublicTrainer[], f: Filter): PublicTrainer[] {
  const q = (f.q || "").trim().toLowerCase();
  return list.filter((t) =>
    (!q || [t.name, t.headline, t.city, t.bio, ...t.specialties, ...t.certifications].join(" ").toLowerCase().includes(q)) &&
    (!f.mode || t.modes.includes(f.mode)) &&
    // In-person trainers are local; online and video trainers work with anyone, anywhere.
    (!f.state || t.state === f.state || (f.mode !== "inPerson" && !t.modes.includes("inPerson"))) &&
    (!f.specialty || t.specialties.includes(f.specialty)) &&
    (!f.maxCents || (t.fromCents > 0 && t.fromCents <= f.maxCents)) &&
    (!f.minStars || t.rating >= f.minStars) &&
    (!f.accepting || t.accepting));
}

/** Rating with few reviews pulled toward the middle, so one 5-star review doesn't top the list. */
export const confidentRating = (t: Pick<PublicTrainer, "rating" | "reviews">) => (t.rating * t.reviews + 4 * 3) / (t.reviews + 3);

export function sortTrainers(list: PublicTrainer[], sort: Sort, f: Filter = {}): PublicTrainer[] {
  const by: Record<Sort, (a: PublicTrainer, b: PublicTrainer) => number> = {
    best: (a, b) => Number(b.accepting) - Number(a.accepting) || Number(!!f.state && b.state === f.state) - Number(!!f.state && a.state === f.state) || confidentRating(b) - confidentRating(a) || b.reviews - a.reviews,
    rating: (a, b) => confidentRating(b) - confidentRating(a) || b.reviews - a.reviews,
    reviews: (a, b) => b.reviews - a.reviews || b.rating - a.rating,
    priceLow: (a, b) => (a.fromCents || 1e12) - (b.fromCents || 1e12),
    priceHigh: (a, b) => b.fromCents - a.fromCents,
    newest: (a, b) => b.since.localeCompare(a.since),
    experience: (a, b) => b.years - a.years,
  };
  return [...list].sort((a, b) => by[sort](a, b) || a.name.localeCompare(b.name));
}

// ——— What the trainer sees of a client (built on the server from Arise Fit, by consent) ——————————————

export type Snapshot = {
  name: string; since: string;
  profile?: { age?: number; heightCm?: number; sex?: string; goal: string; activity: number; units: string; dietPlan?: string; kcal: number; p: number; c: number; f: number };
  weights?: { date: string; kg: number }[];
  workouts?: Workout[];
  food?: { date: string; kcal: number; p: number; c: number; f: number; waterMl: number; items: { meal: string; name: string; kcal: number }[] }[];
  fasting?: { active?: string; protocol: string; log: { start: string; end: string; goalH: number }[] };
  runs?: { date: string; kind: string; meters: number; secs: number; trail?: string }[];
};

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number, now: Date) => { const d = new Date(now); d.setDate(d.getDate() - n); return localDay(d); };

export function snapshot(fit: FitData | null, consent: Consent, name: string, since: string, now = new Date()): Snapshot {
  const s: Snapshot = { name, since };
  if (!fit) return s;
  const lastKg = fit.weights.length ? fit.weights[fit.weights.length - 1].kg : undefined;
  if (consent.profile) {
    const g = fitGoals(fit.profile, lastKg, now);
    s.profile = { ...(fit.profile.birthYear ? { age: now.getFullYear() - fit.profile.birthYear } : {}), ...(fit.profile.heightCm ? { heightCm: fit.profile.heightCm } : {}),
      ...(fit.profile.sex ? { sex: fit.profile.sex } : {}), goal: fit.profile.goal, activity: fit.profile.activity, units: fit.profile.units,
      ...(fit.profile.dietPlan ? { dietPlan: fit.profile.dietPlan } : {}), kcal: g.kcal, p: g.p, c: g.c, f: g.f };
  }
  if (consent.body) s.weights = fit.weights.slice(-180);
  if (consent.workouts) s.workouts = fit.workouts.slice(-120);
  if (consent.food) {
    const from = daysAgo(30, now);
    const byDay = new Map<string, NonNullable<Snapshot["food"]>[number]>();
    for (const f of fit.foods) {
      if (f.date < from) continue;
      const d = byDay.get(f.date) ?? { date: f.date, kcal: 0, p: 0, c: 0, f: 0, waterMl: fit.water[f.date] || 0, items: [] };
      d.kcal += f.kcal * f.servings; d.p += f.p * f.servings; d.c += f.c * f.servings; d.f += f.f * f.servings;
      if (d.items.length < 40) d.items.push({ meal: f.meal, name: f.name, kcal: Math.round(f.kcal * f.servings) });
      byDay.set(f.date, d);
    }
    s.food = [...byDay.values()].map((d) => ({ ...d, kcal: Math.round(d.kcal), p: Math.round(d.p), c: Math.round(d.c), f: Math.round(d.f) })).sort((a, b) => a.date.localeCompare(b.date));
  }
  if (consent.health && fit.fasting) s.fasting = { ...(fit.fasting.start ? { active: fit.fasting.start } : {}), protocol: fit.fasting.protocol, log: fit.fasting.log.slice(-60) };
  if (consent.runs) s.runs = (fit.runs ?? []).slice(-60).map((r) => ({ date: r.date, kind: r.kind, meters: r.meters, secs: r.secs, ...(r.trail ? { trail: r.trail } : {}) }));
  return s;
}

/** How closely the client followed the plan over the last `days` days (assigned workouts done, habits checked). */
export function compliance(c: Coaching, side: ClientSide, workouts: Workout[] | undefined, now = new Date(), days = 7): { workouts: [number, number]; habits: [number, number]; pct: number | null } {
  const from = daysAgo(days - 1, now), to = daysAgo(0, now);
  const due = c.assigned.filter((a) => a.date >= from && a.date <= to);
  const doneIds = new Set((workouts ?? []).filter((w) => w.programId === "coach").map((w) => w.dayId));
  const w: [number, number] = [due.filter((a) => a.done || doneIds.has(a.id)).length, due.length];
  let hDone = 0, hDue = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i); const k = localDay(d);
    for (const h of c.habits) if (!h.days.length || h.days.includes(d.getDay())) { hDue++; if (side.habitLog[k]?.includes(h.id)) hDone++; }
  }
  const total = w[1] + hDue;
  return { workouts: w, habits: [hDone, hDue], pct: total ? Math.round(((w[0] + hDone) / total) * 100) : null };
}

/** A program put on the calendar from `start`: one assigned workout per program day. */
export function expandProgram(p: CoachProgram, lib: Library, start: string): Assigned[] {
  const base = new Date(`${start}T12:00:00`);
  return p.days.flatMap((d) => {
    const w = lib.workouts.find((x) => x.id === d.workoutId); if (!w) return [];
    const at = new Date(base); at.setDate(at.getDate() + d.day);
    return [{ ...w, id: `${p.id.slice(0, 12)}-${d.day}-${Math.random().toString(36).slice(2, 7)}`, date: localDay(at) }];
  });
}

/** Is a check-in due today (its weekday, and not answered in the last 4 days)? */
export const checkinDue = (c: Coaching, side: ClientSide, now = new Date()) => !!c.checkin && now.getDay() === c.checkin.weekday && !side.checkins.some((x) => x.formId === c.checkin!.id && x.date >= daysAgo(4, now));

/** Listing plan: what a trainer pays Arise to be in the directory. */
export const LISTING = { cents: 2900, trialDays: 14, name: "Arise Trainer listing" };
