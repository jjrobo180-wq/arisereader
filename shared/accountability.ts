// Accountability (an Arise To Duo app, LifeHub section "accountability"): two or more people share a
// space and keep each other on track. One asks ("Teach Ava her ABCs, every weekday by 3pm"), the
// other gets nudged every so often until it's done, then checks it off with a photo or video, an
// AI worksheet they filled in, or a quiz the child took. The one who asked sees it, approves it or
// asks for a redo. Everything here is plain logic shared by the server (server/accountability.ts)
// and the app (client/src/components/family-hub/Accountability.tsx).

export const ACCT_NAME = "Accountability";

export type RepeatEvery = "once" | "daily" | "weekdays" | "weekly";
/** weekly: the days of the week (0 Sunday … 6 Saturday). once: the date. */
export type Repeat = { every: RepeatEvery; days: number[]; date: string };
export type ProofKind = "none" | "photo" | "video" | "either";
export type TaskKind = "task" | "worksheet" | "quiz";

export type WsKind = "short" | "choice" | "trace" | "draw";
export type WsItem = { id: string; kind: WsKind; prompt: string; choices: string[]; answer: string };
export type Worksheet = { title: string; instructions: string; items: WsItem[] };
export type QuizQ = { id: string; prompt: string; emoji: string; choices: string[]; answer: number };
export type Quiz = { title: string; questions: QuizQ[] };

export type AcctTask = {
  id: string; spaceId: string; title: string; notes: string; kind: TaskKind;
  assignee: number; createdBy: number; repeat: Repeat;
  /** Due by this time of day, "HH:MM" in the assignee's time zone. */
  due: string;
  /** Minutes between nudges until it's done (0: no nudges). */
  nag: number;
  proof: ProofKind;
  /** The one who asked approves it (or asks for a redo). */
  review: boolean;
  worksheet: Worksheet | null; quiz: Quiz | null;
  archived: boolean; createdAt: string;
};
export type Proof = { path: string; type: "photo" | "video" };
export type CheckStatus = "done" | "approved" | "redo";
export type Checkin = {
  id: string; taskId: string; spaceId: string; day: string; by: number; at: string; status: CheckStatus;
  note: string; proof: Proof[];
  /** Worksheet answers by item id, or the quiz picks by question id. */
  answers: Record<string, string>;
  score: { right: number; total: number } | null;
  feedback: string; reviewedBy: number | null; reviewedAt: string | null;
};
export type Member = { userId: number; name: string; role: "owner" | "member"; tz: string };
export type Space = { id: string; name: string; code: string; createdBy: number; members: Member[] };

export const LIMITS = { title: 120, notes: 1000, prompt: 300, choice: 120, items: 30, questions: 20, choices: 6, note: 1000, feedback: 500, spaceName: 60, name: 40, proofs: 6, spacesPerUser: 12, membersPerSpace: 8, tasksPerSpace: 300 };
export const NAG_CHOICES = [0, 30, 60, 120, 240] as const;
/** Nudges stay inside waking hours, and stop after this many in a day. */
export const QUIET = { from: 7 * 60, until: 21 * 60 + 30, maxPerDay: 10 };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "");
const id = (v: unknown) => { const s = str(v, 40); return /^[A-Za-z0-9_-]{1,40}$/.test(s) ? s : ""; };
export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---- cleaning what comes in (from the app, or from the AI) ----

export function cleanRepeat(v: any): Repeat {
  const every: RepeatEvery = ["once", "daily", "weekdays", "weekly"].includes(v?.every) ? v.every : "daily";
  const days = Array.isArray(v?.days) ? Array.from(new Set(v.days.map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6))).sort() as number[] : [];
  const date = typeof v?.date === "string" && DAY.test(v.date) ? v.date : "";
  return { every: every === "weekly" && !days.length ? "daily" : every === "once" && !date ? "daily" : every, days, date };
}

export function cleanWorksheet(v: any): Worksheet | null {
  if (!v || typeof v !== "object") return null;
  const items = (Array.isArray(v.items) ? v.items : []).slice(0, LIMITS.items).map((x: any): WsItem | null => {
    const kind: WsKind = ["short", "choice", "trace", "draw"].includes(x?.kind) ? x.kind : "short";
    const prompt = str(x?.prompt, LIMITS.prompt);
    if (!prompt) return null;
    const choices = kind === "choice" ? (Array.isArray(x?.choices) ? x.choices : []).map((c: unknown) => str(c, LIMITS.choice)).filter(Boolean).slice(0, LIMITS.choices) : [];
    return { id: id(x?.id) || newId(), kind: kind === "choice" && choices.length < 2 ? "short" : kind, prompt, choices: choices.length >= 2 ? choices : [], answer: str(x?.answer, LIMITS.choice) };
  }).filter(Boolean) as WsItem[];
  const title = str(v.title, LIMITS.title);
  if (!items.length) return null;
  return { title: title || "Worksheet", instructions: str(v.instructions, LIMITS.prompt), items };
}

export function cleanQuiz(v: any): Quiz | null {
  if (!v || typeof v !== "object") return null;
  const questions = (Array.isArray(v.questions) ? v.questions : []).slice(0, LIMITS.questions).map((q: any): QuizQ | null => {
    const prompt = str(q?.prompt, LIMITS.prompt);
    const choices = (Array.isArray(q?.choices) ? q.choices : []).map((c: unknown) => str(c, LIMITS.choice)).filter(Boolean).slice(0, 4);
    const answer = Number(q?.answer);
    if (!prompt || choices.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= choices.length) return null;
    return { id: id(q?.id) || newId(), prompt, emoji: str(q?.emoji, 8), choices, answer };
  }).filter(Boolean) as QuizQ[];
  if (!questions.length) return null;
  return { title: str(v.title, LIMITS.title) || "Quiz", questions };
}

/** A task as the app sent it, cleaned; null when it can't be used. `members`: who may be asked. */
export function cleanTask(v: any, members: number[]): Omit<AcctTask, "id" | "spaceId" | "createdBy" | "createdAt" | "archived"> | null {
  const title = str(v?.title, LIMITS.title);
  const assignee = Number(v?.assignee);
  if (!title || !members.includes(assignee)) return null;
  const kind: TaskKind = ["task", "worksheet", "quiz"].includes(v?.kind) ? v.kind : "task";
  const worksheet = kind === "worksheet" ? cleanWorksheet(v?.worksheet) : null;
  const quiz = kind === "quiz" ? cleanQuiz(v?.quiz) : null;
  if (kind === "worksheet" && !worksheet) return null;
  if (kind === "quiz" && !quiz) return null;
  const nag = NAG_CHOICES.includes(Number(v?.nag) as any) ? Number(v.nag) : 60;
  return {
    title, notes: str(v?.notes, LIMITS.notes), kind, assignee, repeat: cleanRepeat(v?.repeat),
    due: typeof v?.due === "string" && TIME.test(v.due) ? v.due : "17:00", nag,
    proof: ["none", "photo", "video", "either"].includes(v?.proof) ? v.proof : "none",
    review: v?.review !== false, worksheet, quiz,
  };
}

export function cleanAnswers(v: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, val] of Object.entries(v).slice(0, 60)) { const key = id(k); if (key) out[key] = str(val, 400); }
  return out;
}

// ---- days and times ----

/** The date and minutes past midnight in a time zone. */
export function localNow(nowMs: number, tz: string): { day: string; minutes: number; weekday: number } {
  let parts: Record<string, string> = {};
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(new Date(nowMs)).map((p) => [p.type, p.value]));
  } catch { return localNow(nowMs, "UTC"); }
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return { day, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday) };
}
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const minutesOf = (hhmm: string) => { const m = TIME.exec(hhmm); return m ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) : 17 * 60; };
export function timeWords(hhmm: string): string {
  const m = minutesOf(hhmm); const h = Math.floor(m / 60), mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function repeatWords(r: Repeat): string {
  if (r.every === "once") return `Once, ${new Date(`${r.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}`;
  if (r.every === "daily") return "Every day";
  if (r.every === "weekdays") return "Weekdays";
  return r.days.length === 7 ? "Every day" : r.days.map((d) => DAY_NAMES[d]).join(", ");
}

/** Is the task due on this day? (Nothing before the day it was made.) */
export function dueOn(t: Pick<AcctTask, "repeat" | "createdAt" | "archived">, day: string): boolean {
  if (t.archived) return false;
  const made = (t.createdAt || "").slice(0, 10);
  if (made && DAY.test(made) && day < made && t.repeat.every !== "once") return false;
  const w = weekdayOf(day);
  switch (t.repeat.every) {
    case "once": return t.repeat.date === day;
    case "daily": return true;
    case "weekdays": return w >= 1 && w <= 5;
    case "weekly": return t.repeat.days.includes(w);
  }
}

/** Counts as done for that day: checked off (and not sent back for a redo). */
export const isDone = (c: Checkin | undefined | null) => !!c && c.status !== "redo";
export const checkinFor = (checkins: Checkin[], taskId: string, day: string) =>
  checkins.filter((c) => c.taskId === taskId && c.day === day).sort((a, b) => b.at.localeCompare(a.at))[0];

/** Days in a row it was done, counting back from today (today still open doesn't break it). */
export function streak(t: AcctTask, checkins: Checkin[], today: string): number {
  let n = 0;
  for (let i = 0, day = today; i < 366; i++, day = addDays(day, -1)) {
    if (!dueOn(t, day)) { if (day < (t.createdAt || "").slice(0, 10)) break; continue; }
    if (isDone(checkinFor(checkins, t.id, day))) n++;
    else if (day !== today) break;
  }
  return n;
}

/** How a person is doing: what's due today and done, and the last 7 days' rate. */
export function personStats(userId: number, tasks: AcctTask[], checkins: Checkin[], today: string) {
  const mine = tasks.filter((t) => t.assignee === userId && !t.archived);
  const todayDue = mine.filter((t) => dueOn(t, today));
  const todayDone = todayDue.filter((t) => isDone(checkinFor(checkins, t.id, today)));
  let due = 0, done = 0;
  const week: { day: string; due: number; done: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    const d = mine.filter((t) => dueOn(t, day));
    const k = d.filter((t) => isDone(checkinFor(checkins, t.id, day))).length;
    week.push({ day, due: d.length, done: k });
    due += d.length; done += k;
  }
  return { todayDue: todayDue.length, todayDone: todayDone.length, rate: due ? Math.round((done / due) * 100) : 0, week, waiting: checkins.filter((c) => c.status === "done" && mine.some((t) => t.id === c.taskId && t.review)).length };
}

/** Should the assignee be nudged now? Due today, past its time, not done, inside waking hours, and
 *  long enough since the last nudge. */
export function nudgeNow(t: AcctTask, done: boolean, local: { day: string; minutes: number }, last: { at: number; n: number } | null, nowMs: number): boolean {
  if (!t.nag || t.archived || done || !dueOn(t, local.day)) return false;
  if (local.minutes < minutesOf(t.due) || local.minutes < QUIET.from || local.minutes > QUIET.until) return false;
  if (!last) return true;
  if (last.n >= QUIET.maxPerDay) return false;
  return nowMs - last.at >= t.nag * 60_000 - 30_000;
}

export function nudgeText(t: AcctTask, askerName: string, n: number): { title: string; body: string } {
  const who = askerName || "Your partner";
  const what = t.kind === "worksheet" ? "Worksheet" : t.kind === "quiz" ? "Quiz" : "To do";
  const proof = t.proof === "photo" ? " Add a photo when it's done." : t.proof === "video" ? " Add a video when it's done." : t.proof === "either" ? " Add a photo or video when it's done." : "";
  return n === 0
    ? { title: `${what}: ${t.title}`, body: `${who} is counting on you today.${proof}` }
    : { title: `Still to do: ${t.title}`, body: `Reminder ${n + 1} · ${who} asked for this by ${timeWords(t.due)}.${proof}` };
}

// ---- AI worksheets and quizzes ----

export const WORKSHEET_PROMPT = `You make short, friendly printable worksheets for parents teaching at home.
Answer with JSON only: {"title": string, "instructions": string, "items": [{"kind": "short"|"choice"|"trace"|"draw", "prompt": string, "choices": string[], "answer": string}]}.
Rules: match the child's age; 6-12 items unless asked otherwise; "trace" items give the letters, numbers or words to trace in "prompt" (for example "Trace: A a"); "choice" items have 2-4 choices and the correct one in "answer"; "short" items have the expected answer in "answer" when there is one; "draw" items ask the child to draw something. Keep wording simple and kind. No names of real people, no links.`;
export const QUIZ_PROMPT = `You make quick quizzes a child takes on a phone, one question at a time with big buttons.
Answer with JSON only: {"title": string, "questions": [{"prompt": string, "emoji": string, "choices": string[], "answer": number}]}.
Rules: match the child's age; 5-10 questions unless asked otherwise; 2-4 short choices each; "answer" is the index of the correct choice; one fitting emoji per question; simple, encouraging words. No names of real people, no links.`;

export type AiAsk = { topic: string; age: string; count: number; extra: string };
export function cleanAiAsk(v: any): AiAsk | null {
  const topic = str(v?.topic, 200);
  if (!topic) return null;
  const count = Math.min(20, Math.max(3, Math.round(Number(v?.count) || 8)));
  return { topic, age: str(v?.age, 40), count, extra: str(v?.extra, 400) };
}
export const aiUserMessage = (a: AiAsk) => `Topic: ${a.topic}\nChild's age or grade: ${a.age || "not given (assume 4-6 years old)"}\nHow many: ${a.count}${a.extra ? `\nAlso: ${a.extra}` : ""}`;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const WORDS: Record<string, [string, string]> = { A: ["Apple", "🍎"], B: ["Ball", "⚽"], C: ["Cat", "🐱"], D: ["Dog", "🐶"], E: ["Egg", "🥚"], F: ["Fish", "🐟"], G: ["Grapes", "🍇"], H: ["Hat", "🎩"], I: ["Ice cream", "🍦"], J: ["Juice", "🧃"], K: ["Kite", "🪁"], L: ["Lion", "🦁"], M: ["Moon", "🌙"], N: ["Nest", "🪺"], O: ["Orange", "🍊"], P: ["Pig", "🐷"], Q: ["Queen", "👑"], R: ["Rain", "🌧️"], S: ["Sun", "☀️"], T: ["Tree", "🌳"], U: ["Umbrella", "☂️"], V: ["Van", "🚐"], W: ["Whale", "🐳"], X: ["Fox", "🦊"], Y: ["Yo-yo", "🪀"], Z: ["Zebra", "🦓"] };
const pick = <T,>(list: readonly T[], n: number, seed: number) => { const out: T[] = []; let s = seed || 7; const pool = list.slice(); while (out.length < n && pool.length) { s = (s * 9301 + 49297) % 233280; out.push(pool.splice(Math.floor((s / 233280) * pool.length), 1)[0]); } return out; };
const seedOf = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100000, 17);
const shuffleIn = (right: string, wrong: string[], seed: number) => { const c = pick([right, ...wrong], wrong.length + 1, seed); return { choices: c, answer: c.indexOf(right) }; };

/** A worksheet without the AI (it isn't set up, is busy, or the account has no AI left). */
export function builtinWorksheet(a: AiAsk): Worksheet {
  const seed = seedOf(a.topic + a.age);
  const n = Math.min(a.count, 12);
  if (/abc|alphabet|letter|phonic/i.test(a.topic)) {
    const letters = pick(LETTERS.split(""), n, seed);
    return { title: "My ABCs", instructions: "Trace each letter, then say a word that starts with it.", items: letters.map((L, i): WsItem => i % 3 === 2 && L !== "X"
      ? { id: newId() + i, kind: "choice", prompt: `${WORDS[L][1]} ${WORDS[L][0]} starts with which letter?`, ...(() => { const s = shuffleIn(L, pick(LETTERS.split("").filter((x) => x !== L && x !== "X"), 2, seed + i), seed + i); return { choices: s.choices, answer: s.choices[s.answer] }; })() }
      : { id: newId() + i, kind: "trace", prompt: `Trace: ${L} ${L.toLowerCase()}`, choices: [], answer: "" }) };
  }
  if (/count|number|math|add|plus|subtract|minus/i.test(a.topic)) {
    const subtract = /subtract|minus|take away/i.test(a.topic);
    return { title: subtract ? "Take away" : "Counting & adding", instructions: "Count carefully. Use your fingers if it helps!", items: Array.from({ length: n }, (_, i): WsItem => {
      const x = 1 + ((seed + i * 7) % 6), y = 1 + ((seed + i * 3) % 4);
      if (i % 4 === 0) return { id: newId() + i, kind: "short", prompt: `How many? ${"⭐".repeat(x + y)}`, choices: [], answer: String(x + y) };
      return subtract ? { id: newId() + i, kind: "short", prompt: `${x + y} − ${y} = ___`, choices: [], answer: String(x) } : { id: newId() + i, kind: "short", prompt: `${x} + ${y} = ___`, choices: [], answer: String(x + y) };
    }) };
  }
  return { title: a.topic.slice(0, 60), instructions: "Do your best! Ask a grown-up if you get stuck.", items: [
    { id: newId() + "a", kind: "short", prompt: `What is one thing you know about ${a.topic}?`, choices: [], answer: "" },
    { id: newId() + "b", kind: "short", prompt: `What is one thing you want to learn about ${a.topic}?`, choices: [], answer: "" },
    { id: newId() + "c", kind: "draw", prompt: `Draw a picture of ${a.topic}.`, choices: [], answer: "" },
    { id: newId() + "d", kind: "short", prompt: "Tell a grown-up what you learned today. Write one word about it.", choices: [], answer: "" },
  ] };
}

/** A quiz without the AI. */
export function builtinQuiz(a: AiAsk): Quiz {
  const seed = seedOf(a.topic + a.age);
  const n = Math.min(a.count, 10);
  if (/count|number|math|add|plus/i.test(a.topic)) {
    return { title: "Number fun", questions: Array.from({ length: n }, (_, i): QuizQ => {
      const x = 1 + ((seed + i * 5) % 5), y = 1 + ((seed + i * 2) % 4), right = String(x + y);
      const s = shuffleIn(right, [String(x + y + 1), String(Math.max(0, x + y - 1))].filter((w) => w !== right), seed + i);
      return { id: newId() + i, prompt: i % 2 ? `${x} + ${y} = ?` : `How many apples? ${"🍎".repeat(x + y)}`, emoji: i % 2 ? "➕" : "🍎", ...s };
    }) };
  }
  if (/colou?r/i.test(a.topic)) {
    const COLORS: [string, string][] = [["Red", "🍓"], ["Yellow", "🍌"], ["Green", "🥦"], ["Orange", "🥕"], ["Purple", "🍇"], ["Blue", "🫐"], ["Brown", "🐻"], ["White", "☁️"]];
    return { title: "Colors", questions: pick(COLORS, n, seed).map(([c, e], i) => ({ id: newId() + i, prompt: `What color is this? ${e}`, emoji: e, ...shuffleIn(c, pick(COLORS.map((x) => x[0]).filter((x) => x !== c), 2, seed + i), seed + i) })) };
  }
  if (/shape/i.test(a.topic)) {
    const SHAPES: [string, string][] = [["Circle", "⚪"], ["Square", "🟥"], ["Triangle", "🔺"], ["Star", "⭐"], ["Heart", "❤️"], ["Diamond", "🔷"]];
    return { title: "Shapes", questions: pick(SHAPES, Math.min(n, SHAPES.length), seed).map(([c, e], i) => ({ id: newId() + i, prompt: `What shape is this? ${e}`, emoji: e, ...shuffleIn(c, pick(SHAPES.map((x) => x[0]).filter((x) => x !== c), 2, seed + i), seed + i) })) };
  }
  // Letters (the default for little ones).
  return { title: "Letter sounds", questions: pick(LETTERS.split("").filter((x) => x !== "X"), n, seed).map((L, i) => ({ id: newId() + i, prompt: `${WORDS[L][0]} starts with…`, emoji: WORDS[L][1], ...shuffleIn(L, pick(LETTERS.split("").filter((x) => x !== L), 2, seed + i), seed + i) })) };
}

export function scoreQuiz(q: Quiz, picks: Record<string, string>): { right: number; total: number } {
  return { right: q.questions.filter((x) => Number(picks[x.id]) === x.answer && picks[x.id] !== "" && picks[x.id] !== undefined).length, total: q.questions.length };
}

/** A friendly six-letter invite code (no look-alike letters). */
export function inviteCode(rand = Math.random): string {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => A[Math.floor(rand() * A.length)]).join("");
}
export const cleanCode = (v: unknown) => str(v, 20).toUpperCase().replace(/[^A-Z0-9]/g, "");
