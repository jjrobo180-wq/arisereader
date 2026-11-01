// Pod+ "Podcast of the day": what today is (a holiday, an observance or a date in history) and what
// to search for so the featured episodes are about it. US holidays with moving dates (daylight saving
// time, Thanksgiving, Easter, Election Day…) are worked out for any year. "On this day" events come
// from Wikipedia's feed in the app.

export type DayTheme = { id: string; title: string; blurb: string; query: string; kind: "holiday" | "observance" | "history" };

const key = (m: number, d: number) => `${m}-${d}`;
/** The nth weekday (0 = Sunday) of a month; n = -1 for the last one. */
export function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  if (n > 0) { const first = new Date(year, month - 1, 1).getDay(); return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7; }
  const last = new Date(year, month, 0); return last.getDate() - ((last.getDay() - weekday + 7) % 7);
}
/** Easter Sunday (Anonymous Gregorian algorithm). */
export function easter(year: number): { month: number; day: number } {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const FIXED: Record<string, Omit<DayTheme, "id">> = {
  [key(1, 1)]: { title: "New Year's Day", blurb: "Why the year starts on January 1, and the history of resolutions.", query: "history of New Year's Day", kind: "holiday" },
  [key(2, 2)]: { title: "Groundhog Day", blurb: "Punxsutawney Phil and the old weather lore behind him.", query: "Groundhog Day history", kind: "observance" },
  [key(2, 14)]: { title: "Valentine's Day", blurb: "From a Roman martyr to cards and chocolate.", query: "history of Valentine's Day", kind: "observance" },
  [key(3, 17)]: { title: "St. Patrick's Day", blurb: "The real Patrick, and how America made the holiday.", query: "St Patrick's Day history", kind: "observance" },
  [key(4, 1)]: { title: "April Fools' Day", blurb: "The greatest hoaxes in history.", query: "April Fools Day history hoaxes", kind: "observance" },
  [key(4, 22)]: { title: "Earth Day", blurb: "How 20 million Americans started a movement in 1970.", query: "history of Earth Day", kind: "observance" },
  [key(5, 5)]: { title: "Cinco de Mayo", blurb: "The Battle of Puebla, and why it's bigger in the US.", query: "Cinco de Mayo history Battle of Puebla", kind: "observance" },
  [key(6, 6)]: { title: "D-Day", blurb: "June 6, 1944: the Normandy landings.", query: "D-Day Normandy invasion", kind: "history" },
  [key(6, 14)]: { title: "Flag Day", blurb: "The story of the Stars and Stripes.", query: "history of the American flag", kind: "observance" },
  [key(6, 19)]: { title: "Juneteenth", blurb: "June 19, 1865: freedom reaches Galveston, Texas.", query: "Juneteenth history", kind: "holiday" },
  [key(7, 4)]: { title: "Independence Day", blurb: "The Declaration of Independence and the summer of 1776.", query: "Declaration of Independence 1776", kind: "holiday" },
  [key(7, 20)]: { title: "Moon Landing Day", blurb: "July 20, 1969: Apollo 11 lands on the Moon.", query: "Apollo 11 moon landing", kind: "history" },
  [key(9, 11)]: { title: "September 11", blurb: "Remembering the attacks of 2001.", query: "September 11 2001 attacks", kind: "history" },
  [key(10, 31)]: { title: "Halloween", blurb: "From Samhain to trick-or-treat, plus true scary stories.", query: "history of Halloween", kind: "holiday" },
  [key(11, 11)]: { title: "Veterans Day", blurb: "The armistice of 1918 and the people who served.", query: "Veterans Day history armistice", kind: "holiday" },
  [key(12, 7)]: { title: "Pearl Harbor Remembrance Day", blurb: "December 7, 1941: the attack that brought the US into WWII.", query: "Pearl Harbor attack 1941", kind: "history" },
  [key(12, 24)]: { title: "Christmas Eve", blurb: "The 1914 Christmas truce, and other Christmas Eve stories.", query: "Christmas truce 1914", kind: "observance" },
  [key(12, 25)]: { title: "Christmas", blurb: "How Christmas became the holiday we know.", query: "history of Christmas", kind: "holiday" },
  [key(12, 31)]: { title: "New Year's Eve", blurb: "The Times Square ball drop and New Year's traditions.", query: "New Year's Eve traditions history", kind: "observance" },
};

/** Holidays whose date moves, for a given year. */
export function movingHolidays(year: number): Record<string, Omit<DayTheme, "id">> {
  const e = easter(year);
  const electionDay = nthWeekday(year, 11, 1, 1) + 1; // the Tuesday after the first Monday
  const out: Record<string, Omit<DayTheme, "id">> = {
    [key(1, nthWeekday(year, 1, 1, 3))]: { title: "Martin Luther King Jr. Day", blurb: "Dr. King's life, the march on Washington and the dream.", query: "Martin Luther King Jr history", kind: "holiday" },
    [key(2, nthWeekday(year, 2, 1, 3))]: { title: "Presidents' Day", blurb: "Washington, Lincoln and the strangest stories from the presidency.", query: "presidents history Washington Lincoln", kind: "holiday" },
    [key(3, nthWeekday(year, 3, 0, 2))]: { title: "Daylight saving time starts", blurb: "Clocks spring forward tonight. Who invented daylight saving time, and why do we still do it?", query: "daylight saving time history", kind: "observance" },
    [key(e.month, e.day)]: { title: "Easter", blurb: "The history of Easter and its traditions.", query: "history of Easter", kind: "holiday" },
    [key(5, nthWeekday(year, 5, 0, 2))]: { title: "Mother's Day", blurb: "Anna Jarvis started it, then spent her life fighting what it became.", query: "history of Mother's Day Anna Jarvis", kind: "observance" },
    [key(5, nthWeekday(year, 5, 1, -1))]: { title: "Memorial Day", blurb: "Honoring those who died serving, and how the day began after the Civil War.", query: "Memorial Day history", kind: "holiday" },
    [key(6, nthWeekday(year, 6, 0, 3))]: { title: "Father's Day", blurb: "How Father's Day finally became official.", query: "history of Father's Day", kind: "observance" },
    [key(9, nthWeekday(year, 9, 1, 1))]: { title: "Labor Day", blurb: "The labor movement and the fight for the weekend.", query: "Labor Day history labor movement", kind: "holiday" },
    [key(10, nthWeekday(year, 10, 1, 2))]: { title: "Columbus Day / Indigenous Peoples' Day", blurb: "1492 and the debate over how to remember it.", query: "Columbus 1492 history", kind: "holiday" },
    [key(11, nthWeekday(year, 11, 0, 1))]: { title: "Daylight saving time ends", blurb: "Clocks fall back an hour today. Who invented daylight saving time, and why do we still do it?", query: "daylight saving time history", kind: "observance" },
    [key(11, nthWeekday(year, 11, 4, 4))]: { title: "Thanksgiving", blurb: "The real first Thanksgiving, and how Lincoln made it national.", query: "history of Thanksgiving", kind: "holiday" },
  };
  if (year % 2 === 0) out[key(11, electionDay)] = { title: "Election Day", blurb: "How American elections work, and the closest races in history.", query: "history of American elections", kind: "observance" };
  return out;
}

/** Today's themes, most notable first (a moving holiday beats a fixed one on the same day). */
export function todayThemes(d = new Date()): DayTheme[] {
  const k = key(d.getMonth() + 1, d.getDate());
  const out: DayTheme[] = [];
  const mv = movingHolidays(d.getFullYear())[k]; if (mv) out.push({ id: `m${k}`, ...mv });
  const fx = FIXED[k]; if (fx) out.push({ id: `f${k}`, ...fx });
  return out;
}

/** Wikipedia's "on this day" feed address for a date. */
export const onThisDayUrl = (d = new Date()) => `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;

export type DayEvent = { year: number; text: string; topic: string };
/** The feed's events → short items with a search topic (the main linked article's title). */
export function parseOnThisDay(json: any, max = 6): DayEvent[] {
  const list = Array.isArray(json?.selected) ? json.selected : Array.isArray(json?.events) ? json.events : [];
  return list.filter((e: any) => e?.text && Number.isFinite(Number(e?.year)))
    .map((e: any) => ({ year: Number(e.year), text: String(e.text).trim(), topic: String(e.pages?.[0]?.normalizedtitle || e.pages?.[0]?.titles?.normalized || e.pages?.[0]?.title || e.text).replace(/_/g, " ").slice(0, 80) }))
    .sort((a: DayEvent, b: DayEvent) => a.year - b.year)
    .slice(-max).reverse();
}

/** When nothing special is on: a theme from this day's history (the most recent major event). */
export function historyTheme(events: DayEvent[], d = new Date()): DayTheme | null {
  const e = events[0]; if (!e) return null;
  return { id: `h${d.getMonth() + 1}-${d.getDate()}-${e.year}`, title: `On this day in ${e.year}`, blurb: e.text, query: e.topic, kind: "history" };
}
