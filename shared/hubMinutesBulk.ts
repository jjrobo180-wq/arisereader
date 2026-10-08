// Teacher Hub: minutes for several students at once.
// The teacher ticks the students (or a screenshot is read and ticks them), and one save logs a session
// for each of them, or sets the minutes each of them needs every week. The pop-up is
// client/src/components/teacher-hub/HubMinutesBulk.tsx; the screenshot is read in server/teacherHubImport.ts.
import { BLOCK_NAME_MAX, blockName, type SchoolBlock } from "./hubBlocks";
import { SERVICE_KINDS, WEEK_DAYS, cleanDayGuide, countedPlan, guideDays, meetingDays, planFields, planText, sessionLog, weekDayOf, weekStart, type WeekDay } from "./hubProgress";
import type { ServiceLog, ServicePlan } from "./teacherHub";

/** The minutes that take one tap. Anything else is typed in the "Other" box. */
export const QUICK_MINUTES = [20, 30, 60] as const;

/** plan: the students are in the block every week, with the minutes they need. log: minutes given on one day only. */
export type BulkMode = "log" | "plan";

/**
 * The meeting day a date falls on, as the days to start with when students are added to a block from that day.
 * None for a weekend or an optional day: students are not put on those every week, minutes are only logged on them.
 */
export function schoolDay(date: string, optional: WeekDay[] = []): WeekDay[] {
  const day = weekDayOf(date);
  return day && meetingDays(optional).includes(day) ? [day] : [];
}

/** A name as it is kept: single spaces, no space at the ends, and not too long. */
export const cleanName = (name: unknown): string => String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);

/**
 * A typed name as it is used: the spelling already on the list when it is the same name in other capitals,
 * or else the name as typed. A name typed all in small letters gets a capital on each word ("mia cruz" is Mia Cruz).
 */
export function knownName(typed: unknown, names: string[]): string {
  const name = cleanName(typed);
  const known = names.find((n) => n.toLowerCase() === name.toLowerCase());
  if (known) return known;
  return name === name.toLowerCase() ? name.replace(/(^|[\s-])(\p{L})/gu, (_all, before: string, letter: string) => before + letter.toUpperCase()) : name;
}

/**
 * The names to tick from: the caseload, anyone who already has minutes, and names the teacher typed.
 * A student does not have to be on the caseload to be given minutes. No name twice (whatever its capitals), in A to Z order.
 */
export function minuteNames(workspace: { students: { name: string }[]; services: { student: string }[]; serviceLogs: { student: string }[] }, typed: string[] = []): string[] {
  const seen = new Map<string, string>();
  for (const raw of [...workspace.students.map((s) => s.name), ...workspace.services.map((s) => s.student), ...workspace.serviceLogs.map((s) => s.student), ...typed]) {
    const name = cleanName(raw);
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** What every ticked student gets, unless a student has something of their own. */
export type BulkCommon = {
  mode: BulkMode;
  /** The day the minutes were given (log). */
  date: string;
  /** A block's id. "" is each student's usual block (log), or no block (plan). */
  block: string;
  /** "" is each student's usual kind (log only). */
  kind: string;
  minutes: string;
  /** The days of the week (plan). None means the minutes are for the whole week. */
  days: WeekDay[];
  note: string;
};

/** A ticked student. Anything set here is that student's own, and is used in place of what everyone else gets. */
export type BulkPick = { minutes?: string; block?: string; kind?: string; days?: WeekDay[] };
/** The ticked students, by name. */
export type BulkPicks = Record<string, BulkPick>;

/** One ticked student with everything worked out: what will be saved for them. */
export type BulkLine = { student: string; block: string; kind: string; days: WeekDay[]; minutes: string };

export type PlanFields = Pick<ServicePlan, "student" | "kind" | "minutesPerWeek" | "days" | "block">;

const DEFAULT_KIND: string = SERVICE_KINDS[0];
const orderOf = (kind: string) => { const i = (SERVICE_KINDS as readonly string[]).indexOf(kind); return i < 0 ? SERVICE_KINDS.length : i; };

/**
 * The kind of service a session counts toward when the teacher did not say: the student's service in that
 * block, or else the only one they have (the first, when they have several), or else Push-in.
 */
export function usualKind(student: string, block: string, plans: ServicePlan[]): string {
  const mine = plans.filter((p) => p.student === student).sort((a, b) => orderOf(a.kind) - orderOf(b.kind));
  return ((block && mine.find((p) => p.block === block)) || mine[0])?.kind || DEFAULT_KIND;
}

/** What will be saved for one ticked student. */
export function bulkLine(common: BulkCommon, student: string, pick: BulkPick, plans: ServicePlan[], blocks: SchoolBlock[]): BulkLine {
  const known = (id: string | undefined) => (id && blocks.some((b) => b.id === id) ? id : "");
  const block = known(pick.block) || known(common.block);
  const kind = pick.kind || common.kind || (common.mode === "log" ? usualKind(student, block, plans) : DEFAULT_KIND);
  const days = common.mode === "plan" ? WEEK_DAYS.filter((d) => (pick.days ?? common.days).includes(d)) : [];
  return { student, block, kind, days, minutes: String(pick.minutes ?? "").trim() || String(common.minutes ?? "").trim() };
}

export type BulkResult = {
  /** The sessions to log (log), in the order of the students handed in. */
  logs: Omit<ServiceLog, "id">[];
  /** The required minutes to set (plan). */
  plans: PlanFields[];
  /** Ticked students that can't be saved yet, because they have no minutes. */
  missing: string[];
};

/** The required minutes one ticked student's line sets. null while they have no minutes. */
export function linePlan(line: BulkLine): PlanFields | null {
  const fields = planFields({ student: line.student, kind: line.kind, perWeek: line.minutes, days: line.days, perDay: line.minutes });
  return fields ? { student: fields.student, kind: fields.kind, minutesPerWeek: fields.minutesPerWeek, ...(fields.days ? { days: fields.days } : {}), ...(line.block ? { block: line.block } : {}) } : null;
}

/** Everything one save does. Only students in `students` (the caseload) are saved. */
export function bulkResult(common: BulkCommon, picks: BulkPicks, students: string[], plans: ServicePlan[], blocks: SchoolBlock[], today: string): BulkResult {
  const out: BulkResult = { logs: [], plans: [], missing: [] };
  for (const student of students) {
    const pick = picks[student];
    if (!pick) continue;
    const line = bulkLine(common, student, pick, plans, blocks);
    if (common.mode === "log") {
      const session = sessionLog({ student, kind: line.kind, date: common.date || today, minutes: line.minutes, note: common.note });
      if (!session) { out.missing.push(student); continue; }
      out.logs.push({ ...session, ...(line.block ? { block: line.block } : {}) });
    } else {
      const fields = linePlan(line);
      if (!fields) { out.missing.push(student); continue; }
      out.plans.push(fields);
    }
  }
  return out;
}

/**
 * Does adding these days join the minutes a student already has? It does when they are for the same kind of
 * service in the same block, and both are counted by the day: the new days are added, and the old ones stay.
 * Anything else (another block, or minutes counted by the week) takes the place of what was there.
 */
export function joinsPlan(old: Pick<ServicePlan, "days" | "block"> | undefined, fields: Pick<PlanFields, "days" | "block">): boolean {
  return !!old && (old.block || "") === (fields.block || "") && guideDays(old).length > 0 && guideDays(fields).length > 0;
}

/**
 * The required minutes with these set. Anyone new gets them counting from this week. A student who already
 * has minutes for the same kind of service keeps the day they started counting, and has the new days added
 * (see joinsPlan) or the new minutes put in place of the old. The list handed in is not changed.
 * `optional` are the teacher's optional days.
 */
export function withPlans(services: ServicePlan[], plans: PlanFields[], makeId: () => string, today: string, optional: WeekDay[] = []): ServicePlan[] {
  let out = services;
  for (const fields of plans) {
    const at = out.findIndex((s) => s.student === fields.student && s.kind === fields.kind);
    if (at < 0) { out = [...out, { id: makeId(), ...fields, since: weekStart(today) }]; continue; }
    // What was there is taken as it counts: a day that is optional now is not carried along.
    const old = countedPlan(out[at], optional);
    let next = fields;
    if (joinsPlan(old, fields)) {
      const both = { ...cleanDayGuide(old.days), ...cleanDayGuide(fields.days) };
      const days = Object.fromEntries(WEEK_DAYS.filter((d) => both[d]).map((d) => [d, both[d]!]));
      next = { ...fields, days, minutesPerWeek: Object.values(days).reduce((n, m) => n + m, 0) };
    }
    // Written out whole, so minutes changed from a day guide to a weekly number do not keep their old days.
    out = out.map((s, i) => (i === at ? { id: s.id, ...next, since: s.since || weekStart(today) } : s));
  }
  return out;
}

/** "Push-in · Block 2" or "Mon, Tue · 20 min each · Block 2 · Push-in": a ticked student's line in a few words. "" while they have no minutes. */
export function lineText(common: BulkCommon, line: BulkLine, plans: ServicePlan[], blocks: SchoolBlock[]): string {
  if (common.mode === "log") {
    // With no block of its own, a session goes in the block of the service it counts toward.
    const where = blockName(blocks, line.block) || blockName(blocks, plans.find((p) => p.student === line.student && p.kind === line.kind)?.block) || "No block";
    return `${line.kind} · ${where}`;
  }
  const fields = linePlan(line);
  return fields ? `${planText(fields, blockName(blocks, line.block))} · ${line.kind}` : "";
}

/** "Logged 30 min for 4 students." or "Added 4 students for every week. …": what a save did. */
export function savedText(result: Pick<BulkResult, "logs" | "plans">): string {
  const people = (n: number) => `${n} ${n === 1 ? "student" : "students"}`;
  if (result.plans.length) return `Added ${people(result.plans.length)} for every week. They show up on their days, so you do not add them again.`;
  if (!result.logs.length) return "";
  const amounts = new Set(result.logs.map((l) => l.minutes));
  return amounts.size === 1 ? `Logged ${result.logs[0].minutes} min for ${people(result.logs.length)}.` : `Logged minutes for ${people(result.logs.length)}.`;
}

// ─── Reading a screenshot ───────────────────────────────────────────────────
//
// The AI sends back one row for each student it found. A row is never trusted as it comes: the server
// tidies it (cleanReadRows), and the page only ticks students who are on the caseload (placeRead).

/** One student found in a screenshot. `block` is the block's name as it was read, not an id. */
export type ReadRow = {
  student: string; block: string; kind: string;
  /** Minutes in one session (one day), when that was written. */
  minutes: number | null;
  /** Minutes in a whole week, when a weekly total was written. */
  weekly: number | null;
  days: WeekDay[];
};

export const READ_ROWS_MAX = 150;

const squash = (value: unknown) => (value === null || value === undefined || typeof value === "object" ? "" : String(value)).replace(/\s+/g, " ").trim();
const whole = (value: unknown, max: number): number | null => {
  const n = typeof value === "number" ? value : squash(value) === "" ? NaN : Number(squash(value).replace(/\s*min(ute)?s?\.?$/i, ""));
  const rounded = Math.round(n);
  return Number.isFinite(rounded) && rounded > 0 && rounded <= max ? rounded : null;
};

const KIND_WORDS: [RegExp, string][] = [[/push|inclusion|in[- ]?class|co[- ]?t(each|aught)/, "Push-in"], [/pull|resource|small group/, "Pull-out"], [/consult/, "Consult"], [/other/, "Other"]];
/** "Push-in" from "push in", "PUSH-IN" or "inclusion"; "" when it is none of the kinds. */
export function cleanKind(value: unknown): string {
  const said = squash(value).toLowerCase();
  if (!said) return "";
  return (SERVICE_KINDS as readonly string[]).find((k) => k.toLowerCase() === said) || KIND_WORDS.find(([words]) => words.test(said))?.[1] || "";
}

const DAY_CODES: Record<string, WeekDay> = { m: "Mon", t: "Tue", tu: "Tue", w: "Wed", r: "Thu", th: "Thu", f: "Fri", sa: "Sat", su: "Sun" };
/** The days of the week in a list or in words ("Mon, Wed", "M/W/F", "daily"), in week order. */
export function cleanDays(value: unknown): WeekDay[] {
  const said = (Array.isArray(value) ? value : [value]).map(squash).join(" ").toLowerCase();
  if (!said) return [];
  if (/\b(daily|every ?day|each day|m ?(-|–|to|thru|through) ?f|mon(day)? ?(-|–|to|thru|through) ?fri(day)?)\b/.test(said)) return ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const found = new Set<WeekDay>();
  for (const word of said.split(/[^a-z]+/).filter(Boolean)) {
    const day = WEEK_DAYS.find((d) => word.length >= 3 && d.toLowerCase() === word.slice(0, 3)) || DAY_CODES[word];
    if (day) found.add(day);
    // Run together, the way a schedule writes them: "MWF", "TTh", "MTWRF".
    else if (/^(?:th|tu|m|t|w|r|f)+$/.test(word)) for (const code of word.match(/th|tu|m|t|w|r|f/g) || []) found.add(DAY_CODES[code]);
  }
  return WEEK_DAYS.filter((d) => found.has(d));
}

/** The rows the AI sent, made safe to use: a name on every one, real numbers, known kinds and days, and no more than the limit. */
export function cleanReadRows(raw: unknown): ReadRow[] {
  const out: ReadRow[] = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (out.length >= READ_ROWS_MAX) break;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const student = squash(row.student ?? row.name).slice(0, 80);
    if (!student) continue;
    out.push({ student, block: squash(row.block).slice(0, BLOCK_NAME_MAX), kind: cleanKind(row.kind), minutes: whole(row.minutes, 600), weekly: whole(row.weekly, 3000), days: cleanDays(row.days) });
  }
  return out;
}

const nameWords = (name: string) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9' -]+/g, " ").split(/[\s-]+/).map((w) => w.replace(/^'+|'+$/g, "")).filter(Boolean);

/**
 * Pairs every word of `few` with a word of its own in `many`. A strict pair is the same word. A loose pair
 * may also be a word and its start: an initial ("J" for Jordan), a short name ("Sam" for Samantha) or a
 * name that was cut off. `strong` says a real word was matched, so a lone initial never picks a student.
 */
function pairUp(few: string[], many: string[], loose: boolean): { ok: boolean; strong: boolean } {
  const left = [...many];
  let strong = false;
  // The longest words first, so "Jordan" takes Jordan before "J" is tried.
  for (const word of [...few].sort((a, b) => b.length - a.length)) {
    let at = left.indexOf(word);
    if (at >= 0) strong = true;
    else if (loose) {
      at = left.findIndex((other) => other.startsWith(word) || word.startsWith(other));
      if (at >= 0 && Math.min(word.length, left[at].length) >= 3) strong = true;
    }
    if (at < 0) return { ok: false, strong: false };
    left.splice(at, 1);
  }
  return { ok: true, strong };
}

/**
 * The student on the caseload that a name means ("Lee, Jordan", "Jordan", "Jordan L." or "J. Lee" for
 * Jordan Lee). "" when nobody fits, or when it could be more than one student.
 */
export function matchStudent(name: string, students: string[]): string {
  const said = nameWords(name);
  if (!said.length) return "";
  const list = students.map((student) => ({ student, words: nameWords(student) })).filter((s) => s.words.length);
  const fits = (loose: boolean) => list.filter(({ words }) => {
    const [few, many] = said.length <= words.length ? [said, words] : [words, said];
    const made = pairUp(few, many, loose);
    return made.ok && made.strong;
  });
  // The closest fit wins: the whole name, then part of it, then initials and short names.
  // As soon as one way of looking finds anybody, a looser way is not tried: it could only find more.
  for (const found of [fits(false).filter(({ words }) => words.length === said.length), fits(false), fits(true)]) {
    if (found.length) return found.length === 1 ? found[0].student : "";
  }
  return "";
}

const lone = (text: string) => { const m = text.match(/\d+/g); return m && m.length === 1 ? Number(m[0]) : null; };
const BLOCK_WORD = "(?:block|blk|period|per|pd|hour|hr|mod|b|p)";
const BLOCK_SAID = new RegExp(`^(?:${BLOCK_WORD}\\.?\\s*)?#?\\d+(?:st|nd|rd|th)?(?:\\s*${BLOCK_WORD}\\.?)?$`);
/** The teacher's block that a few words mean ("Block 2", "2", "2nd period", "P2"): its id, or "" when it is not one of them. */
export function matchBlock(text: string, blocks: SchoolBlock[]): string {
  const said = squash(text).toLowerCase();
  if (!said) return "";
  const named = blocks.find((b) => b.name.toLowerCase() === said);
  if (named) return named.id;
  const n = lone(said);
  if (n === null || !BLOCK_SAID.test(said)) return "";
  const numbered = blocks.filter((b) => lone(b.name) === n);
  return numbered.length === 1 ? numbered[0].id : "";
}

export type ReadPlaced = {
  /** The students to tick, each with what the screenshot said about them. */
  picks: BulkPicks;
  /** The ticked names that are new: not on the caseload, and not given minutes before. They are ticked as they were read, for the teacher to check. */
  unknown: string[];
  /** The screenshot says something about the week (days, or a weekly total), so it may be a schedule to set and not one day to log. */
  weekly: boolean;
};

/**
 * What a read screenshot ticks. A name that is not one of `students` is ticked as it was read, since a student
 * does not have to be on the caseload. A student in the screenshot twice is taken from the row in the block
 * that is already chosen, or else from the first row. Minutes are written the way the pop-up counts them:
 * for one day, or for the whole week when a student has no days. Optional days are never among a student's days.
 */
export function placeRead(rows: ReadRow[], common: BulkCommon, students: string[], blocks: SchoolBlock[], optional: WeekDay[] = []): ReadPlaced {
  const picks: BulkPicks = {};
  const unknown: string[] = [];
  const where = new Map<string, string>();
  for (const row of rows) {
    const read = cleanName(row.student);
    const student = matchStudent(read, students) || unknown.find((n) => n.toLowerCase() === read.toLowerCase()) || read;
    if (!student) continue;
    if (!students.includes(student) && !unknown.includes(student)) unknown.push(student);
    const block = matchBlock(row.block, blocks);
    // Already found: only a row in the chosen block takes its place.
    if (picks[student] && !(common.block && block === common.block && where.get(student) !== common.block)) continue;
    where.set(student, block);
    const kept = row.days.filter((d) => !optional.includes(d));
    const days = kept.length ? kept : undefined;
    let minutes: number | null = row.minutes;
    if (common.mode === "plan") {
      const count = (days ?? common.days).length;
      // A weekly total is split over the days it was written for, even when one of them is optional now.
      minutes = count ? row.minutes ?? (row.weekly ? Math.round(row.weekly / (days ? row.days.length : count)) : null) : row.weekly ?? row.minutes;
    }
    picks[student] = { ...(minutes ? { minutes: String(minutes) } : {}), ...(block ? { block } : {}), ...(row.kind ? { kind: row.kind } : {}), ...(days ? { days } : {}) };
  }
  return { picks, unknown: unknown.slice(0, READ_ROWS_MAX), weekly: rows.some((r) => r.days.length > 0 || r.weekly !== null) };
}
