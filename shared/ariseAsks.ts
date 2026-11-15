// "@arise" in Arise To Duo's tasks: type "@arise make a worksheet for Kha by Monday" as a task, and Arise's AI
// makes it, saves it under the task and sends a notification when it's ready. Every ask, with what Arise
// made, is kept in the Arise tab of Tasks (client/src/components/teacher-hub/AriseAsks.tsx). The server side
// is server/todoAsks.ts.
//
// Timing is read from the words, like Notes' smart dates (shared/smartDate.ts):
//   "by Monday", "for Monday", "due Monday", "tomorrow", "next week"  -> made now, the task is due that day
//   "before Monday"                                                  -> made now, due the day before
//   "on Monday", "Monday at 3pm", "tomorrow morning", "at 4pm"        -> made on that day (at that time, or
//                                                                       7:00 in the morning), due that day
// No day or time said: made now, with no due date.
import { smartDate } from "./smartDate";

export type AskStatus = "scheduled" | "working" | "done" | "failed";
export type AskKind = "worksheet" | "quiz" | "lesson" | "email" | "list" | "plan" | "story" | "recipe" | "summary" | "other";

export type AriseAsk = {
  id: string;
  /** What the person typed after @arise. */
  ask: string;
  /** The task it made (in the To Duo workspace), when there is one. */
  taskId?: string;
  kind: AskKind;
  status: AskStatus;
  createdAt: string;
  /** When Arise makes it (ISO). Now, or later for "on Monday". */
  runAt: string;
  /** The task's due day (YYYY-MM-DD), or "". */
  due: string;
  /** A short line about the timing, e.g. "Made now · due Mon, Nov 16". */
  when: string;
  title?: string;
  summary?: string;
  /** What Arise made, in Markdown. */
  result?: string;
  finishedAt?: string;
  error?: string;
  /** The person has opened it since it finished. */
  seen?: boolean;
};

/** The request in a task name that starts with @arise (or "@ arise"), or null. */
export function parseTaskAsk(text: string): string | null {
  const m = /^\s*@\s?arise\b[\s,:;.-]*([\s\S]*)$/i.exec(String(text || "").replace(/ /g, " "));
  const ask = m?.[1]?.trim() ?? "";
  return ask.length >= 3 ? ask.slice(0, 600) : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayBefore = (date: string) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - 1); return iso(d); };
const pretty = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const clock = (t: string) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`; };
export const MORNING = "07:00";

export type AskTiming = {
  /** "now": made right away. "later": made at runAt. */
  mode: "now" | "later";
  /** When to make it (local time, as a Date). */
  runAt: Date;
  /** The task's due day, or "". */
  due: string;
  /** The task's due time, or "". */
  dueTime: string;
  /** The ask without the words that said when (for the task's name). */
  title: string;
  when: string;
};

/** Reads when the person wants it, in their own time zone (the phone's clock). */
export function askTiming(ask: string, now: Date = new Date()): AskTiming {
  const found = timingWords(ask, now);
  if (!found) return { mode: "now", runAt: now, due: "", dueTime: "", title: ask, when: "Made now" };
  const said = found.matched.toLowerCase();
  const date = found.date || iso(now);
  const before = /\bbefore\b/.test(said) || new RegExp(`\\bbefore\\s+${escapeRe(found.matched.trim())}`, "i").test(ask);
  const by = /\b(by|due|for|until|till)\b/.test(said) || new RegExp(`\\b(by|due|for|until|till|before)\\s+${escapeRe(found.matched.trim())}`, "i").test(ask);
  const on = /\bon\b/.test(said) || new RegExp(`\\bon\\s+${escapeRe(found.matched.trim())}`, "i").test(ask);
  const title = cleanTitle(found.title.replace(/\b(by|due|for|until|till|before|on)\s*$/i, "")) || ask;
  if (before) {
    const due = dayBefore(date);
    return { mode: "now", runAt: now, due, dueTime: "", title, when: `Made now · ready before ${pretty(date)}` };
  }
  // "on Monday", a set time ("at 4pm", "Monday at 3pm") or a part of the day ("tomorrow morning"): made then.
  const timed = !!found.time && !by;
  if ((on || timed) && !by) {
    const at = new Date(`${date}T${found.time || MORNING}:00`);
    if (at.getTime() > now.getTime() + 60_000) {
      return { mode: "later", runAt: at, due: date, dueTime: found.time, title, when: `Made ${pretty(date)} at ${clock(found.time || MORNING)}` };
    }
  }
  return { mode: "now", runAt: now, due: date, dueTime: found.time, title, when: date === iso(now) ? "Made now · due today" : `Made now · due ${pretty(date)}` };
}

/**
 * The day and time the ask is for. When it names more than one day ("email the coach about Saturday on
 * Monday"), the one after "on", "by", "before", "due", "for", "until" wins, the last one said.
 */
function timingWords(ask: string, now: Date) {
  const preps = [...ask.matchAll(/\b(on|by|before|due|for|until|till)\s+/gi)].reverse();
  for (const p of preps) {
    const rest = ask.slice(p.index!);
    const r = smartDate(rest, now);
    // The date has to come right after the word ("on Monday", "by the 1st"), not somewhere later.
    if (r && rest.toLowerCase().indexOf(r.matched.toLowerCase().trim()) <= p[0].length + 4) {
      const at = rest.toLowerCase().indexOf(r.matched.toLowerCase().trim());
      const left = (ask.slice(0, p.index!) + rest.slice(0, at) + rest.slice(at + r.matched.trim().length)).replace(/\s{2,}/g, " ").trim();
      return { ...r, title: left || ask };
    }
  }
  return smartDate(ask, now);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cleanTitle = (s: string) => s.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").replace(/[\s,;:-]+$/g, "").trim();

/** What kind of thing is asked for (a hint for Arise, and the icon in the Arise tab). */
export function askKind(ask: string): AskKind {
  const a = ask.toLowerCase();
  if (/\bworksheets?\b|\bpractice (sheet|problems)\b|\bhomework\b/.test(a)) return "worksheet";
  if (/\bquiz(zes)?\b|\btest\b|\bflash ?cards?\b/.test(a)) return "quiz";
  if (/\blesson( plan)?\b|\bunit plan\b|\bteach\b/.test(a)) return "lesson";
  if (/\b(email|e-mail|letter|note to|message to|text to|reply to)\b/.test(a)) return "email";
  if (/\brecipes?\b|\bdinners?\b|\bmeals?\b|\bcook\b|\blunch(es)?\b|\bbreakfasts?\b/.test(a)) return "recipe";
  if (/\bstory\b|\bpoem\b/.test(a)) return "story";
  if (/\bsummar(y|ize|ise)\b|\bexplain\b/.test(a)) return "summary";
  if (/\bplan\b|\bschedule\b|\broutine\b|\bitinerary\b|\bagenda\b/.test(a)) return "plan";
  if (/\blist\b|\bchecklist\b|\bideas\b/.test(a)) return "list";
  return "other";
}

/** The task's name for an ask: "Arise: make a worksheet for Kha". */
export const askTaskTitle = (title: string) => `Arise: ${title}`.slice(0, 200);

export const ASK_LIMITS = { perUser: 200, result: 24_000, ask: 600 };
const ASK_ID = /^[a-z0-9]{6,24}$/;
export const isAskId = (v: unknown): v is string => typeof v === "string" && ASK_ID.test(v);
export const newAskId = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 16);

/** Saved asks, cleaned (newest first, at most ASK_LIMITS.perUser). */
export function cleanAsks(raw: unknown): AriseAsk[] {
  if (!Array.isArray(raw)) return [];
  const out: AriseAsk[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object" || !isAskId((r as any).id) || typeof (r as any).ask !== "string") continue;
    const a = r as AriseAsk;
    out.push({
      id: a.id, ask: a.ask.slice(0, ASK_LIMITS.ask), ...(typeof a.taskId === "string" ? { taskId: a.taskId.slice(0, 80) } : {}),
      kind: (["worksheet", "quiz", "lesson", "email", "list", "plan", "story", "recipe", "summary", "other"] as AskKind[]).includes(a.kind) ? a.kind : "other",
      status: (["scheduled", "working", "done", "failed"] as AskStatus[]).includes(a.status) ? a.status : "failed",
      createdAt: String(a.createdAt || ""), runAt: String(a.runAt || a.createdAt || ""), due: /^\d{4}-\d\d-\d\d$/.test(a.due || "") ? a.due : "",
      when: String(a.when || "").slice(0, 120),
      ...(a.title ? { title: String(a.title).slice(0, 120) } : {}), ...(a.summary ? { summary: String(a.summary).slice(0, 300) } : {}),
      ...(a.result ? { result: String(a.result).slice(0, ASK_LIMITS.result) } : {}), ...(a.finishedAt ? { finishedAt: String(a.finishedAt) } : {}),
      ...(a.error ? { error: String(a.error).slice(0, 200) } : {}), ...(a.seen ? { seen: true } : {}),
    });
  }
  return out.sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, ASK_LIMITS.perUser);
}

/** Arise's instructions for making what was asked. The person's words only fill in the request. */
export function askSystemPrompt(today: string, people: string[]): string {
  return [
    "You are Arise, the AI helper inside Arise To Duo, a planner for families, parents and teachers.",
    "The person typed a request as a to-do. Make the finished thing they asked for, complete and ready to use right away, not advice about how to make it.",
    "Worksheets: a title, short instructions, numbered questions with space to answer (use ____ blanks), and an answer key at the end under its own heading.",
    "Quizzes: numbered questions with lettered choices, then an answer key. Lesson plans: objective, materials, steps with times, and a quick check.",
    "Emails, letters and messages: ready to send, with a subject line for emails. Lists and plans: clear headings and checkboxes like - [ ].",
    "When it is for a child, keep it age-appropriate, kind and encouraging. If the age or grade isn't given, pick a sensible level and say so in one short line at the top.",
    "Never include anything unsafe, hateful or adult. Do not make up private facts about real people.",
    `Today is ${today}.${people.length ? ` People in this family or class: ${people.join(", ")}. A name in the request is probably one of them.` : ""}`,
    'Answer with JSON only: {"title": "a short name for what you made", "summary": "one friendly sentence saying it is ready", "markdown": "the whole thing in Markdown"}.',
  ].join("\n");
}
