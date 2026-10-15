// What the start screen's live tiles say. Each app tile can flip between a few short "faces" (a big
// number or word and a line under it), the way Windows Phone tiles did. This builds them from the
// family's own data; nothing here touches the screen, so it can be tested.
import { addDays, billDue, billState, choreDoneOn, choreDueOn, daysBetween, eventsOn, fromDay, isOn, type Family } from "./familyHub";

export type LiveFace = { /** The big part: a number, a time, a word. */ big?: string; /** The line under it. */ text: string };
export type LiveTask = { title: string; due: string; time: string; done: boolean };

const clock12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
};
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const trim = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const nowHm = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/** The next event from now: later today, else the first one in the coming week. */
export function nextEvent(family: Family, today: string, nowMs: number): { title: string; when: string } | null {
  for (let i = 0; i < 8; i++) {
    const day = addDays(today, i);
    const list = eventsOn(family, day, true).filter((e) => i > 0 || !e.time || e.time >= nowHm(nowMs));
    if (list.length) {
      const e = list[0];
      const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : fromDay(day).toLocaleDateString(undefined, { weekday: "long" });
      return { title: e.title || "Event", when: e.time ? `${label} · ${clock12(e.time)}` : label };
    }
  }
  return null;
}

/** Faces by section id ("tasks", "calendar", …). A section with nothing to say is left out, so its tile stays a plain icon. */
export function liveFaces(family: Family, tasks: LiveTask[], today: string, nowMs: number): Record<string, LiveFace[]> {
  const out: Record<string, LiveFace[]> = {};
  const on = (s: Parameters<typeof isOn>[0]) => isOn(s, family);

  const due = tasks.filter((t) => !t.done && t.due && t.due <= today).sort((a, b) => (a.due + a.time).localeCompare(b.due + b.time));
  out.tasks = due.length
    ? [{ big: String(due.length), text: `${plural(due.length, "task")} due` }, { text: trim(due[0].title), big: due[0].time ? clock12(due[0].time) : "Next" }]
    : [{ big: "✓", text: "Nothing due today" }];

  if (on("calendar")) {
    const n = nextEvent(family, today, nowMs);
    const todays = eventsOn(family, today, true).length;
    const faces: LiveFace[] = [];
    if (n) faces.push({ big: n.when.split(" · ")[1] ?? n.when, text: trim(n.title) + (n.when.includes(" · ") ? ` · ${n.when.split(" · ")[0]}` : "") });
    if (todays) faces.push({ big: String(todays), text: `${plural(todays, "event")} today` });
    out.calendar = faces.length ? faces : [{ big: "Free", text: "Nothing planned this week" }];
  }

  if (on("chores")) {
    const chores = family.chores.filter((c) => choreDueOn(c, today));
    const left = chores.filter((c) => !choreDoneOn(family, c.id, today));
    if (chores.length) out.chores = [left.length ? { big: String(left.length), text: `${plural(left.length, "chore")} left today` } : { big: "✓", text: "All chores done" }];
  }

  if (on("money")) {
    const month = today.slice(0, 7), next = addDays(`${month}-28`, 7).slice(0, 7);
    const bills = family.bills.flatMap((b) => [month, next].map((m) => ({ b, due: billDue(b, m), state: billState(b, m, today) })))
      .filter((x) => x.state !== "paid" && daysBetween(today, x.due) <= 7).sort((a, b) => a.due.localeCompare(b.due));
    if (bills.length) out.money = [{ big: String(bills.length), text: `${plural(bills.length, "bill")} due this week` }, { text: trim(bills[0].b.name), big: daysBetween(today, bills[0].due) <= 0 ? "Today" : `${daysBetween(today, bills[0].due)}d` }];
  }

  if (on("countdowns")) {
    const c = family.countdowns.filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (c) { const d = daysBetween(today, c.date); out.countdowns = [{ big: d === 0 ? "Today" : String(d), text: d === 0 ? trim(c.title) : `${plural(d, "day")} to ${trim(c.title, 24)}` }]; }
  }

  if (on("grocery")) {
    const left = family.groceries.filter((g) => !g.checked);
    if (left.length) out.grocery = [{ big: String(left.length), text: `${plural(left.length, "item")} to buy` }, { text: trim(left[0].name), big: "Next" }];
  }

  if (on("notes")) {
    const n = [...family.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt.localeCompare(a.updatedAt))[0];
    if (n) out.notes = [{ text: trim(n.title || n.body || "Note", 40), big: n.pinned ? "📌" : "Latest" }];
  }

  if (on("birthdays")) {
    const base = fromDay(today);
    const soon = family.birthdays.map((b) => {
      let d = new Date(base.getFullYear(), b.month - 1, b.day, 12);
      if (d < new Date(base.getFullYear(), base.getMonth(), base.getDate())) d = new Date(base.getFullYear() + 1, b.month - 1, b.day, 12);
      return { b, days: Math.round((d.getTime() - base.getTime()) / 86_400_000) };
    }).sort((a, b) => a.days - b.days)[0];
    if (soon) out.birthdays = [{ big: soon.days === 0 ? "Today" : String(soon.days), text: soon.days === 0 ? `${trim(soon.b.name, 24)} 🎉` : `${plural(soon.days, "day")} · ${trim(soon.b.name, 22)}` }];
  }
  return out;
}

/** The start screen's size slots (see START_RHYTHM): tiles that have something to say go in the bigger ones. */
export function arrangeLive<T extends { live?: boolean }>(tiles: readonly T[], sizeAt: (i: number) => "small" | "medium" | "large"): T[] {
  const live = tiles.filter((t) => t.live), rest = tiles.filter((t) => !t.live);
  const out: T[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const wantsBig = sizeAt(i) !== "small";
    const pick = wantsBig ? live.shift() ?? rest.shift() : rest.shift() ?? live.shift();
    if (pick) out.push(pick);
  }
  return out;
}
