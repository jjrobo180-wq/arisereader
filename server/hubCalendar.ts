// Reads calendars into Teacher Hub: a calendar file (.ics) or a calendar's link
// from Google, Outlook, Apple or anywhere else that publishes one. Every calendar
// app can hand out its events in this one format, so the Hub can show them
// without the teacher signing the Hub in to their mail account.
import { lookup as dnsLookup } from "node:dns";
import { request } from "node:https";
import { isIP } from "node:net";
import type { HubEvent } from "../shared/teacherHub";

export class HubCalendarError extends Error {}

export type CalendarEvent = Omit<HubEvent, "id" | "calendarId">;
export type CalendarRead = { name: string; events: CalendarEvent[] };

// ─── Times ──────────────────────────────────────────────────────────────────

/** A day and time as a calendar wrote it. `zone` is "utc", "float" (no zone given) or a zone name such as "America/Denver". */
type Stamp = { y: number; mo: number; d: number; h: number; mi: number; allDay: boolean; zone: string };

/** Outlook names time zones its own way. These are the ones schools are likely to be in. */
const WINDOWS_ZONES: Record<string, string> = {
  "eastern standard time": "America/New_York", "us eastern standard time": "America/Indiana/Indianapolis", "central standard time": "America/Chicago",
  "mountain standard time": "America/Denver", "us mountain standard time": "America/Phoenix", "pacific standard time": "America/Los_Angeles",
  "alaskan standard time": "America/Anchorage", "hawaiian standard time": "Pacific/Honolulu", "atlantic standard time": "America/Halifax",
  "newfoundland standard time": "America/St_Johns", "canada central standard time": "America/Regina", "central america standard time": "America/Guatemala",
  "central standard time (mexico)": "America/Mexico_City", "mountain standard time (mexico)": "America/Mazatlan", "pacific standard time (mexico)": "America/Tijuana",
  "sa pacific standard time": "America/Bogota", "e. south america standard time": "America/Sao_Paulo", "argentina standard time": "America/Argentina/Buenos_Aires",
  "utc": "UTC", "gmt standard time": "Europe/London", "greenwich standard time": "Atlantic/Reykjavik", "w. europe standard time": "Europe/Berlin",
  "central europe standard time": "Europe/Budapest", "central european standard time": "Europe/Warsaw", "romance standard time": "Europe/Paris",
  "e. europe standard time": "Europe/Chisinau", "fle standard time": "Europe/Kiev", "gtb standard time": "Europe/Bucharest", "turkey standard time": "Europe/Istanbul",
  "russian standard time": "Europe/Moscow", "israel standard time": "Asia/Jerusalem", "south africa standard time": "Africa/Johannesburg",
  "arab standard time": "Asia/Riyadh", "arabian standard time": "Asia/Dubai", "india standard time": "Asia/Kolkata", "china standard time": "Asia/Shanghai",
  "singapore standard time": "Asia/Singapore", "tokyo standard time": "Asia/Tokyo", "korea standard time": "Asia/Seoul",
  "aus eastern standard time": "Australia/Sydney", "e. australia standard time": "Australia/Brisbane", "w. australia standard time": "Australia/Perth",
  "new zealand standard time": "Pacific/Auckland",
};

const formatters = new Map<string, Intl.DateTimeFormat | null>();
function formatterFor(zone: string): Intl.DateTimeFormat | null {
  if (!formatters.has(zone)) {
    try {
      formatters.set(zone, new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }));
    } catch {
      formatters.set(zone, null);
    }
  }
  return formatters.get(zone)!;
}

/** A zone name this server knows, or "float" when it does not. */
export function knownZone(name: string): string {
  const tidy = name.trim().replace(/^"|"$/g, "");
  if (!tidy) return "float";
  const windows = WINDOWS_ZONES[tidy.toLowerCase()];
  if (windows) return windows;
  // Some calendars write "/freeassociation.sourceforge.net/America/Denver": the zone is the last two or three parts.
  const parts = tidy.split("/");
  for (const candidate of [tidy, parts.slice(-3).join("/"), parts.slice(-2).join("/")]) {
    if (/^[A-Za-z_+-]+(\/[A-Za-z0-9_+-]+){1,2}$|^UTC$/.test(candidate) && formatterFor(candidate)) return candidate;
  }
  return "float";
}

/** The clock on the wall in a zone at a moment. */
function wallIn(ms: number, zone: string): { y: number; mo: number; d: number; h: number; mi: number } {
  const parts = Object.fromEntries(formatterFor(zone)!.formatToParts(new Date(ms)).map((p) => [p.type, Number(p.value)]));
  return { y: parts.year, mo: parts.month, d: parts.day, h: parts.hour % 24, mi: parts.minute };
}

const asUtc = (w: { y: number; mo: number; d: number; h: number; mi: number }) => Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi);

/** The moment a stamp means. A time with no zone is read as the teacher's own zone. */
function instant(stamp: Stamp, teacherZone: string): number {
  const guess = asUtc(stamp);
  if (stamp.zone === "utc") return guess;
  const zone = stamp.zone === "float" ? teacherZone : stamp.zone;
  let at = guess - (asUtc(wallIn(guess, zone)) - guess);
  const again = asUtc(wallIn(at, zone)) - at;
  if (at + again !== guess) at = guess - again; // the first try landed on the other side of a clock change
  return at;
}

function parseStamp(value: string, params: Record<string, string>): Stamp | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const allDay = m[4] === undefined;
  const stamp: Stamp = { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]), h: Number(m[4] || 0), mi: Number(m[5] || 0), allDay, zone: m[7] ? "utc" : params.TZID ? knownZone(params.TZID) : "float" };
  if (stamp.mo < 1 || stamp.mo > 12 || stamp.d < 1 || stamp.d > 31 || stamp.h > 23 || stamp.mi > 59) return null;
  return stamp;
}

const two = (n: number) => String(n).padStart(2, "0");
const dayKey = (y: number, mo: number, d: number) => `${y}-${two(mo)}-${two(d)}`;
const DAY_MS = 86_400_000;

// ─── The file ───────────────────────────────────────────────────────────────

type Property = { name: string; params: Record<string, string>; value: string };

function parseLine(line: string): Property | null {
  // NAME;PARAM=value;PARAM="quoted:value":the value
  let colon = -1, quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) { colon = i; break; }
  }
  if (colon < 1) return null;
  const [name, ...rest] = line.slice(0, colon).split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  const params: Record<string, string> = {};
  for (const part of rest) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

const unescapeText = (value: string) => value.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
const plain = (value: string, max: number) => unescapeText(value).replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim().slice(0, max);

/** "PT1H30M" or "P1D" in minutes. */
function durationMinutes(value: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m || m[1] === "-") return null;
  return Number(m[2] || 0) * 10_080 + Number(m[3] || 0) * 1440 + Number(m[4] || 0) * 60 + Number(m[5] || 0);
}

type Rule = { freq: string; interval: number; count: number | null; until: Stamp | null; byDay: { ordinal: number; day: number }[]; byMonthDay: number[]; setPos: number | null };
const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function parseRule(value: string): Rule | null {
  const parts = Object.fromEntries(value.split(";").map((p) => p.split("=")).filter((p) => p.length === 2).map(([k, v]) => [k.toUpperCase(), v]));
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(parts.FREQ)) return null;
  const byDay = (parts.BYDAY || "").split(",").map((token: string) => /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(token.trim())).filter(Boolean)
    .map((m: RegExpExecArray | null) => ({ ordinal: Number(m![1] || 0), day: WEEKDAYS.indexOf(m![2].toUpperCase()) }));
  return {
    freq: parts.FREQ,
    interval: Math.max(1, Math.min(1000, Number(parts.INTERVAL) || 1)),
    count: parts.COUNT ? Math.max(0, Number(parts.COUNT) || 0) : null,
    until: parts.UNTIL ? parseStamp(parts.UNTIL, {}) : null,
    byDay,
    byMonthDay: (parts.BYMONTHDAY || "").split(",").map(Number).filter((n: number) => Number.isInteger(n) && n !== 0 && Math.abs(n) <= 31),
    setPos: parts.BYSETPOS && /^[+-]?\d+$/.test(parts.BYSETPOS) ? Number(parts.BYSETPOS) : null,
  };
}

/** The date of, say, the second Tuesday (ordinal 2) or the last Friday (ordinal -1) of a month. null when there is none. */
function nthWeekday(year: number, month: number, day: number, ordinal: number): number | null {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const hits: number[] = [];
  for (let d = 1; d <= days; d++) if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === day) hits.push(d);
  return (ordinal > 0 ? hits[ordinal - 1] : hits[hits.length + ordinal]) ?? null;
}

/**
 * The days a repeating event falls on, as [year, month, day], oldest first. It stops at the rule's end,
 * at `lastDay`, or after `cap` days. `firstDay` lets a rule with no count skip the years before the window.
 */
function repeatDays(start: Stamp, rule: Rule, firstDay: number, lastDay: number, cap: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const base = Date.UTC(start.y, start.mo - 1, start.d);
  let made = 0;
  const push = (ms: number): boolean => {
    if (ms < base) return true;
    if (ms > lastDay) return false;
    if (rule.count !== null && made >= rule.count) return false;
    made++;
    const d = new Date(ms);
    if (ms >= firstDay) out.push([d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]);
    return out.length < cap;
  };
  const skipAhead = (periodDays: number) => (rule.count === null && firstDay > base ? Math.max(0, Math.floor((firstDay - base) / DAY_MS / periodDays) - 1) : 0);

  if (rule.freq === "DAILY") {
    for (let i = skipAhead(rule.interval), tries = 0; tries < 20_000; i++, tries++) if (!push(base + i * rule.interval * DAY_MS)) break;
  } else if (rule.freq === "WEEKLY") {
    const days = (rule.byDay.length ? rule.byDay.map((b) => b.day) : [new Date(base).getUTCDay()]).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    const monday = base - ((new Date(base).getUTCDay() + 6) % 7) * DAY_MS;
    outer: for (let w = skipAhead(rule.interval * 7), tries = 0; tries < 6_000; w++, tries++) {
      for (const day of days) if (!push(monday + w * rule.interval * 7 * DAY_MS + ((day + 6) % 7) * DAY_MS)) break outer;
    }
  } else if (rule.freq === "MONTHLY") {
    // "the second Tuesday" is written 2TU, or TU with BYSETPOS=2
    const nth = rule.byDay.length === 1 && (rule.byDay[0].ordinal || rule.setPos) ? { day: rule.byDay[0].day, ordinal: rule.byDay[0].ordinal || rule.setPos! } : null;
    outer: for (let i = 0; i < 2_400; i++) {
      const first = new Date(Date.UTC(start.y, start.mo - 1 + i * rule.interval, 1));
      const y = first.getUTCFullYear(), mo = first.getUTCMonth() + 1, length = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const dates = nth ? [nthWeekday(y, mo, nth.day, nth.ordinal)]
        : (rule.byMonthDay.length ? rule.byMonthDay : [start.d]).map((d) => (d > 0 ? d : length + 1 + d));
      for (const d of dates.filter((x): x is number => x !== null && x >= 1 && x <= length).sort((a, b) => a - b)) if (!push(Date.UTC(y, mo - 1, d))) break outer;
    }
  } else {
    for (let i = 0; i < 400; i++) {
      const y = start.y + i * rule.interval;
      if (new Date(Date.UTC(y, start.mo - 1, start.d)).getUTCMonth() !== start.mo - 1) continue; // Feb 29 in a short year
      if (!push(Date.UTC(y, start.mo - 1, start.d))) break;
    }
  }
  return out;
}

export type ReadOptions = {
  /** The teacher's time zone, such as "America/Denver". Times are shown in it. */
  timeZone: string;
  now: number;
  /** How far back and ahead to keep events. */
  pastDays?: number;
  aheadDays?: number;
  max?: number;
};

/** Turns a calendar file into the Hub's events: times in the teacher's zone, repeating events spread out over the window. */
export function readCalendar(ics: string, options: ReadOptions): CalendarRead {
  if (!/BEGIN:VCALENDAR/i.test(ics.slice(0, 4000))) throw new HubCalendarError("That is not a calendar file.");
  const zone = formatterFor(options.timeZone) ? options.timeZone : "America/Denver";
  const from = options.now - (options.pastDays ?? 14) * DAY_MS, to = options.now + (options.aheadDays ?? 180) * DAY_MS;
  const max = options.max ?? 500;
  const today = wallIn(options.now, zone);
  const firstDay = Date.UTC(today.y, today.mo - 1, today.d) - ((options.pastDays ?? 14) + 2) * DAY_MS;
  const lastDay = Date.UTC(today.y, today.mo - 1, today.d) + ((options.aheadDays ?? 180) + 2) * DAY_MS;

  type Raw = { uid: string; props: Property[] };
  const raws: Raw[] = [];
  let name = "", current: Raw | null = null, depth = 0;
  for (const line of ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/)) {
    const prop = parseLine(line);
    if (!prop) continue;
    if (prop.name === "BEGIN") {
      if (prop.value.toUpperCase() === "VEVENT" && !current) { current = { uid: "", props: [] }; depth = 0; } else if (current) depth++;
      continue;
    }
    if (prop.name === "END") {
      if (current && depth === 0 && prop.value.toUpperCase() === "VEVENT") { raws.push(current); current = null; } else if (current) depth--;
      continue;
    }
    if (current) { if (depth === 0) { current.props.push(prop); if (prop.name === "UID") current.uid = prop.value; } }
    else if (prop.name === "X-WR-CALNAME" && !name) name = plain(prop.value, 80);
  }

  const one = (raw: Raw, key: string) => raw.props.find((p) => p.name === key);
  // A changed or cancelled single day of a repeating event names the day it replaces.
  const replaced = new Map<string, Set<string>>();
  const stampKey = (s: Stamp) => (s.allDay ? dayKey(s.y, s.mo, s.d) : String(instant(s, zone)));
  for (const raw of raws) {
    const rid = one(raw, "RECURRENCE-ID");
    const stamp = rid && parseStamp(rid.value, rid.params);
    if (stamp && raw.uid) (replaced.get(raw.uid) ?? replaced.set(raw.uid, new Set()).get(raw.uid)!).add(stampKey(stamp));
  }

  const events: (CalendarEvent & { at: number })[] = [];
  for (const raw of raws) {
    if ((one(raw, "STATUS")?.value || "").toUpperCase() === "CANCELLED") continue;
    const startProp = one(raw, "DTSTART");
    const start = startProp && parseStamp(startProp.value, startProp.params);
    if (!start) continue;
    const endProp = one(raw, "DTEND");
    const end = endProp ? parseStamp(endProp.value, endProp.params) : null;
    const title = plain(one(raw, "SUMMARY")?.value || "", 200) || "(No title)";
    const location = plain(one(raw, "LOCATION")?.value || "", 120).replace(/\n/g, ", ");
    const notes = plain(one(raw, "DESCRIPTION")?.value || "", 160);
    const length = durationMinutes(one(raw, "DURATION")?.value || "");

    const isOverride = !!one(raw, "RECURRENCE-ID");
    const ruleProp = isOverride ? undefined : one(raw, "RRULE");
    const rule = ruleProp ? parseRule(ruleProp.value) : null;
    const skip = new Set<string>(isOverride ? [] : replaced.get(raw.uid) ?? []);
    for (const ex of raw.props.filter((p) => p.name === "EXDATE")) {
      for (const value of ex.value.split(",")) { const s = parseStamp(value, ex.params); if (s) skip.add(stampKey(s.allDay && !start.allDay ? { ...start, y: s.y, mo: s.mo, d: s.d } : s)); }
    }
    let untilMs = Infinity;
    // "Until" a day means through the end of that day where the teacher is.
    if (rule?.until) untilMs = rule.until.allDay ? instant({ ...rule.until, h: 23, mi: 59, allDay: false, zone: "float" }, zone) : instant(rule.until, zone);

    const days: [number, number, number][] = rule ? repeatDays(start, rule, firstDay - 40 * DAY_MS, lastDay, 800) : [[start.y, start.mo, start.d]];
    for (const [y, mo, d] of days) {
      const occurrence: Stamp = { ...start, y, mo, d };
      if (skip.has(stampKey(occurrence))) continue;
      if (start.allDay) {
        const first = Date.UTC(y, mo - 1, d);
        if (rule?.until && first > Date.UTC(rule.until.y, rule.until.mo - 1, rule.until.d)) break;
        // The end of an all-day event is the morning after its last day.
        const span = end?.allDay ? Math.round((Date.UTC(end.y, end.mo - 1, end.d) - Date.UTC(start.y, start.mo - 1, start.d)) / DAY_MS) : length ? Math.ceil(length / 1440) : 1;
        for (let i = 0; i < Math.max(1, Math.min(31, span)); i++) {
          const day = first + i * DAY_MS;
          if (day < firstDay + 2 * DAY_MS || day > lastDay - 2 * DAY_MS) continue;
          const date = new Date(day);
          events.push({ title, date: dayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()), start: "", end: "", location, notes, at: day });
        }
        continue;
      }
      const at = instant(occurrence, zone);
      if (at > untilMs) break;
      if (at < from || at > to) continue;
      const minutes = end ? Math.round((instant(end, zone) - instant(start, zone)) / 60_000) : length ?? 0;
      const begins = wallIn(at, zone), finishes = wallIn(at + Math.max(0, minutes) * 60_000, zone);
      events.push({ title, date: dayKey(begins.y, begins.mo, begins.d), start: `${two(begins.h)}:${two(begins.mi)}`, end: minutes > 0 ? `${two(finishes.h)}:${two(finishes.mi)}` : "", location, notes, at });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  return { name, events: events.slice(0, max).map(({ at: _at, ...event }) => event) };
}

// ─── The link ───────────────────────────────────────────────────────────────

/** True for an address on the open internet. Anything private, local or reserved is refused. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPublicAddress(mapped[1]);
    if (lower === "::" || lower === "::1" || lower.startsWith("::ffff:") || lower.startsWith("64:ff9b:")) return false;
    if (/^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith("ff")) return false;
    return true;
  }
  return false;
}

/** A calendar link made safe to open: https only, a real host name, the normal port, no password in it. */
export function calendarUrl(input: string): URL {
  const tidy = String(input || "").trim().replace(/^webcals?:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(tidy) ? tidy : `https://${tidy}`);
  } catch {
    throw new HubCalendarError("That does not look like a link. Copy the whole calendar link and paste it here.");
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new HubCalendarError("Use a calendar link that starts with https://");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) || !host.includes(".") || /\.(local|internal|localhost|lan|home|corp)$/i.test(host) || host.toLowerCase() === "localhost") {
    throw new HubCalendarError("That link can't be opened from here. Use the calendar link from Google, Outlook or Apple, or upload the calendar file instead.");
  }
  url.hash = "";
  return url;
}

/** Looks a host up, and refuses to connect if any address it has is not on the open internet. */
function guardedLookup(hostname: string, options: any, callback: (...args: any[]) => void) {
  dnsLookup(hostname, { ...(typeof options === "object" ? options : {}), all: true }, (error, found) => {
    if (error) return callback(error);
    const list = found as unknown as { address: string; family: number }[];
    if (!list.length || list.some((entry) => !isPublicAddress(entry.address))) return callback(new HubCalendarError("That link can't be opened from here."));
    if (typeof options === "object" && options?.all) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  });
}

const MAX_FEED_BYTES = 3_000_000;

/** Downloads a calendar from its link. Follows a few redirects, checking each one the same way. */
export async function fetchCalendar(link: string, hops = 0): Promise<string> {
  const url = calendarUrl(link);
  const response = await new Promise<{ status: number; location: string; body: string }>((resolve, reject) => {
    const req = request(url, { method: "GET", lookup: guardedLookup as any, timeout: 12_000, headers: { "User-Agent": "ARISEReader/1.0 (calendar import)", Accept: "text/calendar, text/plain;q=0.8, */*;q=0.5", "Accept-Encoding": "identity" } }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_FEED_BYTES) { req.destroy(new HubCalendarError("That calendar is too large to read here.")); return; }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ status: res.statusCode || 0, location: String(res.headers.location || ""), body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new HubCalendarError("That calendar took too long to answer. Try again in a moment.")));
    req.on("error", reject);
    req.end();
  }).catch((error: any) => {
    if (error instanceof HubCalendarError) throw error;
    throw new HubCalendarError("That calendar link could not be opened. Check that you copied the whole link.");
  });
  if (response.status >= 300 && response.status < 400 && response.location) {
    if (hops >= 3) throw new HubCalendarError("That calendar link could not be opened.");
    return fetchCalendar(new URL(response.location, url).toString(), hops + 1);
  }
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    throw new HubCalendarError("That calendar is not shared by this link. In your calendar's settings, copy its private or published calendar link (it ends in .ics).");
  }
  if (response.status !== 200) throw new HubCalendarError("That calendar link could not be opened. Try again in a moment.");
  if (!/BEGIN:VCALENDAR/i.test(response.body.slice(0, 4000))) {
    throw new HubCalendarError("That link opens a web page, not a calendar. In your calendar's settings, copy the link that ends in .ics (Google calls it \"Secret address in iCal format\").");
  }
  return response.body;
}
