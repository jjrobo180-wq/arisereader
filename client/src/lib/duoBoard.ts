// What the Arise To Duo iPhone widgets draw (native/widget-extension/DuoDesigns.swift): the 40 designs for
// small, medium, large and the Lock Screen all read this one "board" of the person's tasks: the counts, the
// tasks that matter now, this week and this month. Sent as a slot named "duo.board" next to the other slots.
// Pure (apart from publishDuoBoard), so it's tested.
import { hasNativePlugin, isNativeApp, nativeCall } from "@/lib/nativeApp";

export type BoardTask = { id: string; title: string; due: string; time: string; done: boolean; listName?: string; completedAt?: string };
export type BoardList = { name: string; color: string; count: number };
export type DuoBoard = {
  date: string; weekday: string; month: string;
  open: number; today: number; todayDone: number; overdue: number; upcoming: number; done: number; asks: number;
  tasks: { id: string; title: string; label: string; late: boolean; done: boolean; today: boolean; list: string }[];
  week: { label: string; day: string; count: number; today: boolean; late: boolean; titles: string[] }[];
  lists: BoardList[];
  monthFirst: number; monthDays: number; monthToday: number; dots: number[];
};

const at = (d: string) => new Date(`${d}T12:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (d: string, n: number) => { const x = at(d); x.setDate(x.getDate() + n); return iso(x); };
const clock = (t: string) => { if (!/^\d{1,2}:\d{2}/.test(t)) return ""; const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** When a task is due, said the way a widget has room for. */
function labelOf(t: BoardTask, today: string): string {
  if (!t.due) return t.done ? "Done" : "No date";
  if (t.due === today) return t.done ? "Done" : clock(t.time) || "Today";
  if (t.due === plus(today, -1)) return "Yesterday";
  if (t.due === plus(today, 1)) return `Tomorrow${t.time ? ` · ${clock(t.time)}` : ""}`;
  const d = at(t.due), days = Math.round((d.getTime() - at(today).getTime()) / 864e5);
  if (Math.abs(days) < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function duoBoard(tasks: BoardTask[], lists: { name: string; color: string; count: number }[], today: string, asks = 0): DuoBoard {
  const open = tasks.filter((t) => !t.done);
  const late = open.filter((t) => t.due && t.due < today).sort((a, b) => (a.due + a.time).localeCompare(b.due + b.time));
  const dueToday = tasks.filter((t) => t.due === today);
  const todayOpen = dueToday.filter((t) => !t.done).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const todayDone = dueToday.filter((t) => t.done);
  const later = open.filter((t) => t.due && t.due > today).sort((a, b) => (a.due + a.time).localeCompare(b.due + b.time));
  const undated = open.filter((t) => !t.due);
  const pick = [...late, ...todayOpen, ...todayDone, ...later, ...undated].slice(0, 10);
  const d = at(today), dow = (d.getDay() + 6) % 7, monday = plus(today, -dow);
  const week = [0, 1, 2, 3, 4].map((i) => {
    const day = plus(monday, i), on = open.filter((t) => t.due === day);
    return { label: at(day).toLocaleDateString("en-US", { weekday: "short" }), day: String(at(day).getDate()), count: on.length, today: day === today, late: day < today && on.length > 0, titles: on.slice(0, 3).map((t) => cut(t.title, 28)) };
  });
  const first = new Date(d.getFullYear(), d.getMonth(), 1), days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const ym = today.slice(0, 7);
  const dots = [...new Set(open.filter((t) => t.due.startsWith(ym)).map((t) => Number(t.due.slice(8, 10))))].sort((a, b) => a - b);
  return {
    date: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    weekday: d.toLocaleDateString("en-US", { weekday: "long" }), month: d.toLocaleDateString("en-US", { month: "long" }),
    open: open.length, today: dueToday.length, todayDone: todayDone.length, overdue: late.length, upcoming: later.length,
    done: tasks.filter((t) => t.done).length, asks: Math.max(0, Math.round(asks) || 0),
    tasks: pick.map((t) => ({ id: t.id, title: cut(t.title, 60), label: labelOf(t, today), late: !t.done && !!t.due && t.due < today, done: t.done, today: t.due === today, list: cut(t.listName || "", 20) })),
    week, lists: lists.slice(0, 4).map((l) => ({ name: cut(l.name, 18), color: /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : "#7c6cf0", count: l.count })),
    monthFirst: first.getDay(), monthDays: days, monthToday: d.getDate(), dots,
  };
}

const PLUGIN = /arise.?widgets/i;
const sent = new Map<string, string>();
/** Saves a slot as it is (the board and the focus timer have their own shapes, not the simple slot's). */
function publishRaw(slot: Record<string, unknown> & { id: string }): void {
  if (!isNativeApp() || !hasNativePlugin(PLUGIN)) return;
  const j = JSON.stringify(slot);
  if (sent.get(slot.id) === j) return;
  sent.set(slot.id, j);
  void nativeCall(PLUGIN, "AriseWidgets", "publish", { slots: [slot] }).catch(() => sent.delete(slot.id));
}

export function publishDuoBoard(board: DuoBoard): void {
  publishRaw({ id: "duo.board", title: "Tasks", value: String(board.open), board });
}

/** The focus timer, for the widgets that show it (the Live Activity has its own copy). */
export function publishFocusNow(focus: { id: string; title: string; startedAt: number; endsAt: number } | null): void {
  publishRaw({ id: "duo.focusnow", title: focus ? "Focus" : "", value: "", focus: focus ? { id: focus.id, title: cut(focus.title, 60), startedAt: focus.startedAt, endsAt: focus.endsAt } : null });
}
