// Smart dates in a task's name, for both hubs: "dentist tomorrow 3pm", "pay rent on the 1st",
// "call mom friday at noon", "report due 11/5 9:30am", "gym in 2 days", "standup every"… The date
// and time are picked out, the words that said them are taken off the title, and the rest is the
// task. Nothing is guessed from a bare number ("buy 3 apples" stays as it is).
export type SmartDate = {
  /** The task's name without the words that gave the date and time. */
  title: string;
  /** YYYY-MM-DD, or "" when no day was said (a time alone means today, or tomorrow once it's past). */
  date: string;
  /** HH:MM (24-hour), or "". */
  time: string;
  /** The words that were read as the date and time, as typed. */
  matched: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_RE = "(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday|rsday)?";
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const dayIndex = (w: string) => DAYS.findIndex((d) => d.startsWith(w.slice(0, 3).toLowerCase()));
const real = (y: number, m: number, d: number) => { const t = new Date(y, m, d); return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d ? t : null; };
/** The next time that month/day comes round (this year, or next if it's already gone). */
function upcoming(now: Date, m: number, d: number, y?: number): Date | null {
  if (y !== undefined) return real(y < 100 ? 2000 + y : y, m, d);
  const t = real(now.getFullYear(), m, d);
  if (!t) return null;
  return t < addDays(now, 0) ? real(now.getFullYear() + 1, m, d) : t;
}

type Hit = { start: number; end: number; date?: Date; time?: string };

function findDate(s: string, now: Date): Hit | null {
  const tries: [RegExp, (m: RegExpExecArray) => Date | null][] = [
    [/\b(?:on |by |due )?(?:the )?day after tomorrow\b/i, () => addDays(now, 2)],
    [/\b(?:on |by |due )?(?:today|tonight|this (?:morning|afternoon|evening))\b/i, () => addDays(now, 0)],
    [/\b(?:on |by |due )?(?:tomorrow|tmrw?|tmw)\b/i, () => addDays(now, 1)],
    [/\bin (\d{1,3}) (day|days|week|weeks)\b/i, (m) => addDays(now, Number(m[1]) * (m[2].startsWith("week") ? 7 : 1))],
    [/\bnext week\b/i, () => addDays(now, 7)],
    // "friday" is the coming Friday (a week from today when today is Friday, unless "this friday");
    // "next friday" is the Friday in next week (weeks start on Monday).
    [new RegExp(`\\b(?:on |by |due )?(next |this )?${DAY_RE}\\b`, "i"), (m) => {
      const want = dayIndex(m[2]);
      if (want < 0) return null;
      const which = (m[1] || "").trim().toLowerCase();
      let ahead = (want - now.getDay() + 7) % 7;
      if (ahead === 0 && which !== "this") ahead = 7;
      if (which === "next") {
        const mon = (d: number) => (d + 6) % 7; // Monday = 0
        const target = addDays(now, ahead);
        const sameWeek = Math.round((addDays(target, -mon(target.getDay())).getTime() - addDays(now, -mon(now.getDay())).getTime()) / 864e5) === 0;
        if (sameWeek) ahead += 7;
      }
      return addDays(now, ahead);
    }],
    // 11/5, 11/5/26, 11-5-2026
    [/\b(?:on |by |due )?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/, (m) => upcoming(now, Number(m[1]) - 1, Number(m[2]), m[3] ? Number(m[3]) : undefined)],
    // Nov 5, November 5th, Nov 5 2026
    [new RegExp(`\\b(?:on |by |due )?${MONTH_RE} (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?\\b`, "i"), (m) => upcoming(now, MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), Number(m[2]), m[3] ? Number(m[3]) : undefined)],
    // 5 Nov, 5th of November
    [new RegExp(`\\b(?:on |by |due )?(\\d{1,2})(?:st|nd|rd|th)? (?:of )?${MONTH_RE}(?: (\\d{4}))?\\b`, "i"), (m) => upcoming(now, MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), Number(m[1]), m[3] ? Number(m[3]) : undefined)],
    // on the 1st (this month, or next if it's gone)
    [/\b(?:on|by|due) the (\d{1,2})(?:st|nd|rd|th)\b/i, (m) => {
      const d = Number(m[1]);
      const t = real(now.getFullYear(), now.getMonth(), d);
      return t && t >= addDays(now, 0) ? t : real(now.getFullYear() + (now.getMonth() === 11 ? 1 : 0), (now.getMonth() + 1) % 12, d);
    }],
  ];
  for (const [re, make] of tries) {
    const m = re.exec(s);
    if (!m) continue;
    const date = make(m);
    if (date) return { start: m.index, end: m.index + m[0].length, date };
  }
  return null;
}

function findTime(s: string): Hit | null {
  const tries: [RegExp, (m: RegExpExecArray) => string | null][] = [
    // 3pm, 3:30 pm, at 9 am, 12:15a.m.
    [/\b(?:at |@ ?)?(\d{1,2})(?::(\d{2}))? ?(a\.?m\.?|p\.?m\.?)(?=\s|$|[,.!?])/i, (m) => {
      let h = Number(m[1]); const min = Number(m[2] || 0);
      if (h < 1 || h > 12 || min > 59) return null;
      const pm = /p/i.test(m[3]);
      if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12;
      return `${pad(h)}:${pad(min)}`;
    }],
    // at 15:00, 9:30 (a clock with minutes)
    [/\b(?:at |@ ?)?([01]?\d|2[0-3]):([0-5]\d)\b/, (m) => `${pad(Number(m[1]))}:${m[2]}`],
    // at 3 (a bare hour needs "at"; 1–7 is read as the afternoon, 8–11 the morning)
    [/\b(?:at|@) ?(\d{1,2})\b(?![:/\d])/i, (m) => { const h = Number(m[1]); if (h < 1 || h > 12) return null; return `${pad(h <= 7 ? h + 12 : h === 12 ? 12 : h)}:00`; }],
    [/\b(?:at )?noon\b/i, () => "12:00"],
    [/\b(?:at )?midnight\b/i, () => "00:00"],
    [/\btonight\b/i, () => "20:00"],
    [/\bthis morning\b|\b(?:in the )?morning\b/i, () => "09:00"],
    [/\bthis afternoon\b|\b(?:in the )?afternoon\b/i, () => "14:00"],
    [/\bthis evening\b|\b(?:in the )?evening\b/i, () => "18:00"],
  ];
  for (const [re, make] of tries) {
    const m = re.exec(s);
    if (!m) continue;
    const time = make(m);
    if (time) return { start: m.index, end: m.index + m[0].length, time };
  }
  return null;
}

/** Reads a date and time out of a task's name. Returns null when there's none. */
export function smartDate(text: string, now: Date = new Date()): SmartDate | null {
  const s = String(text || "");
  if (!s.trim()) return null;
  const date = findDate(s, now);
  // The time is looked for in what's left once the date's words are taken out ("tonight" counts once).
  const rest = date ? s.slice(0, date.start) + " ".repeat(date.end - date.start) + s.slice(date.end) : s;
  const time = findTime(rest) || (date && /\btonight\b/i.test(s.slice(date.start, date.end)) ? { start: -1, end: -1, time: "20:00" } : null);
  if (!date && !time) return null;
  const cuts = [date, time].filter((h): h is Hit => !!h && h.start >= 0).sort((a, b) => b.start - a.start);
  let title = s;
  for (const c of cuts) title = title.slice(0, c.start) + " " + title.slice(c.end);
  title = title.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").replace(/(^[\s,–-]+|[\s,–-]+$)/g, "").trim();
  // A time with no day: today, unless that time has already passed (then tomorrow).
  let day = date?.date;
  if (!day && time?.time) {
    const [h, m] = time.time.split(":").map(Number);
    day = h * 60 + m > now.getHours() * 60 + now.getMinutes() ? addDays(now, 0) : addDays(now, 1);
  }
  const matched = cuts.sort((a, b) => a.start - b.start).map((c) => s.slice(c.start, c.end).trim()).join(" ");
  return { title: title || s.trim(), date: day ? iso(day) : "", time: time?.time || "", matched: matched || "tonight" };
}

/** "Tue, Nov 3 at 3:00 PM": how a found date reads under the task's name. */
export function smartLabel(r: SmartDate, now: Date = new Date()): string {
  const [y, mo, d] = r.date.split("-").map(Number);
  const day = new Date(y, mo - 1, d);
  const today = iso(now), tomorrow = iso(addDays(now, 1));
  const dayText = r.date === today ? "Today" : r.date === tomorrow ? "Tomorrow" : day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (!r.time) return dayText;
  const [h, m] = r.time.split(":").map(Number);
  return `${dayText} at ${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}
