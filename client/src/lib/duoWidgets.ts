// What the Arise To Duo widgets show (client/src/lib/widgets.ts sends it to the iPhone): a simple and a detailed
// widget for each slot. The potty ones are sent from the potty app itself (components/pro/potty/PottyApp.tsx),
// accountability from its own page. Pure, so it's tested.
import { addDays, billDue, billState, choreDoneOn, choreDueOn, daysBetween, eventsOn, isOn, money, type Family } from "@shared/familyHub";
import { weatherCode, type Forecast } from "@shared/lifePlugins";
import type { WidgetSlot } from "./widgets";

// The widgets themselves (ids and names) are listed in widgets.json next to the app's iOS project; the build reads it.

export type DuoTask = { id: string; title: string; due: string; time: string; done: boolean; listName?: string };

const clock = (t: string) => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const goalPct = (g: Family["goals"][number]) => g.done ? 1 : g.kind === "steps" ? (g.milestones.length ? g.milestones.filter((m) => m.done).length / g.milestones.length : 0) : g.target > 0 ? Math.max(0, Math.min(1, g.current / g.target)) : 0;

export function duoWidgetSlots(family: Family, tasks: DuoTask[], today: string, forecast: Forecast | null): WidgetSlot[] {
  const on = (s: Parameters<typeof isOn>[0]) => isOn(s, family);
  const slots: WidgetSlot[] = [];

  const events = on("calendar") ? eventsOn(family, today, true) : [];
  slots.push({ id: "duo.agenda", title: "Today's agenda", value: events.length ? `${events.length} event${events.length === 1 ? "" : "s"}` : "Clear day", detail: events[0] ? `${clock(events[0].time) || "All day"} ${events[0].title}` : "Nothing scheduled", tint: "#7566e8",
    lines: events.slice(0, 8).map((e) => `${clock(e.time) || "All day"}  ${e.title}`) });

  const due = tasks.filter((t) => !t.done && t.due && t.due <= today && t.listName !== "Email").sort((a, b) => (a.due + a.time).localeCompare(b.due + b.time));
  slots.push({ id: "duo.todos", title: "To-dos due", value: String(due.length), detail: due[0] ? due[0].title : "All caught up", tint: "#36b6a5", lines: due.slice(0, 8).map((t) => `${t.due < today ? "Late  " : t.time ? `${clock(t.time)}  ` : ""}${t.title}`) });

  const month = today.slice(0, 7), next = addDays(`${month}-28`, 7).slice(0, 7);
  const bills = on("money") ? family.bills.flatMap((b) => [month, next].map((m) => ({ b, due: billDue(b, m), state: billState(b, m, today) }))).filter((x) => x.state !== "paid").sort((a, b) => a.due.localeCompare(b.due)) : [];
  const nb = bills[0];
  slots.push({ id: "duo.bills", title: "Next bill", value: nb ? money(nb.b.amount) : "None due", detail: nb ? `${nb.b.name} · ${nb.state === "late" ? "late" : `due ${short(nb.due)}`}` : "No unpaid bills", tint: "#ef4444",
    lines: bills.slice(0, 8).map((x) => `${short(x.due)}  ${x.b.name}  ${money(x.b.amount)}`) });

  const goals = family.goals.filter((g) => !g.done);
  const gg = goals[0];
  slots.push({ id: "duo.goals", title: "Goals", value: gg ? `${Math.round(goalPct(gg) * 100)}%` : "No goals", detail: gg ? gg.title : "Add a goal", tint: "#f59e0b", progress: gg ? goalPct(gg) : 0,
    lines: goals.slice(0, 8).map((g) => `${Math.round(goalPct(g) * 100)}%  ${g.title}`) });

  const pinned = family.notes.filter((n) => n.pinned), notes = pinned.length ? pinned : family.notes.slice(0, 4);
  const stickies = family.stickies ?? [];
  slots.push({ id: "duo.notes", title: "Sticky notes", value: String(stickies.length + pinned.length), detail: stickies[0]?.text || notes[0]?.title || "No notes yet", tint: "#eab308",
    lines: [...stickies.map((s) => s.text), ...notes.map((n) => n.title)].filter(Boolean).slice(0, 8) });

  const cds = [...(family.countdowns ?? [])].map((c) => ({ ...c, left: daysBetween(today, c.date) })).filter((c) => c.left >= 0).sort((a, b) => a.left - b.left);
  const c0 = cds[0];
  slots.push({ id: "duo.countdown", title: c0 ? c0.title : "Countdown", value: c0 ? (c0.left === 0 ? "Today" : `${c0.left} day${c0.left === 1 ? "" : "s"}`) : "None set", detail: c0 ? short(c0.date) : "Add one in Countdowns", tint: "#8b5cf6",
    lines: cds.slice(0, 8).map((c) => `${c.left === 0 ? "Today" : `${c.left}d`}  ${c.title}`) });

  const mail = tasks.filter((t) => !t.done && t.listName === "Email");
  slots.push({ id: "duo.email", title: "Email to-dos", value: String(mail.length), detail: mail[0]?.title || "Nothing waiting", tint: "#619ee6", lines: mail.slice(0, 8).map((t) => t.title) });

  const wx = forecast ? weatherCode(forecast.current.code) : null;
  slots.push({ id: "duo.weather", title: forecast ? forecast.place.split(",")[0] : "Weather", value: forecast ? `${forecast.current.temp}°${forecast.unit}` : "Set a town", detail: wx ? `${wx.icon} ${wx.text} · feels ${forecast!.current.feels}°` : "Weather add-on", tint: "#0ea5e9",
    lines: forecast ? forecast.days.slice(0, 7).map((d, i) => `${i === 0 ? "Today" : new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}  ${d.high}° / ${d.low}°  ${weatherCode(d.code).icon}`) : [] });

  const chores = on("chores") ? family.chores.filter((c) => choreDueOn(c, today)) : [], left = chores.filter((c) => !choreDoneOn(family, c.id, today));
  slots.push({ id: "duo.chores", title: "Chores today", value: chores.length ? `${left.length} left` : "None", detail: chores.length ? `${chores.length - left.length} of ${chores.length} done` : "No chores today", tint: "#22c55e", progress: chores.length ? (chores.length - left.length) / chores.length : 0,
    lines: left.slice(0, 8).map((c) => c.title) });

  const week: string[] = [];
  for (let i = 0; i < 7 && week.length < 8; i++) { const d = addDays(today, i); for (const e of on("calendar") ? eventsOn(family, d, true) : []) { if (week.length < 8) week.push(`${i === 0 ? "Today" : new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}  ${clock(e.time) || "All day"}  ${e.title}`); } }
  slots.push({ id: "duo.week", title: "This week", value: week.length ? `${week.length}+` : "Open", detail: week[0] ?? "Nothing planned", tint: "#f97316", lines: week });
  return slots;
}
