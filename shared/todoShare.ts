// A.R.I.S.E. To-Do share links: a private link the owner copies and sends to family, so they can
// see one part of the Family Hub (or vote in a poll) without making an account.
// Only what the link was made for is ever sent: a bills link never carries tasks, a poll link
// never carries the rest of the hub. Everything here is read live from the owner's saved To-Do.
import {
  addDays, billDue, billState, choreDoneOn, choreDueOn, choreOwner, cleanFamily, eventsOn, fromDay, isDay, weekStart,
  type Family, type Member,
} from "./familyHub";
import { dayTotals, goalsFor, healthPeople } from "./familyHealth";

export type ShareTarget =
  | { kind: "poll"; id: string }
  | { kind: "tasks"; id: string }      // id "" = every list
  | { kind: "calendar" }
  | { kind: "bills" }
  | { kind: "trips"; id: string }      // id "" = every upcoming trip
  | { kind: "chores" }
  | { kind: "goals" }
  | { kind: "health"; id: string };    // one person's food & fitness

const ID = /^[\w.-]{1,100}$/;

/** Reads "poll:abc", "tasks", "tasks:list1", "calendar", "bills", "trips", "trip:abc", "chores", "goals", "health:member". */
export function parseTarget(value: unknown): ShareTarget | null {
  if (typeof value !== "string" || value.length > 120) return null;
  const [kind, id = "", extra] = value.split(":");
  if (extra !== undefined || (id && !ID.test(id))) return null;
  if (kind === "calendar" || kind === "bills" || kind === "chores" || kind === "goals") return id ? null : { kind };
  if (kind === "tasks") return { kind, id };
  if (kind === "trips") return id ? null : { kind: "trips", id: "" };
  if (kind === "trip") return id ? { kind: "trips", id } : null;
  if (kind === "poll" || kind === "health") return id ? { kind, id } : null;
  return null;
}
export function targetKey(t: ShareTarget): string {
  if (t.kind === "trips") return t.id ? `trip:${t.id}` : "trips";
  if (t.kind === "tasks") return t.id ? `tasks:${t.id}` : "tasks";
  return "id" in t ? `${t.kind}:${t.id}` : t.kind;
}

export type GuestVote = { voter: string; name: string; optionId: string };
type Person = { name: string; emoji: string; color: string };
export type SharedView =
  | { kind: "poll"; title: string; question: string; pollKind: string; open: boolean; closesOn: string; options: { id: string; label: string; votes: number }[]; total: number; guests: string[] }
  | { kind: "tasks"; title: string; lists: { name: string; color: string; tasks: { title: string; notes: string; due: string; time: string; assignee: string; priority: string; done: boolean }[] }[] }
  | { kind: "calendar"; title: string; days: { date: string; items: { title: string; time: string; endTime: string; location: string; color: string; calendar: string; people: string[] }[] }[] }
  | { kind: "bills"; title: string; month: string; bills: { name: string; amount: number; due: string; category: string; autopay: boolean; state: string }[]; total: number; paid: number }
  | { kind: "trips"; title: string; trips: { name: string; destination: string; start: string; end: string; notes: string; budget: number; stops: { date: string; time: string; title: string; cost: number }[]; packing: { person: string; items: { item: string; packed: boolean }[] }[] }[] }
  | { kind: "chores"; title: string; week: string[]; people: Person[]; chores: { title: string; points: number; days: { date: string; person: string; due: boolean; done: boolean }[] }[] }
  | { kind: "goals"; title: string; goals: { title: string; why: string; category: string; person: string; due: string; progress: number; label: string; done: boolean; steps: { title: string; done: boolean }[] }[] }
  | { kind: "health"; title: string; person: string; kid: boolean; goals: { calories: number; water: number; steps: number; activeMinutes: number; fruitVeg: number }; days: { date: string; calories: number; exercise: number; minutes: number; water: number; steps: number; fruitVeg: number; meals: { meal: string; name: string; calories: number }[] }[] };

const nameOf = (members: Member[], id: string) => members.find((m) => m.id === id)?.name || "";
const person = (m: Member): Person => ({ name: m.name, emoji: m.emoji, color: m.color });

/** Votes from the family (in the hub) and from people who voted through the link, one each. */
export function pollVotes(family: Family, pollId: string, guests: GuestVote[]) {
  const poll = family.polls.find((p) => p.id === pollId);
  if (!poll) return null;
  const valid = new Set(poll.options.map((o) => o.id));
  const counts = new Map<string, number>();
  for (const choice of Object.values(poll.votes)) if (valid.has(choice)) counts.set(choice, (counts.get(choice) || 0) + 1);
  const counted = guests.filter((g) => valid.has(g.optionId));
  for (const g of counted) counts.set(g.optionId, (counts.get(g.optionId) || 0) + 1);
  return { poll, counts, guests: counted };
}

export const pollOpen = (p: { closed: boolean; closesOn: string }, today: string) => !p.closed && (!p.closesOn || p.closesOn >= today);

/** What a share link shows today, or null when the thing it was made for is gone. */
export function sharedView(workspace: unknown, target: ShareTarget, today: string, opts: { ownerName?: string; guests?: GuestVote[] } = {}): SharedView | null {
  const ws = (workspace && typeof workspace === "object" ? workspace : {}) as Record<string, any>;
  const family = cleanFamily(ws.family);
  const members = family.members;
  if (!isDay(today)) return null;

  if (target.kind === "poll") {
    const result = pollVotes(family, target.id, opts.guests || []);
    if (!result) return null;
    const { poll, counts, guests } = result;
    const options = poll.options.map((o) => ({ id: o.id, label: o.label, votes: counts.get(o.id) || 0 }));
    return {
      kind: "poll", title: "Family vote", question: poll.question, pollKind: poll.kind, open: pollOpen(poll, today), closesOn: poll.closesOn,
      options, total: options.reduce((s, o) => s + o.votes, 0), guests: guests.map((g) => g.name),
    };
  }

  if (target.kind === "tasks") {
    const lists = (Array.isArray(ws.lists) ? ws.lists : []).filter((l: any) => l && typeof l.id === "string" && (!target.id || l.id === target.id));
    if (target.id && !lists.length) return null;
    const tasks = Array.isArray(ws.tasks) ? ws.tasks : [];
    const order = (a: any, b: any) => Number(a.done) - Number(b.done) || (a.due ? 0 : 1) - (b.due ? 0 : 1) || `${a.due}${a.time}`.localeCompare(`${b.due}${b.time}`);
    return {
      kind: "tasks", title: target.id ? String(lists[0].name || "List") : "To-do lists",
      lists: lists.slice(0, 100).map((l: any) => ({
        name: String(l.name || "").slice(0, 60), color: /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : "#7566e8",
        tasks: tasks.filter((t: any) => t && t.listId === l.id && typeof t.title === "string")
          // Finished tasks from more than a week ago are history, not something to send around.
          .filter((t: any) => !t.done || String(t.completedAt || "").slice(0, 10) >= addDays(today, -7))
          .sort(order).slice(0, 500)
          .map((t: any) => ({ title: t.title.slice(0, 200), notes: String(t.notes || "").slice(0, 2000), due: isDay(t.due) ? t.due : "", time: typeof t.time === "string" ? t.time.slice(0, 5) : "", assignee: String(t.assignee || "").slice(0, 100), priority: String(t.priority || "normal"), done: !!t.done })),
      })),
    };
  }

  if (target.kind === "calendar") {
    const colorOf = new Map(family.calendars.map((c) => [c.id, c]));
    const days: Extract<SharedView, { kind: "calendar" }>["days"] = [];
    for (let i = -1; i < 60; i++) {
      const date = addDays(today, i);
      const items = eventsOn(family, date).map((e) => ({
        title: e.title, time: e.time, endTime: e.endTime, location: e.location,
        color: colorOf.get(e.calendarId)?.color || "#7566e8", calendar: colorOf.get(e.calendarId)?.name || "",
        people: e.memberIds.map((id) => nameOf(members, id)).filter(Boolean),
      }));
      if (family.layers.trips) for (const t of family.trips) if (t.start && t.start <= date && (t.end || t.start) >= date) items.push({ title: `✈️ ${t.name}`, time: "", endTime: "", location: t.destination, color: "#f29a14", calendar: "Trips", people: [] });
      if (items.length) days.push({ date, items });
    }
    return { kind: "calendar", title: "Family calendar", days };
  }

  if (target.kind === "bills") {
    const month = today.slice(0, 7);
    const bills = family.bills.map((b) => ({ name: b.name, amount: b.amount, due: billDue(b, month), category: b.category, autopay: b.autopay, state: billState(b, month, today) }))
      .sort((a, b) => a.due.localeCompare(b.due));
    return { kind: "bills", title: "Bills", month, bills, total: bills.reduce((s, b) => s + b.amount, 0), paid: bills.filter((b) => b.state === "paid").reduce((s, b) => s + b.amount, 0) };
  }

  if (target.kind === "trips") {
    const chosen = target.id ? family.trips.filter((t) => t.id === target.id) : family.trips.filter((t) => !t.start || (t.end || t.start) >= today);
    if (target.id && !chosen.length) return null;
    return {
      kind: "trips", title: target.id ? chosen[0].name : "Trips",
      trips: chosen.sort((a, b) => (a.start || "9").localeCompare(b.start || "9")).map((t) => {
        const people = new Map<string, { item: string; packed: boolean }[]>();
        for (const p of t.packing) {
          const who = nameOf(members, p.memberId) || "Everyone";
          people.set(who, [...(people.get(who) || []), { item: p.item, packed: p.packed }]);
        }
        return {
          name: t.name, destination: t.destination, start: t.start, end: t.end, notes: t.notes, budget: t.budget,
          stops: [...t.stops].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map(({ date, time, title, cost }) => ({ date, time, title, cost })),
          packing: Array.from(people, ([name, items]) => ({ person: name, items })),
        };
      }),
    };
  }

  if (target.kind === "chores") {
    const start = weekStart(today);
    const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return {
      kind: "chores", title: "Chore chart", week, people: members.map(person),
      chores: family.chores.map((c) => ({
        title: c.title, points: c.points,
        days: week.map((date) => ({ date, person: nameOf(members, choreOwner(c, date)), due: choreDueOn(c, date), done: !!choreDoneOn(family, c.id, date) })),
      })),
    };
  }

  if (target.kind === "goals") {
    return {
      kind: "goals", title: "Goals",
      goals: [...family.goals].sort((a, b) => Number(a.done) - Number(b.done)).map((g) => {
        const steps = g.milestones.map((m) => ({ title: m.title, done: m.done }));
        const progress = g.done ? 1 : g.kind === "steps" ? (steps.length ? steps.filter((s) => s.done).length / steps.length : 0) : g.target > 0 ? Math.min(1, g.current / g.target) : 0;
        const label = g.kind === "steps" ? `${steps.filter((s) => s.done).length} of ${steps.length} steps` : `${g.current} of ${g.target}${g.unit ? ` ${g.unit}` : ""}`;
        return { title: g.title, why: g.why, category: g.category, person: nameOf(members, g.memberId), due: g.due, progress: Math.round(progress * 100) / 100, label, done: g.done, steps };
      }),
    };
  }

  if (target.kind === "health") {
    const who = healthPeople(family, opts.ownerName || "").find((m) => m.id === target.id);
    if (!who) return null;
    const kid = who.kind === "kid";
    const g = goalsFor(family.health, who);
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).map((date) => {
      const t = dayTotals(family.health, who.id, date);
      const meals = kid ? [] : family.health.food.filter((f) => f.memberId === who.id && f.date === date)
        .map((f) => ({ meal: f.meal, name: f.name, calories: Math.round(f.calories * f.servings) }));
      // Kids' pages never count calories: only habits.
      return { date, calories: kid ? 0 : t.food.calories, exercise: kid ? 0 : t.exercise, minutes: t.minutes, water: t.water, steps: t.steps, fruitVeg: t.fruitVeg, meals };
    });
    return {
      kind: "health", title: kid ? `${who.name}'s healthy habits` : `${who.name}'s food & fitness`, person: who.name, kid,
      goals: { calories: kid ? 0 : g.calories, water: g.water, steps: g.steps, activeMinutes: g.activeMinutes, fruitVeg: g.fruitVeg },
      days,
    };
  }
  return null;
}

/** The label shown in the owner's list of links. */
export function targetLabel(workspace: unknown, t: ShareTarget, ownerName = ""): string {
  const ws = (workspace && typeof workspace === "object" ? workspace : {}) as Record<string, any>;
  const family = cleanFamily(ws.family);
  switch (t.kind) {
    case "poll": return `Poll: ${family.polls.find((p) => p.id === t.id)?.question || "(deleted)"}`;
    case "tasks": return t.id ? `List: ${(Array.isArray(ws.lists) ? ws.lists : []).find((l: any) => l?.id === t.id)?.name || "(deleted)"}` : "All to-do lists";
    case "calendar": return "Family calendar";
    case "bills": return "Bills";
    case "trips": return t.id ? `Trip: ${family.trips.find((x) => x.id === t.id)?.name || "(deleted)"}` : "Upcoming trips";
    case "chores": return "Chore chart";
    case "goals": return "Goals";
    case "health": return `Food & fitness: ${healthPeople(family, ownerName).find((m) => m.id === t.id)?.name || "(removed)"}`;
  }
}

/** Today's date for a guest: the one their device says, if it is within a day of the server's. */
export function guestToday(value: unknown, nowMs = Date.now()): string {
  const server = new Date(nowMs).toISOString().slice(0, 10);
  if (!isDay(value)) return server;
  const gap = Math.abs(fromDay(value as string).getTime() - fromDay(server).getTime());
  return gap <= 36 * 3600_000 ? (value as string) : server;
}
