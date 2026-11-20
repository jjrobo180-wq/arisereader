// Arise WorkHub: Coach. Help for the teacher in the moment, not another worksheet.
//
//   Live Coach    tap a student, say what's being taught and what's happening ("won't start", "stuck"); get three
//                 ways to explain it (hands-on, a picture, their interests), a 10-word direction, the first step, a
//                 "show me" check, and a ladder of help from least to most. It can be read aloud into an AirPod.
//   Help tracker  one tap after: what was tried, and whether it worked. Over weeks it learns each student
//                 ("Emani starts when given a choice"), shown on their profile and written as an IEP progress note.
//   Lesson prep   from a lesson: for each problem, the likely mistake and how to catch it, a worked example, a
//                 partly done version, the "just do this part" first step, and a "show me" question.
//
// Pure (tested). Server: the coach routes in server/teacherHubImport.ts. Page: components/teacher-hub/HubCoach.tsx.

// ── What a teacher can try (the help tracker's buttons), least help first ─────────────────────────────────────

export type StrategyId =
  | "choice" | "easy-first" | "one-at-a-time" | "first-step" | "hint" | "visual" | "hands-on" | "interest"
  | "model" | "partial" | "timer" | "break" | "less-writing" | "partner" | "praise";

export const STRATEGIES: { id: StrategyId; label: string; emoji: string }[] = [
  { id: "choice", label: "Gave a choice", emoji: "🔀" },
  { id: "easy-first", label: "Easy ones first", emoji: "✅" },
  { id: "one-at-a-time", label: "One problem at a time", emoji: "1️⃣" },
  { id: "first-step", label: "Did the first step together", emoji: "👣" },
  { id: "hint", label: "A hint or a question", emoji: "💡" },
  { id: "visual", label: "A picture or drawing", emoji: "🖍️" },
  { id: "hands-on", label: "Something to touch", emoji: "🧱" },
  { id: "interest", label: "Tied it to their interests", emoji: "⭐" },
  { id: "model", label: "Showed a worked example", emoji: "👀" },
  { id: "partial", label: "Gave it partly done", emoji: "🧩" },
  { id: "timer", label: "A short timer", emoji: "⏱️" },
  { id: "break", label: "A break first", emoji: "☕" },
  { id: "less-writing", label: "Said it instead of writing", emoji: "🗣️" },
  { id: "partner", label: "Worked with a partner", emoji: "🤝" },
  { id: "praise", label: "Specific praise", emoji: "🙌" },
];
const STRATEGY_IDS = new Set<string>(STRATEGIES.map((s) => s.id));
export const strategyLabel = (id: string) => STRATEGIES.find((s) => s.id === id)?.label ?? id;

/** What was happening when the teacher asked for help. */
export const SITUATIONS = [
  { id: "wont-start", label: "Won't start" },
  { id: "stuck", label: "Started, now stuck" },
  { id: "confused", label: "Doesn't get it" },
  { id: "upset", label: "Frustrated or shut down" },
  { id: "rushing", label: "Rushing, careless" },
] as const;
export type SituationId = (typeof SITUATIONS)[number]["id"];
const SITUATION_IDS = new Set<string>(SITUATIONS.map((s) => s.id));

/** Help from least to most: try the lowest that works, so the student stays the one doing it. */
export const PROMPT_LADDER = ["Wait (5 seconds)", "Point or gesture", "A hint or question", "Show part of it", "Show all of it", "Do it together"] as const;

// ── The help tracker ───────────────────────────────────────────────────────────────────────────────────────────

export type HelpLog = {
  id: string;
  student: string;
  /** YYYY-MM-DD */
  date: string;
  topic: string;
  situation?: SituationId;
  strategy: StrategyId;
  /** Did it get them going (or unstuck)? */
  worked: boolean;
  /** A word from the teacher, optional. */
  note?: string;
};

export const COACH_LIMITS = { topic: 120, note: 200, logs: 3000, studentNotes: 600, lesson: 4000 } as const;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function cleanHelpLogs(v: unknown): HelpLog[] {
  const out: HelpLog[] = [];
  for (const raw of Array.isArray(v) ? v : []) {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const id = str(o.id, 60), student = str(o.student, 80);
    if (!id || !student || !isDay(o.date) || !STRATEGY_IDS.has(String(o.strategy))) continue;
    const note = str(o.note, COACH_LIMITS.note);
    out.push({
      id, student, date: o.date, topic: str(o.topic, COACH_LIMITS.topic), strategy: o.strategy as StrategyId, worked: o.worked === true,
      ...(SITUATION_IDS.has(String(o.situation)) ? { situation: o.situation as SituationId } : {}), ...(note ? { note } : {}),
    });
  }
  return out.slice(-COACH_LIMITS.logs);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const logsFor = (logs: HelpLog[], student: string) => logs.filter((l) => same(l.student, student));

export type WhatWorks = { strategy: StrategyId; label: string; tries: number; worked: number; rate: number };
/**
 * What works for a student, best first: each thing tried, how often, and how often it worked. A strategy needs two
 * tries before it's ranked above one tried once (one lucky time isn't a pattern).
 */
export function whatWorks(logs: HelpLog[], student: string, situation?: SituationId): WhatWorks[] {
  const by = new Map<StrategyId, { tries: number; worked: number }>();
  for (const l of logsFor(logs, student)) {
    if (situation && l.situation && l.situation !== situation) continue;
    const s = by.get(l.strategy) ?? { tries: 0, worked: 0 };
    s.tries++; if (l.worked) s.worked++;
    by.set(l.strategy, s);
  }
  return [...by.entries()].map(([strategy, s]) => ({ strategy, label: strategyLabel(strategy), ...s, rate: s.worked / s.tries }))
    .sort((a, b) => (Math.min(b.tries, 2) - Math.min(a.tries, 2)) || (b.rate - a.rate) || (b.worked - a.worked));
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** One plain sentence: "Emani usually gets going with: gave a choice (4 of 5 times), a short timer (2 of 2)." */
export function whatWorksSentence(logs: HelpLog[], student: string): string {
  const first = student.split(" ")[0] || student;
  const good = whatWorks(logs, student).filter((w) => w.worked > 0 && w.rate >= 0.5).slice(0, 3);
  const bad = whatWorks(logs, student).filter((w) => w.tries >= 2 && w.rate < 0.34).slice(0, 2);
  if (!good.length && !bad.length) return logsFor(logs, student).length ? `Not enough yet to see a pattern for ${first}. Keep tapping what worked.` : "";
  const list = (ws: WhatWorks[]) => ws.map((w) => `${lower(w.label)} (${w.worked} of ${w.tries} time${w.tries === 1 ? "" : "s"})`).join(", ");
  return [good.length ? `${first} usually gets going with: ${list(good)}.` : "", bad.length ? `Less helpful so far: ${list(bad)}.` : ""].filter(Boolean).join(" ");
}

const dateWords = (d: string) => { const [y, m, day] = d.split("-").map(Number); return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }); };
/** An IEP progress note from the tracker, for a date range (inclusive). Empty when nothing was logged. */
export function progressNote(logs: HelpLog[], student: string, from: string, to: string): string {
  const mine = logsFor(logs, student).filter((l) => l.date >= from && l.date <= to);
  if (!mine.length) return "";
  const first = student.split(" ")[0] || student;
  const worked = mine.filter((l) => l.worked).length;
  const pct = Math.round((worked / mine.length) * 100);
  const starts = mine.filter((l) => l.situation === "wont-start");
  const best = whatWorks(mine, student).filter((w) => w.worked > 0).slice(0, 3);
  return [
    `From ${dateWords(from)} to ${dateWords(to)}, ${first} began or continued assigned work with teacher support in ${worked} of ${mine.length} recorded instances (${pct}%).`,
    starts.length ? `When reluctant to start, ${first} initiated the task after support ${starts.filter((l) => l.worked).length} of ${starts.length} times.` : "",
    best.length ? `Supports that were most effective: ${best.map((w) => `${lower(w.label)} (${w.worked}/${w.tries})`).join("; ")}.` : "",
  ].filter(Boolean).join(" ");
}

// ── Live Coach: what goes to the AI and what comes back ─────────────────────────────────────────────────────────

/** What the coach knows about the student (from their profile and the tracker). */
export type CoachStudent = { name: string; grade?: string; disability?: string; readingLevel?: string; mathLevel?: string; accommodations?: string; notes?: string; whatWorks?: string };
export type LiveAsk = { student: CoachStudent; topic: string; situation?: SituationId; subject?: string; detail?: string };

export function cleanLiveAsk(v: unknown): LiveAsk | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, any>;
  const topic = str(o.topic, COACH_LIMITS.topic);
  const s = (o.student && typeof o.student === "object" ? o.student : {}) as Record<string, unknown>;
  const name = str(s.name, 80);
  if (!topic || !name) return null;
  return {
    student: { name, grade: str(s.grade, 20), disability: str(s.disability, 80), readingLevel: str(s.readingLevel, 40), mathLevel: str(s.mathLevel, 40), accommodations: str(s.accommodations, 400), notes: str(s.notes, COACH_LIMITS.studentNotes), whatWorks: str(s.whatWorks, 400) },
    topic, ...(SITUATION_IDS.has(String(o.situation)) ? { situation: o.situation as SituationId } : {}), subject: str(o.subject, 40), detail: str(o.detail, 300),
  };
}

export function liveCoachPrompt(ask: LiveAsk): string {
  const s = ask.student;
  const first = s.name.split(" ")[0];
  const situation = SITUATIONS.find((x) => x.id === ask.situation)?.label ?? "Needs help with it";
  const facts = [
    s.grade && `Grade: ${s.grade}`, s.disability && `Disability on the IEP: ${s.disability}`, s.readingLevel && `Reading level: ${s.readingLevel}`, s.mathLevel && `Math level: ${s.mathLevel}`,
    s.accommodations && `Accommodations: ${s.accommodations}`, s.notes && `What the teacher knows about them (use their interests): ${s.notes}`, s.whatWorks && `What has worked before (lean on this): ${s.whatWorks}`,
  ].filter(Boolean).join("\n");
  return `You are a calm, expert special education coach whispering to a teacher in the middle of class. The teacher has seconds, not minutes.
The student: ${first}.
${facts || "Nothing else is known about them."}
What they're working on: ${ask.topic}${ask.subject ? ` (${ask.subject})` : ""}.
What's happening right now: ${situation}.${ask.detail ? `\nMore from the teacher: ${ask.detail}` : ""}

Coach the teacher. Everything must be something the teacher can SAY or DO in the next minute, in plain words a student at that level understands. No jargon, no theory, no lists of options inside a line. Short.
Reply with JSON only:
{
  "direction": "the direction to say to ${first}, 10 words or fewer",
  "firstStep": "the tiny first thing to ask ${first} to do (so starting feels easy)",
  "ways": [
    {"kind": "hands-on", "title": "a few words", "do": "what to put in front of them or have them do with their hands", "say": "what to say, one or two short sentences"},
    {"kind": "picture", "title": "a few words", "do": "what to draw or show", "say": "what to say"},
    {"kind": "interest", "title": "a few words", "do": "how to tie it to what ${first} cares about (from the notes; if none are known, use something common for their age and say so)", "say": "what to say"}
  ],
  "showMe": "one 'show me' check (never 'does that make sense?')",
  "watchFor": "the most likely mistake and how to spot it, one sentence",
  "ladder": ["help from least to most, 4 to 6 lines, each the exact words or action: start with wait time, end with doing it together"],
  "praise": "one specific praise line to say the moment they try"
}`;
}

export type LiveWay = { kind: "hands-on" | "picture" | "interest"; title: string; do: string; say: string };
export type LiveCoach = { direction: string; firstStep: string; ways: LiveWay[]; showMe: string; watchFor: string; ladder: string[]; praise: string };

export function cleanLiveCoach(v: unknown): LiveCoach | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, any>;
  const ways: LiveWay[] = [];
  for (const w of Array.isArray(o.ways) ? o.ways : []) {
    const kind = w?.kind === "hands-on" || w?.kind === "picture" || w?.kind === "interest" ? w.kind : null;
    const say = str(w?.say, 300), doIt = str(w?.do, 300);
    if (kind && (say || doIt) && !ways.some((x) => x.kind === kind)) ways.push({ kind, title: str(w?.title, 60) || kind, do: doIt, say });
  }
  const direction = str(o.direction, 120);
  if (!direction && !ways.length) return null;
  // The direction is 10 words at most, however the AI answered.
  const words = direction.split(" ");
  return {
    direction: words.length > 12 ? `${words.slice(0, 10).join(" ")}.` : direction,
    firstStep: str(o.firstStep, 200), ways, showMe: str(o.showMe, 200), watchFor: str(o.watchFor, 300),
    ladder: (Array.isArray(o.ladder) ? o.ladder : []).map((x: unknown) => str(x, 200)).filter(Boolean).slice(0, 6), praise: str(o.praise, 160),
  };
}

/** What the coach says in your ear (AirPods): the direction, the first step, and the first way to explain it. */
export function liveCoachSpeech(c: LiveCoach): string {
  const w = c.ways[0];
  return [c.direction && `Say: ${c.direction}`, c.firstStep && `First step: ${c.firstStep}`, w && `Try ${w.title}. ${w.do} ${w.say}`.trim()].filter(Boolean).join(". ").replace(/\.\./g, ".");
}

// ── Lesson prep ────────────────────────────────────────────────────────────────────────────────────────────────

/** The lesson, as text for the AI: its title, objective, and the plan's parts that exist. */
export function lessonText(l: Record<string, unknown>): string {
  const part = (label: string, key: string) => { const t = str(l[key], 1500); return t ? `${label}: ${t}` : ""; };
  return [part("Title", "title"), part("Subject", "subject"), part("Objective", "objective"), part("Vocabulary", "vocabulary"), part("I do", "iDo"), part("We do", "weDo"), part("You do", "youDo"),
    part("Assessment", "assessment"), part("Materials", "materials"), part("Summary", "summary")].filter(Boolean).join("\n").slice(0, COACH_LIMITS.lesson);
}

export function lessonPrepPrompt(lesson: string, students: string, extra: string): string {
  return `You are an expert special education coach helping a teacher prepare to EXPLAIN a lesson to students with IEPs who struggle to start work. The teacher doesn't need new worksheets; they need to know how to explain each problem and help a student start.
The lesson:
${lesson}
${extra ? `Problems or work the students will do (from the teacher):\n${extra}\n` : ""}${students ? `The students: ${students}\n` : ""}
Pick the 3 to 6 problems (or kinds of problem) students will do in this lesson. If the lesson doesn't list them, write typical ones for its objective and level.
For each, reply with what the teacher needs. Plain, short, said the way you'd say it to a student.
JSON only:
{
  "bigIdea": "the lesson's big idea in one sentence a student would understand",
  "vocab": [{"word": "...", "kidWords": "what it means, in 8 words or fewer"}],
  "problems": [
    {
      "problem": "the problem or task",
      "mistake": "the most likely mistake",
      "catchIt": "how to catch it early (what to look at or ask)",
      "worked": ["a worked example: each step, short, in order"],
      "partial": {"problem": "a similar problem", "done": ["the first steps, already done"], "left": "what the student finishes"},
      "firstStep": "the 'just do this part' first step",
      "showMe": "a 'show me' question to check understanding"
    }
  ]
}`;
}

export type PrepProblem = { problem: string; mistake: string; catchIt: string; worked: string[]; partial: { problem: string; done: string[]; left: string }; firstStep: string; showMe: string };
export type LessonPrep = { bigIdea: string; vocab: { word: string; kidWords: string }[]; problems: PrepProblem[] };

export function cleanLessonPrep(v: unknown): LessonPrep | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, any>;
  const list = (x: unknown, n: number, max: number) => (Array.isArray(x) ? x : []).map((y) => str(y, max)).filter(Boolean).slice(0, n);
  const problems: PrepProblem[] = [];
  for (const p of Array.isArray(o.problems) ? o.problems : []) {
    const problem = str(p?.problem, 300);
    if (!problem) continue;
    problems.push({
      problem, mistake: str(p?.mistake, 300), catchIt: str(p?.catchIt, 300), worked: list(p?.worked, 10, 200),
      partial: { problem: str(p?.partial?.problem, 300), done: list(p?.partial?.done, 8, 200), left: str(p?.partial?.left, 200) },
      firstStep: str(p?.firstStep, 200), showMe: str(p?.showMe, 200),
    });
  }
  if (!problems.length) return null;
  const vocab = (Array.isArray(o.vocab) ? o.vocab : []).map((x: any) => ({ word: str(x?.word, 40), kidWords: str(x?.kidWords, 120) })).filter((x: { word: string }) => x.word).slice(0, 10);
  return { bigIdea: str(o.bigIdea, 300), vocab, problems: problems.slice(0, 8) };
}

/** Saved prep, so a lesson's coaching is there next time without asking again. */
export type SavedPrep = { lessonId: string; at: string; prep: LessonPrep };
export function cleanSavedPreps(v: unknown): SavedPrep[] {
  const out: SavedPrep[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const prep = cleanLessonPrep((x as any)?.prep);
    const lessonId = str((x as any)?.lessonId, 60);
    if (prep && lessonId && !out.some((y) => y.lessonId === lessonId)) out.push({ lessonId, at: str((x as any)?.at, 40), prep });
  }
  return out.slice(-60);
}
