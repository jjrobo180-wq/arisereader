// The Daily Brief app for both hubs: one page each morning with what today holds and what's coming up,
// built from what's already in the hub. buildWorkBrief is for WorkHub (teachers), buildLifeBrief for LifeHub.

import type { Workspace } from "./teacherHub";
import { eventsOn, type Family } from "./familyHub";

export type BriefLine = { text: string; sub?: string; when?: string; tone?: "warn" | "good" };
export type BriefSection = { id: string; title: string; lines: BriefLine[]; empty: string; open?: string };
export type Brief = { greeting: string; date: string; summary: string; sections: BriefSection[] };

const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const between = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const dayWord = (today: string, day: string) => { const n = between(today, day); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n < 0 ? `${-n} day${n === -1 ? "" : "s"} late` : new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }); };
export const clock12 = (t?: string) => { if (!t || !/^\d{1,2}:\d{2}/.test(t)) return ""; const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
export const greetingFor = (hour: number, name: string) => `${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}${name ? `, ${name}` : ""}`;
const longDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A teacher's day: schedule, to-dos, meetings this week, IEP deadlines coming up and today's lessons. */
export function buildWorkBrief(w: Workspace, today: string, hour: number, name: string): Brief {
  const week = addDays(today, 7), month = addDays(today, 30);
  const schedule: (BriefLine & { at: string })[] = [
    ...(w.events || []).filter((e) => e.date === today && !e.meetingId).map((e) => ({ text: e.title, sub: e.location || undefined, when: clock12(e.start) || "All day", at: e.start || "" })),
    ...(w.meetings || []).filter((m) => m.date === today && !m.done).map((m) => ({ text: `${m.type}: ${m.student}`, sub: m.room || undefined, when: clock12(m.time) || "Today", at: m.time || "" })),
  ].sort((a, b) => (a.at || "99").localeCompare(b.at || "99"));
  const open = (w.tasks || []).filter((t) => !t.done);
  const due = open.filter((t) => t.dueDate && t.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const high = open.filter((t) => t.priority === "high" && !(t.dueDate && t.dueDate <= today));
  const meetings = (w.meetings || []).filter((m) => !m.done && m.date && m.date > today && m.date <= week).sort((a, b) => a.date.localeCompare(b.date));
  const deadlines = (w.students || []).flatMap((s) => [
    s.iepDate && s.iepDate >= today && s.iepDate <= month ? { text: `${s.name}: annual IEP due`, when: dayWord(today, s.iepDate), day: s.iepDate } : null,
    s.reevalDate && s.reevalDate >= today && s.reevalDate <= month ? { text: `${s.name}: re-evaluation due`, when: dayWord(today, s.reevalDate), day: s.reevalDate } : null,
  ]).filter((x): x is { text: string; when: string; day: string } => !!x).sort((a, b) => a.day.localeCompare(b.day));
  const lessons = (w.lessons || []).filter((l) => l.date === today);
  const sections: BriefSection[] = [
    { id: "schedule", title: "Today's schedule", lines: schedule, empty: "Nothing on the calendar today.", open: "calendar" },
    { id: "todo", title: "To do today", lines: [...due.map((t) => ({ text: t.title, when: dayWord(today, t.dueDate), tone: t.dueDate < today ? "warn" as const : undefined })), ...high.slice(0, 5).map((t) => ({ text: t.title, when: "Important" }))], empty: "No to-dos due. Nice.", open: "tasks" },
    { id: "lessons", title: "Lessons today", lines: lessons.map((l) => ({ text: l.title, sub: [l.subject, l.group].filter(Boolean).join(" · ") || undefined })), empty: "No lessons planned for today.", open: "lessons" },
    { id: "meetings", title: "Meetings this week", lines: meetings.map((m) => ({ text: `${m.type}: ${m.student}`, when: `${dayWord(today, m.date)}${m.time ? ` ${clock12(m.time)}` : ""}` })), empty: "No more meetings this week.", open: "iep" },
    { id: "deadlines", title: "IEP deadlines in the next 30 days", lines: deadlines.map((d) => ({ text: d.text, when: d.when, tone: between(today, d.day) <= 7 ? "warn" as const : undefined })), empty: "No IEP deadlines in the next month.", open: "caseload" },
  ];
  const late = due.filter((t) => t.dueDate < today).length;
  const summary = [schedule.length ? plural(schedule.length, "thing") + " on your schedule" : "a clear calendar", due.length ? `${plural(due.length, "to-do")} due${late ? ` (${late} late)` : ""}` : "", meetings.length ? `${plural(meetings.length, "meeting")} later this week` : "", deadlines.length ? `${plural(deadlines.length, "IEP deadline")} coming up` : ""].filter(Boolean);
  return { greeting: greetingFor(hour, name), date: longDate(today), summary: `Today you have ${listWords(summary)}.`, sections };
}

type LifeTask = { title: string; due: string; time: string; done: boolean; assignee?: string };
/** A family's day: the calendar, to-dos, chores, meals, bills, birthdays and countdowns. */
export function buildLifeBrief(f: Family, tasks: LifeTask[], today: string, hour: number, name: string): Brief {
  const who = (id: string) => f.members.find((m) => m.id === id)?.name;
  const events = eventsOn(f, today).map((e) => ({ text: e.title, sub: [e.location, e.memberIds.map(who).filter(Boolean).join(", ")].filter(Boolean).join(" · ") || undefined, when: clock12(e.time) || "All day", at: e.time || "" })).sort((a, b) => (a.at || "99").localeCompare(b.at || "99"));
  const due = tasks.filter((t) => !t.done && t.due && t.due <= today).sort((a, b) => a.due.localeCompare(b.due) || (a.time || "").localeCompare(b.time || ""));
  const wd = weekday(today);
  const chores = f.chores.filter((c) => c.days.includes(wd)).map((c) => ({ text: c.title, sub: who(c.memberId) || undefined, done: f.choreDone.some((d) => d.choreId === c.id && d.date === today) }));
  const meals = (["breakfast", "lunch", "dinner"] as const).flatMap((slot) => f.meals.filter((m) => m.date === today && m.slot === slot).map((m) => ({ text: m.text || f.recipes.find((r) => r.id === m.recipeId)?.title || "Planned meal", when: slot[0].toUpperCase() + slot.slice(1) })));
  const dom = Number(today.slice(8, 10)), month = today.slice(0, 7);
  const bills = f.bills.filter((b) => !b.paid.includes(month) && b.dueDay >= dom && b.dueDay <= dom + 7).sort((a, b) => a.dueDay - b.dueDay)
    .map((b) => ({ text: b.name, sub: `$${b.amount.toFixed(2)}${b.autopay ? " · autopay" : ""}`, when: b.dueDay === dom ? "Today" : `${b.dueDay - dom} day${b.dueDay - dom === 1 ? "" : "s"}`, tone: b.dueDay - dom <= 2 && !b.autopay ? "warn" as const : undefined }));
  const birthdays = f.birthdays.map((b) => { let day = `${today.slice(0, 4)}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`; if (day < today) day = `${Number(today.slice(0, 4)) + 1}${day.slice(4)}`; return { b, day }; })
    .filter((x) => between(today, x.day) <= 7).sort((a, b) => a.day.localeCompare(b.day)).map(({ b, day }) => ({ text: `${b.name}'s ${b.kind === "anniversary" ? "anniversary" : b.kind === "birthday" ? "birthday" : "day"}`, when: dayWord(today, day), tone: day === today ? "good" as const : undefined }));
  const countdowns = f.countdowns.filter((c) => c.date >= today && between(today, c.date) <= 30).sort((a, b) => a.date.localeCompare(b.date)).map((c) => ({ text: `${c.emoji ? `${c.emoji} ` : ""}${c.title}`, when: c.date === today ? "Today!" : `${between(today, c.date)} days` }));
  const sections: BriefSection[] = [
    { id: "calendar", title: "Today's calendar", lines: events, empty: "Nothing on the family calendar today.", open: "calendar" },
    { id: "tasks", title: "To do today", lines: due.map((t) => ({ text: t.title, when: t.due < today ? dayWord(today, t.due) : clock12(t.time) || "Today", tone: t.due < today ? "warn" as const : undefined })), empty: "No tasks due today.", open: "tasks" },
    { id: "chores", title: "Chores today", lines: chores.map((c) => ({ text: c.text, sub: c.sub, when: c.done ? "Done" : undefined, tone: c.done ? "good" as const : undefined })), empty: "No chores today.", open: "chores" },
    { id: "meals", title: "Meals today", lines: meals, empty: "No meals planned today.", open: "meals" },
    { id: "bills", title: "Bills due this week", lines: bills, empty: "No bills due this week.", open: "money" },
    { id: "birthdays", title: "Birthdays this week", lines: birthdays, empty: "No birthdays this week.", open: "birthdays" },
    { id: "countdowns", title: "Counting down", lines: countdowns, empty: "Nothing to count down to.", open: "countdowns" },
  ];
  const summary = [events.length ? plural(events.length, "event") : "", due.length ? plural(due.length, "task") + " due" : "", chores.length ? plural(chores.length, "chore") : "", bills.length ? plural(bills.length, "bill") + " due soon" : ""].filter(Boolean);
  return { greeting: greetingFor(hour, name), date: longDate(today), summary: summary.length ? `Today has ${listWords(summary)}.` : "Today is wide open.", sections };
}

function listWords(parts: string[]) { return parts.length <= 1 ? parts[0] || "" : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`; }

/** The brief as plain sentences, for reading aloud or sharing. */
export function briefText(b: Brief): string {
  const parts = [`${b.greeting}. It's ${b.date}. ${b.summary}`];
  for (const s of b.sections) if (s.lines.length) parts.push(`${s.title}: ${s.lines.map((l) => `${l.when ? `${l.when}, ` : ""}${l.text}`).join("; ")}.`);
  return parts.join("\n\n");
}
