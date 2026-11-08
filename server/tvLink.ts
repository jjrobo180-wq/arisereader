/**
 * Signing in an Apple TV (Arise Duo for Apple TV, native/duo-tv) without typing a password with a remote:
 *   1. The TV asks for a code: POST /api/tv-link/start            -> { code: "K7QX2M", poll, expiresInSeconds }
 *   2. On a phone or computer, already signed in, the person opens arisetodo.com/tv and types the code:
 *      POST /api/tv-link/approve { code }  (signed in)            -> { ok, device }
 *   3. The TV has been asking all along: POST /api/tv-link/poll { poll } -> { status: "waiting" | "done", token, name }
 * The TV gets a session of its own (signing out elsewhere doesn't sign it out, and it can be signed out
 * by itself); the code is good for 10 minutes and once. The poll secret never leaves the TV, so a code
 * seen on screen can't be used to collect the session. Codes are kept in memory (one app instance).
 *
 * Also the TV's view of the family: GET /api/arise-todo/tv?day=YYYY-MM-DD (signed in), a small summary of
 * the hub (today's and upcoming tasks, the week's events, today's chores) so the TV never downloads the
 * whole workspace.
 */
import { randomBytes, randomInt } from "node:crypto";
import type { Express, Response } from "express";
import { repeatDates } from "../shared/hubRepeat";
import { billDue, billState, choreDoneOn, choreDueOn, choreOwner, cleanFamily, daysBetween, eventsOn, isOn, money, starBalance, tally, type Family, type Goal, type Poll } from "../shared/familyHub";

type Auth = (req: any, res: Response, next: any) => unknown;
type Pending = { code: string; poll: string; app: string; expiresAt: number; userId?: number; token?: string; name?: string };
const TTL = 10 * 60_000;
const MOST = 500;
const LETTERS = "BCDFGHJKLMNPQRSTVWXZ23456789";

export function registerTvLinkRoutes(app: Express, auth: Auth, deps: {
  createSession: (userId: number) => Promise<{ token: string }>;
  readWorkspace: (userId: number) => Promise<{ workspace: any } | null>;
  /** The teacher's Arise WorkHub (teacher_hub_workspaces), for the TV's Work side. */
  readWorkWorkspace?: (userId: number) => Promise<{ workspace: any } | null>;
  now?: () => number;
}): void {
  const now = deps.now ?? Date.now;
  const byCode = new Map<string, Pending>();
  const byPoll = new Map<string, Pending>();
  const sweep = () => { const t = now(); for (const p of byCode.values()) if (p.expiresAt <= t) { byCode.delete(p.code); byPoll.delete(p.poll); } };
  const noCache = (res: Response) => { res.setHeader("Cache-Control", "no-store, private"); res.setHeader("Referrer-Policy", "no-referrer"); };

  app.post("/api/tv-link/start", (req: any, res) => {
    noCache(res);
    sweep();
    if (byCode.size >= MOST) return res.status(429).json({ message: "Please try again in a minute." });
    let code = "";
    do { code = Array.from({ length: 6 }, () => LETTERS[randomInt(LETTERS.length)]).join(""); } while (byCode.has(code));
    const p: Pending = { code, poll: randomBytes(24).toString("hex"), app: String(req.body?.app || "duo").slice(0, 20), expiresAt: now() + TTL };
    byCode.set(code, p); byPoll.set(p.poll, p);
    res.json({ code, poll: p.poll, expiresInSeconds: TTL / 1000 });
  });

  app.post("/api/tv-link/approve", auth, async (req: any, res) => {
    noCache(res);
    sweep();
    const code = String(req.body?.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const p = byCode.get(code);
    if (!p) return res.status(404).json({ message: "That code isn't right or has run out. Check the TV for the code showing now." });
    if (p.userId) return res.status(409).json({ message: "That TV is already signed in." });
    const user = req.realUser || req.user;
    try {
      const session = await deps.createSession(Number(user.id));
      p.userId = Number(user.id); p.token = session.token; p.name = String(user.displayName || user.username || "");
      byCode.delete(code);
      res.json({ ok: true, device: "Apple TV" });
    } catch {
      res.status(503).json({ message: "Couldn't sign the TV in just now. Please try again." });
    }
  });

  app.post("/api/tv-link/poll", (req, res) => {
    noCache(res);
    const p = byPoll.get(String(req.body?.poll || ""));
    if (!p || p.expiresAt <= now()) return res.status(410).json({ status: "expired" });
    if (!p.token) return res.json({ status: "waiting" });
    byPoll.delete(p.poll);
    res.json({ status: "done", token: p.token, name: p.name });
  });

  // The Work side (Arise WorkHub). Teachers only; anyone else (or a teacher with no WorkHub yet) gets
  // { available: false } and the TV shows LifeHub alone.
  app.get("/api/tv/work", auth, async (req: any, res) => {
    noCache(res);
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query?.day)) ? String(req.query.day) : new Date().toISOString().slice(0, 10);
    const user = req.user;
    if (!deps.readWorkWorkspace || !(user?.role === "teacher" || user?.isAdmin)) return res.json({ available: false });
    try {
      const row = await deps.readWorkWorkspace(Number(user.id));
      if (!row) return res.json({ available: false });
      res.json({ available: true, ...tvWorkSummary(row.workspace, day, String(user.displayName || "")) });
    } catch {
      res.status(503).json({ message: "Your WorkHub isn't reachable right now." });
    }
  });

  app.get("/api/arise-todo/tv", auth, async (req: any, res) => {
    noCache(res);
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query?.day)) ? String(req.query.day) : new Date().toISOString().slice(0, 10);
    try {
      const row = await deps.readWorkspace(Number(req.user.id));
      res.json(tvSummary(row?.workspace, day, String(req.user.displayName || "")));
    } catch {
      res.status(503).json({ message: "Your family hub isn't reachable right now." });
    }
  });
}

const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// The same rules as the phone's Home (client/src/components/family-hub/Polls.tsx and Goals.tsx).
const pollOpen = (p: Poll, today: string) => !p.closed && (!p.closesOn || p.closesOn >= today);
const goalProgress = (g: Goal) => g.done ? 1 : g.kind === "steps" ? (g.milestones.length ? g.milestones.filter((m) => m.done).length / g.milestones.length : 0) : g.target > 0 ? Math.max(0, Math.min(1, g.current / g.target)) : 0;

/** What the TV shows: the phone's Home (greeting, the four counts, Agenda, Chores, then Bills, Stars, Polls,
 *  the next trip, Goals and pinned Notes), its Tasks screen and the week. Pure, so it's tested.
 *  The first fields are what the first TV app read; everything after `chores` was added for the phone's layout. */
export function tvSummary(workspace: any, day: string, name = "") {
  const ws = workspace && typeof workspace === "object" ? workspace : {};
  const family: Family = cleanFamily(ws.family ?? {});
  const on = (s: Parameters<typeof isOn>[0]) => isOn(s, family);
  const member = new Map(family.members.map((m) => [m.id, m]));
  const person = (id: string) => { const m = member.get(id); return m ? { name: m.name, emoji: m.emoji, color: m.color } : null; };
  const calColor = new Map(family.calendars.map((c) => [c.id, c.color]));
  const lists = (Array.isArray(ws.lists) ? ws.lists : []).filter((l: any) => l && l.id != null).map((l: any) => ({ id: String(l.id), name: String(l.name || "").slice(0, 60) }));
  const listName = new Map(lists.map((l: { id: string; name: string }) => [l.id, l.name]));
  const week = addDays(day, 7);
  const open = (Array.isArray(ws.tasks) ? ws.tasks : []).filter((t: any) => t && !t.archived && !t.done && typeof t.title === "string")
    .sort((a: any, b: any) => (a.due || "9999").localeCompare(b.due || "9999") || String(a.time || "99").localeCompare(String(b.time || "99")));
  const tasks = open.filter((t: any) => !t.due || t.due <= week).slice(0, 80)
    .map((t: any) => ({ id: String(t.id), title: t.title.slice(0, 120), due: String(t.due || ""), time: String(t.time || ""), list: listName.get(String(t.listId)) || "",
      who: member.get(String(t.assignee))?.name || "", listId: String(t.listId ?? ""), priority: String(t.priority || "normal") }));
  const events = Array.from({ length: 7 }, (_, i) => addDays(day, i)).flatMap((d) => (on("calendar") ? eventsOn(family, d, true) : []).map((e) => ({
    date: d, title: e.title.slice(0, 120), time: e.time || "", endTime: e.endTime || "", location: (e.location || "").slice(0, 80),
    who: e.memberIds.map((id) => member.get(id)?.name).filter(Boolean),
    color: calColor.get(e.calendarId) || "#94a3b8", people: e.memberIds.map(person).filter(Boolean).slice(0, 4),
  }))).slice(0, 60);
  const chores = (on("chores") ? family.chores.filter((c) => choreDueOn(c, day)) : []).map((c) => {
    const who = member.get(choreOwner(c, day));
    return { id: c.id, title: c.title.slice(0, 80), who: who?.name || "", emoji: who?.emoji || "", color: who?.color || "", points: c.points, done: !!choreDoneOn(family, c.id, day) };
  });
  const month = day.slice(0, 7);
  const nextMonth = addDays(`${month}-28`, 7).slice(0, 7);
  const bills = on("money") ? family.bills.flatMap((b) => [month, nextMonth].map((m) => ({ b, due: billDue(b, m), state: billState(b, m, day) })))
    .filter((x) => x.state !== "paid" && daysBetween(day, x.due) <= 7).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6)
    .map(({ b, due, state }) => ({ name: b.name.slice(0, 60), amount: money(b.amount), due, late: state === "late" })) : [];
  const trip = on("trips") ? [...family.trips].filter((t) => t.start && (t.end || t.start) >= day).sort((a, b) => a.start.localeCompare(b.start))[0] : undefined;
  return {
    name, day,
    members: family.members.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, color: m.color })),
    tasks, events, chores,
    lists,
    sections: { calendar: on("calendar"), chores: on("chores"), money: on("money"), polls: on("polls"), trips: on("trips"), goals: on("goals"), stars: on("behavior"), notes: on("notes") },
    bills,
    billsPaid: on("money") && family.bills.length ? { paid: family.bills.filter((b) => b.paid.includes(month)).length, total: family.bills.length } : null,
    stars: on("behavior") ? family.members.filter((m) => m.kind === "kid").map((k) => ({ name: k.name, emoji: k.emoji, color: k.color, stars: starBalance(family, k.id).balance })) : [],
    polls: on("polls") ? family.polls.filter((p) => pollOpen(p, day)).slice(0, 3).map((p) => {
      const t = tally(p);
      return { question: p.question.slice(0, 120), leading: t.leaders[0]?.label || "", waiting: family.members.filter((m) => !p.votes[m.id]).length };
    }) : [],
    trip: trip ? { name: trip.name.slice(0, 80), start: trip.start, daysToGo: Math.max(0, daysBetween(day, trip.start)), packed: trip.packing.filter((p) => p.packed).length, packing: trip.packing.length } : null,
    goals: on("goals") ? family.goals.filter((g) => !g.done).slice(0, 4).map((g) => ({ title: g.title.slice(0, 80), progress: Math.round(goalProgress(g) * 100) / 100 })) : [],
    // The LifeHub apps the TV has pages for (its Apps tab), each only when it's switched on.
    apps: lifeApps(family, day, on),
    weather: on("weather") && family.weather.place ? { place: family.weather.place, unit: family.weather.unit } : null,
    // Notes behind the hub's passcode never go to the TV.
    notes: on("notes") ? family.notes.filter((n) => n.pinned && !n.locked).slice(0, 4).map((n) => ({ title: n.title.slice(0, 80), body: n.body.slice(0, 240), color: n.color || "#fef3c7" })) : [],
  };
}

/** Grocery list, this week's meals, countdowns, birthdays, habits and routines, for the TV's Apps tab. */
function lifeApps(family: Family, day: string, on: (s: Parameters<typeof isOn>[0]) => boolean) {
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i));
  const nextOf = (month: number, dd: number) => {
    const y = Number(day.slice(0, 4));
    const pad = (n: number) => String(n).padStart(2, "0");
    const thisYear = `${y}-${pad(month)}-${pad(dd)}`;
    return thisYear >= day ? thisYear : `${y + 1}-${pad(month)}-${pad(dd)}`;
  };
  const kitchen = on("kitchen");
  return {
    grocery: on("grocery") || kitchen ? family.groceries.filter((g) => !g.checked).slice(0, 60).map((g) => ({ name: g.name.slice(0, 60), qty: g.qty.slice(0, 20), aisle: g.aisle.slice(0, 30) })) : null,
    meals: on("meals") || kitchen ? week.map((d) => ({ date: d, meals: family.meals.filter((m) => m.date === d).sort((a, b) => ["breakfast", "lunch", "dinner"].indexOf(a.slot) - ["breakfast", "lunch", "dinner"].indexOf(b.slot))
      .map((m) => ({ slot: m.slot, text: (m.text || family.recipes.find((r) => r.id === m.recipeId)?.title || "").slice(0, 80) })).filter((m) => m.text) })) : null,
    countdowns: on("countdowns") ? family.countdowns.filter((c) => c.date >= day).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12)
      .map((c) => ({ title: c.title.slice(0, 60), date: c.date, days: daysBetween(day, c.date), emoji: c.emoji, color: c.color })) : null,
    birthdays: on("birthdays") ? family.birthdays.map((b) => { const next = nextOf(b.month, b.day); return { name: b.name.slice(0, 60), date: next, days: daysBetween(day, next), kind: b.kind, turns: b.year ? Number(next.slice(0, 4)) - b.year : 0 }; })
      .filter((b) => b.days <= 60).sort((a, b) => a.days - b.days).slice(0, 12) : null,
    habits: on("habits") ? family.habits.slice(0, 12).map((h) => ({ name: h.name.slice(0, 50), emoji: h.emoji, color: h.color,
      week: Array.from({ length: 7 }, (_, i) => h.days.includes(addDays(day, i - 6))), today: h.days.includes(day) })) : null,
    routines: on("routines") ? family.routines.slice(0, 8).map((r) => ({ name: r.name.slice(0, 50), emoji: r.emoji, steps: r.steps.slice(0, 15).map((x) => ({ text: x.text.slice(0, 80), done: r.doneDate === day && r.doneSteps.includes(x.id) })) })) : null,
  };
}

/** The Work side of the TV: Arise WorkHub's Home, to-dos, calendar, meetings, today's schedule and what's
 *  coming up for the caseload (IEPs and reevaluations). Pure, so it's tested. Notes are never sent. */
export function tvWorkSummary(workspace: any, day: string, name = "") {
  const ws = workspace && typeof workspace === "object" ? workspace : {};
  const arr = (x: unknown) => (Array.isArray(x) ? x : []);
  const students = arr(ws.students).filter((s: any) => s && s.id);
  const studentName = (id: unknown) => { const s = students.find((x: any) => x.id === id || x.name === id); return String(s?.name ?? id ?? "").slice(0, 60); };
  const lists = arr(ws.taskLists).filter((l: any) => l && l.id).map((l: any) => ({ id: String(l.id), name: String(l.name || "").slice(0, 60), color: String(l.color || "") }));
  const listName = new Map(lists.map((l: { id: string; name: string }) => [l.id, l.name]));
  const week = addDays(day, 7), until = addDays(day, 6);
  const tasks = arr(ws.tasks).filter((t: any) => t && typeof t.title === "string" && !t.done && !t.archived)
    .sort((a: any, b: any) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || String(a.dueTime || "99").localeCompare(String(b.dueTime || "99")))
    .slice(0, 80).map((t: any) => ({ id: String(t.id), title: t.title.slice(0, 120), due: String(t.dueDate || ""), time: String(t.dueTime || ""), list: listName.get(String(t.listId)) || "",
      who: "", listId: String(t.listId ?? ""), priority: t.priority === "high" ? "high" : "normal" }));
  const hidden = new Set(arr(ws.hiddenCalendars).map(String));
  const events = arr(ws.events).filter((e: any) => e && typeof e.title === "string" && !(e.calendarId && hidden.has(String(e.calendarId))))
    .flatMap((e: any) => {
      const days: string[] = e.repeat ? repeatDates(e, day, until) : (e.date >= day && e.date <= until ? [e.date] : []);
      return days.map((d) => ({ date: d, title: e.title.slice(0, 120), time: String(e.start || ""), endTime: String(e.end || ""), location: String(e.location || "").slice(0, 80),
        who: arr(e.students).map(studentName).filter(Boolean).slice(0, 4), color: "#0d9488", people: [] as never[] }));
    });
  const meetings = arr(ws.meetings).filter((m: any) => m && !m.done && typeof m.date === "string" && m.date >= day && m.date <= addDays(day, 14))
    .sort((a: any, b: any) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))).slice(0, 20)
    .map((m: any) => ({ student: studentName(m.student), type: String(m.type || "Meeting").slice(0, 60), date: m.date, time: String(m.time || ""), room: String(m.room || "").slice(0, 40) }));
  // A booked meeting is on the calendar too.
  for (const m of meetings) if (m.date <= until && !events.some((e) => e.date === m.date && e.title.includes(m.student))) {
    events.push({ date: m.date, title: `${m.type}: ${m.student}`, time: m.time, endTime: "", location: m.room, who: [m.student], color: "#7c3aed", people: [] });
  }
  events.sort((a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")));
  const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const schedule = arr(ws.schedules).filter((x: any) => x && String(x.day) === weekday)
    .sort((a: any, b: any) => String(a.start).localeCompare(String(b.start))).slice(0, 30)
    .map((x: any) => ({ student: studentName(x.student), start: String(x.start || ""), end: String(x.end || ""), label: String(x.label || "").slice(0, 60) }));
  const dueSoon = students.flatMap((s: any) => [["Annual IEP due", s.iepDate], ["Reevaluation due", s.reevalDate]]
    .filter(([, d]) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= addDays(day, 45))
    .map(([what, d]) => ({ what, student: String(s.name || "").slice(0, 60), date: d as string, days: daysBetween(day, d as string) })))
    .sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(0, 20);
  const lessons = arr(ws.lessons).filter((l: any) => l && typeof l.date === "string" && l.date >= day && l.date <= until)
    .sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(0, 20)
    .map((l: any) => ({ title: String(l.title || "").slice(0, 80), subject: String(l.subject || "").slice(0, 40), group: String(l.group || "").slice(0, 40), date: l.date }));
  return {
    name, day, school: String(ws.profile?.school || "").slice(0, 80),
    tasks, lists, events: events.slice(0, 60), meetings, schedule, dueSoon, lessons,
    students: students.length,
    dueToday: tasks.filter((t: { due: string }) => t.due && t.due <= day).length,
    week,
  };
}
