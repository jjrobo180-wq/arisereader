// Math Lessons for teachers (WorkHub app, opens at #/math-lessons).
//
// A teacher-facing guide to Grade 7 Unit 1, "Scale Drawings", for special education teachers who may
// never have taught it: plain-English background, step-by-step "how to" for every activity, worked
// answers, simplified / modified / extension supports, common mistakes and an exit check per lesson.
//
// The unit is Illustrative Mathematics Grade 7 (Kendall Hunt), CC BY 4.0, https://creativecommons.org/licenses/by/4.0/
// Lesson names, task wording ideas and teacher notes here are our own summaries of the public teacher
// pages. Nothing is copied from the login-only Student Response or cool-down pages.
//
// HOW ANSWERS ARE MARKED (every answer has one flag, nothing is unmarked):
//   "ok"     the answer follows from numbers written in the task, and tests/sped-math-lessons.test.ts
//            recomputes it from those numbers.
//   "figure" the answer depends on a picture, grid, map or card set that isn't in this app, so we give the
//            METHOD and what the answer must look like, and tell the teacher to check their own copy.
export type Check = "ok" | "figure";
export type Item = { id: string; q: string; a: string; check: Check; note?: string };
export type Activity = {
  id: string; name: string; minutes: number; optional?: boolean;
  what: string;            // one plain sentence: what the students do
  steps: string[];         // how to run it, in order
  items: Item[];           // the questions with correct answers
  watch?: string[];        // what to look for while they work
  say?: string[];          // what to say to students, in kid words
  board?: string[];        // a worked exemplar to copy onto the board, one line per step
};
export type Lesson = {
  n: number; title: string; section: string;
  /** Lessons outside Unit 1: the chip text, the heading above the title, the item id prefix and the publisher's pages. */
  extra?: { chip: string; heading: string; idPrefix: string; teacherUrl: string; studentUrl: string; source: string };
  targets: string[];       // "I can" statements
  bigIdea: string;
  primer: string[];        // for a teacher with no math background: read this first
  vocab: { term: string; kid: string; example: string }[];
  materials: string[];
  activities: Activity[];
  summary: string[];       // what to say at the end (lesson synthesis)
  supports: { simplified: string[]; modified: string[]; extension: string[] };
  exit: Item;              // our own exit check (the curriculum's cool-down is login-only)
  mistakes: string[];
};

export const UNIT = {
  title: "Grade 7, Unit 1: Scale Drawings",
  extraTitle: "More lessons",
  source: "Illustrative Mathematics Grade 7 (Kendall Hunt), CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  teacherUrl: (n: number) => `https://im.kendallhunt.com/MS/teachers/2/1/${n}/index.html`,
  studentUrl: (n: number) => `https://im.kendallhunt.com/MS/students/2/1/${n}/index.html`,
  unitUrl: "https://im.kendallhunt.com/MS/teachers/2/1/index.html",
  gated: "The curriculum's own Student Responses and cool-downs are behind a free teacher sign-in on the publisher's site. This guide never guesses them: where an answer depends on a picture you have in front of you, it says so and shows the method.",
};

export const START_HERE = {
  title: "If you have never taught this: Unit 1 (Scale Drawings) in two minutes",
  points: [
    "A scaled copy is the same picture made bigger or smaller evenly: every length is multiplied by the same number. Think of zooming on a photo without stretching it.",
    "That number is the scale factor. 2 makes every length 2 times as long, 1/2 makes every length half as long, 1 keeps the same size.",
    "Matching parts (the same corner, side or angle in each picture) are called corresponding parts. Angles never change in a scaled copy. Lengths all change by the same factor.",
    "You scale by multiplying or dividing. Adding or subtracting the same amount to every side does not make a scaled copy (Lesson 3).",
    "Area is different from length. Lengths multiply by the scale factor; area multiplies by the scale factor times itself. Factor 3 means area is 9 times as big (Lesson 6).",
    "A scale drawing is a scaled copy of something real, like a map or floor plan. The scale, such as 1 cm to 2 m, says how the drawing length matches the real length (Lessons 7 to 13).",
    "A scale without units, like 1 to 50, means the real thing is 50 times the drawing. You use the same unit on both sides.",
  ],
  // The one move you will use over and over.
  move: "Real length = drawing length × (what one drawing unit stands for). Drawing length = real length ÷ that same number. If you ever feel lost, write the scale as a fraction and multiply or divide.",
};

export const TOOLBOX = [
  "Say it two ways every time: 'times 2' and 'two times as long'. The curriculum asks teachers to avoid 'double' and 'twice' without saying 'two times as long'.",
  "Keep a word wall for the whole unit: scaled copy, corresponding, scale factor, scale, scale drawing, actual length.",
  "Put one worked example on the wall and leave it up. Students may copy the steps.",
  "Use graph paper, a ruler and tracing paper. Students who struggle with drawing can measure and tell you the numbers instead.",
  "Colour code corresponding parts: the same colour for the same side in both pictures.",
  "Offer calculators when the point of the task is the idea, not the arithmetic.",
  "Chunk long tasks: show one question at a time and check in after two or three minutes.",
  "Sentence frames: 'The copy is ___ times as long because ___.', '___ and ___ match because ___.', 'I know it is not a scaled copy because ___.'",
];

// ── Pure helpers: used by the page's Scale helper and checked by the tests. ──────────────────────
/** Real length from a drawing length, given how many real units one drawing unit stands for. */
export const toActual = (drawing: number, perUnit: number) => drawing * perUnit;
/** Drawing length from a real length. */
export const toDrawing = (actual: number, perUnit: number) => actual / perUnit;
/** Area grows by the square of the scale factor. */
export const areaFactor = (k: number) => k * k;
/** Is (a1,a2,...) a scaled copy of (b1,b2,...)? All ratios must match. Returns the factor or null. */
export function scaleFactorOf(original: readonly number[], copy: readonly number[], tol = 1e-9): number | null {
  if (original.length !== copy.length || original.length === 0) return null;
  if (original.some((x) => !(x > 0)) || copy.some((x) => !(x > 0))) return null;
  const k = copy[0] / original[0];
  return original.every((x, i) => Math.abs(copy[i] / x - k) <= tol * Math.max(1, Math.abs(k))) ? k : null;
}
/** Round for display without scientific notation or trailing zeros. */
export const fmt = (x: number, digits = 4) => {
  const r = Number(x.toFixed(digits));
  return Number.isInteger(r) ? String(r) : String(r);
};
export const CM_PER_INCH = 2.54;
export const INCH_PER_FOOT = 12;
export const FEET_PER_MILE = 5280;
export const INCHES_PER_MILE = INCH_PER_FOOT * FEET_PER_MILE; // 63,360

/** Length units the Scale helper understands, in centimeters. */
export const UNITS_CM = { mm: 0.1, cm: 1, m: 100, km: 100000, in: CM_PER_INCH, ft: CM_PER_INCH * INCH_PER_FOOT, mi: CM_PER_INCH * INCH_PER_FOOT * FEET_PER_MILE } as const;
export type LengthUnit = keyof typeof UNITS_CM;
/** "1 <drawingUnit> to <n> <realUnit>" written with no units: how many times as long the real thing is. */
export const unitlessScale = (n: number, drawingUnit: LengthUnit, realUnit: LengthUnit) => (n * UNITS_CM[realUnit]) / UNITS_CM[drawingUnit];
