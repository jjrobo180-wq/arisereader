// Leveled worksheets for a class: each student has a reading level and a math level (a grade,
// picked in their profile). The Worksheet Maker makes one version of a worksheet per level and
// hands each student the one for their level, printed as cut-apart sheets with their name on top.

/** The levels a teacher can pick in a student's profile, easiest first. */
export const LEVELS = ["Pre-K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
export type Level = (typeof LEVELS)[number];

/** "3" → "Grade 3"; "K" → "Kindergarten". */
export function levelLabel(level: string): string {
  if (level === "K") return "Kindergarten";
  if (level === "Pre-K") return "Pre-K";
  return /^\d+$/.test(level) ? `Grade ${level}` : level;
}

/**
 * A level as typed or picked ("3", "Grade 3", "3rd grade", "gr 2.5", "kinder", "K", "pre-k", "early 4th")
 * as one of LEVELS, or "" when it can't be read as a grade. Half grades round down.
 */
export function parseLevel(raw: string | undefined | null): Level | "" {
  const t = String(raw ?? "").trim().toLowerCase();
  if (!t) return "";
  if (/pre[\s-]?k|preschool|pre-?school|emerg/.test(t)) return "Pre-K";
  if (/^k$|kinder|^k\b|\bk\.?$|^gr?a?d?e?\s*k\b/.test(t)) return "K";
  const m = /(\d{1,2})(?:\.\d+)?/.exec(t);
  if (!m) return "";
  const n = Number(m[1]);
  if (n === 0) return "K";
  if (n >= 1 && n <= 12) return String(n) as Level;
  return "";
}

/** Which level a subject uses: Math uses the math level, everything else the reading level. */
export const levelKindFor = (subject: string): "math" | "reading" => (/math|algebra|geometry|number|calc/i.test(subject) ? "math" : "reading");

export type LeveledStudent = { name: string; readingLevel?: string; mathLevel?: string; grade?: string };

/**
 * The picked students, put into groups by their level for this subject. A student with no level
 * set goes by their grade; with neither, into the "" group (made on the worksheet's own grade).
 * Groups come easiest first; names keep the order they were given in.
 */
export function groupByLevel(students: LeveledStudent[], kind: "math" | "reading"): { level: Level | ""; students: string[] }[] {
  const by = new Map<Level | "", string[]>();
  for (const s of students) {
    const level = parseLevel(kind === "math" ? s.mathLevel : s.readingLevel) || parseLevel(s.grade);
    by.set(level, [...(by.get(level) || []), s.name]);
  }
  const rank = (l: Level | "") => (l === "" ? 999 : LEVELS.indexOf(l));
  return [...by.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([level, names]) => ({ level, students: names }));
}

/**
 * What the AI is told about the level, for one version. The skill and topic stay the same as the
 * class's; only the difficulty, reading level and supports change, so every student works on the same lesson.
 */
export function levelInstruction(level: Level | "", kind: "math" | "reading", classGrade: string): string {
  if (!level) return "";
  const g = levelLabel(level);
  return `a ${g} ${kind === "math" ? "math" : "reading"} level${classGrade ? ` (the class itself is in grade ${classGrade})` : ""}: ${kind === "reading" ? `sentences and words a ${g} reader can read on their own` : `words a ${g} student can read, numbers and steps kept exactly as on the page`}`;
}

/**
 * Modify for students makes a REWORDING, not a new worksheet: every piece of the original page (the
 * directions, a claim, each statement, each question, a table's headings and rows) in the same order,
 * said at the student's level. Nothing is added (no answer choices, no answer lines) and nothing is
 * answered: the student reads their strip and writes on the real worksheet.
 */
export type RewordPart = { label: string; text: string };
export type Reworded = { title: string; parts: RewordPart[] };

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "");
export function cleanReworded(raw: any): Reworded | null {
  const parts = (Array.isArray(raw?.parts) ? raw.parts : []).slice(0, 80)
    .map((p: any) => ({ label: clip(p?.label, 60), text: clip(p?.text, 2000) }))
    .filter((p: RewordPart) => p.text);
  return parts.length ? { title: clip(raw?.title, 160), parts } : null;
}
