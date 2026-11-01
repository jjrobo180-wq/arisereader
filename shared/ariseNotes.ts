// Arise Notes: the A.R.I.S.E. AI note taker. It records (or takes an uploaded file), writes down what
// was said with times, and turns it into a summary, key points, decisions and action items that go
// straight into the Arise To Duo planner after the person checks them.
//
// This file holds the rules both sides share: the plans and what each one allows, minute metering
// (round up per recording, rollover, the 80% and 100% warnings, the 3,000-minute safety cap), the
// summary templates and the shape of every AI answer (cleaned here, so a bad answer can't break the
// app), the prompts, and the plain text and HTML of a note for copying, email, PDF and Word.
// The server is server/ariseNotes.ts; the app is client/src/components/arise-notes/.

// ─── Plans ────────────────────────────────────────────────────────────────────

export type NotesPlanId = "free" | "basic" | "plus" | "family";
export type NotesPlan = {
  id: NotesPlanId;
  name: string;
  /** Price a month, in cents (0 for Free). */
  monthlyCents: number;
  /** Price a year, in cents, when there is a yearly price. */
  yearlyCents?: number;
  /** Minutes of audio a month (shared by everyone on a Family plan). */
  minutes: number;
  /** The longest single recording or upload, in seconds. */
  maxSecs: number;
  /** Unused minutes carry into the next month, up to one month's worth. */
  rollover: boolean;
  /** "Speaker 1", "Speaker 2" labels on the transcript. */
  speakers: boolean;
  /** IEP and parent-meeting mode. */
  iep: boolean;
  /** Everything past the summary: templates, exports, sharing, Ask your notes, planner, teacher tools. */
  extras: boolean;
  /** People on the plan. */
  people: number;
  blurb: string;
};

export const NOTES_PLANS: Record<NotesPlanId, NotesPlan> = {
  free: { id: "free", name: "Free", monthlyCents: 0, minutes: 60, maxSecs: 30 * 60, rollover: false, speakers: false, iep: false, extras: false, people: 1, blurb: "Try it: an hour a month, summaries only." },
  basic: { id: "basic", name: "Basic", monthlyCents: 499, minutes: 600, maxSecs: 2 * 3600, rollover: false, speakers: false, iep: false, extras: true, people: 1, blurb: "10 hours a month and every tool except speaker labels." },
  plus: { id: "plus", name: "Plus", monthlyCents: 799, yearlyCents: 7999, minutes: 1500, maxSecs: 2 * 3600, rollover: true, speakers: true, iep: true, extras: true, people: 1, blurb: "25 hours a month, speaker labels, IEP mode and rollover." },
  family: { id: "family", name: "Family", monthlyCents: 999, minutes: 2000, maxSecs: 2 * 3600, rollover: true, speakers: true, iep: true, extras: true, people: 4, blurb: "2,000 minutes shared by up to 4 people, with everything in Plus." },
};
export const NOTES_PLAN_IDS: readonly NotesPlanId[] = ["free", "basic", "plus", "family"];
export const isNotesPlanId = (v: unknown): v is NotesPlanId => typeof v === "string" && (NOTES_PLAN_IDS as readonly string[]).includes(v);

/** What a person can buy: the four paid choices (Plus also comes yearly). */
export type NotesProduct = "basic" | "plus" | "plus_year" | "family";
export const NOTES_PRODUCTS: readonly NotesProduct[] = ["basic", "plus", "plus_year", "family"];
export const isNotesProduct = (v: unknown): v is NotesProduct => typeof v === "string" && (NOTES_PRODUCTS as readonly string[]).includes(v);
export const planOfProduct = (p: NotesProduct): NotesPlanId => (p === "plus_year" ? "plus" : p);
export const productPrice = (p: NotesProduct): { cents: number; interval: "month" | "year" } =>
  p === "plus_year" ? { cents: NOTES_PLANS.plus.yearlyCents!, interval: "year" } : { cents: NOTES_PLANS[planOfProduct(p)].monthlyCents, interval: "month" };
export const productName = (p: NotesProduct) =>
  p === "plus_year" ? "Arise Notes Plus, yearly (1,500 minutes a month)"
    : p === "family" ? "Arise Notes Family (2,000 minutes a month for up to 4 people)"
      : p === "plus" ? "Arise Notes Plus (1,500 minutes a month)"
        : "Arise Notes Basic (600 minutes a month)";

/** No account transcribes more than this many minutes in a month, on any plan (stops abuse). */
export const NOTES_HARD_CAP = 3000;
/** Uploads: up to 2 hours or 500 MB. */
export const NOTES_UPLOAD_MAX_BYTES = 500 * 1024 * 1024;
/** A live recording is sent in pieces this long, so it is written down as it goes. */
export const PIECE_SECS = 5 * 60;
/** With speaker labels, pieces are longer, so the same voice keeps the same number. */
export const DIARIZE_PIECE_SECS = 30 * 60;
/** The most one piece may weigh (the speech-to-text services take up to 25 MB). */
export const PIECE_MAX_BYTES = 24 * 1024 * 1024;
/** A voice memo (memo to task) is short. */
export const MEMO_MAX_SECS = 120;

export type NotesFeature =
  | "templates" | "export" | "share" | "ask" | "memo" | "planner" | "calendar" | "parent" | "translate" | "study"
  | "speakers" | "iep" | "rollover";

/** Free is summaries only; Basic is everything except speaker labels (and the Plus extras); Plus and Family have it all. */
export function allows(plan: NotesPlanId, feature: NotesFeature): boolean {
  if (feature === "speakers" || feature === "iep" || feature === "rollover") return plan === "plus" || plan === "family";
  return plan !== "free";
}
/** The cheapest plan that has a feature. */
export const planFor = (feature: NotesFeature): NotesPlanId => (feature === "speakers" || feature === "iep" || feature === "rollover" ? "plus" : "basic");

// ─── Minutes ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
/** The first day of the month (UTC) a moment falls in: "2026-11-01". */
export const monthStartOf = (ms: number) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`; };
export const nextMonthStart = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return m >= 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
};
export const monthsBetween = (a: string, b: string) => {
  const [ya, ma] = a.split("-").map(Number); const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
};

/** One person's minute record for this month. `used` is the pool's (the Family owner's row holds the
 *  family's minutes); `own` is what this person transcribed themselves (for the safety cap). */
export type NotesAccount = {
  userId: number;
  period: string;
  used: number;
  own: number;
  rollover: number;
  /** The highest warning sent this month: 0, 80 or 100. */
  warned: number;
  settings: NotesSettings;
};
export const newAccount = (userId: number, nowMs: number): NotesAccount => ({ userId, period: monthStartOf(nowMs), used: 0, own: 0, rollover: 0, warned: 0, settings: { ...DEFAULT_SETTINGS } });

/**
 * A new month: minutes start again. On a plan with rollover, what was left last month carries in,
 * up to one month's worth. A month that went by unused counts as fully left over.
 */
export function rollAccount(a: NotesAccount, plan: NotesPlan, nowMs: number): NotesAccount {
  const current = monthStartOf(nowMs);
  if (a.period >= current) return a;
  const gap = monthsBetween(a.period, current);
  let rollover = 0;
  if (plan.rollover) {
    const left = Math.max(0, plan.minutes + Math.min(Math.max(0, a.rollover), plan.minutes) - Math.max(0, a.used));
    rollover = gap > 1 ? plan.minutes : Math.min(plan.minutes, left);
  }
  return { ...a, period: current, used: 0, own: 0, rollover, warned: 0 };
}

export type UsageView = {
  plan: NotesPlanId;
  /** The plan's minutes a month. */
  base: number;
  /** Minutes carried in from last month (0 on plans without rollover). */
  rollover: number;
  /** base + rollover. */
  allowance: number;
  used: number;
  /** Minutes that can still be transcribed this month (also within the safety cap). */
  left: number;
  /** This person's own minutes this month, and what the safety cap still allows them. */
  own: number;
  capLeft: number;
  /** The day the minutes start again. */
  resetOn: string;
  /** 0–100. */
  pct: number;
  /** 80 once 80% is used, 100 once it's all used. */
  warn: 0 | 80 | 100;
  /** Minutes come from a Family plan's shared pool. */
  pooled: boolean;
  maxSecs: number;
};

export function usageView(pool: NotesAccount, me: NotesAccount, planId: NotesPlanId, pooled = false): UsageView {
  const plan = NOTES_PLANS[planId];
  const rollover = plan.rollover ? Math.min(Math.max(0, pool.rollover), plan.minutes) : 0;
  const allowance = plan.minutes + rollover;
  const used = Math.max(0, pool.used);
  const own = Math.max(0, me.own);
  const capLeft = Math.max(0, NOTES_HARD_CAP - own);
  const left = Math.max(0, Math.min(allowance - used, capLeft));
  const pct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 100;
  const warn: 0 | 80 | 100 = used >= allowance ? 100 : used >= allowance * 0.8 ? 80 : 0;
  return { plan: planId, base: plan.minutes, rollover, allowance, used, left, own, capLeft, resetOn: nextMonthStart(pool.period), pct, warn, pooled, maxSecs: plan.maxSecs };
}

/** "Dec 1" (or "Dec 1, 2027" in another year). */
export function dayWords(isoDay: string, nowMs = Date.now()): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  if (!y || !m || !d) return isoDay;
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[m - 1]} ${d}${y !== new Date(nowMs).getUTCFullYear() ? `, ${y}` : ""}`;
}
export const outOfMinutesText = (resetOn: string, nowMs = Date.now()) => `Out of minutes: upgrade or wait until ${dayWords(resetOn, nowMs)}.`;
export const capText = (resetOn: string, nowMs = Date.now()) => `This account has used its monthly safety limit of ${NOTES_HARD_CAP.toLocaleString("en-US")} minutes. It starts again on ${dayWords(resetOn, nowMs)}.`;

/** Can a piece of about `estSecs` seconds be written down now? */
export function transcribeCheck(u: UsageView, estSecs: number, nowMs = Date.now()): { ok: true } | { ok: false; reason: "minutes" | "cap"; message: string } {
  const est = Math.max(1, Math.ceil(Math.max(0, estSecs) / 60));
  if (u.capLeft < est) return { ok: false, reason: "cap", message: capText(u.resetOn, nowMs) };
  if (u.used >= u.allowance) return { ok: false, reason: "minutes", message: outOfMinutesText(u.resetOn, nowMs) };
  return { ok: true };
}

/** Whole minutes for a recording of `secs` seconds: always rounded up (61 seconds is 2 minutes). */
export const minutesFor = (secs: number) => (secs > 0 ? Math.ceil(Math.round(secs * 100) / 6000) : 0);

/** Adding `addSecs` of transcribed audio to a recording already charged `chargedSecs`/`chargedMinutes`:
 *  the recording's new total and how many more minutes it costs. Rounded per recording, not per piece. */
export function chargeFor(chargedSecs: number, chargedMinutes: number, addSecs: number) {
  const secs = Math.max(0, chargedSecs) + Math.max(0, addSecs);
  const minutes = minutesFor(secs);
  return { secs, minutes, delta: Math.max(0, minutes - Math.max(0, chargedMinutes)) };
}

/** The warning to send after usage went from `before` to `after` (0 when none is due). */
export function warningDue(after: number, allowance: number, warned: number): 0 | 80 | 100 {
  const level: 0 | 80 | 100 = after >= allowance ? 100 : after >= allowance * 0.8 ? 80 : 0;
  return level > warned ? level : 0;
}

/** What it costs us, roughly, in cents (for spotting heavy users). */
export const PROVIDER_CENTS_PER_MIN: Record<string, number> = {
  groq: 0.0667, // whisper-large-v3-turbo, $0.04 an hour
  openai: 0.3, // gpt-4o-mini-transcribe
  "openai-diarize": 0.6, // gpt-4o-transcribe-diarize
  "openai-whisper": 0.6,
  deepgram: 0.43,
  "deepgram-diarize": 0.45,
};
/** AI writing (summaries, answers): about half a dollar a million tokens, at four characters a token. */
export const aiCents = (chars: number) => Math.round((chars / 4) * 0.00005 * 10_000) / 10_000;

// ─── Settings ─────────────────────────────────────────────────────────────────

export type AudioKeep = "delete" | "30d" | "keep";
export type NotesSettings = {
  /** What happens to the audio once it's written down. Deleted by default: only the text is kept. */
  audio: AudioKeep;
  /** Dyslexia-friendly font. */
  font: "standard" | "dyslexic";
  /** Simple-text mode: plain words, one thing at a time. */
  simple: boolean;
  contrast: boolean;
  large: boolean;
  /** Ask "Let everyone know this meeting is being recorded" before each recording. */
  consent: boolean;
  template: NotesTemplateId;
  /** The AI voice that reads notes aloud. */
  voice: string;
  /** Where action items go by default. */
  hub: "life" | "work";
};
export const DEFAULT_SETTINGS: NotesSettings = { audio: "delete", font: "standard", simple: false, contrast: false, large: false, consent: true, template: "general", voice: "hannah", hub: "life" };
const VOICES = ["hannah", "autumn", "diana", "austin", "daniel", "troy"];
export function cleanSettings(raw: unknown): NotesSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    audio: r.audio === "30d" || r.audio === "keep" ? r.audio : "delete",
    font: r.font === "dyslexic" ? "dyslexic" : "standard",
    simple: r.simple === true,
    contrast: r.contrast === true,
    large: r.large === true,
    consent: r.consent !== false,
    template: isTemplateId(r.template) ? r.template : "general",
    voice: typeof r.voice === "string" && VOICES.includes(r.voice) ? r.voice : "hannah",
    hub: r.hub === "work" ? "work" : "life",
  };
}

// ─── Templates ────────────────────────────────────────────────────────────────

export type NotesTemplateId = "general" | "iep" | "parent" | "staff" | "lecture" | "doctor" | "interview";
export type NotesTemplate = { id: NotesTemplateId; label: string; emoji: string; blurb: string; sections: string[]; focus: string; needs?: NotesFeature };
export const NOTES_TEMPLATES: NotesTemplate[] = [
  { id: "general", label: "General", emoji: "📝", blurb: "Summary, key points, decisions and to-dos.", sections: [], focus: "A clear general summary." },
  { id: "iep", label: "IEP meeting", emoji: "🧩", blurb: "A structured IEP draft for you to review.", sections: [], focus: "An IEP or special education meeting about one student.", needs: "iep" },
  { id: "parent", label: "Parent conference", emoji: "👪", blurb: "Strengths, concerns, agreements, help at home.", sections: ["Strengths", "Concerns", "What we agreed", "How to help at home"], focus: "A parent-teacher conference about a child.", needs: "templates" },
  { id: "staff", label: "Staff meeting", emoji: "🏫", blurb: "Announcements, decisions, who does what.", sections: ["Announcements", "Decisions", "Who is doing what"], focus: "A staff or team meeting.", needs: "templates" },
  { id: "lecture", label: "Class lecture", emoji: "🎓", blurb: "Main ideas, key terms, examples, homework.", sections: ["Main ideas", "Key terms", "Examples", "Homework and due dates"], focus: "A class lecture or lesson, summarized for studying.", needs: "templates" },
  { id: "doctor", label: "Doctor visit", emoji: "🩺", blurb: "Findings, medicines, instructions, follow-up.", sections: ["Why we went", "What the doctor found", "Medicines", "What to do at home", "Follow-up"], focus: "A doctor or therapy visit. Be careful and exact with medicines and doses; never add medical advice of your own.", needs: "templates" },
  { id: "interview", label: "Interview", emoji: "🎙️", blurb: "About them, strengths, concerns, quotes.", sections: ["About them", "Strengths", "Concerns", "Notable quotes", "Next steps"], focus: "An interview (a job interview, a podcast or a conversation with one person).", needs: "templates" },
];
export const isTemplateId = (v: unknown): v is NotesTemplateId => typeof v === "string" && NOTES_TEMPLATES.some((t) => t.id === v);
export const templateOf = (id: unknown): NotesTemplate => NOTES_TEMPLATES.find((t) => t.id === id) ?? NOTES_TEMPLATES[0];
export const templateAllowed = (plan: NotesPlanId, id: NotesTemplateId) => { const t = templateOf(id); return !t.needs || allows(plan, t.needs); };

// ─── What the AI gives back ───────────────────────────────────────────────────

/** A line of a summary, with the second it was said (to jump there), when known. */
export type Timed = { text: string; t: number | null };
export type NoteAction = { what: string; who: string; due: string; t: number | null };
export type NoteDate = { title: string; date: string; time: string };
export type NoteSection = { heading: string; items: Timed[] };
export type IepGoal = { area: string; text: string };
export type IepService = { service: string; minutes: number; per: "day" | "week" | "month"; provider: string };
export type IepDraft = {
  student: string;
  attendees: string[];
  strengths: string[];
  concerns: string[];
  goals: IepGoal[];
  services: IepService[];
  accommodations: string[];
  decisions: string[];
  nextSteps: NoteAction[];
  /** YYYY-MM-DD, or "". */
  nextMeeting: string;
};
export type NoteSummary = {
  title: string;
  summary: string;
  /** What the person marked while recording, first. */
  highlights: Timed[];
  keyPoints: Timed[];
  decisions: Timed[];
  actions: NoteAction[];
  questions: Timed[];
  /** The template's own sections (Medicines, Homework…). */
  sections: NoteSection[];
  /** Meetings and appointments that were set, to add to the calendar. */
  dates: NoteDate[];
  iep: IepDraft | null;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
export const isDay = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const day = (v: unknown) => (isDay(v) ? v : "");
const clock = (v: unknown) => { const m = /^(\d{1,2}):(\d{2})/.exec(typeof v === "string" ? v.trim() : ""); return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${pad(Number(m[1]))}:${m[2]}` : ""; };
const secsOf = (v: unknown, maxT: number): number | null => {
  let n: number | null = null;
  if (typeof v === "number" && Number.isFinite(v)) n = v;
  else if (typeof v === "string") {
    const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(v.trim());
    if (m) n = Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    else if (/^\d+(\.\d+)?$/.test(v.trim())) n = Number(v);
  }
  return n !== null && n >= 0 && n <= maxT + 5 ? Math.round(n) : null;
};
const timed = (v: unknown, maxT: number, max: number, len = 400): Timed[] =>
  arr(v, max).map((x: any) => (typeof x === "string" ? { text: str(x, len), t: null } : { text: str(x?.text ?? x?.point ?? x?.item, len), t: secsOf(x?.t ?? x?.time ?? x?.at, maxT) })).filter((x) => x.text);
const words = (v: unknown, max: number, len = 300) => arr(v, max).map((x: any) => str(typeof x === "string" ? x : x?.text ?? x?.name, len)).filter(Boolean);
const actionsOf = (v: unknown, maxT: number, max = 30): NoteAction[] =>
  arr(v, max).map((x: any) => ({ what: str(typeof x === "string" ? x : x?.what ?? x?.task ?? x?.text, 200), who: str(x?.who ?? x?.owner, 80), due: day(x?.due ?? x?.date), t: secsOf(x?.t ?? x?.time, maxT) })).filter((x) => x.what);

export function cleanIep(raw: unknown): IepDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const services = arr(r.services, 20).map((x: any): IepService => ({
    service: str(x?.service ?? x?.name, 80),
    minutes: Math.max(0, Math.min(3000, Math.round(Number(x?.minutes) || 0))),
    per: x?.per === "day" || x?.per === "month" ? x.per : "week",
    provider: str(x?.provider, 80),
  })).filter((s) => s.service);
  return {
    student: str(r.student, 80),
    attendees: words(r.attendees, 20, 120),
    strengths: words(r.strengths, 20),
    concerns: words(r.concerns, 20),
    goals: arr(r.goals, 20).map((x: any) => ({ area: str(x?.area, 60), text: str(typeof x === "string" ? x : x?.text ?? x?.goal, 400) })).filter((g) => g.text),
    services,
    accommodations: words(r.accommodations, 30),
    decisions: words(r.decisions, 20),
    nextSteps: actionsOf(r.nextSteps ?? r.next_steps, 1e9, 20),
    nextMeeting: day(r.nextMeeting ?? r.next_meeting),
  };
}

/** Cleans what the AI wrote for a summary. `maxT` is the recording's length in seconds. */
export function cleanSummary(raw: unknown, template: NotesTemplateId, maxT: number): NoteSummary {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const t = templateOf(template);
  const sectionsIn = arr(r.sections, 12).map((s: any) => ({ heading: str(s?.heading ?? s?.title, 60), items: timed(s?.items, maxT, 20) })).filter((s) => s.heading && s.items.length);
  // Keep the template's sections in its own order.
  const sections = t.sections.length
    ? t.sections.map((h) => sectionsIn.find((s) => s.heading.toLowerCase() === h.toLowerCase()) ?? null).filter((s): s is NoteSection => !!s)
      .concat(sectionsIn.filter((s) => !t.sections.some((h) => h.toLowerCase() === s.heading.toLowerCase())))
    : sectionsIn;
  return {
    title: str(r.title, 90),
    summary: str(r.summary, 1500),
    highlights: timed(r.highlights, maxT, 20),
    keyPoints: timed(r.keyPoints ?? r.key_points, maxT, 20),
    decisions: timed(r.decisions, maxT, 20),
    actions: actionsOf(r.actions ?? r.actionItems ?? r.action_items, maxT),
    questions: timed(r.questions ?? r.openQuestions ?? r.open_questions, maxT, 20),
    sections,
    dates: arr(r.dates ?? r.meetingDates, 10).map((x: any) => ({ title: str(x?.title ?? x?.what, 120), date: day(x?.date), time: clock(x?.time) })).filter((d) => d.title && d.date),
    iep: template === "iep" ? cleanIep(r.iep) : null,
  };
}

export type ParentEmail = { subject: string; body: string; language: string };
export function cleanParentEmail(raw: unknown, language: string): ParentEmail | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const body = typeof r.body === "string" ? r.body.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 6000) : "";
  return body ? { subject: str(r.subject, 140) || "Notes from our meeting", body, language } : null;
}

export type Flashcard = { front: string; back: string };
export type StudyQuestion = { q: string; choices: string[]; answer: number; why: string };
export type StudyTools = { flashcards: Flashcard[]; quiz: StudyQuestion[] };
export function cleanStudy(raw: unknown): StudyTools {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flashcards = arr(r.flashcards, 30).map((x: any) => ({ front: str(x?.front ?? x?.term, 200), back: str(x?.back ?? x?.definition, 500) })).filter((c) => c.front && c.back);
  const quiz = arr(r.quiz, 10).map((x: any) => {
    const choices = arr(x?.choices ?? x?.options, 4).map((c) => str(c, 160)).filter(Boolean);
    const answer = Math.round(Number(x?.answer));
    return { q: str(x?.q ?? x?.question, 300), choices, answer, why: str(x?.why ?? x?.explanation, 400) };
  }).filter((q) => q.q && q.choices.length === 4 && q.answer >= 0 && q.answer < 4);
  return { flashcards, quiz };
}

export type MemoKind = "task" | "event" | "note";
export type MemoIdea = { kind: MemoKind; title: string; details: string; date: string; time: string };
export function cleanMemo(raw: unknown, fallbackText: string): MemoIdea {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kind: MemoKind = r.kind === "event" || r.kind === "note" ? r.kind : "task";
  const date = day(r.date);
  return {
    kind: kind === "event" && !date ? "task" : kind,
    title: str(r.title, 120) || str(fallbackText, 120) || "Voice memo",
    details: str(r.details ?? r.notes, 1500),
    date,
    time: clock(r.time),
  };
}

export type AskPlan = { keywords: string[]; from: string; to: string };
export function cleanAskPlan(raw: unknown): AskPlan {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { keywords: words(r.keywords, 20, 40), from: day(r.from), to: day(r.to) };
}

// ─── Search ───────────────────────────────────────────────────────────────────

const STOP = new Set("a an and are as at be but by did do does for from had has have he her his how i if in into is it its me my of on or our she so that the their them they this to was we were what when where which who why will with you your".split(" "));
/** Words for Postgres's websearch_to_tsquery, any of which may match ("maya or mom or promise"). */
export function searchQuery(terms: string[]): string {
  const out: string[] = [];
  for (const t of terms) {
    for (const w of t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)) {
      if (w.length < 2 || STOP.has(w) || out.includes(w)) continue;
      out.push(w);
      if (out.length >= 24) break;
    }
  }
  return out.join(" or ");
}

// ─── Transcript ───────────────────────────────────────────────────────────────

export type Segment = { idx: number; start: number; end: number; speaker: string | null; text: string };
/** "1:05" or "1:02:05". */
export function fmtClock(secs: number): string {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}
export const speakerName = (speaker: string | null, names: Record<string, string>) => (speaker ? (names[speaker]?.trim() || `Speaker ${speaker}`) : "");
/** Segment numbers: piece n, line i. Lines of later pieces always sort after earlier ones. */
export const segmentIdx = (piece: number, line: number) => piece * 100_000 + line;

/** Transcript lines for the AI: "[12:03] Speaker 1: …", with ★ on lines near a highlight. */
export function transcriptForAi(segs: Segment[], names: Record<string, string>, highlights: number[] = []): string[] {
  return segs.map((s) => {
    const star = highlights.some((h) => h >= s.start - 20 && h <= s.end + 5) ? "★ " : "";
    const who = speakerName(s.speaker, names);
    return `${star}[${fmtClock(s.start)}] ${who ? `${who}: ` : ""}${s.text}`;
  });
}
/** Splits transcript lines into parts of at most `maxChars` characters, for long recordings. */
export function splitLines(lines: string[], maxChars: number): string[] {
  const parts: string[] = [];
  let cur = "";
  for (const l of lines) {
    if (cur && cur.length + l.length + 1 > maxChars) { parts.push(cur); cur = ""; }
    cur += (cur ? "\n" : "") + l.slice(0, maxChars);
  }
  if (cur) parts.push(cur);
  return parts;
}
/** Short enough to summarize in one go (about 7,000 tokens). */
export const ONE_GO_CHARS = 28_000;
export const PART_CHARS = 22_000;

// ─── Prompts ──────────────────────────────────────────────────────────────────

const JSON_ONLY = "Answer with one JSON object only, no other text.";
const TRUTH = "Use only what was actually said. Never invent names, numbers, dates or promises. If something wasn't said, leave it out (use an empty list or an empty string).";
const TIMES = "Each item may have \"t\": the number of seconds into the recording where it was said, read from the [m:ss] mark of the line (for [12:03] use 723). Use null when unsure.";

function summaryShape(t: NotesTemplate): string {
  const base = `{"title": short title (max 8 words), "summary": 2-4 sentence summary, "highlights": [{"text","t"}] (only the lines marked ★, first, in order), "keyPoints": [{"text","t"}] (3-10), "decisions": [{"text","t"}], "actions": [{"what","who","due","t"}] (who = the person who will do it, "" if not said; due = YYYY-MM-DD or ""), "questions": [{"text","t"}] (questions still open), "dates": [{"title","date","time"}] (meetings or appointments that were set, date YYYY-MM-DD, time HH:MM 24-hour or "")`;
  const sections = t.sections.length ? `, "sections": [${t.sections.map((s) => `{"heading": "${s}", "items": [{"text","t"}]}`).join(", ")}]` : "";
  const iep = t.id === "iep"
    ? `, "iep": {"student": first name of the student or "", "attendees": [names and roles], "strengths": [], "concerns": [], "goals": [{"area", "text"}], "services": [{"service", "minutes" (number), "per": "day"|"week"|"month", "provider"}], "accommodations": [], "decisions": [], "nextSteps": [{"what","who","due"}], "nextMeeting": "YYYY-MM-DD" or ""}`
    : "";
  return `${base}${sections}${iep}}`;
}

/** The summary of a whole transcript in one go. */
export function summaryPrompt(template: NotesTemplateId, meetingDay: string): string {
  const t = templateOf(template);
  return [
    "You are Arise Notes, a careful note taker for teachers, families and students.",
    `This recording is: ${t.focus}`,
    `It was recorded on ${meetingDay}. Work out dates said like "next Tuesday" from that day.`,
    TRUTH, TIMES,
    "Lines that start with ★ are parts the person marked as important while recording: put them first, in \"highlights\", and make sure they show in the summary.",
    t.id === "iep" ? "Fill the \"iep\" object as a DRAFT for the teacher to review: what was discussed about the student. Service minutes only as stated." : "",
    `${JSON_ONLY} Shape: ${summaryShape(t)}`,
  ].filter(Boolean).join("\n");
}

/** Long recordings: notes from one part, combined afterwards (reducePrompt). */
export function partPrompt(template: NotesTemplateId, meetingDay: string, part: number, parts: number): string {
  const t = templateOf(template);
  return [
    `You are taking notes on part ${part} of ${parts} of a long recording (${t.focus}). Recorded on ${meetingDay}.`,
    TRUTH, TIMES,
    "Lines that start with ★ were marked important: note each one with kind \"highlight\".",
    `${JSON_ONLY} Shape: {"notes": [{"kind": "point"|"decision"|"action"|"question"|"date"|"highlight"|"detail", "text", "who" (actions), "due" (YYYY-MM-DD or ""), "date" (for kind date, YYYY-MM-DD), "time" (HH:MM or ""), "t"}]}. Keep it to the 25 most useful notes.`,
    t.id === "iep" ? "Also note IEP details with kinds \"attendee\", \"strength\", \"concern\", \"goal\", \"service\" (say minutes and how often), \"accommodation\"." : "",
  ].filter(Boolean).join("\n");
}
export function reducePrompt(template: NotesTemplateId, meetingDay: string): string {
  const t = templateOf(template);
  return [
    `You are Arise Notes. Below are notes taken from each part of one long recording (${t.focus}), in order. Recorded on ${meetingDay}.`,
    "Combine them into one summary of the whole recording. Merge repeats. Keep the times (t) from the notes.",
    TRUTH,
    t.id === "iep" ? "Fill the \"iep\" object as a DRAFT for the teacher to review." : "",
    `${JSON_ONLY} Shape: ${summaryShape(t)}`,
  ].filter(Boolean).join("\n");
}

export function parentPrompt(language: string): string {
  return [
    "You write a friendly email from a teacher to a parent or guardian about a meeting, from the meeting's notes.",
    "Write at about a 6th-grade reading level: short sentences, everyday words, no school jargon or acronyms (say \"the plan for your child's learning\", not \"IEP\" without explaining it).",
    "Start warmly. Say what went well, what we are working on, what was decided, and what happens next with dates. End by inviting questions.",
    TRUTH,
    `Write the email in ${language}. ${JSON_ONLY} Shape: {"subject", "body"} (body is plain text with blank lines between paragraphs, signed "[Your name]").`,
  ].join("\n");
}
export function translatePrompt(language: string): string {
  return `Translate every text value in this JSON into ${language}. Keep the same keys, numbers and dates, and the same shape. ${JSON_ONLY}`;
}
export function studyPrompt(): string {
  return [
    "You turn class notes into study tools for a student.",
    TRUTH,
    `${JSON_ONLY} Shape: {"flashcards": [{"front", "back"}] (8 to 15 cards: a term or question on the front, a short answer on the back), "quiz": [{"q", "choices": [4 answers], "answer": index 0-3 of the right one, "why": one sentence}] (5 to 10 questions, one clearly right answer each, wrong answers believable)}`,
  ].join("\n");
}
export function memoPrompt(today: string, weekday: string): string {
  return [
    `You turn a short voice memo into one thing for a planner. Today is ${weekday}, ${today}.`,
    "Decide what it is: \"task\" (something to do), \"event\" (something happening at a set day and time) or \"note\" (just something to remember).",
    `${JSON_ONLY} Shape: {"kind", "title" (short, starts with a verb for a task), "details" (anything else said), "date" ("YYYY-MM-DD" or ""), "time" ("HH:MM" 24-hour or "")}`,
  ].join("\n");
}
export function askPlanPrompt(today: string): string {
  return [
    `Someone is searching their own meeting notes. Today is ${today}.`,
    "List the words most likely to appear in what was said about their question: names, topics, and other ways of saying the same thing (mom, mother, parent; promised, will send, I'll).",
    "If the question names a time (\"last month\", \"in September\"), give the date range; otherwise leave from and to empty.",
    `${JSON_ONLY} Shape: {"keywords": [6 to 15 single words], "from": "YYYY-MM-DD" or "", "to": "YYYY-MM-DD" or ""}`,
  ].join("\n");
}
export function askAnswerPrompt(): string {
  return [
    "Answer the question using only the numbered passages from the person's own notes.",
    "Cite every fact with the passage number in square brackets, like [2]. If the passages don't answer it, say you couldn't find it in their notes.",
    "Speak to the person directly (\"you said…\"). Keep it short.",
    `${JSON_ONLY} Shape: {"answer": "…", "found": true or false}`,
  ].join("\n");
}

// ─── A note as text and HTML (copy, email, print, Word) ───────────────────────

export type NoteForExport = {
  title: string;
  createdAt: string;
  durationSecs: number;
  template: NotesTemplateId;
  summary: NoteSummary | null;
  segments: Segment[];
  speakers: Record<string, string>;
};
const at = (t: number | null) => (t === null ? "" : ` (${fmtClock(t)})`);
const dateLine = (n: NoteForExport) => {
  const d = new Date(n.createdAt);
  const when = Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return [when, n.durationSecs ? fmtClock(n.durationSecs) : "", templateOf(n.template).label].filter(Boolean).join(" · ");
};

/** Headed blocks of a note, shared by the text and HTML versions. */
export function noteBlocks(n: NoteForExport, withTranscript = true): { heading: string; lines: string[]; draft?: boolean }[] {
  const s = n.summary;
  const blocks: { heading: string; lines: string[]; draft?: boolean }[] = [];
  if (s) {
    if (s.summary) blocks.push({ heading: "Summary", lines: [s.summary] });
    if (s.highlights.length) blocks.push({ heading: "Highlights", lines: s.highlights.map((x) => `${x.text}${at(x.t)}`) });
    if (s.keyPoints.length) blocks.push({ heading: "Key points", lines: s.keyPoints.map((x) => `${x.text}${at(x.t)}`) });
    for (const sec of s.sections) blocks.push({ heading: sec.heading, lines: sec.items.map((x) => `${x.text}${at(x.t)}`) });
    if (s.decisions.length) blocks.push({ heading: "Decisions", lines: s.decisions.map((x) => `${x.text}${at(x.t)}`) });
    if (s.actions.length) blocks.push({ heading: "Action items", lines: s.actions.map((a) => `${a.what}${a.who ? ` — ${a.who}` : ""}${a.due ? ` (due ${a.due})` : ""}`) });
    if (s.questions.length) blocks.push({ heading: "Open questions", lines: s.questions.map((x) => `${x.text}${at(x.t)}`) });
    if (s.dates.length) blocks.push({ heading: "Dates", lines: s.dates.map((d) => `${d.title}: ${d.date}${d.time ? ` ${d.time}` : ""}`) });
    if (s.iep) {
      const i = s.iep;
      const lines = [
        i.student && `Student: ${i.student}`,
        i.attendees.length && `Attendees: ${i.attendees.join("; ")}`,
        ...i.strengths.map((x) => `Strength: ${x}`),
        ...i.concerns.map((x) => `Concern: ${x}`),
        ...i.goals.map((g) => `Goal${g.area ? ` (${g.area})` : ""}: ${g.text}`),
        ...i.services.map((v) => `Service: ${v.service}, ${v.minutes} minutes a ${v.per}${v.provider ? `, ${v.provider}` : ""}`),
        ...i.accommodations.map((x) => `Accommodation: ${x}`),
        ...i.decisions.map((x) => `Decision: ${x}`),
        ...i.nextSteps.map((a) => `Next step: ${a.what}${a.who ? ` — ${a.who}` : ""}${a.due ? ` (by ${a.due})` : ""}`),
        i.nextMeeting && `Next meeting: ${i.nextMeeting}`,
      ].filter(Boolean) as string[];
      if (lines.length) blocks.push({ heading: "IEP meeting draft (for review)", lines, draft: true });
    }
  }
  if (withTranscript && n.segments.length) {
    blocks.push({ heading: "Transcript", lines: n.segments.map((g) => { const who = speakerName(g.speaker, n.speakers); return `[${fmtClock(g.start)}] ${who ? `${who}: ` : ""}${g.text}`; }) });
  }
  return blocks;
}

export function noteText(n: NoteForExport, withTranscript = true): string {
  const out = [n.title || "Untitled note", dateLine(n), ""];
  for (const b of noteBlocks(n, withTranscript)) {
    out.push(b.heading.toUpperCase());
    const listy = b.heading !== "Summary" && b.heading !== "Transcript";
    for (const l of b.lines) out.push(listy ? `• ${l}` : l);
    out.push("");
  }
  out.push("Made with Arise Notes");
  return out.join("\n").trim() + "\n";
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function noteHtml(n: NoteForExport, withTranscript = true): string {
  const parts = [`<h1>${escapeHtml(n.title || "Untitled note")}</h1>`, `<p class="meta">${escapeHtml(dateLine(n))}</p>`];
  for (const b of noteBlocks(n, withTranscript)) {
    parts.push(`<h2>${escapeHtml(b.heading)}</h2>`);
    if (b.draft) parts.push(`<p class="draft">Draft for the teacher to review. Nothing was sent anywhere.</p>`);
    if (b.heading === "Summary") parts.push(`<p>${escapeHtml(b.lines[0])}</p>`);
    else if (b.heading === "Transcript") parts.push(b.lines.map((l) => `<p class="line">${escapeHtml(l)}</p>`).join(""));
    else parts.push(`<ul>${b.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`);
  }
  parts.push(`<p class="meta">Made with Arise Notes</p>`);
  return parts.join("\n");
}

/** A family invite code: 8 letters and numbers that can't be mixed up (no 0/O, 1/I/L). */
export function familyCode(random: () => number = Math.random): string {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += abc[Math.floor(random() * abc.length) % abc.length];
  return s;
}
export const cleanFamilyCode = (v: unknown) => (typeof v === "string" ? v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) : "");
